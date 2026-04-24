export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json({ 
    status: 'API is running',
    path: req.url,
    method: req.method,
    timestamp: Date.now()
  });
}
