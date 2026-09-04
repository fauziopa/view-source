const archiver = require('archiver');

/**
 * Handler Vercel Serverless Function untuk rute /api/download-zip
 * Menerima daftar berkas yang diinspeksi dan mengalirkannya sebagai file ZIP biner
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Tangani preflight OPTIONS request dari browser
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Metode HTTP tidak diizinkan. Gunakan metode POST.'
    });
  }

  try {
    let payload = req.body;

    // Parsing payload jika dikirim dalam bentuk string
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (errParse) {
        return res.status(400).json({
          success: false,
          error: 'Format JSON body tidak valid.'
        });
      }
    }

    const files = payload && Array.isArray(payload.files) ? payload.files : [];
    const rawFilename = (payload && payload.filename) || 'source-code.zip';
    const safeFilename = rawFilename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Daftar berkas kosong. Tidak ada file yang dapat dikompresi.'
      });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="' + safeFilename + '"');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    const archive = archiver('zip', {
      zlib: { level: 9 } // Level kompresi maksimum
    });

    // Menangani error selama proses pengarsipan
    archive.on('error', function (err) {
      throw err;
    });

    // Sambungkan stream arsip langsung ke respon HTTP klien
    archive.pipe(res);

    files.forEach(function (fileItem) {
      if (!fileItem) return;

      const rawPath = fileItem.path || fileItem.name || 'unnamed_file.txt';
      // Bersihkan path agar tidak memicu traversal direktori berbahaya
      const cleanPath = rawPath.replace(/^(\.\.(\/|\\|$))+/, '');
      const content =
        typeof fileItem.content === 'string'
          ? fileItem.content
          : fileItem.content !== undefined
          ? JSON.stringify(fileItem.content, null, 2)
          : '';

      archive.append(content, { name: cleanPath });
    });

    await archive.finalize();
  } catch (error) {
    // Jika header belum terkirim ke klien, berikan respon JSON error
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: 'Gagal membuat file ZIP: ' + (error.message || 'Kesalahan internal server.')
      });
    }
    // Jika stream sudah berjalan, akhiri respon
    res.end();
  }
};
