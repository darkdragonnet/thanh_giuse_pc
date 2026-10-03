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
const queueService = require('./services/queueService');
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

// Khởi chạy Outbox Dispatcher định kỳ mỗi 30 giây phục hồi các yêu cầu chưa được nạp vào Queue
const outboxTimer = setInterval(() => {
  queueService.dispatchPendingOutbox().catch(() => {});
}, 30 * 1000);
if (outboxTimer && typeof outboxTimer.unref === 'function') {
  outboxTimer.unref();
}

const app = express();
const PORT = process.env.PORT || 3000;

// Khởi tạo Redis Client cho Express Session
const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}/${process.env.REDIS_DB || 4}`
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

// Tuyệt đối KHÔNG trả ảnh mặc định hoặc SVG 200 khi thiếu file ảnh; phải trả 404 chính xác
app.get('/uploads/:filename', (req, res) => {
  const filePath = path.join(__dirname, '../uploads', req.params.filename);

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  return res.status(404).json({ error: 'Image file not found' });
});

// Middleware biến toàn cục cho Views
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.warning = req.flash('warning');
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
  res.status(200).json({ status: 'ok', architecture: 'Postgres-First' });
});

// Mount Routes
app.use('/departments', departmentRoutes);
app.use('/', classRoutes);
app.use('/', transferRoutes);
app.use('/', personRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server dang chay tai: http://localhost:${PORT}`);
});

module.exports = app;
