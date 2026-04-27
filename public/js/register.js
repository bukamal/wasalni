(function() {
  const tg = window.Telegram.WebApp;
  if (tg) { tg.expand(); tg.ready(); }

  const urlParams = new URLSearchParams(window.location.search);
  const role = urlParams.get('role');

  function fileToBase64(file) {
    return new Promise((resolve) => {
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  function showPreview(inputElement, imgElement) {
    if (inputElement.files && inputElement.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        imgElement.src = e.target.result;
        imgElement.classList.remove('hidden');
      };
      reader.readAsDataURL(inputElement.files[0]);
    }
  }

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

    document.getElementById('personalPhoto').addEventListener('change', function() {
      showPreview(this, document.getElementById('personalPhotoPreview'));
    });
    if (role === 'driver') {
      document.getElementById('licensePhoto').addEventListener('change', function() {
        showPreview(this, document.getElementById('licensePhotoPreview'));
      });
      document.getElementById('carPhoto').addEventListener('change', function() {
        showPreview(this, document.getElementById('carPhotoPreview'));
      });
    }

    // جلب/إنشاء المستخدم
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
        localStorage.setItem('wasalni_user_id', currentUserId);
        localStorage.setItem('wasalni_telegram_id', user.id);
      } else {
        tg?.showAlert('فشل في إنشاء الحساب');
        return;
      }
    } catch(e) {
      tg?.showAlert('خطأ في الاتصال');
      return;
    }

    // التحقق من وجود طلب سابق
    try {
      const statusRes = await fetch('/api/join-request?action=status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUserId })
      });
      const statusData = await statusRes.json();
      const req = statusData.request;
      if (req) {
        if (req.status === 'approved') {
          localStorage.setItem('wasalni_role', req.requested_role);
          window.location.href = req.requested_role === 'driver' ? 'driver.html' : 'customer.html';
          return;
        } else if (req.status === 'pending') {
          tg?.showAlert('لديك طلب قيد المراجعة بالفعل');
          setTimeout(() => { window.location.href = 'pending.html'; }, 1500);
          return;
        }
      }
    } catch(e) {}

    // إرسال الطلب
    document.getElementById('submitBtn').addEventListener('click', async () => {
      const phone = role === 'customer' ? document.getElementById('phone').value : document.getElementById('phoneDriver').value;
      if (!phone) { tg?.showAlert('يرجى إدخال رقم الهاتف'); return; }

      const personalPhotoFile = document.getElementById('personalPhoto').files[0];
      const personalPhotoBase64 = await fileToBase64(personalPhotoFile);

      try {
        await fetch('/api/auth', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegram_id: user.id,
            chat_id: user.id,
            full_name: user.first_name + ' ' + (user.last_name || ''),
            phone: phone,
            gender: document.getElementById('gender').value,
            photo: personalPhotoBase64,
            role: 'customer'
          })
        });
      } catch(e) {}

      if (role === 'driver') {
        const carModel = document.getElementById('carModel').value;
        const carPlate = document.getElementById('carPlate').value;
        if (!carModel || !carPlate) { tg?.showAlert('يرجى إدخال بيانات السيارة'); return; }

        const licenseFile = document.getElementById('licensePhoto').files[0];
        const carFile = document.getElementById('carPhoto').files[0];
        const [licenseBase64, carBase64] = await Promise.all([
          fileToBase64(licenseFile),
          fileToBase64(carFile)
        ]);

        try {
          await fetch('/api/driver-register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: currentUserId,
              car_model: carModel,
              car_plate: carPlate,
              license_photo: licenseBase64,
              car_photo: carBase64
            })
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
