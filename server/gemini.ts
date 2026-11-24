import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { Course, Question, Topic } from '../src/types';

export interface TutorHistoryTurn {
  prompt: string;
  ai_explanation: string;
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

export function buildTutorPromptContext(params: {
  mode: 'explain_question' | 'hint' | 'step_by_step' | 'revision_chat' | 'theory_feedback';
  studentPrompt: string;
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

  const sourceCitation = question
    ? `${question.course_code} · ${question.topic_name} (${question.examination_year})`
    : course
    ? `${course.code} — ${course.title} (ND2 ${course.semester})`
    : null;

  const contextLines = [
    'You are Divshinastudy AI Academic Tutor for ND2 (National Diploma 2) students.',
    'Rules:',
    '- Strictly scope every explanation, example, and syllabus point to ND2 (National Diploma 2) level only. Exclude content from other academic levels.',
    '- Deliver genuine, high-value teaching: break down concepts clearly, show concrete worked steps, code snippets, or formulas, and highlight exam pitfalls.',
    '- Format your response cleanly using short Markdown headings (###), bold key terms (**term**), bullet lists (-), and fenced code blocks where appropriate.',
    '- Clearly distinguish verified past-question facts from your AI teaching guidance.',
    '- If a supplied source question is marked unverified, state that no official solution key was printed in the source paper and provide a rigorous academic derivation.',
    '- Keep explanations thorough yet focused (~180 to 450 words) so the student learns how to solve similar questions independently.',
  ];

  if (course) {
    contextLines.push(`Course: ${course.code} — ${course.title} (${course.semester}, ND2)`);
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
    contextLines.push(`Supplied ND2 Curriculum Notes:\n${lessonContext}`);
  }
  if (question) {
    contextLines.push(
      `Attached Past Question (${question.examination_year}, ${question.session_type}, Q${question.question_number}, status=${question.verification_status}):`
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
      .slice(0, 3)
      .reverse()
      .map((turn, idx) => `Turn ${idx + 1} Student: ${turn.prompt}\nTurn ${idx + 1} Tutor: ${turn.ai_explanation.slice(0, 350)}`)
      .join('\n---\n');
    contextLines.push(`Recent Tutor Conversation Context:\n${historySnippet}`);
  }

  let modeInstruction = '';
  switch (mode) {
    case 'hint':
      modeInstruction =
        'Mode: Conceptual Hint. Give a clear intuition, the governing rule or formula, and the first starting step WITHOUT giving away the final option letter or answer directly.';
      break;
    case 'step_by_step':
      modeInstruction =
        'Mode: Step-by-Step Worked Solution. Teach using sections: ### Core Concept, ### Step-by-Step Working, ### Final Result & Verification, and ### Quick Exam Tip.';
      break;
    case 'theory_feedback':
      modeInstruction =
        'Mode: Draft Review & Coaching. Evaluate the student draft against the ND2 marking criteria using sections: ### What You Got Right, ### Missing or Weak Points, and ### Improved Model Answer.';
      break;
    case 'explain_question':
      modeInstruction =
        'Mode: Explain Concept & Answer. Teach the underlying ND2 concept, explain why the correct answer holds and why common distractors fail, and include a quick takeaway.';
      break;
    default:
      modeInstruction =
        'Mode: Interactive ND2 Teaching. Provide a structured lesson with ### Key Concept Explanation, ### Worked Example / Illustration, and ### Quick Practice Check (include 1 short practice question and its answer so the student can test themselves).';
  }

  return {
    systemInstruction: contextLines.join('\n'),
    userMessage: `${modeInstruction}\n\nStudent Request: ${studentPrompt}`,
    officialAnswer,
    sourceCitation,
  };
}

function mapGeminiError(err: unknown): Error {
  const rawMsg = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : '';
  const status = (err as { status?: number })?.status;
  const causeMsg =
    err instanceof Error && (err as { cause?: unknown }).cause
      ? String((err as { cause?: { message?: string; code?: string } }).cause?.message || (err as { cause?: unknown }).cause)
      : '';

  if (status === 400 && /API_KEY_INVALID|API key not valid/i.test(rawMsg)) {
    return new Error('The configured Gemini API key is invalid. Please check GEMINI_API_KEY in Settings > Secrets.');
  }
  if (status === 403 || /PERMISSION_DENIED/i.test(rawMsg)) {
    return new Error('Gemini API access was denied. Please check your GEMINI_API_KEY permissions in Settings > Secrets.');
  }
  if (status === 429 || /RESOURCE_EXHAUSTED/i.test(rawMsg)) {
    return new Error('AI Tutor rate limit reached temporarily. Please wait a moment and try again.');
  }
  if (
    name === 'TimeoutError' ||
    name === 'AbortError' ||
    /TimeoutError|aborted|timed out/i.test(`${rawMsg} ${causeMsg}`)
  ) {
    return new Error('AI Tutor request timed out reaching Gemini. Please retry in a few seconds.');
  }
  return new Error(rawMsg || 'Unable to generate AI Tutor explanation right now.');
}

export async function generateGroundedTutorResponse(params: {
  mode: 'explain_question' | 'hint' | 'step_by_step' | 'revision_chat' | 'theory_feedback';
  studentPrompt: string;
  course?: Course;
  topic?: Topic;
  question?: Question;
  studentDraft?: string;
  lessonContext?: string;
  courseTopics?: Topic[];
  recentHistory?: TutorHistoryTurn[];
}): Promise<{
  aiExplanation: string;
  officialAnswer: string | null;
  sourceCitation: string | null;
}> {
  const ai = getGeminiClient();
  const { systemInstruction, userMessage, officialAnswer, sourceCitation } = buildTutorPromptContext(params);

  const tPrimary = Date.now();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: userMessage,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        abortSignal: AbortSignal.timeout(10000),
      },
    });

    const aiExplanation = response.text?.trim();
    if (!aiExplanation) {
      throw new Error('AI Tutor returned an empty response. Please try phrasing your question again.');
    }

    return {
      aiExplanation,
      officialAnswer,
      sourceCitation,
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

    const isAuthOrQuota =
      primaryStatus === 400 ||
      primaryStatus === 401 ||
      primaryStatus === 403 ||
      primaryStatus === 429 ||
      /API_KEY_INVALID|PERMISSION_DENIED|RESOURCE_EXHAUSTED/i.test(primaryMsg);

    const canFallback =
      !isAuthOrQuota &&
      (primaryName === 'TimeoutError' ||
        primaryName === 'AbortError' ||
        primaryStatus === 404 ||
        (typeof primaryStatus === 'number' && primaryStatus >= 500) ||
        /aborted|timed out|TimeoutError/i.test(primaryMsg));

    if (!canFallback) {
      throw mapGeminiError(primaryErr);
    }

    const tFallback = Date.now();
    try {
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: userMessage,
        config: {
          systemInstruction,
          abortSignal: AbortSignal.timeout(30000),
        },
      });
      const fallbackText = fallbackResponse.text?.trim();
      if (!fallbackText) {
        throw new Error('AI Tutor returned an empty response. Please try phrasing your question again.');
      }
      return {
        aiExplanation: fallbackText,
        officialAnswer,
        sourceCitation,
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
