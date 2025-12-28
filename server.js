require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db'); // التأكد من وجود ملف db.js بجانبه

const app = express();

// 1. إعدادات الـ CORS - دي أهم حاجة عشان الفرونت يكلم الباك
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// 2. خدمة الملفات الثابتة (لو رفعتي الفرونت مع الباك)
app.use(express.static(path.join(__dirname)));

// 3. المسارات (Routes)
// تأكدي أن ملفات auth.js و volunteers.js و reports.js موجودة برا في المجلد الرئيسي
app.use('/api/auth', require('./auth'));

// المسارات دي لو مش موجودة حالياً السيرفر مش هيشتغل، لو ممسوحين حطي قبلهم //
app.use('/api/volunteers', require('./volunteers'));
app.use('/api/reports', require('./reports'));

// 4. اختبار حالة السيرفر والقاعدة (Health Check)
app.get('/health', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({ status: 'OK', database: 'Connected', time: result.rows[0] });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', database: 'Disconnected', error: error.message });
  }
});

// 5. معالج الأخطاء العام (عشان نعرف الـ 500 سببها إيه)
app.use((error, req, res, next) => {
  console.error('Detailed Server Error:', error);
  res.status(500).json({
    message: 'خطأ داخلي في الخادم',
    detail: error.message
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;
