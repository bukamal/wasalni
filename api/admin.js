import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { chat_id } = req.body;
  
  // Verify admin
  const { data: isAdmin } = await supabase.rpc('is_admin', { p_chat_id: chat_id });
  if (!isAdmin) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { action } = req.query;

  if (action === 'stats') {
    const { data: rides } = await supabase.from('rides').select('status');
    const { data: users } = await supabase.from('users').select('role');
    return res.status(200).json({ rides, users });
  }

  if (action === 'all_rides') {
    const { data } = await supabase.from('rides')
      .select('*, users!rides_customer_id_fkey(full_name, phone), drivers!rides_driver_id_fkey(user_id, car_plate)')
      .order('created_at', { ascending: false });
    return res.status(200).json({ data });
  }

  if (action === 'manage_ride') {
    const { id, status } = req.body;
    const { data, error } = await supabase.from('rides')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return res.status(200).json({ data, error });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
