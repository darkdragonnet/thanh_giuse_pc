const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(process.cwd(), 'logs');
const AUDIT_LOG_FILE = path.join(LOGS_DIR, 'audit.log');

// Tự động tạo thư mục logs nếu chưa tồn tại
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Middleware tự động ghi Structured Audit Log cho các thao tác CUD / Sync
 * @param {string} actionName - Tên hành động nghiệp vụ (Ví dụ: UPDATE_PERSON, DELETE_PERSON, SYNC_CLOUD)
 */
function auditLog(actionName = 'SYSTEM_ACTION') {
  return (req, res, next) => {
    const originalSend = res.send;
    const originalJson = res.json;

    let responseBody = null;

    res.send = function (data) {
      responseBody = data;
      res.send = originalSend;
      return res.send.apply(res, arguments);
    };

    res.json = function (data) {
      responseBody = data;
      res.json = originalJson;
      return res.json.apply(res, arguments);
    };

    // Lắng nghe sự kiện finish của response để trích xuất đầy đủ dữ liệu
    res.on('finish', () => {
      const user = req.session?.user || req.user || {
        userId: 'ANONYMOUS',
        username: 'anonymous_user',
        role: 'PUBLIC_USER'
      };

      const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Unknown-Agent';

      // Trích xuất target metadata
      const target = {
        aliasId: req.body?.aliasID || req.params?.aliasID || null,
        personId: req.params?.personID || req.params?.id || req.body?.personID || null,
        className: req.params?.file_name || req.body?.source_csv || req.body?.className || req.body?.lop || null
      };

      // Trích xuất changes
      const changes = {
        before: req.body?._before || {},
        after: {
          name: req.body?.name || req.body?.personName || null,
          title: req.body?.title || null,
          departmentID: req.body?.departmentID || null,
          aliasID: req.body?.aliasID || null
        }
      };

      const isSuccess = res.statusCode >= 200 && res.statusCode < 400;

      const logEntry = {
        timestamp: new Date().toISOString(),
        actor: {
          userId: user.id || user.userId || 'usr_unknown',
          username: user.username || 'unknown',
          role: user.role || 'PUBLIC_USER',
          ip: String(ip),
          userAgent: String(userAgent)
        },
        action: actionName,
        target,
        changes,
        statusCode: res.statusCode,
        result: isSuccess ? 'SUCCESS' : 'FAILED'
      };

      const logLine = JSON.stringify(logEntry);

      // 1. In ra Terminal với format [AUDIT]
      console.log(`[AUDIT] ${actionName} | Actor: ${user.username} (${user.role}) | Status: ${res.statusCode} | Target: ${target.personId || target.aliasId || target.className || 'N/A'}`);

      // 2. Ghi nối (append) vào file logs/audit.log
      try {
        fs.appendFileSync(AUDIT_LOG_FILE, logLine + '\n', 'utf-8');
      } catch (err) {
        console.error('[Audit Log Error] Không thể ghi file audit.log:', err.message);
      }
    });

    next();
  };
}

module.exports = {
  auditLog
};
