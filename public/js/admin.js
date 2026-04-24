const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  const user = tg.initDataUnsafe?.user;
  if (!user) {
    document.body.innerHTML = '<div class="container" style="text-align:center;padding-top:40vh"><h2>⚠️ افتح من تليجرام</h2></div>';
    return;
  }

  // Verify admin
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
  } catch (e) {
    console.error(e);
  }

  loadStats();
  loadRides();
  setInterval(() => { loadStats(); loadRides(); }, 10000);
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
  } catch (e) {
    console.error(e);
  }
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
          ${ride.status === 'pending' ? `<button class="btn-success" onclick="manageRide('${ride.id}', 'accepted')">قبول</button>` : ''}
          ${ride.status !== 'completed' && ride.status !== 'cancelled' ? `<button class="btn-danger" onclick="manageRide('${ride.id}', 'cancelled')">إلغاء</button>` : ''}
          ${ride.status === 'accepted' ? `<button class="btn-primary" onclick="manageRide('${ride.id}', 'completed')">إنهاء</button>` : ''}
        </div>
      `;
      list.appendChild(div);
    });
  } catch (e) {
    console.error(e);
  }
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

function filterRides(filter, ev) {
  currentFilter = filter;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  ev.target.classList.add('active');
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
      tg.showAlert('✅ تم تحديث الحالة بنجاح');
      loadStats();
      loadRides();
    }
  } catch (e) {
    tg.showAlert('❌ حدث خطأ');
  }
}

function logout() {
  localStorage.clear();
  window.location.href = 'login.html';
}
