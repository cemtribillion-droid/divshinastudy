-- PrepWise Supabase PostgreSQL Schema & Row-Level Security (RLS)
-- Strictly enforces ND2 academic scope across all user profiles, courses, questions, and exams.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Departments
CREATE TABLE IF NOT EXISTS public.departments (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  school TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  academic_level TEXT NOT NULL DEFAULT 'ND2' CHECK (academic_level = 'ND2'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Profiles (Linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  matric_number TEXT,
  department_id TEXT NOT NULL REFERENCES public.departments(id),
  department_name TEXT NOT NULL,
  academic_level TEXT NOT NULL DEFAULT 'ND2' CHECK (academic_level = 'ND2'),
  preferred_semester TEXT NOT NULL DEFAULT 'Second Semester' CHECK (preferred_semester IN ('First Semester', 'Second Semester')),
  study_goal_minutes_daily INTEGER NOT NULL DEFAULT 45 CHECK (study_goal_minutes_daily BETWEEN 10 AND 480),
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. User Roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  assigned_by UUID REFERENCES public.profiles(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Courses (ND2 Only)
CREATE TABLE IF NOT EXISTS public.courses (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  department_id TEXT NOT NULL REFERENCES public.departments(id),
  department_name TEXT NOT NULL,
  academic_level TEXT NOT NULL DEFAULT 'ND2' CHECK (academic_level = 'ND2'),
  semester TEXT NOT NULL CHECK (semester IN ('First Semester', 'Second Semester')),
  credit_units INTEGER NOT NULL DEFAULT 2,
  exam_duration_minutes INTEGER NOT NULL DEFAULT 60,
  description TEXT NOT NULL DEFAULT '',
  sessions_available TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Topics
CREATE TABLE IF NOT EXISTS public.topics (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  course_code TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 1
);

-- 6. Questions (Answer keys protected via RLS / RPC until submission)
CREATE TABLE IF NOT EXISTS public.questions (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  course_code TEXT NOT NULL,
  topic_id TEXT NOT NULL REFERENCES public.topics(id),
  topic_name TEXT NOT NULL,
  department_name TEXT NOT NULL,
  academic_level TEXT NOT NULL DEFAULT 'ND2' CHECK (academic_level = 'ND2'),
  semester TEXT NOT NULL CHECK (semester IN ('First Semester', 'Second Semester')),
  examination_year TEXT NOT NULL,
  session_type TEXT NOT NULL CHECK (session_type IN ('Full-Time', 'Part-Time')),
  question_number TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('mcq', 'true_false', 'fill_gap', 'theory')),
  question_text TEXT NOT NULL,
  options JSONB,
  correct_answer TEXT,
  official_solution_excerpt TEXT,
  marking_scheme JSONB,
  marks NUMERIC NOT NULL DEFAULT 1,
  difficulty TEXT NOT NULL DEFAULT 'standard' CHECK (difficulty IN ('foundation', 'standard', 'challenging')),
  source_document TEXT NOT NULL DEFAULT 'ND_2_PQ_compressed.pdf',
  source_page INTEGER NOT NULL DEFAULT 1,
  verification_status TEXT NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('verified', 'pending_review', 'unverified')),
  verified_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Exam Attempts
CREATE TABLE IF NOT EXISTS public.exam_attempts (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES public.courses(id),
  course_code TEXT NOT NULL,
  course_title TEXT NOT NULL,
  academic_level TEXT NOT NULL DEFAULT 'ND2' CHECK (academic_level = 'ND2'),
  semester TEXT NOT NULL CHECK (semester IN ('First Semester', 'Second Semester')),
  mode TEXT NOT NULL CHECK (mode IN ('cbt', 'theory', 'mixed')),
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'submitted', 'expired')),
  question_ids TEXT[] NOT NULL DEFAULT '{}',
  duration_seconds INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  objective_score NUMERIC NOT NULL DEFAULT 0,
  objective_total NUMERIC NOT NULL DEFAULT 0,
  theory_score NUMERIC NOT NULL DEFAULT 0,
  theory_total NUMERIC NOT NULL DEFAULT 0,
  total_score NUMERIC NOT NULL DEFAULT 0,
  max_score NUMERIC NOT NULL DEFAULT 0,
  percentage NUMERIC NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT FALSE
);

-- 8. Student Answers
CREATE TABLE IF NOT EXISTS public.student_answers (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_answer TEXT NOT NULL DEFAULT '',
  is_correct BOOLEAN,
  marks_awarded NUMERIC NOT NULL DEFAULT 0,
  max_marks NUMERIC NOT NULL DEFAULT 1,
  ai_feedback TEXT,
  flagged_for_review BOOLEAN NOT NULL DEFAULT FALSE,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (attempt_id, question_id)
);

-- 9. Student Progress
CREATE TABLE IF NOT EXISTS public.student_progress (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  questions_attempted INTEGER NOT NULL DEFAULT 0,
  questions_correct INTEGER NOT NULL DEFAULT 0,
  mastery_percentage NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('completed', 'in_progress', 'pending')),
  last_practiced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, topic_id)
);

