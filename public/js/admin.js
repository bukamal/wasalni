(function() {
  const tg = window.Telegram.WebApp;
  if (tg) {
    tg.expand();
    tg.ready();
  }

  let currentFilter = 'all';

  document.getElementById('backBtn').addEventListener('click', () => window.location.href = 'login.html');
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'login.html';
  });

  document.addEventListener('DOMContentLoaded', async () => {
    const user = tg?.initDataUnsafe?.user;
    if (!user) return;

    try {
      const res = await fetch('/api/admin-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: user.id })
      });
      const result = await res.json();
      if (!result.isAdmin) {
        document.body.innerHTML = '<div class="container" style="text-align:center;padding-top:40vh"><h2>⛔ غير مصرح</h2><p>ليس لديك صلاحية الوصول</p></div>';
        return;
      }
    } catch (e) { return; }

    document.getElementById('tabAll').addEventListener('click', (e) => filterRides('all', e.target));
    document.getElementById('tabPending').addEventListener('click', (e) => filterRides('pending', e.target));
    document.getElementById('tabAccepted').addEventListener('click', (e) => filterRides('accepted', e.target));
    document.getElementById('tabCompleted').addEventListener('click', (e) => filterRides('completed', e.target));

    loadStats();
    loadRides();
    loadJoinRequests();
    setInterval(() => { loadStats(); loadRides(); loadJoinRequests(); }, 10000);
  });

  async function loadStats() {
    try {
      const res = await fetch('/api/admin?action=stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tg.initDataUnsafe.user.id })
      });
      const { rides, users } = await res.json();
      document.getElementById('totalRides').textContent = rides?.length || 0;
      document.getElementById('totalDrivers').textContent = users?.filter(u => u.role === 'driver').length || 0;
      document.getElementById('totalCustomers').textContent = users?.filter(u => u.role === 'customer').length || 0;
    } catch (e) {}
  }

  async function loadJoinRequests() {
    try {
      const res = await fetch('/api/admin?action=list_join_requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tg.initDataUnsafe.user.id })
      });
      const { data } = await res.json();
      const list = document.getElementById('joinRequestsList');
      list.innerHTML = '';
      document.getElementById('joinRequestsCount').textContent = data?.length || 0;
      if (!data || data.length === 0) {
        list.innerHTML = '<div class="list-item" style="justify-content:center;color:var(--text-light)">لا توجد طلبات انضمام</div>';
        return;
      }
      data.forEach(req => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
          <div class="info" style="width:100%">
            <strong>${req.users?.full_name || 'مجهول'}</strong>
            <small>${req.requested_role === 'driver' ? '🚗 سائق' : '👤 زبون'}</small>
            <small>الحالة: ${req.status === 'pending' ? 'قيد الانتظار' : req.status === 'approved' ? '✅ مقبول' : '❌ مرفوض'}</small>
          </div>
          ${req.status === 'pending' ? `
          <div class="actions">
            <button class="btn-success approve-btn" data-id="${req.id}">قبول</button>
            <button class="btn-danger reject-btn" data-id="${req.id}">رفض</button>
          </div>` : ''}
        `;
        list.appendChild(div);
      });
      document.querySelectorAll('.approve-btn').forEach(btn => btn.addEventListener('click', (e) => handleJoinRequest(e.target.dataset.id, 'approved')));
      document.querySelectorAll('.reject-btn').forEach(btn => btn.addEventListener('click', (e) => handleJoinRequest(e.target.dataset.id, 'rejected')));
    } catch (e) {}
  }

  async function handleJoinRequest(requestId, status) {
    try {
      await fetch('/api/admin?action=handle_join_request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tg.initDataUnsafe.user.id, request_id: requestId, status })
      });
      loadJoinRequests();
      loadStats();
    } catch (e) {}
  }

  async function loadRides() {
    try {
      const res = await fetch('/api/admin?action=all_rides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tg.initDataUnsafe.user.id })
      });
      const { data } = await res.json();
      const list = document.getElementById('adminRidesList');
      list.innerHTML = '';

      let filtered = data || [];
      if (currentFilter !== 'all') {
        filtered = filtered.filter(r => r.status === currentFilter);
      }

      if (filtered.length === 0) {
        list.innerHTML = '<div class="list-item" style="justify-content:center;color:var(--text-light)">لا توجد طلبات</div>';
        return;
      }

      filtered.forEach(ride => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
          <div class="info" style="width:100%">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <strong>${ride.pickup_address} → ${ride.dropoff_address}</strong>
              <span class="badge badge-${ride.status}">${getStatusText(ride.status)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <small>${ride.users?.full_name || 'Unknown'} · ${ride.price || 0} ر.س</small>
              <small>${new Date(ride.created_at).toLocaleString('ar-SA')}</small>
            </div>
          </div>
          <div class="actions" style="margin-top:12px">
            ${ride.status === 'pending' ? `<button class="btn-success manage-btn" data-id="${ride.id}" data-status="accepted">قبول</button>` : ''}
            ${ride.status !== 'completed' && ride.status !== 'cancelled' ? `<button class="btn-danger manage-btn" data-id="${ride.id}" data-status="cancelled">إلغاء</button>` : ''}
            ${ride.status === 'accepted' ? `<button class="btn-primary manage-btn" data-id="${ride.id}" data-status="completed">إنهاء</button>` : ''}
          </div>
        `;
        list.appendChild(div);
      });

      document.querySelectorAll('.manage-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.target.dataset.id;
          const status = e.target.dataset.status;
          manageRide(id, status);
        });
      });
    } catch (e) {}
  }

  function getStatusText(status) {
    const map = {
      'pending': 'معلق',
      'accepted': 'مقبول',
      'picked_up': 'التقط الراكب',
      'completed': 'مكتمل',
      'cancelled': 'ملغي'
    };
    return map[status] || status;
  }

  function filterRides(filter, targetEl) {
    currentFilter = filter;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    targetEl.classList.add('active');
    loadRides();
  }

  async function manageRide(id, status) {
    try {
      const res = await fetch('/api/admin?action=manage_ride', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tg.initDataUnsafe.user.id, id, status })
      });
      const result = await res.json();
      if (result.data) {
        loadStats();
        loadRides();
      }
    } catch (e) {}
  }
})();
