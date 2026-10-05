const path = require('path');
const fs = require('fs');

class ConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Kiểm tra xem hostname có phải là localhost hoặc loopback IPv4/IPv6 hay không.
 * Xử lý cả dạng IPv4 rút gọn (127.1), hex/octal (0x7f.1, 0177.0.0.1), IPv6 (::1) và IPv4-mapped IPv6 (::ffff:127.0.0.1).
 * @param {string} host - Hostname đã chuẩn hóa
 * @returns {boolean}
 */
function isLoopbackHost(host) {
  if (!host) return true;
  const clean = host.replace(/^\[|\]$/g, '').toLowerCase().trim();

  if (clean === 'localhost') return true;
  if (clean === '0.0.0.0' || clean === '::' || clean === '0:0:0:0:0:0:0:0') return true;
  if (clean === '::1' || clean === '0:0:0:0:0:0:0:1') return true;

  // IPv4-mapped IPv6 (ví dụ: ::ffff:127.0.0.1 hoặc WHATWG hex format ::ffff:7f00:1)
  if (clean.startsWith('::ffff:')) {
    const mapped = clean.substring(7);
    if (mapped.startsWith('7f') || mapped.startsWith('127.') || mapped === '0.0.0.0' || mapped === '0:0' || isLoopbackHost(mapped)) {
      return true;
    }
  }

  // Dải 127.0.0.0/8 chuẩn và rút gọn (127.0.0.1, 127.1, 127.0.1.1, ...)
  if (/^127(\.\d+){1,3}$/.test(clean)) return true;

  // Dạng hex (0x7f000001, 0x7f.0.0.1, 7f00:1) hoặc octal (0177.0.0.1)
  if (/^0x7f/i.test(clean) || /^0177\./.test(clean) || /^7f[0-9a-f]{2}:/i.test(clean)) return true;

  // Số nguyên 32-bit (2130706433 = 127.0.0.1)
  if (clean === '2130706433') return true;

  return false;
}

/**
 * Phân tích và xác thực Base URL công khai bằng `new URL()`.
 * @param {string} rawUrl - Chuỗi URL cần xác thực
 * @param {boolean} allowLoopback - Có cho phép loopback/localhost hay không (chỉ trong dev/test)
 * @returns {string} URL đã chuẩn hóa không có trailing slash
 */
function validateAndNormalizeBaseUrl(rawUrl, allowLoopback = false) {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new ConfigurationError('URL cấu hình rỗng hoặc không phải chuỗi.');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl.trim());
  } catch (err) {
    throw new ConfigurationError(`URL cấu hình không hợp lệ (${rawUrl.trim()}): ${err.message}`);
  }

  // 1. Chỉ chấp nhận giao thức http: và https:
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new ConfigurationError(`Giao thức URL không được phép (${parsedUrl.protocol}). Chỉ chấp nhận http: hoặc https:.`);
  }

  // 2. Từ chối credentials (username/password) trong public base URL
  if (parsedUrl.username || parsedUrl.password) {
    throw new ConfigurationError('Public Base URL tuyệt đối không được chứa username hoặc password.');
  }

  // 3. Từ chối query string (?key=val) và hash fragment (#hash) trong public base URL
  if (parsedUrl.search) {
    throw new ConfigurationError('Public Base URL không được chứa query string.');
  }
  if (parsedUrl.hash) {
    throw new ConfigurationError('Public Base URL không được chứa hash fragment.');
  }

  // 4. Kiểm tra hostname loopback / localhost
  const hostname = parsedUrl.hostname;
  if (!allowLoopback && isLoopbackHost(hostname)) {
    throw new ConfigurationError(
      `Hostname "${hostname}" là địa chỉ loopback/localhost, không thể sử dụng làm Public URL để HANET Cloud tải ảnh.`
    );
  }

  // 5. Chuẩn hóa pathname (hỗ trợ base path nếu có, loại bỏ trailing slash)
  const basePath = parsedUrl.pathname.replace(/\/+$/, '');
  const portPart = parsedUrl.port ? `:${parsedUrl.port}` : '';
  return `${parsedUrl.protocol}//${parsedUrl.host.includes(':') && !portPart ? `[${parsedUrl.hostname}]` : parsedUrl.hostname}${portPart}${basePath}`;
}

/**
 * Lấy Base URL công khai chuẩn hóa của hệ thống theo thứ tự ưu tiên:
 * 1. PUBLIC_APP_URL
 * 2. APP_URL
 * 3. BASE_URL
 * 4. req host (trong dev/test) hoặc http://localhost:PORT
 * @param {object} [req] - Express request object nếu có
 * @param {object} [options] - Tùy chọn kiểm tra
 * @returns {string} URL không có dấu gạch chéo cuối
 */
function getPublicBaseUrl(req = null, options = {}) {
  const isProduction = process.env.NODE_ENV === 'production';
  const requirePublic = options.requirePublic || isProduction;

  // Thứ tự ưu tiên cấu hình
  const rawEnvUrl = process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.BASE_URL || null;

  if (rawEnvUrl && rawEnvUrl.trim()) {
    // Nếu có cấu hình nhưng sai format -> NÉM LỖI NGAY, không fallback âm thầm sang biến khác
    return validateAndNormalizeBaseUrl(rawEnvUrl, !requirePublic);
  }

  // Nếu không cấu hình env trong production hoặc khi bắt buộc public URL -> Báo lỗi
  if (requirePublic) {
    throw new ConfigurationError(
      'PUBLIC_APP_URL, APP_URL hoặc BASE_URL bắt buộc phải được cấu hình với domain công khai hợp lệ trong môi trường production / live HANET.'
    );
  }

  // Môi trường dev / test: fallback request host hoặc localhost
  if (req && typeof req.get === 'function') {
    const protocol = req.protocol || 'http';
    const host = req.get('host');
    if (host) {
      return `${protocol}://${host}`.replace(/\/+$/, '');
    }
  }

  const port = process.env.PORT || 3000;
  return `http://localhost:${port}`;
}

