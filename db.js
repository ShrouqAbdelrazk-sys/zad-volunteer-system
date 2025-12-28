const { Pool } = require('pg');

// إعدادات الاتصال المحدثة لتناسب الداتابيز الجديدة و Koyeb
const dbConfig = {
  // سحب الرابط من DATABASE_URL المعرف في Koyeb
  connectionString: process.env.DATABASE_URL,
  
  // إعدادات الـ SSL لضمان نجاح الاتصال مع Supabase أو أي مزود آخر
  ssl: { 
    rejectUnauthorized: false 
  },
  
  // إعدادات Pool للأداء والاستقرار
  max: 20, 
  idleTimeoutMillis: 30000, 
  connectionTimeoutMillis: 5000, 
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
    const result = await client.query('SELECT NOW()');
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

// دوال مساعدة (Helpers) للاستعلامات الشائعة التي كانت في ملفك الأصلي
const helpers = {
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
      pagination: { currentPage: page, totalPages, totalItems, itemsPerPage: limit }
    };
  },
  
  async findOne(table, where, params) {
    const query = `SELECT * FROM ${table} WHERE ${where} LIMIT 1`;
    const result = await pool.query(query, params);
    return result.rows[0] || null;
  },
  
  async insert(table, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await pool.query(query, values);
    return result.rows[0];
  },

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
  helpers
};
