(function() {
  const tg = window.Telegram.WebApp;
  if (tg) { tg.expand(); tg.ready(); }

  let currentUserId = null;
  let map;
  let pickupMarker, dropoffMarker, driverMarker;
  let pickupCoords = null;
  let dropoffCoords = null;
  let allDrivers = [];
  let activeRide = null;
  let trackingInterval = null;

  function initMap() {
    const defaultLat = 24.7136;
    const defaultLng = 46.6753;
    map = L.map('map', { center: [defaultLat, defaultLng], zoom: 13, attributionControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        map.setView([pos.coords.latitude, pos.coords.longitude], 14);
        setPickupLocation(pos.coords.latitude, pos.coords.longitude);
      }, () => setPickupLocation(defaultLat, defaultLng));
    } else {
      setPickupLocation(defaultLat, defaultLng);
    }
    map.on('click', e => setDropoffLocation(e.latlng.lat, e.latlng.lng));
  }

  function setPickupLocation(lat, lng) {
    pickupCoords = { lat, lng };
    if (pickupMarker) map.removeLayer(pickupMarker);
    pickupMarker = L.marker([lat, lng]).addTo(map).bindPopup('📍 الالتقاط').openPopup();
    document.getElementById('pickup').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    loadNearbyDrivers();
  }

  function setDropoffLocation(lat, lng) {
    dropoffCoords = { lat, lng };
    if (dropoffMarker) map.removeLayer(dropoffMarker);
    dropoffMarker = L.marker([lat, lng]).addTo(map).bindPopup('🏁 الوجهة').openPopup();
    document.getElementById('dropoff').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  async function loadNearbyDrivers() {
    if (!pickupCoords) return;
    const gender = document.getElementById('driverGender').value;
    try {
      const res = await fetch('/api/nearby-drivers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: pickupCoords.lat, lng: pickupCoords.lng, gender })
      });
      const { data } = await res.json();
      allDrivers = data || [];
      showNearbyDriversOnMap();
      showNearbyDriversList();
    } catch(e) {}
  }

  function showNearbyDriversOnMap() {
    map.eachLayer(layer => {
      if (layer instanceof L.Marker && layer !== pickupMarker && layer !== dropoffMarker && layer !== driverMarker) {
        map.removeLayer(layer);
      }
    });
    allDrivers.forEach(d => {
      if (d.lat && d.lng) {
        L.marker([d.lat, d.lng], {
          icon: L.divIcon({ className: 'driver-marker', html: '<div style="background:#FF6B35;color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:14px;">🚗</div>', iconSize: [24,24], iconAnchor: [12,12] }),
          title: d.full_name
        }).addTo(map).bindPopup(`${d.full_name || 'سائق'} (${d.distance} كم)`);
      }
    });
  }

  function showNearbyDriversList() {
    const card = document.getElementById('nearbyDriversCard');
    const list = document.getElementById('nearbyDriversList');
    document.getElementById('nearbyCount').textContent = allDrivers.length;
    list.innerHTML = '';
    card.classList.toggle('hidden', allDrivers.length === 0);
    allDrivers.forEach(d => {
      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = `<div class="info"><strong>${d.full_name || 'سائق'}</strong><small>🚘 ${d.car_model || 'سيارة'} · ${d.distance} كم</small></div><span class="badge badge-accepted">متاح</span>`;
      list.appendChild(div);
    });
  }

  // ---------- تتبع السائق ----------
  async function trackDriver() {
    if (!activeRide) return;
    try {
      const res = await fetch('/api/rides?action=track', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ride_id: activeRide.id })
      });
      const result = await res.json();
      const ride = result.data;
      const driver = ride?.drivers;
      if (driver && driver.current_lat && driver.current_lng) {
        const lat = driver.current_lat;
        const lng = driver.current_lng;
        if (driverMarker) map.removeLayer(driverMarker);
        driverMarker = L.marker([lat, lng], {
          icon: L.divIcon({ className: 'driver-marker', html: '<div style="background:#2ECC71;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:16px;">🚗</div>', iconSize: [28,28], iconAnchor: [14,14] })
        }).addTo(map).bindPopup(`سائقك: ${driver.users?.full_name || 'سائق'}`);
        map.setView([lat, lng]);
      }
      // التحقق من اكتمال الرحلة
      if (ride.status === 'completed') {
        stopTracking();
        const rating = prompt('كيف تقيم رحلتك؟ (1-5)');
        if (rating && !isNaN(rating)) {
          await fetch('/api/rides?action=update', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: activeRide.id, rating: parseFloat(rating) })
          });
        }
        tg?.showAlert('✅ تمت الرحلة بنجاح');
        resetToRequestForm();
      }
    } catch(e) {}
  }

  function startTracking(ride) {
    activeRide = ride;
    document.getElementById('rideStatus').innerHTML = `
      <div class="status-header"><h3>🚗 السائق في الطريق</h3></div>
      <p class="status-text">يمكنك تتبع السائق على الخريطة</p>`;
    trackingInterval = setInterval(trackDriver, 5000);
  }

  function stopTracking() {
    if (trackingInterval) clearInterval(trackingInterval);
    if (driverMarker) map.removeLayer(driverMarker);
  }

  function resetToRequestForm() {
    document.querySelector('.ride-options').classList.remove('hidden');
    document.getElementById('rideStatus').classList.add('hidden');
    if (driverMarker) map.removeLayer(driverMarker);
  }

  // ---------- الصلاحية ----------
  async function ensureApproved(requiredRole) {
    const user = tg?.initDataUnsafe?.user;
    if (!user) { window.location.href = 'login.html'; return false; }
    let userId = localStorage.getItem('wasalni_user_id');
    if (!userId) {
      try {
        const authRes = await fetch('/api/auth', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telegram_id: user.id, chat_id: user.id, full_name: 'check' })
        });
        const authData = await authRes.json();
        if (authData.user) userId = authData.user.id;
      } catch(e) {}
    }
    if (!userId) { window.location.href = 'login.html'; return false; }
    try {
      const res = await fetch('/api/join-request?action=status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });
      const req = (await res.json()).request;
      if (req && req.status === 'approved' && req.requested_role === requiredRole) return userId;
      window.location.href = 'pending.html';
      return false;
    } catch(e) { window.location.href = 'pending.html'; return false; }
  }

  async function requestRide() {
    if (!pickupCoords || !dropoffCoords) { tg?.showAlert('❌ حدد الموقع والوجهة'); return; }
    const price = parseFloat(document.getElementById('price').value) || 0;
    const gender = document.getElementById('driverGender').value;
    const vehicle = document.getElementById('vehicleType').value;

    try {
      const res = await fetch('/api/rides?action=create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: currentUserId,
          pickup_lat: pickupCoords.lat, pickup_lng: pickupCoords.lng,
          dropoff_lat: dropoffCoords.lat, dropoff_lng: dropoffCoords.lng,
          pickup_address: document.getElementById('pickup').value,
          dropoff_address: document.getElementById('dropoff').value,
          price, driver_gender_pref: gender, vehicle_type_pref: vehicle,
          status: 'pending'
        })
      });
      const result = await res.json();
      if (result.error) { tg?.showAlert('❌ ' + result.error); return; }

      // راقب حالة الرحلة حتى تُقبل
      document.querySelector('.ride-options').classList.add('hidden');
      document.getElementById('nearbyDriversCard').classList.add('hidden');
      document.getElementById('rideStatus').classList.remove('hidden');
      tg?.showAlert('✅ تم إرسال الطلب');
      monitorRideAcceptance(result.data.id);
    } catch(e) { tg?.showAlert('❌ حدث خطأ'); }
  }

  async function monitorRideAcceptance(rideId) {
    const check = setInterval(async () => {
      try {
        const res = await fetch('/api/rides?action=track', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ride_id: rideId })
        });
        const data = await res.json();
        if (data.data?.status === 'accepted') {
          clearInterval(check);
          startTracking(data.data);
        }
      } catch(e) {}
    }, 3000);
  }

  async function loadMyRides() {
    if (!currentUserId) return;
    const res = await fetch('/api/rides?action=myrides', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: currentUserId })
    });
    const result = await res.json();
    const list = document.getElementById('ridesList');
    list.innerHTML = '';
    document.getElementById('ridesCount').textContent = result.data?.length || 0;
    if (!result.data?.length) {
      list.innerHTML = '<div class="list-item" style="justify-content:center;color:var(--text-light)">لا توجد مشاوير</div>';
      return;
    }
    result.data.forEach(ride => {
      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = `<div class="info"><strong>${ride.pickup_address} → ${ride.dropoff_address}</strong><small>${new Date(ride.created_at).toLocaleString('ar-SA')} · ${ride.price} ر.س</small></div><span class="badge badge-${ride.status}">${getStatusText(ride.status)}</span>`;
      list.appendChild(div);
    });
  }

  function getStatusText(s) {
    return { pending:'معلق', accepted:'مقبول', picked_up:'التقط الراكب', completed:'مكتمل', cancelled:'ملغي' }[s] || s;
  }

  // ---------- التهيئة ----------
  document.getElementById('backBtn').addEventListener('click', () => window.location.href = 'login.html');
  document.getElementById('logoutBtn').addEventListener('click', () => { localStorage.clear(); window.location.href = 'login.html'; });

  document.addEventListener('DOMContentLoaded', async () => {
    currentUserId = await ensureApproved('customer');
    if (!currentUserId) return;
    document.getElementById('userName').textContent = tg?.initDataUnsafe?.user?.first_name || 'زبون';
    initMap();
    document.getElementById('driverGender').addEventListener('change', loadNearbyDrivers);
    document.getElementById('requestRideBtn').addEventListener('click', requestRide);
    loadMyRides();
  });
})();
