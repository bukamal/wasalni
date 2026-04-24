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

  const { action } = req.query;

  try {
    if (action === 'create') {
      const body = req.body;
      const { data, error } = await supabase.from('rides').insert(body).select().single();
      res.writeHead(error ? 400 : 200, corsHeaders);
      return res.end(JSON.stringify({ data, error }));
    }
    
    if (action === 'list') {
      const { data, error } = await supabase.from('rides')
        .select('*, users!rides_customer_id_fkey(full_name, phone)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      res.writeHead(error ? 400 : 200, corsHeaders);
      return res.end(JSON.stringify({ data, error }));
    }

    if (action === 'update') {
      const { id, status, driver_id } = req.body;
      const update = { status, updated_at: new Date().toISOString() };
      if (driver_id) update.driver_id = driver_id;
      const { data, error } = await supabase.from('rides').update(update).eq('id', id).select().single();
      res.writeHead(error ? 400 : 200, corsHeaders);
      return res.end(JSON.stringify({ data, error }));
    }

    if (action === 'myrides') {
      const { user_id } = req.body;
      const { data, error } = await supabase.from('rides')
        .select('*')
        .or(`customer_id.eq.${user_id},driver_id.eq.${user_id}`)
        .order('created_at', { ascending: false });
      res.writeHead(error ? 400 : 200, corsHeaders);
      return res.end(JSON.stringify({ data, error }));
    }

    res.writeHead(400, corsHeaders);
    return res.end(JSON.stringify({ error: 'Unknown action' }));
  } catch (error) {
    res.writeHead(500, corsHeaders);
    return res.end(JSON.stringify({ error: error.message }));
  }
}
