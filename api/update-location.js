import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BOT_TOKEN = process.env.BOT_TOKEN;

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function sendTelegram(chatId, text) {
  if (!BOT_TOKEN || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
  } catch (e) {
    console.error('telegram send error:', e);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { driver_id, lat, lng } = req.body;
  if (!driver_id || lat == null || lng == null) {
    return res.status(400).json({ error: 'driver_id, lat, lng required' });
  }

  try {
    const { error } = await supabase
      .from('drivers')
      .update({ current_lat: lat, current_lng: lng, updated_at: new Date().toISOString() })
      .eq('id', driver_id);

    if (error) return res.status(400).json({ error: error.message });

    // البحث عن رحلة نشطة (accepted أو picked_up) لهذا السائق
    const { data: activeRide } = await supabase
      .from('rides')
      .select('id, status, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, customer:users!rides_customer_id_fkey(chat_id)')
      .eq('driver_id', driver_id)
      .in('status', ['accepted', 'picked_up'])
      .maybeSingle();

    if (activeRide && activeRide.customer?.chat_id) {
      const targetLat = activeRide.status === 'accepted' ? activeRide.pickup_lat : activeRide.dropoff_lat;
      const targetLng = activeRide.status === 'accepted' ? activeRide.pickup_lng : activeRide.dropoff_lng;

      const distance = calculateDistance(lat, lng, targetLat, targetLng);
      if (distance <= 0.5) { // أقل من 500 متر
        await sendTelegram(
          activeRide.customer.chat_id,
          `📢 السائق على بُعد دقيقتين (أقل من 500 متر)! استعد.`
        );
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
