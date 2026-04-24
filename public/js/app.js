(function() {
  var debugEl = document.getElementById('debug');
  function logDebug(msg) {
    if (debugEl) {
      debugEl.style.display = 'block';
      debugEl.textContent += msg + '\n';
    }
    console.log('[وصلني] ' + msg);
  }

  // التحقق من بيئة Telegram
  var tg = null;
  try {
    if (window.Telegram && window.Telegram.WebApp) {
      tg = window.Telegram.WebApp;
      tg.expand();
      tg.ready();
      logDebug('Telegram WebApp جاهز');
    } else {
      logDebug('تحذير: خارج تيليجرام، بعض الميزات قد لا تعمل');
    }
  } catch(e) {
    logDebug('خطأ Telegram WebApp: ' + e.message);
  }

  document.addEventListener('DOMContentLoaded', function() {
    logDebug('DOM جاهز، جاري التوجيه...');
    
    // إمكانية إعادة تعيين التوجيه عبر ?reset في الرابط للاختبار
    var urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('reset') === 'true') {
      localStorage.removeItem('wasalni_onboarding');
      logDebug('تمت إعادة تعيين حالة onboarding');
    }

    var done = localStorage.getItem('wasalni_onboarding');
    logDebug('onboarding done = ' + (done === 'done' ? 'نعم' : 'لا'));
    
    var delay = done ? 1500 : 2000;
    var target = done ? 'login.html' : 'onboarding.html';
    
    logDebug('سيتم الانتقال إلى ' + target + ' بعد ' + delay + 'ms');
    
    setTimeout(function() {
      logDebug('جاري الانتقال الآن...');
      window.location.href = target;
    }, delay);
  });
})();
