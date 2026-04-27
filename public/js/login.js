(function() {
  const tg = window.Telegram.WebApp;
  if (tg) { tg.expand(); tg.ready(); }

  document.addEventListener('DOMContentLoaded', async () => {
    const statusEl = document.getElementById('loginStatus');
    const adminCard = document.getElementById('roleAdmin');

    function showStatus(msg, isError) {
      if (statusEl) {
        statusEl.textContent = msg;
        statusEl.className = 'login-status' + (isError ? ' error' : '');
      }
    }

    const user = tg?.initDataUnsafe?.user;
    if (!user) {
      showStatus('⚠️ الرجاء فتح التطبيق من داخل تيليجرام', true);
      return;
    }

    // 1. جلب أو إنشاء المستخدم الحقيقي
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
        // تخزين دائم
        localStorage.setItem('wasalni_user_id', currentUserId);
        localStorage.setItem('wasalni_telegram_id', user.id);
      } else {
        showStatus('فشل إنشاء الحساب', true);
        return;
      }
    } catch (e) {
      showStatus('خطأ في الاتصال', true);
      return;
    }

    // 2. صلاحية الأدمن
    try {
      const adminRes = await fetch('/api/admin?action=check_admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: user.id })
      });
      const adminResult = await adminRes.json();
      if (adminResult.isAdmin) {
        adminCard.classList.remove('hidden');
        adminCard.style.opacity = '0';
        adminCard.style.transition = 'opacity 0.5s ease';
        setTimeout(() => { adminCard.style.opacity = '1'; }, 10);
      }
    } catch(e) {}

    // 3. عند اختيار دور
    async function checkAndNavigate(role) {
      if (!currentUserId) return;
      try {
        const res = await fetch('/api/join-request?action=status', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: currentUserId })
        });
        const data = await res.json();
        const req = data.request;
        if (req) {
          if (req.status === 'approved') {
            localStorage.setItem('wasalni_role', req.requested_role);
            window.location.href = req.requested_role === 'driver' ? 'driver.html' : 'customer.html';
          } else if (req.status === 'pending') {
            localStorage.setItem('wasalni_role', role);
            window.location.href = 'pending.html';
          } else if (req.status === 'rejected') {
            showStatus('❌ تم رفض طلبك السابق. يمكنك تقديم طلب جديد.', true);
            window.location.href = 'register.html?role=' + role;
          }
        } else {
          window.location.href = 'register.html?role=' + role;
        }
      } catch(e) {
        showStatus('خطأ في التحقق من الحالة', true);
      }
    }

    document.getElementById('roleCustomer').addEventListener('click', () => checkAndNavigate('customer'));
    document.getElementById('roleDriver').addEventListener('click', () => checkAndNavigate('driver'));
    document.getElementById('roleAdmin').addEventListener('click', () => {
      localStorage.setItem('wasalni_role', 'admin');
      window.location.href = 'admin.html';
    });
  });
})();
