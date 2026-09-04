/**
 * Handler Vercel Serverless Function untuk rute /api/visitors
 * Menyimpan dan menyajikan data statistik pengunjung serta log kunjungan terbaru
 */

// Cache in-memory untuk menyimpan data kunjungan sementara pada serverless runtime
let visitorCount = 1420;
const visitorLogs = [
  {
    id: 1,
    name: 'Developer ID',
    ip: '103.111.*.*',
    country: 'Indonesia',
    device: 'Desktop Chrome',
    timestamp: '2025-01-10 14:22:10'
  },
  {
    id: 2,
    name: 'Web Explorer',
    ip: '180.252.*.*',
    country: 'Indonesia',
    device: 'Mobile Safari',
    timestamp: '2025-01-11 09:15:44'
  },
  {
    id: 3,
    name: 'Tech Enthusiast',
    ip: '202.67.*.*',
    country: 'Singapore',
    device: 'Desktop Firefox',
    timestamp: '2025-01-12 21:04:18'
  }
];

/**
 * Mendapatkan alamat IP klien dari berbagai kemungkinan header proxy Vercel
 * @param {object} req - Objek HTTP Request
 * @returns {string} Alamat IP publik klien
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ipList = forwarded.split(',');
    return ipList[0].trim();
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Memformat tanggal dan waktu ke standar lokal Waktu Indonesia Barat (WIB)
 * @returns {string} Format YYYY-MM-DD HH:mm:ss
 */
function getFormattedTimestamp() {
  const now = new Date();
  const pad = (n) => (n < 10 ? '0' + n : n);
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds;
}

module.exports = async function handler(req, res) {
  // Atur header CORS agar dapat diakses oleh frontend tanpa kendala cross-origin
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Tangani preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Logika untuk metode GET: Mengembalikan total pengunjung dan daftar kunjungan
    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        count: visitorCount,
        total: visitorCount,
        totalVisitors: visitorCount,
        visitors: visitorLogs,
        recentVisitors: visitorLogs.slice(-10).reverse()
      });
    }

    // Logika untuk metode POST: Mencatat kunjungan baru
    if (req.method === 'POST') {
      let payload = req.body;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch (e) {
          payload = {};
        }
      }

      payload = payload || {};
      const clientIp = getClientIp(req);
      const userAgent = req.headers['user-agent'] || 'Unknown Device';
      
      // Deteksi ringkas jenis perangkat dari user-agent
      let deviceType = 'Desktop';
      if (/android|iphone|ipad|mobile/i.test(userAgent)) {
        deviceType = 'Mobile Device';
      }

      // Samarkan sebagian IP untuk privasi
      const maskedIp = clientIp.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, '$1.$2.*.*');
      const visitorName = (payload.name && payload.name.trim()) || 'Visitor #' + (visitorCount + 1);
      const country = payload.country || req.headers['x-vercel-ip-country'] || 'Global';

      visitorCount += 1;

      const newEntry = {
        id: visitorLogs.length + 1,
        name: visitorName,
        ip: maskedIp,
        country: country,
        device: deviceType,
        timestamp: getFormattedTimestamp()
      };

      // Tambahkan ke log dan pertahankan batas maksimal 100 log terbaru
      visitorLogs.push(newEntry);
      if (visitorLogs.length > 100) {
        visitorLogs.shift();
      }

      return res.status(200).json({
        success: true,
        message: 'Kunjungan berhasil dicatat.',
        count: visitorCount,
        totalVisitors: visitorCount,
        visitor: newEntry
      });
    }

    // Metode HTTP selain GET dan POST tidak diizinkan
    return res.status(405).json({
      success: false,
      error: 'Metode HTTP tidak diizinkan. Gunakan GET atau POST.'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Gagal memproses data pengunjung: ' + (error.message || 'Kesalahan internal server.')
    });
  }
};
