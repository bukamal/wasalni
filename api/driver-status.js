import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { driver_id, online } = req.body;
  if (!driver_id) return res.status(400).json({ error: 'driver_id is required' });
  
  const status = online ? 'online' : 'offline';
  const { data, error } = await supabase
    .from('drivers')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', driver_id);
  
  if (error) return res.status(400).json({ error: error.message });
  return res.status(200).json({ data });
}
