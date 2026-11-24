import type { QuestionOption, QuestionType, Semester } from '../types';

export interface ParsedPdfMetadata {
  courseCode?: string;
  examinationYear?: string;
  semester?: Semester;
}

export interface ExtractedPdfQuestionDraft {
  temp_id: string;
  question_type: QuestionType;
  question_text: string;
  options?: QuestionOption[];
  proposed_answer?: string;
  source_page: number;
  approved: boolean;
}

export function detectPdfMetadata(rawText: string): ParsedPdfMetadata {
  const courseMatch = rawText.match(/\b(COM|MTH|STA|GNS)\s*([0-9]{3})\b/i);
  const yearMatch = rawText.match(/\b(20\d{2}\s*\/\s*20\d{2})\b/);
  const isFirst = /first\s+semester|1st\s+semester/i.test(rawText);
  const isSecond = /second\s+semester|2nd\s+semester/i.test(rawText);

  return {
    courseCode: courseMatch ? `${courseMatch[1].toUpperCase()} ${courseMatch[2]}` : undefined,
    examinationYear: yearMatch ? yearMatch[1].replace(/\s+/g, '') : undefined,
    semester: isFirst ? 'First Semester' : isSecond ? 'Second Semester' : undefined,
  };
}

export function extractQuestionDraftsFromText(rawText: string): ExtractedPdfQuestionDraft[] {
  const pages = rawText.split(/--\s*\d+\s+of\s+\d+\s*--|\f/);
  const drafts: ExtractedPdfQuestionDraft[] = [];

  pages.forEach((pageContent, idx) => {
    const pageNum = idx + 1;
    const lines = pageContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match numbered question stems like "1. What is..." or "(i) HTML is..." or "Question 3 ..."
      const mcqStem = line.match(/^(?:\(?([0-9]{1,2}|[ivx]{1,5})\)?[.)])\s+(.{12,})/i);
      if (mcqStem) {
        const stem = mcqStem[2].trim();
        const combinedNext = [line, lines[i + 1] ?? '', lines[i + 2] ?? ''].join(' ');
        const optMatches = [...combinedNext.matchAll(/(?:^|\s)([a-dA-D])[).]\s+((?:(?!\s+[a-dA-D][).]\s).){1,80})/g)];

        if (optMatches.length >= 3) {
          const options: QuestionOption[] = optMatches.slice(0, 4).map((m) => ({
            label: m[1].toUpperCase() as 'A' | 'B' | 'C' | 'D',
            text: m[2].trim(),
          }));
          drafts.push({
            temp_id: `draft-${pageNum}-${drafts.length + 1}`,
            question_type: 'mcq',
            question_text: stem.replace(/\s+[aA][).].*$/, '').trim(),
            options,
            source_page: pageNum,
            approved: false,
          });
          continue;
        }

        if (/true\s*or\s*false/i.test(pageContent) && !/\?$/.test(stem) && stem.length < 220) {
          drafts.push({
            temp_id: `draft-${pageNum}-${drafts.length + 1}`,
            question_type: 'true_false',
            question_text: stem,
            options: [
              { label: 'A', text: 'True' },
              { label: 'B', text: 'False' },
            ],
            source_page: pageNum,
            approved: false,
          });
          continue;
        }

        if (/_{3,}|\.{4,}/.test(stem)) {
          drafts.push({
            temp_id: `draft-${pageNum}-${drafts.length + 1}`,
            question_type: 'fill_gap',
            question_text: stem,
            source_page: pageNum,
            approved: false,
          });
        }
      } else if (/^QUESTION\s+(THREE|FOUR|FIVE|SIX|SEVEN|[3-7])\b/i.test(line)) {
        const block = lines.slice(i, i + 5).join(' ');
        drafts.push({
          temp_id: `draft-${pageNum}-${drafts.length + 1}`,
          question_type: 'theory',
          question_text: block,
          source_page: pageNum,
          approved: false,
        });
      }
    }
  });

  return drafts.slice(0, 40);
}
