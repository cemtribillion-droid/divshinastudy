import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, CheckCircle2, Lock, Trash2 } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { PerformanceLineChart, ProgressDonut } from '../components/Charts';
import { apiRequest, ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { DashboardProgressSummary, PerformancePoint, TopicWeakness } from '../utils/analytics';
import type { Department, ExamAttempt, QuestionPublic, Semester, UserProfile } from '../types';

interface AnalyticsPayload {
  progress: DashboardProgressSummary;
  performanceSeries: PerformancePoint[];
  topicWeaknesses: TopicWeakness[];
  recentAttempts: ExamAttempt[];
}

export function ProgressAnalyticsPage() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      apiRequest<AnalyticsPayload>('/api/dashboard'),
      apiRequest<{ attempts: ExamAttempt[] }>('/api/exams/attempts'),
    ])
      .then(([dRes, aRes]) => {
        setData(dRes);
        setAttempts(aRes.attempts);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Unable to load progress analytics.'))
      .finally(() => setLoading(false));
  }, []);

  const p = data?.progress ?? {
    overallPercentage: 0,
    completedCount: 0,
    inProgressCount: 0,
    pendingCount: 0,
    totalTopics: 0,
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#1A1635]">My Progress & Analytics</h1>
          <p className="text-sm text-[#5E5780] mt-1">
            Real-time ND2 mastery metrics calculated strictly from your completed practices and examinations.
          </p>
        </div>

        {error && (
          <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="prepwise-card p-10 text-center text-sm text-[#6D658F]">Loading analytics...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-4 prepwise-card p-6 flex flex-col justify-between gap-4">
                <h2 className="font-display text-lg font-bold text-[#1A1635]">Topic Mastery Summary</h2>
                <div className="flex items-center justify-between gap-4">
                  <ProgressDonut
                    percentage={p.overallPercentage}
                    completed={p.completedCount}
                    inProgress={p.inProgressCount}
                    pending={p.pendingCount}
                  />
                  <div className="flex-1 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#5E5780]">Completed</span>
                      <span className="font-bold tabular-nums">{p.completedCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#5E5780]">In Progress</span>
                      <span className="font-bold tabular-nums">{p.inProgressCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#5E5780]">Pending</span>
                      <span className="font-bold tabular-nums">{p.pendingCount}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-8 prepwise-card p-6">
                <h2 className="font-display text-lg font-bold text-[#1A1635] mb-3">Exam Score Progression</h2>
                <PerformanceLineChart points={data?.performanceSeries ?? []} />
              </div>
            </div>

            {/* Topic Weakness Breakdown */}
            <div className="prepwise-card p-6 space-y-4">
              <h2 className="font-display text-lg font-bold text-[#1A1635]">ND2 Syllabus Topic Breakdown</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#ECE8F8] text-[#6D658F]">
                      <th className="py-2.5 pr-4 font-semibold">Course</th>
                      <th className="py-2.5 pr-4 font-semibold">Topic</th>
                      <th className="py-2.5 pr-4 font-semibold text-right">Attempted</th>
                      <th className="py-2.5 pr-4 font-semibold text-right">Mastery</th>
                      <th className="py-2.5 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F0FA]">
                    {(data?.topicWeaknesses ?? []).map((t) => (
                      <tr key={t.topicId} className="hover:bg-[#FAF9FE]">
                        <td className="py-3 pr-4 font-mono font-semibold text-[#4C1D95] whitespace-nowrap">{t.courseCode}</td>
                        <td className="py-3 pr-4 font-medium text-[#1A1635]">{t.topicName}</td>
                        <td className="py-3 pr-4 text-right tabular-nums text-[#5E5780]">{t.attempted}</td>
                        <td className="py-3 pr-4 text-right tabular-nums font-bold text-[#1A1635]">{t.masteryPercentage}%</td>
                        <td className="py-3 text-right whitespace-nowrap">
                          <Link
                            to={`/questions?course=${encodeURIComponent(t.courseCode)}&topic=${encodeURIComponent(t.topicId)}`}
                            className="text-[#6B34E8] font-semibold hover:underline"
                          >
                            Practise -&gt;
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Attempt History */}
            <div className="prepwise-card p-6 space-y-4">
              <h2 className="font-display text-lg font-bold text-[#1A1635]">Examination Attempt History</h2>
              {attempts.length === 0 ? (
                <p className="text-xs text-[#6D658F] py-4">No examination attempts recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#ECE8F8] text-[#6D658F]">
                        <th className="py-2.5 pr-4 font-semibold">Course</th>
                        <th className="py-2.5 pr-4 font-semibold">Mode</th>
                        <th className="py-2.5 pr-4 font-semibold">Status</th>
                        <th className="py-2.5 pr-4 font-semibold text-right">Score</th>
                        <th className="py-2.5 font-semibold text-right">Review</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3F0FA]">
                      {attempts.map((a) => (
                        <tr key={a.id} className="hover:bg-[#FAF9FE]">
                          <td className="py-3 pr-4 font-semibold text-[#1A1635]">
                            {a.course_code} · {a.course_title}
                          </td>
                          <td className="py-3 pr-4 uppercase font-mono">{a.mode}</td>
                          <td className="py-3 pr-4">{a.status}</td>
                          <td className="py-3 pr-4 text-right font-mono tabular-nums font-bold">
                            {a.status === 'in_progress' ? '—' : `${a.percentage}% (${a.total_score}/${a.max_score})`}
                          </td>
                          <td className="py-3 text-right whitespace-nowrap">
                            <Link
                              to={
                                a.status === 'in_progress'
                                  ? a.mode === 'theory'
                                    ? `/exams/theory/${a.id}`
                                    : `/exams/cbt/${a.id}`
                                  : `/exams/review/${a.id}`
                              }
                              className="text-[#6B34E8] font-semibold hover:underline"
                            >
                              {a.status === 'in_progress' ? 'Resume' : 'Review Answers'}
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

export function SavedQuestionsPage() {
  const [saved, setSaved] = useState<Array<{ id: string; question_id: string; note?: string; question: QuestionPublic }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSaved = () => {
    setLoading(true);
    setError('');
    apiRequest<{ saved: Array<{ id: string; question_id: string; note?: string; question: QuestionPublic }> }>(
      '/api/saved-questions'
    )
      .then((res) => setSaved(res.saved))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Unable to load saved questions.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSaved();
  }, []);

  const handleRemove = async (questionId: string) => {
    setError('');
    try {
      await apiRequest(`/api/saved-questions/${questionId}`, { method: 'DELETE' });
      setSaved((prev) => prev.filter((item) => item.question_id !== questionId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to remove saved question.');
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#1A1635]">Saved Questions</h1>
            <p className="text-sm text-[#5E5780] mt-1">
              ND2 past questions you bookmarked for focused revision.
            </p>
          </div>
          <Link to="/questions" className="text-xs font-semibold text-[#6B34E8] hover:underline whitespace-nowrap">
            Browse All Questions -&gt;
          </Link>
        </div>

        {error && (
          <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="prepwise-card p-10 text-center text-sm text-[#6D658F]">Loading saved items...</div>
        ) : saved.length === 0 ? (
          <div className="prepwise-card p-10 text-center space-y-3">
            <p className="text-sm font-semibold text-[#1A1635]">No bookmarked questions yet</p>
            <p className="text-xs text-[#6D658F]">
              Click "Save" on any past question in the library to build your personal ND2 revision deck.
            </p>
            <Link
              to="/questions"
              className="inline-block px-4 py-2 rounded-xl bg-gradient-to-r from-[#7B3FE4] to-[#6327E3] text-white text-xs font-semibold"
            >
              Explore Practice Questions
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {saved.map((item) => (
              <div key={item.id} className="prepwise-card p-6 space-y-3">
                <div className="flex items-center justify-between gap-3 text-xs text-[#6D658F]">
                  <span>
                    {item.question.course_code} · {item.question.topic_name} · {item.question.examination_year}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleRemove(item.question_id)}
                    className="inline-flex items-center gap-1 text-rose-600 hover:underline font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                </div>
                <p className="text-sm font-medium text-[#1A1635] whitespace-pre-line">{item.question.question_text}</p>
                <div className="flex items-center gap-3 pt-1">
                  <Link
                    to={`/ai-tutor?course=${encodeURIComponent(item.question.course_code)}&questionId=${encodeURIComponent(item.question_id)}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0369A1] hover:underline"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    <span>Ask AI Tutor</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export function ProfileSettingsPage() {
  const { user, setUser } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [matricNumber, setMatricNumber] = useState(user?.matric_number || '');
  const [departmentId, setDepartmentId] = useState(user?.department_id || 'dept-com');
  const [semester, setSemester] = useState<Semester>(user?.preferred_semester || 'Second Semester');
  const [studyGoal, setStudyGoal] = useState(user?.study_goal_minutes_daily || 45);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<{ departments: Department[] }>('/api/public/catalog')
      .then((res) => setDepartments(res.departments))
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const res = await apiRequest<{ user: UserProfile }>('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: fullName,
          matric_number: matricNumber,
          department_id: departmentId,
          preferred_semester: semester,
          study_goal_minutes_daily: Number(studyGoal),
          academic_level: 'ND2',
        }),
      });
      setUser(res.user);
      setMessage('Profile & ND2 preferences saved.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#1A1635]">Student Profile & Settings</h1>
          <p className="text-sm text-[#5E5780] mt-1">
            Manage your individual ND2 student profile, department focus, and daily revision goal.
          </p>
        </div>

        <div className="prepwise-card p-6 sm:p-7 space-y-5">
          {error && <div className="p-3 rounded-xl bg-rose-50 text-xs text-rose-700 border border-rose-200">{error}</div>}
          {message && (
            <div className="p-3 rounded-xl bg-emerald-50 text-xs text-emerald-800 border border-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{message}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="prof-name" className="block text-xs font-semibold mb-1.5">Full Name</label>
                <input
                  id="prof-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DED9F2] text-sm"
                />
              </div>
              <div>
                <label htmlFor="prof-matric" className="block text-xs font-semibold mb-1.5">Matric Number</label>
                <input
                  id="prof-matric"
                  type="text"
                  value={matricNumber}
                  onChange={(e) => setMatricNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DED9F2] text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="prof-dept" className="block text-xs font-semibold mb-1.5">ND2 Department</label>
                <select
                  id="prof-dept"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#DED9F2] bg-white text-sm"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="prof-sem" className="block text-xs font-semibold mb-1.5">Preferred Semester</label>
                <select
                  id="prof-sem"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value as Semester)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#DED9F2] bg-white text-sm"
                >
                  <option value="First Semester">First Semester</option>
                  <option value="Second Semester">Second Semester</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="prof-goal" className="block text-xs font-semibold mb-1.5">Daily Study Goal (Minutes)</label>
                <input
                  id="prof-goal"
                  type="number"
                  min={10}
                  max={480}
                  value={studyGoal}
                  onChange={(e) => setStudyGoal(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DED9F2] text-sm font-mono tabular-nums"
                />
              </div>
              <div>
                <span className="block text-xs font-semibold mb-1.5">Academic Level</span>
                <div className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1F6] bg-[#FAF9FE] text-sm font-semibold text-[#4C1D95] flex items-center justify-between">
                  <span>ND2</span>
                  <Lock className="w-3.5 h-3.5 text-[#7B3FE4]" />
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-4">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7B3FE4] to-[#6327E3] text-white text-sm font-semibold disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
