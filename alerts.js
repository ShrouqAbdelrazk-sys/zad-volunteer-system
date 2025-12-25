const express = require('express');
const db = require('../config/db');

const router = express.Router();

// GET /api/alerts - جلب التنبيهات
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'all' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    const queryParams = [];

    if (status !== 'all') {
      whereClause += ` AND a.is_resolved = $${queryParams.length + 1}`;
      queryParams.push(status === 'resolved');
    }

    const alerts = await db.query(`
      SELECT 
        a.*,
        v.full_name as volunteer_name
      FROM alert_records a
      LEFT JOIN volunteers v ON a.volunteer_id = v.id
      WHERE ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `, [...queryParams, limit, offset]);

    const countResult = await db.query(
      `SELECT COUNT(*) FROM alert_records a WHERE ${whereClause}`,
      queryParams
    );

    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    res.json({
      alerts: alerts.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({
      message: 'خطأ في جلب التنبيهات',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;