import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot, BookOpen, ExternalLink, Globe, MessageSquarePlus, Send, Sparkles, Trash2 } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { MarkdownContent } from '../components/MarkdownContent';
import { apiRequest, ApiError } from '../lib/api';
import type { AiLearningHistory, Course, QuestionPublic } from '../types';

type TutorMode =
  | 'ask_anything'
  | 'revision_chat'
  | 'step_by_step'
  | 'explain_question'
  | 'deep_explain'
  | 'quiz_me'
  | 'fact_check'
  | 'code_debug'
  | 'hint'
  | 'theory_feedback';

function isSafeHttpUrl(uri: string): boolean {
  try {
    const parsed = new URL(uri);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function AiTutorPage() {
  const [searchParams] = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [questions, setQuestions] = useState<QuestionPublic[]>([]);
  const [history, setHistory] = useState<AiLearningHistory[]>([]);

  const [selectedCourse, setSelectedCourse] = useState(searchParams.get('course') || '');
  const [customSubject, setCustomSubject] = useState('');
  const [selectedQuestionId, setSelectedQuestionId] = useState(searchParams.get('questionId') || '');
  const [mode, setMode] = useState<TutorMode>(searchParams.get('questionId') ? 'step_by_step' : 'ask_anything');
  const [prompt, setPrompt] = useState('');
  const [studentDraft, setStudentDraft] = useState('');
  const [enableWebSearch, setEnableWebSearch] = useState(true);
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      apiRequest<{ courses: Course[] }>('/api/courses'),
      apiRequest<{ questions: QuestionPublic[] }>('/api/questions'),
      apiRequest<{ history: AiLearningHistory[] }>('/api/ai/history'),
    ])
      .then(([cRes, qRes, hRes]) => {
        setCourses(cRes.courses);
        setQuestions(qRes.questions);
        setHistory(hRes.history);
        const paramCourse = searchParams.get('course');
        if (paramCourse && cRes.courses.some((c) => c.code === paramCourse)) {
          setSelectedCourse(paramCourse);
        } else if (cRes.courses.length > 0 && selectedCourse && !cRes.courses.some((c) => c.code === selectedCourse)) {
          setSelectedCourse('');
        }
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Unable to load AI Tutor resources.');
      });
  }, []);

  const courseQuestions = selectedCourse
    ? questions.filter((q) => q.course_code === selectedCourse)
    : [];
  const activeQuestion = questions.find((q) => q.id === selectedQuestionId);
  const activeCourseObj = courses.find((c) => c.code === selectedCourse);

  const quickPrompts: Array<{ label: string; text: string; mode: TutorMode }> = activeQuestion
    ? [
        {
          label: 'Step-by-step solution',
          text: `Walk me through ${activeQuestion.course_code} Q${activeQuestion.question_number} step by step and show why the answer works.`,
          mode: 'step_by_step',
        },
        {
          label: 'Give a conceptual hint',
          text: `Give me a guiding hint and key formula or rule for ${activeQuestion.course_code} Q${activeQuestion.question_number} without spoiling it first.`,
          mode: 'hint',
        },
        {
          label: 'Explain underlying concept',
          text: `Teach the core concept tested by ${activeQuestion.course_code} Q${activeQuestion.question_number} with a similar worked example.`,
          mode: 'explain_question',
        },
      ]
    : selectedCourse
    ? [
        {
          label: 'Teach core concepts',
          text: `Teach the core exam concepts in ${selectedCourse}${activeCourseObj ? ` (${activeCourseObj.title})` : ''} with clear examples.`,
          mode: 'deep_explain',
        },
        {
          label: 'Worked exam example',
          text: `Give me a realistic worked exam problem for ${selectedCourse} and walk through every step.`,
          mode: 'step_by_step',
        },
        {
          label: 'Practice quiz (3 Qs)',
          text: `Give me 3 practice questions for ${selectedCourse} with worked solutions so I can check my understanding.`,
          mode: 'quiz_me',
        },
        {
          label: 'Common exam pitfalls',
          text: `What are the most common mistakes students make in ${selectedCourse} exams and how do I avoid them?`,
          mode: 'revision_chat',
        },
      ]
    : [
        {
          label: 'Solve math step-by-step',
          text: 'Solve the integral of x * e^x dx step by step using integration by parts and explain why it works.',
          mode: 'step_by_step',
        },
        {
          label: 'Explain a science concept',
          text: 'Explain cellular respiration vs photosynthesis, showing equations and where each stage occurs.',
          mode: 'deep_explain',
        },
        {
          label: 'Programming & algorithms',
          text: 'Explain recursion vs iteration with a clean Python or Java example and compare memory usage.',
          mode: 'code_debug',
        },
        {
          label: 'Quiz me (3 Qs)',
          text: 'Teach the core principles of supply and demand elasticity and quiz me with 3 questions.',
          mode: 'quiz_me',
        },
      ];

  const submitPrompt = async (overridePrompt?: string, overrideMode?: TutorMode) => {
    const chosenMode = overrideMode ?? mode;
    const effectivePrompt =
      (overridePrompt ?? prompt).trim() ||
      (chosenMode === 'theory_feedback' && studentDraft.trim()
        ? `Please review my draft answer${selectedCourse ? ` for ${selectedCourse}` : ''}.`
        : activeQuestion
        ? `Please help me understand ${activeQuestion.course_code} Q${activeQuestion.question_number}.`
        : '');

    if (!effectivePrompt) {
      setError('Enter any academic or general knowledge question to begin.');
      return;
    }

    setError('');
    setSending(true);
    try {
      const res = await apiRequest<{ record: AiLearningHistory }>('/api/ai/tutor', {
        method: 'POST',
        body: JSON.stringify({
          mode: chosenMode,
          prompt: effectivePrompt,
          subject: customSubject.trim() || undefined,
          course_code: selectedCourse || undefined,
          question_id: selectedQuestionId || undefined,
          topic_id: searchParams.get('topic') || undefined,
          student_draft: chosenMode === 'theory_feedback' ? studentDraft : undefined,
          enable_web_search: enableWebSearch,
        }),
      });
      setHistory((prev) => [res.record, ...prev]);
      setPrompt('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to reach AI Academic Tutor.');
    } finally {
      setSending(false);
    }
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitPrompt();
  };

  const handleClearHistory = async () => {
    setClearing(true);
    setError('');
    try {
      await apiRequest<{ deleted: number }>('/api/ai/history', { method: 'DELETE' });
      setHistory([]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to clear tutor history.');
    } finally {
      setClearing(false);
    }
  };

  const canSubmit =
    !sending &&
    (Boolean(prompt.trim()) ||
      Boolean(activeQuestion) ||
      (mode === 'theory_feedback' && Boolean(studentDraft.trim())));

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#1A1635]">Divshinastudy AI Tutor & Knowledge Agent</h1>
            <p className="text-sm text-[#5E5780] mt-1">
              Ask any academic or general knowledge question, attach an uploaded ND2 course/question if desired, and review saved explanations.
            </p>
          </div>
          {history.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              disabled={clearing}
              className="px-3 py-2 rounded-xl border border-[#DED9F2] bg-white text-xs font-semibold text-[#5E5780] hover:text-rose-600 hover:border-rose-200 inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{clearing ? 'Clearing...' : 'Clear History'}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Prompt & Context Builder */}
          <div className="lg:col-span-5 prepwise-card p-6 space-y-4 h-fit">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-[#1A1635]">Study & Knowledge Context</h2>
                <p className="text-xs text-[#6D658F]">Works across all academic subjects & general knowledge</p>
              </div>
            </div>

            {error && (
              <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {error}
              </div>
            )}

            <form onSubmit={handleAsk} className="space-y-3.5">
              <div>
                <label htmlFor="tutor-course" className="block text-xs font-semibold text-[#1A1635] mb-1">
                  Subject Scope / ND2 Course
                </label>
                <select
                  id="tutor-course"
                  value={selectedCourse}
                  onChange={(e) => {
                    setSelectedCourse(e.target.value);
                    setSelectedQuestionId('');
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[#DED9F2] bg-white text-xs"
                >
                  <option value="">General Academic & Knowledge (Any Subject)</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.code}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </select>
              </div>

              {!selectedCourse && (
                <div>
                  <label htmlFor="tutor-subject" className="block text-xs font-semibold text-[#1A1635] mb-1">
                    Discipline / Topic Focus (Optional)
                  </label>
                  <input
                    id="tutor-subject"
                    type="text"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="e.g. Calculus, Organic Chemistry, Python, Economics, History..."
                    className="w-full px-3 py-2 rounded-xl border border-[#DED9F2] bg-white text-xs"
                  />
                </div>
              )}

              {courseQuestions.length > 0 && (
                <div>
                  <label htmlFor="tutor-question" className="block text-xs font-semibold text-[#1A1635] mb-1">
                    Past Question (Optional)
                  </label>
                  <select
                    id="tutor-question"
                    value={selectedQuestionId}
                    onChange={(e) => setSelectedQuestionId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#DED9F2] bg-white text-xs"
                  >
                    <option value="">General {selectedCourse} Revision</option>
                    {courseQuestions.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.examination_year} Q{q.question_number}: {q.question_text.slice(0, 65)}...
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {activeQuestion && (
                <div className="p-3 rounded-xl bg-[#FAF9FE] border border-[#E5E0F5] text-xs text-[#1A1635] whitespace-pre-line">
                  <div className="font-semibold text-[#6B34E8] mb-1">
                    Attached Question ({activeQuestion.examination_year})
                  </div>
                  {activeQuestion.question_text}
                </div>
              )}

              <div>
                <label htmlFor="tutor-mode" className="block text-xs font-semibold text-[#1A1635] mb-1">
                  Agent Response Mode
                </label>
                <select
                  id="tutor-mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as TutorMode)}
                  className="w-full px-3 py-2 rounded-xl border border-[#DED9F2] bg-white text-xs"
                >
                  <option value="ask_anything">Ask Anything (Direct + Detailed)</option>
                  <option value="step_by_step">Full Step-by-Step Worked Solution</option>
                  <option value="deep_explain">Deep Concept Explanation</option>
                  <option value="quiz_me">Quiz Me (3 Practice Questions)</option>
                  <option value="fact_check">Research & Fact-Check</option>
                  <option value="code_debug">Code & Debugging Mentor</option>
                  <option value="revision_chat">Interactive Academic Coaching</option>
                  <option value="explain_question">Explain Concept & Answer</option>
                  <option value="hint">Give a Conceptual Hint Only</option>
                  <option value="theory_feedback">Review My Theory Draft</option>
                </select>
              </div>

              {mode === 'theory_feedback' && (
                <div>
                  <label htmlFor="tutor-draft" className="block text-xs font-semibold text-[#1A1635] mb-1">
                    Your Draft Answer
                  </label>
                  <textarea
                    id="tutor-draft"
                    rows={3}
                    value={studentDraft}
                    onChange={(e) => setStudentDraft(e.target.value)}
                    placeholder="Paste your draft solution here for feedback and a model answer..."
                    className="w-full px-3 py-2 rounded-xl border border-[#DED9F2] text-xs"
                  />
                </div>
              )}

              <div>
                <div className="text-[11px] font-semibold text-[#6D658F] mb-1.5">Quick Prompts</div>
                <div className="flex flex-wrap gap-1.5">
                  {quickPrompts.map((qp) => (
                    <button
                      key={qp.label}
                      type="button"
                      disabled={sending}
                      onClick={() => {
                        setMode(qp.mode);
                        setPrompt(qp.text);
                        void submitPrompt(qp.text, qp.mode);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-[#E0D8FA] bg-[#FAF9FE] hover:bg-[#F1ECFE] text-[11px] font-semibold text-[#4C1D95] transition-colors disabled:opacity-60"
                    >
                      {qp.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="tutor-prompt" className="block text-xs font-semibold text-[#1A1635] mb-1">
                  Your Question
                </label>
                <textarea
                  id="tutor-prompt"
                  rows={3}
                  required={!activeQuestion && !(mode === 'theory_feedback' && studentDraft.trim())}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ask any academic or knowledge question — e.g. 'Explain Java try-catch-finally' or 'How does Newton's 2nd Law apply to inclined planes?'"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DED9F2] text-sm"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-[#4A436D] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableWebSearch}
                  onChange={(e) => setEnableWebSearch(e.target.checked)}
                  className="accent-[#6B34E8] rounded"
                />
                <Globe className="w-3.5 h-3.5 text-[#6B34E8]" />
                <span>Enable live web grounding citations</span>
              </label>

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#7B3FE4] to-[#6327E3] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Send className="w-4 h-4" />
                <span>{sending ? 'Generating Answer...' : 'Ask Divshinastudy AI Tutor'}</span>
              </button>
            </form>
          </div>

          {/* Grounded Conversation History */}
          <div className="lg:col-span-7 space-y-4">
            {history.length === 0 ? (
              <div className="prepwise-card p-10 text-center space-y-2">
                <Sparkles className="w-7 h-7 text-[#6B34E8] mx-auto" />
                <h2 className="font-display text-base font-bold text-[#1A1635]">Ask Your First Question</h2>
                <p className="text-xs text-[#6D658F] max-w-md mx-auto">
                  Type any academic or general knowledge question on the left, or click a quick prompt to receive structured explanations, worked solutions, and practice questions.
                </p>
              </div>
            ) : (
              history.map((entry) => {
                const safeSources = Array.isArray(entry.sources)
                  ? entry.sources.filter((s) => s?.uri && isSafeHttpUrl(s.uri))
                  : [];
                return (
                  <div key={entry.id} className="prepwise-card p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6D658F]">
                      <span className="font-semibold capitalize text-[#4C1D95]">{entry.mode.replace(/_/g, ' ')}</span>
                      <span>{entry.source_citation || entry.subject || 'General Academic & Knowledge'}</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#FAF9FE] border border-[#E5E0F5] text-sm font-medium text-[#1A1635]">
                      {entry.prompt}
                    </div>

                    {entry.official_answer && (
                      <div className="p-4 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>
                            {entry.verification_status === 'unverified'
                              ? 'Source Document Status (Unverified)'
                              : 'Official Source Document Answer'}
                          </span>
                        </div>
                        <p className="text-xs text-emerald-950 whitespace-pre-line leading-relaxed">
                          {entry.official_answer}
                        </p>
                      </div>
                    )}

                    <div className="p-4 rounded-xl bg-white border border-[#E5E0F5] space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#6B34E8]">
                          <Bot className="w-3.5 h-3.5" />
                          <span>Divshinastudy AI Agent</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (entry.question_id) {
                              setSelectedQuestionId(entry.question_id);
                            }
                            setMode('revision_chat');
                            setPrompt(`Follow-up on "${entry.prompt.slice(0, 60)}": `);
                          }}
                          className="text-[11px] font-semibold text-[#6B34E8] hover:underline inline-flex items-center gap-1"
                        >
                          <MessageSquarePlus className="w-3.5 h-3.5" />
                          <span>Ask Follow-up</span>
                        </button>
                      </div>

                      <MarkdownContent markdown={entry.ai_explanation} />

                      {safeSources.length > 0 && (
                        <div className="pt-3 mt-3 border-t border-[#F0EDF8] space-y-2">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5E5780]">
                            <Globe className="w-3.5 h-3.5 text-[#6B34E8]" />
                            <span>Verified Web Sources</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {safeSources.map((src) => (
                              <a
                                key={src.uri}
                                href={src.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FAF9FE] border border-[#E5E0F5] text-[11px] font-medium text-[#4C1D95] hover:bg-[#F1ECFE] max-w-[260px]"
                              >
                                <span className="truncate">{src.title}</span>
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
