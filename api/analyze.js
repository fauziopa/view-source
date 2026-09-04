// Mengimpor library parser DOM, HTTP client, dan utilitas URL
const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');
const path = require('path');

/**
 * Mengonversi ukuran bita (bytes) ke format string yang mudah dibaca (KB/MB)
 * @param {number} bytes - Ukuran dalam bita
 * @returns {string} Ukuran terformat
 */
function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Menormalkan nama berkas agar aman dari karakter path berbahaya
 * @param {string} rawUrl - URL aset mentah
 * @param {string} defaultName - Nama fallback jika gagal di-resolve
 * @returns {string} Nama file yang bersih
 */
function cleanFileName(rawUrl, defaultName) {
  try {
    const parsed = new URL(rawUrl);
    const basename = path.basename(parsed.pathname);
    if (!basename || basename.trim() === '') {
      return defaultName;
    }
    return basename.split('?')[0].split('#')[0];
  } catch (err) {
    return defaultName;
  }
}

/**
 * Menganalisis konten HTML dan header respon untuk mendeteksi teknologi web
 * @param {string} html - Markup HTML website target
 * @param {object} headers - HTTP Headers dari server target
 * @returns {Array<object>} Daftar teknologi yang terdeteksi
 */
function detectTechStack(html, headers = {}) {
  const stack = [];
  const lowerHtml = html.toLowerCase();
  const lowerHeaders = JSON.stringify(headers).toLowerCase();

  // Deteksi Next.js
  if (lowerHtml.includes('__next_data__') || lowerHtml.includes('/_next/')) {
    stack.push({ name: 'Next.js', category: 'Frontend Framework', tag: 'React / SSR' });
  }

  // Deteksi React
  if (lowerHtml.includes('react') || lowerHtml.includes('data-reactroot') || lowerHtml.includes('_react')) {
    stack.push({ name: 'React', category: 'UI Library', tag: 'JavaScript' });
  }

  // Deteksi Vue.js / Nuxt
  if (lowerHtml.includes('__nuxt__') || lowerHtml.includes('/_nuxt/')) {
    stack.push({ name: 'Nuxt.js', category: 'Frontend Framework', tag: 'Vue SSR' });
  } else if (lowerHtml.includes('vue') || lowerHtml.includes('data-v-')) {
    stack.push({ name: 'Vue.js', category: 'UI Library', tag: 'JavaScript' });
  }

  // Deteksi Tailwind CSS
  if (
    lowerHtml.includes('cdn.tailwindcss.com') ||
    lowerHtml.includes('tailwind') ||
    /class="[^"]*(flex|grid|px-|py-|bg-|text-|rounded)[^"]*"/.test(html)
  ) {
    stack.push({ name: 'Tailwind CSS', category: 'CSS Framework', tag: 'Utility-First' });
  }

  // Deteksi Bootstrap
  if (
    lowerHtml.includes('bootstrap.min.css') ||
    lowerHtml.includes('bootstrap.css') ||
    /class="[^"]*(container|row|col-|btn-|navbar)[^"]*"/.test(html)
  ) {
    stack.push({ name: 'Bootstrap', category: 'CSS Framework', tag: 'Component CSS' });
  }

  // Deteksi WordPress
  if (lowerHtml.includes('wp-content') || lowerHtml.includes('wp-includes')) {
    stack.push({ name: 'WordPress', category: 'CMS', tag: 'PHP / Content Management' });
  }

  // Deteksi jQuery
  if (lowerHtml.includes('jquery.min.js') || lowerHtml.includes('jquery-') || lowerHtml.includes('jquery/')) {
    stack.push({ name: 'jQuery', category: 'JavaScript Library', tag: 'DOM Manipulation' });
  }

  // Deteksi Icon Fonts & FontAwesome
  if (lowerHtml.includes('font-awesome') || lowerHtml.includes('fontawesome') || lowerHtml.includes('fa-')) {
    stack.push({ name: 'Font Awesome', category: 'Iconography', tag: 'Icons' });
  }

  // Deteksi Google Analytics & Google Tag Manager
  if (lowerHtml.includes('googletagmanager.com') || lowerHtml.includes('google-analytics.com') || lowerHtml.includes('gtag')) {
    stack.push({ name: 'Google Analytics', category: 'Analytics', tag: 'Tracking' });
  }

  // Deteksi Infrastruktur Server / CDN
  if (lowerHeaders.includes('cloudflare') || lowerHeaders.includes('cf-ray')) {
    stack.push({ name: 'Cloudflare', category: 'CDN & Security', tag: 'Edge Network' });
  }
  if (lowerHeaders.includes('vercel') || lowerHeaders.includes('x-vercel-id')) {
    stack.push({ name: 'Vercel', category: 'Hosting Platform', tag: 'Serverless' });
  }

  return stack;
}

/**
 * Membangun struktur pohon folder (tree) dari daftar file flat
 * @param {Array<object>} files - Daftar file
 * @returns {Array<object>} Struktur hierarki direktori
 */
