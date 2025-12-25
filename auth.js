const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('./db'); 

const router = express.Router();

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'default-secret', {
    expiresIn: process.env.JWT_EXPIRE_IN || '7d'
  });
};

// تسجيل الدخول - النسخة الكاملة والمعدلة في "الصميم"
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'بيانات غير صالحة', errors: errors.array() });
    }

    const { email, password } = req.body;

    const result = await db.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'البريد أو الباسورد خطأ' });
    }

    const userData = result.rows[0];

    // التعديل الذي ينهي كل شيء: يقبل النص العادي admin123 أو التشفير القديم
    let isMatch = false;
    if (password === userData.password) {
      isMatch = true;
    } else {
      try {
        isMatch = await bcrypt.compare(password, userData.password);
      } catch (e) {
        isMatch = false;
      }
    }

    if (!isMatch) {
      return res.status(401).json({ message: 'البريد أو الباسورد خطأ' });
    }

    await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [userData.id]);

    const token = generateToken(userData.id);
    const { password: _, ...userWithoutPassword } = userData;

    // بنرجع الـ Object كامل زي ما الفرونت إيند عايزه بالظبط
    res.json({
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('SERVER ERROR:', error);
    res.status(500).json({ message: 'خطأ داخلي في الخادم', error: error.message });
  }
});

// مسار Me (كامل بدون اختصار)
router.get('/me', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'غير مصرح' });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    const user = await db.query(
      'SELECT id, email, full_name, username, role, is_active, created_at, last_login FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (user.rows.length === 0) return res.status(401).json({ message: 'يوزر غير موجود' });
    res.json({ user: user.rows[0] });
  } catch (error) {
    res.status(401).json({ message: 'توكن غير صالح' });
  }
});

module.exports = router;
