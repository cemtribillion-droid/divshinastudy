import type { Question, StudentAnswer } from '../types';

export function normalizeAnswerToken(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function gradeObjectiveAnswer(question: Question, rawSelected: string): {
  isCorrect: boolean | null;
  marksAwarded: number;
  maxMarks: number;
} {
  const maxMarks = question.marks || 1;
  if (question.question_type === 'theory') {
    return { isCorrect: null, marksAwarded: 0, maxMarks };
  }

  if (question.verification_status === 'unverified' || !question.correct_answer) {
    return { isCorrect: null, marksAwarded: 0, maxMarks };
  }

  const selected = normalizeAnswerToken(rawSelected);
  const expected = normalizeAnswerToken(question.correct_answer);
  if (!selected) {
    return { isCorrect: false, marksAwarded: 0, maxMarks };
  }

  if (question.question_type === 'mcq') {
    // Allow matching either the option letter ('A') or exact option text
    const expectedLetter = expected.toUpperCase();
    const selectedLetter = selected.toUpperCase();
    if (selectedLetter === expectedLetter) {
      return { isCorrect: true, marksAwarded: maxMarks, maxMarks };
    }
    const matchingOpt = question.options?.find(
      (o) => normalizeAnswerToken(o.label) === expected || normalizeAnswerToken(o.text) === expected
    );
    const isMatch = Boolean(
      matchingOpt &&
        (selected.toUpperCase() === matchingOpt.label.toUpperCase() ||
          selected === normalizeAnswerToken(matchingOpt.text))
    );
    return { isCorrect: isMatch, marksAwarded: isMatch ? maxMarks : 0, maxMarks };
  }

  if (question.question_type === 'true_false') {
    const normTrue = new Set(['t', 'true']);
    const normFalse = new Set(['f', 'false']);
    const selBool = normTrue.has(selected) ? 'true' : normFalse.has(selected) ? 'false' : selected;
    const expBool = normTrue.has(expected) ? 'true' : normFalse.has(expected) ? 'false' : expected;
    const isMatch = selBool === expBool;
    return { isCorrect: isMatch, marksAwarded: isMatch ? maxMarks : 0, maxMarks };
  }

  // fill_gap: accept exact match or comma-separated accepted aliases in correct_answer (e.g. "POST | Power On Self Test")
  const acceptedVariants = question.correct_answer
    .split('|')
    .map((v) => normalizeAnswerToken(v))
    .filter(Boolean);
  const isMatch = acceptedVariants.some((variant) => variant === selected || (variant.length > 3 && selected.includes(variant)));
  return { isCorrect: isMatch, marksAwarded: isMatch ? maxMarks : 0, maxMarks };
}

export function evaluateTheoryKeywords(question: Question, studentText: string): {
  marksAwarded: number;
  maxMarks: number;
  matchedCriteria: string[];
  missedCriteria: string[];
} {
  const maxMarks = question.marks || 10;
  const scheme = question.marking_scheme ?? [];
  const trimmed = studentText.trim();
  if (!trimmed) {
    return {
      marksAwarded: 0,
      maxMarks,
      matchedCriteria: [],
      missedCriteria: scheme,
    };
  }

  if (scheme.length === 0) {
    const wordCount = trimmed.split(/\s+/).length;
    const ratio = Math.min(0.85, wordCount / 40);
    return {
      marksAwarded: Math.round(maxMarks * ratio * 10) / 10,
      maxMarks,
      matchedCriteria: [],
      missedCriteria: [],
    };
  }

  const lower = trimmed.toLowerCase();
  const matchedCriteria: string[] = [];
  const missedCriteria: string[] = [];

  for (const criterion of scheme) {
    const keywords = criterion
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4);
    const hits = keywords.filter((kw) => lower.includes(kw));
    if (keywords.length === 0 || hits.length >= Math.max(1, Math.ceil(keywords.length * 0.35))) {
      matchedCriteria.push(criterion);
    } else {
      missedCriteria.push(criterion);
    }
  }

  const ratio = matchedCriteria.length / scheme.length;
  const marksAwarded = Math.round(maxMarks * ratio * 10) / 10;
  return { marksAwarded, maxMarks, matchedCriteria, missedCriteria };
}

export function computeAttemptSummary(
  questions: Question[],
  answers: StudentAnswer[],
  passThresholdPct = 50
): {
  objectiveScore: number;
  objectiveTotal: number;
  theoryScore: number;
  theoryTotal: number;
  totalScore: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
} {
  const answerMap = new Map(answers.map((a) => [a.question_id, a]));
  let objectiveScore = 0;
  let objectiveTotal = 0;
  let theoryScore = 0;
  let theoryTotal = 0;

  for (const q of questions) {
    const ans = answerMap.get(q.id);
    const qMax = q.marks || (q.question_type === 'theory' ? 10 : 1);
    if (q.question_type === 'theory') {
      theoryTotal += qMax;
      theoryScore += ans ? ans.marks_awarded : 0;
    } else if (q.verification_status !== 'unverified' && q.correct_answer) {
      objectiveTotal += qMax;
      objectiveScore += ans ? ans.marks_awarded : 0;
    }
  }

  const totalScore = Math.round((objectiveScore + theoryScore) * 10) / 10;
  const maxScore = Math.round((objectiveTotal + theoryTotal) * 10) / 10;
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  return {
    objectiveScore: Math.round(objectiveScore * 10) / 10,
    objectiveTotal,
    theoryScore: Math.round(theoryScore * 10) / 10,
    theoryTotal,
    totalScore,
    maxScore,
    percentage,
    passed: percentage >= passThresholdPct,
  };
}

export function computeRemainingSeconds(expiresAtIso: string, nowMs = Date.now()): number {
  const expiryMs = new Date(expiresAtIso).getTime();
  if (Number.isNaN(expiryMs)) return 0;
  return Math.max(0, Math.floor((expiryMs - nowMs) / 1000));
}
