// File: api/visitors.js
// Endpoint Serverless Vercel untuk pencatat dan pembaca data pengunjung

// Penyimpanan in-memory sementara untuk instance serverless
let visitorStorage = {
  count: 148,
  visitors: [
    { id: 1, name: 'Armansyah', country: 'ID', date: 'Baru saja', timestamp: '2026-09-04T10:00:00Z' },
    { id: 2, name: 'Fauzi Opa', country: 'ID', date: '2 menit lalu', timestamp: '2026-09-04T10:15:00Z' },
    { id: 3, name: 'Guest Developer', country: 'ID', date: '5 menit lalu', timestamp: '2026-09-04T10:30:00Z' }
  ]
};

module.exports = async function handler(req, res) {
  // Pengaturan CORS menyeluruh
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Penanganan preflight request OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handler GET: Mengambil daftar dan statistik pengunjung
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'success',
      statusCode: 200,
      success: true,
      ok: true,
      message: 'Data pengunjung berhasil dimuat.',
      total: visitorStorage.visitors.length,
      count: visitorStorage.visitors.length,
      totalVisitors: visitorStorage.visitors.length,
      data: visitorStorage.visitors,
      visitors: visitorStorage.visitors,
      recentVisitors: visitorStorage.visitors.slice(-10).reverse()
    });
  }

  // Handler POST: Menambahkan pengunjung baru
  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (e) {
          body = {};
        }
      }
      body = body || {};

      // Ekstraksi nama pengunjung dari berbagai kemungkinan key payload
      const rawName = body.name || body.nama || body.username || body.visitorName || body.visitor || 'Pengunjung Baru';
      const visitorName = String(rawName).trim();
      const country = req.headers['x-vercel-ip-country'] || 'ID';

      const newEntry = {
        id: Date.now(),
        name: visitorName,
        country: country,
        date: 'Baru saja',
        timestamp: new Date().toISOString()
      };

      // Tambahkan ke penyimpanan
      visitorStorage.visitors.unshift(newEntry);
      visitorStorage.count += 1;

      // Kembalikan format respon lengkap agar lolos validasi logika frontend
      return res.status(200).json({
        status: 'success',
        statusCode: 200,
        success: true,
        ok: true,
        message: 'Kunjungan berhasil dicatat.',
        name: visitorName,
        visitor: visitorName,
        data: newEntry,
        visitors: visitorStorage.visitors,
        total: visitorStorage.count,
        count: visitorStorage.count,
        totalVisitors: visitorStorage.count
      });
    } catch (err) {
      return res.status(500).json({
        status: 'error',
        statusCode: 500,
        success: false,
        ok: false,
        message: 'Gagal memproses data pengunjung: ' + err.message
      });
    }
  }

  // Fallback metode HTTP yang tidak didukung
  return res.status(405).json({
    status: 'error',
    statusCode: 405,
    message: 'Method Not Allowed'
  });
};
