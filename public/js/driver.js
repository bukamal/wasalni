(function() {
  const tg = window.Telegram.WebApp;
  if (tg) { tg.expand(); tg.ready(); }

  async function ensureApproved(requiredRole) {
    const user = tg?.initDataUnsafe?.user;
    if (!user) { window.location.href = 'login.html'; return false; }

    let userId = localStorage.getItem('wasalni_user_id');
    if (!userId) {
      try {
        const authRes = await fetch('/api/auth', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telegram_id: user.id, chat_id: user.id, full_name: 'check' })
        });
        const authData = await authRes.json();
        if (authData.user) {
          userId = authData.user.id;
          localStorage.setItem('wasalni_user_id', userId);
        }
      } catch(e) {}
    }

    if (!userId) { window.location.href = 'login.html'; return false; }

    try {
      const res = await fetch('/api/join-request?action=status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });
      const result = await res.json();
      const req = result.request;
      if (req && req.status === 'approved' && req.requested_role === requiredRole) {
        return userId;
      }
      window.location.href = 'pending.html';
      return false;
    } catch(e) { window.location.href = 'pending.html'; return false; }
  }

  // باقي كود السائق دون تغيير (loadRequests, acceptRide, updateRide, إلخ)
  // ... (مطابق للسابق)
})();
