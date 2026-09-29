/**
 * Role-Based Access Control (RBAC) & Authentication Middleware
 */

const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  GROUP_LEADER: 'GROUP_LEADER',
  PUBLIC_USER: 'PUBLIC_USER'
};

/**
 * Middleware phân quyền theo vai trò (RBAC)
 * @param {Array<string>} allowedRoles - Danh sách vai trò được phép truy cập
 */
function authorize(allowedRoles = []) {
  return (req, res, next) => {
    const adminToken = process.env.ADMIN_TOKEN || process.env.APP_TOKEN;

    // 1. Nếu có token truyền qua Query URL (?token=...) hoặc Header Bearer
    const queryToken = req.query.token;
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const providedToken = queryToken || bearerToken;

    if (adminToken && providedToken && String(providedToken) === String(adminToken)) {
      if (req.session) {
        req.session.user = {
          id: 'admin_sys',
          username: 'superadmin',
          role: ROLES.SUPER_ADMIN
        };
        req.session.isAdminAuthenticated = true;
      }
      req.user = req.session ? req.session.user : { id: 'admin_sys', username: 'superadmin', role: ROLES.SUPER_ADMIN };
    }

    // 2. Lấy thông tin user hiện tại từ Session hoặc Request
    let currentUser = req.session?.user || req.user || null;

    // Nếu không cấu hình ADMIN_TOKEN trên môi trường dev/local -> cấp quyền SUPER_ADMIN mặc định
    if (!adminToken && !currentUser) {
      currentUser = {
        id: 'dev_user',
        username: 'developer',
        role: ROLES.SUPER_ADMIN
      };
      if (req.session) req.session.user = currentUser;
      req.user = currentUser;
    }

    // 3. Nếu chưa đăng nhập / chưa có danh tính
    if (!currentUser) {
      if (req.accepts('html')) {
        return res.status(401).send(`
          <!DOCTYPE html>
          <html lang="vi">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>401 - Yêu Cầu Xác Thực</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
          </head>
          <body class="bg-light d-flex align-items-center justify-content-center vh-100">
            <div class="card border-0 shadow-sm rounded-4 p-4 text-center" style="max-width: 480px;">
              <div class="text-warning mb-3">
                <i class="bi bi-shield-lock-fill display-3"></i>
              </div>
              <h4 class="fw-bold text-dark">Yêu Cầu Xác Thực Danh Tính</h4>
              <p class="text-muted small mt-2">
                Trang quản trị này yêu cầu quyền truy cập hợp lệ. Vui lòng đăng nhập hoặc cung cấp mã Token xác thực.
              </p>
              <div class="alert alert-secondary small border-0 text-start py-2">
                <i class="bi bi-key-fill me-1"></i> Truy cập kèm mã Token quản trị (Ví dụ: <code>/?token=...</code>)
              </div>
              <a href="/links" class="btn btn-outline-primary btn-sm rounded-pill mt-2">
                <i class="bi bi-arrow-left me-1"></i> Trang Đăng Ký Theo Lớp
              </a>
            </div>
          </body>
          </html>
        `);
      }
      return res.status(401).json({ error: 'Chưa đăng nhập hoặc thiếu mã Token xác thực.' });
    }

    // 4. Kiểm tra Role có nằm trong allowedRoles không (nếu allowedRoles rỗng thì cho qua)
    if (allowedRoles.length > 0 && !allowedRoles.includes(currentUser.role)) {
      if (req.accepts('html')) {
        return res.status(403).send(`
          <!DOCTYPE html>
          <html lang="vi">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>403 - Không Có Quyền Truy Cập</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
          </head>
          <body class="bg-light d-flex align-items-center justify-content-center vh-100">
            <div class="card border-0 shadow-sm rounded-4 p-4 text-center" style="max-width: 480px;">
              <div class="text-danger mb-3">
                <i class="bi bi-slash-circle-fill display-3"></i>
              </div>
              <h4 class="fw-bold text-dark">403 - Quyền Truy Cập Bị Từ Chối</h4>
              <p class="text-muted small mt-2">
                Vai trò hiện tại của bạn (<code>${currentUser.role}</code>) không được phép thực hiện chức năng này.
              </p>
              <a href="/" class="btn btn-primary btn-sm rounded-pill mt-2">
                <i class="bi bi-house-door-fill me-1"></i> Về Trang Chủ
              </a>
            </div>
          </body>
          </html>
        `);
      }
      return res.status(403).json({ error: 'Không có quyền truy cập chức năng này (Forbidden).' });
    }

    req.user = currentUser;
    next();
  };
}

/**
 * Global Interceptor Middleware tự động nhận diện token quản trị
 */
const defaultAuthMiddleware = (req, res, next) => {
  const adminToken = process.env.ADMIN_TOKEN || process.env.APP_TOKEN;
  const queryToken = req.query.token;
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const providedToken = queryToken || bearerToken;

  if (adminToken && providedToken && String(providedToken) === String(adminToken)) {
    if (req.session) {
      req.session.user = {
        id: 'admin_sys',
        username: 'superadmin',
        role: ROLES.SUPER_ADMIN
      };
      req.session.isAdminAuthenticated = true;
    }
    req.user = req.session ? req.session.user : { id: 'admin_sys', username: 'superadmin', role: ROLES.SUPER_ADMIN };
  }

  next();
};

module.exports = defaultAuthMiddleware;
module.exports.ROLES = ROLES;
module.exports.authorize = authorize;
