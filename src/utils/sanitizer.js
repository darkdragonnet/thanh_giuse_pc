/**
 * src/utils/sanitizer.js
 * Module thuần túy (Pure Helper, Side-Effect-Free) làm sạch chuỗi, che giấu token/secrets,
 * và chuẩn hóa mã lỗi mà không phụ thuộc vào Axios, Express, Redis hay Hanet network.
 */

/**
 * Che giấu các chuỗi nhạy cảm (Bearer tokens, passwords, secrets, access tokens)
 * @param {string} str
 * @returns {string}
 */
function redactSecrets(str) {
  if (!str || typeof str !== 'string') return '';
  let clean = str;
  // 1. Bearer Token
  clean = clean.replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, 'Bearer [REDACTED]');
  // 2. Query / URL encoded secrets (token, secret, password, access_token, client_secret)
  clean = clean.replace(/([?&])?(token|secret|password|access_token|client_secret|clientSecret)=([^&\s]+)/gi, '$1$2=[REDACTED]');
  // 3. JSON property secrets ("token": "...", "password": "...", etc.)
  clean = clean.replace(/"(token|secret|password|access_token|client_secret|clientSecret)"\s*:\s*"[^"]*"/gi, '"$1":"[REDACTED]"');
  // 4. Colon formatted secrets (token: abc, password: 123)
  clean = clean.replace(/(token|secret|password|access_token|client_secret|clientSecret)\s*:\s*([^,\s}]+)/gi, '$1: [REDACTED]');
  return clean;
}

/**
 * Loại bỏ thẻ HTML thô
 * @param {string} str
 * @returns {string}
 */
function stripHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, ' ');
}

/**
 * Loại bỏ ký tự điều khiển (ASCII 0-31, 127) và gộp khoảng trắng thừa
 * @param {string} str
 * @returns {string}
 */
function stripControlChars(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[\x00-\x1F\x7F]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Làm sạch và rút gọn thông báo lỗi an toàn
 * @param {any} msg
 * @param {number} [maxLength=150]
 * @returns {string|null}
 */
function sanitizeErrorMessage(msg, maxLength = 150) {
  if (msg === null || msg === undefined) return null;
  let str = typeof msg === 'object' ? JSON.stringify(msg) : String(msg);

  str = stripHtml(str);
  str = stripControlChars(str);
  str = redactSecrets(str);

  if (maxLength && str.length > maxLength) {
    str = str.substring(0, maxLength - 3) + '...';
  }
  return str || null;
}

/**
 * Kiểm tra kiểu dữ liệu và chuẩn hóa returnCode:
 * Chỉ chấp nhận số nguyên an toàn hoặc chuỗi số nguyên hợp lệ (VD: 1, -9005, '1', '-9007').
 * Tuyệt đối từ chối: boolean, array, object, NaN, Infinity, chuỗi rỗng hoặc chuỗi float.
 * @param {any} val
 * @returns {number|null}
 */
function validateAndParseReturnCode(val) {
  if (typeof val === 'number') {
    return Number.isInteger(val) ? val : null;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^-?\d+$/.test(trimmed)) {
      const num = parseInt(trimmed, 10);
      return Number.isSafeInteger(num) ? num : null;
    }
  }
  return null;
}

module.exports = {
  redactSecrets,
  stripHtml,
  stripControlChars,
  sanitizeErrorMessage,
  validateAndParseReturnCode
};
