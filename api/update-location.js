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

  const { driver_id, lat, lng } = req.body;
  if (!driver_id || lat == null || lng == null) {
    return res.status(400).json({ error: 'driver_id, lat, lng required' });
  }

  try {
    const { error } = await supabase
      .from('drivers')
      .update({
        current_lat: lat,
        current_lng: lng,
        updated_at: new Date().toISOString()
      })
      .eq('id', driver_id);

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
