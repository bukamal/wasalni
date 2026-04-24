(function() {
  const tg = window.Telegram.WebApp;
  if (tg) { tg.expand(); tg.ready(); }

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
        if (!authData.user) { window.location.href = 'login.html'; return false; }
        userId = authData.user.id;
      } catch(e) { window.location.href = 'login.html'; return false; }
    }

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
    } catch(e) { window.location.href = 'login.html'; return false; }
  }

  document.getElementById('backBtn').addEventListener('click', () => window.location.href = 'login.html');

  let currentDriverId = null;
  let activeRide = null;

  document.addEventListener('DOMContentLoaded', async () => {
    currentDriverId = await ensureApproved('driver');
    if (!currentDriverId) return;

    const user = tg?.initDataUnsafe?.user;
    document.getElementById('driverName').textContent = user?.first_name || 'سائق';

    document.getElementById('onlineToggle').addEventListener('change', toggleStatus);
    document.getElementById('btnPickedUp').addEventListener('click', () => updateRide('picked_up'));
    document.getElementById('btnCompleted').addEventListener('click', () => updateRide('completed'));
    document.getElementById('btnCancelled').addEventListener('click', () => updateRide('cancelled'));

    loadRequests();
    setInterval(loadRequests, 10000);
  });

  async function toggleStatus() {
    const online = document.getElementById('onlineToggle').checked;
    document.getElementById('statusLabel').textContent = online ? 'متاح' : 'غير متاح';
    if (!currentDriverId) return;
    try {
      await fetch('/api/driver-status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: currentDriverId, online })
      });
    } catch(e) {}
  }

  // ... باقي دوال loadRequests, acceptRide, updateRide كما كانت
  // (سأدرجها مختصرة لضمان كمال الملف)
  async function loadRequests() {
    try {
      const res = await fetch('/api/rides?action=list', { method: 'POST' });
      const result = await res.json();
      const list = document.getElementById('requestsList');
      list.innerHTML = '';
      document.getElementById('requestsCount').textContent = result.data?.length || 0;
      if (!result.data?.length) {
        list.innerHTML = '<div class="list-item" style="justify-content:center;color:var(--text-light)">لا توجد طلبات جديدة</div>';
        return;
      }
      result.data.forEach(ride => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
          <div class="info"><strong>${ride.pickup_address} → ${ride.dropoff_address}</strong>
          <small>${ride.users?.full_name || 'Unknown'} · ${ride.price} ر.س</small></div>
          <div class="actions"><button class="btn-success accept-btn" data-id="${ride.id}">قبول</button>
          <button class="btn-danger reject-btn" data-id="${ride.id}">رفض</button></div>`;
        list.appendChild(div);
      });
      list.querySelectorAll('.accept-btn').forEach(b => b.onclick = () => acceptRide(b.dataset.id));
      list.querySelectorAll('.reject-btn').forEach(b => b.onclick = () => loadRequests());
    } catch(e) {}
  }

  async function acceptRide(rideId) {
    const res = await fetch('/api/rides?action=update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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
        <p><strong>السعر:</strong> ${result.data.price} ر.س</p>`;
    }
  }

  async function updateRide(status) {
    if (!activeRide) return;
    const res = await fetch('/api/rides?action=update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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
  }
})();
