import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// إعداد رؤوس CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export default async function handler(req, res) {
  // التعامل مع طلب OPTIONS المسبق
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    return res.end();
  }

  if (req.method !== 'POST') {
    res.writeHead(405, corsHeaders);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  const { telegram_id, chat_id, full_name, phone, role } = req.body;

  // Check admin
  let finalRole = role || 'customer';
  if (role === 'admin') {
    const { data: isAdmin } = await supabase.rpc('is_admin', { p_chat_id: chat_id });
    if (!isAdmin) finalRole = 'customer';
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .upsert({ telegram_id, chat_id, full_name, phone, role: finalRole }, { onConflict: 'telegram_id' })
      .select()
      .single();

    if (error) {
      res.writeHead(400, corsHeaders);
      return res.end(JSON.stringify({ error: error.message }));
    }

    if (finalRole === 'driver') {
      await supabase.from('drivers').upsert({ user_id: user.id }, { onConflict: 'user_id' });
    }

    res.writeHead(200, corsHeaders);
    return res.end(JSON.stringify({ user }));
  } catch (error) {
    res.writeHead(500, corsHeaders);
    return res.end(JSON.stringify({ error: error.message }));
  }
}
