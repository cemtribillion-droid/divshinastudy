import { GoogleGenAI, ThinkingLevel, type Content, type GenerateContentResponse, type Part } from '@google/genai';
import type { Course, GroundingSource, Question, Topic } from '../src/types';

export type AgentMode =
  | 'ask_anything'
  | 'step_by_step'
  | 'deep_explain'
  | 'quiz_me'
  | 'fact_check'
  | 'code_debug'
  | 'explain_question'
  | 'hint'
  | 'revision_chat'
  | 'theory_feedback';

export interface TutorHistoryTurn {
  prompt: string;
  ai_explanation: string;
}

export interface AgentAttachmentInput {
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'application/pdf';
  data: string;
  name?: string;
}

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
]);

export function isGeminiConfigured(): boolean {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.AI_API_KEY || '').trim();
  return Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');
}

export function getGeminiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.AI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured on the server. Add your Gemini API key in Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 45000,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function extractGroundingSources(response: GenerateContentResponse): GroundingSource[] {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return [];

  const seen = new Set<string>();
  const sources: GroundingSource[] = [];

  for (const chunk of chunks) {
    const web = (chunk as { web?: { uri?: string; title?: string } })?.web;
    const rawUri = typeof web?.uri === 'string' ? web.uri.trim() : '';
    if (!rawUri) continue;

    try {
      const parsed = new URL(rawUri);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
      if (seen.has(rawUri)) continue;
      seen.add(rawUri);
      const rawTitle = typeof web?.title === 'string' && web.title.trim() ? web.title.trim() : parsed.hostname;
      sources.push({
        title: rawTitle.slice(0, 140),
        uri: rawUri,
      });
    } catch {
      // Ignore malformed URIs from upstream grounding metadata
    }
    if (sources.length >= 6) break;
  }

  return sources;
}

