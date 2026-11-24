import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import seedCatalog from './seedCatalog.json';
import type {
  AiLearningHistory,
  AuditLog,
  Course,
  Department,
  ExamAttempt,
  PdfImportRecord,
  PlatformSettings,
  Question,
  SavedQuestion,
  StudentAnswer,
  StudentProgress,
  Topic,
  UserProfile,
} from '../src/types';
const SEED_DEPARTMENTS: Department[] = [
  {
    id: 'dept-com',
    code: 'COM',
    name: 'Computer Technology',
    school: 'School of Technology',
    description: 'ND2 Computer Science & Information Technology curriculum.',
    academic_level: 'ND2',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'dept-mth',
    code: 'MTH',
    name: 'Mathematics',
    school: 'School of Science',
    description: 'ND2 Calculus, Linear Algebra, and Quantitative Reasoning.',
    academic_level: 'ND2',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'dept-gns',
    code: 'GNS',
    name: 'General Studies & Entrepreneurship',
    school: 'School of Liberal Studies',
    description: 'ND2 Use of English, Communication Skills, and Entrepreneurship.',
    academic_level: 'ND2',
    created_at: '2026-01-01T00:00:00.000Z',
  },
];

const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  platform_name: 'Divshinastudy',
  strict_academic_level: 'ND2',
  default_cbt_question_count: 10,
  default_exam_duration_minutes: 30,
  pass_mark_percentage: 50,
  allow_self_registration: true,
  ai_tutor_enabled: true,
  updated_at: '2026-01-01T00:00:00.000Z',
};

const SEED_COURSES = seedCatalog.courses as Course[];
const SEED_TOPICS = seedCatalog.topics as Topic[];
const SEED_QUESTIONS = seedCatalog.questions as Question[];

export interface StoredUserRecord extends UserProfile {
  password_hash: string;
}

export interface PrepWiseDatabase {
  departments: Department[];
  courses: Course[];
  topics: Topic[];
  questions: Question[];
  users: StoredUserRecord[];
  exam_attempts: ExamAttempt[];
  student_answers: StudentAnswer[];
  student_progress: StudentProgress[];
  saved_questions: SavedQuestion[];
  ai_learning_history: AiLearningHistory[];
  pdf_imports: PdfImportRecord[];
  audit_logs: AuditLog[];
  platform_settings: PlatformSettings;
  auth_secret?: string;
  revision?: number;
}

export interface RemoteDbAdapter {
  load: () => Promise<Partial<PrepWiseDatabase> | null>;
  save: (db: PrepWiseDatabase) => Promise<void>;
}

function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.NETLIFY ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT ||
      process.env.VERCEL
  );
}

function resolveDataDir(): string {
  if (process.env.DIVSHINASTUDY_DATA_DIR) {
    return process.env.DIVSHINASTUDY_DATA_DIR;
  }
  if (isServerlessRuntime()) {
    return path.join(os.tmpdir(), 'divshinastudy-data');
  }
  const localDir = path.resolve(process.cwd(), 'data');
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    fs.accessSync(localDir, fs.constants.W_OK);
    return localDir;
  } catch {
    return path.join(os.tmpdir(), 'divshinastudy-data');
  }
}

function getDbFilePath(): { dataDir: string; dbFile: string } {
  const dataDir = resolveDataDir();
  return {
    dataDir,
    dbFile: path.join(dataDir, 'prepwise-db.json'),
  };
}

function createInitialDb(): PrepWiseDatabase {
  return {
    departments: structuredClone(SEED_DEPARTMENTS),
    courses: structuredClone(SEED_COURSES),
    topics: structuredClone(SEED_TOPICS),
    questions: structuredClone(SEED_QUESTIONS),
    users: [],
    exam_attempts: [],
    student_answers: [],
    student_progress: [],
    saved_questions: [],
    ai_learning_history: [],
    pdf_imports: [],
    audit_logs: [],
    platform_settings: structuredClone(DEFAULT_PLATFORM_SETTINGS),
  };
}

let cachedDb: PrepWiseDatabase | null = null;
let remoteAdapter: RemoteDbAdapter | null = null;
let remoteDirty = false;

