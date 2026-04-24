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

  const { chat_id } = req.body;

  try {
    const { data: isAdmin } = await supabase.rpc('is_admin', { p_chat_id: chat_id });
    if (!isAdmin) return res.status(403).json({ error: 'Unauthorized' });

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
      return res.status(error ? 400 : 200).json({ data, error: error?.message });
    }

    // ---- طلبات الانضمام (محسّن) ----
    if (action === 'list_join_requests') {
      // 1. جلب طلبات الانضمام مع بيانات المستخدم
      const { data: requests, error: reqError } = await supabase
        .from('join_requests')
        .select('*, users!join_requests_user_id_fkey(*)')
        .order('created_at', { ascending: false });

      if (reqError) return res.status(400).json({ error: reqError.message });

      // 2. جلب بيانات السائقين للمستخدمين الذين يطلبون دور سائق
      const driverUserIds = requests
        .filter(r => r.requested_role === 'driver')
        .map(r => r.user_id);

      let driversData = [];
      if (driverUserIds.length > 0) {
        const { data: drivers } = await supabase
          .from('drivers')
          .select('*')
          .in('user_id', driverUserIds);
        driversData = drivers || [];
      }

      // 3. دمج بيانات السائق لكل طلب
      const enriched = requests.map(req => {
        const driver = driversData.find(d => d.user_id === req.user_id) || null;
        return {
          ...req,
          driver_details: driver
        };
      });

      return res.status(200).json({ data: enriched });
    }

    if (action === 'handle_join_request') {
      const { request_id, status } = req.body;
      if (!request_id || !status) return res.status(400).json({ error: 'request_id and status required' });
      if (status !== 'approved' && status !== 'rejected') return res.status(400).json({ error: 'Invalid status' });

      const { data: joinReq, error: fetchError } = await supabase
        .from('join_requests')
        .select('*, users!join_requests_user_id_fkey(telegram_id, chat_id)')
        .eq('id', request_id)
        .single();
      if (fetchError || !joinReq) return res.status(404).json({ error: 'Request not found' });

      if (status === 'approved') {
        const { error: updateUserError } = await supabase
          .from('users')
          .update({ role: joinReq.requested_role })
          .eq('id', joinReq.user_id);
        if (updateUserError) return res.status(400).json({ error: updateUserError.message });

        if (joinReq.requested_role === 'driver') {
          await supabase.from('drivers').upsert({ user_id: joinReq.user_id }, { onConflict: 'user_id' });
        }
      }

      const { data, error } = await supabase
        .from('join_requests')
        .update({ status, updated_at: new Date().toISOString(), admin_id: chat_id })
        .eq('id', request_id)
        .select()
        .single();

      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ data });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
