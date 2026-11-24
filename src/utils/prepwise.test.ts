import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertND2Level,
  containsDisallowedAcademicLevel,
  enforceND2Profile,
  normalizeSemester,
} from './academicScope';
import {
  computeAttemptSummary,
  computeRemainingSeconds,
  evaluateTheoryKeywords,
  gradeObjectiveAnswer,
} from './examEngine';
import {
  buildRecommendedItems,
  computeDashboardProgress,
  computePerformanceSeries,
} from './analytics';
import { detectPdfMetadata, extractQuestionDraftsFromText } from './pdfParser';
import { CURRICULUM_ATTACHMENTS, CURRICULUM_BY_CODE } from '../data/curriculumAttachments';
import { SEED_COURSES, SEED_QUESTIONS } from '../data/nd2QuestionBank';
import { buildTutorPromptContext, getGeminiClient } from '../../server/gemini';
import type { Course, ExamAttempt, Question, StudentAnswer, StudentProgress, Topic } from '../types';

test('ND2 strict scope validation accepts ND2 and rejects ND1, ND3, HND1, HND2', () => {
  assert.equal(assertND2Level('ND2'), 'ND2');
  assert.equal(assertND2Level('nd 2'), 'ND2');
  assert.throws(() => assertND2Level('ND1'));
  assert.throws(() => assertND2Level('ND3'));
  assert.throws(() => assertND2Level('HND1'));
  assert.throws(() => assertND2Level('HND2'));

  const coerced = enforceND2Profile({ full_name: 'Ada Obi', academic_level: undefined });
  assert.equal(coerced.academic_level, 'ND2');
  assert.equal(normalizeSemester('2nd semester'), 'Second Semester');
  assert.equal(containsDisallowedAcademicLevel('Students in ND1 or HND2'), true);
  assert.equal(containsDisallowedAcademicLevel('ND2 Second Semester Calculus'), false);
});

test('Exam grading handles MCQ, True/False, Fill-in-gap, Unverified, and Theory keyword scoring', () => {
  const mcq: Question = {
    id: 'q1',
    course_id: 'c1',
    course_code: 'COM 226',
    topic_id: 't1',
    topic_name: 'POST & BIOS',
    department_name: 'Computer Technology',
    academic_level: 'ND2',
    semester: 'Second Semester',
    examination_year: '2024/2025',
    session_type: 'Full-Time',
    question_number: '1',
    question_type: 'mcq',
    question_text: 'What diagnostic test does BIOS run at startup?',
    options: [
      { label: 'A', text: 'POST' },
      { label: 'B', text: 'BIOS' },
      { label: 'C', text: 'ROM' },
      { label: 'D', text: 'RAM' },
    ],
    correct_answer: 'A',
    marks: 2,
    difficulty: 'foundation',
    source_document: 'ND_2_PQ_compressed.pdf',
    source_page: 53,
    verification_status: 'verified',
    created_at: '2026-01-01T00:00:00Z',
  };

  assert.deepEqual(gradeObjectiveAnswer(mcq, 'A'), { isCorrect: true, marksAwarded: 2, maxMarks: 2 });
  assert.deepEqual(gradeObjectiveAnswer(mcq, 'B'), { isCorrect: false, marksAwarded: 0, maxMarks: 2 });

  const fillGap: Question = {
    ...mcq,
    id: 'q2',
    question_type: 'fill_gap',
    options: undefined,
    correct_answer: 'POST | Power On Self Test',
    marks: 1,
  };
  assert.equal(gradeObjectiveAnswer(fillGap, 'Power On Self Test').isCorrect, true);

  const unverified: Question = {
    ...mcq,
    id: 'q3',
    correct_answer: undefined,
    verification_status: 'unverified',
  };
  assert.equal(gradeObjectiveAnswer(unverified, 'A').isCorrect, null);

  const theory: Question = {
    ...mcq,
    id: 'q4',
    question_type: 'theory',
    options: undefined,
    correct_answer: undefined,
    marking_scheme: ['Power supply failure', 'Overheating processor', 'Corrupt system files'],
    marks: 10,
  };
  const theoryEval = evaluateTheoryKeywords(theory, 'Spontaneous shutdown can be caused by power supply failure or overheating processor.');
  assert.ok(theoryEval.marksAwarded > 5);
  assert.equal(theoryEval.matchedCriteria.length, 2);

  const ans1: StudentAnswer = {
    id: 'a1',
    attempt_id: 'att1',
    user_id: 'u1',
    question_id: 'q1',
    selected_answer: 'A',
    is_correct: true,
    marks_awarded: 2,
    max_marks: 2,
    flagged_for_review: false,
    answered_at: '2026-01-01T00:00:00Z',
  };
  const summary = computeAttemptSummary([mcq, unverified], [ans1], 50);
  assert.equal(summary.percentage, 100);
  assert.equal(summary.passed, true);
  assert.equal(computeRemainingSeconds(new Date(Date.now() + 65000).toISOString(), Date.now()) >= 64, true);
});

