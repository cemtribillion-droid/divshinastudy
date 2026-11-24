import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Bot,
  Check,
  Copy,
  ExternalLink,
  Globe,
  LogOut,
  MessageSquarePlus,
  Paperclip,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { PrepWiseLogo } from '../components/BrandMark';
import { MarkdownContent } from '../components/MarkdownContent';
import { useAuth } from '../context/AuthContext';
import { apiRequest, ApiError } from '../lib/api';
import type { GroundingSource } from '../types';

type PublicAgentMode =
  | 'ask_anything'
  | 'step_by_step'
  | 'deep_explain'
  | 'quiz_me'
  | 'fact_check'
  | 'code_debug';

interface AgentAttachmentState {
  name: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'application/pdf';
  data: string;
}

interface AgentTurn {
  id: string;
  prompt: string;
  answer: string;
  mode: PublicAgentMode;
  subject?: string | null;
  sources: GroundingSource[];
  attachmentName?: string;
  created_at: string;
}

const SUBJECT_OPTIONS = [
  'All Academic & General Knowledge',
  'Mathematics & Statistics',
  'Computer Science & Programming',
  'Physics & Engineering',
  'Chemistry & Biology',
  'Economics & Accounting',
  'English, Literature & Writing',
  'History, Law & Social Sciences',
];

const MODE_OPTIONS: Array<{ value: PublicAgentMode; label: string; hint: string }> = [
  { value: 'ask_anything', label: 'Ask Anything', hint: 'Direct answer + clear explanation' },
  { value: 'step_by_step', label: 'Step-by-Step Solution', hint: 'Derivations, formulas & working' },
  { value: 'deep_explain', label: 'Deep Concept Guide', hint: 'In-depth intuition & examples' },
  { value: 'quiz_me', label: 'Quiz Me (3 Questions)', hint: 'Practice check with answer key' },
  { value: 'fact_check', label: 'Research & Fact-Check', hint: 'Evidence-focused verification' },
  { value: 'code_debug', label: 'Code & Debugging', hint: 'Algorithms, syntax & fixes' },
];

const STARTER_PROMPTS: Array<{
  title: string;
  subject: string;
  mode: PublicAgentMode;
  prompt: string;
}> = [
  {
    title: 'Calculus Step-by-Step',
    subject: 'Mathematics & Statistics',
    mode: 'step_by_step',
    prompt: 'Evaluate the derivative of f(x) = (3x^2 + 1) * ln(x) step by step and explain each rule used.',
  },
  {
    title: 'Java / Data Structures',
    subject: 'Computer Science & Programming',
    mode: 'code_debug',
    prompt: 'Explain how binary search works, show clean Java or Python code, and analyze its time complexity.',
  },
  {
    title: 'Science & Thermodynamics',
    subject: 'Physics & Engineering',
    mode: 'deep_explain',
    prompt: 'Explain the First and Second Laws of Thermodynamics with clear everyday engineering examples.',
  },
  {
    title: 'Practice Quiz Generator',
    subject: 'Economics & Accounting',
    mode: 'quiz_me',
    prompt: 'Explain supply and demand equilibrium and quiz me with 3 university-level practice questions.',
  },
  {
    title: 'General Knowledge Research',
    subject: 'All Academic & General Knowledge',
    mode: 'fact_check',
    prompt: 'How do lithium-ion batteries work and what makes solid-state batteries different?',
  },
];

const ALLOWED_FILE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
]);

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read the selected file.'));
    reader.readAsDataURL(file);
  });
}

