const express = require('express');
const db = require('./db');

const router = express.Router();

// GET /api/volunteers - جلب قائمة المتطوعين
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = 'all' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    const queryParams = [];

    // البحث بالاسم أو الهاتف
    if (search) {
      whereClause += ` AND (full_name ILIKE $${queryParams.length + 1} OR phone LIKE $${queryParams.length + 1})`;
      queryParams.push(`%${search}%`);
    }

    // تصفية بالحالة
    if (status !== 'all') {
      whereClause += ` AND is_active = $${queryParams.length + 1}`;
      queryParams.push(status === 'active');
    }

    // جلب العدد الإجمالي
    const countResult = await db.query(
      `SELECT COUNT(*) FROM volunteers WHERE ${whereClause}`,
      queryParams
    );

    // جلب البيانات
    const volunteers = await db.query(`
      SELECT 
        v.*,
        (SELECT COUNT(*) FROM evaluations e WHERE e.volunteer_id = v.id) as total_evaluations,
        (SELECT AVG(e.percentage) FROM evaluations e WHERE e.volunteer_id = v.id AND e.status = 'approved') as avg_performance,
        (SELECT COUNT(*) FROM freeze_records fr WHERE fr.volunteer_id = v.id AND fr.is_active = true) as active_freezes
      FROM volunteers v
      WHERE ${whereClause}
      ORDER BY v.created_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `, [...queryParams, limit, offset]);

    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    res.json({
      volunteers: volunteers.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems,
        itemsPerPage: parseInt(limit),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get volunteers error:', error);
    res.status(500).json({
      message: 'خطأ في جلب بيانات المتطوعين',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/volunteers/statistics/overview - إحصائيات المتطوعين
router.get('/statistics/overview', async (req, res) => {
  try {
    // إجمالي المتطوعين
    const totalVolunteers = await db.query('SELECT COUNT(*) FROM volunteers');
    
    // المتطوعين النشطين
    const activeVolunteers = await db.query('SELECT COUNT(*) FROM volunteers WHERE is_active = true');
    
    // متوسط الأداء العام
    const avgPerformance = await db.query(`
      SELECT AVG(percentage) as avg_performance 
      FROM evaluations 
      WHERE status = 'approved'
    `);

    // التقييمات هذا الشهر
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    const monthlyEvaluations = await db.query(`
      SELECT COUNT(*) 
      FROM evaluations 
      WHERE evaluation_month = $1 AND evaluation_year = $2 AND status = 'approved'
    `, [currentMonth, currentYear]);

    const pendingEvaluations = await db.query(`
      SELECT COUNT(*) 
      FROM evaluations 
      WHERE evaluation_month = $1 AND evaluation_year = $2 AND status = 'pending'
    `, [currentMonth, currentYear]);

    // التنبيهات النشطة
    const activeAlerts = await db.query('SELECT COUNT(*) FROM alert_records WHERE is_resolved = false');
    const resolvedAlerts = await db.query('SELECT COUNT(*) FROM alert_records WHERE is_resolved = true');

    res.json({
      totalVolunteers: parseInt(totalVolunteers.rows[0].count),
      activeVolunteers: parseInt(activeVolunteers.rows[0].count),
      avgPerformance: parseFloat(avgPerformance.rows[0].avg_performance || 0).toFixed(2),
      monthlyEvaluations: parseInt(monthlyEvaluations.rows[0].count),
      pendingEvaluations: parseInt(pendingEvaluations.rows[0].count),
      activeAlerts: parseInt(activeAlerts.rows[0].count),
      resolvedAlerts: parseInt(resolvedAlerts.rows[0].count)
    });

  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({
      message: 'خطأ في جلب الإحصائيات',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/volunteers/:id - جلب بيانات متطوع محدد
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const volunteer = await db.query(`
      SELECT 
        v.*,
        (SELECT COUNT(*) FROM evaluations e WHERE e.volunteer_id = v.id) as total_evaluations,
        (SELECT AVG(e.percentage) FROM evaluations e WHERE e.volunteer_id = v.id AND e.status = 'approved') as avg_performance,
        (SELECT COUNT(*) FROM freeze_records fr WHERE fr.volunteer_id = v.id AND fr.is_active = true) as active_freezes
      FROM volunteers v
      WHERE v.id = $1
    `, [id]);

    if (volunteer.rows.length === 0) {
      return res.status(404).json({
        message: 'المتطوع غير موجود'
      });
    }

    // جلب آخر 5 تقييمات
    const recentEvaluations = await db.query(`
      SELECT 
        e.*,
        u.full_name as evaluator_name
      FROM evaluations e
      LEFT JOIN users u ON e.evaluator_id = u.id
      WHERE e.volunteer_id = $1
      ORDER BY e.evaluation_month DESC, e.evaluation_year DESC
      LIMIT 5
    `, [id]);

    res.json({
      volunteer: volunteer.rows[0],
      recent_evaluations: recentEvaluations.rows
    });

  } catch (error) {
    console.error('Get volunteer error:', error);
    res.status(500).json({
      message: 'خطأ في جلب بيانات المتطوع',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
