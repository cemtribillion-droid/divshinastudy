import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Layers,
  PlaySquare,
  Search,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { MarkdownLessonView } from '../components/MarkdownLessonView';
import { apiRequest, ApiError } from '../lib/api';
import type { Course, CurriculumModule, Department, QuestionPublic, Topic } from '../types';

type EnrichedCourse = Course & {
  topic_count: number;
  module_count?: number;
  question_count: number;
  objective_count: number;
  theory_count: number;
  mastery_percentage: number;
};

export function CourseLibraryPage() {
  const [courses, setCourses] = useState<EnrichedCourse[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<{ departments: Department[]; courses: EnrichedCourse[] }>('/api/courses')
      .then((res) => {
        setDepartments(res.departments);
        setCourses(res.courses);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Unable to load ND2 courses.');
      })
      .finally(() => setLoading(false));
  }, []);

  const visibleCourses = courses
    .filter((c) => (semesterFilter === 'all' ? true : c.semester === semesterFilter))
    .filter((c) => (deptFilter === 'all' ? true : c.department_id === deptFilter))
    .filter((c) => {
      if (!query.trim()) return true;
      const t = query.trim().toLowerCase();
      return (
        c.code.toLowerCase().includes(t) ||
        c.title.toLowerCase().includes(t) ||
        c.description.toLowerCase().includes(t)
      );
    });

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#1A1635]">ND2 Course Library</h1>
            <p className="text-sm text-[#5E5780] mt-1">
              Verified National Diploma 2 (ND2) courses across First and Second Semesters with structured study modules.
            </p>
          </div>
          <div className="text-xs font-semibold text-[#4C1D95] bg-[#EDE9FE] px-3.5 py-2 rounded-xl whitespace-nowrap self-start">
            Academic Level: ND2
          </div>
        </div>

        {/* Filters */}
        <div className="prepwise-card p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#6D658F] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by course code or title (e.g. COM 211, Java, UML, Statistics, GNS 201)..."
              className="w-full pl-10 pr-3 py-2 rounded-xl border border-[#E5E1F4] text-sm focus:outline-none focus:ring-2 focus:ring-[#7B3FE4]/25"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by semester"
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[#E5E1F4] bg-white text-sm text-[#1A1635]"
            >
              <option value="all">All ND2 Semesters</option>
              <option value="First Semester">First Semester</option>
              <option value="Second Semester">Second Semester</option>
            </select>

            <select
              aria-label="Filter by department"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[#E5E1F4] bg-white text-sm text-[#1A1635]"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="prepwise-card p-10 text-center text-sm text-[#6D658F]">Loading ND2 courses...</div>
        ) : visibleCourses.length === 0 ? (
          <div className="prepwise-card p-10 text-center space-y-2">
            <p className="text-sm font-semibold text-[#1A1635]">No ND2 courses match your filter</p>
            <button
              type="button"
              onClick={() => {
                setSemesterFilter('all');
                setDeptFilter('all');
                setQuery('');
              }}
              className="text-xs font-semibold text-[#6B34E8] hover:underline"
            >
              Reset course filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {visibleCourses.map((course) => (
              <div key={course.id} className="prepwise-card p-6 flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs font-medium text-[#6D658F]">
                    <span>
                      {course.code} · {course.semester} · {course.credit_units} Units
                    </span>
                    {Boolean(course.module_count && course.module_count > 0) && (
                      <span className="text-[11px] font-semibold text-[#6B34E8]">
                        {course.module_count} Modules
                      </span>
                    )}
                  </div>
                  <h2 className="font-display text-lg font-bold text-[#1A1635]">{course.title}</h2>
                  <p className="text-xs text-[#5E5780] leading-relaxed line-clamp-3">{course.description}</p>
                </div>

                <div className="space-y-3 pt-2 border-t border-[#F0EDF8]">
                  <div className="flex items-center justify-between text-xs text-[#5E5780] tabular-nums">
                    <span>{course.question_count} Questions ({course.objective_count} Obj / {course.theory_count} Theory)</span>
                    <span className="font-semibold text-[#1A1635]">{course.mastery_percentage}% Mastery</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#EFEBF9] overflow-hidden">
                    <div
                      className="h-full bg-[#6B34E8] rounded-full transition-all"
                      style={{ width: `${course.mastery_percentage}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Link
                      to={`/courses/${encodeURIComponent(course.code)}`}
                      className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-[#7B3FE4] to-[#6327E3] text-white text-xs font-semibold text-center whitespace-nowrap"
                    >
                      Open Course
                    </Link>
                    <Link
                      to={`/exams?course=${encodeURIComponent(course.code)}`}
                      className="py-2 px-3 rounded-xl border border-[#DED8F4] text-xs font-semibold text-[#4C1D95] hover:bg-[#FAF9FE] whitespace-nowrap"
                    >
                      Take Exam
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export function CourseDetailPage() {
  const { code } = useParams<{ code: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [topics, setTopics] = useState<
    Array<Topic & { mastery_percentage: number; questions_attempted: number; status: string; question_count: number }>
  >([]);
  const [questions, setQuestions] = useState<QuestionPublic[]>([]);
  const [modules, setModules] = useState<CurriculumModule[]>([]);
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const [selectedSession, setSelectedSession] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    setError('');
    setActiveModuleIndex(0);
    setSelectedSession('all');
    apiRequest<{
      course: Course;
      topics: Array<Topic & { mastery_percentage: number; questions_attempted: number; status: string; question_count: number }>;
      questions: QuestionPublic[];
      modules?: CurriculumModule[];
    }>(`/api/courses/${encodeURIComponent(code)}`)
      .then((res) => {
        setCourse(res.course);
        setTopics(res.topics);
        setQuestions(res.questions);
        setModules(res.modules ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load course details.'))
      .finally(() => setLoading(false));
  }, [code]);

  const activeModule = modules[activeModuleIndex];
  const activeLesson = activeModule?.lessons[0];
  const previewSessions = course
    ? Array.from(new Set([...course.sessions_available, ...questions.map((q) => q.examination_year)]))
    : [];
  const filteredQuestions =
    selectedSession === 'all'
      ? questions
      : questions.filter((q) => q.examination_year === selectedSession);

  return (
    <AppShell>
      <div className="space-y-6">
        <Link to="/courses" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B34E8] hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to ND2 Course Library</span>
        </Link>

        {loading ? (
          <div className="prepwise-card p-10 text-center text-sm text-[#6D658F]">Loading course details...</div>
        ) : error || !course ? (
          <div className="prepwise-card p-10 text-center text-sm text-rose-700">{error || 'Course not found.'}</div>
        ) : (
          <>
            <div className="prepwise-hero-gradient rounded-2xl p-7 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="text-xs font-medium text-[#DDD6FE]">
                  {course.code} · {course.academic_level} · {course.semester} · Department of {course.department_name}
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold">{course.title}</h1>
                <p className="text-sm text-[#E9E2FF] leading-relaxed">{course.description}</p>
                <div className="text-xs text-[#DDD6FE] pt-1">
                  Available Exam Sessions: {course.sessions_available.join(' · ')}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 shrink-0">
                <Link
                  to={`/questions?course=${encodeURIComponent(course.code)}`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#271968] text-xs font-bold hover:bg-[#F5F3FF] whitespace-nowrap"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  <span>Practice Questions</span>
                </Link>
                <Link
                  to={`/exams?course=${encodeURIComponent(course.code)}`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 border border-white/25 text-white text-xs font-semibold hover:bg-white/25 whitespace-nowrap"
                >
                  <PlaySquare className="w-4 h-4" />
                  <span>Start Timed Exam</span>
                </Link>
                <Link
                  to={`/ai-tutor?course=${encodeURIComponent(course.code)}`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 border border-white/25 text-white text-xs font-semibold hover:bg-white/25 whitespace-nowrap"
                >
                  <Bot className="w-4 h-4" />
                  <span>Ask AI Tutor</span>
                </Link>
              </div>
            </div>

            {/* Interactive Curriculum Study Modules & Lesson Reader */}
            {modules.length > 0 && activeModule && activeLesson && (
              <div className="prepwise-card p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#EFEBF9] pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#EDE9FE] text-[#6B34E8] flex items-center justify-center">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="font-display text-lg font-bold text-[#1A1635]">
                        Study Modules &amp; Lecture Notes
                      </h2>
                      <p className="text-xs text-[#6D658F]">
                        {modules.length} structured ND2 modules for {course.code}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-[#4C1D95] tabular-nums">
                    Module {activeModuleIndex + 1} of {modules.length}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Module Navigation List */}
                  <div className="lg:col-span-4 space-y-1.5 max-h-[540px] overflow-y-auto pr-1" role="tablist" aria-label="Course modules">
                    {modules.map((mod, idx) => {
                      const isActive = idx === activeModuleIndex;
                      return (
                        <button
                          key={mod.id}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          onClick={() => setActiveModuleIndex(idx)}
                          className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs transition-colors flex items-center justify-between gap-2 ${
                            isActive
                              ? 'bg-[#6B34E8] text-white border-[#6B34E8] font-semibold'
                              : 'bg-[#FAF9FE] text-[#1A1635] border-[#ECE8F8] hover:border-[#C4B5FD]'
                          }`}
                        >
                          <span className="truncate">{mod.title}</span>
                          {mod.lessons[0]?.estimatedMinutes && (
                            <span
                              className={`text-[11px] shrink-0 tabular-nums ${
                                isActive ? 'text-[#DDD6FE]' : 'text-[#6D658F]'
                              }`}
                            >
                              {mod.lessons[0].estimatedMinutes}m
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Lesson Reader */}
                  <div className="lg:col-span-8 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-display text-xl font-bold text-[#1A1635]">{activeLesson.title}</h3>
                        <div className="flex items-center gap-3 text-xs text-[#6D658F] mt-1">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {activeLesson.estimatedMinutes} min study time
                          </span>
                          <span>·</span>
                          <span>ND2 Curriculum Module</span>
                        </div>
                      </div>
                      <Link
                        to={`/ai-tutor?course=${encodeURIComponent(course.code)}&module=${encodeURIComponent(activeModule.id)}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#EDE9FE] text-[#4C1D95] text-xs font-semibold hover:bg-[#DDD6FE] whitespace-nowrap"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        <span>Ask AI Tutor about this Lesson</span>
                      </Link>
                    </div>

                    {activeLesson.learningObjectives?.length > 0 && (
                      <div className="p-4 rounded-xl bg-[#FAF9FE] border border-[#ECE8F8] space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#4C1D95]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Learning Objectives</span>
                        </div>
                        <ul className="space-y-1 text-xs text-[#4A436D] list-disc pl-4">
                          {activeLesson.learningObjectives.map((obj, idx) => (
                            <li key={idx}>{obj}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="p-5 rounded-xl border border-[#ECE8F8] bg-white">
                      <MarkdownLessonView markdown={activeLesson.contentMarkdown} />
                    </div>

                    {(activeLesson.practiceActivity?.task || activeLesson.practiceActivity?.instructions) && (
                      <div className="p-4 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Practice Activity</span>
                        </div>
                        <div className="text-xs text-emerald-950 whitespace-pre-line leading-relaxed">
                          {activeLesson.practiceActivity.task || activeLesson.practiceActivity.instructions}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-[#EFEBF9]">
                      <button
                        type="button"
                        disabled={activeModuleIndex === 0}
                        onClick={() => setActiveModuleIndex((i) => Math.max(0, i - 1))}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#DED8F4] text-xs font-semibold text-[#1A1635] disabled:opacity-40 hover:bg-[#FAF9FE]"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Previous Module</span>
                      </button>
                      <button
                        type="button"
                        disabled={activeModuleIndex >= modules.length - 1}
                        onClick={() => setActiveModuleIndex((i) => Math.min(modules.length - 1, i + 1))}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#6B34E8] text-white text-xs font-semibold disabled:opacity-40 hover:opacity-95"
                      >
                        <span>Next Module</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-5 prepwise-card p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#1A1635]">Topics &amp; Syllabus Mastery</h2>
                <div className="space-y-3">
                  {topics.map((t) => (
                    <div key={t.id} className="p-3.5 rounded-xl bg-[#FAF9FE] border border-[#ECE8F8] space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-display text-sm font-bold text-[#1A1635]">{t.title}</div>
                          <div className="text-xs text-[#6D658F] mt-0.5">{t.summary}</div>
                        </div>
                        <span className="font-mono text-xs font-semibold text-[#4C1D95] tabular-nums shrink-0">
                          {t.mastery_percentage}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#EAE5F9] overflow-hidden">
                        <div className="h-full bg-[#6B34E8]" style={{ width: `${t.mastery_percentage}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#6D658F]">
                        <span>{t.question_count} Questions</span>
                        <Link
                          to={`/questions?course=${encodeURIComponent(course.code)}&topic=${encodeURIComponent(t.id)}`}
                          className="inline-flex items-center gap-1 font-semibold text-[#6B34E8] hover:underline"
                        >
                          <span>Practise Topic</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-7 prepwise-card p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-lg font-bold text-[#1A1635]">Past &amp; Revision Questions Preview</h2>
                    <span className="text-xs text-[#6D658F] tabular-nums">
                      Showing {filteredQuestions.length} of {questions.length} items
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/questions?course=${encodeURIComponent(course.code)}${
                        selectedSession !== 'all' ? `&year=${encodeURIComponent(selectedSession)}` : ''
                      }`}
                      className="px-3 py-1.5 rounded-lg bg-[#EDE9FE] text-[#4C1D95] text-xs font-semibold hover:bg-[#DDD6FE] whitespace-nowrap"
                    >
                      Practise This Paper
                    </Link>
                    <Link
                      to={`/exams?course=${encodeURIComponent(course.code)}${
                        selectedSession !== 'all' ? `&year=${encodeURIComponent(selectedSession)}` : ''
                      }`}
                      className="px-3 py-1.5 rounded-lg border border-[#DED8F4] text-[#1A1635] text-xs font-semibold hover:bg-[#FAF9FE] whitespace-nowrap"
                    >
                      Sit Timed Exam
                    </Link>
                  </div>
                </div>

                {previewSessions.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedSession('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                        selectedSession === 'all'
                          ? 'bg-[#6B34E8] border-[#6B34E8] text-white'
                          : 'bg-[#FAF9FE] border-[#E5E0F5] text-[#4A436D] hover:border-[#C4B5FD]'
                      }`}
                    >
                      All Sessions
                    </button>
                    {previewSessions.map((session) => (
                      <button
                        key={session}
                        type="button"
                        onClick={() => setSelectedSession(session)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                          selectedSession === session
                            ? 'bg-[#6B34E8] border-[#6B34E8] text-white'
                            : 'bg-[#FAF9FE] border-[#E5E0F5] text-[#4A436D] hover:border-[#C4B5FD]'
                        }`}
                      >
                        {session}
                      </button>
                    ))}
                  </div>
                )}

                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {filteredQuestions.map((q) => (
                    <div key={q.id} className="p-4 rounded-xl border border-[#ECE8F8] bg-white space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs text-[#6D658F]">
                        <span>
                          {q.examination_year} · Q{q.question_number} · {q.question_type.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-[#1A1635] whitespace-pre-line">{q.question_text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
