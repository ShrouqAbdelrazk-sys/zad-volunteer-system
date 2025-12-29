const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
// السماح لجميع النطاقات بالوصول (CORS)
app.use(cors());
app.use(express.json());

// الاتصال بقاعدة البيانات (Supabase)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // ضروري للاتصال بـ Supabase
});

// --- Helper Functions ---

const calculateRank = (xp) => {
    if (xp >= 1000) return 'ماسي';
    if (xp >= 500) return 'ذهبي';
    if (xp >= 250) return 'فضي';
    if (xp >= 100) return 'برونزي';
    return 'مبتدئ';
};

const analyzeDNA = (scores) => {
    let fieldScore = 0, adminScore = 0;
    scores.forEach(s => {
        if (s.dna_type === 'field') fieldScore += parseFloat(s.score);
        if (s.dna_type === 'admin') adminScore += parseFloat(s.score);
    });
    if (fieldScore > adminScore) return "نمط ميداني خارق ⚡";
    if (adminScore > fieldScore) return "نمط إداري دقيق 📊";
    return "نمط متوازن ⚖️";
};

// --- Routes ---

// 1. المتطوعين
app.get('/api/volunteers', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM volunteers ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/volunteers', async (req, res) => {
    const { full_name, phone, birth_date, join_date, role_type, is_frozen, freeze_reason } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO volunteers (full_name, phone, birth_date, join_date, role_type, is_frozen, freeze_reason) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [full_name, phone, birth_date, join_date, role_type, is_frozen, freeze_reason]
        );
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/volunteers/:id', async (req, res) => {
    const { id } = req.params;
    const { full_name, phone, birth_date, join_date, role_type, is_frozen, freeze_reason } = req.body;
    try {
        const result = await pool.query(
            'UPDATE volunteers SET full_name=$1, phone=$2, birth_date=$3, join_date=$4, role_type=$5, is_frozen=$6, freeze_reason=$7, updated_at=CURRENT_TIMESTAMP WHERE id=$8 RETURNING *',
            [full_name, phone, birth_date, join_date, role_type, is_frozen, freeze_reason, id]
        );
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. المعايير
app.get('/api/criteria', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM evaluation_criteria WHERE is_active = true ORDER BY category');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. التقييمات (مع تحليل DNA والأوسمة والرادار)
app.post('/api/evaluations', async (req, res) => {
    const { volunteer_id, eval_month, eval_year, scores, idea_text } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // حساب المجموع والنسبة
        let totalScore = 0, maxPossible = 0;
        scores.forEach(s => {
            totalScore += parseFloat(s.score);
            if (s.category !== 'bonus') maxPossible += parseFloat(s.max_score);
        });
        const percentage = (maxPossible > 0) ? (totalScore / maxPossible) * 100 : 0;
        
        // تحليل DNA
        const dnaAnalysis = analyzeDNA(scores);
        const hasAward = percentage >= 90;

        // حفظ التقييم
        const evalResult = await client.query(
            'INSERT INTO evaluations (volunteer_id, eval_month, eval_year, total_score, percentage, dna_analysis, has_award) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
            [volunteer_id, eval_month, eval_year, totalScore, percentage, dnaAnalysis, hasAward]
        );
        const evalId = evalResult.rows[0].id;

        // حفظ التفاصيل
        for (const s of scores) {
            await client.query(
                'INSERT INTO evaluation_details (evaluation_id, criteria_id, score) VALUES ($1, $2, $3)',
                [evalId, s.criteria_id, s.score]
            );
        }

        // حفظ الفكرة في الخزنة
        if (idea_text) {
            const volResult = await client.query('SELECT full_name FROM volunteers WHERE id = $1', [volunteer_id]);
            const volName = volResult.rows[0].full_name;
            await client.query(
                'INSERT INTO creative_vault (volunteer_id, idea_text) VALUES ($1, $2)',
                [volunteer_id, idea_text]
            );
        }

        // تحديث النقاط (XP) والرتبة
        const xpGained = Math.floor(percentage / 10);
        await client.query(
            'UPDATE volunteers SET xp_points = xp_points + $1 WHERE id = $2',
            [xpGained, volunteer_id]
        );
        const volUpdate = await client.query('SELECT xp_points FROM volunteers WHERE id = $1', [volunteer_id]);
        const newRank = calculateRank(volUpdate.rows[0].xp_points);
        await client.query('UPDATE volunteers SET rank = $1 WHERE id = $2', [newRank, volunteer_id]);

        // الرادار: إذا قل التقييم عن 75%
        if (percentage < 75) {
            await client.query(
                'INSERT INTO alerts (volunteer_id, alert_type, message) VALUES ($1, $2, $3)',
                [volunteer_id, 'low_performance', `انخفاض أداء المتطوع إلى ${percentage.toFixed(1)}%`]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, percentage, dnaAnalysis, hasAward });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// 4. خزنة الإبداع
app.get('/api/vault', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT cv.*, v.full_name 
            FROM creative_vault cv 
            JOIN volunteers v ON cv.volunteer_id = v.id 
            ORDER BY cv.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 5. الرادار (التنبيهات)
app.get('/api/alerts', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT a.*, v.full_name 
            FROM alerts a 
            JOIN volunteers v ON a.volunteer_id = v.id 
            WHERE a.is_resolved = false 
            ORDER BY a.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
