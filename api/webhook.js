import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BOT_TOKEN = process.env.BOT_TOKEN;

async function sendTelegram(chatId, text) {
  if (!BOT_TOKEN || !chatId) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}

async function answerCallback(callbackId, text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackId, text, show_alert: false })
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, callback_query } = req.body;

  if (callback_query) {
    const data = callback_query.data;
    if (!data) {
      await answerCallback(callback_query.id, 'بيانات غير صالحة');
      return res.status(200).json({ ok: true });
    }

    const parts = data.split('_');
    // تنسيق data: rate_(customer|driver)_rideId_rating
    if (parts[0] === 'rate' && parts.length === 4) {
      const role = parts[1]; // 'customer' or 'driver'
      const rideId = parts[2];
      const rating = parseInt(parts[3]);

      try {
        const updateField = role === 'customer' ? { rating_from_customer: rating } : { rating_from_driver: rating };
        await supabase.from('rides').update(updateField).eq('id', rideId);

        await answerCallback(callback_query.id, `شكراً لك! تم تسجيل تقييمك (${rating} نجوم)`);
        // اختياري: إشعار الطرف الآخر
        const { data: ride } = await supabase.from('rides')
          .select('*, customer:users!rides_customer_id_fkey(chat_id), driver:users!rides_driver_id_fkey(chat_id)')
          .eq('id', rideId)
          .single();
        if (ride) {
          if (role === 'customer' && ride.driver?.chat_id) {
            await sendTelegram(ride.driver.chat_id, `⭐ قام الزبون بتقييم الرحلة بـ ${rating} نجوم.`);
          } else if (role === 'driver' && ride.customer?.chat_id) {
            await sendTelegram(ride.customer.chat_id, `⭐ قام السائق بتقييمك بـ ${rating} نجوم.`);
          }
        }
      } catch (e) {
        await answerCallback(callback_query.id, 'حدث خطأ أثناء تسجيل التقييم');
      }
    } else {
      await answerCallback(callback_query.id, 'غير معروف');
    }
    return res.status(200).json({ ok: true });
  }

  if (message?.text === '/start') {
    const chatId = message.chat.id;
    const reply = {
      method: 'sendMessage',
      chat_id: chatId,
      text: '🚖 *مرحباً بك في وصلني!*\n\nأفضل تطبيق توصيل في منطقتك. اضغط الزر أدناه لفتح التطبيق:',
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          {
            text: '🚀 فتح وصلني',
            web_app: { url: `https://${process.env.VERCEL_URL}` }
          }
        ]]
      }
    };
    return res.status(200).json(reply);
  }

  return res.status(200).json({ ok: true });
}
