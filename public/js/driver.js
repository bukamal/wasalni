(function() {
  const tg = window.Telegram.WebApp;
  if (tg) {
    tg.expand();
    tg.ready();
  }

  let currentDriver = null;
  let activeRide = null;

  // أزرار الرجوع والخروج
  document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = 'login.html';
  });
  // يمكن إضافة زر خروج منفصل، لكن في التصميم الجديد السائق لا يملك زر خروج واضح، سنضيفه في الهيدر
  // سنضيف مستمع لزر الخروج (إن أردت) لكن التصميم الحالي للسائق يظهر toggle فقط.
  // سنضيف زر خروج مؤقت بجانب العنوان (لكن لم نضعه في html)، لذا سنكتفي بالرجوع.
  
  document.addEventListener('DOMContentLoaded', async () => {
    const user = tg?.initDataUnsafe?.user;
    if (!user) {
      document.body.innerHTML = '<div class="container" style="text-align:center;padding-top:40vh"><h2>⚠️ افتح من تليجرام</h2></div>';
      return;
    }

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_id: user.id,
          chat_id: user.id,
          full_name: user.first_name + ' ' + (user.last_name || ''),
          role: 'driver'
        })
      });
      const result = await res.json();
      if (result.user) {
        document.getElementById('driverName').textContent = result.user.full_name || 'سائق';
        currentDriver = result.user;
      }
    } catch (e) {
      console.error(e);
    }

    document.getElementById('onlineToggle').addEventListener('change', toggleStatus);
    document.getElementById('btnPickedUp').addEventListener('click', () => updateRide('picked_up'));
    document.getElementById('btnCompleted').addEventListener('click', () => updateRide('completed'));
    document.getElementById('btnCancelled').addEventListener('click', () => updateRide('cancelled'));

    loadRequests();
    setInterval(loadRequests, 10000);
  });

  async function toggleStatus() {
    const online = document.getElementById('onlineToggle').checked;
    const label = document.getElementById('statusLabel');
    label.textContent = online ? 'متاح' : 'غير متاح';
    if (!currentDriver) return;
    try {
      await fetch('/api/driver-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: currentDriver.id, online })
      });
    } catch (e) {
      console.error(e);
    }
  }

  async function loadRequests() {
    try {
      const res = await fetch('/api/rides?action=list', { method: 'POST' });
      const result = await res.json();
      const list = document.getElementById('requestsList');
      list.innerHTML = '';
      document.getElementById('requestsCount').textContent = result.data?.length || 0;
      if (!result.data || result.data.length === 0) {
        list.innerHTML = '<div class="list-item" style="justify-content:center;color:var(--text-light)">لا توجد طلبات جديدة</div>';
        return;
      }
      result.data.forEach(ride => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
          <div class="info">
            <strong>${ride.pickup_address} → ${ride.dropoff_address}</strong>
            <small>${ride.users?.full_name || 'Unknown'} · ${ride.price} ر.س</small>
          </div>
          <div class="actions">
            <button class="btn-success accept-btn" data-id="${ride.id}">قبول</button>
            <button class="btn-danger reject-btn" data-id="${ride.id}">رفض</button>
          </div>
        `;
        list.appendChild(div);
      });
      // ربط أزرار القبول والرفض
      document.querySelectorAll('.accept-btn').forEach(btn => btn.addEventListener('click', (e) => acceptRide(e.target.dataset.id)));
      document.querySelectorAll('.reject-btn').forEach(btn => btn.addEventListener('click', (e) => rejectRide(e.target.dataset.id)));
    } catch (e) {
      console.error(e);
    }
  }

  async function acceptRide(rideId) {
    try {
      const res = await fetch('/api/rides?action=update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rideId, status: 'accepted' })
      });
      const result = await res.json();
      if (result.data) {
        activeRide = result.data;
        document.getElementById('requestsCard').classList.add('hidden');
        document.getElementById('currentRide').classList.remove('hidden');
        document.getElementById('rideDetails').innerHTML = `
          <p><strong>من:</strong> ${result.data.pickup_address}</p>
          <p><strong>إلى:</strong> ${result.data.dropoff_address}</p>
          <p><strong>السعر:</strong> ${result.data.price} ر.س</p>
        `;
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function rejectRide(rideId) {
    loadRequests();
  }

  async function updateRide(status) {
    if (!activeRide) return;
    try {
      const res = await fetch('/api/rides?action=update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeRide.id, status })
      });
      const result = await res.json();
      if (result.data) {
        if (status === 'completed' || status === 'cancelled') {
          document.getElementById('currentRide').classList.add('hidden');
          document.getElementById('requestsCard').classList.remove('hidden');
          activeRide = null;
          loadRequests();
        }
      }
    } catch (e) {
      console.error(e);
    }
  }
})();