export function registerRemoteDbAdapter(adapter: RemoteDbAdapter | null): void {
  remoteAdapter = adapter;
}

function reconcileDbState(parsed: Partial<PrepWiseDatabase>): { db: PrepWiseDatabase; changed: boolean } {
  const initial = createInitialDb();

  const mergeById = <T extends { id: string }>(existing: T[] | undefined, seeded: T[]): { list: T[]; changed: boolean } => {
    if (!existing?.length) return { list: seeded, changed: seeded.length > 0 };
    const seen = new Set(existing.map((item) => item.id));
    const additions = seeded.filter((item) => !seen.has(item.id));
    return {
      list: additions.length > 0 ? [...existing, ...additions] : existing,
      changed: additions.length > 0,
    };
  };

  const deptMerge = mergeById(parsed.departments, initial.departments);
  const courseMerge = mergeById(parsed.courses, initial.courses);
  const topicMerge = mergeById(parsed.topics, initial.topics);
  const questionMerge = mergeById(parsed.questions, initial.questions);

  const seedCourseById = new Map(initial.courses.map((c) => [c.id, c]));
  let coursesUpdated = false;
  const syncedCourses = courseMerge.list.map((c) => {
    const freshCourse = seedCourseById.get(c.id);
    if (
      freshCourse &&
      (c.title !== freshCourse.title ||
        c.description !== freshCourse.description ||
        JSON.stringify(c.sessions_available) !== JSON.stringify(freshCourse.sessions_available))
    ) {
      coursesUpdated = true;
      return {
        ...c,
        title: freshCourse.title,
        description: freshCourse.description,
        sessions_available: freshCourse.sessions_available,
      };
    }
    return c;
  });

  const seedQuestionById = new Map(initial.questions.map((q) => [q.id, q]));
  let questionsUpdated = false;
  const syncedQuestions = questionMerge.list.map((q) => {
    const fresh = seedQuestionById.get(q.id);
    if (!fresh) return q;

    const isAdminOverridden = q.verified_by === 'Admin Verified';
    const hasLegacyFilename =
      Boolean(q.source_document?.toLowerCase().endsWith('.json')) ||
      Boolean(q.official_solution_excerpt?.includes('.json')) ||
      Boolean(q.verified_by?.includes('PDF'));

    if (hasLegacyFilename) {
      questionsUpdated = true;
      return {
        ...fresh,
        verification_status: isAdminOverridden ? q.verification_status : fresh.verification_status,
        verified_by: isAdminOverridden ? q.verified_by : fresh.verified_by,
      };
    }

    if (!isAdminOverridden && JSON.stringify(q) !== JSON.stringify(fresh)) {
      questionsUpdated = true;
      return fresh;
    }

    return q;
  });

  const loadedSettings = parsed.platform_settings ?? initial.platform_settings;
  const settingsMigrated =
    loadedSettings.platform_name === 'PrepWise' ||
    loadedSettings.platform_name === 'QuietDesk' ||
    loadedSettings.platform_name === 'divshinastudy';
  const syncedSettings = settingsMigrated
    ? { ...loadedSettings, platform_name: 'Divshinastudy' }
    : loadedSettings;

  const db: PrepWiseDatabase = {
    departments: deptMerge.list,
    courses: syncedCourses,
    topics: topicMerge.list,
    questions: syncedQuestions,
    users: parsed.users ?? [],
    exam_attempts: parsed.exam_attempts ?? [],
    student_answers: parsed.student_answers ?? [],
    student_progress: parsed.student_progress ?? [],
    saved_questions: parsed.saved_questions ?? [],
    ai_learning_history: parsed.ai_learning_history ?? [],
    pdf_imports: parsed.pdf_imports ?? [],
    audit_logs: parsed.audit_logs ?? [],
    platform_settings: syncedSettings,
    auth_secret: parsed.auth_secret,
    revision: typeof parsed.revision === 'number' ? parsed.revision : 0,
  };

  const changed =
    deptMerge.changed ||
    courseMerge.changed ||
    topicMerge.changed ||
    questionMerge.changed ||
    coursesUpdated ||
    questionsUpdated ||
    settingsMigrated;

  return { db, changed };
}