export function buildTutorPromptContext(params: {
  mode: AgentMode;
  studentPrompt: string;
  subject?: string;
  course?: Course;
  topic?: Topic;
  question?: Question;
  studentDraft?: string;
  lessonContext?: string;
  courseTopics?: Topic[];
  recentHistory?: TutorHistoryTurn[];
}): {
  systemInstruction: string;
  userMessage: string;
  officialAnswer: string | null;
  sourceCitation: string | null;
} {
  const {
    mode,
    studentPrompt,
    subject,
    course,
    topic,
    question,
    studentDraft,
    lessonContext,
    courseTopics,
    recentHistory,
  } = params;

  const officialAnswer = question
    ? question.verification_status === 'verified'
      ? [
          question.correct_answer ? `Official Answer Key: ${question.correct_answer}` : '',
          question.official_solution_excerpt ? `Worked Solution / Rubric Note: ${question.official_solution_excerpt}` : '',
        ]
          .filter(Boolean)
          .join('\n') || null
      : 'Unverified answer key (no printed solution key).'
    : null;

  const trimmedSubject = subject?.trim();
  const sourceCitation = question
    ? `${question.course_code} · ${question.topic_name} (${question.examination_year})`
    : course
    ? `${course.code} — ${course.title} (${course.semester})`
    : trimmedSubject && trimmedSubject.toLowerCase() !== 'all'
    ? trimmedSubject
    : 'General Academic & Knowledge';

  const contextLines = [
    'You are the Divshinastudy AI Academic & Knowledge Agent.',
    'Core Capabilities & Rules:',
    '- You are a versatile, scholarly, and accurate AI agent capable of answering ANY academic question (Mathematics, Statistics, Computer Science & Programming, Physics, Chemistry, Biology, Engineering, Economics, Accounting, Business, Law, Medicine, Literature, History, Philosophy, Languages) as well as any general knowledge, conceptual, or practical question.',
    '- Deliver genuine, high-value teaching: give a direct, clear answer first, then break down concepts step by step with concrete formulas, derivations, real-world analogies, or runnable fenced code blocks where appropriate.',
    '- Format cleanly using concise Markdown headings (###), bold key terms (**term**), numbered/bulleted lists, fenced code blocks with language tags, and clean readable mathematical notation (preferring Unicode symbols like ², √, ×, °, ⇒ or simple formulas over verbose LaTeX macros).',
    '- If a specific course, syllabus note, or past question is attached below, anchor your explanation to that material and clearly distinguish verified source-paper facts from AI teaching guidance. Otherwise, answer freely across the requested subject or general knowledge without artificial curriculum restrictions.',
    '- When using web search grounding for factual, historical, scientific, or current topics, synthesize accurate facts concisely without inventing citations or unverified numbers.',
    '- If a question is ambiguous, state the most standard interpretation clearly, answer it completely, and note any important edge cases.',
    '- Keep explanations thorough yet focused (~180 to 550 words unless deeper multi-step working is required).',
  ];

  if (trimmedSubject && trimmedSubject.toLowerCase() !== 'all') {
    contextLines.push(`Subject / Discipline Focus: ${trimmedSubject}`);
  }
  if (course) {
    contextLines.push(`Attached Course: ${course.code} — ${course.title} (${course.semester})`);
    if (course.description) {
      contextLines.push(`Course Description: ${course.description}`);
    }
  }
  if (courseTopics?.length) {
    contextLines.push(
      `Course Syllabus Topics: ${courseTopics.map((t) => `${t.title} (${t.summary})`).join(' | ')}`
    );
  }
  if (topic) {
    contextLines.push(`Focused Topic: ${topic.title} — ${topic.summary}`);
  }
  if (lessonContext) {
    contextLines.push(`Supplied Course Notes:\n${lessonContext}`);
  }
  if (question) {
    contextLines.push(
      `Attached Question (${question.examination_year}, ${question.session_type}, Q${question.question_number}, status=${question.verification_status}):`
    );
    contextLines.push(question.question_text);
    if (question.options?.length) {
      contextLines.push('Options: ' + question.options.map((o) => `${o.label}) ${o.text}`).join(' | '));
    }
    if (question.marking_scheme?.length) {
      contextLines.push('Expected Solution Criteria: ' + question.marking_scheme.join('; '));
    }
    if (officialAnswer) {
      contextLines.push(`Reference Material:\n${officialAnswer}`);
    }
  }
  if (studentDraft?.trim()) {
    contextLines.push(`Student Draft Answer:\n${studentDraft.trim()}`);
  }
  if (recentHistory?.length) {
    const historySnippet = recentHistory
      .slice(0, 4)
      .reverse()
      .map((turn, idx) => `Turn ${idx + 1} User: ${turn.prompt}\nTurn ${idx + 1} Agent: ${turn.ai_explanation.slice(0, 400)}`)
      .join('\n---\n');
    contextLines.push(`Recent Conversation Context:\n${historySnippet}`);
  }

  let modeInstruction = '';
  switch (mode) {
    case 'hint':
      modeInstruction =
        'Mode: Conceptual Hint. Give clear intuition, the governing principle or formula, and the opening step WITHOUT immediately spoiling the final answer.';
      break;
    case 'step_by_step':
      modeInstruction =
        'Mode: Step-by-Step Worked Solution. Teach using sections: ### Core Principle, ### Step-by-Step Working, ### Final Answer & Verification, and ### Common Mistake to Avoid.';
      break;
    case 'theory_feedback':
      modeInstruction =
        'Mode: Draft Review & Coaching. Evaluate the student draft objectively using sections: ### What You Got Right, ### Gaps or Corrections Needed, and ### Improved Model Answer.';
      break;
    case 'explain_question':
    case 'deep_explain':
      modeInstruction =
        'Mode: Deep Concept Explanation. Teach the underlying concept thoroughly using ### Core Concept, ### Clear Illustration / Example, ### Why It Matters, and ### Quick Takeaway.';
      break;
    case 'quiz_me':
      modeInstruction =
        'Mode: Interactive Practice Check. Provide a brief recap of the topic followed by 3 progressive practice questions (with hidden/collapsible-friendly **Answer Key & Brief Explanations** at the bottom) so the learner can test themselves.';
      break;
    case 'fact_check':
      modeInstruction =
        'Mode: Research & Verification. Verify claims carefully, present balanced factual evidence, distinguish consensus facts from nuances, and provide clear takeaways.';
      break;
    case 'code_debug':
      modeInstruction =
        'Mode: Programming & Debugging Mentor. Diagnose root causes, explain concepts cleanly, and provide complete, idiomatic code examples with time/space or edge-case notes.';
      break;
    case 'revision_chat':
    case 'ask_anything':
    default:
      modeInstruction =
        'Mode: Academic & Knowledge Agent. Provide a well-structured, authoritative response with ### Direct Answer, ### Explanation & Examples, and (when helpful) ### Quick Self-Check or Next Step.';
  }

  return {
    systemInstruction: contextLines.join('\n'),
    userMessage: `${modeInstruction}\n\nQuestion / Request: ${studentPrompt}`,
    officialAnswer,
    sourceCitation,
  };
}