test('Analytics accurately reflects zero-state and real student progress', () => {
  const courses: Course[] = [
    {
      id: 'c-mth',
      code: 'MTH 209',
      title: 'Calculus',
      department_id: 'd-mth',
      department_name: 'Mathematics',
      academic_level: 'ND2',
      semester: 'Second Semester',
      credit_units: 2,
      exam_duration_minutes: 90,
      description: 'ND2 Calculus',
      sessions_available: ['2023/2024'],
      created_at: '2026-01-01T00:00:00Z',
    },
  ];
  const topics: Topic[] = [
    { id: 't1', course_id: 'c-mth', course_code: 'MTH 209', title: 'Limits & Continuity', summary: 'Limits', order_index: 1 },
    { id: 't2', course_id: 'c-mth', course_code: 'MTH 209', title: 'Differentiation', summary: 'Derivatives', order_index: 2 },
  ];
  const emptySummary = computeDashboardProgress(topics, []);
  assert.equal(emptySummary.overallPercentage, 0);
  assert.equal(emptySummary.pendingCount, 2);

  const progress: StudentProgress[] = [
    { user_id: 'u1', course_id: 'c-mth', topic_id: 't1', questions_attempted: 5, questions_correct: 4, mastery_percentage: 80, status: 'completed', last_practiced_at: '2026-01-01T00:00:00Z' },
    { user_id: 'u1', course_id: 'c-mth', topic_id: 't2', questions_attempted: 4, questions_correct: 2, mastery_percentage: 50, status: 'in_progress', last_practiced_at: '2026-01-01T00:00:00Z' },
  ];
  const filledSummary = computeDashboardProgress(topics, progress);
  assert.equal(filledSummary.overallPercentage, 65);
  assert.equal(filledSummary.completedCount, 1);
  assert.equal(filledSummary.inProgressCount, 1);
  assert.equal(filledSummary.pendingCount, 0);

  const attempts: ExamAttempt[] = [
    {
      id: 'att1',
      user_id: 'u1',
      course_id: 'c-mth',
      course_code: 'MTH 209',
      course_title: 'Calculus',
      academic_level: 'ND2',
      semester: 'Second Semester',
      mode: 'cbt',
      status: 'submitted',
      question_ids: ['q1'],
      duration_seconds: 1800,
      started_at: '2026-01-01T10:00:00Z',
      expires_at: '2026-01-01T10:30:00Z',
      submitted_at: '2026-01-01T10:15:00Z',
      objective_score: 8,
      objective_total: 10,
      theory_score: 0,
      theory_total: 0,
      total_score: 8,
      max_score: 10,
      percentage: 80,
      passed: true,
    },
  ];
  const series = computePerformanceSeries(attempts);
  assert.equal(series.length, 1);
  assert.equal(series[0].score, 80);

  const dummyQ: Question = {
    id: 'q1',
    course_id: 'c-mth',
    course_code: 'MTH 209',
    topic_id: 't1',
    topic_name: 'Limits & Continuity',
    department_name: 'Mathematics',
    academic_level: 'ND2',
    semester: 'Second Semester',
    examination_year: '2023/2024',
    session_type: 'Part-Time',
    question_number: '1',
    question_type: 'theory',
    question_text: 'Evaluate limit',
    marks: 10,
    difficulty: 'standard',
    source_document: 'ND_2_PQ_compressed.pdf',
    source_page: 1,
    verification_status: 'verified',
    created_at: '2026-01-01T00:00:00Z',
  };
  const recs = buildRecommendedItems(courses, topics, [dummyQ], progress);
  assert.equal(recs[0].title, 'Differentiation');
  assert.equal(recs[0].actionType, 'Learn');
});

