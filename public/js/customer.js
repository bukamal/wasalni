(function() {
  const tg = window.Telegram.WebApp;
  if (tg) {
    tg.expand();
    tg.ready();
  }

  let currentUser = null;

  // زر الرجوع
  document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = 'login.html';
  });

  // زر تسجيل الخروج
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'login.html';
  });

  document.addEventListener('DOMContentLoaded', async () => {
    const user = tg?.initDataUnsafe?.user;
    if (!user) {
      document.body.innerHTML = '<div class="container" style="text-align:center;padding-top:40vh"><h2>⚠️ افتح من تليجرام</h2></div>';
      return;
    }

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_id: user.id,
          chat_id: user.id,
          full_name: user.first_name + ' ' + (user.last_name || '')
        })
      });
      const result = await res.json();
      currentUser = result.user;
      document.getElementById('userName').textContent = currentUser?.full_name || 'زبون';
    } catch (e) {
      console.error(e);
    }

    document.getElementById('requestRideBtn').addEventListener('click', requestRide);
    loadMyRides();
  });

  async function requestRide() {
    const pickup = document.getElementById('pickup').value.trim();
    const dropoff = document.getElementById('dropoff').value.trim();
    const price = parseFloat(document.getElementById('price').value) || 0;
    
    if (!pickup || !dropoff) {
      tg?.showAlert('❌ أدخل موقع الالتقاط والوجهة');
      return;
    }

    try {
      const res = await fetch('/api/rides?action=create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: currentUser.id,
          pickup_address: pickup,
          dropoff_address: dropoff,
          price: price,
          pickup_lat: 24.7136,
          pickup_lng: 46.6753,
          dropoff_lat: 24.7743,
          dropoff_lng: 46.7386,
          status: 'pending'
        })
      });
      const result = await res.json();
      
      if (result.error) {
        tg?.showAlert('❌ خطأ: ' + result.error);
        return;
      }

      document.getElementById('requestForm').classList.add('hidden');
      document.getElementById('rideStatus').classList.remove('hidden');
      tg?.showAlert('✅ تم إرسال الطلب بنجاح');
      loadMyRides();
    } catch (e) {
      tg?.showAlert('❌ حدث خطأ في الاتصال');
    }
  }

  async function loadMyRides() {
    if (!currentUser) return;
    
    try {
      const res = await fetch('/api/rides?action=myrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id })
      });
      const result = await res.json();
      
      const list = document.getElementById('ridesList');
      list.innerHTML = '';
      document.getElementById('ridesCount').textContent = result.data?.length || 0;
      
      if (!result.data || result.data.length === 0) {
        list.innerHTML = '<div class="list-item" style="justify-content:center;color:var(--text-light)">لا توجد مشاوير سابقة</div>';
        return;
      }

      result.data.forEach(ride => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
          <div class="info">
            <strong>${ride.pickup_address} → ${ride.dropoff_address}</strong>
            <small>${new Date(ride.created_at).toLocaleString('ar-SA')} · ${ride.price} ر.س</small>
          </div>
          <span class="badge badge-${ride.status}">${getStatusText(ride.status)}</span>
        `;
        list.appendChild(div);
      });
    } catch (e) {
      console.error(e);
    }
  }

  function getStatusText(status) {
    const map = {
      'pending': 'معلق',
      'accepted': 'مقبول',
      'picked_up': 'التقط الراكب',
      'completed': 'مكتمل',
      'cancelled': 'ملغي'
    };
    return map[status] || status;
  }
})();
