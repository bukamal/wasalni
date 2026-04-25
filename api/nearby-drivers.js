import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function deg2rad(deg) { return deg * (Math.PI/180); }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { lat, lng, gender } = req.body;
  if (!lat || !lng) return res.status(400).json({ error: 'lat/lng required' });

  try {
    // جلب السائقين النشطين (online) والمتاحين (ليسوا busy)
    let query = supabase
      .from('drivers')
      .select('*, users!inner(full_name, phone, gender)')
      .eq('status', 'online');

    if (gender && gender !== 'any') {
      query = query.eq('users.gender', gender);
    }

    const { data: drivers, error } = await query;

    if (error) return res.status(400).json({ error: error.message });

    // حساب المسافة والترتيب
    const enriched = (drivers || []).map(driver => {
      const distance = driver.current_lat && driver.current_lng
        ? calculateDistance(lat, lng, driver.current_lat, driver.current_lng)
        : 9999;
      return {
        id: driver.id,
        user_id: driver.user_id,
        full_name: driver.users?.full_name || 'سائق',
        phone: driver.users?.phone,
        gender: driver.users?.gender,
        car_model: driver.car_model,
        car_plate: driver.car_plate,
        lat: driver.current_lat,
        lng: driver.current_lng,
        distance: Math.round(distance * 10) / 10,
        status: driver.status
      };
    }).sort((a, b) => a.distance - b.distance);

    return res.status(200).json({ data: enriched });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
