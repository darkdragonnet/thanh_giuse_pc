module.exports = (req, res, next) => {
  const adminToken = process.env.ADMIN_TOKEN || process.env.APP_TOKEN;

  // Nếu không cấu hình ADMIN_TOKEN trong .env thì mặc định cho qua
  if (!adminToken) {
    return next();
  }

  const path = req.path;

  // 1. Danh sách trắng: Các đường dẫn luôn mở công khai
  const isPublic = 
    path.startsWith('/register') || 
    path.startsWith('/links') || 
    path.startsWith('/uploads') || 
    path.startsWith('/css') || 
    path.startsWith('/js') || 
    path.startsWith('/images') || 
    path === '/favicon.ico' || 
    path === '/health';

  if (isPublic) {
    return next();
  }

  // 2. Kiểm tra token truyền qua Query URL (?token=...)
  const providedToken = req.query.token;
  if (providedToken && String(providedToken) === String(adminToken)) {
    if (req.session) {
      req.session.isAdminAuthenticated = true;
    }
    return next();
  }

  // 3. Kiểm tra Session đã đăng nhập trước đó chưa
  if (req.session && req.session.isAdminAuthenticated) {
    return next();
  }

  // 4. Bị từ chối truy cập (403 Forbidden)
  res.status(403).send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>403 - Giới Hạn Quyền Truy Cập</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    </head>
    <body class="bg-light d-flex align-items-center justify-content-center vh-100">
      <div class="card border-0 shadow-sm rounded-4 p-4 text-center" style="max-width: 480px;">
        <div class="text-danger mb-3">
          <i class="bi bi-shield-lock-fill display-3"></i>
        </div>
        <h4 class="fw-bold text-dark">Khu Vực Quản Trị Được Bảo Vệ</h4>
        <p class="text-muted small mt-2">
          Trang web này yêu cầu mã Token xác thực hợp lệ để truy cập hệ thống quản trị Face ID.
        </p>
        <div class="alert alert-warning small border-0 text-start py-2">
          <i class="bi bi-info-circle me-1"></i> Nếu bạn là quản trị viên, vui lòng truy cập đường dẫn kèm mã xác thực đã được cấp (ví dụ: <code>/?token=...</code>).
        </div>
        <a href="/links" class="btn btn-outline-primary btn-sm rounded-pill mt-2">
          <i class="bi bi-arrow-left me-1"></i> Đến Trang Link Đăng Ký
        </a>
      </div>
    </body>
    </html>
  `);
};