export async function syncDbFromRemoteStore(): Promise<void> {
  if (!remoteAdapter) return;
  try {
    const remote = await remoteAdapter.load();
    if (remote && typeof remote === 'object') {
      const remoteRev = typeof remote.revision === 'number' ? remote.revision : 0;
      const localRev = typeof cachedDb?.revision === 'number' ? cachedDb.revision : 0;
      if (cachedDb && localRev > remoteRev) {
        // Keep newer in-memory DB when an eventual-consistency edge read returns an older snapshot
        remoteDirty = true;
        return;
      }
      const { db, changed } = reconcileDbState(remote);
      if (!db.auth_secret && cachedDb?.auth_secret) {
        db.auth_secret = cachedDb.auth_secret;
      }
      cachedDb = db;
      remoteDirty = changed;
      writeLocalFileSafely(db);
    } else if (!cachedDb) {
      readDb();
    }
  } catch (err) {
    console.warn('[Divshinastudy DB] Remote store read skipped:', err instanceof Error ? err.message : err);
  }
}

export async function flushDbToRemoteStore(): Promise<void> {
  if (!remoteAdapter || !remoteDirty || !cachedDb) return;
  try {
    await remoteAdapter.save(cachedDb);
    remoteDirty = false;
  } catch (err) {
    console.warn('[Divshinastudy DB] Remote store write failed:', err instanceof Error ? err.message : err);
  }
}

function writeLocalFileSafely(db: PrepWiseDatabase): void {
  try {
    const { dataDir, dbFile } = getDbFilePath();
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const tmpFile = `${dbFile}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmpFile, dbFile);
  } catch (err) {
    console.warn('[Divshinastudy DB] Local file write skipped:', err instanceof Error ? err.message : err);
  }
}

export function resetDbCacheForTesting(): void {
  cachedDb = null;
  remoteDirty = false;
}

export function readDb(): PrepWiseDatabase {
  if (cachedDb) {
    return cachedDb;
  }
  try {
    const { dataDir, dbFile } = getDbFilePath();
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(dbFile)) {
      const initial = createInitialDb();
      writeLocalFileSafely(initial);
      cachedDb = initial;
      return cachedDb;
    }
    const raw = fs.readFileSync(dbFile, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PrepWiseDatabase>;
    const { db, changed } = reconcileDbState(parsed);
    cachedDb = db;
    if (changed) {
      writeDb(cachedDb);
    }
    return cachedDb;
  } catch {
    const initial = createInitialDb();
    cachedDb = initial;
    return cachedDb;
  }
}

export function writeDb(db: PrepWiseDatabase): void {
  db.revision = Math.max((db.revision ?? 0) + 1, Date.now());
  cachedDb = db;
  remoteDirty = true;
  writeLocalFileSafely(db);
}

export function stripSensitiveUserFields(user: StoredUserRecord): UserProfile {
  const {
    password_hash: _ph,
    ...rest
  } = user as StoredUserRecord & Record<string, unknown>;
  delete rest.email_verified;
  delete rest.email_verification_token;
  delete rest.email_verification_code_hash;
  delete rest.email_verification_expires_at;
  delete rest.email_verification_attempts;
  delete rest.email_verification_sent_at;
  delete rest.reset_code_hash;
  delete rest.reset_code_expires_at;
  delete rest.reset_code_attempts;
  delete rest.reset_code_sent_at;
  delete rest.reset_token;
  delete rest.reset_token_expires_at;
  return rest as UserProfile;
}

export function recordAuditLog(
  db: PrepWiseDatabase,
  actor: { id: string; email: string },
  action: string,
  entity_type: string,
  entity_id: string,
  details: string
): void {
  db.audit_logs.unshift({
    id: `audit-${crypto.randomUUID()}`,
    actor_id: actor.id,
    actor_email: actor.email,
    action,
    entity_type,
    entity_id,
    details,
    created_at: new Date().toISOString(),
  });
  if (db.audit_logs.length > 500) {
    db.audit_logs = db.audit_logs.slice(0, 500);
  }
}