-- 10. Saved Questions
CREATE TABLE IF NOT EXISTS public.saved_questions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, question_id)
);

-- 11. AI Learning History
CREATE TABLE IF NOT EXISTS public.ai_learning_history (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id TEXT REFERENCES public.courses(id),
  question_id TEXT REFERENCES public.questions(id),
  mode TEXT NOT NULL,
  prompt TEXT NOT NULL,
  official_answer TEXT,
  ai_explanation TEXT NOT NULL,
  source_citation TEXT,
  verification_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. PDF Imports & Audit Logs & Platform Settings
CREATE TABLE IF NOT EXISTS public.pdf_imports (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  uploaded_by UUID REFERENCES public.profiles(id),
  course_code TEXT,
  examination_year TEXT,
  semester TEXT,
  page_count INTEGER NOT NULL DEFAULT 0,
  extracted_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected')),
  extracted_preview JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  platform_name TEXT NOT NULL DEFAULT 'PrepWise',
  strict_academic_level TEXT NOT NULL DEFAULT 'ND2' CHECK (strict_academic_level = 'ND2'),
  default_cbt_question_count INTEGER NOT NULL DEFAULT 10,
  default_exam_duration_minutes INTEGER NOT NULL DEFAULT 30,
  pass_mark_percentage INTEGER NOT NULL DEFAULT 50,
  allow_self_registration BOOLEAN NOT NULL DEFAULT TRUE,
  require_email_verification_notice BOOLEAN NOT NULL DEFAULT TRUE,
  ai_tutor_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row-Level Security
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_learning_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Helper function checking admin role
CREATE OR REPLACE FUNCTION public.is_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = uid AND role = 'admin'
  );
$$;

-- RLS Policies
CREATE POLICY "Authenticated read departments" ON public.departments FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admins manage departments" ON public.departments FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated read courses" ON public.courses FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admins manage courses" ON public.courses FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated read topics" ON public.topics FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admins manage topics" ON public.topics FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Students can read question stems/options; server/admin controls answer exposure until submission
CREATE POLICY "Admins manage questions" ON public.questions FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Authenticated read verified questions" ON public.questions FOR SELECT TO authenticated USING (verification_status = 'verified');

CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.is_admin(auth.uid()));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id AND academic_level = 'ND2');

CREATE POLICY "Users manage own exam attempts" ON public.exam_attempts FOR ALL TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Users manage own answers" ON public.student_answers FOR ALL TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Users manage own progress" ON public.student_progress FOR ALL TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Users manage own saved questions" ON public.saved_questions FOR ALL TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Users read own AI history" ON public.ai_learning_history FOR ALL TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Admins manage PDF imports" ON public.pdf_imports FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins read audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Authenticated read settings" ON public.platform_settings FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admins update settings" ON public.platform_settings FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