function mapGeminiError(err: unknown): Error {
  const rawMsg = err instanceof Error ? err.message : String(err);
  let extractedMsg = rawMsg;
  if (rawMsg.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(rawMsg) as { error?: { message?: string; status?: string; code?: number } };
      if (parsed?.error?.message) {
        extractedMsg = parsed.error.message;
      }
    } catch {
      // Keep original string if not valid JSON
    }
  }

  const name = err instanceof Error ? err.name : '';
  const status = (err as { status?: number })?.status;
  const causeMsg =
    err instanceof Error && (err as { cause?: unknown }).cause
      ? String((err as { cause?: { message?: string; code?: string } }).cause?.message || (err as { cause?: unknown }).cause)
      : '';

  if (status === 400 && /API_KEY_INVALID|API key not valid/i.test(extractedMsg)) {
    return new Error('The configured Gemini API key is invalid. Please verify GEMINI_API_KEY in Settings > Secrets.');
  }
  if (status === 403 || /PERMISSION_DENIED/i.test(extractedMsg)) {
    return new Error('Gemini API access was denied. Please check GEMINI_API_KEY permissions in Settings > Secrets.');
  }
  if (status === 429 || /RESOURCE_EXHAUSTED/i.test(extractedMsg)) {
    return new Error('AI Agent rate limit reached temporarily. Please wait a moment and try again.');
  }
  if (status === 503 || /UNAVAILABLE|high demand/i.test(extractedMsg)) {
    return new Error('The AI service is experiencing temporary high demand. Please retry in a few seconds.');
  }
  if (
    name === 'TimeoutError' ||
    name === 'AbortError' ||
    /TimeoutError|aborted|timed out/i.test(`${extractedMsg} ${causeMsg}`)
  ) {
    return new Error('AI Agent request timed out reaching Gemini. Please retry in a few seconds.');
  }
  return new Error(extractedMsg || 'Unable to generate AI Agent response right now.');
}

function buildConversationContents(params: {
  userMessage: string;
  recentHistory?: TutorHistoryTurn[];
  attachment?: AgentAttachmentInput;
}): Content[] {
  const contents: Content[] = [];
  if (params.recentHistory?.length) {
    const turns = params.recentHistory.slice(0, 4).reverse();
    for (const turn of turns) {
      if (turn.prompt?.trim() && turn.ai_explanation?.trim()) {
        contents.push({ role: 'user', parts: [{ text: turn.prompt.trim() }] });
        contents.push({ role: 'model', parts: [{ text: turn.ai_explanation.slice(0, 1200) }] });
      }
    }
  }

  const userParts: Part[] = [];
  if (params.attachment) {
    if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(params.attachment.mimeType)) {
      throw new Error('Unsupported attachment type. Upload PNG, JPEG, WEBP, or PDF files only.');
    }
    userParts.push({
      inlineData: {
        mimeType: params.attachment.mimeType,
        data: params.attachment.data,
      },
    });
  }
  userParts.push({ text: params.userMessage });
  contents.push({ role: 'user', parts: userParts });
  return contents;
}

async function callModelWithOptionalSearch(params: {
  ai: GoogleGenAI;
  model: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';
  contents: Content[];
  systemInstruction: string;
  enableSearch: boolean;
  timeoutMs: number;
}): Promise<{ response: GenerateContentResponse; usedSearch: boolean }> {
  const { ai, model, contents, systemInstruction, enableSearch, timeoutMs } = params;

  const baseConfig: Record<string, unknown> = {
    systemInstruction,
    abortSignal: AbortSignal.timeout(timeoutMs),
  };
  if (model === 'gemini-4-hydrogen') {
    baseConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
  }

  if (enableSearch) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          ...baseConfig,
          tools: [{ googleSearch: {} }],
        },
      });
      return { response, usedSearch: true };
    } catch (searchErr) {
      const msg = searchErr instanceof Error ? searchErr.message : String(searchErr);
      const status = (searchErr as { status?: number })?.status;
      // Strip googleSearch tool if backend rejects tool param (400) or search-grounding quota is throttled (429),
      // while letting invalid API keys fail immediately.
      if (
        (status === 400 || status === 429 || /RESOURCE_EXHAUSTED/i.test(msg)) &&
        !/API_KEY_INVALID|API key not valid/i.test(msg)
      ) {
        console.warn('[Divshinastudy Agent] Retrying without search tool after', status || msg);
        const fallbackResponse = await ai.models.generateContent({
          model,
          contents,
          config: baseConfig,
        });
        return { response: fallbackResponse, usedSearch: false };
      }
      throw searchErr;
    }
  }

  const response = await ai.models.generateContent({
    model,
    contents,
    config: baseConfig,
  });
  return { response, usedSearch: false };
}

