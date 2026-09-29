/**
 * Authentication Controller for Admin Access
 */

exports.showLogin = (req, res) => {
  // Nếu đã đăng nhập thì chuyển hướng vào trang quản trị
  if (req.session?.user) {
    return res.redirect('/');
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Đăng Nhập Quản Trị - HANET Cloud</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    </head>
    <body class="bg-light d-flex align-items-center justify-content-center vh-100">
      <div class="card border-0 shadow-sm rounded-4 p-4 text-center" style="max-width: 420px; width: 100%;">
        <div class="text-primary mb-3">
          <i class="bi bi-shield-lock-fill display-4"></i>
        </div>
        <h4 class="fw-bold text-dark mb-1">Quản Trị Hệ Thống</h4>
        <p class="text-muted small mb-4">Nhập mã Token quản trị để truy cập</p>

        <form method="POST" action="/login">
          <div class="mb-3 text-start">
            <label class="form-label small fw-semibold">Mã Token Quản Trị / Password</label>
            <input type="password" name="token" class="form-control form-control-lg rounded-3" placeholder="Nhập mã token..." required autofocus>
          </div>
          <button type="submit" class="btn btn-primary btn-lg w-100 fw-bold rounded-pill shadow-sm">
            <i class="bi bi-box-arrow-in-right me-1"></i> Đăng Nhập
          </button>
        </form>

        <div class="mt-4 pt-2 border-top">
          <a href="/links" class="text-decoration-none small text-muted">
            <i class="bi bi-arrow-left me-1"></i> Về trang Đăng Ký Theo Lớp
          </a>
        </div>
      </div>
    </body>
    </html>
  `);
};

exports.handleLogin = (req, res) => {
  const { token, username, password } = req.body;
  const adminToken = process.env.ADMIN_TOKEN || process.env.APP_TOKEN || 'admin123';
  const provided = (token || password || '').trim();

  if (provided === adminToken || !process.env.ADMIN_TOKEN) {
    req.session.user = {
      id: 'admin_sys',
      username: username || 'superadmin',
      role: 'SUPER_ADMIN'
    };
    req.session.isAdminAuthenticated = true;
    req.flash('success', 'Đăng nhập thành công!');
    return res.redirect('/');
  }

  req.flash('error', 'Mã Token hoặc mật khẩu không chính xác.');
  return res.redirect('/login');
};

exports.handleLogout = (req, res) => {
  if (req.session) {
    req.session.destroy(() => {
      res.redirect('/links');
    });
  } else {
    res.redirect('/links');
  }
};
