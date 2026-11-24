import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bookmark, Bot, CheckCircle2, Eye, Search, XCircle } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { apiRequest, ApiError } from '../lib/api';
import type { Course, QuestionPublic, Topic, VerificationStatus } from '../types';

type LibraryQuestion = QuestionPublic & { is_saved?: boolean };

interface CheckFeedback {
  is_correct: boolean | null;
  marks_awarded: number;
  max_marks: number;
  correct_answer: string | null;
  official_solution_excerpt: string | null;
  marking_scheme: string[];
  verification_status: VerificationStatus;
  source_citation: string;
}

export function QuestionLibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [questions, setQuestions] = useState<LibraryQuestion[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [courseFilter, setCourseFilter] = useState(searchParams.get('course') || 'all');
  const [semesterFilter, setSemesterFilter] = useState(searchParams.get('semester') || 'all');
  const [yearFilter, setYearFilter] = useState(searchParams.get('year') || 'all');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || 'all');
  const [topicFilter, setTopicFilter] = useState(searchParams.get('topic') || 'all');
  const [searchText, setSearchText] = useState(searchParams.get('q') || '');

  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [feedbackMap, setFeedbackMap] = useState<Record<string, CheckFeedback>>({});
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAll, setShowAll] = useState(false);

  const PAGE_SIZE = 25;

  const fetchQuestions = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (courseFilter !== 'all') params.set('course', courseFilter);
    if (semesterFilter !== 'all') params.set('semester', semesterFilter);
    if (yearFilter !== 'all') params.set('year', yearFilter);
    if (typeFilter !== 'all') params.set('type', typeFilter);
    if (topicFilter !== 'all') params.set('topic', topicFilter);
    if (searchText.trim()) params.set('q', searchText.trim());

    setError('');
    try {
      const res = await apiRequest<{
        questions: LibraryQuestion[];
        courses: Course[];
        topics: Topic[];
        years: string[];
      }>(`/api/questions?${params.toString()}`);
      setQuestions(res.questions);
      setCourses(res.courses);
      setTopics(res.topics);
      setYears(res.years);
      setCurrentPage(1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load practice questions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseFilter, semesterFilter, yearFilter, typeFilter, topicFilter]);

  useEffect(() => {
    const qParam = searchParams.get('q') || '';
    const cParam = searchParams.get('course') || 'all';
    const tParam = searchParams.get('topic') || 'all';
    const yParam = searchParams.get('year') || 'all';
    const sParam = searchParams.get('semester') || 'all';
    const typeParam = searchParams.get('type') || 'all';
    setSearchText(qParam);
    if (cParam !== courseFilter) setCourseFilter(cParam);
    if (tParam !== topicFilter) setTopicFilter(tParam);
    if (yParam !== yearFilter) setYearFilter(yParam);
    if (sParam !== semesterFilter) setSemesterFilter(sParam);
    if (typeParam !== typeFilter) setTypeFilter(typeParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (searchText.trim()) next.set('q', searchText.trim());
    else next.delete('q');
    setSearchParams(next);
    void fetchQuestions();
  };

  const handleCheck = async (questionId: string, revealOnly = false) => {
    setCheckingId(questionId);
    setError('');
    try {
      const res = await apiRequest<CheckFeedback>(`/api/questions/${questionId}/check`, {
        method: 'POST',
        body: JSON.stringify({
          selected_answer: draftAnswers[questionId] || '',
          reveal_only: revealOnly,
        }),
      });
      setFeedbackMap((prev) => ({ ...prev, [questionId]: res }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to check question answer.');
    } finally {
      setCheckingId(null);
    }
  };

  const toggleSave = async (question: LibraryQuestion) => {
    setError('');
    try {
      if (question.is_saved) {
        await apiRequest(`/api/saved-questions/${question.id}`, { method: 'DELETE' });
        setQuestions((prev) => prev.map((q) => (q.id === question.id ? { ...q, is_saved: false } : q)));
      } else {
        await apiRequest('/api/saved-questions', {
          method: 'POST',
          body: JSON.stringify({ question_id: question.id }),
        });
        setQuestions((prev) => prev.map((q) => (q.id === question.id ? { ...q, is_saved: true } : q)));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update saved questions.');
    }
  };

  const visibleTopics =
    courseFilter === 'all'
      ? topics
      : topics.filter((t) => t.course_code === courseFilter || t.course_id === courseFilter);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#1A1635]">ND2 Past-Question Library</h1>
            <p className="text-sm text-[#5E5780] mt-1">
              Authentic ND2 curriculum and past questions with official solution verification.
            </p>
          </div>
          <Link
            to="/exams"
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#7B3FE4] to-[#6327E3] text-white text-xs font-semibold whitespace-nowrap self-start"
          >
            Switch to Timed Exam -&gt;
          </Link>
        </div>

        {error && (
          <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
            {error}
          </div>
        )}

        {/* Filter Bar */}
        <div className="prepwise-card p-4 space-y-3">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#6D658F] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search question keywords, topics, formulas..."
                className="w-full pl-10 pr-3 py-2 rounded-xl border border-[#E5E1F4] text-sm focus:outline-none focus:ring-2 focus:ring-[#7B3FE4]/25"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#1A1635] text-white text-xs font-semibold whitespace-nowrap"
            >
              Search Bank
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            <select
              aria-label="Filter by course"
              value={courseFilter}
              onChange={(e) => {
                setCourseFilter(e.target.value);
                setTopicFilter('all');
              }}
              className="px-3 py-2 rounded-xl border border-[#E5E1F4] bg-white text-xs text-[#1A1635]"
            >
              <option value="all">All ND2 Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by semester"
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[#E5E1F4] bg-white text-xs text-[#1A1635]"
            >
              <option value="all">All Semesters</option>
              <option value="First Semester">First Semester</option>
              <option value="Second Semester">Second Semester</option>
            </select>

            <select
              aria-label="Filter by year"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[#E5E1F4] bg-white text-xs text-[#1A1635]"
            >
              <option value="all">All Exam Years</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by question type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[#E5E1F4] bg-white text-xs text-[#1A1635]"
            >
              <option value="all">All Question Types</option>
              <option value="mcq">Multiple Choice (MCQ)</option>
              <option value="true_false">True or False</option>
              <option value="fill_gap">Fill in the Gap</option>
              <option value="theory">Theory / Essay</option>
            </select>

            <select
              aria-label="Filter by topic"
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[#E5E1F4] bg-white text-xs text-[#1A1635]"
            >
              <option value="all">All Topics</option>
              {visibleTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Questions List */}
        {loading ? (
          <div className="prepwise-card p-10 text-center text-sm text-[#6D658F]">Loading past questions...</div>
        ) : questions.length === 0 ? (
          <div className="prepwise-card p-10 text-center space-y-2">
            <p className="text-sm font-semibold text-[#1A1635]">No ND2 past questions match your criteria</p>
            <button
              type="button"
              onClick={() => {
                setCourseFilter('all');
                setSemesterFilter('all');
                setYearFilter('all');
                setTypeFilter('all');
                setTopicFilter('all');
                setSearchText('');
              }}
              className="text-xs font-semibold text-[#6B34E8] hover:underline"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {(() => {
              const totalPages = Math.max(1, Math.ceil(questions.length / PAGE_SIZE));
              const safePage = Math.min(currentPage, totalPages);
              const startIndex = showAll ? 0 : (safePage - 1) * PAGE_SIZE;
              const visibleQuestions = showAll
                ? questions
                : questions.slice(startIndex, startIndex + PAGE_SIZE);
              const endIndex = startIndex + visibleQuestions.length;

              return (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-[#5E5780]">
                    <span className="font-semibold text-[#1A1635] tabular-nums">
                      Showing {startIndex + 1}–{endIndex} of {questions.length} ND2 questions
                    </span>
                    {questions.length > PAGE_SIZE && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAll((prev) => !prev);
                            setCurrentPage(1);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-[#DED8F4] bg-white text-xs font-semibold text-[#4C1D95] hover:bg-[#FAF9FE]"
                        >
                          {showAll ? 'Paginate (25/page)' : `Show All (${questions.length})`}
                        </button>
                      </div>
                    )}
                  </div>

                  {visibleQuestions.map((q) => {
              const fb = feedbackMap[q.id];
              const currentDraft = draftAnswers[q.id] || '';
              return (
                <article key={q.id} className="prepwise-card p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-[15px] font-medium text-[#1A1635] whitespace-pre-line leading-relaxed flex-1">
                      {q.question_text}
                    </p>
                    <button
                      type="button"
                      onClick={() => void toggleSave(q)}
                      aria-label={q.is_saved ? `Remove bookmark for ${q.course_code} Q${q.question_number}` : `Bookmark ${q.course_code} Q${q.question_number}`}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors shrink-0 ${
                        q.is_saved
                          ? 'bg-[#EDE9FE] border-[#C4B5FD] text-[#5B21B6]'
                          : 'bg-white border-[#E5E1F4] text-[#5E5780] hover:text-[#1A1635]'
                      }`}
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${q.is_saved ? 'fill-current' : ''}`} />
                      <span>{q.is_saved ? 'Saved' : 'Save'}</span>
                    </button>
                  </div>

                  {/* Interactive Practice Input */}
                  {(q.question_type === 'mcq' || q.question_type === 'true_false') && q.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {q.options.map((opt) => {
                        const value = q.question_type === 'true_false' ? opt.text : opt.label;
                        const selected = currentDraft === value;
                        return (
                          <label
                            key={opt.label}
                            className={`flex items-center gap-2.5 p-3 rounded-xl border text-sm cursor-pointer transition-colors ${
                              selected
                                ? 'border-[#6B34E8] bg-[#FAF7FF] text-[#1A1635] font-medium'
                                : 'border-[#E6E2F5] hover:bg-[#FAF9FE]'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`practice-${q.id}`}
                              value={value}
                              checked={selected}
                              onChange={() => setDraftAnswers((prev) => ({ ...prev, [q.id]: value }))}
                              className="accent-[#6B34E8]"
                            />
                            {q.question_type === 'mcq' && (
                              <span className="font-mono text-xs font-bold text-[#6B34E8]">{opt.label}.</span>
                            )}
                            <span>{opt.text}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {q.question_type === 'fill_gap' && (
                    <div>
                      <input
                        type="text"
                        value={currentDraft}
                        onChange={(e) => setDraftAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="Type your concise answer..."
                        aria-label={`Answer for ${q.course_code} question ${q.question_number}`}
                        className="w-full max-w-md px-3.5 py-2 rounded-xl border border-[#DED9F2] text-sm focus:outline-none focus:ring-2 focus:ring-[#7B3FE4]/30"
                      />
                    </div>
                  )}

                  {q.question_type === 'theory' && (
                    <div>
                      <textarea
                        rows={4}
                        value={currentDraft}
                        onChange={(e) => setDraftAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="Draft your structured worked solution or essay points..."
                        aria-label={`Theory response for ${q.course_code} question ${q.question_number}`}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#DED9F2] text-sm focus:outline-none focus:ring-2 focus:ring-[#7B3FE4]/30"
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      disabled={checkingId === q.id}
                      onClick={() => void handleCheck(q.id, false)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#7B3FE4] to-[#6327E3] text-white text-xs font-semibold hover:opacity-95 disabled:opacity-60"
                    >
                      {checkingId === q.id ? 'Checking...' : 'Check Answer'}
                    </button>
                    <button
                      type="button"
                      disabled={checkingId === q.id}
                      onClick={() => void handleCheck(q.id, true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#DED8F4] text-xs font-semibold text-[#1A1635] hover:bg-[#FAF9FE]"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Reveal Worked Solution</span>
                    </button>
                    <Link
                      to={`/ai-tutor?course=${encodeURIComponent(q.course_code)}&questionId=${encodeURIComponent(q.id)}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#D4E6FC] bg-[#F0F7FF] text-xs font-semibold text-[#0369A1] hover:bg-[#E0F2FE]"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      <span>Ask AI Tutor</span>
                    </Link>
                  </div>

                  {fb && (
                    <div className="p-4 rounded-xl bg-[#FAF9FE] border border-[#E5E0F5] space-y-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-semibold">
                          {fb.is_correct === true && (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span className="text-emerald-700">Correct</span>
                            </>
                          )}
                          {fb.is_correct === false && (
                            <>
                              <XCircle className="w-4 h-4 text-rose-600" />
                              <span className="text-rose-700">Needs Review</span>
                            </>
                          )}
                          {fb.is_correct === null && (
                            <span className="text-[#4C1D95]">
                              {fb.verification_status === 'verified' ? 'Official Solution Reference' : 'Unverified Key'}
                            </span>
                          )}
                        </div>
                        <span className="text-[#6D658F]">{q.course_code} · {q.topic_name}</span>
                      </div>

                      {fb.correct_answer && (
                        <div className="text-[#1A1635]">
                          <strong>Official Answer Key:</strong> {fb.correct_answer}
                        </div>
                      )}
                      {fb.official_solution_excerpt && (
                        <div className="text-[#3C355C] whitespace-pre-line leading-relaxed">
                          <strong>Worked Solution:</strong> {fb.official_solution_excerpt}
                        </div>
                      )}
                      {fb.marking_scheme.length > 0 && (
                        <div className="text-[#3C355C]">
                          <strong>Marking Scheme:</strong>
                          <ul className="list-disc pl-5 mt-1 space-y-0.5">
                            {fb.marking_scheme.map((m, idx) => (
                              <li key={idx}>{m}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
                  })}

                  {!showAll && totalPages > 1 && (
                    <div className="prepwise-card p-4 flex items-center justify-between gap-3">
                      <span className="text-xs text-[#5E5780] tabular-nums">
                        Page {safePage} of {totalPages}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={safePage <= 1}
                          onClick={() => {
                            setCurrentPage((p) => Math.max(1, p - 1));
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="px-3.5 py-1.5 rounded-lg border border-[#DED8F4] text-xs font-semibold text-[#1A1635] disabled:opacity-40 hover:bg-[#FAF9FE]"
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          disabled={safePage >= totalPages}
                          onClick={() => {
                            setCurrentPage((p) => Math.min(totalPages, p + 1));
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-[#6B34E8] text-white text-xs font-semibold disabled:opacity-40 hover:opacity-95"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </AppShell>
  );
}
