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

    // تسجيل الدخول / إنشاء المستخدم أولاً
    let currentUserId = null;
    try {
      const res = await fetch('/api/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_id: user.id,
          chat_id: user.id,
          full_name: user.first_name + ' ' + (user.last_name || ''),
          role: 'customer' // مؤقت
        })
      });
      const result = await res.json();
      if (result.user) {
        currentUserId = result.user.id;
        // تخزين user_id لاستخدامه لاحقًا
        localStorage.setItem('wasalni_user_id', currentUserId);
      } else {
        tg?.showAlert('فشل في إنشاء الحساب');
        return;
      }
    } catch(e) {
      tg?.showAlert('خطأ في الاتصال');
      return;
    }

    document.getElementById('submitBtn').addEventListener('click', async () => {
      if (!currentUserId) return;

      const phone = role === 'customer' ? document.getElementById('phone').value : document.getElementById('phoneDriver').value;
      if (!phone) { tg?.showAlert('يرجى إدخال رقم الهاتف'); return; }

      // تحديث رقم الهاتف
      try {
        await fetch('/api/auth', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegram_id: user.id,
            chat_id: user.id,
            full_name: user.first_name + ' ' + (user.last_name || ''),
            phone: phone,
            role: 'customer'
          })
        });
      } catch(e) {}

      // إذا كان سائق، أرسل بيانات السيارة
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
          localStorage.setItem('wasalni_role', role);
          tg?.showAlert('✅ تم إرسال طلب الانضمام');
          // انتظر قليلاً ثم انتقل
          setTimeout(() => {
            window.location.href = 'pending.html';
          }, 1000);
        } else {
          const errMsg = joinData.error || 'حدث خطأ غير معروف';
          tg?.showAlert('❌ ' + errMsg);
        }
      } catch(e) {
        tg?.showAlert('❌ فشل الاتصال بالخادم');
      }
    });
  });
})();
