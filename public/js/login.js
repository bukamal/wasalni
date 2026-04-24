(function() {
  const tg = window.Telegram.WebApp;
  if (tg) {
    tg.expand();
    tg.ready();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const statusEl = document.getElementById('loginStatus');
    const adminCard = document.getElementById('roleAdmin');
    
    const user = tg?.initDataUnsafe?.user;
    if (!user) {
      statusEl.textContent = '⚠️ الرجاء فتح التطبيق من داخل تيليجرام';
      statusEl.className = 'login-status error';
      return;
    }

    // تسجيل المستخدم تلقائياً (أو تحديث بياناته)
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
      const result = await res.json();
      if (result.user) {
        // التحقق من صلاحية الأدمن
        try {
          const adminRes = await fetch('/api/admin-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: user.id })
          });
          const adminResult = await adminRes.json();
          if (adminResult.isAdmin) {
            adminCard.classList.remove('hidden');
            // تأثير ظهور سلس
            adminCard.style.opacity = '0';
            adminCard.style.transition = 'opacity 0.5s ease';
            setTimeout(() => { adminCard.style.opacity = '1'; }, 10);
          }
        } catch (e) {
          console.error('Admin check failed:', e);
        }
      }
    } catch (e) {
      console.error('Auth failed:', e);
    }

    // ربط الأزرار
    const selectRole = (role) => {
      localStorage.setItem('wasalni_role', role);
      switch (role) {
        case 'customer': window.location.href = 'customer.html'; break;
        case 'driver': window.location.href = 'driver.html'; break;
        case 'admin': window.location.href = 'admin.html'; break;
      }
    };

    document.getElementById('roleCustomer').addEventListener('click', () => selectRole('customer'));
    document.getElementById('roleDriver').addEventListener('click', () => selectRole('driver'));
    document.getElementById('roleAdmin').addEventListener('click', () => selectRole('admin'));
  });
})();