function isSafeHttpUrl(uri: string): boolean {
  try {
    const parsed = new URL(uri);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function AiAgentPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [subject, setSubject] = useState(
    searchParams.get('subject') || SUBJECT_OPTIONS[0]
  );
  const [mode, setMode] = useState<PublicAgentMode>(() => {
    const paramMode = searchParams.get('mode') as PublicAgentMode | null;
    return paramMode && MODE_OPTIONS.some((m) => m.value === paramMode)
      ? paramMode
      : 'ask_anything';
  });
  const [prompt, setPrompt] = useState(searchParams.get('q') || '');
  const [enableWebSearch, setEnableWebSearch] = useState(true);
  const [attachment, setAttachment] = useState<AgentAttachmentState | null>(null);
  const [turns, setTurns] = useState<AgentTurn[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const initialQueryHandledRef = useRef(false);

  const sendQuestion = async (options?: {
    overridePrompt?: string;
    overrideMode?: PublicAgentMode;
    overrideSubject?: string;
  }) => {
    const questionText = (options?.overridePrompt ?? prompt).trim();
    if (!questionText) {
      setError('Enter any academic or general knowledge question to ask the AI Agent.');
      return;
    }

    const activeMode = options?.overrideMode ?? mode;
    const activeSubject = options?.overrideSubject ?? subject;
    const activeAttachment = attachment;

    setError('');
    setSending(true);

    try {
      const recentHistory = turns.slice(-4).map((t) => ({
        prompt: t.prompt,
        ai_explanation: t.answer,
      }));

      const res = await apiRequest<{
        id: string;
        answer: string;
        sources?: GroundingSource[];
        mode: PublicAgentMode;
        subject?: string | null;
        created_at: string;
      }>('/api/ai/agent', {
        method: 'POST',
        body: JSON.stringify({
          prompt: questionText,
          mode: activeMode,
          subject:
            activeSubject === SUBJECT_OPTIONS[0] ? undefined : activeSubject,
          enable_web_search: enableWebSearch,
          history: recentHistory,
          attachment: activeAttachment
            ? {
                name: activeAttachment.name,
                mimeType: activeAttachment.mimeType,
                data: activeAttachment.data,
              }
            : undefined,
        }),
      });

      const nextTurn: AgentTurn = {
        id: res.id,
        prompt: questionText,
        answer: res.answer,
        mode: res.mode,
        subject: res.subject ?? (activeSubject === SUBJECT_OPTIONS[0] ? null : activeSubject),
        sources: Array.isArray(res.sources)
          ? res.sources.filter((s) => s?.uri && isSafeHttpUrl(s.uri))
          : [],
        attachmentName: activeAttachment?.name,
        created_at: res.created_at,
      };

      setTurns((prev) => [...prev, nextTurn]);
      setPrompt('');
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Unable to reach the Divshinastudy AI Knowledge Agent right now.'
      );
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    const qParam = searchParams.get('q')?.trim();
    if (qParam && !initialQueryHandledRef.current) {
      initialQueryHandledRef.current = true;
      setSearchParams({}, { replace: true });
      void sendQuestion({ overridePrompt: qParam });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendQuestion();
  };

  const handleAttachmentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');

    if (!ALLOWED_FILE_TYPES.has(file.type)) {
      setError('Please upload a PNG, JPEG, WEBP image or a PDF document.');
      e.target.value = '';
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError('Attachment must be 3 MB or smaller.');
      e.target.value = '';
      return;
    }

    try {
      const base64 = await readFileAsBase64(file);
      setAttachment({
        name: file.name,
        mimeType: file.type as AgentAttachmentState['mimeType'],
        data: base64,
      });
    } catch (readErr) {
      setError(readErr instanceof Error ? readErr.message : 'Unable to read attachment.');
    }
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 2000);
    } catch {
      // Clipboard blocked in restricted browser contexts
    }
  };

  const handleNewChat = () => {
    setTurns([]);
    setPrompt('');
    setAttachment(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const content = (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B34E8] mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Divshinastudy Universal AI Agent</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1A1635]">
            AI Academic & Knowledge Agent
          </h1>
          <p className="text-sm text-[#5E5780] mt-1 max-w-2xl">
            Ask any academic question across Mathematics, Sciences, Programming, Economics, Humanities, or general knowledge — with step-by-step workings, practice quizzes, image/PDF analysis, and live web citations.
          </p>
        </div>

        {turns.length > 0 && (
          <button
            type="button"
            onClick={handleNewChat}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#DED9F2] bg-white text-xs font-semibold text-[#1A1635] hover:bg-[#FAF9FE]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Control Column */}
        <div className="lg:col-span-5 prepwise-card p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#EDE9FE] text-[#6B34E8] flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-[#1A1635]">Ask Any Question</h2>
              <p className="text-xs text-[#6D658F]">Multi-turn context + live knowledge search</p>
            </div>
          </div>

          {error && (
            <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label htmlFor="agent-subject" className="block text-xs font-semibold text-[#1A1635] mb-1">
                Subject / Discipline Focus
              </label>
              <select
                id="agent-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#DED9F2] bg-white text-xs text-[#1A1635]"
              >
                {SUBJECT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="agent-mode" className="block text-xs font-semibold text-[#1A1635] mb-1">
                Response Style
              </label>
              <select
                id="agent-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as PublicAgentMode)}
                className="w-full px-3 py-2 rounded-xl border border-[#DED9F2] bg-white text-xs text-[#1A1635]"
              >
                {MODE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} — {opt.hint}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="agent-prompt" className="block text-xs font-semibold text-[#1A1635] mb-1">
                Your Question or Topic
              </label>
              <textarea
                id="agent-prompt"
                rows={4}
                required
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask anything — e.g. 'Solve 3x^2 - 5x - 2 = 0', 'Explain photosynthesis light vs Calvin cycle', 'Debug my Python recursion', or any general knowledge question..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DED9F2] text-sm text-[#1A1635] focus:outline-none focus:ring-2 focus:ring-[#7B3FE4]/25 focus:border-[#7B3FE4]"
              />
            </div>

            {/* Optional Attachment + Search Toggle */}
            <div className="space-y-2.5 pt-0.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E0D8FA] bg-[#FAF9FE] hover:bg-[#F1ECFE] text-xs font-semibold text-[#4C1D95] cursor-pointer">
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Attach Problem Image / PDF</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    onChange={handleAttachmentChange}
                    className="hidden"
                  />
                </label>

                <label className="inline-flex items-center gap-2 text-xs text-[#4A436D] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={enableWebSearch}
                    onChange={(e) => setEnableWebSearch(e.target.checked)}
                    className="accent-[#6B34E8] rounded"
                  />
                  <Globe className="w-3.5 h-3.5 text-[#6B34E8]" />
                  <span>Web Grounding</span>
                </label>
              </div>

              {attachment && (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#F5F3FF] border border-[#DDD6FE] text-xs text-[#4C1D95]">
                  <span className="truncate font-medium">Attached: {attachment.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachment(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    aria-label="Remove attachment"
                    className="p-0.5 rounded hover:bg-[#EDE9FE]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={sending || !prompt.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#7B3FE4] to-[#6327E3] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-60 transition-opacity"
            >
              <Send className="w-4 h-4" />
              <span>{sending ? 'Thinking & Researching...' : 'Ask AI Agent'}</span>
            </button>
          </form>

          <div className="pt-2 border-t border-[#F0EDF8]">
            <div className="text-[11px] font-semibold text-[#6D658F] mb-2">Try a Sample Question</div>
            <div className="flex flex-wrap gap-1.5">
              {STARTER_PROMPTS.map((sp) => (
                <button
                  key={sp.title}
                  type="button"
                  disabled={sending}
                  onClick={() => {
                    setSubject(sp.subject);
                    setMode(sp.mode);
                    setPrompt(sp.prompt);
                    void sendQuestion({
                      overridePrompt: sp.prompt,
                      overrideMode: sp.mode,
                      overrideSubject: sp.subject,
                    });
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-[#E0D8FA] bg-[#FAF9FE] hover:bg-[#F1ECFE] text-[11px] font-semibold text-[#4C1D95] transition-colors disabled:opacity-60"
                >
                  {sp.title}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Conversation Column */}
        <div className="lg:col-span-7 space-y-4">
          {turns.length === 0 && !sending ? (
            <div className="prepwise-card p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#EDE9FE] text-[#6B34E8] flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 className="font-display text-lg font-bold text-[#1A1635]">
                Ready for Any Academic or Knowledge Question
              </h2>
              <p className="text-sm text-[#5E5780] max-w-md mx-auto leading-relaxed">
                Ask a question on the left or click a sample prompt to get step-by-step solutions, conceptual breakdowns, runnable code, or web-verified knowledge.
              </p>
            </div>
          ) : (
            turns.map((turn) => (
              <div key={turn.id} className="prepwise-card p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6D658F]">
                  <span className="font-semibold text-[#4C1D95] capitalize">
                    {turn.mode.replace(/_/g, ' ')}
                  </span>
                  <span>{turn.subject || 'All Academic & General Knowledge'}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF9FE] border border-[#E5E0F5] text-sm font-medium text-[#1A1635]">
                  {turn.prompt}
                  {turn.attachmentName && (
                    <div className="mt-1.5 text-[11px] text-[#6B34E8]">
                      Attachment: {turn.attachmentName}
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-white border border-[#E5E0F5] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#6B34E8]">
                      <Bot className="w-3.5 h-3.5" />
                      <span>Divshinastudy AI Agent</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void handleCopy(turn.id, turn.answer)}
                        className="text-[11px] font-semibold text-[#5E5780] hover:text-[#1A1635] inline-flex items-center gap-1"
                      >
                        {copiedId === turn.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('ask_anything');
                          setPrompt(`Follow-up on "${turn.prompt.slice(0, 60)}": `);
                        }}
                        className="text-[11px] font-semibold text-[#6B34E8] hover:underline inline-flex items-center gap-1"
                      >
                        <MessageSquarePlus className="w-3.5 h-3.5" />
                        <span>Follow up</span>
                      </button>
                    </div>
                  </div>

                  <MarkdownContent markdown={turn.answer} />

                  {turn.sources.length > 0 && (
                    <div className="pt-3 mt-3 border-t border-[#F0EDF8] space-y-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5E5780]">
                        <Globe className="w-3.5 h-3.5 text-[#6B34E8]" />
                        <span>Verified Web Sources</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {turn.sources.map((src) => (
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
            ))
          )}

          {sending && (
            <div className="prepwise-card p-6 flex items-center gap-3 text-sm text-[#5E5780]">
              <div className="w-8 h-8 rounded-xl bg-[#EDE9FE] text-[#6B34E8] flex items-center justify-center animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold text-[#1A1635]">Divshinastudy AI Agent is working...</div>
                <div className="text-xs text-[#6D658F]">Analyzing your question and preparing a clear explanation.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F5F4FB] flex items-center justify-center text-sm text-[#5E5780]">
        Loading Divshinastudy AI Knowledge Agent...
      </div>
    );
  }

  if (user) {
    return <AppShell>{content}</AppShell>;
  }

  return (
    <div className="min-h-screen bg-[#F5F4FB] text-[#1A1635] flex flex-col">
      <header className="sticky top-0 z-30 bg-[#F5F4FB]/90 backdrop-blur-md border-b border-[#E5E0F5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between gap-6">
          <Link to="/" className="whitespace-nowrap shrink-0">
            <PrepWiseLogo light={false} />
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#4A436D]" aria-label="Public navigation">
            <Link to="/" className="hover:text-[#6B34E8] transition-colors whitespace-nowrap">
              Home
            </Link>
            <Link to="/ai-agent" className="text-[#6B34E8] font-semibold whitespace-nowrap">
              AI Agent
            </Link>
            <Link to="/admin/login" className="hover:text-[#6B34E8] transition-colors whitespace-nowrap">
              Admin
            </Link>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            {user ? (
              <button
                type="button"
                onClick={() => void logout()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#DED9F2] bg-white text-xs font-semibold text-[#4A436D]"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3.5 py-2 rounded-xl border border-[#DED9F2] bg-white text-xs font-semibold text-[#1A1635] hover:bg-[#FAF9FE] whitespace-nowrap"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#7B3FE4] to-[#6327E3] text-white text-xs font-semibold whitespace-nowrap hover:opacity-95"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8">
        {content}
      </main>
    </div>
  );
}