test('PDF parser extracts metadata and structured question drafts', () => {
  const sample = `
YABA COLLEGE OF TECHNOLOGY
2024/2025 SECOND SEMESTER EXAMINATION
Paper Code: COM 226
1. Which diagnostic runs during startup? a) POST b) CMOS c) RAM d) ROM
QUESTION THREE
Explain system troubleshooting and power supply faults.
  `;
  const meta = detectPdfMetadata(sample);
  assert.equal(meta.courseCode, 'COM 226');
  assert.equal(meta.examinationYear, '2024/2025');
  assert.equal(meta.semester, 'Second Semester');

  const drafts = extractQuestionDraftsFromText(sample);
  assert.equal(drafts.length >= 2, true);
  assert.equal(drafts[0].question_type, 'mcq');
  assert.equal(drafts[0].options?.length, 4);
  assert.equal(drafts[1].question_type, 'theory');
});

test('All 8 ND2 curriculum attachments load cleanly with modules, questions, and zero disallowed levels', () => {
  const expectedCodes = ['COM 211', 'COM 212', 'COM 213', 'COM 215', 'COM 216', 'COM 226', 'EED 216', 'GNS 201'];
  assert.equal(CURRICULUM_ATTACHMENTS.length, 8);

  for (const code of expectedCodes) {
    const attachment = CURRICULUM_BY_CODE[code];
    assert.ok(attachment, `Missing curriculum attachment for ${code}`);
    assert.ok(attachment.modules.length >= 7, `Expected >= 7 modules for ${code}`);

    const course = SEED_COURSES.find((c) => c.code === code);
    assert.ok(course, `Missing course record for ${code}`);
    assert.equal(course.academic_level, 'ND2');

    const courseQuestions = SEED_QUESTIONS.filter((q) => q.course_code === code);
    assert.ok(courseQuestions.length >= 10, `Expected >= 10 questions for ${code}, got ${courseQuestions.length}`);
    assert.ok(
      courseQuestions.some((q) => q.question_type === 'mcq'),
      `Expected CBT MCQ question(s) for ${code}`
    );

    const allModuleText = JSON.stringify(attachment);
    assert.equal(containsDisallowedAcademicLevel(allModuleText), false, `Disallowed level found in ${code}`);
  }

  // Ensure original COM 226 PDF troubleshooting questions were preserved alongside File Organisation content
  const com226PdfQuestions = SEED_QUESTIONS.filter(
    (q) => q.course_code === 'COM 226' && q.source_document === 'ND_2_PQ_compressed.pdf'
  );
  assert.ok(com226PdfQuestions.length >= 10);
});

