import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, FileUp, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { apiRequest, ApiError } from '../lib/api';
import type {
  AuditLog,
  Course,
  Department,
  ExamAttempt,
  PdfImportRecord,
  PlatformSettings,
  Question,
  Semester,
  UserProfile,
} from '../types';

export function AdminDashboardPage() {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<{ stats: Record<string, number>; audit_logs: AuditLog[] }>('/api/admin/overview')
      .then((res) => {
        setStats(res.stats);
        setLogs(res.audit_logs);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Unable to load administrator overview.'));
  }, []);

  const cards = [
    { label: 'ND2 Students', value: stats.students ?? 0 },
    { label: 'ND2 Courses', value: stats.courses ?? 0 },
    { label: 'Verified Questions', value: stats.verified_questions ?? 0 },
    { label: 'Unverified Questions', value: stats.unverified_questions ?? 0 },
    { label: 'Exam Attempts', value: stats.exam_attempts ?? 0 },
    { label: 'PDF Imports', value: stats.pdf_imports ?? 0 },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#1A1635]">Administrator Dashboard</h1>
            <p className="text-sm text-[#5E5780] mt-1">
              Manage ND2 academic records, verify PDF extractions, and monitor exam integrity.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/pdf-imports" className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#7B3FE4] to-[#6327E3] text-white text-xs font-semibold">
              Import Past Paper PDF
            </Link>
            <Link to="/admin/questions" className="px-4 py-2 rounded-xl border border-[#DED8F4] bg-white text-xs font-semibold text-[#1A1635]">
              Verify Question Bank
            </Link>
          </div>
        </div>

        {error && (
          <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {cards.map((c) => (
            <div key={c.label} className="prepwise-card p-4">
              <div className="text-xs text-[#6D658F]">{c.label}</div>
              <div className="font-display text-2xl font-bold text-[#1A1635] mt-1 tabular-nums">{c.value}</div>
            </div>
          ))}
        </div>

        <div className="prepwise-card p-6 space-y-3">
          <h2 className="font-display text-lg font-bold text-[#1A1635]">Recent Audit Trail</h2>
          {logs.length === 0 ? (
            <p className="text-xs text-[#6D658F]">No audit activity logged yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#ECE8F8] text-[#6D658F]">
                    <th className="py-2 pr-4 font-semibold">Actor</th>
                    <th className="py-2 pr-4 font-semibold">Action</th>
                    <th className="py-2 pr-4 font-semibold">Details</th>
                    <th className="py-2 font-semibold text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F0FA]">
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td className="py-2.5 pr-4 font-mono">{l.actor_email}</td>
                      <td className="py-2.5 pr-4 font-semibold text-[#4C1D95]">{l.action}</td>
                      <td className="py-2.5 pr-4 text-[#1A1635]">{l.details}</td>
                      <td className="py-2.5 text-right text-[#6D658F] font-mono">
                        {new Date(l.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export function AdminCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [departmentId, setDepartmentId] = useState('dept-com');
  const [semester, setSemester] = useState<Semester>('Second Semester');
  const [units, setUnits] = useState(2);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    apiRequest<{ departments: Department[]; courses: Course[] }>('/api/admin/courses')
      .then((res) => {
        setDepartments(res.departments);
        setCourses(res.courses);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Unable to load ND2 courses.'));
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiRequest('/api/admin/courses', {
        method: 'POST',
        body: JSON.stringify({
          code,
          title,
          department_id: departmentId,
          semester,
          credit_units: units,
          description,
          academic_level: 'ND2',
        }),
      });
      setCode('');
      setTitle('');
      setDescription('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to add course.');
    }
  };

  const handleDelete = async (id: string) => {
    setError('');
    try {
      await apiRequest(`/api/admin/courses/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to delete course.');
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-[#1A1635]">ND2 Course Management</h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 prepwise-card p-6 space-y-4 h-fit">
            <h2 className="font-display text-base font-bold text-[#1A1635]">Add Verified ND2 Course</h2>
            {error && <div className="p-2.5 rounded-xl bg-rose-50 text-xs text-rose-700">{error}</div>}
            <form onSubmit={handleAdd} className="space-y-3">
              <input
                type="text"
                required
                placeholder="Course Code (e.g. COM 228)"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#DED9F2] text-sm"
              />
              <input
                type="text"
                required
                placeholder="Course Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#DED9F2] text-sm"
              />
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#DED9F2] bg-white text-sm"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value as Semester)}
                className="w-full px-3 py-2 rounded-xl border border-[#DED9F2] bg-white text-sm"
              >
                <option value="First Semester">First Semester (ND2)</option>
                <option value="Second Semester">Second Semester (ND2)</option>
              </select>
              <input
                type="number"
                min={1}
                max={6}
                value={units}
                onChange={(e) => setUnits(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[#DED9F2] text-sm font-mono"
              />
              <textarea
                rows={2}
                placeholder="Syllabus summary"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#DED9F2] text-sm"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#7B3FE4] to-[#6327E3] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Create ND2 Course</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-8 prepwise-card p-6 space-y-3">
            <h2 className="font-display text-base font-bold text-[#1A1635]">Configured ND2 Courses ({courses.length})</h2>
            <div className="space-y-2.5">
              {courses.map((c) => (
                <div key={c.id} className="p-3.5 rounded-xl border border-[#ECE8F8] flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-[#1A1635]">{c.code} — {c.title}</div>
                    <div className="text-xs text-[#6D658F]">
                      {c.academic_level} · {c.semester} · {c.department_name} · {c.credit_units} Units
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(c.id)}
                    aria-label={`Delete ${c.code}`}
                    className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseFilter, setCourseFilter] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAnswer, setEditAnswer] = useState('');
  const [editExcerpt, setEditExcerpt] = useState('');
  const [editStatus, setEditStatus] = useState<'verified' | 'unverified'>('verified');
  const [error, setError] = useState('');

  const load = () => {
    apiRequest<{ questions: Question[]; courses: Course[] }>('/api/admin/questions')
      .then((res) => {
        setQuestions(res.questions);
        setCourses(res.courses);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Unable to load question bank.'));
  };

  useEffect(() => {
    load();
  }, []);

  const handleSaveEdit = async (id: string) => {
    setError('');
    try {
      await apiRequest(`/api/admin/questions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          correct_answer: editAnswer,
          official_solution_excerpt: editExcerpt,
          verification_status: editStatus,
        }),
      });
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update question.');
    }
  };

  const handleDelete = async (id: string) => {
    setError('');
    try {
      await apiRequest(`/api/admin/questions/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to delete question.');
    }
  };

  const visible = courseFilter === 'all' ? questions : questions.filter((q) => q.course_code === courseFilter);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-2xl font-bold text-[#1A1635]">Question Bank Verification</h1>
          <select
            aria-label="Filter admin questions by course"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-[#DED9F2] bg-white text-xs font-semibold"
          >
            <option value="all">All ND2 Courses ({questions.length})</option>
            {courses.map((c) => (
              <option key={c.id} value={c.code}>{c.code} — {c.title}</option>
            ))}
          </select>
        </div>

        {error && (
          <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {visible.map((q) => (
            <div key={q.id} className="prepwise-card p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6D658F]">
                <span>
                  {q.course_code} · {q.examination_year} · Q{q.question_number} · {q.question_type.toUpperCase()} · p.{q.source_page}
                </span>
                <span className={`font-semibold ${q.verification_status === 'verified' ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {q.verification_status}
                </span>
              </div>
              <p className="text-sm font-medium text-[#1A1635] whitespace-pre-line">{q.question_text}</p>

              {editingId === q.id ? (
                <div className="p-4 rounded-xl bg-[#FAF9FE] border border-[#E5E0F5] space-y-3">
                  <input
                    type="text"
                    placeholder="Official Answer Key (e.g. A, True, or exact text)"
                    value={editAnswer}
                    onChange={(e) => setEditAnswer(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#DED9F2] text-xs"
                  />
                  <textarea
                    rows={3}
                    placeholder="Official Worked Solution Excerpt"
                    value={editExcerpt}
                    onChange={(e) => setEditExcerpt(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#DED9F2] text-xs"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as 'verified' | 'unverified')}
                      className="px-3 py-1.5 rounded-xl border border-[#DED9F2] bg-white text-xs"
                    >
                      <option value="verified">Verified</option>
                      <option value="unverified">Unverified</option>
                    </select>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 rounded-xl border border-[#DED9F2] text-xs font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSaveEdit(q.id)}
                        className="px-3 py-1.5 rounded-xl bg-[#6B34E8] text-white text-xs font-semibold"
                      >
                        Save Verification
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  <span className="text-[#5E5780] truncate max-w-xl">
                    Key: <strong>{q.correct_answer || 'None (Theory / Unverified)'}</strong>
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(q.id);
                        setEditAnswer(q.correct_answer || '');
                        setEditExcerpt(q.official_solution_excerpt || '');
                        setEditStatus(q.verification_status === 'verified' ? 'verified' : 'unverified');
                      }}
                      className="font-semibold text-[#6B34E8] hover:underline"
                    >
                      Edit / Verify
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(q.id)}
                      className="font-semibold text-rose-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

export function AdminPdfImportsPage() {
  const [imports, setImports] = useState<PdfImportRecord[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [courseCode, setCourseCode] = useState('');
  const [year, setYear] = useState('2024/2025');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    Promise.all([
      apiRequest<{ imports: PdfImportRecord[] }>('/api/admin/pdf-imports'),
      apiRequest<{ courses: Course[] }>('/api/admin/courses'),
    ])
      .then(([iRes, cRes]) => {
        setImports(iRes.imports);
        setCourses(cRes.courses);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Unable to load PDF imports.'));
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError('');
    setMessage('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (courseCode) fd.append('course_code', courseCode);
      if (year) fd.append('examination_year', year);
      const res = await apiRequest<{ importRecord: PdfImportRecord }>('/api/admin/pdf-imports/upload', {
        method: 'POST',
        body: fd,
      });
      setMessage(`Extracted ${res.importRecord.extracted_count} question drafts from ${res.importRecord.filename}.`);
      setFile(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'PDF upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleApprove = async (imp: PdfImportRecord) => {
    setError('');
    setMessage('');
    try {
      const res = await apiRequest<{ published_count: number }>(`/api/admin/pdf-imports/${imp.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ course_code: imp.course_code || courses[0]?.code }),
      });
      setMessage(`Published ${res.published_count} extracted questions into the ND2 question bank.`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to approve PDF import.');
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#1A1635]">PDF Import & Extraction Review</h1>
          <p className="text-sm text-[#5E5780] mt-1">
            Upload ND2 past-question PDFs, inspect extracted drafts, and approve verified entries into the database.
          </p>
        </div>

        <div className="prepwise-card p-6 space-y-4">
          <h2 className="font-display text-base font-bold text-[#1A1635]">Upload Academic PDF</h2>
          {error && <div className="p-3 rounded-xl bg-rose-50 text-xs text-rose-700">{error}</div>}
          {message && (
            <div className="p-3 rounded-xl bg-emerald-50 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{message}</span>
            </div>
          )}

          <form onSubmit={handleUpload} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div className="sm:col-span-2">
              <label htmlFor="pdf-file" className="block text-xs font-semibold mb-1">Select PDF File</label>
              <input
                id="pdf-file"
                type="file"
                accept="application/pdf"
                required
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-xs file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-[#EDE9FE] file:text-[#5B21B6] file:font-semibold"
              />
            </div>
            <div>
              <label htmlFor="pdf-course" className="block text-xs font-semibold mb-1">Course Override</label>
              <select
                id="pdf-course"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#DED9F2] bg-white text-xs"
              >
                <option value="">Auto-detect from PDF</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.code}>{c.code}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={uploading || !file}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#7B3FE4] to-[#6327E3] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              <FileUp className="w-4 h-4" />
              <span>{uploading ? 'Extracting...' : 'Parse PDF'}</span>
            </button>
          </form>
        </div>

        <div className="space-y-4">
          {imports.map((imp) => (
            <div key={imp.id} className="prepwise-card p-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-[#1A1635]">{imp.filename}</div>
                  <div className="text-xs text-[#6D658F]">
                    {imp.course_code || 'Unassigned'} · {imp.examination_year} · {imp.page_count} Pages · {imp.extracted_count} Drafts · Status: <strong>{imp.status}</strong>
                  </div>
                </div>
                {imp.status === 'pending_review' && imp.extracted_count > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleApprove(imp)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
                  >
                    Approve & Publish All Drafts
                  </button>
                )}
              </div>
              {imp.extracted_preview.slice(0, 4).map((d) => (
                <div key={d.temp_id} className="p-3 rounded-xl bg-[#FAF9FE] border border-[#E5E0F5] text-xs">
                  <span className="font-mono font-semibold text-[#4C1D95]">[p.{d.source_page} · {d.question_type}]</span>{' '}
                  {d.question_text}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

export function AdminStudentsPage() {
  const [users, setUsers] = useState<Array<UserProfile & { attempt_count: number }>>([]);
  const [error, setError] = useState('');

  const load = () => {
    apiRequest<{ users: Array<UserProfile & { attempt_count: number }> }>('/api/admin/users')
      .then((res) => setUsers(res.users))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Unable to load student accounts.'));
  };

  useEffect(() => {
    load();
  }, []);

  const toggleRole = async (u: UserProfile) => {
    setError('');
    try {
      const nextRole = u.role === 'admin' ? 'student' : 'admin';
      await apiRequest(`/api/admin/users/${u.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: nextRole }),
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update user role.');
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-[#1A1635]">Registered ND2 Accounts</h1>
        {error && (
          <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
            {error}
          </div>
        )}
        <div className="prepwise-card p-6 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#ECE8F8] text-[#6D658F]">
                <th className="py-2.5 pr-4 font-semibold">Name</th>
                <th className="py-2.5 pr-4 font-semibold">Email</th>
                <th className="py-2.5 pr-4 font-semibold">Department</th>
                <th className="py-2.5 pr-4 font-semibold">Level</th>
                <th className="py-2.5 pr-4 font-semibold">Role</th>
                <th className="py-2.5 pr-4 font-semibold text-right">Attempts</th>
                <th className="py-2.5 font-semibold text-right">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F0FA]">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-3 pr-4 font-semibold text-[#1A1635]">{u.full_name}</td>
                  <td className="py-3 pr-4 font-mono">{u.email}</td>
                  <td className="py-3 pr-4">{u.department_name}</td>
                  <td className="py-3 pr-4 font-semibold text-[#4C1D95]">{u.academic_level}</td>
                  <td className="py-3 pr-4 uppercase font-mono">{u.role}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{u.attempt_count}</td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      onClick={() => void toggleRole(u)}
                      className="text-[#6B34E8] font-semibold hover:underline"
                    >
                      Make {u.role === 'admin' ? 'Student' : 'Admin'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

export function AdminExamsPage() {
  const [attempts, setAttempts] = useState<Array<ExamAttempt & { student_name: string; student_email: string }>>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<{ attempts: Array<ExamAttempt & { student_name: string; student_email: string }> }>('/api/admin/exams')
      .then((res) => setAttempts(res.attempts))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Unable to load examination logs.'));
  }, []);

  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-[#1A1635]">Examination Attempts Monitor</h1>
        {error && (
          <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
            {error}
          </div>
        )}
        <div className="prepwise-card p-6 overflow-x-auto">
          {attempts.length === 0 ? (
            <p className="text-xs text-[#6D658F]">No examinations attempted by students yet.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#ECE8F8] text-[#6D658F]">
                  <th className="py-2.5 pr-4 font-semibold">Student</th>
                  <th className="py-2.5 pr-4 font-semibold">Course</th>
                  <th className="py-2.5 pr-4 font-semibold">Mode</th>
                  <th className="py-2.5 pr-4 font-semibold">Status</th>
                  <th className="py-2.5 font-semibold text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F0FA]">
                {attempts.map((a) => (
                  <tr key={a.id}>
                    <td className="py-3 pr-4 font-semibold text-[#1A1635]">{a.student_name}</td>
                    <td className="py-3 pr-4">{a.course_code} · {a.course_title}</td>
                    <td className="py-3 pr-4 font-mono uppercase">{a.mode}</td>
                    <td className="py-3 pr-4">{a.status}</td>
                    <td className="py-3 text-right font-mono tabular-nums font-bold">{a.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export function AdminSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [savedMsg, setSavedMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<{ settings: PlatformSettings }>('/api/admin/settings')
      .then((res) => setSettings(res.settings))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Unable to load platform settings.'));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setError('');
    setSavedMsg('');
    try {
      const res = await apiRequest<{ settings: PlatformSettings }>('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(settings),
      });
      setSettings(res.settings);
      setSavedMsg('Platform configuration updated.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save platform settings.');
    }
  };

  return (
    <AppShell>
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-[#6B34E8]" />
          <h1 className="font-display text-2xl font-bold text-[#1A1635]">Platform Settings</h1>
        </div>

        {error && (
          <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
            {error}
          </div>
        )}

        {settings && (
          <form onSubmit={handleSave} className="prepwise-card p-6 space-y-4">
            {savedMsg && <div className="p-3 rounded-xl bg-emerald-50 text-xs text-emerald-800">{savedMsg}</div>}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="set-qcount" className="block text-xs font-semibold mb-1">Default CBT Questions</label>
                <input
                  id="set-qcount"
                  type="number"
                  value={settings.default_cbt_question_count}
                  onChange={(e) => setSettings({ ...settings, default_cbt_question_count: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-[#DED9F2] text-sm font-mono"
                />
              </div>
              <div>
                <label htmlFor="set-dur" className="block text-xs font-semibold mb-1">Default Duration (min)</label>
                <input
                  id="set-dur"
                  type="number"
                  value={settings.default_exam_duration_minutes}
                  onChange={(e) => setSettings({ ...settings, default_exam_duration_minutes: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-[#DED9F2] text-sm font-mono"
                />
              </div>
              <div>
                <label htmlFor="set-pass" className="block text-xs font-semibold mb-1">Pass Threshold (%)</label>
                <input
                  id="set-pass"
                  type="number"
                  value={settings.pass_mark_percentage}
                  onChange={(e) => setSettings({ ...settings, pass_mark_percentage: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-[#DED9F2] text-sm font-mono"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="flex items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={settings.allow_self_registration}
                  onChange={(e) => setSettings({ ...settings, allow_self_registration: e.target.checked })}
                  className="accent-[#6B34E8]"
                />
                <span>Allow individual ND2 student registration</span>
              </label>
              <label className="flex items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={settings.ai_tutor_enabled}
                  onChange={(e) => setSettings({ ...settings, ai_tutor_enabled: e.target.checked })}
                  className="accent-[#6B34E8]"
                />
                <span>Enable AI Academic Tutor</span>
              </label>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-[#4C1D95]">Academic Level: ND2</span>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7B3FE4] to-[#6327E3] text-white text-sm font-semibold"
              >
                Save Platform Settings
              </button>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}
