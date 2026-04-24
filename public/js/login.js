(function() {
  const tg = window.Telegram.WebApp;
  if (tg) {
    tg.expand();
    tg.ready();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const statusEl = document.getElementById('loginStatus');
    const adminCard = document.getElementById('roleAdmin');

    function showStatus(msg, isError) {
      if (statusEl) {
        statusEl.textContent = msg;
        statusEl.className = 'login-status' + (isError ? ' error' : '');
        if (isError) console.error('[وصلني] ' + msg);
        else console.log('[وصلني] ' + msg);
      }
    }

    const user = tg?.initDataUnsafe?.user;
    if (!user) {
      showStatus('⚠️ الرجاء فتح التطبيق من داخل تيليجرام', true);
      return;
    }

    // تسجيل المستخدم تلقائياً
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_id: user.id,
          chat_id: user.id,
          full_name: user.first_name + ' ' + (user.last_name || ''),
          role: 'customer'
        })
      });

      // قراءة الاستجابة كنص أولاً لتجنب خطأ JSON.parse
      const text = await res.text();
      console.log('[وصلني] استجابة /api/auth:', text);

      let result;
      try {
        result = JSON.parse(text);
      } catch (jsonError) {
        // الاستجابة ليست JSON (غالباً HTML)
        showStatus('استجابة غير صحيحة من الخادم: ' + text.substring(0, 150), true);
        return;
      }

      if (result.user) {
        // التحقق من صلاحية الأدمن
        try {
          const adminRes = await fetch('/api/admin-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: user.id })
          });
          const adminResult = await adminRes.json();
          if (adminResult.error) {
            showStatus('فشل في التحقق من صلاحية الأدمن: ' + adminResult.error, true);
          } else if (adminResult.isAdmin) {
            adminCard.classList.remove('hidden');
            adminCard.style.opacity = '0';
            adminCard.style.transition = 'opacity 0.5s ease';
            setTimeout(() => { adminCard.style.opacity = '1'; }, 10);
            showStatus('', false);
          } else {
            showStatus('', false);
          }
        } catch (e) {
          showStatus('خطأ في الاتصال بخادم التحقق من الأدمن: ' + e.message, true);
        }
      } else {
        showStatus('فشل تسجيل الدخول: ' + (result.error || 'خطأ غير معروف'), true);
      }
    } catch (e) {
      showStatus('خطأ في الاتصال بخادم تسجيل الدخول: ' + e.message, true);
    }

    // ربط الأزرار
    function selectRole(role) {
      localStorage.setItem('wasalni_role', role);
      switch (role) {
        case 'customer': window.location.href = 'customer.html'; break;
        case 'driver': window.location.href = 'driver.html'; break;
        case 'admin': window.location.href = 'admin.html'; break;
      }
    }
    document.getElementById('roleCustomer').addEventListener('click', () => selectRole('customer'));
    document.getElementById('roleDriver').addEventListener('click', () => selectRole('driver'));
    document.getElementById('roleAdmin').addEventListener('click', () => selectRole('admin'));
  });
})();
