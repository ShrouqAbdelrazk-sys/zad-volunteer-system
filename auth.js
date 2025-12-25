const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('./db');

const router = express.Router();

// دالة إنشاء JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'default-secret', {
    expiresIn: process.env.JWT_EXPIRE_IN || '7d'
  });
};

// POST /api/auth/login - تسجيل الدخول
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('البريد الإلكتروني غير صالح'),
  body('password').isLength({ min: 6 }).withMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'بيانات غير صالحة', errors: errors.array() });
    }

    const { email, password } = req.body;

    // 1. البحث عن المستخدم
    const user = await db.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (user.rows.length === 0) {
      return res.status(401).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    const userData = user.rows[0];

    // 2. التحقق من كلمة المرور (التعديل الذهبي)
    let isPasswordValid = false;
    // جرب النص العادي أولاً
    if (password === userData.password) {
      isPasswordValid = true;
    } else {
      // لو منفعش جرب التشفير بس جوه حماية عشان السيرفر ميعطلش
      try {
        isPasswordValid = await bcrypt.compare(password, userData.password);
      } catch (e) {
        isPasswordValid = false;
      }
    }

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    // 3. تحديث آخر دخول
    await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [userData.id]);

    const token = generateToken(userData.id);
    const { password: _, ...userWithoutPassword } = userData;

    res.json({
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'خطأ داخلي في الخادم', error: error.message });
  }
});

// POST /api/auth/register - إنشاء حساب جديد
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('full_name').isLength({ min: 2 }),
  body('username').isLength({ min: 3 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'بيانات غير صالحة' });

    const { email, password, full_name, username, role = 'evaluator' } = req.body;
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1 OR username = $2', [email, username]);

    if (existingUser.rows.length > 0) return res.status(400).json({ message: 'المستخدم موجود بالفعل' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = await db.query(`
      INSERT INTO users (email, password, full_name, username, role, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING id, email, full_name, username, role, is_active, created_at
    `, [email, hashedPassword, full_name, username, role]);

    res.status(201).json({ message: 'تم إنشاء الحساب بنجاح', token: generateToken(newUser.rows[0].id), user: newUser.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'خطأ داخلي في الخادم' });
  }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'لم يتم تقديم رمز الوصول' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    const user = await db.query('SELECT id, email, full_name, username, role, is_active FROM users WHERE id = $1', [decoded.userId]);
    res.json({ user: user.rows[0] });
  } catch (error) {
    res.status(401).json({ message: 'رمز الوصول غير صالح' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.json({ message: 'تم تسجيل الخروج بنجاح' });
});

module.exports = router;
