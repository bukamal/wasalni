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

  const { user_id, car_model, car_plate, license_photo, car_photo } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    const updateData = { user_id };
    if (car_model) updateData.car_model = car_model;
    if (car_plate) updateData.car_plate = car_plate;
    if (license_photo) updateData.license_photo = license_photo;
    if (car_photo) updateData.car_photo = car_photo;

    const { data, error } = await supabase
      .from('drivers')
      .upsert(updateData, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
