import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot, BookOpen, MessageSquarePlus, Send, Sparkles, Trash2 } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { apiRequest, ApiError } from '../lib/api';
import type { AiLearningHistory, Course, QuestionPublic } from '../types';

type TutorMode = 'explain_question' | 'hint' | 'step_by_step' | 'revision_chat' | 'theory_feedback';

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      const inner = part.slice(2, -2);
      if (inner.startsWith('`') && inner.endsWith('`') && inner.length > 2) {
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 rounded bg-[#F3EFFC] text-[#4C1D95] font-mono font-semibold text-[12px]"
          >
            {inner.slice(1, -1)}
          </code>
        );
      }
      return (
        <strong key={idx} className="font-semibold text-[#1A1635]">
          {inner}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-[#F3EFFC] text-[#4C1D95] font-mono text-[12px]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function renderTutorMarkdown(markdown: string): React.ReactNode {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let keyCounter = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Fenced code blocks
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) {
        i += 1;
      }
      blocks.push(
        <div key={`code-${keyCounter++}`} className="rounded-xl overflow-hidden border border-[#2E2554] bg-[#16122B]">
          {lang && (
            <div className="px-3 py-1 bg-[#221C42] text-[11px] font-mono uppercase tracking-wider text-[#C4B5FD]">
              {lang}
            </div>
          )}
          <pre className="p-3.5 overflow-x-auto text-xs font-mono text-[#F5F3FF] leading-relaxed">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const headingClass =
        level <= 2
          ? 'font-display text-base font-bold text-[#1A1635] pt-1'
          : 'font-display text-sm font-bold text-[#4C1D95] pt-1';
      blocks.push(
        <h4 key={`h-${keyCounter++}`} className={headingClass}>
          {renderInlineMarkdown(headingText)}
        </h4>
      );
      i += 1;
      continue;
    }

    // Unordered list
    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${keyCounter++}`} className="list-disc pl-5 space-y-1.5 text-sm text-[#1A1635]">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${keyCounter++}`} className="list-decimal pl-5 space-y-1.5 text-sm text-[#1A1635]">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Paragraph (group contiguous non-empty lines that aren't special blocks)
    const paraLines: string[] = [];
    while (i < lines.length) {
      const nextTrimmed = lines[i].trim();
      if (
        !nextTrimmed ||
        nextTrimmed.startsWith('```') ||
        /^(#{1,4})\s+/.test(nextTrimmed) ||
        /^[-*•]\s+/.test(nextTrimmed) ||
        /^\d+[.)]\s+/.test(nextTrimmed)
      ) {
        break;
      }
      paraLines.push(nextTrimmed);
      i += 1;
    }
    blocks.push(
      <p key={`p-${keyCounter++}`} className="text-sm text-[#1A1635] leading-relaxed">
        {renderInlineMarkdown(paraLines.join(' '))}
      </p>
    );
  }

  return <div className="space-y-3">{blocks}</div>;
}

