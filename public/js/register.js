(function() {
  const tg = window.Telegram.WebApp;
  if (tg) { tg.expand(); tg.ready(); }

  const urlParams = new URLSearchParams(window.location.search);
  const role = urlParams.get('role');

  document.addEventListener('DOMContentLoaded', async () => {
    const user = tg?.initDataUnsafe?.user;
    if (!user) {
      document.body.innerHTML = '<div class="container" style="text-align:center;padding-top:40vh"><h2>⚠️ افتح من تيليجرام</h2></div>';
      return;
    }

    if (role === 'customer') {
      document.getElementById('formTitle').textContent = 'تسجيل زبون';
      document.getElementById('customerFields').classList.remove('hidden');
    } else if (role === 'driver') {
      document.getElementById('formTitle').textContent = 'تسجيل سائق';
      document.getElementById('driverFields').classList.remove('hidden');
    } else {
      window.location.href = 'login.html';
      return;
    }

    // تسجيل/تحديث المستخدم أولاً
    let currentUserId;
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_id: user.id,
          chat_id: user.id,
          full_name: user.first_name + ' ' + (user.last_name || ''),
          role: 'customer' // مؤقت
        })
      });
      const result = await res.json();
      if (result.user) currentUserId = result.user.id;
    } catch(e) {}

    // إرسال الطلب
    document.getElementById('submitBtn').addEventListener('click', async () => {
      if (!currentUserId) return;

      const phone = role === 'customer' ? document.getElementById('phone').value : document.getElementById('phoneDriver').value;
      const carModel = role === 'driver' ? document.getElementById('carModel').value : null;
      const carPlate = role === 'driver' ? document.getElementById('carPlate').value : null;

      if (!phone) {
        tg?.showAlert('يرجى إدخال رقم الهاتف');
        return;
      }
      if (role === 'driver' && (!carModel || !carPlate)) {
        tg?.showAlert('يرجى إدخال بيانات السيارة');
        return;
      }

      try {
        // تحديث بيانات المستخدم
        await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegram_id: user.id,
            chat_id: user.id,
            full_name: user.first_name + ' ' + (user.last_name || ''),
            phone: phone,
            role: 'customer'
          })
        });

        // إذا كان سائق، أضف بيانات السيارة
        if (role === 'driver') {
          await fetch('/api/driver-register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: currentUserId,
              car_model: carModel,
              car_plate: carPlate
            })
          });
        }

        // إنشاء طلب الانضمام
        const joinRes = await fetch('/api/join-request?action=create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: currentUserId, requested_role: role })
        });
        const joinData = await joinRes.json();
        if (joinData.request) {
          localStorage.setItem('wasalni_role', role);
          window.location.href = 'pending.html';
        } else {
          tg?.showAlert('حدث خطأ في إرسال الطلب');
        }
      } catch(e) {
        tg?.showAlert('خطأ في الاتصال');
      }
    });
  });
})();
