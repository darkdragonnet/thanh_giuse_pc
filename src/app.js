const express = require('express');
const path = require('path');
const morgan = require('morgan');
const methodOverride = require('method-override');
const session = require('express-session');
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');
const { RedisStore } = require('connect-redis');
const { createClient } = require('redis');
const dotenv = require('dotenv');

dotenv.config();

const personRoutes = require('./routes/personRoutes');

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
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Middleware biến toàn cục cho Views
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.currentPath = req.path;
  next();
});

// Mount Routes
app.use('/', personRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', architecture: 'Cloud-First (No-DB)' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server dang chay tai: http://localhost:${PORT}`);
});