export function AiTutorPage() {
  const [searchParams] = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [questions, setQuestions] = useState<QuestionPublic[]>([]);
  const [history, setHistory] = useState<AiLearningHistory[]>([]);

  const [selectedCourse, setSelectedCourse] = useState(searchParams.get('course') || 'MTH 209');
  const [selectedQuestionId, setSelectedQuestionId] = useState(searchParams.get('questionId') || '');
  const [mode, setMode] = useState<TutorMode>(searchParams.get('questionId') ? 'step_by_step' : 'revision_chat');
  const [prompt, setPrompt] = useState('');
  const [studentDraft, setStudentDraft] = useState('');
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
        if (cRes.courses.length > 0 && !cRes.courses.some((c) => c.code === selectedCourse)) {
          setSelectedCourse(cRes.courses[0].code);
        }
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Unable to load ND2 tutor resources.');
      });
  }, []);

  const courseQuestions = questions.filter((q) => !selectedCourse || q.course_code === selectedCourse);
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
          text: `Teach the core ND2 concept tested by ${activeQuestion.course_code} Q${activeQuestion.question_number} with a similar worked example.`,
          mode: 'explain_question',
        },
      ]
    : [
        {
          label: 'Teach core concepts',
          text: `Teach the core ND2 exam concepts in ${selectedCourse}${activeCourseObj ? ` (${activeCourseObj.title})` : ''} with clear examples.`,
          mode: 'revision_chat',
        },
        {
          label: 'Worked exam example',
          text: `Give me a realistic ND2 worked exam problem for ${selectedCourse} and walk through every step.`,
          mode: 'step_by_step',
        },
        {
          label: 'Practice check (3 Qs)',
          text: `Give me 3 short ND2 practice questions for ${selectedCourse} with worked solutions so I can check my understanding.`,
          mode: 'revision_chat',
        },
        {
          label: 'Common exam pitfalls',
          text: `What are the most common mistakes ND2 students make in ${selectedCourse} exams and how do I avoid them?`,
          mode: 'revision_chat',
        },
      ];

  const submitPrompt = async (overridePrompt?: string, overrideMode?: TutorMode) => {
    const chosenMode = overrideMode ?? mode;
    const effectivePrompt =
      (overridePrompt ?? prompt).trim() ||
      (chosenMode === 'theory_feedback' && studentDraft.trim()
        ? `Please review my ${selectedCourse} draft answer and teach me how to improve it.`
        : activeQuestion
        ? `Please help me understand ${activeQuestion.course_code} Q${activeQuestion.question_number}.`
        : '');

    if (!effectivePrompt) {
      setError('Enter a question or select a quick teaching prompt to begin.');
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
          course_code: selectedCourse,
          question_id: selectedQuestionId || undefined,
          topic_id: searchParams.get('topic') || undefined,
          module_id: searchParams.get('module') || undefined,
          student_draft: chosenMode === 'theory_feedback' ? studentDraft : undefined,
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
            <h1 className="font-display text-2xl font-bold text-[#1A1635]">ND2 AI Academic Tutor</h1>
            <p className="text-sm text-[#5E5780] mt-1">
              Structured teachings, step-by-step worked solutions, and draft feedback grounded in your ND2 curriculum.
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
                <h2 className="font-display text-base font-bold text-[#1A1635]">Study Context</h2>
                <p className="text-xs text-[#6D658F]">Official keys are shown alongside AI teachings</p>
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
                  ND2 Course
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
                  {courses.map((c) => (
                    <option key={c.id} value={c.code}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </select>
              </div>

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
                  Tutoring Mode
                </label>
                <select
                  id="tutor-mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as TutorMode)}
                  className="w-full px-3 py-2 rounded-xl border border-[#DED9F2] bg-white text-xs"
                >
                  <option value="revision_chat">Interactive ND2 Teaching</option>
                  <option value="step_by_step">Full Step-by-Step Worked Solution</option>
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
                <div className="text-[11px] font-semibold text-[#6D658F] mb-1.5">Quick Study Prompts</div>
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
                  placeholder="Ask e.g. 'Explain Java try-catch-finally with an example' or 'How do I rationalize √(x²+7)-4?'"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DED9F2] text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#7B3FE4] to-[#6327E3] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Send className="w-4 h-4" />
                <span>{sending ? 'Generating Explanation...' : 'Ask Divshinastudy AI Tutor'}</span>
              </button>
            </form>
          </div>

          {/* Grounded Conversation & Official vs AI Split */}
          <div className="lg:col-span-7 space-y-4">
            {history.length === 0 ? (
              <div className="prepwise-card p-10 text-center space-y-2">
                <Sparkles className="w-7 h-7 text-[#6B34E8] mx-auto" />
                <h2 className="font-display text-base font-bold text-[#1A1635]">Ask Your First ND2 Question</h2>
                <p className="text-xs text-[#6D658F] max-w-md mx-auto">
                  Select any ND2 course or past question on the left, or click a quick study prompt to receive structured explanations, worked steps, and self-check practice.
                </p>
              </div>
            ) : (
              history.map((entry) => (
                <div key={entry.id} className="prepwise-card p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6D658F]">
                    <span className="font-semibold capitalize text-[#4C1D95]">{entry.mode.replace(/_/g, ' ')}</span>
                    <span>{entry.source_citation || 'ND2 General Revision'}</span>
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
                        <span>AI Tutor Teaching</span>
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
                    {renderTutorMarkdown(entry.ai_explanation)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
