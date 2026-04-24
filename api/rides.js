import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.query;

  try {
    if (action === 'create') {
      const { data, error } = await supabase.from('rides').insert(req.body).select().single();
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
      const { id, status, driver_id } = req.body;
      const update = { status, updated_at: new Date().toISOString() };
      if (driver_id) update.driver_id = driver_id;
      const { data, error } = await supabase.from('rides').update(update).eq('id', id).select().single();
      return res.status(error ? 400 : 200).json({ data, error: error?.message });
    }
    if (action === 'myrides') {
      const { user_id } = req.body;
      const { data, error } = await supabase.from('rides')
        .select('*')
        .or(`customer_id.eq.${user_id},driver_id.eq.${user_id}`)
        .order('created_at', { ascending: false });
      return res.status(error ? 400 : 200).json({ data, error: error?.message });
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
