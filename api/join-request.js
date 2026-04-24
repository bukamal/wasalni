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

  const { action } = req.query;

  try {
    if (action === 'create') {
      const { user_id, requested_role } = req.body;
      if (!user_id || !requested_role) return res.status(400).json({ error: 'user_id and requested_role required' });

      const { data: existing } = await supabase
        .from('join_requests')
        .select('id, status')
        .eq('user_id', user_id)
        .eq('requested_role', requested_role)
        .maybeSingle();

      if (existing) {
        return res.status(200).json({ request: existing });
      }

      const { data, error } = await supabase
        .from('join_requests')
        .insert({ user_id, requested_role, status: 'pending' })
        .select()
        .single();

      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ request: data });
    }

    if (action === 'status') {
      const { user_id } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });

      const { data } = await supabase
        .from('join_requests')
        .select('id, requested_role, status')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return res.status(200).json({ request: data });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
