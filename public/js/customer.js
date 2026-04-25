(function() {
  const tg = window.Telegram.WebApp;
  if (tg) { tg.expand(); tg.ready(); }

  // ---------- متغيرات ----------
  let currentUserId = null;
  let map;
  let pickupMarker, dropoffMarker;
  let pickupCoords = null;  // {lat, lng}
  let dropoffCoords = null;
  let allDrivers = [];     // جميع السائقين المتاحين مع إحداثياتهم

  // ---------- دوال الخريطة ----------
  function initMap() {
    // الرياض كموقع افتراضي
    const defaultLat = 24.7136;
    const defaultLng = 46.6753;

    map = L.map('map', {
      center: [defaultLat, defaultLng],
      zoom: 13,
      attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    // محاولة الحصول على الموقع الحقيقي
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        const { latitude, longitude } = pos.coords;
        map.setView([latitude, longitude], 14);
        setPickupLocation(latitude, longitude);
      }, err => {
        // فشل التحديد، استخدم الافتراضي
        setPickupLocation(defaultLat, defaultLng);
      });
    } else {
      setPickupLocation(defaultLat, defaultLng);
    }

    // النقر على الخريطة يحدد الوجهة
    map.on('click', function(e) {
      setDropoffLocation(e.latlng.lat, e.latlng.lng);
    });
  }

  function setPickupLocation(lat, lng) {
    pickupCoords = { lat, lng };
    if (pickupMarker) map.removeLayer(pickupMarker);
    pickupMarker = L.marker([lat, lng], {
      draggable: false,
      title: 'موقع الالتقاط'
    }).addTo(map).bindPopup('📍 موقع الالتقاط').openPopup();
    document.getElementById('pickup').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    loadNearbyDrivers();
  }

  function setDropoffLocation(lat, lng) {
    dropoffCoords = { lat, lng };
    if (dropoffMarker) map.removeLayer(dropoffMarker);
    dropoffMarker = L.marker([lat, lng], {
      draggable: false,
      title: 'الوجهة'
    }).addTo(map).bindPopup('🏁 الوجهة').openPopup();
    document.getElementById('dropoff').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  // ---------- جلب السائقين القريبين ----------
  async function loadNearbyDrivers() {
    if (!pickupCoords) return;
    const gender = document.getElementById('driverGender').value;
    try {
      const res = await fetch('/api/nearby-drivers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: pickupCoords.lat,
          lng: pickupCoords.lng,
          gender: gender
        })
      });
      const { data } = await res.json();
      allDrivers = data || [];
      showNearbyDriversOnMap();
      showNearbyDriversList();
    } catch(e) {}
  }

  function showNearbyDriversOnMap() {
    // إزالة العلامات القديمة (باستثناء pickup/dropoff)
    map.eachLayer(layer => {
      if (layer instanceof L.Marker && layer !== pickupMarker && layer !== dropoffMarker) {
        map.removeLayer(layer);
      }
    });
    allDrivers.forEach(driver => {
      if (driver.lat && driver.lng) {
        const marker = L.marker([driver.lat, driver.lng], {
          icon: L.divIcon({
            className: 'driver-marker',
            html: `<div style="background:#FF6B35; color:white; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; font-size:14px;">🚗</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          }),
          title: driver.full_name
        }).addTo(map);
        marker.bindPopup(`${driver.full_name || 'سائق'} (${driver.distance} كم)`);
      }
    });
  }

  function showNearbyDriversList() {
    const card = document.getElementById('nearbyDriversCard');
    const list = document.getElementById('nearbyDriversList');
    document.getElementById('nearbyCount').textContent = allDrivers.length;
    list.innerHTML = '';
    if (allDrivers.length > 0) {
      card.classList.remove('hidden');
    } else {
      card.classList.add('hidden');
    }
    allDrivers.forEach(driver => {
      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = `
        <div class="info">
          <strong>${driver.full_name || 'سائق'}</strong>
          <small>🚘 ${driver.vehicle_type || 'سيارة'} · ${driver.distance} كم</small>
        </div>
        <span class="badge badge-accepted">متاح</span>
      `;
      list.appendChild(div);
    });
  }

  // ---------- فحص الصلاحية ----------
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
        if (authData.user) {
          userId = authData.user.id;
          localStorage.setItem('wasalni_user_id', userId);
        }
      } catch(e) {}
    }
    if (!userId) { window.location.href = 'login.html'; return false; }

    try {
      const res = await fetch('/api/join-request?action=status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });
      const result = await res.json();
      const req = result.request;
      if (req && req.status === 'approved' && req.requested_role === requiredRole) {
        return userId;
      }
      window.location.href = 'pending.html';
      return false;
    } catch(e) { window.location.href = 'pending.html'; return false; }
  }

  // ---------- إرسال الطلب ----------
  async function requestRide() {
    if (!pickupCoords || !dropoffCoords) {
      tg?.showAlert('❌ يرجى تحديد الموقع والوجهة على الخريطة');
      return;
    }
    const price = parseFloat(document.getElementById('price').value) || 0;
    const gender = document.getElementById('driverGender').value;
    const vehicle = document.getElementById('vehicleType').value;

    try {
      const res = await fetch('/api/rides?action=create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: currentUserId,
          pickup_lat: pickupCoords.lat,
          pickup_lng: pickupCoords.lng,
          dropoff_lat: dropoffCoords.lat,
          dropoff_lng: dropoffCoords.lng,
          pickup_address: document.getElementById('pickup').value,
          dropoff_address: document.getElementById('dropoff').value,
          price: price,
          driver_gender_pref: gender,
          vehicle_type_pref: vehicle,
          status: 'pending'
        })
      });
      const result = await res.json();
      if (result.error) {
        tg?.showAlert('❌ ' + result.error);
        return;
      }
      // إخفاء النموذج وإظهار حالة الانتظار
      document.querySelector('.ride-options').classList.add('hidden');
      document.getElementById('nearbyDriversCard').classList.add('hidden');
      document.getElementById('rideStatus').classList.remove('hidden');
      tg?.showAlert('✅ تم إرسال الطلب');
      loadMyRides();
    } catch(e) {
      tg?.showAlert('❌ حدث خطأ');
    }
  }

  // ---------- سجل المشاوير ----------
  async function loadMyRides() {
    if (!currentUserId) return;
    try {
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
        div.innerHTML = `
          <div class="info">
            <strong>${ride.pickup_address} → ${ride.dropoff_address}</strong>
            <small>${new Date(ride.created_at).toLocaleString('ar-SA')} · ${ride.price} ر.س</small>
          </div>
          <span class="badge badge-${ride.status}">${getStatusText(ride.status)}</span>
        `;
        list.appendChild(div);
      });
    } catch(e) {}
  }

  function getStatusText(s) {
    const map = { pending:'معلق', accepted:'مقبول', picked_up:'التقط الراكب', completed:'مكتمل', cancelled:'ملغي' };
    return map[s] || s;
  }

  // ---------- التهيئة ----------
  document.getElementById('backBtn').addEventListener('click', () => window.location.href = 'login.html');
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'login.html';
  });

  document.addEventListener('DOMContentLoaded', async () => {
    currentUserId = await ensureApproved('customer');
    if (!currentUserId) return;

    const user = tg?.initDataUnsafe?.user;
    document.getElementById('userName').textContent = user?.first_name || 'زبون';

    // تهيئة الخريطة
    initMap();
    // مستمعات
    document.getElementById('driverGender').addEventListener('change', loadNearbyDrivers);
    document.getElementById('requestRideBtn').addEventListener('click', requestRide);
    loadMyRides();
  });

})();