function buildFileTree(files) {
  const root = [];

  files.forEach(function (file) {
    const parts = file.path.split('/').filter(Boolean);
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;

      if (isFile) {
        currentLevel.push({
          name: part,
          type: 'file',
          fileType: file.type,
          path: file.path,
          size: file.size,
          formattedSize: file.formattedSize,
          content: file.content || ''
        });
      } else {
        let existingFolder = currentLevel.find(function (item) {
          return item.type === 'directory' && item.name === part;
        });

        if (!existingFolder) {
          existingFolder = {
            name: part,
            type: 'directory',
            children: []
          };
          currentLevel.push(existingFolder);
        }
        currentLevel = existingFolder.children;
      }
    }
  });

  return root;
}

/**
 * Handler utama Vercel Serverless Function untuk rute /api/analyze
 */
module.exports = async function handler(req, res) {
  // Set CORS Headers agar aman diakses dari frontend mana pun
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let target = '';
    if (req.body && req.body.url) {
      target = req.body.url;
    } else if (req.query && req.query.url) {
      target = req.query.url;
    }

    if (!target || typeof target !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Parameter URL target tidak valid atau tidak disertakan.'
      });
    }

    target = target.trim();
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'https://' + target;
    }

    const parsedTargetUrl = new URL(target);

    // Mengunduh konten HTML utama dengan timeout aman untuk serverless
    const response = await axios.get(target, {
      timeout: 9000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,id;q=0.8'
      }
    });

    const html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    const $ = cheerio.load(html);

    const title = $('title').text().trim() || parsedTargetUrl.hostname;
    const metaDesc = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
    const techStack = detectTechStack(html, response.headers);

    const rawFiles = [];
    let totalBytes = Buffer.byteLength(html, 'utf8');

    // Tambahkan berkas index.html utama
    rawFiles.push({
      name: 'index.html',
      path: 'index.html',
      url: target,
      type: 'html',
      size: totalBytes,
      formattedSize: formatBytes(totalBytes),
      content: html
    });

    // Kumpulkan link CSS eksternal
    const cssFetchQueue = [];
    $('link[rel="stylesheet"]').each(function (idx, el) {
      const href = $(el).attr('href');
      if (href) {
        try {
          const resolvedUrl = new URL(href, target).href;
          const fileName = cleanFileName(resolvedUrl, 'style-' + (idx + 1) + '.css');
          cssFetchQueue.push({
            name: fileName,
            path: 'css/' + fileName,
            url: resolvedUrl,
            type: 'css'
          });
        } catch (e) {
          // Abaikan format URL yang tidak valid
        }
      }
    });

    // Kumpulkan script JS eksternal
    const jsFetchQueue = [];
    $('script[src]').each(function (idx, el) {
      const src = $(el).attr('src');
      if (src) {
        try {
          const resolvedUrl = new URL(src, target).href;
          const fileName = cleanFileName(resolvedUrl, 'script-' + (idx + 1) + '.js');
          jsFetchQueue.push({
            name: fileName,
            path: 'js/' + fileName,
            url: resolvedUrl,
            type: 'javascript'
          });
        } catch (e) {
          // Abaikan format URL yang tidak valid
        }
      }
    });

    // Unduh aset remote secara simultan (dibatasi 10 file pertama agar cepat dan stabil)
    const fetchTargets = cssFetchQueue.slice(0, 10).concat(jsFetchQueue.slice(0, 10));
    const downloadPromises = fetchTargets.map(function (item) {
      return axios
        .get(item.url, {
          timeout: 4000,
          responseType: 'text',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
          }
        })
        .then(function (resAsset) {
          const content = typeof resAsset.data === 'string' ? resAsset.data : JSON.stringify(resAsset.data);
          const size = Buffer.byteLength(content, 'utf8');
          totalBytes += size;
          return {
            name: item.name,
            path: item.path,
            url: item.url,
            type: item.type,
            size: size,
            formattedSize: formatBytes(size),
            content: content
          };
        })
        .catch(function () {
          return {
            name: item.name,
            path: item.path,
            url: item.url,
            type: item.type,
            size: 0,
            formattedSize: '0 B',
            content: '/* Gagal mengunduh sumber daya remote dari ' + item.url + ' */'
          };
        });
    });

    const settledAssets = await Promise.allSettled(downloadPromises);
    settledAssets.forEach(function (result) {
      if (result.status === 'fulfilled' && result.value) {
        rawFiles.push(result.value);
      }
    });

    // Hitung statistik aset
    const stats = {
      totalFiles: rawFiles.length,
      totalSize: formatBytes(totalBytes),
      totalSizeBytes: totalBytes,
      htmlCount: rawFiles.filter(function (f) { return f.type === 'html'; }).length,
      cssCount: rawFiles.filter(function (f) { return f.type === 'css'; }).length,
      jsCount: rawFiles.filter(function (f) { return f.type === 'javascript'; }).length,
      techCount: techStack.length
    };

    // Susun pohon direktori file
    const tree = buildFileTree(rawFiles);

    // Sajikan respons komprehensif yang kompatibel dengan format frontend apa pun
    return res.status(200).json({
      success: true,
      url: target,
      targetUrl: target,
      title: title,
      description: metaDesc,
      html: html,
      stats: stats,
      technologies: techStack,
      techStack: techStack,
      files: rawFiles,
      assets: rawFiles,
      tree: tree,
      data: {
        url: target,
        title: title,
        stats: stats,
        technologies: techStack,
        files: rawFiles,
        tree: tree
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Gagal menganalisis website target: ' + (error.message || 'Terjadi kesalahan pada server.'),
      details: error.code || 'UNKNOWN_ERROR'
    });
  }
};
