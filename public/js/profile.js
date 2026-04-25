(function() {
  const tg = window.Telegram.WebApp;
  if (tg) { tg.expand(); tg.ready(); }

  let currentUser = null;

  async function loadProfile() {
    const userId = AppState.userId;
    if (!userId) {
      window.location.href = 'login.html';
      return;
    }
    try {
      const res = await fetch('/api/profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });
      const { user, driver } = await res.json();
      if (!user) return;

      currentUser = user;
      document.getElementById('displayName').textContent = user.full_name || 'مستخدم';
      document.getElementById('fullName').value = user.full_name || '';
      document.getElementById('phone').value = user.phone || '';
      document.getElementById('gender').value = user.gender || 'male';
      document.getElementById('roleBadge').textContent = user.role === 'driver' ? '🚗 سائق' : '👤 زبون';
      document.getElementById('userRating').textContent = user.rating || 5.0;
      document.getElementById('totalRidesCount').textContent = user.total_rides || 0;

      if (user.role === 'driver' && driver) {
        document.getElementById('driverExtra').classList.remove('hidden');
        document.getElementById('carModel').value = driver.car_model || '';
        document.getElementById('carPlate').value = driver.car_plate || '';
        document.getElementById('vehicleType').value = driver.vehicle_type || 'car';
      }
    } catch(e) {
      console.error(e);
    }
  }

  document.getElementById('saveBtn').addEventListener('click', async () => {
    const userId = AppState.userId;
    if (!userId) return;

    const payload = {
      user_id: userId,
      full_name: document.getElementById('fullName').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      gender: document.getElementById('gender').value
    };

    if (currentUser?.role === 'driver') {
      payload.driver = {
        car_model: document.getElementById('carModel').value.trim(),
        car_plate: document.getElementById('carPlate').value.trim(),
        vehicle_type: document.getElementById('vehicleType').value
      };
    }

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.user) {
        tg?.showAlert('✅ تم حفظ البيانات');
        loadProfile();
      } else {
        tg?.showAlert('❌ ' + (result.error || 'فشل الحفظ'));
      }
    } catch(e) {
      tg?.showAlert('❌ خطأ في الاتصال');
    }
  });

  document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = AppState.role === 'driver' ? 'driver.html' : 'customer.html';
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    AppState.clearAll();
    window.location.href = 'login.html';
  });

  document.addEventListener('DOMContentLoaded', loadProfile);
})();
