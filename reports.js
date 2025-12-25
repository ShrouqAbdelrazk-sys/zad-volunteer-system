const express = require('express');
const db = require('./db');

const router = express.Router();

// GET /api/reports/organization - تقرير المنظمة
router.get('/organization', async (req, res) => {
  try {
    // إحصائيات عامة
    const totalVolunteers = await db.query('SELECT COUNT(*) FROM volunteers');
    const activeVolunteers = await db.query('SELECT COUNT(*) FROM volunteers WHERE is_active = true');
    const totalEvaluations = await db.query('SELECT COUNT(*) FROM evaluations WHERE status = \'approved\'');
    const avgPerformance = await db.query('SELECT AVG(percentage) FROM evaluations WHERE status = \'approved\'');

    // أفضل المتطوعين
    const topPerformers = await db.query(`
      SELECT 
        v.full_name,
        AVG(e.percentage) as avg_performance,
        COUNT(e.id) as total_evaluations
      FROM volunteers v
      INNER JOIN evaluations e ON v.id = e.volunteer_id
      WHERE e.status = 'approved'
      GROUP BY v.id, v.full_name
      HAVING COUNT(e.id) >= 3
      ORDER BY AVG(e.percentage) DESC
      LIMIT 10
    `);

    res.json({
      organization_stats: {
        total_volunteers: parseInt(totalVolunteers.rows[0].count),
        active_volunteers: parseInt(activeVolunteers.rows[0].count),
        total_evaluations: parseInt(totalEvaluations.rows[0].count),
        avg_performance: parseFloat(avgPerformance.rows[0].avg || 0).toFixed(2)
      },
      top_performers: topPerformers.rows
    });

  } catch (error) {
    console.error('Organization report error:', error);
    res.status(500).json({
      message: 'خطأ في إنشاء تقرير المنظمة',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
