require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');

// استيراد قاعدة البيانات من الملف اللي بره
const db = require('./db'); 

const app = express();

// إعدادات الأمان والـ CORS
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// تحديد عدد الطلبات
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'تم تجاوز حد الطلبات المسموح' }
});
app.use('/api/', limiter);

// خدمة الملفات الثابتة من المجلد الرئيسي
app.use(express.static(path.join(__dirname)));

// استيراد المسارات (Routes) مباشرة من الملفات الخارجية
// ملحوظة: لو ملف من دول مش موجود عندك ارفع علامة // قبله
app.use('/api/auth', require('./auth'));
app.use('/api/volunteers', require('./volunteers'));
app.use('/api/reports', require('./reports'));

// اختبار حالة السيرفر والقاعدة
app.get('/health', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW() as current_time');
    res.json({
      status: 'OK',
      database: 'Connected',
      server_time: result.rows[0].current_time
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', database: 'Disconnected', error: error.message });
  }
});

// توجيه أي رابط لصفحة index.html
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// معالج الأخطاء العام
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(error.status || 500).json({
    error: error.message || 'خطأ داخلي في الخادم'
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  try {
    await db.query('SELECT NOW()');
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
  const cors = require('cors');
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
});

module.exports = app;
