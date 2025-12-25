require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');

// --- التعديل الأول: استيراد قاعدة البيانات من الملف اللي بره ---
const db = require('./db'); 

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'تم تجاوز حد الطلبات المسموح' }
});
app.use('/api/', limiter);

// --- التعديل الثاني: الملفات ثابتة في الصفحة الرئيسية برضه ---
app.use(express.static(path.join(__dirname)));

// --- التعديل الثالث: استيراد المسارات (Routes) من الملفات اللي بره مباشرة ---
app.use('/api/auth', require('./auth'));
app.use('/api/volunteers', require('./volunteers'));
app.use('/api/evaluations', require('./evaluations'));
app.use('/api/reports', require('./reports'));
app.use('/api/alerts', require('./alerts'));
app.use('/api/criteria', require('./criteria'));

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

// توجيه الصفحات لملف index.html اللي بره
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// معالج الأخطاء
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
});

module.exports = app;
