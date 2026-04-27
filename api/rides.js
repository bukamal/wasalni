import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BOT_TOKEN = process.env.BOT_TOKEN;

async function sendTelegram(chatId, text, replyMarkup = null) {
  if (!BOT_TOKEN || !chatId) return;
  try {
    const payload = { chat_id: chatId, text, parse_mode: 'HTML' };
    if (replyMarkup) payload.reply_markup = replyMarkup;
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error('telegram send error:', e);
  }
}

function ratingKeyboard(rideId, role) {
  // role: 'customer' or 'driver'
  return {
    inline_keyboard: [[1,2,3,4,5].map(r => ({
      text: `${r}⭐`,
      callback_data: `rate_${role}_${rideId}_${r}`
    }))]
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.query;

  try {
    if (action === 'create') {
      const body = req.body;
      const { data, error } = await supabase.from('rides').insert(body).select().single();
      return res.status(error ? 400 : 200).json({ data, error: error?.message });
    }

    if (action === 'list') {
      const { data, error } = await supabase.from('rides')
        .select('*, users!rides_customer_id_fkey(full_name, phone)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      return res.status(error ? 400 : 200).json({ data, error: error?.message });
    }

    if (action === 'update') {
      const { id, status, driver_id, rating, feedback, reason } = req.body;
      const update = { status, updated_at: new Date().toISOString() };
      if (driver_id) update.driver_id = driver_id;
      if (rating) update.rating = rating;
      if (feedback) update.feedback = feedback;

      const { data: ride } = await supabase
        .from('rides')
        .select('*, customer:users!rides_customer_id_fkey(chat_id, full_name), driver:users!rides_driver_id_fkey(chat_id, full_name)')
        .eq('id', id)
        .single();

      const { data, error } = await supabase.from('rides').update(update).eq('id', id).select().single();

      if (error) return res.status(400).json({ data, error: error?.message });

      if (ride && data) {
        if (status === 'accepted' && ride.customer) {
          await sendTelegram(ride.customer.chat_id, `🚗 تم قبول مشوارك! السائق ${ride.driver?.full_name || ''} في الطريق إليك.`);
        } else if (status === 'picked_up' && ride.customer) {
          await sendTelegram(ride.customer.chat_id, `✅ السائق التقط الراكب، رحلة سعيدة!`);
        } else if (status === 'completed') {
          // إرسال أزرار تقييم للزبون
          if (ride.customer) {
            await sendTelegram(
              ride.customer.chat_id,
              `🏁 وصلت إلى وجهتك! كيف تقيم رحلتك؟`,
              ratingKeyboard(id, 'customer')
            );
          }
          // إرسال أزرار تقييم للسائق
          if (ride.driver) {
            await sendTelegram(
              ride.driver.chat_id,
              `🏁 تمت الرحلة. كيف تقيم الزبون؟`,
              ratingKeyboard(id, 'driver')
            );
          }
        } else if (status === 'cancelled') {
          const cancelMsg = reason ? ` بسبب: ${reason}` : '';
          if (ride.customer) await sendTelegram(ride.customer.chat_id, `❌ تم إلغاء المشوار${cancelMsg}.`);
          if (ride.driver) await sendTelegram(ride.driver.chat_id, `❌ تم إلغاء المشوار${cancelMsg}.`);
        }
      }

      return res.status(200).json({ data });
    }

    if (action === 'myrides') {
      const { user_id } = req.body;
      const { data, error } = await supabase.from('rides')
        .select('*')
        .or(`customer_id.eq.${user_id},driver_id.eq.${user_id}`)
        .order('created_at', { ascending: false });
      return res.status(error ? 400 : 200).json({ data, error: error?.message });
    }

    if (action === 'track') {
      const { ride_id } = req.body;
      if (!ride_id) return res.status(400).json({ error: 'ride_id required' });

      const { data: ride, error: rideError } = await supabase
        .from('rides')
        .select('id, status, drivers!rides_driver_id_fkey(current_lat, current_lng, user_id, car_model, car_plate, users!drivers_user_id_fkey(full_name, phone, gender))')
        .eq('id', ride_id)
        .single();

      if (rideError) return res.status(400).json({ error: rideError.message });
      if (!ride) return res.status(404).json({ error: 'Ride not found' });

      return res.status(200).json({ data: ride });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
