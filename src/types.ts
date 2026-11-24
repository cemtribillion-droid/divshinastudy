export type AcademicLevel = 'ND2';

export type Semester = 'First Semester' | 'Second Semester';

export type QuestionType = 'mcq' | 'true_false' | 'fill_gap' | 'theory';

export type VerificationStatus = 'verified' | 'pending_review' | 'unverified';

export type UserRoleType = 'student' | 'admin';

export type ExamMode = 'cbt' | 'theory' | 'mixed';

export interface Department {
  id: string;
  code: string;
  name: string;
  school: string;
  description: string;
  academic_level: AcademicLevel;
  created_at: string;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  department_id: string;
  department_name: string;
  academic_level: AcademicLevel;
  semester: Semester;
  credit_units: number;
  exam_duration_minutes: number;
  description: string;
  sessions_available: string[];
  created_at: string;
}

export interface Topic {
  id: string;
  course_id: string;
  course_code: string;
  title: string;
  summary: string;
  order_index: number;
}

export interface QuestionOption {
  label: 'A' | 'B' | 'C' | 'D' | 'E';
  text: string;
}

export interface Question {
  id: string;
  course_id: string;
  course_code: string;
  topic_id: string;
  topic_name: string;
  department_name: string;
  academic_level: AcademicLevel;
  semester: Semester;
  examination_year: string;
  session_type: 'Full-Time' | 'Part-Time';
  question_number: string;
  question_type: QuestionType;
  question_text: string;
  options?: QuestionOption[];
  correct_answer?: string;
  official_solution_excerpt?: string;
  marking_scheme?: string[];
  marks: number;
  difficulty: 'foundation' | 'standard' | 'challenging';
  source_document: string;
  source_page: number;
  verification_status: VerificationStatus;
  verified_by?: string;
  created_at: string;
}

export type QuestionPublic = Omit<
  Question,
  'correct_answer' | 'official_solution_excerpt' | 'marking_scheme' | 'source_document'
>;

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  matric_number?: string;
  department_id: string;
  department_name: string;
  academic_level: AcademicLevel;
  role: UserRoleType;
  preferred_semester: Semester;
  study_goal_minutes_daily: number;
  created_at: string;
  updated_at: string;
}

export interface ExamAttempt {
  id: string;
  user_id: string;
  course_id: string;
  course_code: string;
  course_title: string;
  academic_level: AcademicLevel;
  semester: Semester;
  mode: ExamMode;
  status: 'in_progress' | 'submitted' | 'expired';
  question_ids: string[];
  duration_seconds: number;
  started_at: string;
  expires_at: string;
  submitted_at?: string;
  objective_score: number;
  objective_total: number;
  theory_score: number;
  theory_total: number;
  total_score: number;
  max_score: number;
  percentage: number;
  passed: boolean;
}

export interface StudentAnswer {
  id: string;
  attempt_id: string;
  user_id: string;
  question_id: string;
  selected_answer: string;
  is_correct?: boolean | null;
  marks_awarded: number;
  max_marks: number;
  ai_feedback?: string;
  flagged_for_review: boolean;
  answered_at: string;
}

export interface StudentProgress {
  user_id: string;
  course_id: string;
  topic_id: string;
  questions_attempted: number;
  questions_correct: number;
  mastery_percentage: number;
  status: 'completed' | 'in_progress' | 'pending';
  last_practiced_at: string;
}

export interface SavedQuestion {
  id: string;
  user_id: string;
  question_id: string;
  note?: string;
  created_at: string;
}

export interface AiLearningHistory {
  id: string;
  user_id: string;
  course_id?: string;
  question_id?: string;
  mode: 'explain_question' | 'hint' | 'step_by_step' | 'revision_chat' | 'theory_feedback';
  prompt: string;
  official_answer?: string | null;
  ai_explanation: string;
  source_citation?: string;
  verification_status?: VerificationStatus;
  created_at: string;
}

export interface PdfImportRecord {
  id: string;
  filename: string;
  uploaded_by: string;
  course_code?: string;
  examination_year?: string;
  semester?: Semester;
  page_count: number;
  extracted_count: number;
  status: 'pending_review' | 'approved' | 'rejected';
  extracted_preview: Array<{
    temp_id: string;
    question_type: QuestionType;
    question_text: string;
    options?: QuestionOption[];
    proposed_answer?: string;
    source_page: number;
    approved: boolean;
  }>;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  actor_email: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  created_at: string;
}

export interface PlatformSettings {
  platform_name: string;
  strict_academic_level: AcademicLevel;
  default_cbt_question_count: number;
  default_exam_duration_minutes: number;
  pass_mark_percentage: number;
  allow_self_registration: boolean;
  ai_tutor_enabled: boolean;
  updated_at: string;
}

export interface CurriculumLesson {
  id: string;
  title: string;
  contentMarkdown: string;
  estimatedMinutes: number;
  learningObjectives: string[];
  workedExample: string | null;
  practiceActivity?: {
    task?: string;
    instructions?: string;
  };
  quiz: unknown[];
}

export interface CurriculumModule {
  id: string;
  title: string;
  description: string;
  lessons: CurriculumLesson[];
}

export interface CurriculumCourseAttachment {
  code: string;
  title: string;
  description: string;
  modules: CurriculumModule[];
  outcomes: unknown[];
  prerequisites: unknown[];
}

