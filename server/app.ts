import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import {
  readDb,
  recordAuditLog,
  stripSensitiveUserFields,
  writeDb,
  type StoredUserRecord,
} from './db';
import { generateGroundedTutorResponse } from './gemini';
import { CURRICULUM_BY_CODE } from '../src/data/curriculumAttachments';
import {
  assertND2Level,
  containsDisallowedAcademicLevel,
  normalizeSemester,
} from '../src/utils/academicScope';
import {
  computeAttemptSummary,
  computeRemainingSeconds,
  evaluateTheoryKeywords,
  gradeObjectiveAnswer,
} from '../src/utils/examEngine';
import {
  buildRecommendedItems,
  computeDashboardProgress,
  computePerformanceSeries,
  computeTopicWeaknesses,
} from '../src/utils/analytics';
import { detectPdfMetadata, extractQuestionDraftsFromText } from '../src/utils/pdfParser';
import type {
  Course,
  ExamAttempt,
  ExamMode,
  Question,
  QuestionPublic,
  StudentAnswer,
  UserProfile,
} from '../src/types';

const SESSION_COOKIE = 'prepwise_session';
const fallbackSessionSecret = crypto.randomBytes(32).toString('hex');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

interface SessionUserClaims {
  uid: string;
  email: string;
  full_name: string;
  role: 'student' | 'admin';
  department_id: string;
  department_name: string;
  academic_level: 'ND2';
  preferred_semester: 'First Semester' | 'Second Semester';
  study_goal_minutes_daily: number;
  iat: number;
}

function getSessionSecret(): string {
  if (process.env.AUTH_SESSION_SECRET && process.env.AUTH_SESSION_SECRET.length >= 16) {
    return process.env.AUTH_SESSION_SECRET;
  }
  try {
    const db = readDb();
    if (db.auth_secret && db.auth_secret.length >= 32) {
      return db.auth_secret;
    }
    const generated = crypto.randomBytes(32).toString('hex');
    db.auth_secret = generated;
    writeDb(db);
    return generated;
  } catch {
    return fallbackSessionSecret;
  }
}

function signSessionToken(user: StoredUserRecord): string {
  const claims: SessionUserClaims = {
    uid: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    department_id: user.department_id,
    department_name: user.department_name,
    academic_level: 'ND2',
    preferred_semester: user.preferred_semester,
    study_goal_minutes_daily: user.study_goal_minutes_daily,
    iat: Date.now(),
  };
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionToken(token: string | undefined): SessionUserClaims | null {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<SessionUserClaims>;
    if (!parsed.uid) return null;
    // 7 day session expiry
    if (parsed.iat && Date.now() - parsed.iat > 7 * 24 * 60 * 60 * 1000) return null;
    return {
      uid: parsed.uid,
      email: parsed.email || '',
      full_name: parsed.full_name || 'User',
      role: parsed.role === 'admin' ? 'admin' : 'student',
      department_id: parsed.department_id || 'dept-com',
      department_name: parsed.department_name || 'Computer Technology',
      academic_level: 'ND2',
      preferred_semester: parsed.preferred_semester === 'First Semester' ? 'First Semester' : 'Second Semester',
      study_goal_minutes_daily: typeof parsed.study_goal_minutes_daily === 'number' ? parsed.study_goal_minutes_daily : 45,
      iat: parsed.iat || Date.now(),
    };
  } catch {
    return null;
  }
}

function isBootstrapAdminEmail(email: string): boolean {
  const raw = process.env.ADMIN_BOOTSTRAP_EMAILS || '';
  if (!raw.trim()) return false;
  const normalized = email.trim().toLowerCase();
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}

function isEnvAdminConfigured(): boolean {
  const envEmail = process.env.ADMIN_EMAIL?.trim();
  const envPass = process.env.ADMIN_PASSWORD;
  return Boolean(envEmail && envPass && envPass.length >= 8);
}

function verifyEnvAdminCredentials(email: string, password: string): boolean {
  const envEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const envPass = process.env.ADMIN_PASSWORD;
  if (!envEmail || !envPass || envPass.length < 8) return false;
  if (email.trim().toLowerCase() !== envEmail) return false;
  const providedHash = crypto.createHash('sha256').update(password, 'utf8').digest();
  const expectedHash = crypto.createHash('sha256').update(envPass, 'utf8').digest();
  return crypto.timingSafeEqual(providedHash, expectedHash);
}

function toPublicQuestion(q: Question): QuestionPublic {
  const {
    correct_answer: _ca,
    official_solution_excerpt: _ose,
    marking_scheme: _ms,
    source_document: _sd,
    ...rest
  } = q;
  return rest;
}

interface AuthedRequest extends Request {
  authUser?: StoredUserRecord;
}

function isHttpsRequest(req: Request): boolean {
  const xfProto = req.headers['x-forwarded-proto'];
  if (typeof xfProto === 'string' && xfProto.toLowerCase().includes('https')) return true;
  if (req.secure) return true;
  if (process.env.NETLIFY && process.env.URL?.startsWith('https://')) return true;
  return Boolean(process.env.APP_URL && process.env.APP_URL.startsWith('https://'));
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  const secure = isHttpsRequest(req);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: secure ? 'none' : 'lax',
    secure,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function getAuthenticatedUser(req: Request): StoredUserRecord | null {
  const authHeader = req.headers.authorization;
  const bearerToken =
    typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : undefined;
  const cookieToken = req.cookies?.[SESSION_COOKIE] as string | undefined;
  const claims = verifySessionToken(bearerToken) || verifySessionToken(cookieToken);
  if (!claims) return null;
  const db = readDb();
  const existing = db.users.find((u) => u.id === claims.uid);
  if (existing) {
    if (isBootstrapAdminEmail(existing.email) && existing.role !== 'admin') {
      existing.role = 'admin';
      writeDb(db);
    }
    return existing;
  }
  if (!claims.email) return null;
  const now = new Date().toISOString();
  const hydrated: StoredUserRecord = {
    id: claims.uid,
    full_name: claims.full_name,
    email: claims.email,
    department_id: claims.department_id,
    department_name: claims.department_name,
    academic_level: 'ND2',
    role: isBootstrapAdminEmail(claims.email) ? 'admin' : claims.role,
    preferred_semester: claims.preferred_semester,
    study_goal_minutes_daily: claims.study_goal_minutes_daily,
    password_hash: '',
    created_at: now,
    updated_at: now,
  };
  return hydrated;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Please sign in to access your study workspace.' });
    return;
  }
  req.authUser = user;
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Please sign in to access the admin console.' });
    return;
  }
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Administrator privileges are required for this action.' });
    return;
  }
  req.authUser = user;
  next();
}

function finalizeAttemptIfExpired(attempt: ExamAttempt, db: ReturnType<typeof readDb>): ExamAttempt {
  if (attempt.status !== 'in_progress') return attempt;
  const remaining = computeRemainingSeconds(attempt.expires_at);
  if (remaining > 0) return attempt;

  const questions = attempt.question_ids
    .map((qid) => db.questions.find((q) => q.id === qid))
    .filter((q): q is Question => Boolean(q));
  const answers = db.student_answers.filter((a) => a.attempt_id === attempt.id);
  const summary = computeAttemptSummary(questions, answers, db.platform_settings.pass_mark_percentage);

  attempt.status = 'expired';
  attempt.submitted_at = attempt.expires_at;
  attempt.objective_score = summary.objectiveScore;
  attempt.objective_total = summary.objectiveTotal;
  attempt.theory_score = summary.theoryScore;
  attempt.theory_total = summary.theoryTotal;
  attempt.total_score = summary.totalScore;
  attempt.max_score = summary.maxScore;
  attempt.percentage = summary.percentage;
  attempt.passed = summary.passed;
  writeDb(db);
  return attempt;
}

