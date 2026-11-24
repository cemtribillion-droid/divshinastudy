import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Bot,
  ClipboardCheck,
  Lock,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { apiRequest, ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { HeroGraduationIllustration, PrepWiseLogo } from '../components/BrandMark';
import type { Course, Department, UserProfile } from '../types';

interface PublicCatalogResponse {
  platform_name: string;
  strict_academic_level: 'ND2';
  allow_self_registration: boolean;
  departments: Department[];
  courses: Array<
    Pick<
      Course,
      'id' | 'code' | 'title' | 'department_id' | 'department_name' | 'academic_level' | 'semester' | 'credit_units' | 'sessions_available'
    > & { question_count: number }
  >;
}

export function LandingPage() {
  const { user, loading, logout } = useAuth();
  const [catalog, setCatalog] = useState<PublicCatalogResponse | null>(null);

  useEffect(() => {
    apiRequest<PublicCatalogResponse>('/api/public/catalog')
      .then(setCatalog)
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F4FB] text-[#1A1635]">
      {/* Top Bar Contract: 3 zones separated cleanly */}
      <header className="sticky top-0 z-30 bg-[#F5F4FB]/90 backdrop-blur-md border-b border-[#E5E0F5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between gap-8">
          <Link to={user ? '/dashboard' : '/'} className="whitespace-nowrap shrink-0">
            <PrepWiseLogo light={false} />
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#4A436D]" aria-label="Landing navigation">
            <a href="#curriculum" className="hover:text-[#6B34E8] transition-colors whitespace-nowrap shrink-0">ND2 Courses</a>
            <a href="#engines" className="hover:text-[#6B34E8] transition-colors whitespace-nowrap shrink-0">Exam Engine</a>
            <a href="#tutor" className="hover:text-[#6B34E8] transition-colors whitespace-nowrap shrink-0">AI Tutor</a>
            {!loading && !user && (
              <Link to="/admin/login" className="hover:text-[#6B34E8] transition-colors whitespace-nowrap shrink-0">Admin</Link>
            )}
            {user?.role === 'admin' && (
              <Link to="/admin" className="hover:text-[#6B34E8] transition-colors whitespace-nowrap shrink-0">Admin Console</Link>
            )}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            {loading ? null : user ? (
              <>
                <Link
                  to="/dashboard"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#7B3FE4] to-[#6327E3] text-white text-sm font-semibold whitespace-nowrap shrink-0 hover:opacity-95 transition-opacity"
                >
                  Open Dashboard
                </Link>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#DED9F2] bg-white text-xs font-semibold text-[#4A436D] hover:bg-[#FAF9FE] whitespace-nowrap shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#7B3FE4] to-[#6327E3] text-white text-sm font-semibold whitespace-nowrap shrink-0 hover:opacity-95 transition-opacity"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-10 pb-12">
        <div className="prepwise-hero-gradient rounded-3xl p-8 sm:p-12 text-white grid grid-cols-1 lg:grid-cols-12 gap-8 items-center shadow-xl shadow-[#3B1D8E]/15">
          <div className="lg:col-span-7 space-y-5">
            <div className="text-sm font-medium text-[#DDD6FE]">
              ND2 Academic Preparation · First & Second Semester
            </div>
            <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.12] text-balance">
              Prepare Smart.{' '}
              <span className="text-[#D8B4FE]">Score Higher.</span>
            </h1>
            <p className="text-base sm:text-lg text-[#E9E2FF] max-w-xl leading-relaxed">
              Practise real ND2 past examination questions, sit timed CBT and Theory papers, review official worked solutions, and learn step-by-step with your grounded AI academic tutor.
            </p>
            {!loading && (
              <div className="flex flex-wrap items-center gap-4 pt-2">
                {user ? (
                  <>
                    <Link
                      to="/dashboard"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#271968] text-sm font-bold hover:bg-[#F5F3FF] transition-colors whitespace-nowrap"
                    >
                      <span>Open Study Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link
                      to="/ai-tutor"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/15 border border-white/25 text-white text-sm font-semibold hover:bg-white/20 transition-colors whitespace-nowrap"
                    >
                      <span>Launch AI Tutor</span>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      to="/register"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#271968] text-sm font-bold hover:bg-[#F5F3FF] transition-colors whitespace-nowrap"
                    >
                      <span>Create ND2 Student Account</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link
                      to="/login"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/15 border border-white/25 text-white text-sm font-semibold hover:bg-white/20 transition-colors whitespace-nowrap"
                    >
                      <span>Sign In to Continue</span>
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <HeroGraduationIllustration />
          </div>
        </div>
      </section>

      {/* 3 Core Pillars */}
      <section id="engines" className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="prepwise-card p-6 space-y-3">
            <div className="w-11 h-11 rounded-xl bg-[#EDE9FE] text-[#6B34E8] flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <h2 className="font-display text-lg font-bold text-[#1A1635]">Timed CBT & Theory Exams</h2>
            <p className="text-sm text-[#5E5780] leading-relaxed">
              Switch between objective CBT drills (MCQ, True/False, Fill-in-Gap) and full Theory essays with persistent timers and instant review.
            </p>
          </div>
          <div id="tutor" className="prepwise-card p-6 space-y-3">
            <div className="w-11 h-11 rounded-xl bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <h2 className="font-display text-lg font-bold text-[#1A1635]">Grounded AI Academic Tutor</h2>
            <p className="text-sm text-[#5E5780] leading-relaxed">
              Request hints, step-by-step derivations, or theory draft feedback anchored directly to verified ND2 past questions and official answer keys.
            </p>
          </div>
          <div className="prepwise-card p-6 space-y-3">
            <div className="w-11 h-11 rounded-xl bg-[#DCFCE7] text-[#059669] flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <h2 className="font-display text-lg font-bold text-[#1A1635]">Authentic ND2 Past Papers</h2>
            <p className="text-sm text-[#5E5780] leading-relaxed">
              Every course and question carries exact academic session, semester, and source page citations without invented filler questions.
            </p>
          </div>
        </div>
      </section>

      {/* Verified ND2 Curriculum Preview */}
      <section id="curriculum" className="max-w-7xl mx-auto px-4 sm:px-8 py-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#1A1635]">Verified ND2 Curriculum</h2>
            <p className="text-sm text-[#5E5780] mt-1">
              Exclusively scoped to National Diploma 2 (ND2) First & Second Semester courses.
            </p>
          </div>
          {!loading && (
            <Link
              to={user ? '/questions' : '/register'}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6B34E8] hover:underline whitespace-nowrap"
            >
              <span>{user ? 'Open Practice Question Library' : 'Register to access all questions'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(catalog?.courses ?? []).map((course) => (
            <div key={course.id} className="prepwise-card p-5 flex flex-col justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-[#6D658F]">
                  {course.code} · {course.semester} · {course.credit_units} Units
                </div>
                <h3 className="font-display text-base font-bold text-[#1A1635] mt-1">{course.title}</h3>
                <p className="text-xs text-[#6D658F] mt-1">Department of {course.department_name}</p>
              </div>
              <div className="pt-3 border-t border-[#F0EDF8] flex items-center justify-between text-xs text-[#5E5780] tabular-nums">
                <span>{course.question_count} Past Questions</span>
                <span>{course.sessions_available.join(', ')}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-[#E5E0F5] bg-white/70 mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6D658F]">
          <span>Divshinastudy · ND2 Academic Preparation Platform</span>
          {!loading && (
            <div className="flex items-center gap-6">
              {user ? (
                <>
                  <Link to="/dashboard" className="hover:text-[#1A1635]">Dashboard</Link>
                  <Link to="/courses" className="hover:text-[#1A1635]">Courses</Link>
                  <Link to="/ai-tutor" className="hover:text-[#1A1635]">AI Tutor</Link>
                  <button type="button" onClick={() => void logout()} className="hover:text-[#1A1635]">
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="hover:text-[#1A1635]">Student Sign In</Link>
                  <Link to="/register" className="hover:text-[#1A1635]">Register</Link>
                  <Link to="/admin/login" className="hover:text-[#1A1635]">Administrator Login</Link>
                </>
              )}
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

export function RegisterPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [matricNumber, setMatricNumber] = useState('');
  const [departmentId, setDepartmentId] = useState('dept-com');
  const [semester, setSemester] = useState<'First Semester' | 'Second Semester'>('Second Semester');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiRequest<PublicCatalogResponse>('/api/public/catalog')
      .then((res) => {
        setDepartments(res.departments);
        if (res.departments.length > 0) setDepartmentId(res.departments[0].id);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest<{ user: UserProfile }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          full_name: fullName,
          email,
          matric_number: matricNumber,
          department_id: departmentId,
          preferred_semester: semester,
          academic_level: 'ND2',
          password,
        }),
      });
      setUser(res.user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to register account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F4FB] flex flex-col justify-center py-10 px-4">
      <div className="max-w-md w-full mx-auto space-y-6">
        <div className="flex justify-center">
          <Link to="/">
            <PrepWiseLogo light={false} />
          </Link>
        </div>

        <div className="prepwise-card p-7 sm:p-8">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold text-[#1A1635]">Create Student Account</h1>
            <p className="text-sm text-[#5E5780] mt-1">
              Individual registration for ND2 examination preparation.
            </p>
          </div>

          {error && (
            <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reg-fullname" className="block text-xs font-semibold text-[#1A1635] mb-1.5">
                Full Name
              </label>
              <input
                id="reg-fullname"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Amina Bello"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DED9F2] text-sm focus:outline-none focus:ring-2 focus:ring-[#7B3FE4]/30 focus:border-[#7B3FE4]"
              />
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-xs font-semibold text-[#1A1635] mb-1.5">
                Email Address
              </label>
              <input
                id="reg-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@yabatech.edu.ng"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DED9F2] text-sm focus:outline-none focus:ring-2 focus:ring-[#7B3FE4]/30 focus:border-[#7B3FE4]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label htmlFor="reg-dept" className="block text-xs font-semibold text-[#1A1635] mb-1.5">
                  ND2 Department
                </label>
                <select
                  id="reg-dept"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#DED9F2] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#7B3FE4]/30"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="reg-semester" className="block text-xs font-semibold text-[#1A1635] mb-1.5">
                  Focus Semester
                </label>
                <select
                  id="reg-semester"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value as 'First Semester' | 'Second Semester')}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#DED9F2] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#7B3FE4]/30"
                >
                  <option value="First Semester">First Semester</option>
                  <option value="Second Semester">Second Semester</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label htmlFor="reg-matric" className="block text-xs font-semibold text-[#1A1635] mb-1.5">
                  Matric Number (Optional)
                </label>
                <input
                  id="reg-matric"
                  type="text"
                  value={matricNumber}
                  onChange={(e) => setMatricNumber(e.target.value)}
                  placeholder="P/ND/24/3210001"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DED9F2] text-sm focus:outline-none focus:ring-2 focus:ring-[#7B3FE4]/30"
                />
              </div>
              <div>
                <span className="block text-xs font-semibold text-[#1A1635] mb-1.5">
                  Academic Level
                </span>
                <div
                  aria-label="Academic level fixed to ND2"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E1F6] bg-[#FAF9FE] text-sm font-semibold text-[#4C1D95] flex items-center justify-between"
                >
                  <span>ND2</span>
                  <Lock className="w-3.5 h-3.5 text-[#7B3FE4]" />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="reg-password" className="block text-xs font-semibold text-[#1A1635] mb-1.5">
                Password (min. 8 characters)
              </label>
              <input
                id="reg-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DED9F2] text-sm focus:outline-none focus:ring-2 focus:ring-[#7B3FE4]/30"
              />
            </div>

            <div>
              <label htmlFor="reg-confirm" className="block text-xs font-semibold text-[#1A1635] mb-1.5">
                Confirm Password
              </label>
              <input
                id="reg-confirm"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DED9F2] text-sm focus:outline-none focus:ring-2 focus:ring-[#7B3FE4]/30"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#7B3FE4] to-[#6327E3] text-white text-sm font-semibold hover:opacity-95 disabled:opacity-60 transition-opacity"
            >
              {submitting ? 'Creating Account...' : 'Register ND2 Account'}
            </button>
          </form>

          <p className="text-xs text-center text-[#5E5780] mt-5">
            Already have an individual account?{' '}
            <Link to="/login" className="font-semibold text-[#6B34E8] hover:underline">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export function LoginPage({ adminOnly = false }: { adminOnly?: boolean }) {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [needsAdminSetup, setNeedsAdminSetup] = useState(false);
  const [setupMode, setSetupMode] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(adminOnly);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadAdminSetupStatus = async () => {
    if (!adminOnly) {
      setNeedsAdminSetup(false);
      setSetupMode(false);
      setCheckingSetup(false);
      return;
    }
    setCheckingSetup(true);
    try {
      const res = await apiRequest<{ needs_admin_setup: boolean }>('/api/admin/setup-status');
      setNeedsAdminSetup(res.needs_admin_setup);
      setSetupMode(res.needs_admin_setup);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Unable to reach the Divshinastudy authentication service. Please refresh and try again.'
      );
    } finally {
      setCheckingSetup(false);
    }
  };

  useEffect(() => {
    void loadAdminSetupStatus();
  }, [adminOnly]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (adminOnly && setupMode) {
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      setSubmitting(true);
      try {
        const res = await apiRequest<{ user: UserProfile }>('/api/admin/setup', {
          method: 'POST',
          body: JSON.stringify({
            full_name: fullName,
            email,
            password,
          }),
        });
        setUser(res.user);
        navigate('/admin');
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Unable to create administrator account.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest<{ user: UserProfile }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, admin_only: adminOnly }),
      });
      if (adminOnly && res.user.role !== 'admin') {
        try {
          await apiRequest('/api/auth/logout', { method: 'POST' });
        } catch {
          // Ignore logout network failure while rejecting non-admin login
        }
        setError('This portal is restricted to verified Divshinastudy administrators.');
        return;
      }
      setUser(res.user);
      navigate(adminOnly ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const isAdminSetupView = adminOnly && setupMode;

  return (
    <div className="min-h-screen bg-[#F5F4FB] flex flex-col justify-center py-10 px-4">
      <div className="max-w-md w-full mx-auto space-y-6">
        <div className="flex justify-center">
          <Link to="/">
            <PrepWiseLogo light={false} />
          </Link>
        </div>

        <div className="prepwise-card p-7 sm:p-8">
          <div className="mb-6">
            <div className="flex items-center gap-2">
              {adminOnly && <ShieldCheck className="w-5 h-5 text-[#6B34E8]" />}
              <h1 className="font-display text-2xl font-bold text-[#1A1635]">
                {isAdminSetupView
                  ? 'Administrator Setup'
                  : adminOnly
                  ? 'Administrator Sign In'
                  : 'Sign In to Divshinastudy'}
              </h1>
            </div>
            <p className="text-sm text-[#5E5780] mt-1">
              {checkingSetup
                ? 'Checking administrator account status...'
                : isAdminSetupView
                ? 'No administrator exists yet. Create the initial Divshinastudy administrator account.'
                : adminOnly
                ? 'Authorized ND2 academic content and platform managers only.'
                : 'Enter your individual student credentials to continue.'}
            </p>
          </div>

          {error && (
            <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isAdminSetupView && (
              <div>
                <label htmlFor="admin-setup-name" className="block text-xs font-semibold text-[#1A1635] mb-1.5">
                  Full Name
                </label>
                <input
                  id="admin-setup-name"
                  type="text"
                  required
                  minLength={2}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Dr. Adewale Ogunleye"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DED9F2] text-sm focus:outline-none focus:ring-2 focus:ring-[#7B3FE4]/30 focus:border-[#7B3FE4]"
                />
              </div>
            )}

            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-[#1A1635] mb-1.5">
                {isAdminSetupView ? 'Administrator Email' : 'Email Address'}
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={adminOnly ? 'admin@institution.edu.ng' : 'you@example.com'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DED9F2] text-sm focus:outline-none focus:ring-2 focus:ring-[#7B3FE4]/30 focus:border-[#7B3FE4]"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-[#1A1635] mb-1.5">
                {isAdminSetupView ? 'Password (min. 8 characters)' : 'Password'}
              </label>
              <input
                id="login-password"
                type="password"
                required
                minLength={isAdminSetupView ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DED9F2] text-sm focus:outline-none focus:ring-2 focus:ring-[#7B3FE4]/30 focus:border-[#7B3FE4]"
              />
            </div>

            {isAdminSetupView && (
              <div>
                <label htmlFor="admin-setup-confirm" className="block text-xs font-semibold text-[#1A1635] mb-1.5">
                  Confirm Password
                </label>
                <input
                  id="admin-setup-confirm"
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DED9F2] text-sm focus:outline-none focus:ring-2 focus:ring-[#7B3FE4]/30 focus:border-[#7B3FE4]"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#7B3FE4] to-[#6327E3] text-white text-sm font-semibold hover:opacity-95 disabled:opacity-60 transition-opacity"
            >
              {submitting
                ? isAdminSetupView
                  ? 'Creating Administrator...'
                  : 'Signing In...'
                : isAdminSetupView
                ? 'Create Administrator Account'
                : adminOnly
                ? 'Access Admin Console'
                : 'Sign In'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-[#F0EDF8] flex flex-col gap-2 text-xs text-center text-[#5E5780]">
            {adminOnly && needsAdminSetup && (
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setSetupMode((prev) => !prev);
                }}
                className="font-semibold text-[#6B34E8] hover:underline"
              >
                {setupMode ? 'Already have an administrator account? Sign in' : 'First time here? Create initial administrator account'}
              </button>
            )}
            {!adminOnly && (
              <span>
                New ND2 student?{' '}
                <Link to="/register" className="font-semibold text-[#6B34E8] hover:underline">
                  Create an account
                </Link>
              </span>
            )}
            <Link to={adminOnly ? '/login' : '/admin/login'} className="text-[#6D658F] hover:text-[#1A1635]">
              {adminOnly ? '<- Student Sign In' : 'Administrator Login ->'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
