const { pool } = require('../config/database');

/**
 * Middleware tự động ghi Structured Audit Log cho các thao tác CUD / Sync vào PostgreSQL
 * @param {string} actionName - Tên hành động nghiệp vụ (Ví dụ: UPDATE_PERSON, DELETE_PERSON, TRIGGER_CLOUD_SYNC)
 */
function auditLog(actionName = 'SYSTEM_ACTION') {
  return (req, res, next) => {
    // Lắng nghe sự kiện finish của response để trích xuất đầy đủ dữ liệu
    res.on('finish', () => {
      const user = req.session?.user || req.user || {
        id: 'ANONYMOUS',
        userId: 'ANONYMOUS',
        username: 'anonymous_user',
        role: 'GUEST'
      };

      const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Unknown-Agent';

      // Trích xuất target metadata
      const targetId = req.params?.personID || req.params?.id || req.body?.personID || req.body?.aliasID || req.params?.file_name || req.params?.departmentID || null;

      // Trích xuất chi tiết thay đổi
      const details = {
        query: req.query || {},
        params: req.params || {},
        bodyKeys: Object.keys(req.body || {}),
        changes: {
          name: req.body?.name || req.body?.personName || null,
          title: req.body?.title || null,
          departmentID: req.body?.departmentID || null,
          aliasID: req.body?.aliasID || null,
          className: req.params?.file_name || req.body?.source_csv || req.body?.className || null
        }
      };

      // 1. In ra Terminal với format tiêu chuẩn [AUDIT]
      console.log(`[AUDIT] ${actionName} | Actor: ${user.username || 'guest'} (${user.role || 'GUEST'}) | Status: ${res.statusCode} | Target: ${targetId || 'N/A'}`);

      // 2. Ghi trực tiếp vào bảng audit_logs trong PostgreSQL
      pool.query(
        `INSERT INTO audit_logs (action, user_id, username, role, status_code, ip_address, user_agent, target_id, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)`,
        [
          actionName,
          user.id || user.userId || 'ANONYMOUS',
          user.username || 'guest',
          user.role || 'GUEST',
          res.statusCode,
          String(ip),
          String(userAgent),
          targetId ? String(targetId) : null,
          JSON.stringify(details)
        ]
      ).catch(err => {
        console.error('[Audit DB Error] Không thể ghi bảng audit_logs:', err.message);
      });
    });

    next();
  };
}

module.exports = {
  auditLog
};