export async function generateGroundedTutorResponse(params: {
  mode: AgentMode;
  studentPrompt: string;
  subject?: string;
  course?: Course;
  topic?: Topic;
  question?: Question;
  studentDraft?: string;
  lessonContext?: string;
  courseTopics?: Topic[];
  recentHistory?: TutorHistoryTurn[];
  attachment?: AgentAttachmentInput;
  enableWebSearch?: boolean;
}): Promise<{
  aiExplanation: string;
  officialAnswer: string | null;
  sourceCitation: string | null;
  sources: GroundingSource[];
  toolsUsed: string[];
}> {
  const ai = getGeminiClient();
  const { systemInstruction, userMessage, officialAnswer, sourceCitation } = buildTutorPromptContext(params);
  const contents = buildConversationContents({
    userMessage,
    recentHistory: params.recentHistory,
    attachment: params.attachment,
  });
  const enableSearch = params.enableWebSearch !== false;

  const tPrimary = Date.now();
  try {
    const { response, usedSearch } = await callModelWithOptionalSearch({
      ai,
      model: 'gemini-4-hydrogen',
      contents,
      systemInstruction,
      enableSearch,
      timeoutMs: 14000,
    });

    const aiExplanation = response.text?.trim();
    if (!aiExplanation) {
      throw new Error('AI Agent returned an empty response. Please try phrasing your question again.');
    }

    const sources = extractGroundingSources(response);
    const toolsUsed: string[] = [];
    if (usedSearch && sources.length > 0) toolsUsed.push('google_search');
    if (params.question || params.course) toolsUsed.push('course_context');
    if (params.attachment) toolsUsed.push('document_vision');

    return {
      aiExplanation,
      officialAnswer,
      sourceCitation,
      sources,
      toolsUsed,
    };
  } catch (primaryErr) {
    const primaryElapsed = Date.now() - tPrimary;
    const primaryMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
    const primaryName = primaryErr instanceof Error ? primaryErr.name : '';
    const primaryStatus = (primaryErr as { status?: number })?.status;
    console.error('[Divshinastudy Gemini primary error]', {
      model: 'gemini-4-hydrogen',
      elapsedMs: primaryElapsed,
      name: primaryName,
      status: primaryStatus,
      message: primaryMsg,
      hasBaseUrl: Boolean(process.env.GOOGLE_GEMINI_BASE_URL),
      hasProxy: Boolean(process.env.HTTPS_PROXY || process.env.HTTP_PROXY),
    });

    const isAuthError =
      primaryStatus === 400 ||
      primaryStatus === 401 ||
      primaryStatus === 403 ||
      /API_KEY_INVALID|PERMISSION_DENIED/i.test(primaryMsg);

    const canFallback =
      !isAuthError &&
      (primaryStatus === 429 ||
        /RESOURCE_EXHAUSTED/i.test(primaryMsg) ||
        primaryName === 'TimeoutError' ||
        primaryName === 'AbortError' ||
        primaryStatus === 404 ||
        (typeof primaryStatus === 'number' && primaryStatus >= 500) ||
        /aborted|timed out|TimeoutError/i.test(primaryMsg));

    if (!canFallback) {
      throw mapGeminiError(primaryErr);
    }

    const tFallback = Date.now();
    try {
      const { response: fallbackResponse, usedSearch } = await callModelWithOptionalSearch({
        ai,
        model: 'gemini-3.1-flash-lite',
        contents,
        systemInstruction,
        enableSearch,
        timeoutMs: 30000,
      });
      const fallbackText = fallbackResponse.text?.trim();
      if (!fallbackText) {
        throw new Error('AI Agent returned an empty response. Please try phrasing your question again.');
      }

      const sources = extractGroundingSources(fallbackResponse);
      const toolsUsed: string[] = [];
      if (usedSearch && sources.length > 0) toolsUsed.push('google_search');
      if (params.question || params.course) toolsUsed.push('course_context');
      if (params.attachment) toolsUsed.push('document_vision');

      return {
        aiExplanation: fallbackText,
        officialAnswer,
        sourceCitation,
        sources,
        toolsUsed,
      };
    } catch (fallbackErr) {
      const fallbackElapsed = Date.now() - tFallback;
      const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      const fallbackName = fallbackErr instanceof Error ? fallbackErr.name : '';
      const fallbackStatus = (fallbackErr as { status?: number })?.status;
      console.error('[Divshinastudy Gemini fallback error]', {
        model: 'gemini-3.1-flash-lite',
        elapsedMs: fallbackElapsed,
        name: fallbackName,
        status: fallbackStatus,
        message: fallbackMsg,
      });
      throw mapGeminiError(fallbackErr);
    }
  }
}
