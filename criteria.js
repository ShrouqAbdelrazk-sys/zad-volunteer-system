const express = require('express');
const db = require('../config/db');

const router = express.Router();

// GET /api/criteria - جلب معايير التقييم
router.get('/', async (req, res) => {
  try {
    const { category = 'all', is_active = 'all' } = req.query;

    let whereClause = '1=1';
    const queryParams = [];

    if (category !== 'all') {
      whereClause += ` AND category = $${queryParams.length + 1}`;
      queryParams.push(category);
    }

    if (is_active !== 'all') {
      whereClause += ` AND is_active = $${queryParams.length + 1}`;
      queryParams.push(is_active === 'true');
    }

    const criteria = await db.query(`
      SELECT * FROM evaluation_criteria 
      WHERE ${whereClause}
      ORDER BY category, display_order, name
    `, queryParams);

    res.json({
      criteria: criteria.rows
    });

  } catch (error) {
    console.error('Get criteria error:', error);
    res.status(500).json({
      message: 'خطأ في جلب معايير التقييم',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;