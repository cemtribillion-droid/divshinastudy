/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import {
  LandingPage,
  LoginPage,
  RegisterPage,
} from './pages/PublicPages';
import { DashboardPage } from './pages/DashboardPage';
import { CourseDetailPage, CourseLibraryPage } from './pages/CoursesPages';
import { QuestionLibraryPage } from './pages/QuestionLibraryPage';
import {
  AnswerReviewPage,
  ExamInstructionsPage,
  ExamResultsPage,
  LiveExamRunnerPage,
} from './pages/ExamPages';
import { AiTutorPage } from './pages/AiTutorPage';
import {
  ProfileSettingsPage,
  ProgressAnalyticsPage,
  SavedQuestionsPage,
} from './pages/StudentInsightsPages';
import {
  AdminCoursesPage,
  AdminDashboardPage,
  AdminExamsPage,
  AdminPdfImportsPage,
  AdminQuestionsPage,
  AdminSettingsPage,
  AdminStudentsPage,
} from './pages/AdminPages';

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F4FB] flex items-center justify-center text-sm text-[#5E5780]">
        Restoring Divshinastudy session...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function RequireAdmin({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F4FB] flex items-center justify-center text-sm text-[#5E5780]">
        Verifying administrator privileges...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }
  if (user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function RedirectIfAuthenticated({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F4FB] flex items-center justify-center text-sm text-[#5E5780]">
        Restoring Divshinastudy session...
      </div>
    );
  }
  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication & Landing */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/register" element={<RedirectIfAuthenticated><RegisterPage /></RedirectIfAuthenticated>} />
          <Route path="/login" element={<RedirectIfAuthenticated><LoginPage /></RedirectIfAuthenticated>} />
          <Route path="/admin/login" element={<RedirectIfAuthenticated><LoginPage adminOnly /></RedirectIfAuthenticated>} />

          {/* Protected Student Workspace */}
          <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route path="/courses" element={<RequireAuth><CourseLibraryPage /></RequireAuth>} />
          <Route path="/courses/:code" element={<RequireAuth><CourseDetailPage /></RequireAuth>} />
          <Route path="/questions" element={<RequireAuth><QuestionLibraryPage /></RequireAuth>} />
          <Route path="/exams" element={<RequireAuth><ExamInstructionsPage /></RequireAuth>} />
          <Route path="/exams/cbt/:attemptId" element={<RequireAuth><LiveExamRunnerPage expectedMode="cbt" /></RequireAuth>} />
          <Route path="/exams/theory/:attemptId" element={<RequireAuth><LiveExamRunnerPage expectedMode="theory" /></RequireAuth>} />
          <Route path="/exams/results/:attemptId" element={<RequireAuth><ExamResultsPage /></RequireAuth>} />
          <Route path="/exams/review/:attemptId" element={<RequireAuth><AnswerReviewPage /></RequireAuth>} />
          <Route path="/ai-tutor" element={<RequireAuth><AiTutorPage /></RequireAuth>} />
          <Route path="/progress" element={<RequireAuth><ProgressAnalyticsPage /></RequireAuth>} />
          <Route path="/saved" element={<RequireAuth><SavedQuestionsPage /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><ProfileSettingsPage /></RequireAuth>} />

          {/* Protected Admin Console */}
          <Route path="/admin" element={<RequireAdmin><AdminDashboardPage /></RequireAdmin>} />
          <Route path="/admin/courses" element={<RequireAdmin><AdminCoursesPage /></RequireAdmin>} />
          <Route path="/admin/questions" element={<RequireAdmin><AdminQuestionsPage /></RequireAdmin>} />
          <Route path="/admin/pdf-imports" element={<RequireAdmin><AdminPdfImportsPage /></RequireAdmin>} />
          <Route path="/admin/students" element={<RequireAdmin><AdminStudentsPage /></RequireAdmin>} />
          <Route path="/admin/exams" element={<RequireAdmin><AdminExamsPage /></RequireAdmin>} />
          <Route path="/admin/settings" element={<RequireAdmin><AdminSettingsPage /></RequireAdmin>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
