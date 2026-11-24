import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  ChevronRight,
  FileText,
  Play,
  Star,
} from 'lucide-react';
import { AppShell, type NotificationItem } from '../components/AppShell';
import { HeroGraduationIllustration } from '../components/BrandMark';
import { PerformanceLineChart, ProgressDonut } from '../components/Charts';
import { apiRequest } from '../lib/api';
import type { DashboardProgressSummary, PerformancePoint, RecommendedStudyItem } from '../utils/analytics';

interface DashboardData {
  progress: DashboardProgressSummary;
  performanceSeries: PerformancePoint[];
  recommendedItems: RecommendedStudyItem[];
  notifications: NotificationItem[];
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<DashboardData>('/api/dashboard')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  const progress = data?.progress ?? {
    overallPercentage: 0,
    completedCount: 0,
    inProgressCount: 0,
    pendingCount: 0,
    totalTopics: 0,
  };

  const quickActions = [
    {
      title: 'Explore',
      subtitle: 'Courses',
      to: '/courses',
      iconBg: 'bg-[#EDE9FE]',
      iconColor: 'text-[#6B34E8]',
      icon: BookOpen,
    },
    {
      title: 'Practice',
      subtitle: 'Questions',
      to: '/questions',
      iconBg: 'bg-[#10B981]',
      iconColor: 'text-white',
      icon: Check,
    },
    {
      title: 'Take',
      subtitle: 'Examination',
      to: '/exams',
      iconBg: 'bg-[#F59E0B]',
      iconColor: 'text-white',
      icon: Play,
    },
    {
      title: 'Ask',
      subtitle: 'AI Tutor',
      to: '/ai-tutor',
      iconBg: 'bg-[#3B82F6]',
      iconColor: 'text-white',
      icon: Bot,
    },
  ];

  return (
    <AppShell notifications={data?.notifications ?? []}>
      <div className="space-y-6">
        {error && (
          <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
            {error}
          </div>
        )}

        {/* Top Row: Hero Banner + Your Progress */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <div className="lg:col-span-8 prepwise-hero-gradient rounded-2xl p-7 sm:p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-lg shadow-[#4C1D95]/15">
            <div className="space-y-3.5 max-w-md z-10">
              <h1 className="font-display text-3xl sm:text-4xl font-bold leading-[1.15] tracking-tight text-balance">
                Prepare Smart.
                <br />
                <span className="text-[#D8B4FE]">Score Higher.</span>
              </h1>
              <p className="text-sm text-[#E9E2FF] leading-relaxed">
                Your all-in-one ND2 examination preparation platform
              </p>
              <div className="pt-1.5">
                <Link
                  to="/questions"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-[#271968] text-sm font-semibold hover:bg-[#F5F3FF] transition-colors whitespace-nowrap shadow-sm"
                >
                  <span>Start Practicing</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            <div className="shrink-0 z-10">
              <HeroGraduationIllustration />
            </div>
          </div>

          <div className="lg:col-span-4 prepwise-card p-6 flex flex-col justify-between">
            <h2 className="font-display text-lg font-bold text-[#1A1635]">Your Progress</h2>

            {loading ? (
              <div className="py-10 text-center text-xs text-[#6D658F]">Loading progress...</div>
            ) : (
              <div className="flex items-center justify-between gap-4 my-4">
                <ProgressDonut
                  percentage={progress.overallPercentage}
                  completed={progress.completedCount}
                  inProgress={progress.inProgressCount}
                  pending={progress.pendingCount}
                />

                <div className="flex-1 space-y-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#5E5780] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#10B981]" aria-hidden="true" />
                      Completed
                    </span>
                    <span className="font-bold text-[#1A1635] tabular-nums">{progress.completedCount}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#5E5780] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#B4899E]" aria-hidden="true" />
                      In Progress
                    </span>
                    <span className="font-bold text-[#1A1635] tabular-nums">{progress.inProgressCount}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#5E5780] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#F59E0B]" aria-hidden="true" />
                      Pending
                    </span>
                    <span className="font-bold text-[#1A1635] tabular-nums">{progress.pendingCount}</span>
                  </div>
                </div>
              </div>
            )}

            <Link
              to="/progress"
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#7B3FE4] to-[#6327E3] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-95 transition-opacity whitespace-nowrap"
            >
              <span>View Details</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* Middle Row: 4 Quick Action Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Quick study actions">
          {quickActions.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.subtitle}
                to={card.to}
                className="prepwise-card px-5 py-4 flex items-center justify-between gap-3 hover:border-[#C4B5FD] transition-colors group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`w-11 h-11 rounded-xl ${card.iconBg} ${card.iconColor} flex items-center justify-center shrink-0`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-display text-sm font-bold text-[#1A1635] leading-snug">
                      {card.title}
                    </div>
                    <div className="font-display text-sm font-bold text-[#1A1635] leading-snug">
                      {card.subtitle}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#6D658F] group-hover:translate-x-0.5 transition-transform shrink-0" />
              </Link>
            );
          })}
        </section>

        {/* Bottom Row: Performance Overview & Recommended for You */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-6 prepwise-card p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="shrink-0">
                  <rect x="2" y="11" width="4" height="7" rx="1.5" fill="#7B3FE4" />
                  <rect x="8" y="7" width="4" height="11" rx="1.5" fill="#6327E3" />
                  <rect x="14" y="3" width="4" height="15" rx="1.5" fill="#4C1D95" />
                </svg>
                <h2 className="font-display text-lg font-bold text-[#1A1635]">Performance Overview</h2>
              </div>
              <Link to="/progress" className="text-xs font-semibold text-[#6B34E8] hover:underline whitespace-nowrap">
                Full Analytics
              </Link>
            </div>
            <PerformanceLineChart points={data?.performanceSeries ?? []} />
          </div>

          <div className="lg:col-span-6 prepwise-card p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <Star className="w-5 h-5 text-[#F59E0B] fill-[#F59E0B]" />
                <h2 className="font-display text-lg font-bold text-[#1A1635]">Recommended for You</h2>
              </div>
              <Link
                to="/courses"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#6B34E8] hover:underline whitespace-nowrap"
              >
                <span>See All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3">
              {(data?.recommendedItems ?? []).map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl bg-[#FAF9FE] border border-[#ECE8F8] flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#EDE9FE] text-[#6B34E8] flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-display text-sm font-bold text-[#1A1635] truncate">
                        {item.title}
                      </div>
                      <div className="text-xs text-[#6D658F] mt-0.5 truncate">{item.subtitle}</div>
                    </div>
                  </div>
                  <Link
                    to={item.targetUrl}
                    className="px-4 py-1.5 rounded-full bg-white border border-[#DED8F4] text-xs font-semibold text-[#6B34E8] hover:bg-[#6B34E8] hover:text-white transition-colors whitespace-nowrap shrink-0"
                  >
                    {item.actionType}
                  </Link>
                </div>
              ))}
              {!loading && (data?.recommendedItems?.length ?? 0) === 0 && (
                <p className="text-xs text-[#6D658F] py-6 text-center">
                  Explore ND2 courses to unlock tailored study recommendations.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
