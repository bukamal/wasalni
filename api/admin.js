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
  const { action } = req.query;

  try {
    // الإجراء الجديد: التحقق من الأدمن بدون صلاحيات
    if (action === 'check_admin') {
      if (!chat_id) return res.status(400).json({ error: 'chat_id required' });
      const { data, error } = await supabase.rpc('is_admin', { p_chat_id: chat_id });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ isAdmin: !!data });
    }

    // باقي الإجراءات تتطلب صلاحية أدمن
    const { data: isAdmin } = await supabase.rpc('is_admin', { p_chat_id: chat_id });
    if (!isAdmin) return res.status(403).json({ error: 'Unauthorized' });

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

    if (action === 'list_join_requests') {
      const { data: requests, error: reqError } = await supabase
        .from('join_requests')
        .select('*, users!join_requests_user_id_fkey(*)')
        .order('created_at', { ascending: false });

      if (reqError) return res.status(400).json({ error: reqError.message });

      const driverUserIds = requests.filter(r => r.requested_role === 'driver').map(r => r.user_id);
      let driversData = [];
      if (driverUserIds.length > 0) {
        const { data: drivers } = await supabase
          .from('drivers')
          .select('*')
          .in('user_id', driverUserIds);
        driversData = drivers || [];
      }

      const enriched = requests.map(req => ({
        ...req,
        driver_details: driversData.find(d => d.user_id === req.user_id) || null
      }));

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

      const { data: adminUser, error: adminError } = await supabase
        .from('users')
        .select('id')
        .eq('chat_id', chat_id)
        .single();
      if (adminError || !adminUser) return res.status(400).json({ error: 'Admin user not found' });
      const adminUuid = adminUser.id;

      if (status === 'approved') {
        const { error: updateUserError } = await supabase
          .from('users')
          .update({ role: joinReq.requested_role })
          .eq('id', joinReq.user_id);
        if (updateUserError) return res.status(400).json({ error: updateUserError.message });

        if (joinReq.requested_role === 'driver') {
          const { data: existingDriver } = await supabase
            .from('drivers')
            .select('id')
            .eq('user_id', joinReq.user_id)
            .maybeSingle();
          if (!existingDriver) {
            await supabase.from('drivers').insert({ user_id: joinReq.user_id });
          }
        }
      }

      const { data, error } = await supabase
        .from('join_requests')
        .update({ status, updated_at: new Date().toISOString(), admin_id: adminUuid })
        .eq('id', request_id)
        .select()
        .single();

      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ data });
    }

    if (action === 'delete_user') {
      const { user_id } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id required' });

      const { data: userToDelete } = await supabase.from('users').select('role').eq('id', user_id).single();
      if (!userToDelete) return res.status(404).json({ error: 'User not found' });
      if (userToDelete.role === 'admin') return res.status(403).json({ error: 'Cannot delete admin' });

      await supabase.from('rides').delete().eq('customer_id', user_id);
      const { data: driverData } = await supabase.from('drivers').select('id').eq('user_id', user_id).maybeSingle();
      if (driverData) {
        await supabase.from('rides').delete().eq('driver_id', driverData.id);
      }
      await supabase.from('drivers').delete().eq('user_id', user_id);
      await supabase.from('join_requests').delete().eq('user_id', user_id);
      const { error: deleteError } = await supabase.from('users').delete().eq('id', user_id);
      if (deleteError) return res.status(400).json({ error: deleteError.message });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
