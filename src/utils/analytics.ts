import type { Course, ExamAttempt, Question, StudentProgress, Topic } from '../types';

export interface DashboardProgressSummary {
  overallPercentage: number;
  completedCount: number;
  inProgressCount: number;
  pendingCount: number;
  totalTopics: number;
}

export interface PerformancePoint {
  label: string;
  score: number;
  courseCode: string;
  dateIso: string;
}

export interface TopicWeakness {
  topicId: string;
  topicName: string;
  courseCode: string;
  courseTitle: string;
  masteryPercentage: number;
  attempted: number;
  correct: number;
  status: 'completed' | 'in_progress' | 'pending';
}

export interface RecommendedStudyItem {
  id: string;
  title: string;
  subtitle: string;
  courseCode: string;
  courseId: string;
  topicId?: string;
  actionType: 'Practice' | 'Learn';
  targetUrl: string;
  reason: string;
}

export function computeDashboardProgress(
  topics: Topic[],
  progressRecords: StudentProgress[]
): DashboardProgressSummary {
  const progressByTopic = new Map(progressRecords.map((p) => [p.topic_id, p]));
  let completedCount = 0;
  let inProgressCount = 0;
  let pendingCount = 0;
  let sumMastery = 0;

  for (const topic of topics) {
    const rec = progressByTopic.get(topic.id);
    if (!rec || rec.questions_attempted === 0) {
      pendingCount += 1;
    } else if (rec.status === 'completed' || rec.mastery_percentage >= 75) {
      completedCount += 1;
      sumMastery += rec.mastery_percentage;
    } else {
      inProgressCount += 1;
      sumMastery += rec.mastery_percentage;
    }
  }

  const totalTopics = topics.length;
  const overallPercentage = totalTopics > 0 ? Math.round(sumMastery / totalTopics) : 0;

  return {
    overallPercentage,
    completedCount,
    inProgressCount,
    pendingCount,
    totalTopics,
  };
}

export function computePerformanceSeries(attempts: ExamAttempt[]): PerformancePoint[] {
  const submitted = attempts
    .filter((a) => a.status === 'submitted' || a.status === 'expired')
    .sort((a, b) => new Date(a.submitted_at || a.started_at).getTime() - new Date(b.submitted_at || b.started_at).getTime());

  return submitted.slice(-8).map((attempt, index) => ({
    label: `Attempt ${index + 1}`,
    score: attempt.percentage,
    courseCode: attempt.course_code,
    dateIso: attempt.submitted_at || attempt.started_at,
  }));
}

export function computeTopicWeaknesses(
  courses: Course[],
  topics: Topic[],
  progressRecords: StudentProgress[]
): TopicWeakness[] {
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const progressByTopic = new Map(progressRecords.map((p) => [p.topic_id, p]));

  return topics
    .map((topic) => {
      const course = courseById.get(topic.course_id);
      const prog = progressByTopic.get(topic.id);
      return {
        topicId: topic.id,
        topicName: topic.title,
        courseCode: course?.code ?? topic.course_code,
        courseTitle: course?.title ?? topic.course_code,
        masteryPercentage: prog?.mastery_percentage ?? 0,
        attempted: prog?.questions_attempted ?? 0,
        correct: prog?.questions_correct ?? 0,
        status: prog?.status ?? 'pending',
      };
    })
    .sort((a, b) => {
      // Weakest attempted topics first, then unattempted priority topics
      if (a.attempted > 0 && b.attempted === 0) return -1;
      if (a.attempted === 0 && b.attempted > 0) return 1;
      return a.masteryPercentage - b.masteryPercentage;
    });
}

export function buildRecommendedItems(
  courses: Course[],
  topics: Topic[],
  questions: Question[],
  progressRecords: StudentProgress[],
  departmentId?: string
): RecommendedStudyItem[] {
  const weaknesses = computeTopicWeaknesses(courses, topics, progressRecords);
  const items: RecommendedStudyItem[] = [];
  const usedCourses = new Set<string>();

  // Prioritize weak topics if user already has attempts
  for (const w of weaknesses) {
    if (w.attempted > 0 && w.masteryPercentage < 75 && items.length < 3) {
      const course = courses.find((c) => c.code === w.courseCode);
      if (!course) continue;
      items.push({
        id: `rec-weak-${w.topicId}`,
        title: w.topicName,
        subtitle: `${w.courseTitle} · Mastery ${w.masteryPercentage}%`,
        courseCode: w.courseCode,
        courseId: course.id,
        topicId: w.topicId,
        actionType: 'Learn',
        targetUrl: `/ai-tutor?course=${encodeURIComponent(course.code)}&topic=${encodeURIComponent(w.topicId)}`,
        reason: `Score below 75% on ${w.topicName}`,
      });
      usedCourses.add(course.id);
    }
  }

  // Fill remaining slots with department-relevant ND2 past question courses (starting with MTH 209 Calculus & core COM courses)
  const sortedCourses = [...courses].sort((a, b) => {
    const aDept = departmentId && a.department_id === departmentId ? 0 : 1;
    const bDept = departmentId && b.department_id === departmentId ? 0 : 1;
    if (aDept !== bDept) return aDept - bDept;
    if (a.code === 'MTH 209') return -1;
    if (b.code === 'MTH 209') return 1;
    return a.code.localeCompare(b.code);
  });

  for (const course of sortedCourses) {
    if (items.length >= 3) break;
    if (usedCourses.has(course.id) && items.length >= 2) continue;
    const latestYear = course.sessions_available[course.sessions_available.length - 1] ?? '2023/2024';
    const courseTopics = topics.filter((t) => t.course_id === course.id);
    const hasQuestions = questions.some((q) => q.course_id === course.id);
    if (!hasQuestions) continue;

    if (items.length === 0) {
      items.push({
        id: `rec-practice-${course.id}`,
        title: `${course.title} - Past Questions (ND2)`,
        subtitle: `${course.code} · ${latestYear}`,
        courseCode: course.code,
        courseId: course.id,
        actionType: 'Practice',
        targetUrl: `/questions?course=${encodeURIComponent(course.code)}`,
        reason: 'Core ND2 past paper practice',
      });
    } else {
      const targetTopic = courseTopics[0];
      items.push({
        id: `rec-topic-${course.id}-${targetTopic?.id ?? 'overview'}`,
        title: targetTopic ? targetTopic.title : `${course.title} Revision`,
        subtitle: course.title,
        courseCode: course.code,
        courseId: course.id,
        topicId: targetTopic?.id,
        actionType: 'Learn',
        targetUrl: `/courses/${encodeURIComponent(course.code)}`,
        reason: 'Recommended ND2 revision module',
      });
    }
    usedCourses.add(course.id);
  }

  return items.slice(0, 3);
}
