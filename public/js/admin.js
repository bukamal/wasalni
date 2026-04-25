(function() {
  const tg = window.Telegram.WebApp;
  if (tg) {
    tg.expand();
    tg.ready();
  }

  let currentFilter = 'all';

  function getJoinStatusText(status) {
    const map = { 'pending': 'قيد الانتظار', 'approved': '✅ مقبول', 'rejected': '❌ مرفوض' };
    return map[status] || status;
  }

  function getRideStatusText(status) {
    const map = { 'pending': 'معلق', 'accepted': 'مقبول', 'picked_up': 'التقط الراكب', 'completed': 'مكتمل', 'cancelled': 'ملغي' };
    return map[status] || status;
  }

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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: user.id })
      });
      const result = await res.json();
      if (!result.isAdmin) {
        document.body.innerHTML = '<div class="container" style="text-align:center;padding-top:40vh"><h2>⛔ غير مصرح</h2></div>';
        return;
      }
    } catch (e) { return; }

    document.getElementById('tabAll').addEventListener('click', (e) => filterRides('all', e.target));
    document.getElementById('tabPending').addEventListener('click', (e) => filterRides('pending', e.target));
    document.getElementById('tabAccepted').addEventListener('click', (e) => filterRides('accepted', e.target));
    document.getElementById('tabCompleted').addEventListener('click', (e) => filterRides('completed', e.target));

    await loadStats();
    await loadJoinRequests();
    await loadRides();

    setInterval(() => {
      loadStats();
      loadJoinRequests();
      loadRides();
    }, 10000);
  });

  async function loadStats() {
    try {
      const res = await fetch('/api/admin?action=stats', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
        const user = req.users;
        const isDriver = req.requested_role === 'driver';
        const driver = req.driver_details;

        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
          <div class="info" style="width:100%">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <strong>${user?.full_name || 'مجهول'} (${isDriver ? '🚗 سائق' : '👤 زبون'})</strong>
              <span class="badge badge-${req.status}">${getJoinStatusText(req.status)}</span>
            </div>
            <small>📞 ${user?.phone || 'لا يوجد'}</small>
            ${isDriver && driver ? `<div style="margin-top:6px"><small>🚘 ${driver.car_model || 'غير محدد'}</small><br><small>🔢 ${driver.car_plate || 'غير محدد'}</small></div>` : ''}
          </div>
          <div class="actions" style="margin-top:8px; display:flex; gap:8px;">
            ${req.status === 'pending' ? `
              <button class="btn-success approve-btn" data-id="${req.id}">قبول</button>
              <button class="btn-danger reject-btn" data-id="${req.id}">رفض</button>
            ` : ''}
            <button class="btn-danger delete-user-btn" data-userid="${req.user_id}">🗑 حذف</button>
          </div>
        `;
        list.appendChild(div);
      });

      list.querySelectorAll('.approve-btn').forEach(btn => {
        btn.onclick = () => handleJoinRequest(btn.dataset.id, 'approved');
      });
      list.querySelectorAll('.reject-btn').forEach(btn => {
        btn.onclick = () => handleJoinRequest(btn.dataset.id, 'rejected');
      });
      list.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.onclick = () => {
          if (confirm('هل أنت متأكد من حذف هذا المستخدم وكل بياناته؟')) {
            deleteUser(btn.dataset.userid);
          }
        };
      });

    } catch (e) {}
  }

  async function handleJoinRequest(requestId, status) {
    try {
      const res = await fetch('/api/admin?action=handle_join_request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tg.initDataUnsafe.user.id, request_id: requestId, status })
      });
      if (res.ok) {
        tg?.showAlert(status === 'approved' ? '✅ تم قبول الطلب' : '❌ تم رفض الطلب');
        loadJoinRequests();
        loadStats();
      } else {
        const err = await res.json();
        tg?.showAlert('خطأ: ' + (err.error || 'فشل'));
      }
    } catch (e) {
      tg?.showAlert('حدث خطأ');
    }
  }

  async function deleteUser(userId) {
    try {
      const res = await fetch('/api/admin?action=delete_user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tg.initDataUnsafe.user.id, user_id: userId })
      });
      if (res.ok) {
        tg?.showAlert('✅ تم حذف المستخدم وكل بياناته');
        loadJoinRequests();
        loadStats();
      } else {
        const err = await res.json();
        tg?.showAlert('❌ ' + (err.error || 'فشل الحذف'));
      }
    } catch(e) {
      tg?.showAlert('❌ خطأ في الاتصال');
    }
  }

  // دوال المشاوير ...
  async function loadRides() {
    try {
      const res = await fetch('/api/admin?action=all_rides', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
              <span class="badge badge-${ride.status}">${getRideStatusText(ride.status)}</span>
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

      list.querySelectorAll('.manage-btn').forEach(btn => {
        btn.onclick = () => manageRide(btn.dataset.id, btn.dataset.status);
      });

    } catch (e) {}
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tg.initDataUnsafe.user.id, id, status })
      });
      if (res.ok) {
        tg?.showAlert('✅ تم تحديث الحالة');
        loadStats();
        loadRides();
      }
    } catch (e) {}
  }

})();