/**
 * Kiểm tra và chuẩn hóa tên file ảnh an toàn (chống path traversal)
 * @param {string} filename - Tên file hoặc đường dẫn
 * @returns {string} Tên file an toàn (chỉ là basename đơn thuần)
 */
function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Filename không hợp lệ hoặc rỗng.');
  }

  const trimmed = filename.trim();
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    const base = path.basename(trimmed);
    if (!base || base === '.' || base === '..') {
      throw new Error(`Filename không an toàn: chứa ký tự path traversal (${filename})`);
    }
    return base;
  }
  return trimmed;
}

/**
 * Xác minh đường dẫn file nằm an toàn trong thư mục uploads được phép (bao gồm resolve symlink)
 * @param {string} filePath - Đường dẫn file cần kiểm tra
 * @returns {string} Đường dẫn tuyệt đối an toàn
 */
function verifyUploadFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Đường dẫn file không hợp lệ.');
  }

  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  const resolvedPath = path.resolve(filePath);

  // Kiểm tra symlink thực tế nếu file tồn tại
  let realFilePath = resolvedPath;
  let realUploadsDir = uploadsDir;
  if (fs.existsSync(resolvedPath)) {
    try {
      realFilePath = fs.realpathSync(resolvedPath);
    } catch (_) {}
  }
  if (fs.existsSync(uploadsDir)) {
    try {
      realUploadsDir = fs.realpathSync(uploadsDir);
    } catch (_) {}
  }

  if (!realFilePath.startsWith(realUploadsDir) && !resolvedPath.startsWith(uploadsDir)) {
    throw new Error(`Đường dẫn file không nằm trong thư mục uploads được phép: ${filePath}`);
  }

  return resolvedPath;
}

/**
 * Xây dựng URL công khai cho file ảnh upload
 * @param {string} filename - Tên file ảnh trong thư mục uploads
 * @param {object} [req] - Express request object nếu có
 * @param {object} [options] - Options (requirePublic, etc.)
 * @returns {string} Public URL đầy đủ
 */
function buildPublicImageUrl(filename, req = null, options = {}) {
  if (!filename) return null;
  const cleanFilename = sanitizeFilename(filename);
  const baseUrl = getPublicBaseUrl(req, options);
  return `${baseUrl}/uploads/${encodeURIComponent(cleanFilename)}`;
}

/**
 * Làm sạch URL ảnh, loại bỏ cú pháp markdown nếu có [url](url)
 * @param {string} url - URL cần làm sạch
 * @returns {string|null} URL hợp lệ
 */
function sanitizeImageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  let clean = url.trim();
  const mdMatch = clean.match(/\((https?:\/\/[^\s)]+)\)/);
  if (mdMatch) {
    clean = mdMatch[1];
  } else {
    clean = clean.replace(/[\[\]"']/g, '').trim();
  }
  return clean || null;
}

/**
 * Danh sách hostname CDN chính thức của HANET AI Cloud
 */
const ALLOWED_HANET_CDN_HOSTNAMES = new Set([
  'static.hanet.ai',
  'vcdn-static.hanet.ai',
  'hanet-static.vcdn.vn',
  'vcdn.hanet.ai'
]);

/**
 * Kiểm tra xem URL có phải là URL ảnh CDN chính thức đã được xác thực từ HANET Cloud hay không.
 * Ngăn chặn tuyệt đối việc nhận nhầm URL /uploads/ tạm thời, localhost hoặc domain giả mạo.
 * @param {string} rawUrl - URL cần kiểm tra
 * @returns {boolean}
 */
function isVerifiedHanetCdnUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const cleanUrl = sanitizeImageUrl(rawUrl);
  if (!cleanUrl) return false;

  try {
    const parsed = new URL(cleanUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

    const host = parsed.hostname.toLowerCase();
    if (isLoopbackHost(host)) return false;

    if (ALLOWED_HANET_CDN_HOSTNAMES.has(host)) return true;
    if (/^(vcdn-)?static[0-9]*\.hanet\.ai$/.test(host)) return true;

    return false;
  } catch (_) {
    return false;
  }
}

/**
 * Kiểm tra xem URL có phải là URL ảnh tải lên tạm thời (/uploads/...) hoặc local hay không
 * @param {string} rawUrl
 * @returns {boolean}
 */
function isUploadsUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const cleanUrl = sanitizeImageUrl(rawUrl);
  if (!cleanUrl) return false;

  if (cleanUrl.startsWith('/uploads/') || cleanUrl.startsWith('uploads/')) return true;

  try {
    const parsed = new URL(cleanUrl);
    if (parsed.pathname.startsWith('/uploads/')) return true;
    if (isLoopbackHost(parsed.hostname)) return true;
    return false;
  } catch (_) {
    return cleanUrl.includes('/uploads/');
  }
}

module.exports = {
  ConfigurationError,
  ALLOWED_HANET_CDN_HOSTNAMES,
  isLoopbackHost,
  validateAndNormalizeBaseUrl,
  getPublicBaseUrl,
  sanitizeFilename,
  verifyUploadFilePath,
  buildPublicImageUrl,
  sanitizeImageUrl,
  isVerifiedHanetCdnUrl,
  isUploadsUrl
};
