import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { telegram_id, chat_id, full_name, phone, role, gender, photo } = req.body;

  let finalRole = role || 'customer';
  if (role === 'admin') {
    const { data: isAdmin } = await supabase.rpc('is_admin', { p_chat_id: chat_id });
    if (!isAdmin) finalRole = 'customer';
  }

  try {
    const updateData = { telegram_id, chat_id, full_name, phone, role: finalRole };
    if (gender) updateData.gender = gender;
    if (photo) updateData.photo = photo;

    const { data: user, error } = await supabase
      .from('users')
      .upsert(updateData, { onConflict: 'telegram_id' })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    if (finalRole === 'driver') {
      await supabase.from('drivers').upsert({ user_id: user.id }, { onConflict: 'user_id' });
    }

    return res.status(200).json({ user });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
