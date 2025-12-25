require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');

// استيراد إعدادات قاعدة البيانات
const db = require('./config/db');

// إنشاء تطبيق Express
const app = express();

// إعدادات الأمان
app.use(helmet({
  contentSecurityPolicy: false, // للسماح بـ inline styles في HTML
}));

// إعداد CORS للسماح للفرونت إند بالوصول
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// إعدادات أساسية
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// إعداد rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 1000, // حد أقصى 1000 طلب لكل IP
  message: {
    error: 'تم تجاوز حد الطلبات المسموح. حاول مرة أخرى بعد 15 دقيقة'
  }
});
app.use('/api/', limiter);

// خدمة الملفات الثابتة (Frontend)
app.use(express.static(path.join(__dirname, 'public')));

// إعداد API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/volunteers', require('./routes/volunteers'));
app.use('/api/evaluations', require('./routes/evaluations'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/criteria', require('./routes/criteria'));

// Health Check Endpoint
app.get('/health', async (req, res) => {
  try {
    // اختبار الاتصال بقاعدة البيانات
    const result = await db.query('SELECT NOW() as current_time');
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: 'Connected',
      server_time: result.rows[0].current_time,
      version: '1.0.1'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      database: 'Disconnected',
      error: error.message
    });
  }
});

// API Status Endpoint
app.get('/api/status', async (req, res) => {
  try {
    // اختبار بيانات أساسية
    const usersCount = await db.query('SELECT COUNT(*) FROM users');
    const volunteersCount = await db.query('SELECT COUNT(*) FROM volunteers');
    
    res.json({
      api_status: 'Active',
      database_status: 'Connected',
      total_users: parseInt(usersCount.rows[0].count),
      total_volunteers: parseInt(volunteersCount.rows[0].count),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('API status check failed:', error);
    res.status(500).json({
      api_status: 'Error',
      database_status: 'Disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// توجيه الصفحات إلى Frontend (SPA)
app.get('*', (req, res) => {
  // إذا كان الطلب لـ API، إرجاع خطأ 404
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      error: 'API endpoint not found',
      path: req.path,
      method: req.method
    });
  }
  
  // توجيه جميع الصفحات الأخرى إلى index.html
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// معالج الأخطاء العام
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  
  // إذا كان الخطأ من قاعدة البيانات
  if (error.code === 'ECONNREFUSED') {
    return res.status(500).json({
      error: 'خطأ في الاتصال بقاعدة البيانات',
      message: 'Database connection failed'
    });
  }
  
  // خطأ عام
  res.status(error.status || 500).json({
    error: error.message || 'خطأ داخلي في الخادم',
    timestamp: new Date().toISOString()
  });
});

// معالج الصفحات غير الموجودة
app.use((req, res) => {
  res.status(404).json({
    error: 'الصفحة غير موجودة',
    path: req.path,
    method: req.method
  });
});

// تشغيل الخادم
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  
  // اختبار اتصال قاعدة البيانات عند البدء
  try {
    const result = await db.query('SELECT NOW()');
    console.log('✅ Database connected successfully');
    console.log(`🕐 Database time: ${result.rows[0].now}`);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Please check your database configuration');
  }
});

// معالج إيقاف التطبيق بأمان
process.on('SIGTERM', async () => {
  console.log('🔄 SIGTERM received, shutting down gracefully');
  try {
    await db.end();
    console.log('✅ Database connections closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('🔄 SIGINT received, shutting down gracefully');
  try {
    await db.end();
    console.log('✅ Database connections closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

module.exports = app;