function updateStudentTopicProgress(
  db: ReturnType<typeof readDb>,
  userId: string,
  question: Question,
  isCorrect: boolean
): void {
  let rec = db.student_progress.find((p) => p.user_id === userId && p.topic_id === question.topic_id);
  if (!rec) {
    rec = {
      user_id: userId,
      course_id: question.course_id,
      topic_id: question.topic_id,
      questions_attempted: 0,
      questions_correct: 0,
      mastery_percentage: 0,
      status: 'pending',
      last_practiced_at: new Date().toISOString(),
    };
    db.student_progress.push(rec);
  }
  rec.questions_attempted += 1;
  if (isCorrect) rec.questions_correct += 1;
  rec.mastery_percentage = Math.round((rec.questions_correct / rec.questions_attempted) * 100);
  rec.status = rec.mastery_percentage >= 75 && rec.questions_attempted >= 2 ? 'completed' : 'in_progress';
  rec.last_practiced_at = new Date().toISOString();
}

export function createExpressApp(): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '5mb' }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    if (
      req.method !== 'GET' &&
      req.method !== 'HEAD' &&
      req.method !== 'OPTIONS' &&
      !req.headers.authorization &&
      req.cookies?.[SESSION_COOKIE] &&
      req.headers.origin
    ) {
      const requestHost = (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host;
      try {
        const originHost = new URL(req.headers.origin).host;
        if (requestHost && originHost !== requestHost.split(',')[0].trim()) {
          res.status(403).json({ error: 'Cross-origin state-changing request rejected.' });
          return;
        }
      } catch {
        res.status(403).json({ error: 'Invalid request origin.' });
        return;
      }
    }
    next();
  });

  // Health Check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'Divshinastudy API', academic_level: 'ND2' });
  });

  // ================= PUBLIC CATALOG (NO QUESTION ANSWERS OR DEMO LOGINS) =================
  app.get('/api/public/catalog', (_req, res) => {
    const db = readDb();
    res.json({
      platform_name: db.platform_settings.platform_name,
      strict_academic_level: 'ND2',
      allow_self_registration: db.platform_settings.allow_self_registration,
      departments: db.departments,
      courses: db.courses.map((c) => ({
        id: c.id,
        code: c.code,
        title: c.title,
        department_id: c.department_id,
        department_name: c.department_name,
        academic_level: c.academic_level,
        semester: c.semester,
        credit_units: c.credit_units,
        sessions_available: c.sessions_available,
        question_count: db.questions.filter((q) => q.course_id === c.id).length,
      })),
    });
  });

  // ================= AUTHENTICATION (INDIVIDUAL ACCOUNTS ONLY) =================
  app.post('/api/auth/register', async (req, res) => {
    try {
      if (getAuthenticatedUser(req)) {
        res.status(409).json({ error: 'You are already signed in. Please sign out before registering another account.' });
        return;
      }

      const db = readDb();
      if (!db.platform_settings.allow_self_registration) {
        res.status(403).json({ error: 'Self-registration is currently disabled by the administrator.' });
        return;
      }

      const {
        full_name,
        email,
        password,
        department_id,
        matric_number,
        preferred_semester,
        academic_level,
      } = req.body as Record<string, unknown>;

      if (academic_level !== undefined && academic_level !== null && academic_level !== '') {
        assertND2Level(academic_level);
      }
      if (typeof full_name !== 'string' || full_name.trim().length < 2) {
        res.status(400).json({ error: 'Please enter your full name (at least 2 characters).' });
        return;
      }
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        res.status(400).json({ error: 'Please enter a valid email address.' });
        return;
      }
      if (typeof password !== 'string' || password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters long.' });
        return;
      }

      const dept = db.departments.find((d) => d.id === department_id || d.code === department_id) || db.departments[0];
      const normalizedEmail = email.trim().toLowerCase();
      if (db.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
        res.status(409).json({ error: 'An account with this email address already exists.' });
        return;
      }

      const semester = preferred_semester ? normalizeSemester(preferred_semester) : 'Second Semester';
      const password_hash = await bcrypt.hash(password, 10);
      const assignedRole = isBootstrapAdminEmail(normalizedEmail) ? 'admin' : 'student';

      const now = new Date().toISOString();
      const newUser: StoredUserRecord = {
        id: `usr-${crypto.randomUUID()}`,
        full_name: full_name.trim(),
        email: normalizedEmail,
        matric_number: typeof matric_number === 'string' && matric_number.trim() ? matric_number.trim() : undefined,
        department_id: dept.id,
        department_name: dept.name,
        academic_level: 'ND2',
        role: assignedRole,
        preferred_semester: semester,
        study_goal_minutes_daily: 45,
        password_hash,
        created_at: now,
        updated_at: now,
      };

      db.users.push(newUser);
      recordAuditLog(db, { id: newUser.id, email: newUser.email }, 'USER_REGISTERED', 'profile', newUser.id, `Registered ND2 account (${dept.name})`);
      writeDb(db);

      const sessionToken = signSessionToken(newUser);
      setSessionCookie(req, res, sessionToken);

      res.status(201).json({
        user: stripSensitiveUserFields(newUser),
        session_token: sessionToken,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Registration failed.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      if (getAuthenticatedUser(req)) {
        res.status(409).json({ error: 'You are already signed in. Please sign out before signing into another account.' });
        return;
      }

      const { email, password, admin_only } = req.body as {
        email?: string;
        password?: string;
        admin_only?: boolean;
      };
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required.' });
        return;
      }

      const db = readDb();
      const normalizedEmail = email.trim().toLowerCase();
      let user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);

      if (verifyEnvAdminCredentials(normalizedEmail, password)) {
        if (!user) {
          const defaultDept = db.departments[0] ?? { id: 'dept-com', name: 'Computer Technology' };
          const now = new Date().toISOString();
          user = {
            id: `adm-env-${crypto.createHash('sha256').update(normalizedEmail).digest('hex').slice(0, 12)}`,
            full_name: process.env.ADMIN_FULL_NAME?.trim() || 'Divshinastudy Administrator',
            email: normalizedEmail,
            department_id: defaultDept.id,
            department_name: defaultDept.name,
            academic_level: 'ND2',
            role: 'admin',
            preferred_semester: 'Second Semester',
            study_goal_minutes_daily: 45,
            password_hash: await bcrypt.hash(password, 10),
            created_at: now,
            updated_at: now,
          };
          db.users.push(user);
          writeDb(db);
        } else if (user.role !== 'admin') {
          user.role = 'admin';
          user.updated_at = new Date().toISOString();
          writeDb(db);
        }
      } else {
        if (!user || !user.password_hash) {
          res.status(401).json({ error: 'Invalid email or password.' });
          return;
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
          res.status(401).json({ error: 'Invalid email or password.' });
          return;
        }

        if (isBootstrapAdminEmail(normalizedEmail) && user.role !== 'admin') {
          user.role = 'admin';
          user.updated_at = new Date().toISOString();
          writeDb(db);
        }
      }

      if (admin_only && user.role !== 'admin') {
        res.status(403).json({ error: 'This portal is restricted to verified Divshinastudy administrators.' });
        return;
      }

      const sessionToken = signSessionToken(user);
      setSessionCookie(req, res, sessionToken);

      res.json({ user: stripSensitiveUserFields(user), session_token: sessionToken });
    } catch {
      res.status(500).json({ error: 'Unable to sign in right now.' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    const secure = isHttpsRequest(req);
    res.clearCookie(SESSION_COOKIE, { path: '/', sameSite: secure ? 'none' : 'lax', secure });
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.json({ authenticated: false, user: null });
      return;
    }
    res.json({ authenticated: true, user: stripSensitiveUserFields(user) });
  });



  app.patch('/api/auth/profile', requireAuth, (req: AuthedRequest, res) => {
    try {
      const db = readDb();
      const user = db.users.find((u) => u.id === req.authUser!.id);
      if (!user) {
        res.status(404).json({ error: 'Account not found.' });
        return;
      }
      const { full_name, department_id, matric_number, preferred_semester, study_goal_minutes_daily, academic_level } =
        req.body as Record<string, unknown>;

      if (academic_level !== undefined && academic_level !== null && academic_level !== '') {
        assertND2Level(academic_level);
      }
      if (typeof full_name === 'string' && full_name.trim().length >= 2) {
        user.full_name = full_name.trim();
      }
      if (typeof department_id === 'string') {
        const dept = db.departments.find((d) => d.id === department_id);
        if (dept) {
          user.department_id = dept.id;
          user.department_name = dept.name;
        }
      }
      if (typeof matric_number === 'string') {
        user.matric_number = matric_number.trim() || undefined;
      }
      if (preferred_semester) {
        user.preferred_semester = normalizeSemester(preferred_semester);
      }
      if (typeof study_goal_minutes_daily === 'number' && study_goal_minutes_daily >= 10 && study_goal_minutes_daily <= 480) {
        user.study_goal_minutes_daily = Math.round(study_goal_minutes_daily);
      }
      user.academic_level = 'ND2';
      user.updated_at = new Date().toISOString();
      writeDb(db);
      res.json({ user: stripSensitiveUserFields(user) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to update profile.' });
    }
  });

  // ================= STUDENT DASHBOARD & ANALYTICS =================
  app.get('/api/dashboard', requireAuth, (req: AuthedRequest, res) => {
    const db = readDb();
    const userId = req.authUser!.id;

    // Finalize any expired attempts for this user first
    db.exam_attempts
      .filter((a) => a.user_id === userId && a.status === 'in_progress')
      .forEach((a) => finalizeAttemptIfExpired(a, db));

    const userProgress = db.student_progress.filter((p) => p.user_id === userId);
    const userAttempts = db.exam_attempts.filter((a) => a.user_id === userId);
    const saved = db.saved_questions.filter((s) => s.user_id === userId);

    const progressSummary = computeDashboardProgress(db.topics, userProgress);
    const performanceSeries = computePerformanceSeries(userAttempts);
    const topicWeaknesses = computeTopicWeaknesses(db.courses, db.topics, userProgress);
    const recommendedItems = buildRecommendedItems(
      db.courses,
      db.topics,
      db.questions,
      userProgress,
      req.authUser!.department_id
    );

    const notifications: Array<{ id: string; title: string; detail: string; actionUrl: string }> = [];
    const activeAttempt = userAttempts.find((a) => a.status === 'in_progress');
    if (activeAttempt) {
      notifications.push({
        id: 'notif-active-exam',
        title: `Resume ${activeAttempt.course_code} examination`,
        detail: 'You have an in-progress timed examination waiting.',
        actionUrl: activeAttempt.mode === 'theory' ? `/exams/theory/${activeAttempt.id}` : `/exams/cbt/${activeAttempt.id}`,
      });
    }
    const weakTopic = topicWeaknesses.find((w) => w.attempted > 0 && w.masteryPercentage < 65);
    if (weakTopic) {
      notifications.push({
        id: 'notif-weak-topic',
        title: `Revision needed in ${weakTopic.courseCode}`,
        detail: `${weakTopic.topicName} mastery is ${weakTopic.masteryPercentage}%.`,
        actionUrl: `/ai-tutor?course=${encodeURIComponent(weakTopic.courseCode)}&topic=${encodeURIComponent(weakTopic.topicId)}`,
      });
    }

    res.json({
      progress: progressSummary,
      performanceSeries,
      topicWeaknesses,
      recommendedItems,
      recentAttempts: userAttempts
        .slice()
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
        .slice(0, 6),
      savedCount: saved.length,
      aiSessionsCount: db.ai_learning_history.filter((h) => h.user_id === userId).length,
      notifications,
    });
  });

  // ================= COURSES & QUESTION BANK =================
  app.get('/api/courses', requireAuth, (req: AuthedRequest, res) => {
    const db = readDb();
    const userId = req.authUser!.id;
    const semesterFilter = req.query.semester as string | undefined;
    const deptFilter = req.query.department as string | undefined;

    const courses = db.courses
      .filter((c) => (!semesterFilter || semesterFilter === 'all' ? true : c.semester === semesterFilter))
      .filter((c) => (!deptFilter || deptFilter === 'all' ? true : c.department_id === deptFilter))
      .map((course) => {
        const courseTopics = db.topics.filter((t) => t.course_id === course.id);
        const courseQuestions = db.questions.filter((q) => q.course_id === course.id);
        const userTopicProgress = db.student_progress.filter(
          (p) => p.user_id === userId && p.course_id === course.id
        );
        const mastery =
          courseTopics.length > 0
            ? Math.round(
                userTopicProgress.reduce((acc, p) => acc + p.mastery_percentage, 0) / courseTopics.length
              )
            : 0;
        const curriculum = CURRICULUM_BY_CODE[course.code.toUpperCase()];
        return {
          ...course,
          topic_count: courseTopics.length,
          module_count: curriculum?.modules.length ?? 0,
          question_count: courseQuestions.length,
          objective_count: courseQuestions.filter((q) => q.question_type !== 'theory').length,
          theory_count: courseQuestions.filter((q) => q.question_type === 'theory').length,
          mastery_percentage: mastery,
        };
      });

    res.json({ departments: db.departments, courses });
  });

  app.get('/api/courses/:code', requireAuth, (req: AuthedRequest, res) => {
    const db = readDb();
    const codeParam = decodeURIComponent(req.params.code).toLowerCase();
    const course = db.courses.find(
      (c) => c.code.toLowerCase() === codeParam || c.id.toLowerCase() === codeParam
    );
    if (!course) {
      res.status(404).json({ error: 'ND2 course not found.' });
      return;
    }

    const userId = req.authUser!.id;
    const topics = db.topics
      .filter((t) => t.course_id === course.id)
      .sort((a, b) => a.order_index - b.order_index)
      .map((t) => {
        const prog = db.student_progress.find((p) => p.user_id === userId && p.topic_id === t.id);
        return {
          ...t,
          mastery_percentage: prog?.mastery_percentage ?? 0,
          questions_attempted: prog?.questions_attempted ?? 0,
          status: prog?.status ?? 'pending',
          question_count: db.questions.filter((q) => q.topic_id === t.id).length,
        };
      });

    const questions = db.questions
      .filter((q) => q.course_id === course.id)
      .map((q) => toPublicQuestion(q));

    const curriculum = CURRICULUM_BY_CODE[course.code.toUpperCase()];
    res.json({
      course,
      topics,
      questions,
      modules: curriculum?.modules ?? [],
    });
  });

  app.get('/api/questions', requireAuth, (req: AuthedRequest, res) => {
    const db = readDb();
    const { course, semester, year, type, topic, q } = req.query as Record<string, string | undefined>;
    const savedIds = new Set(
      db.saved_questions.filter((s) => s.user_id === req.authUser!.id).map((s) => s.question_id)
    );

    const filtered = db.questions
      .filter((item) => (!course || course === 'all' ? true : item.course_code === course || item.course_id === course))
      .filter((item) => (!semester || semester === 'all' ? true : item.semester === semester))
      .filter((item) => (!year || year === 'all' ? true : item.examination_year === year))
      .filter((item) => (!type || type === 'all' ? true : item.question_type === type))
      .filter((item) => (!topic || topic === 'all' ? true : item.topic_id === topic))
      .filter((item) => {
        if (!q || !q.trim()) return true;
        const term = q.trim().toLowerCase();
        return (
          item.question_text.toLowerCase().includes(term) ||
          item.course_code.toLowerCase().includes(term) ||
          item.topic_name.toLowerCase().includes(term) ||
          item.examination_year.toLowerCase().includes(term)
        );
      })
      .map((item) => ({
        ...toPublicQuestion(item),
        is_saved: savedIds.has(item.id),
      }));

    res.json({
      questions: filtered,
      years: Array.from(new Set(db.questions.map((x) => x.examination_year))).sort().reverse(),
      courses: db.courses,
      topics: db.topics,
    });
  });

  // Practice-mode answer verification & worked solution reveal (not allowed during active CBT exam)
  app.post('/api/questions/:id/check', requireAuth, (req: AuthedRequest, res) => {
    const db = readDb();
    const question = db.questions.find((q) => q.id === req.params.id);
    if (!question) {
      res.status(404).json({ error: 'Question not found.' });
      return;
    }

    const selected = typeof req.body?.selected_answer === 'string' ? req.body.selected_answer : '';
    const revealOnly = Boolean(req.body?.reveal_only);

    let isCorrect: boolean | null = null;
    let marksAwarded = 0;

    if (!revealOnly) {
      if (question.question_type === 'theory') {
        const evalRes = evaluateTheoryKeywords(question, selected);
        marksAwarded = evalRes.marksAwarded;
        isCorrect = evalRes.marksAwarded >= evalRes.maxMarks * 0.5;
        updateStudentTopicProgress(db, req.authUser!.id, question, Boolean(isCorrect));
      } else {
        const graded = gradeObjectiveAnswer(question, selected);
        isCorrect = graded.isCorrect;
        marksAwarded = graded.marksAwarded;
        if (isCorrect !== null) {
          updateStudentTopicProgress(db, req.authUser!.id, question, isCorrect);
        }
      }
      writeDb(db);
    }

    res.json({
      question_id: question.id,
      is_correct: isCorrect,
      marks_awarded: marksAwarded,
      max_marks: question.marks,
      correct_answer: question.correct_answer ?? null,
      official_solution_excerpt: question.official_solution_excerpt ?? null,
      marking_scheme: question.marking_scheme ?? [],
      verification_status: question.verification_status,
      source_citation: `${question.course_code} · ${question.topic_name}`,
    });
  });

  // ================= SAVED / BOOKMARKED QUESTIONS =================
  app.get('/api/saved-questions', requireAuth, (req: AuthedRequest, res) => {
    const db = readDb();
    const saved = db.saved_questions
      .filter((s) => s.user_id === req.authUser!.id)
      .map((s) => {
        const q = db.questions.find((item) => item.id === s.question_id);
        return q
          ? {
              ...s,
              question: toPublicQuestion(q),
            }
          : null;
      })
      .filter(Boolean);
    res.json({ saved });
  });

  app.post('/api/saved-questions', requireAuth, (req: AuthedRequest, res) => {
    const { question_id, note } = req.body as { question_id?: string; note?: string };
    if (!question_id) {
      res.status(400).json({ error: 'question_id is required.' });
      return;
    }
    const db = readDb();
    const exists = db.questions.some((q) => q.id === question_id);
    if (!exists) {
      res.status(404).json({ error: 'Question not found.' });
      return;
    }
    const existing = db.saved_questions.find(
      (s) => s.user_id === req.authUser!.id && s.question_id === question_id
    );
    if (existing) {
      if (typeof note === 'string') existing.note = note.trim();
      writeDb(db);
      res.json({ saved: existing });
      return;
    }
    const record = {
      id: `sav-${crypto.randomUUID()}`,
      user_id: req.authUser!.id,
      question_id,
      note: typeof note === 'string' ? note.trim() : undefined,
      created_at: new Date().toISOString(),
    };
    db.saved_questions.unshift(record);
    writeDb(db);
    res.status(201).json({ saved: record });
  });

  app.delete('/api/saved-questions/:questionId', requireAuth, (req: AuthedRequest, res) => {
    const db = readDb();
    db.saved_questions = db.saved_questions.filter(
      (s) => !(s.user_id === req.authUser!.id && s.question_id === req.params.questionId)
    );
    writeDb(db);
    res.json({ ok: true });
  });

  // ================= EXAMINATION ENGINE =================
  app.get('/api/exams/attempts', requireAuth, (req: AuthedRequest, res) => {
    const db = readDb();
    const attempts = db.exam_attempts
      .filter((a) => a.user_id === req.authUser!.id)
      .map((a) => finalizeAttemptIfExpired(a, db))
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    res.json({ attempts });
  });

  app.post('/api/exams/start', requireAuth, (req: AuthedRequest, res) => {
    const db = readDb();
    const {
      course_code,
      mode = 'cbt',
      question_count,
      duration_minutes,
      examination_year,
    } = req.body as {
      course_code?: string;
      mode?: ExamMode;
      question_count?: number;
      duration_minutes?: number;
      examination_year?: string;
    };

    const course = db.courses.find(
      (c) => c.code === course_code || c.id === course_code
    ) || db.courses[0];

    if (!course) {
      res.status(404).json({ error: 'No ND2 courses available.' });
      return;
    }

    let pool = db.questions.filter((q) => q.course_id === course.id);
    if (examination_year && examination_year !== 'all') {
      pool = pool.filter((q) => q.examination_year === examination_year);
    }

    if (mode === 'cbt') {
      pool = pool.filter((q) => q.question_type !== 'theory');
    } else if (mode === 'theory') {
      pool = pool.filter((q) => q.question_type === 'theory');
    }

    if (pool.length === 0) {
      const sessionSuffix =
        examination_year && examination_year !== 'all' ? ` (${examination_year} session)` : '';
      const modeLabel =
        mode === 'cbt' ? 'CBT objective' : mode === 'theory' ? 'Theory essay' : 'examination';
      res.status(400).json({
        error: `No ${modeLabel} questions are available for ${course.code}${sessionSuffix}. Switch format or select All Past Sessions.`,
      });
      return;
    }

    const shuffledPool = [...pool];
    for (let i = shuffledPool.length - 1; i > 0; i -= 1) {
      const j = crypto.randomInt(i + 1);
      [shuffledPool[i], shuffledPool[j]] = [shuffledPool[j], shuffledPool[i]];
    }

    const requestedCount = Number(question_count) || db.platform_settings.default_cbt_question_count;
    const limit = Math.min(shuffledPool.length, Math.max(1, Math.min(60, requestedCount)));
    const selectedQuestions = shuffledPool.slice(0, limit);
    const durationMins = Math.max(
      5,
      Math.min(180, Number(duration_minutes) || (mode === 'theory' ? 45 : db.platform_settings.default_exam_duration_minutes))
    );
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + durationMins * 60 * 1000);

    const attempt: ExamAttempt = {
      id: `att-${crypto.randomUUID()}`,
      user_id: req.authUser!.id,
      course_id: course.id,
      course_code: course.code,
      course_title: course.title,
      academic_level: 'ND2',
      semester: course.semester,
      mode,
      status: 'in_progress',
      question_ids: selectedQuestions.map((q) => q.id),
      duration_seconds: durationMins * 60,
      started_at: startedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      objective_score: 0,
      objective_total: 0,
      theory_score: 0,
      theory_total: 0,
      total_score: 0,
      max_score: selectedQuestions.reduce((sum, q) => sum + (q.marks || 1), 0),
      percentage: 0,
      passed: false,
    };

    db.exam_attempts.unshift(attempt);
    writeDb(db);

    res.status(201).json({
      attempt,
      questions: selectedQuestions.map(toPublicQuestion),
      remaining_seconds: computeRemainingSeconds(attempt.expires_at),
    });
  });

  app.get('/api/exams/attempts/:id', requireAuth, (req: AuthedRequest, res) => {
    const db = readDb();
    let attempt = db.exam_attempts.find((a) => a.id === req.params.id);
    if (!attempt) {
      res.status(404).json({ error: 'Examination attempt not found.' });
      return;
    }
    if (attempt.user_id !== req.authUser!.id && req.authUser!.role !== 'admin') {
      res.status(403).json({ error: 'Access denied to this examination attempt.' });
      return;
    }

    attempt = finalizeAttemptIfExpired(attempt, db);
    const answers = db.student_answers.filter((a) => a.attempt_id === attempt!.id);
    const orderedQuestions = attempt.question_ids
      .map((qid) => db.questions.find((q) => q.id === qid))
      .filter((q): q is Question => Boolean(q));

    // Strictly hide correct_answer & worked solutions while exam is still in progress!
    const exposeAnswers = attempt.status !== 'in_progress';
    const questions = exposeAnswers ? orderedQuestions : orderedQuestions.map(toPublicQuestion);

    res.json({
      attempt,
      questions,
      answers,
      remaining_seconds: attempt.status === 'in_progress' ? computeRemainingSeconds(attempt.expires_at) : 0,
    });
  });

  app.post('/api/exams/attempts/:id/answer', requireAuth, (req: AuthedRequest, res) => {
    const db = readDb();
    const attempt = db.exam_attempts.find((a) => a.id === req.params.id);
    if (!attempt) {
      res.status(404).json({ error: 'Examination attempt not found.' });
      return;
    }
    if (attempt.user_id !== req.authUser!.id) {
      res.status(403).json({ error: 'Cannot modify another student attempt.' });
      return;
    }
    finalizeAttemptIfExpired(attempt, db);
    if (attempt.status !== 'in_progress') {
      res.status(409).json({ error: 'This examination has already been submitted or expired.' });
      return;
    }

    const { question_id, selected_answer, flagged_for_review } = req.body as {
      question_id?: string;
      selected_answer?: string;
      flagged_for_review?: boolean;
    };

    if (!question_id || !attempt.question_ids.includes(question_id)) {
      res.status(400).json({ error: 'Question does not belong to this examination.' });
      return;
    }
    const question = db.questions.find((q) => q.id === question_id);
    if (!question) {
      res.status(404).json({ error: 'Question not found.' });
      return;
    }

    let existing = db.student_answers.find(
      (a) => a.attempt_id === attempt.id && a.question_id === question_id
    );
    const now = new Date().toISOString();
    if (!existing) {
      existing = {
        id: `ans-${crypto.randomUUID()}`,
        attempt_id: attempt.id,
        user_id: req.authUser!.id,
        question_id,
        selected_answer: typeof selected_answer === 'string' ? selected_answer : '',
        is_correct: null,
        marks_awarded: 0,
        max_marks: question.marks || 1,
        flagged_for_review: Boolean(flagged_for_review),
        answered_at: now,
      };
      db.student_answers.push(existing);
    } else {
      if (typeof selected_answer === 'string') existing.selected_answer = selected_answer;
      if (typeof flagged_for_review === 'boolean') existing.flagged_for_review = flagged_for_review;
      existing.answered_at = now;
    }

    writeDb(db);
    res.json({ answer: existing, remaining_seconds: computeRemainingSeconds(attempt.expires_at) });
  });

  app.post('/api/exams/attempts/:id/submit', requireAuth, (req: AuthedRequest, res) => {
    const db = readDb();
    const attempt = db.exam_attempts.find((a) => a.id === req.params.id);
    if (!attempt) {
      res.status(404).json({ error: 'Examination attempt not found.' });
      return;
    }
    if (attempt.user_id !== req.authUser!.id) {
      res.status(403).json({ error: 'Cannot submit another student attempt.' });
      return;
    }
    if (attempt.status === 'submitted') {
      res.json({ attempt });
      return;
    }

    const bulkAnswers = (req.body?.answers as Array<{ question_id: string; selected_answer: string }> | undefined) ?? [];
    const now = new Date().toISOString();
    for (const item of bulkAnswers) {
      if (!attempt.question_ids.includes(item.question_id)) continue;
      const q = db.questions.find((x) => x.id === item.question_id);
      if (!q) continue;
      let existing = db.student_answers.find(
        (a) => a.attempt_id === attempt.id && a.question_id === item.question_id
      );
      if (!existing) {
        existing = {
          id: `ans-${crypto.randomUUID()}`,
          attempt_id: attempt.id,
          user_id: req.authUser!.id,
          question_id: item.question_id,
          selected_answer: item.selected_answer ?? '',
          is_correct: null,
          marks_awarded: 0,
          max_marks: q.marks || 1,
          flagged_for_review: false,
          answered_at: now,
        };
        db.student_answers.push(existing);
      } else {
        existing.selected_answer = item.selected_answer ?? '';
        existing.answered_at = now;
      }
    }

    const questions = attempt.question_ids
      .map((qid) => db.questions.find((q) => q.id === qid))
      .filter((q): q is Question => Boolean(q));
    const attemptAnswers: StudentAnswer[] = [];

    for (const q of questions) {
      let ans = db.student_answers.find((a) => a.attempt_id === attempt.id && a.question_id === q.id);
      if (!ans) {
        ans = {
          id: `ans-${crypto.randomUUID()}`,
          attempt_id: attempt.id,
          user_id: req.authUser!.id,
          question_id: q.id,
          selected_answer: '',
          is_correct: false,
          marks_awarded: 0,
          max_marks: q.marks || 1,
          flagged_for_review: false,
          answered_at: now,
        };
        db.student_answers.push(ans);
      }

      if (q.question_type === 'theory') {
        const evalRes = evaluateTheoryKeywords(q, ans.selected_answer);
        ans.marks_awarded = evalRes.marksAwarded;
        ans.max_marks = evalRes.maxMarks;
        ans.is_correct = evalRes.marksAwarded >= evalRes.maxMarks * 0.5;
        ans.ai_feedback = evalRes.matchedCriteria.length
          ? `Matched criteria: ${evalRes.matchedCriteria.join('; ')}.${evalRes.missedCriteria.length ? ` Missing points: ${evalRes.missedCriteria.join('; ')}.` : ''}`
          : q.verification_status === 'unverified'
          ? 'Source answer key unverified in PDF; review against AI Tutor rubric.'
          : 'Compare your explanation against the official worked solution.';
        updateStudentTopicProgress(db, req.authUser!.id, q, Boolean(ans.is_correct));
      } else {
        const graded = gradeObjectiveAnswer(q, ans.selected_answer);
        ans.is_correct = graded.isCorrect;
        ans.marks_awarded = graded.marksAwarded;
        ans.max_marks = graded.maxMarks;
        if (graded.isCorrect !== null) {
          updateStudentTopicProgress(db, req.authUser!.id, q, graded.isCorrect);
        }
      }
      attemptAnswers.push(ans);
    }

    const summary = computeAttemptSummary(
      questions,
      attemptAnswers,
      db.platform_settings.pass_mark_percentage
    );
    attempt.status = 'submitted';
    attempt.submitted_at = now;
    attempt.objective_score = summary.objectiveScore;
    attempt.objective_total = summary.objectiveTotal;
    attempt.theory_score = summary.theoryScore;
    attempt.theory_total = summary.theoryTotal;
    attempt.total_score = summary.totalScore;
    attempt.max_score = summary.maxScore;
    attempt.percentage = summary.percentage;
    attempt.passed = summary.passed;

    writeDb(db);
    res.json({ attempt, answers: attemptAnswers, questions });
  });

  // ================= AI ACADEMIC TUTOR =================
  app.get('/api/ai/history', requireAuth, (req: AuthedRequest, res) => {
    const db = readDb();
    const history = db.ai_learning_history
      .filter((h) => h.user_id === req.authUser!.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 40);
    res.json({ history });
  });

  app.delete('/api/ai/history', requireAuth, (req: AuthedRequest, res) => {
    const db = readDb();
    db.ai_learning_history = db.ai_learning_history.filter((h) => h.user_id !== req.authUser!.id);
    writeDb(db);
    res.json({ ok: true });
  });

  app.post('/api/ai/tutor', requireAuth, async (req: AuthedRequest, res) => {
    const db = readDb();
    if (!db.platform_settings.ai_tutor_enabled) {
      res.status(503).json({ error: 'AI Academic Tutor is currently disabled by platform settings.' });
      return;
    }

    const {
      mode = 'revision_chat',
      prompt,
      course_code,
      topic_id,
      question_id,
      module_id,
      student_draft,
    } = req.body as {
      mode?: 'explain_question' | 'hint' | 'step_by_step' | 'revision_chat' | 'theory_feedback';
      prompt?: string;
      course_code?: string;
      topic_id?: string;
      question_id?: string;
      module_id?: string;
      student_draft?: string;
    };

    const question = question_id ? db.questions.find((q) => q.id === question_id) : undefined;
    const course =
      (question ? db.courses.find((c) => c.id === question.course_id) : undefined) ||
      (course_code ? db.courses.find((c) => c.code === course_code || c.id === course_code) : undefined);
    const topic =
      (question ? db.topics.find((t) => t.id === question.topic_id) : undefined) ||
      (topic_id ? db.topics.find((t) => t.id === topic_id) : undefined);

    const effectivePrompt =
      prompt?.trim() ||
      (mode === 'theory_feedback' && student_draft?.trim()
        ? `Please review my draft answer${question ? ` for ${question.course_code} Q${question.question_number}` : course ? ` for ${course.code}` : ''}.`
        : question
        ? `Please help me understand ${question.course_code} Q${question.question_number}.`
        : '');

    if (!effectivePrompt) {
      res.status(400).json({ error: 'Please enter a study question, topic, or draft answer for the AI Tutor.' });
      return;
    }

    const courseTopics = course ? db.topics.filter((t) => t.course_id === course.id) : [];

    let lessonContext: string | undefined;
    if (course) {
      const curriculum = CURRICULUM_BY_CODE[course.code.toUpperCase()];
      if (curriculum) {
        const promptLower = effectivePrompt.toLowerCase();
        const matchedModule =
          (module_id ? curriculum.modules.find((m) => m.id === module_id) : undefined) ||
          curriculum.modules.find((m) =>
            m.lessons.some(
              (l) =>
                l.title.toLowerCase().includes(promptLower) ||
                promptLower.split(/\s+/).some((word) => word.length >= 4 && l.title.toLowerCase().includes(word))
            )
          ) ||
          curriculum.modules[0];
        const lesson = matchedModule?.lessons[0];
        if (lesson) {
          const parts = [
            `Module "${matchedModule.title}" (${course.code}):`,
            lesson.learningObjectives?.length ? `Objectives: ${lesson.learningObjectives.join('; ')}` : '',
            lesson.contentMarkdown.slice(0, 1400),
            lesson.workedExample ? `Worked Example: ${lesson.workedExample.slice(0, 600)}` : '',
          ].filter(Boolean);
          lessonContext = parts.join('\n');
        }
      }
    }

    const recentHistory = db.ai_learning_history
      .filter((h) => h.user_id === req.authUser!.id && (!course || h.course_id === course.id))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 3)
      .map((h) => ({ prompt: h.prompt, ai_explanation: h.ai_explanation }));

    try {
      const result = await generateGroundedTutorResponse({
        mode,
        studentPrompt: effectivePrompt,
        course,
        topic,
        question,
        studentDraft: student_draft,
        lessonContext,
        courseTopics,
        recentHistory,
      });

      const entry = {
        id: `ai-${crypto.randomUUID()}`,
        user_id: req.authUser!.id,
        course_id: course?.id,
        question_id: question?.id,
        mode,
        prompt: effectivePrompt,
        official_answer: result.officialAnswer,
        ai_explanation: result.aiExplanation,
        source_citation: result.sourceCitation ?? undefined,
        verification_status: question?.verification_status,
        created_at: new Date().toISOString(),
      };
      db.ai_learning_history.unshift(entry);
      writeDb(db);

      res.json({ record: entry });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI Tutor service failed.';
      const statusCode = /rate limit/i.test(msg) ? 429 : /not configured/i.test(msg) ? 503 : 502;
      res.status(statusCode).json({ error: msg });
    }
  });

  // ================= ONE-TIME ADMIN SETUP =================
  app.get('/api/admin/setup-status', (_req, res) => {
    const db = readDb();
    const hasAdmin = db.users.some((u) => u.role === 'admin');
    const envAdminConfigured = isEnvAdminConfigured();
    res.json({
      needs_admin_setup: !hasAdmin && !envAdminConfigured,
      env_admin_configured: envAdminConfigured,
    });
  });

  app.post('/api/admin/setup', async (req, res) => {
    try {
      if (getAuthenticatedUser(req)) {
        res.status(409).json({ error: 'You are already signed in. Please sign out first.' });
        return;
      }

      const db = readDb();
      if (db.users.some((u) => u.role === 'admin') || isEnvAdminConfigured()) {
        res.status(403).json({ error: 'Administrator setup is already complete. Sign in with your administrator credentials.' });
        return;
      }

      const { full_name, email, password } = req.body as Record<string, unknown>;
      if (typeof full_name !== 'string' || full_name.trim().length < 2) {
        res.status(400).json({ error: 'Please enter your full name (at least 2 characters).' });
        return;
      }
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        res.status(400).json({ error: 'Please enter a valid administrator email address.' });
        return;
      }
      if (typeof password !== 'string' || password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters long.' });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      if (db.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
        res.status(409).json({
          error: 'An account with this email already exists. Use a separate administrator email or sign in if configured via ADMIN_BOOTSTRAP_EMAILS.',
        });
        return;
      }

      const defaultDept = db.departments[0] ?? { id: 'dept-com', name: 'Computer Technology' };
      const password_hash = await bcrypt.hash(password, 10);
      const now = new Date().toISOString();
      const newAdmin: StoredUserRecord = {
        id: `adm-${crypto.randomUUID()}`,
        full_name: full_name.trim(),
        email: normalizedEmail,
        department_id: defaultDept.id,
        department_name: defaultDept.name,
        academic_level: 'ND2',
        role: 'admin',
        preferred_semester: 'Second Semester',
        study_goal_minutes_daily: 45,
        password_hash,
        created_at: now,
        updated_at: now,
      };

      db.users.push(newAdmin);
      recordAuditLog(
        db,
        { id: newAdmin.id, email: newAdmin.email },
        'ADMIN_SETUP_COMPLETED',
        'profile',
        newAdmin.id,
        'Completed initial administrator account setup'
      );
      writeDb(db);

      const sessionToken = signSessionToken(newAdmin);
      setSessionCookie(req, res, sessionToken);

      res.status(201).json({
        user: stripSensitiveUserFields(newAdmin),
        session_token: sessionToken,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to complete administrator setup.' });
    }
  });

  // ================= ADMIN PORTAL =================
  app.get('/api/admin/overview', requireAdmin, (_req, res) => {
    const db = readDb();
    res.json({
      stats: {
        students: db.users.filter((u) => u.role === 'student').length,
        admins: db.users.filter((u) => u.role === 'admin').length,
        courses: db.courses.length,
        questions: db.questions.length,
        verified_questions: db.questions.filter((q) => q.verification_status === 'verified').length,
        unverified_questions: db.questions.filter((q) => q.verification_status !== 'verified').length,
        exam_attempts: db.exam_attempts.length,
        pdf_imports: db.pdf_imports.length,
      },
      audit_logs: db.audit_logs.slice(0, 20),
    });
  });

  app.get('/api/admin/courses', requireAdmin, (_req, res) => {
    const db = readDb();
    res.json({ departments: db.departments, courses: db.courses });
  });

  app.post('/api/admin/courses', requireAdmin, (req: AuthedRequest, res) => {
    try {
      const db = readDb();
      const { code, title, department_id, semester, credit_units, exam_duration_minutes, description, academic_level } =
        req.body as Record<string, unknown>;

      if (academic_level !== undefined && academic_level !== null && academic_level !== '') {
        assertND2Level(academic_level);
      }
      if (typeof code !== 'string' || typeof title !== 'string' || !code.trim() || !title.trim()) {
        res.status(400).json({ error: 'Course code and title are required.' });
        return;
      }
      if (containsDisallowedAcademicLevel(`${code} ${title} ${description ?? ''}`)) {
        res.status(400).json({ error: 'Divshinastudy strictly supports ND2 courses only.' });
        return;
      }

      const dept = db.departments.find((d) => d.id === department_id) || db.departments[0];
      const normalizedSem = normalizeSemester(semester || 'Second Semester');
      const normalizedCode = code.trim().toUpperCase();
      if (db.courses.some((c) => c.code.toUpperCase() === normalizedCode)) {
        res.status(409).json({ error: `Course ${normalizedCode} already exists.` });
        return;
      }

      const course: Course = {
        id: `course-${crypto.randomUUID().slice(0, 8)}`,
        code: normalizedCode,
        title: title.trim(),
        department_id: dept.id,
        department_name: dept.name,
        academic_level: 'ND2',
        semester: normalizedSem,
        credit_units: Number(credit_units) || 2,
        exam_duration_minutes: Number(exam_duration_minutes) || 60,
        description: typeof description === 'string' ? description.trim() : '',
        sessions_available: ['2024/2025'],
        created_at: new Date().toISOString(),
      };
      db.courses.push(course);
      db.topics.push({
        id: `topic-${course.id}-core`,
        course_id: course.id,
        course_code: course.code,
        title: `${course.title} Core Concepts`,
        summary: 'Foundational ND2 topics and past paper problem solving.',
        order_index: 1,
      });
      recordAuditLog(db, req.authUser!, 'COURSE_CREATED', 'course', course.id, `Created ND2 course ${course.code}`);
      writeDb(db);
      res.status(201).json({ course });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to create course.' });
    }
  });

  app.delete('/api/admin/courses/:id', requireAdmin, (req: AuthedRequest, res) => {
    const db = readDb();
    const course = db.courses.find((c) => c.id === req.params.id);
    if (!course) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }
    db.courses = db.courses.filter((c) => c.id !== course.id);
    db.topics = db.topics.filter((t) => t.course_id !== course.id);
    db.questions = db.questions.filter((q) => q.course_id !== course.id);
    recordAuditLog(db, req.authUser!, 'COURSE_DELETED', 'course', course.id, `Deleted course ${course.code}`);
    writeDb(db);
    res.json({ ok: true });
  });

  app.get('/api/admin/questions', requireAdmin, (_req, res) => {
    const db = readDb();
    res.json({ questions: db.questions, courses: db.courses, topics: db.topics });
  });

  app.post('/api/admin/questions', requireAdmin, (req: AuthedRequest, res) => {
    try {
      const db = readDb();
      const body = req.body as Partial<Question>;
      if (body.academic_level) assertND2Level(body.academic_level);
      const course = db.courses.find((c) => c.id === body.course_id || c.code === body.course_code);
      if (!course) {
        res.status(400).json({ error: 'Valid ND2 course is required.' });
        return;
      }
      const topic = db.topics.find((t) => t.id === body.topic_id) || db.topics.find((t) => t.course_id === course.id);
      if (!topic || !body.question_text?.trim()) {
        res.status(400).json({ error: 'Topic and question text are required.' });
        return;
      }

      const newQ: Question = {
        id: `q-${crypto.randomUUID().slice(0, 8)}`,
        course_id: course.id,
        course_code: course.code,
        topic_id: topic.id,
        topic_name: topic.title,
        department_name: course.department_name,
        academic_level: 'ND2',
        semester: course.semester,
        examination_year: body.examination_year?.trim() || '2024/2025',
        session_type: body.session_type === 'Full-Time' ? 'Full-Time' : 'Part-Time',
        question_number: body.question_number?.trim() || '1',
        question_type: body.question_type || 'mcq',
        question_text: body.question_text.trim(),
        options: body.options,
        correct_answer: body.correct_answer?.trim() || undefined,
        official_solution_excerpt: body.official_solution_excerpt?.trim() || undefined,
        marking_scheme: body.marking_scheme,
        marks: Number(body.marks) || (body.question_type === 'theory' ? 10 : 1),
        difficulty: body.difficulty || 'standard',
        source_document: body.source_document?.trim() || 'Admin Entry',
        source_page: Number(body.source_page) || 1,
        verification_status: body.verification_status || (body.correct_answer ? 'verified' : 'unverified'),
        verified_by: req.authUser!.email,
        created_at: new Date().toISOString(),
      };

      db.questions.unshift(newQ);
      recordAuditLog(db, req.authUser!, 'QUESTION_CREATED', 'question', newQ.id, `Added ${newQ.course_code} (${newQ.question_type})`);
      writeDb(db);
      res.status(201).json({ question: newQ });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to add question.' });
    }
  });

  app.patch('/api/admin/questions/:id', requireAdmin, (req: AuthedRequest, res) => {
    const db = readDb();
    const q = db.questions.find((item) => item.id === req.params.id);
    if (!q) {
      res.status(404).json({ error: 'Question not found.' });
      return;
    }
    const { question_text, correct_answer, official_solution_excerpt, verification_status, marks } =
      req.body as Partial<Question>;
    if (typeof question_text === 'string' && question_text.trim()) q.question_text = question_text.trim();
    if (typeof correct_answer === 'string') q.correct_answer = correct_answer.trim() || undefined;
    if (typeof official_solution_excerpt === 'string') {
      q.official_solution_excerpt = official_solution_excerpt.trim() || undefined;
    }
    if (verification_status) {
      q.verification_status = verification_status;
      q.verified_by = req.authUser!.email;
    }
    if (typeof marks === 'number' && marks > 0) q.marks = marks;

    recordAuditLog(db, req.authUser!, 'QUESTION_UPDATED', 'question', q.id, `Updated ${q.course_code} verification=${q.verification_status}`);
    writeDb(db);
    res.json({ question: q });
  });

  app.delete('/api/admin/questions/:id', requireAdmin, (req: AuthedRequest, res) => {
    const db = readDb();
    const existing = db.questions.find((q) => q.id === req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Question not found.' });
      return;
    }
    db.questions = db.questions.filter((q) => q.id !== req.params.id);
    recordAuditLog(db, req.authUser!, 'QUESTION_DELETED', 'question', existing.id, `Deleted question from ${existing.course_code}`);
    writeDb(db);
    res.json({ ok: true });
  });

  // PDF Upload & Extraction Pipeline
  app.get('/api/admin/pdf-imports', requireAdmin, (_req, res) => {
    const db = readDb();
    res.json({ imports: db.pdf_imports });
  });

  app.post('/api/admin/pdf-imports/upload', requireAdmin, upload.single('file'), async (req: AuthedRequest, res) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'Please attach a PDF file to import.' });
        return;
      }

      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: file.buffer });
      const parsed = await parser.getText();
      const meta = detectPdfMetadata(parsed.text || '');
      const drafts = extractQuestionDraftsFromText(parsed.text || '');

      const db = readDb();
      const record = {
        id: `pdf-${crypto.randomUUID().slice(0, 8)}`,
        filename: file.originalname,
        uploaded_by: req.authUser!.email,
        course_code: (req.body?.course_code as string) || meta.courseCode,
        examination_year: (req.body?.examination_year as string) || meta.examinationYear || '2024/2025',
        semester: meta.semester || 'Second Semester',
        page_count: parsed.total || 1,
        extracted_count: drafts.length,
        status: 'pending_review' as const,
        extracted_preview: drafts,
        created_at: new Date().toISOString(),
      };
      db.pdf_imports.unshift(record);
      recordAuditLog(db, req.authUser!, 'PDF_UPLOADED', 'pdf_import', record.id, `Uploaded ${file.originalname} (${record.extracted_count} drafts)`);
      writeDb(db);
      res.status(201).json({ importRecord: record });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to parse uploaded PDF.' });
    }
  });

  app.post('/api/admin/pdf-imports/:id/approve', requireAdmin, (req: AuthedRequest, res) => {
    const db = readDb();
    const imp = db.pdf_imports.find((p) => p.id === req.params.id);
    if (!imp) {
      res.status(404).json({ error: 'PDF import record not found.' });
      return;
    }

    const course =
      db.courses.find((c) => c.code === (req.body?.course_code || imp.course_code)) || db.courses[0];
    const topic = db.topics.find((t) => t.course_id === course.id) || db.topics[0];
    const approvedIds = new Set<string>(
      (req.body?.approved_temp_ids as string[] | undefined) || imp.extracted_preview.map((d) => d.temp_id)
    );

    let publishedCount = 0;
    for (const draft of imp.extracted_preview) {
      if (!approvedIds.has(draft.temp_id)) continue;
      draft.approved = true;
      db.questions.unshift({
        id: `q-imp-${crypto.randomUUID().slice(0, 8)}`,
        course_id: course.id,
        course_code: course.code,
        topic_id: topic.id,
        topic_name: topic.title,
        department_name: course.department_name,
        academic_level: 'ND2',
        semester: imp.semester || course.semester,
        examination_year: imp.examination_year || '2024/2025',
        session_type: 'Part-Time',
        question_number: String(publishedCount + 1),
        question_type: draft.question_type,
        question_text: draft.question_text,
        options: draft.options,
        correct_answer: draft.proposed_answer,
        marks: draft.question_type === 'theory' ? 10 : 1,
        difficulty: 'standard',
        source_document: imp.filename,
        source_page: draft.source_page,
        verification_status: draft.proposed_answer ? 'verified' : 'unverified',
        verified_by: req.authUser!.email,
        created_at: new Date().toISOString(),
      });
      publishedCount += 1;
    }

    imp.status = 'approved';
    recordAuditLog(db, req.authUser!, 'PDF_APPROVED', 'pdf_import', imp.id, `Published ${publishedCount} questions from ${imp.filename}`);
    writeDb(db);
    res.json({ importRecord: imp, published_count: publishedCount });
  });

  app.get('/api/admin/users', requireAdmin, (_req, res) => {
    const db = readDb();
    const users: Array<UserProfile & { attempt_count: number }> = db.users.map((u) => ({
      ...stripSensitiveUserFields(u),
      attempt_count: db.exam_attempts.filter((a) => a.user_id === u.id).length,
    }));
    res.json({ users });
  });

  app.patch('/api/admin/users/:id/role', requireAdmin, (req: AuthedRequest, res) => {
    const { role } = req.body as { role?: 'student' | 'admin' };
    if (role !== 'student' && role !== 'admin') {
      res.status(400).json({ error: 'Role must be student or admin.' });
      return;
    }
    const db = readDb();
    const target = db.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    target.role = role;
    target.updated_at = new Date().toISOString();
    recordAuditLog(db, req.authUser!, 'ROLE_CHANGED', 'user_role', target.id, `Set ${target.email} role to ${role}`);
    writeDb(db);
    res.json({ user: stripSensitiveUserFields(target) });
  });

  app.get('/api/admin/exams', requireAdmin, (_req, res) => {
    const db = readDb();
    const attempts = db.exam_attempts.map((a) => {
      const student = db.users.find((u) => u.id === a.user_id);
      return {
        ...a,
        student_name: student?.full_name || 'Unknown Student',
        student_email: student?.email || '',
      };
    });
    res.json({ attempts, settings: db.platform_settings });
  });

  app.get('/api/admin/settings', requireAdmin, (_req, res) => {
    const db = readDb();
    res.json({ settings: db.platform_settings, audit_logs: db.audit_logs.slice(0, 50) });
  });

  app.patch('/api/admin/settings', requireAdmin, (req: AuthedRequest, res) => {
    const db = readDb();
    const s = db.platform_settings;
    const body = req.body as Partial<typeof s>;

    if (typeof body.default_cbt_question_count === 'number' && body.default_cbt_question_count >= 1) {
      s.default_cbt_question_count = Math.min(50, Math.round(body.default_cbt_question_count));
    }
    if (typeof body.default_exam_duration_minutes === 'number' && body.default_exam_duration_minutes >= 5) {
      s.default_exam_duration_minutes = Math.min(180, Math.round(body.default_exam_duration_minutes));
    }
    if (typeof body.pass_mark_percentage === 'number' && body.pass_mark_percentage >= 30 && body.pass_mark_percentage <= 90) {
      s.pass_mark_percentage = Math.round(body.pass_mark_percentage);
    }
    if (typeof body.allow_self_registration === 'boolean') s.allow_self_registration = body.allow_self_registration;
    if (typeof body.ai_tutor_enabled === 'boolean') s.ai_tutor_enabled = body.ai_tutor_enabled;
    s.strict_academic_level = 'ND2';
    s.updated_at = new Date().toISOString();

    recordAuditLog(db, req.authUser!, 'SETTINGS_UPDATED', 'platform_settings', '1', 'Updated ND2 examination & platform settings');
    writeDb(db);
    res.json({ settings: s });
  });

  return app;
}
