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
    // التحقق من صحة البيانات
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'بيانات غير صالحة',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // البحث عن المستخدم
    const user = await db.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (user.rows.length === 0) {
      return res.status(401).json({
        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      });
    }

    const userData = user.rows[0];

    // التحقق من كلمة المرور
    const isPasswordValid = await bcrypt.compare(password, userData.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      });
    }

    // تحديث آخر دخول
    await db.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [userData.id]
    );

    // إنشاء Token
    const token = generateToken(userData.id);

    // إرجاع بيانات المستخدم (بدون كلمة المرور)
    const { password: _, ...userWithoutPassword } = userData;

    res.json({
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      message: 'خطأ داخلي في الخادم',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/auth/register - إنشاء حساب جديد
router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('البريد الإلكتروني غير صالح'),
  body('password').isLength({ min: 6 }).withMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  body('full_name').isLength({ min: 2 }).withMessage('الاسم يجب أن يكون حرفين على الأقل'),
  body('username').isLength({ min: 3 }).withMessage('اسم المستخدم يجب أن يكون 3 أحرف على الأقل')
], async (req, res) => {
  try {
    // التحقق من صحة البيانات
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'بيانات غير صالحة',
        errors: errors.array()
      });
    }

    const { email, password, full_name, username, role = 'evaluator' } = req.body;

    // التحقق من عدم وجود مستخدم بنفس البريد أو اسم المستخدم
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        message: 'البريد الإلكتروني أو اسم المستخدم مستخدم بالفعل'
      });
    }

    // تشفير كلمة المرور
    const hashedPassword = await bcrypt.hash(password, 12);

    // إنشاء المستخدم الجديد
    const newUser = await db.query(`
      INSERT INTO users (email, password, full_name, username, role, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING id, email, full_name, username, role, is_active, created_at
    `, [email, hashedPassword, full_name, username, role]);

    const userData = newUser.rows[0];

    // إنشاء Token
    const token = generateToken(userData.id);

    res.status(201).json({
      message: 'تم إنشاء الحساب بنجاح',
      token,
      user: userData
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      message: 'خطأ داخلي في الخادم',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/auth/me - الحصول على بيانات المستخدم الحالي
router.get('/me', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        message: 'لم يتم تقديم رمز الوصول'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    const user = await db.query(
      'SELECT id, email, full_name, username, role, is_active, created_at, last_login FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (user.rows.length === 0) {
      return res.status(401).json({
        message: 'رمز الوصول غير صالح'
      });
    }

    res.json({
      user: user.rows[0]
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({
      message: 'رمز الوصول غير صالح'
    });
  }
});

// POST /api/auth/logout - تسجيل الخروج
router.post('/logout', (req, res) => {
  res.json({
    message: 'تم تسجيل الخروج بنجاح'
  });
});

module.exports = router;
