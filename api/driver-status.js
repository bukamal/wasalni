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

  const { driver_id, online } = req.body;
  if (!driver_id) {
    res.writeHead(400, corsHeaders);
    return res.end(JSON.stringify({ error: 'driver_id is required' }));
  }

  const status = online ? 'online' : 'offline';
  const { data, error } = await supabase
    .from('drivers')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', driver_id);

  if (error) {
    res.writeHead(400, corsHeaders);
    return res.end(JSON.stringify({ error: error.message }));
  }

  res.writeHead(200, corsHeaders);
  return res.end(JSON.stringify({ data }));
}
