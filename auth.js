const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('./db'); 
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'zad-secret-key-2025';

// مسار تسجيل الدخول
router.post('/login', [
    body('email').isEmail().withMessage('يرجى إدخال بريد إلكتروني صحيح').normalizeEmail(),
    body('password').notEmpty().withMessage('كلمة المرور مطلوبة')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        // الاستعلام من جدول users
        const result = await db.query(
            'SELECT id, email, password, full_name, username, role FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'البريد الإلكتروني غير مسجل بالنظام' });
        }

        const user = result.rows[0];

        // التحقق من الباسورد نصياً (admin123)
        if (password !== user.password) {
            return res.status(401).json({ message: 'كلمة المرور غير صحيحة' });
        }

        // تحديث آخر ظهور
        try {
            await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
        } catch (e) { console.log('Update last_login skipped - table might not have this column'); }

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // إرسال البيانات كاملة للفرونت إيند
        res.json({
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

    } catch (error) {
        console.error('Detailed Login Error:', error);
        // دي الرسالة اللي هتظهر لك في المتصفح وتعرفنا العيب فين بالظبط
        res.status(500).json({ 
            message: 'خطأ داخلي في الخادم - تأكدي من اتصال الداتابيز', 
            detail: error.message 
        });
    }
});

// مسار Me للتحقق من الجلسة
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ message: 'غير مصرح' });
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const result = await db.query('SELECT id, email, full_name, role FROM users WHERE id = $1', [decoded.userId]);
        
        if (result.rows.length === 0) return res.status(404).json({ message: 'المستخدم غير موجود' });
        res.json({ user: result.rows[0] });
    } catch (error) {
        res.status(401).json({ message: 'انتهت الجلسة' });
    }
});

module.exports = router;
