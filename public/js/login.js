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
      }
    }

    const user = tg?.initDataUnsafe?.user;
    if (!user) {
      showStatus('⚠️ الرجاء فتح التطبيق من داخل تيليجرام', true);
      return;
    }

    let currentUserId = null;
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
      if (result.user) {
        currentUserId = result.user.id;
        try {
          const adminRes = await fetch('/api/admin-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
      } else {
        showStatus('فشل تسجيل الدخول: ' + (result.error || 'خطأ غير معروف'), true);
        return;
      }
    } catch (e) {
      showStatus('خطأ في الاتصال', true);
      return;
    }

    async function requestRole(role) {
      if (!currentUserId) return;
      try {
        const res = await fetch('/api/join-request?action=create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: currentUserId, requested_role: role })
        });
        const data = await res.json();
        if (data.request) {
          localStorage.setItem('wasalni_role', role);
          window.location.href = 'pending.html';
        } else {
          showStatus('حدث خطأ في إرسال الطلب', true);
        }
      } catch (e) {
        showStatus('خطأ في الاتصال', true);
      }
    }

    document.getElementById('roleCustomer').addEventListener('click', () => requestRole('customer'));
    document.getElementById('roleDriver').addEventListener('click', () => requestRole('driver'));
    document.getElementById('roleAdmin').addEventListener('click', () => {
      localStorage.setItem('wasalni_role', 'admin');
      window.location.href = 'admin.html';
    });
  });
})();
