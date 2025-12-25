      const { Pool } = require('pg');

// إعدادات الاتصال بقاعدة البيانات
const dbConfig = {
  // قراءة الرابط مباشرة من متغيرات البيئة في Koyeb
  connectionString: process.env.DATABASE_URL,
  
  // إعدادات SSL إجبارية عشان Neon PostgreSQL
  ssl: { 
    rejectUnauthorized: false 
  },
  
  // إعدادات الأداء (Pool)
  max: 20, 
  idleTimeoutMillis: 30000, 
  connectionTimeoutMillis: 5000, 
};

// إنشاء pool للاتصالات
const pool = new Pool(dbConfig);

// معالج أخطاء Pool
pool.on('error', (err, client) => {
  console.error('❌ خطأ مفاجئ في قاعدة البيانات:', err);
  process.exit(-1);
});

// معالج الاتصال الناجح
pool.on('connect', () => {
  console.log('✅ تم إنشاء اتصال جديد بقاعدة البيانات');
});

// دالة تنفيذ الاستعلامات
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    console.error(`❌ فشل الاستعلام: ${error.message}`);
    throw error;
  }
};

// دالة اختبار الاتصال عند بدء التشغيل
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('📊 اختبار الاتصال: ناجح والوقت هو:', result.rows[0].now);
    client.release();
    return true;
  } catch (error) {
    console.error('❌ فشل اختبار الاتصال:', error.message);
    return false;
  }
};

// دالة إغلاق الاتصالات بأمان
const end = async () => {
  await pool.end();
  console.log('✅ تم إغلاق جميع اتصالات قاعدة البيانات');
};

// تصدير الدوال لاستخدامها في server.js والملفات الأخرى
module.exports = {
  query,
  pool,
  testConnection,
  end
};
