(function() {
  // تهيئة Telegram WebApp
  try {
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.expand();
      tg.ready();
    }
  } catch(e) {
    // تجاهل الأخطاء
  }

  document.addEventListener('DOMContentLoaded', function() {
    const done = localStorage.getItem('wasalni_onboarding');
    const target = done ? 'login.html' : 'onboarding.html';
    const delay = done ? 1500 : 2000;
    
    setTimeout(() => {
      window.location.href = target;
    }, delay);
  });
})();
