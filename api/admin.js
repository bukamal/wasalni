import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    return res.end();
  }

  if (req.method !== 'POST') {
    res.writeHead(405, corsHeaders);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  const { chat_id } = req.body;

  // Verify admin
  const { data: isAdmin } = await supabase.rpc('is_admin', { p_chat_id: chat_id });
  if (!isAdmin) {
    res.writeHead(403, corsHeaders);
    return res.end(JSON.stringify({ error: 'Unauthorized' }));
  }

  const { action } = req.query;

  if (action === 'stats') {
    const { data: rides } = await supabase.from('rides').select('status');
    const { data: users } = await supabase.from('users').select('role');
    res.writeHead(200, corsHeaders);
    return res.end(JSON.stringify({ rides, users }));
  }

  if (action === 'all_rides') {
    const { data } = await supabase.from('rides')
      .select('*, users!rides_customer_id_fkey(full_name, phone), drivers!rides_driver_id_fkey(user_id, car_plate)')
      .order('created_at', { ascending: false });
    res.writeHead(200, corsHeaders);
    return res.end(JSON.stringify({ data }));
  }

  if (action === 'manage_ride') {
    const { id, status } = req.body;
    const { data, error } = await supabase.from('rides')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    res.writeHead(error ? 400 : 200, corsHeaders);
    return res.end(JSON.stringify({ data, error }));
  }

  res.writeHead(400, corsHeaders);
  return res.end(JSON.stringify({ error: 'Unknown action' }));
}
