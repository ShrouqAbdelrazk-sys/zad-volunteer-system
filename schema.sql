-- إنشاء جداول نظام تقييم متطوعي مشروع زاد
-- Zad Volunteer Evaluation System Database Schema

-- جدول المستخدمين (المديرين والمقيّمين)
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'evaluator' CHECK (role IN ('admin', 'evaluator')),
    permissions TEXT[], -- صلاحيات إضافية
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- جدول المتطوعين
CREATE TABLE IF NOT EXISTS volunteers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    national_id VARCHAR(20) UNIQUE,
    birth_date DATE,
    address TEXT,
    volunteer_role_type VARCHAR(50), -- نوع الدور التطوعي
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- جدول معايير التقييم
CREATE TABLE IF NOT EXISTS evaluation_criteria (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL, -- basic, responsibility, bonus
    weight_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    max_score INTEGER NOT NULL DEFAULT 100,
    applies_to_role VARCHAR(50), -- إذا كان ينطبق على دور معين
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- جدول التقييمات الشهرية
CREATE TABLE IF NOT EXISTS evaluations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    volunteer_id UUID NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
    evaluator_id UUID NOT NULL REFERENCES users(id),
    evaluation_month INTEGER NOT NULL CHECK (evaluation_month BETWEEN 1 AND 12),
    evaluation_year INTEGER NOT NULL CHECK (evaluation_year > 2020),
    total_score DECIMAL(6,2) DEFAULT 0.00,
    max_possible_score DECIMAL(6,2) DEFAULT 0.00,
    percentage DECIMAL(5,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    evaluator_notes TEXT,
    improvement_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(volunteer_id, evaluation_month, evaluation_year)
);

-- جدول تفاصيل التقييم (النقاط لكل معيار)
CREATE TABLE IF NOT EXISTS evaluation_details (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
    criteria_id UUID NOT NULL REFERENCES evaluation_criteria(id),
    score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    max_score INTEGER NOT NULL DEFAULT 100,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(evaluation_id, criteria_id)
);

-- جدول سجلات التجميد
CREATE TABLE IF NOT EXISTS freeze_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    volunteer_id UUID NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
    freeze_reason TEXT NOT NULL,
    freeze_start_date DATE NOT NULL,
    planned_end_date DATE,
    actual_end_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- جدول الملاحظات التراكمية
CREATE TABLE IF NOT EXISTS cumulative_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    volunteer_id UUID NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
    note_type VARCHAR(50) NOT NULL, -- strength, weakness, improvement, achievement
    note_text TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- جدول التنبيهات الذكية
CREATE TABLE IF NOT EXISTS alert_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    volunteer_id UUID REFERENCES volunteers(id) ON DELETE SET NULL,
    alert_type VARCHAR(50) NOT NULL, -- weak_performance, no_interaction, improvement_needed, achievement
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    message TEXT NOT NULL,
    details JSONB, -- تفاصيل إضافية
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES users(id),
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- جدول سجل العمليات (Audit Trail)
CREATE TABLE IF NOT EXISTS audit_trail (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(50),
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    description TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- إنشاء الفهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_volunteers_active ON volunteers(is_active);
CREATE INDEX IF NOT EXISTS idx_volunteers_role ON volunteers(volunteer_role_type);
CREATE INDEX IF NOT EXISTS idx_evaluations_volunteer_id ON evaluations(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_date ON evaluations(evaluation_year, evaluation_month);
CREATE INDEX IF NOT EXISTS idx_evaluations_status ON evaluations(status);
CREATE INDEX IF NOT EXISTS idx_evaluation_details_evaluation_id ON evaluation_details(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_freeze_records_volunteer_id ON freeze_records(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_freeze_records_active ON freeze_records(is_active);
CREATE INDEX IF NOT EXISTS idx_alert_records_volunteer_id ON alert_records(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_alert_records_resolved ON alert_records(is_resolved);
CREATE INDEX IF NOT EXISTS idx_audit_trail_user_id ON audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_created_at ON audit_trail(created_at);

-- دالة تحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- إنشاء Triggers لتحديث updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_volunteers_updated_at BEFORE UPDATE ON volunteers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_evaluation_criteria_updated_at BEFORE UPDATE ON evaluation_criteria
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_evaluations_updated_at BEFORE UPDATE ON evaluations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_freeze_records_updated_at BEFORE UPDATE ON freeze_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cumulative_notes_updated_at BEFORE UPDATE ON cumulative_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_records_updated_at BEFORE UPDATE ON alert_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();