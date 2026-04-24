export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { message, callback_query } = req.body;
  
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

  if (callback_query) {
    return res.status(200).json({
      method: 'answerCallbackQuery',
      callback_query_id: callback_query.id,
      text: 'جاري الفتح...'
    });
  }

  return res.status(200).json({ ok: true });
}
