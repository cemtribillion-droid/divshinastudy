import type { AcademicLevel, Semester } from '../types';

export const ALLOWED_ACADEMIC_LEVEL: AcademicLevel = 'ND2';

const DISALLOWED_LEVEL_PATTERN = /\b(ND\s*1|ND\s*I\b|ND\s*3|ND\s*III|HND\s*1|HND\s*I\b|HND\s*2|HND\s*II)\b/i;

export function assertND2Level(level: unknown): AcademicLevel {
  if (typeof level !== 'string') {
    throw new Error('Academic level is required and strictly restricted to ND2.');
  }
  const normalized = level.trim().toUpperCase().replace(/\s+/g, '');
  if (normalized !== 'ND2') {
    throw new Error(`Invalid academic level "${level}". Divshinastudy strictly supports ND2 only.`);
  }
  return ALLOWED_ACADEMIC_LEVEL;
}

export function enforceND2Profile<T extends { academic_level?: unknown }>(
  payload: T,
): Omit<T, 'academic_level'> & { academic_level: AcademicLevel } {
  if (payload.academic_level !== undefined && payload.academic_level !== null && payload.academic_level !== '') {
    assertND2Level(payload.academic_level);
  }
  return {
    ...payload,
    academic_level: ALLOWED_ACADEMIC_LEVEL,
  };
}

export function normalizeSemester(input: unknown): Semester {
  if (typeof input !== 'string') {
    throw new Error('Semester must be First Semester or Second Semester.');
  }
  const lower = input.trim().toLowerCase();
  if (lower === 'first semester' || lower === '1st semester' || lower === 'first') {
    return 'First Semester';
  }
  if (lower === 'second semester' || lower === '2nd semester' || lower === 'second') {
    return 'Second Semester';
  }
  throw new Error(`Unsupported semester "${input}". Allowed values: First Semester, Second Semester.`);
}

export function containsDisallowedAcademicLevel(text: string): boolean {
  return DISALLOWED_LEVEL_PATTERN.test(text);
}
