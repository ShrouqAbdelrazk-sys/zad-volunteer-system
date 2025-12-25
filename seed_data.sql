-- بيانات أولية لنظام تقييم متطوعي مشروع زاد
-- Initial Data for Zad Volunteer Evaluation System

-- إدراج المستخدم الإداري الافتراضي
-- كلمة المرور: admin123 (مُشفّرة بـ bcrypt)
INSERT INTO users (username, email, password, full_name, role, is_active) 
VALUES (
    'admin', 
    'admin@zad.org', 
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J5dCN6.xq',
    'مدير النظام',
    'admin',
    true
) ON CONFLICT (email) DO NOTHING;

-- إدراج معايير التقييم الأساسية
INSERT INTO evaluation_criteria (name, description, category, weight_percentage, max_score, is_active, display_order) VALUES
-- المعايير الأساسية (60% من التقييم)
('الانضباط في المواعيد', 'الالتزام بمواعيد العمل والحضور في الوقت المحدد', 'basic', 15.00, 100, true, 1),
('جودة العمل المنجز', 'مستوى الإتقان والجودة في تنفيذ المهام المطلوبة', 'basic', 20.00, 100, true, 2),
('التعاون مع الفريق', 'القدرة على العمل ضمن فريق والتفاعل الإيجابي مع الآخرين', 'basic', 15.00, 100, true, 3),
('الالتزام بالقواعد', 'احترام قوانين ولوائح المنظمة والعمل التطوعي', 'basic', 10.00, 100, true, 4),

-- معايير المسؤولية (30% من التقييم)
('تحمل المسؤولية', 'القدرة على تحمل المسؤوليات والمهام الموكلة', 'responsibility', 10.00, 100, true, 5),
('المبادرة والابتكار', 'القدرة على المبادرة واقتراح حلول إبداعية', 'responsibility', 10.00, 100, true, 6),
('التطوير الذاتي', 'السعي لتطوير المهارات والمشاركة في التدريبات', 'responsibility', 10.00, 100, true, 7),

-- معايير المكافآت (10% إضافية)
('إنجازات متميزة', 'تحقيق إنجازات استثنائية تستحق التقدير', 'bonus', 5.00, 100, true, 8),
('القيادة والتوجيه', 'القدرة على قيادة المتطوعين الجدد وتوجيههم', 'bonus', 5.00, 100, true, 9);

-- إدراج متطوعين تجريبيين
INSERT INTO volunteers (full_name, phone, email, volunteer_role_type, start_date, is_active, notes) VALUES
('أحمد محمد علي', '01234567890', 'ahmed@example.com', 'تنسيق الفعاليات', '2024-01-15', true, 'متطوع نشط ومتميز'),
('فاطمة حسن محمود', '01987654321', 'fatima@example.com', 'خدمة المجتمع', '2024-02-01', true, 'تظهر تفانياً كبيراً في العمل'),
('محمد عبدالله سعد', '01555666777', 'mohammed@example.com', 'الدعم اللوجستي', '2024-01-20', true, 'موثوق ومنضبط في المواعيد'),
('نورا أحمد حسين', '01777888999', 'nora@example.com', 'التوعية المجتمعية', '2024-03-01', true, 'مبدعة في التواصل مع الجمهور'),
('يوسف محمد عثمان', '01444333222', 'youssef@example.com', 'إدارة الموارد', '2024-02-15', true, 'يتمتع بمهارات تنظيمية عالية');

-- إدراج تقييمات تجريبية لشهر أكتوبر 2024
DO $$
DECLARE
    volunteer_record RECORD;
    admin_id UUID;
    eval_id UUID;
    criteria_record RECORD;
BEGIN
    -- الحصول على ID المدير
    SELECT id INTO admin_id FROM users WHERE email = 'admin@zad.org';
    
    -- إنشاء تقييم لكل متطوع
    FOR volunteer_record IN SELECT id, full_name FROM volunteers LOOP
        -- إنشاء التقييم الأساسي
        INSERT INTO evaluations (volunteer_id, evaluator_id, evaluation_month, evaluation_year, status, evaluator_notes)
        VALUES (volunteer_record.id, admin_id, 10, 2024, 'approved', 'تقييم تجريبي لشهر أكتوبر 2024')
        RETURNING id INTO eval_id;
        
        -- إضافة درجات للمعايير
        FOR criteria_record IN SELECT id, max_score, category FROM evaluation_criteria WHERE is_active = true LOOP
            INSERT INTO evaluation_details (evaluation_id, criteria_id, score, max_score, notes)
            VALUES (
                eval_id, 
                criteria_record.id, 
                -- درجات عشوائية بين 70-95 للمعايير الأساسية، 60-85 للمسؤولية، 0-80 للمكافآت
                CASE 
                    WHEN criteria_record.category = 'basic' THEN 70 + (random() * 25)::int
                    WHEN criteria_record.category = 'responsibility' THEN 60 + (random() * 25)::int
                    ELSE (random() * 80)::int
                END,
                criteria_record.max_score,
                'درجة تجريبية'
            );
        END LOOP;
        
        -- حساب الدرجة الإجمالية والنسبة المئوية
        UPDATE evaluations SET
            total_score = (
                SELECT SUM(ed.score * (ec.weight_percentage / 100))
                FROM evaluation_details ed
                JOIN evaluation_criteria ec ON ed.criteria_id = ec.id
                WHERE ed.evaluation_id = eval_id
            ),
            max_possible_score = (
                SELECT SUM(ec.max_score * (ec.weight_percentage / 100))
                FROM evaluation_criteria ec
                WHERE ec.is_active = true
            ),
            percentage = (
                SELECT (SUM(ed.score * (ec.weight_percentage / 100)) / 
                       SUM(ec.max_score * (ec.weight_percentage / 100))) * 100
                FROM evaluation_details ed
                JOIN evaluation_criteria ec ON ed.criteria_id = ec.id
                WHERE ed.evaluation_id = eval_id
            )
        WHERE id = eval_id;
    END LOOP;
END $$;

-- إدراج ملاحظات تراكمية تجريبية
INSERT INTO cumulative_notes (volunteer_id, note_type, note_text, is_active) 
SELECT 
    v.id,
    CASE 
        WHEN random() > 0.5 THEN 'strength'
        ELSE 'improvement'
    END,
    CASE 
        WHEN random() > 0.5 THEN 'يظهر التزاماً عالياً في العمل'
        ELSE 'يحتاج لتحسين التواصل مع الفريق'
    END,
    true
FROM volunteers v
LIMIT 3;

-- إدراج تنبيهات تجريبية
INSERT INTO alert_records (volunteer_id, alert_type, severity, message, is_resolved) 
SELECT 
    v.id,
    'improvement_needed',
    'medium',
    'يحتاج المتطوع إلى تحسين في بعض جوانب الأداء',
    false
FROM volunteers v
LIMIT 2;