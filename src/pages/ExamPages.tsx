import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  Flag,
  PlaySquare,
  XCircle,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { apiRequest, ApiError } from '../lib/api';
import type { Course, ExamAttempt, ExamMode, Question, QuestionPublic, StudentAnswer } from '../types';

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ExamInstructionsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [courseQuestions, setCourseQuestions] = useState<QuestionPublic[]>([]);
  const [selectedCourse, setSelectedCourse] = useState(searchParams.get('course') || 'COM 226');
  const [selectedYear, setSelectedYear] = useState(searchParams.get('year') || 'all');
  const [mode, setMode] = useState<ExamMode>('cbt');
  const [questionCount, setQuestionCount] = useState(10);
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      apiRequest<{ courses: Course[] }>('/api/courses'),
      apiRequest<{ attempts: ExamAttempt[] }>('/api/exams/attempts'),
    ])
      .then(([cRes, aRes]) => {
        setCourses(cRes.courses);
        setAttempts(aRes.attempts);
        if (!searchParams.get('course') && cRes.courses.length > 0) {
          const com226 = cRes.courses.find((c) => c.code === 'COM 226') || cRes.courses[0];
          setSelectedCourse(com226.code);
        }
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Unable to load exam configuration.');
      });
  }, [searchParams]);

  useEffect(() => {
    const yearParam = searchParams.get('year');
    if (yearParam) {
      setSelectedYear(yearParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!selectedCourse) return;
    apiRequest<{ questions: QuestionPublic[] }>(
      `/api/questions?course=${encodeURIComponent(selectedCourse)}`
    )
      .then((res) => {
        setCourseQuestions(res.questions);
      })
      .catch(() => {
        setCourseQuestions([]);
      });
  }, [selectedCourse]);

  const activeCourse = useMemo(
    () => courses.find((c) => c.code === selectedCourse || c.id === selectedCourse) || null,
    [courses, selectedCourse]
  );

  const availableSessions = useMemo(() => {
    const fromQuestions = Array.from(new Set(courseQuestions.map((q) => q.examination_year)));
    const combined = Array.from(
      new Set([...(activeCourse?.sessions_available ?? []), ...fromQuestions])
    );
    return combined.sort().reverse();
  }, [activeCourse, courseQuestions]);

  const { availableCbtCount, availableTheoryCount, availableTotalCount } = useMemo(() => {
    const scoped =
      selectedYear === 'all'
        ? courseQuestions
        : courseQuestions.filter((q) => q.examination_year === selectedYear);
    const cbt = scoped.filter((q) => q.question_type !== 'theory').length;
    const theory = scoped.filter((q) => q.question_type === 'theory').length;
    return {
      availableCbtCount: cbt,
      availableTheoryCount: theory,
      availableTotalCount: scoped.length,
    };
  }, [courseQuestions, selectedYear]);

  // Keep selectedYear valid when switching courses
  useEffect(() => {
    if (
      selectedYear !== 'all' &&
      availableSessions.length > 0 &&
      !availableSessions.includes(selectedYear)
    ) {
      setSelectedYear('all');
    }
  }, [availableSessions, selectedYear]);

  // Auto-switch format cleanly if current format has 0 items for the chosen paper
  useEffect(() => {
    if (courseQuestions.length === 0) return;
    if (mode === 'cbt' && availableCbtCount === 0 && availableTheoryCount > 0) {
      setMode('theory');
    } else if (mode === 'theory' && availableTheoryCount === 0 && availableCbtCount > 0) {
      setMode('cbt');
    }
  }, [availableCbtCount, availableTheoryCount, courseQuestions.length, mode]);

  const currentModeCount =
    mode === 'cbt'
      ? availableCbtCount
      : mode === 'theory'
      ? availableTheoryCount
      : availableTotalCount;

  const handleStartExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStarting(true);
    try {
      const res = await apiRequest<{ attempt: ExamAttempt }>('/api/exams/start', {
        method: 'POST',
        body: JSON.stringify({
          course_code: selectedCourse,
          mode,
          question_count: questionCount,
          duration_minutes: durationMinutes,
          examination_year: selectedYear,
        }),
      });
      navigate(res.attempt.mode === 'theory' ? `/exams/theory/${res.attempt.id}` : `/exams/cbt/${res.attempt.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to start examination.');
    } finally {
      setStarting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#1A1635]">ND2 Examination Centre</h1>
          <p className="text-sm text-[#5E5780] mt-1">
            Sit timed CBT Objective or Theory Essay examinations extracted from verified ND2 past papers.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 prepwise-card p-6 sm:p-7 space-y-5">
            <h2 className="font-display text-lg font-bold text-[#1A1635]">Examination Setup & Instructions</h2>

            {error && (
              <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {error}
              </div>
            )}

            <form onSubmit={handleStartExam} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="exam-course" className="block text-xs font-semibold text-[#1A1635] mb-1.5">
                    Select ND2 Course
                  </label>
                  <select
                    id="exam-course"
                    value={selectedCourse}
                    onChange={(e) => {
                      setSelectedCourse(e.target.value);
                      setSelectedYear('all');
                      setError('');
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DED9F2] bg-white text-sm"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.code}>
                        {c.code} — {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="exam-year" className="block text-xs font-semibold text-[#1A1635] mb-1.5">
                    Past Paper Session
                  </label>
                  <select
                    id="exam-year"
                    value={selectedYear}
                    onChange={(e) => {
                      setSelectedYear(e.target.value);
                      setError('');
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DED9F2] bg-white text-sm"
                  >
                    <option value="all">All Past Sessions ({courseQuestions.length} Qs)</option>
                    {availableSessions.map((session) => (
                      <option key={session} value={session}>
                        {session} Session
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-[#1A1635]">Examination Format</span>
                  <span className="text-[11px] font-medium text-[#5E5780] tabular-nums">
                    Available: {availableCbtCount} Objective · {availableTheoryCount} Theory
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'cbt' as ExamMode, label: 'CBT Objective', count: availableCbtCount },
                    { id: 'theory' as ExamMode, label: 'Theory Essay', count: availableTheoryCount },
                    { id: 'mixed' as ExamMode, label: 'Mixed Paper', count: availableTotalCount },
                  ].map((opt) => {
                    const isDisabled = courseQuestions.length > 0 && opt.count === 0;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          setMode(opt.id);
                          setError('');
                        }}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition-colors flex flex-col items-center gap-0.5 ${
                          mode === opt.id
                            ? 'bg-[#6B34E8] border-[#6B34E8] text-white'
                            : isDisabled
                            ? 'bg-[#F8F7FC] border-[#ECE8F8] text-[#A29BBF] cursor-not-allowed'
                            : 'bg-white border-[#DED9F2] text-[#1A1635] hover:bg-[#FAF9FE]'
                        }`}
                      >
                        <span>{opt.label}</span>
                        <span
                          className={`text-[10px] font-mono tabular-nums ${
                            mode === opt.id ? 'text-[#DDD6FE]' : 'text-[#6D658F]'
                          }`}
                        >
                          {opt.count} Qs
                        </span>
                      </button>
                    );
                  })}
                </div>
                {courseQuestions.length > 0 && availableCbtCount === 0 && availableTheoryCount > 0 && (
                  <p className="text-[11px] text-[#5B21B6] bg-[#F5F3FF] border border-[#E4DDFE] rounded-lg px-3 py-1.5 mt-2">
                    This past paper session contains Theory Essay questions only — format set to Theory Essay.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="exam-qcount" className="block text-xs font-semibold text-[#1A1635] mb-1.5">
                    Max Questions {currentModeCount > 0 ? `(up to ${Math.min(60, currentModeCount)})` : ''}
                  </label>
                  <input
                    id="exam-qcount"
                    type="number"
                    min={1}
                    max={60}
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#DED9F2] text-sm font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="exam-duration" className="block text-xs font-semibold text-[#1A1635] mb-1.5">
                    Duration (Minutes)
                  </label>
                  <input
                    id="exam-duration"
                    type="number"
                    min={5}
                    max={180}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#DED9F2] text-sm font-mono tabular-nums"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF9FE] border border-[#E8E4F6] text-xs text-[#4A436D] space-y-1.5">
                <div className="font-semibold text-[#1A1635]">Examination Hall Rules (ND2)</div>
                <p>1. Your timer persists across page refreshes and is enforced on the server.</p>
                <p>2. Official answer keys remain locked until you submit or time expires.</p>
                <p>3. You may flag questions for review and revisit them from the palette before submitting.</p>
              </div>

              <button
                type="submit"
                disabled={starting || (courseQuestions.length > 0 && currentModeCount === 0)}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#7B3FE4] to-[#6327E3] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-60"
              >
                <PlaySquare className="w-4 h-4" />
                <span>{starting ? 'Preparing Examination Paper...' : 'Start Timed Examination'}</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-5 prepwise-card p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-[#1A1635]">Your Recent Attempts</h2>
            {attempts.length === 0 ? (
              <p className="text-xs text-[#6D658F] py-8 text-center">
                No examinations attempted yet. Start your first ND2 timed paper on the left.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {attempts.map((a) => (
                  <div
                    key={a.id}
                    className="p-3.5 rounded-xl bg-[#FAF9FE] border border-[#ECE8F8] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#1A1635] truncate">
                        {a.course_code} · {a.mode.toUpperCase()}
                      </div>
                      <div className="text-[11px] text-[#6D658F] mt-0.5 tabular-nums">
                        {a.status === 'in_progress'
                          ? 'In Progress'
                          : `${a.percentage}% (${a.total_score}/${a.max_score})`}
                      </div>
                    </div>
                    <Link
                      to={
                        a.status === 'in_progress'
                          ? a.mode === 'theory'
                            ? `/exams/theory/${a.id}`
                            : `/exams/cbt/${a.id}`
                          : `/exams/results/${a.id}`
                      }
                      className="px-3 py-1.5 rounded-lg bg-white border border-[#DED8F4] text-xs font-semibold text-[#6B34E8] whitespace-nowrap"
                    >
                      {a.status === 'in_progress' ? 'Resume' : 'View Results'}
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export function LiveExamRunnerPage({ expectedMode }: { expectedMode: 'cbt' | 'theory' }) {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [questions, setQuestions] = useState<QuestionPublic[]>([]);
  const [answersMap, setAnswersMap] = useState<Record<string, string>>({});
  const [flaggedMap, setFlaggedMap] = useState<Record<string, boolean>>({});
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!attemptId) return;
    apiRequest<{
      attempt: ExamAttempt;
      questions: QuestionPublic[];
      answers: StudentAnswer[];
      remaining_seconds: number;
    }>(`/api/exams/attempts/${attemptId}`)
      .then((res) => {
        if (res.attempt.status !== 'in_progress') {
          navigate(`/exams/results/${res.attempt.id}`, { replace: true });
          return;
        }
        setAttempt(res.attempt);
        setQuestions(res.questions);
        setRemainingSeconds(res.remaining_seconds);
        const ansInit: Record<string, string> = {};
        const flagInit: Record<string, boolean> = {};
        for (const a of res.answers) {
          ansInit[a.question_id] = a.selected_answer;
          flagInit[a.question_id] = a.flagged_for_review;
        }
        setAnswersMap(ansInit);
        setFlaggedMap(flagInit);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Unable to load examination.'))
      .finally(() => setLoading(false));
  }, [attemptId, navigate]);

  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress') return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          void handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt?.id]);

  const persistAnswer = async (questionId: string, selectedAnswer: string, flagged?: boolean) => {
    if (!attemptId) return;
    try {
      await apiRequest(`/api/exams/attempts/${attemptId}/answer`, {
        method: 'POST',
        body: JSON.stringify({
          question_id: questionId,
          selected_answer: selectedAnswer,
          flagged_for_review: flagged,
        }),
      });
    } catch {
      // Final bulk submission also includes answersMap
    }
  };

  const handleSelectAnswer = (questionId: string, val: string) => {
    setAnswersMap((prev) => ({ ...prev, [questionId]: val }));
    void persistAnswer(questionId, val, flaggedMap[questionId]);
  };

  const handleToggleFlag = (questionId: string) => {
    const nextFlag = !flaggedMap[questionId];
    setFlaggedMap((prev) => ({ ...prev, [questionId]: nextFlag }));
    void persistAnswer(questionId, answersMap[questionId] || '', nextFlag);
  };

  const handleSubmitExam = async () => {
    if (!attemptId || submitting) return;
    setSubmitting(true);
    try {
      const payload = Object.entries(answersMap).map(([question_id, selected_answer]) => ({
        question_id,
        selected_answer,
      }));
      await apiRequest(`/api/exams/attempts/${attemptId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers: payload }),
      });
      navigate(`/exams/results/${attemptId}`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Submission failed.');
      setSubmitting(false);
    }
  };

  const currentQuestion = questions[currentIdx];
  const answeredCount = useMemo(
    () => questions.filter((q) => (answersMap[q.id] || '').trim().length > 0).length,
    [questions, answersMap]
  );

  return (
    <AppShell>
      {loading ? (
        <div className="prepwise-card p-10 text-center text-sm text-[#6D658F]">Loading examination room...</div>
      ) : error || !attempt || !currentQuestion ? (
        <div className="prepwise-card p-10 text-center space-y-3">
          <p className="text-sm text-rose-700">{error || 'Examination unavailable.'}</p>
          <Link to="/exams" className="text-xs font-semibold text-[#6B34E8] hover:underline">
            Return to Examination Centre
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Exam Top Strip */}
          <div className="prepwise-card p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-medium text-[#6D658F]">
                {attempt.course_code} · {attempt.academic_level} · {expectedMode === 'theory' ? 'Theory Paper' : 'CBT Examination'}
              </div>
              <h1 className="font-display text-lg font-bold text-[#1A1635]">{attempt.course_title}</h1>
            </div>

            <div className="flex items-center gap-3">
              <div
                aria-label="Remaining examination time"
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-sm font-bold tabular-nums ${
                  remainingSeconds <= 120
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-[#EDE9FE] text-[#4C1D95]'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>{formatTimer(remainingSeconds)}</span>
              </div>

              <button
                type="button"
                onClick={() => setConfirmSubmit(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#7B3FE4] to-[#6327E3] text-white text-xs font-semibold whitespace-nowrap"
              >
                Submit Exam
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Active Question Card */}
            <div className="lg:col-span-8 prepwise-card p-6 sm:p-7 space-y-5">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#F0EDF8]">
                <div className="text-xs font-semibold text-[#6D658F] tabular-nums">
                  Question {currentIdx + 1} of {questions.length} · {currentQuestion.topic_name}
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFlag(currentQuestion.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                    flaggedMap[currentQuestion.id]
                      ? 'bg-amber-50 border-amber-300 text-amber-800'
                      : 'bg-white border-[#E5E1F4] text-[#5E5780]'
                  }`}
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>{flaggedMap[currentQuestion.id] ? 'Flagged' : 'Flag for Review'}</span>
                </button>
              </div>

              <p className="text-base font-medium text-[#1A1635] whitespace-pre-line leading-relaxed">
                {currentQuestion.question_text}
              </p>

              {(currentQuestion.question_type === 'mcq' || currentQuestion.question_type === 'true_false') &&
                currentQuestion.options && (
                  <div className="space-y-2.5">
                    {currentQuestion.options.map((opt) => {
                      const val = currentQuestion.question_type === 'true_false' ? opt.text : opt.label;
                      const selected = answersMap[currentQuestion.id] === val;
                      return (
                        <label
                          key={opt.label}
                          className={`flex items-center gap-3 p-3.5 rounded-xl border text-sm cursor-pointer transition-colors ${
                            selected
                              ? 'border-[#6B34E8] bg-[#FAF7FF] font-semibold text-[#1A1635]'
                              : 'border-[#E5E1F4] hover:bg-[#FAF9FE]'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`exam-q-${currentQuestion.id}`}
                            value={val}
                            checked={selected}
                            onChange={() => handleSelectAnswer(currentQuestion.id, val)}
                            className="accent-[#6B34E8]"
                          />
                          {currentQuestion.question_type === 'mcq' && (
                            <span className="font-mono text-xs font-bold text-[#6B34E8]">{opt.label}.</span>
                          )}
                          <span>{opt.text}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

              {currentQuestion.question_type === 'fill_gap' && (
                <input
                  type="text"
                  value={answersMap[currentQuestion.id] || ''}
                  onChange={(e) => handleSelectAnswer(currentQuestion.id, e.target.value)}
                  placeholder="Enter your answer..."
                  className="w-full px-4 py-3 rounded-xl border border-[#DED9F2] text-sm"
                />
              )}

              {currentQuestion.question_type === 'theory' && (
                <div className="space-y-2">
                  <label htmlFor="theory-editor" className="block text-xs font-semibold text-[#5E5780]">
                    Structured Theory / Worked Steps
                  </label>
                  <textarea
                    id="theory-editor"
                    rows={9}
                    value={answersMap[currentQuestion.id] || ''}
                    onChange={(e) => handleSelectAnswer(currentQuestion.id, e.target.value)}
                    placeholder="Write clear definitions, formulas, derivations, or structured bullet points..."
                    className="w-full px-4 py-3 rounded-xl border border-[#DED9F2] text-sm leading-relaxed"
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-[#F0EDF8]">
                <button
                  type="button"
                  disabled={currentIdx === 0}
                  onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#DED8F4] text-xs font-semibold text-[#1A1635] disabled:opacity-40"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                {currentIdx < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1A1635] text-white text-xs font-semibold"
                  >
                    <span>Next Question</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmSubmit(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#7B3FE4] to-[#6327E3] text-white text-xs font-semibold"
                  >
                    <span>Finish & Submit</span>
                  </button>
                )}
              </div>
            </div>

            {/* Question Navigator Palette */}
            <div className="lg:col-span-4 prepwise-card p-5 space-y-4 h-fit">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-bold text-[#1A1635]">Question Navigator</h2>
                <span className="text-xs font-mono text-[#5E5780] tabular-nums">
                  {answeredCount}/{questions.length} Answered
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const isAnswered = (answersMap[q.id] || '').trim().length > 0;
                  const isFlagged = Boolean(flaggedMap[q.id]);
                  const isCurrent = idx === currentIdx;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentIdx(idx)}
                      aria-label={`Jump to question ${idx + 1}`}
                      className={`h-10 rounded-xl font-mono text-xs font-bold border transition-colors tabular-nums ${
                        isCurrent
                          ? 'bg-[#6B34E8] text-white border-[#6B34E8]'
                          : isFlagged
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : isAnswered
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-white text-[#5E5780] border-[#E5E1F4]'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {confirmSubmit && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
              <div className="max-w-md w-full prepwise-card p-6 space-y-4">
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="w-5 h-5 text-[#6B34E8]" />
                  <h2 className="font-display text-lg font-bold text-[#1A1635]">Submit Examination?</h2>
                </div>
                <p className="text-sm text-[#5E5780]">
                  You have answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions. Once submitted, your score is recorded and official answer keys are unlocked.
                </p>
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setConfirmSubmit(false)}
                    className="px-4 py-2 rounded-xl border border-[#DED8F4] text-xs font-semibold text-[#1A1635]"
                  >
                    Continue Exam
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleSubmitExam()}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#7B3FE4] to-[#6327E3] text-white text-xs font-semibold"
                  >
                    {submitting ? 'Submitting...' : 'Confirm Submission'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}

export function ExamResultsPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!attemptId) return;
    apiRequest<{ attempt: ExamAttempt }>(`/api/exams/attempts/${attemptId}`)
      .then((res) => setAttempt(res.attempt))
      .finally(() => setLoading(false));
  }, [attemptId]);

  return (
    <AppShell>
      {loading ? (
        <div className="prepwise-card p-10 text-center text-sm text-[#6D658F]">Calculating examination results...</div>
      ) : !attempt ? (
        <div className="prepwise-card p-10 text-center text-sm text-rose-700">Examination attempt not found.</div>
      ) : (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="prepwise-hero-gradient rounded-2xl p-8 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="text-xs font-medium text-[#DDD6FE]">
                {attempt.course_code} · {attempt.academic_level} · {attempt.mode.toUpperCase()} Results
              </div>
              <h1 className="font-display text-3xl font-bold">{attempt.course_title}</h1>
              <p className="text-sm text-[#E9E2FF]">
                {attempt.passed
                  ? 'Passed ND2 threshold. Review your detailed answer explanations below.'
                  : 'Below ND2 pass threshold. Review official solutions and practise with AI Tutor.'}
              </p>
            </div>
            <div className="bg-white/15 border border-white/25 rounded-2xl px-6 py-4 text-center shrink-0">
              <div className="font-display text-4xl font-extrabold tabular-nums">{attempt.percentage}%</div>
              <div className="text-xs text-[#E9E2FF] mt-1 font-medium">
                ND2 Score
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="prepwise-card p-5">
              <div className="text-xs text-[#6D658F]">Outcome Status</div>
              <div className={`font-display text-xl font-bold mt-1 ${attempt.passed ? 'text-emerald-700' : 'text-amber-700'}`}>
                {attempt.passed ? 'Passed' : 'Needs Revision'}
              </div>
            </div>
            <div className="prepwise-card p-5">
              <div className="text-xs text-[#6D658F]">Objective Score</div>
              <div className="font-display text-xl font-bold text-[#1A1635] mt-1 tabular-nums">
                {attempt.objective_score} / {attempt.objective_total}
              </div>
            </div>
            <div className="prepwise-card p-5">
              <div className="text-xs text-[#6D658F]">Theory Score</div>
              <div className="font-display text-xl font-bold text-[#1A1635] mt-1 tabular-nums">
                {attempt.theory_score} / {attempt.theory_total}
              </div>
            </div>
          </div>

          <div className="prepwise-card p-6 flex flex-wrap items-center justify-between gap-4">
            <Link
              to={`/exams/review/${attempt.id}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7B3FE4] to-[#6327E3] text-white text-sm font-semibold"
            >
              <span>Open Detailed Answer Review</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3">
              <Link
                to={`/ai-tutor?course=${encodeURIComponent(attempt.course_code)}`}
                className="px-4 py-2.5 rounded-xl border border-[#DED8F4] text-xs font-semibold text-[#1A1635]"
              >
                Ask AI Tutor
              </Link>
              <Link
                to="/dashboard"
                className="px-4 py-2.5 rounded-xl border border-[#DED8F4] text-xs font-semibold text-[#1A1635]"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export function AnswerReviewPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<StudentAnswer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!attemptId) return;
    apiRequest<{ attempt: ExamAttempt; questions: Question[]; answers: StudentAnswer[] }>(
      `/api/exams/attempts/${attemptId}`
    )
      .then((res) => {
        setAttempt(res.attempt);
        setQuestions(res.questions);
        setAnswers(res.answers);
      })
      .finally(() => setLoading(false));
  }, [attemptId]);

  const answerMap = new Map(answers.map((a) => [a.question_id, a]));

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Link to={attempt ? `/exams/results/${attempt.id}` : '/exams'} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B34E8] hover:underline">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Results Summary</span>
          </Link>
          {attempt && (
            <div className="text-xs font-semibold text-[#1A1635] tabular-nums">
              {attempt.course_code} · Final Score: {attempt.percentage}%
            </div>
          )}
        </div>

        {loading ? (
          <div className="prepwise-card p-10 text-center text-sm text-[#6D658F]">Loading detailed review...</div>
        ) : (
          <div className="space-y-4">
            {questions.map((q, idx) => {
              const ans = answerMap.get(q.id);
              return (
                <div key={q.id} className="prepwise-card p-6 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6D658F]">
                    <span>
                      Q{idx + 1} · {q.topic_name} · {q.examination_year}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold">
                      {ans?.is_correct ? (
                        <span className="text-emerald-700 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          Correct
                        </span>
                      ) : (
                        <span className="text-rose-700 inline-flex items-center gap-1">
                          <XCircle className="w-4 h-4" />
                          {ans?.selected_answer ? 'Needs Review' : 'Unanswered'}
                        </span>
                      )}
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-[#1A1635] whitespace-pre-line">{q.question_text}</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-[#FAF9FE] border border-[#E5E0F5]">
                      <div className="font-semibold text-[#5E5780] mb-1">Your Submitted Answer</div>
                      <div className="text-[#1A1635] whitespace-pre-line">
                        {ans?.selected_answer || 'No answer submitted'}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0]">
                      <div className="font-semibold text-emerald-800 mb-1">
                        {q.verification_status === 'verified' ? 'Official Answer Key' : 'Unverified Answer Key'}
                      </div>
                      <div className="text-emerald-950 whitespace-pre-line">
                        {q.correct_answer || q.official_solution_excerpt || 'Refer to AI Tutor for explanation.'}
                      </div>
                    </div>
                  </div>

                  {q.official_solution_excerpt && q.correct_answer && (
                    <div className="text-xs text-[#3C355C] bg-[#FAF9FE] p-3.5 rounded-xl">
                      <strong>Worked Solution:</strong> {q.official_solution_excerpt}
                    </div>
                  )}

                  {ans?.ai_feedback && (
                    <div className="text-xs text-[#4C1D95] bg-[#EDE9FE]/50 p-3 rounded-xl">
                      <strong>Rubric Check:</strong> {ans.ai_feedback}
                    </div>
                  )}

                  <div className="pt-1">
                    <Link
                      to={`/ai-tutor?course=${encodeURIComponent(q.course_code)}&questionId=${encodeURIComponent(q.id)}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0369A1] hover:underline"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      <span>Ask AI Tutor to explain this question step-by-step -&gt;</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
