(function() {
  const tg = window.Telegram.WebApp;
  if (tg) { tg.expand(); tg.ready(); }

  async function ensureApproved(requiredRole) {
    const user = tg?.initDataUnsafe?.user;
    if (!user) { window.location.href = 'login.html'; return false; }

    // محاولة استخدام user_id المخزن
    let userId = localStorage.getItem('wasalni_user_id');
    if (!userId) {
      // الحصول عليه من auth
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

    // التحقق من وجود طلب موافقة
    try {
      const res = await fetch('/api/join-request?action=status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });
      const result = await res.json();
      const req = result.request;
      if (req && req.status === 'approved' && req.requested_role === requiredRole) {
        // مسموح
        return userId;
      }
      // غير مسموح – توجيه للانتظار
      window.location.href = 'pending.html';
      return false;
    } catch(e) { window.location.href = 'login.html'; return false; }
  }

  document.getElementById('backBtn').addEventListener('click', () => window.location.href = 'login.html');
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'login.html';
  });

  let currentUserId = null;

  document.addEventListener('DOMContentLoaded', async () => {
    currentUserId = await ensureApproved('customer');
    if (!currentUserId) return;

    // عرض اسم المستخدم (اختياري)
    const user = tg?.initDataUnsafe?.user;
    document.getElementById('userName').textContent = user?.first_name || 'زبون';

    document.getElementById('requestRideBtn').addEventListener('click', requestRide);
    loadMyRides();
  });

  async function requestRide() {
    const pickup = document.getElementById('pickup').value.trim();
    const dropoff = document.getElementById('dropoff').value.trim();
    const price = parseFloat(document.getElementById('price').value) || 0;
    if (!pickup || !dropoff) { tg?.showAlert('❌ أدخل موقع الالتقاط والوجهة'); return; }

    try {
      const res = await fetch('/api/rides?action=create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: currentUserId,
          pickup_address: pickup, dropoff_address: dropoff, price,
          pickup_lat: 24.7136, pickup_lng: 46.6753,
          dropoff_lat: 24.7743, dropoff_lng: 46.7386,
          status: 'pending'
        })
      });
      const result = await res.json();
      if (result.error) { tg?.showAlert('❌ خطأ: ' + result.error); return; }
      document.getElementById('requestForm').classList.add('hidden');
      document.getElementById('rideStatus').classList.remove('hidden');
      tg?.showAlert('✅ تم إرسال الطلب');
      loadMyRides();
    } catch(e) { tg?.showAlert('❌ حدث خطأ'); }
  }

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
        list.innerHTML = '<div class="list-item" style="justify-content:center;color:var(--text-light)">لا توجد مشاوير سابقة</div>';
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
})();
