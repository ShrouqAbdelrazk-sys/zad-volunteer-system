const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('./db');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'zad-secret-123';

// تسجيل الدخول
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // استعلام بسيط ومباشر
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'المستخدم غير موجود' });
    }

    const user = result.rows[0];

    // مقارنة مباشرة للباسورد بدون تشفير
    if (password === user.password) {
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
      
      // إرسال كل البيانات اللي الفرونت إيند بيدور عليها
      return res.json({
        message: 'تم تسجيل الدخول بنجاح',
        token,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          username: user.username,
          role: user.role
        }
      });
    }

    return res.status(401).json({ message: 'كلمة المرور خطأ' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'خطأ في السيرفر', error: error.message });
  }
});

// مسار Me عشان لما تعملي Refresh للصفحة متطردكيش بره
router.get('/me', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).send();
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await db.query('SELECT id, email, full_name, username, role FROM users WHERE id = $1', [decoded.userId]);
    
    res.json({ user: result.rows[0] });
  } catch (e) {
    res.status(401).send();
  }
});

module.exports = router;