test('AI Tutor builds strictly-ND2 prompt context with syllabus, draft, and recent history and requires GEMINI_API_KEY', () => {
  const course: Course = {
    id: 'c-com211',
    code: 'COM 211',
    title: 'Introduction to Java Programming II',
    department_id: 'd-com',
    department_name: 'Computer Science',
    academic_level: 'ND2',
    semester: 'First Semester',
    credit_units: 3,
    exam_duration_minutes: 90,
    description: 'Object-Oriented Programming and Exception Handling',
    sessions_available: ['2024/2025'],
    created_at: '2026-01-01T00:00:00Z',
  };
  const topic: Topic = {
    id: 't-exc',
    course_id: 'c-com211',
    course_code: 'COM 211',
    title: 'Exception Handling',
    summary: 'try, catch, finally, and custom exceptions',
    order_index: 2,
  };
  const ctx = buildTutorPromptContext({
    mode: 'step_by_step',
    studentPrompt: 'Explain try-catch-finally in Java',
    course,
    topic,
    courseTopics: [topic],
    studentDraft: 'try wraps risky code and catch handles the error.',
    recentHistory: [
      {
        prompt: 'What is OOP?',
        ai_explanation: 'OOP structures programs around classes and objects.',
      },
    ],
  });

  assert.ok(ctx.systemInstruction.includes('ND2'));
  assert.equal(containsDisallowedAcademicLevel(ctx.systemInstruction), false);
  assert.ok(ctx.systemInstruction.includes('COM 211'));
  assert.ok(ctx.systemInstruction.includes('Exception Handling'));
  assert.ok(ctx.systemInstruction.includes('Student Draft Answer'));
  assert.ok(ctx.systemInstruction.includes('What is OOP?'));
  assert.ok(ctx.userMessage.includes('Step-by-Step Worked Solution'));
  assert.ok(ctx.userMessage.includes('Explain try-catch-finally in Java'));
  assert.equal(ctx.sourceCitation, 'COM 211 — Introduction to Java Programming II (ND2 First Semester)');

  const prevGemini = process.env.GEMINI_API_KEY;
  const prevAi = process.env.AI_API_KEY;
  try {
    delete process.env.GEMINI_API_KEY;
    delete process.env.AI_API_KEY;
    assert.throws(() => getGeminiClient(), /GEMINI_API_KEY is not configured/);
  } finally {
    if (prevGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevGemini;
    if (prevAi === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = prevAi;
  }
});

test('All 9 ND2 past-question courses have complete, clean, strictly-ND2 questions matching sessions_available', () => {
  const pastPaperCourses = [
    'MTH 209',
    'COM 226',
    'COM 223',
    'COM 225',
    'COM 217',
    'COM 224',
    'COM 222',
    'COM 227',
    'COM 220',
  ];

  const seenIds = new Set<string>();
  for (const q of SEED_QUESTIONS) {
    assert.equal(seenIds.has(q.id), false, `Duplicate question id detected: ${q.id}`);
    seenIds.add(q.id);
    assert.equal(q.academic_level, 'ND2', `Question ${q.id} is not ND2`);
    assert.equal(
      containsDisallowedAcademicLevel(
        `${q.question_text} ${q.topic_name} ${q.official_solution_excerpt || ''} ${(q.options || []).map((o) => o.text).join(' ')}`
      ),
      false,
      `Disallowed level found in question ${q.id}`
    );
    assert.equal(
      /\.(pdf|json)\b/i.test(
        `${q.question_text} ${q.topic_name} ${q.official_solution_excerpt || ''} ${q.verified_by || ''}`
      ),
      false,
      `Public filename leaked in question ${q.id}`
    );
  }

  for (const code of pastPaperCourses) {
    const course = SEED_COURSES.find((c) => c.code === code);
    assert.ok(course, `Missing course ${code} in SEED_COURSES`);
    assert.equal(course.academic_level, 'ND2');

    const pdfQuestions = SEED_QUESTIONS.filter(
      (q) => q.course_code === code && q.source_document === 'ND_2_PQ_compressed.pdf'
    );
    assert.ok(pdfQuestions.length >= 6, `Expected >= 6 PDF questions for ${code}, got ${pdfQuestions.length}`);

    const courseAllQuestions = SEED_QUESTIONS.filter((q) => q.course_code === code);
    const questionYears = new Set(courseAllQuestions.map((q) => q.examination_year));
    for (const session of course.sessions_available) {
      assert.ok(
        questionYears.has(session),
        `Course ${code} lists session "${session}" in sessions_available but has no questions for it`
      );
    }
    for (const y of questionYears) {
      assert.ok(
        course.sessions_available.includes(y),
        `Course ${code} has questions for "${y}" missing from sessions_available`
      );
    }
  }
});

test('COM 211, COM 212, GNS 201, and EED 216 include full 60-question Practice Bank sets with hidden keys stripped publicly', () => {
  const mixedCourses = ['COM 211', 'COM 212'];
  const objectiveOnlyCourses = ['GNS 201', 'EED 216'];

  for (const code of mixedCourses) {
    const bank = SEED_QUESTIONS.filter(
      (q) => q.course_code === code && q.examination_year === '2024/2025 Practice Bank'
    );
    assert.equal(bank.length, 60, `Expected 60 Practice Bank questions for ${code}, got ${bank.length}`);
    assert.equal(bank.filter((q) => q.question_type === 'mcq').length, 20);
    assert.equal(bank.filter((q) => q.question_type === 'true_false').length, 20);
    assert.equal(bank.filter((q) => q.question_type === 'fill_gap').length, 10);
    assert.equal(bank.filter((q) => q.question_type === 'theory').length, 10);
  }

  for (const code of objectiveOnlyCourses) {
    const bank = SEED_QUESTIONS.filter(
      (q) => q.course_code === code && q.examination_year === '2024/2025 Practice Bank'
    );
    assert.equal(bank.length, 60, `Expected 60 Practice Bank questions for ${code}, got ${bank.length}`);
    assert.equal(bank.filter((q) => q.question_type === 'mcq').length, 30);
    assert.equal(bank.filter((q) => q.question_type === 'true_false').length, 20);
    assert.equal(bank.filter((q) => q.question_type === 'fill_gap').length, 10);
    assert.equal(bank.filter((q) => q.question_type === 'theory').length, 0);
  }

  for (const code of [...mixedCourses, ...objectiveOnlyCourses]) {
    const course = SEED_COURSES.find((c) => c.code === code);
    assert.ok(course?.sessions_available.includes('2024/2025 Practice Bank'));
  }

  const gnsThesis = SEED_QUESTIONS.find((q) => q.id === 'q-gns201-pb-56');
  assert.ok(gnsThesis);
  assert.equal(gradeObjectiveAnswer(gnsThesis, 'Thesis').isCorrect, true);
  assert.equal(gradeObjectiveAnswer(gnsThesis, 'thesis statement').isCorrect, true);

  const eedBreakEven = SEED_QUESTIONS.find((q) => q.id === 'q-eed216-pb-56');
  assert.ok(eedBreakEven);
  assert.equal(gradeObjectiveAnswer(eedBreakEven, 'Break-even').isCorrect, true);
  assert.equal(gradeObjectiveAnswer(eedBreakEven, 'break even').isCorrect, true);
});

test('Netlify API handler supports admin setup, admin login, cookie/bearer auth, and stateless cold starts', async () => {
  const fs = await import('fs');
  const os = await import('os');
  const path = await import('path');
  const { handler, normalizeNetlifyApiPath } = await import('../../netlify/functions/api');
  const { resetDbCacheForTesting } = await import('../../server/db');

  assert.equal(normalizeNetlifyApiPath('/.netlify/functions/api/admin/setup-status'), '/api/admin/setup-status');
  assert.equal(normalizeNetlifyApiPath('/api/auth/login'), '/api/auth/login');
  assert.equal(
    normalizeNetlifyApiPath('/.netlify/functions/api/auth/login', 'https://divshinastudy.netlify.app/api/auth/login?from=admin'),
    '/api/auth/login'
  );
  assert.equal(normalizeNetlifyApiPath('/admin/setup'), '/api/admin/setup');

  const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'divshinastudy-test-'));
  const prevDataDir = process.env.DIVSHINASTUDY_DATA_DIR;
  const prevSecret = process.env.AUTH_SESSION_SECRET;
  const prevAdminEmail = process.env.ADMIN_EMAIL;
  const prevAdminPassword = process.env.ADMIN_PASSWORD;
  process.env.DIVSHINASTUDY_DATA_DIR = tempDataDir;
  process.env.AUTH_SESSION_SECRET = 'test-divshinastudy-netlify-session-secret-key';
  delete process.env.ADMIN_EMAIL;
  delete process.env.ADMIN_PASSWORD;

  try {
    resetDbCacheForTesting();

    // 1. Setup status reports setup needed on fresh site
    const statusRes = (await handler({
      httpMethod: 'GET',
      path: '/.netlify/functions/api/admin/setup-status',
      headers: { host: 'divshinastudy.netlify.app', 'x-forwarded-proto': 'https' },
    })) as { statusCode: number; body: string };
    assert.equal(statusRes.statusCode, 200);
    assert.equal(JSON.parse(statusRes.body).needs_admin_setup, true);

    // 2. Complete initial administrator setup over Netlify POST JSON
    const setupRes = (await handler({
      httpMethod: 'POST',
      path: '/.netlify/functions/api/admin/setup',
      headers: {
        'content-type': 'application/json',
        host: 'divshinastudy.netlify.app',
        'x-forwarded-proto': 'https',
      },
      body: JSON.stringify({
        full_name: 'Dr. Test Admin',
        email: 'netlify-admin@divshinastudy.edu.ng',
        password: 'AdminPassword123!',
      }),
    })) as { statusCode: number; headers: Record<string, string>; multiValueHeaders?: Record<string, string[]>; body: string };

    assert.equal(setupRes.statusCode, 201);
    const setupBody = JSON.parse(setupRes.body);
    assert.equal(setupBody.user.role, 'admin');
    assert.ok(setupBody.session_token);
    const setCookieHeader =
      setupRes.multiValueHeaders?.['set-cookie']?.[0] || setupRes.headers?.['set-cookie'] || '';
    assert.match(setCookieHeader, /prepwise_session=/);
    const cookiePair = setCookieHeader.split(';')[0];

    // 3. Register a student and confirm student cannot sign into admin_only portal
    const regRes = (await handler({
      httpMethod: 'POST',
      path: '/api/auth/register',
      headers: { 'content-type': 'application/json', host: 'divshinastudy.netlify.app' },
      body: JSON.stringify({
        full_name: 'Test Student',
        email: 'student-netlify@divshinastudy.edu.ng',
        password: 'StudentPassword123!',
        department_id: 'dept-com',
        preferred_semester: 'Second Semester',
        academic_level: 'ND2',
      }),
    })) as { statusCode: number };
    assert.equal(regRes.statusCode, 201);

    const studentOnAdminRes = (await handler({
      httpMethod: 'POST',
      path: '/api/auth/login',
      headers: { 'content-type': 'application/json', host: 'divshinastudy.netlify.app' },
      body: JSON.stringify({
        email: 'student-netlify@divshinastudy.edu.ng',
        password: 'StudentPassword123!',
        admin_only: true,
      }),
    })) as { statusCode: number; body: string };
    assert.equal(studentOnAdminRes.statusCode, 403);
    assert.match(JSON.parse(studentOnAdminRes.body).error, /restricted to verified Divshinastudy administrators/i);

    // 4. Sign in with verified admin credentials
    const adminLoginRes = (await handler({
      httpMethod: 'POST',
      path: '/.netlify/functions/api/auth/login',
      headers: {
        'content-type': 'application/json',
        host: 'divshinastudy.netlify.app',
        'x-forwarded-proto': 'https',
      },
      body: JSON.stringify({
        email: 'netlify-admin@divshinastudy.edu.ng',
        password: 'AdminPassword123!',
        admin_only: true,
      }),
    })) as { statusCode: number; body: string };
    assert.equal(adminLoginRes.statusCode, 200);
    const adminToken = JSON.parse(adminLoginRes.body).session_token as string;

    // 5. Simulate cold-start / second Netlify instance without user cache: both Bearer & HttpOnly cookie work
    resetDbCacheForTesting();
    const overviewBearerRes = (await handler({
      httpMethod: 'GET',
      path: '/api/admin/overview',
      headers: {
        authorization: `Bearer ${adminToken}`,
        host: 'divshinastudy.netlify.app',
      },
    })) as { statusCode: number; body: string };
    assert.equal(overviewBearerRes.statusCode, 200);
    assert.ok(JSON.parse(overviewBearerRes.body).stats);

    const overviewCookieRes = (await handler({
      httpMethod: 'GET',
      path: '/api/admin/overview',
      headers: {
        cookie: cookiePair,
        host: 'divshinastudy.netlify.app',
      },
    })) as { statusCode: number; body: string };
    assert.equal(overviewCookieRes.statusCode, 200);
    assert.ok(JSON.parse(overviewCookieRes.body).stats);

    // 6. Verify env-configured ADMIN_EMAIL / ADMIN_PASSWORD works immediately on cold container
    resetDbCacheForTesting();
    process.env.ADMIN_EMAIL = 'env-admin@divshinastudy.edu.ng';
    process.env.ADMIN_PASSWORD = 'EnvAdminSecret123!';
    const envStatusRes = (await handler({
      httpMethod: 'GET',
      path: '/api/admin/setup-status',
      headers: { host: 'divshinastudy.netlify.app' },
    })) as { statusCode: number; body: string };
    assert.equal(JSON.parse(envStatusRes.body).needs_admin_setup, false);

    const envLoginRes = (await handler({
      httpMethod: 'POST',
      path: '/api/auth/login',
      headers: { 'content-type': 'application/json', host: 'divshinastudy.netlify.app' },
      body: JSON.stringify({
        email: 'env-admin@divshinastudy.edu.ng',
        password: 'EnvAdminSecret123!',
        admin_only: true,
      }),
    })) as { statusCode: number; body: string };
    assert.equal(envLoginRes.statusCode, 200);
    assert.equal(JSON.parse(envLoginRes.body).user.role, 'admin');
  } finally {
    resetDbCacheForTesting();
    fs.rmSync(tempDataDir, { recursive: true, force: true });
    if (prevDataDir === undefined) delete process.env.DIVSHINASTUDY_DATA_DIR;
    else process.env.DIVSHINASTUDY_DATA_DIR = prevDataDir;
    if (prevSecret === undefined) delete process.env.AUTH_SESSION_SECRET;
    else process.env.AUTH_SESSION_SECRET = prevSecret;
    if (prevAdminEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = prevAdminEmail;
    if (prevAdminPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = prevAdminPassword;
  }
});
