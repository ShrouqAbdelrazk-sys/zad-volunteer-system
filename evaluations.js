const express = require('express');
const db = require('../config/db');

const router = express.Router();

// GET /api/evaluations - جلب قائمة التقييمات
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'all' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    const queryParams = [];

    if (status !== 'all') {
      whereClause += ` AND e.status = $${queryParams.length + 1}`;
      queryParams.push(status);
    }

    const evaluations = await db.query(`
      SELECT 
        e.*,
        v.full_name as volunteer_name,
        u.full_name as evaluator_name
      FROM evaluations e
      LEFT JOIN volunteers v ON e.volunteer_id = v.id
      LEFT JOIN users u ON e.evaluator_id = u.id
      WHERE ${whereClause}
      ORDER BY e.evaluation_year DESC, e.evaluation_month DESC, e.created_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `, [...queryParams, limit, offset]);

    const countResult = await db.query(
      `SELECT COUNT(*) FROM evaluations e WHERE ${whereClause}`,
      queryParams
    );

    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    res.json({
      evaluations: evaluations.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get evaluations error:', error);
    res.status(500).json({
      message: 'خطأ في جلب التقييمات',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;