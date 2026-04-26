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

    if (role !== 'customer' && role !== 'driver') {
      window.location.href = 'login.html';
      return;
    }

    if (role === 'customer') {
      document.getElementById('formTitle').textContent = 'تسجيل زبون';
      document.getElementById('customerFields').classList.remove('hidden');
    } else {
      document.getElementById('formTitle').textContent = 'تسجيل سائق';
      document.getElementById('driverFields').classList.remove('hidden');
    }

    // الحصول على userId نظيف من auth
    let currentUserId = null;
    try {
      const res = await fetch('/api/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_id: user.id,
          chat_id: user.id,
          full_name: user.first_name + ' ' + (user.last_name || ''),
          role: 'customer'
        })
      });
      const result = await res.json();
      if (result.user && result.user.id) {
        currentUserId = result.user.id;
        // خزّنه بشكل صحيح
        AppState.userId = currentUserId;
      } else {
        tg?.showAlert('فشل في إنشاء الحساب');
        return;
      }
    } catch(e) {
      tg?.showAlert('خطأ في الاتصال');
      return;
    }

    // التحقق من حالة الطلب السابقة
    try {
      const res = await fetch('/api/join-request?action=status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUserId })
      });
      const data = await res.json();
      const req = data.request;
      if (req) {
        if (req.status === 'approved') {
          AppState.role = req.requested_role;
          window.location.href = req.requested_role === 'driver' ? 'driver.html' : 'customer.html';
          return;
        } else if (req.status === 'pending') {
          tg?.showAlert('لديك طلب قيد المراجعة بالفعل');
          setTimeout(() => { window.location.href = 'pending.html'; }, 1500);
          return;
        }
      }
    } catch(e) {}

    document.getElementById('submitBtn').addEventListener('click', async () => {
      const gender = document.getElementById('gender').value;
      const phone = role === 'customer' ? document.getElementById('phone').value : document.getElementById('phoneDriver').value;
      if (!phone) { tg?.showAlert('يرجى إدخال رقم الهاتف'); return; }

      // تحديث بيانات المستخدم
      try {
        await fetch('/api/auth', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegram_id: user.id,
            chat_id: user.id,
            full_name: user.first_name + ' ' + (user.last_name || ''),
            phone: phone,
            gender: gender,
            role: 'customer'
          })
        });
      } catch(e) {}

      if (role === 'driver') {
        const carModel = document.getElementById('carModel').value;
        const carPlate = document.getElementById('carPlate').value;
        if (!carModel || !carPlate) { tg?.showAlert('يرجى إدخال بيانات السيارة'); return; }
        try {
          await fetch('/api/driver-register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUserId, car_model: carModel, car_plate: carPlate })
          });
        } catch(e) {}
      }

      // إنشاء طلب الانضمام
      try {
        const joinRes = await fetch('/api/join-request?action=create', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: currentUserId, requested_role: role })
        });
        const joinData = await joinRes.json();
        if (joinData.request) {
          AppState.role = role;
          tg?.showAlert('✅ تم إرسال طلب الانضمام');
          setTimeout(() => { window.location.href = 'pending.html'; }, 1000);
        } else {
          tg?.showAlert('❌ ' + (joinData.error || 'حدث خطأ'));
        }
      } catch(e) {
        tg?.showAlert('❌ فشل الاتصال بالخادم');
      }
    });
  });
})();
