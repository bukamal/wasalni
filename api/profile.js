import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BOT_TOKEN = process.env.BOT_TOKEN;

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, PUT, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    if (req.method === 'POST') {
      const { data: user, error: userErr } = await supabase
        .from('users')
        .select('*')
        .eq('id', user_id)
        .single();
      if (userErr) return res.status(404).json({ error: userErr.message });

      const { data: driver } = await supabase
        .from('drivers')
        .select('car_model, car_plate, vehicle_type')
        .eq('user_id', user_id)
        .maybeSingle();

      return res.status(200).json({ user, driver });
    }

    if (req.method === 'PUT') {
      const { full_name, phone, gender, driver } = req.body;

      const { data: user, error: userErr } = await supabase
        .from('users')
        .update({ full_name, phone, gender })
        .eq('id', user_id)
        .select('*')
        .single();
      if (userErr) return res.status(400).json({ error: userErr.message });

      if (driver) {
        const { error: driverErr } = await supabase
          .from('drivers')
          .upsert({
            user_id,
            car_model: driver.car_model,
            car_plate: driver.car_plate,
            vehicle_type: driver.vehicle_type
          }, { onConflict: 'user_id' });
        if (driverErr) return res.status(400).json({ error: driverErr.message });
      }

      // إشعار التأكيد
      if (user.chat_id) {
        await sendTelegram(user.chat_id, `✅ تم تحديث بيانات ملفك الشخصي بنجاح.`);
      }

      return res.status(200).json({ user });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
