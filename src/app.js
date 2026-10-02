const express = require('express');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');
const methodOverride = require('method-override');
const session = require('express-session');
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');
const { RedisStore } = require('connect-redis');
const { createClient } = require('redis');
const dotenv = require('dotenv');
const imageService = require('./services/imageService');
const defaultAuthMiddleware = require('./middlewares/authMiddleware');

dotenv.config();

const personRoutes = require('./routes/personRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const classRoutes = require('./routes/classRoutes');
const transferRoutes = require('./routes/transferRoutes');

// Khởi chạy Garbage Collection định kỳ mỗi 30 phút dọn dẹp file tạm mồ côi cũ hơn 1 giờ
const gcTimer = setInterval(() => {
  imageService.cleanOldFiles(60 * 60 * 1000);
}, 30 * 60 * 1000);
if (gcTimer && typeof gcTimer.unref === 'function') {
  gcTimer.unref();
}

const app = express();
const PORT = process.env.PORT || 3000;

// Khởi tạo Redis Client cho Express Session
const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379}/${process.env.REDIS_DB || 4}`
});

redisClient.on('error', (err) => console.error('[Redis Client Error]', err.message));
redisClient.on('connect', () => console.log('✅ [Redis] Da ket noi thanh cong'));

redisClient.connect().catch((err) => {
  console.error('[Redis Connect Failed]', err.message);
});

app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(methodOverride('_method'));

// Session store qua Redis DB 4
app.use(
  session({
    store: new RedisStore({ client: redisClient, prefix: 'hanet_sess:' }),
    secret: process.env.SESSION_SECRET || 'secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 } // 8 giờ
  })
);

app.use(flash());

// Cấu hình View Engine EJS
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, '../public')));

// Middleware xử lý fallback cho ảnh bị dọn dẹp sau 30s (RULE-022)
app.get('/uploads/:filename', (req, res) => {
  const filePath = path.join(__dirname, '../uploads', req.params.filename);

  // 1. File vẫn tồn tại (trong khoảng 30s đầu)
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  // 2. File đã bị dọn dẹp (RULE-022) -> Trả về ảnh mặc định nếu có
  const defaultAvatarPath = path.join(__dirname, '../public/images/default-avatar.png');
  if (fs.existsSync(defaultAvatarPath)) {
    return res.sendFile(defaultAvatarPath);
  }

  // 3. Fallback cuối cùng: Trả về 1 ảnh SVG 1x1 trong suốt với HTTP 200 (Tránh 404 hoàn toàn)
  res.setHeader('Content-Type', 'image/svg+xml');
  return res.send(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1">
      <rect width="1" height="1" fill="transparent"/>
    </svg>
  `);
});

// Middleware biến toàn cục cho Views
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.currentPath = req.path;
  res.locals.user = req.session?.user || null;
  next();
});

// Tự động nhận diện token từ query (?token=...) mà KHÔNG chặn route công khai
app.use(defaultAuthMiddleware);

// Triệt tiêu log rác favicon 404
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Chuyển hướng trang chủ về danh sách liên kết
app.get('/', (req, res) => {
  return res.redirect('/links');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', architecture: 'Cloud-First (No-DB)' });
});

// Mount Routes
app.use('/departments', departmentRoutes);
app.use('/', classRoutes);
app.use('/', transferRoutes);
app.use('/', personRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server dang chay tai: http://localhost:${PORT}`);
});
