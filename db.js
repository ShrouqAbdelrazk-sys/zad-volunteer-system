const { Pool } = require('pg');

// إعدادات الاتصال بقاعدة البيانات
const dbConfig = {
  // اتصال Neon PostgreSQL
  connectionString: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL,
  
  // إعدادات إضافية لـ Neon
  ssl: process.env.NODE_ENV === 'production' ? { 
    rejectUnauthorized: false 
  } : false,
  
  // إعدادات Pool للأداء
  max: 20, // الحد الأقصى للاتصالات
  idleTimeoutMillis: 30000, // 30 ثانية timeout
  connectionTimeoutMillis: 2000, // 2 ثانية timeout للاتصال
  
  // إعدادات للبيئات المختلفة
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'zad_volunteer_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
};

// إنشاء pool للاتصالات
const pool = new Pool(dbConfig);

// معالج أخطاء Pool
pool.on('error', (err, client) => {
  console.error('❌ Unexpected error on idle client:', err);
  process.exit(-1);
});

// معالج الاتصال
pool.on('connect', () => {
  console.log('✅ New database connection established');
});

// دالة تنفيذ الاستعلامات
const query = async (text, params) => {
  const start = Date.now();
  
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // طباعة الاستعلام في وضع التطوير فقط
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 Query executed in ${duration}ms:`, { text, params, rows: result.rowCount });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`❌ Query failed in ${duration}ms:`, { text, params, error: error.message });
    throw error;
  }
};

// دالة اختبار الاتصال
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    const dbTime = result.rows[0].current_time;
    const dbVersion = result.rows[0].pg_version;
    
    console.log('📊 Database Info:');
    console.log(`   Time: ${dbTime}`);
    console.log(`   Version: ${dbVersion.split(' ')[0]} ${dbVersion.split(' ')[1]}`);
    
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    return false;
  }
};

// دالة تنفيذ Transaction
const withTransaction = async (callback) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// دالة إغلاق جميع الاتصالات
const end = async () => {
  try {
    await pool.end();
    console.log('✅ Database pool has ended');
  } catch (error) {
    console.error('❌ Error ending database pool:', error);
  }
};

// دالة الحصول على معلومات Pool
const getPoolInfo = () => {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  };
};

// دوال مساعدة للاستعلامات الشائعة
const helpers = {
  // البحث بـ pagination
  async paginate(query, params = [], page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const countQuery = query.replace(/SELECT.*?FROM/i, 'SELECT COUNT(*) FROM');
    
    const [countResult, dataResult] = await Promise.all([
      pool.query(countQuery, params),
      pool.query(`${query} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset])
    ]);
    
    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);
    
    return {
      data: dataResult.rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  },
  
  // البحث بشرط واحد
  async findOne(table, where, params) {
    const query = `SELECT * FROM ${table} WHERE ${where} LIMIT 1`;
    const result = await pool.query(query, params);
    return result.rows[0] || null;
  },
  
  // البحث بشروط متعددة
  async findMany(table, where = '1=1', params = [], orderBy = 'created_at DESC') {
    const query = `SELECT * FROM ${table} WHERE ${where} ORDER BY ${orderBy}`;
    const result = await pool.query(query, params);
    return result.rows;
  },
  
  // إدراج بيانات جديدة
  async insert(table, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    
    const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await pool.query(query, values);
    return result.rows[0];
  },
  
  // تحديث البيانات
  async update(table, data, where, whereParams) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
    
    const query = `UPDATE ${table} SET ${setClause} WHERE ${where} RETURNING *`;
    const result = await pool.query(query, [...values, ...whereParams]);
    return result.rows[0];
  }
};

module.exports = {
  query,
  pool,
  testConnection,
  withTransaction,
  end,
  getPoolInfo,
  helpers
};