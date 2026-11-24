import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Bookmark,
  BookOpen,
  Bot,
  ChevronDown,
  ClipboardCheck,
  Database,
  FileUp,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  PlaySquare,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { PrepWiseLogo } from './BrandMark';
import { useAuth } from '../context/AuthContext';

export interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  actionUrl: string;
}

export function AppShell({
  children,
  notifications = [],
}: {
  children: React.ReactNode;
  notifications?: NotificationItem[];
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const initials = (user?.full_name || 'ND')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    navigate(trimmed ? `/questions?q=${encodeURIComponent(trimmed)}` : '/questions');
  };

  const handleLogout = async () => {
    setProfileMenuOpen(false);
    await logout();
    navigate('/login');
  };

  const studentLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: Home },
    { to: '/courses', label: 'Courses', icon: BookOpen },
    { to: '/questions', label: 'Practice Questions', icon: ClipboardCheck },
    { to: '/exams', label: 'Examinations', icon: PlaySquare },
    { to: '/ai-tutor', label: 'AI Tutor', icon: Bot },
    { to: '/progress', label: 'My Progress', icon: BarChart3 },
    { to: '/saved', label: 'Saved Items', icon: Bookmark },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const adminLinks = [
    { to: '/admin', label: 'Admin Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/courses', label: 'Course Manager', icon: BookOpen },
    { to: '/admin/questions', label: 'Question Bank', icon: Database },
    { to: '/admin/pdf-imports', label: 'PDF Imports', icon: FileUp },
    { to: '/admin/students', label: 'Students & Roles', icon: Users },
    { to: '/admin/exams', label: 'Exam Logs', icon: ShieldCheck },
    { to: '/admin/settings', label: 'Platform Settings', icon: SlidersHorizontal },
  ];

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-[#141030] text-white px-4 py-6 select-none">
      <div className="px-2 mb-7 flex items-center justify-between">
        <Link to="/dashboard" onClick={() => setMobileNavOpen(false)}>
          <PrepWiseLogo light />
        </Link>
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-[#B8B0DC] hover:bg-white/10"
          aria-label="Close navigation menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto pr-1" aria-label="Main navigation">
        {studentLinks.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[14px] font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'prepwise-nav-active text-white'
                    : 'text-[#C6C0E4] hover:text-white hover:bg-white/8'
                }`
              }
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}

        {user?.role === 'admin' && (
          <div className="pt-5 mt-5 border-t border-white/10 space-y-1">
            <div className="px-3.5 pb-1 text-[11px] font-medium text-[#8E85B8]">
              Administration
            </div>
            {adminLinks.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2 rounded-xl text-[13px] font-medium transition-all whitespace-nowrap ${
                      isActive
                        ? 'prepwise-nav-active text-white'
                        : 'text-[#C6C0E4] hover:text-white hover:bg-white/8'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        )}
      </nav>

      {/* Bottom Trophy Motivation Card matching reference */}
      <div className="mt-5 rounded-2xl bg-[#1E1747] border border-[#31286B] p-4 text-center">
        <div className="w-10 h-10 rounded-full bg-[#2C2364] mx-auto flex items-center justify-center mb-2.5">
          <Trophy className="w-5 h-5 text-[#FBBF24]" />
        </div>
        <h4 className="font-display font-semibold text-sm text-white">Aim Higher!</h4>
        <p className="text-xs text-[#B8B0DC] mt-1 leading-relaxed">
          Your ND2 exam success is our priority.
        </p>
        <Link
          to="/exams"
          onClick={() => setMobileNavOpen(false)}
          className="mt-3.5 inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl bg-gradient-to-r from-[#7B3FE4] to-[#6327E3] text-white text-xs font-semibold hover:opacity-95 transition-opacity whitespace-nowrap"
        >
          <span>Start Learning</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F5F4FB]">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-[248px] shrink-0 sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-[260px] h-full shadow-2xl">{renderSidebarContent()}</div>
          <button
            type="button"
            className="flex-1 bg-black/45"
            aria-label="Dismiss navigation overlay"
            onClick={() => setMobileNavOpen(false)}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-[#F5F4FB]/90 backdrop-blur-md border-b border-[#E8E4F6] px-4 sm:px-7 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 max-w-xl">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-white border border-[#E5E1F4] text-[#1A1635] hover:bg-[#FAF9FE]"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <form onSubmit={handleSearch} className="relative flex-1">
              <Search className="w-4 h-4 text-[#6D658F] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search topics, courses..."
                aria-label="Search for topics, questions or subjects"
                className="w-full pl-11 pr-4 py-2.5 rounded-full bg-white border border-[#E5E1F4] text-xs sm:text-sm text-[#1A1635] placeholder:text-[#8E86AF] focus:outline-none focus:ring-2 focus:ring-[#7B3FE4]/30 focus:border-[#7B3FE4]"
              />
            </form>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Notifications */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((v) => !v);
                  setProfileMenuOpen(false);
                }}
                aria-label="Open study notifications"
                className="relative w-10 h-10 rounded-full bg-white border border-[#E5E1F4] flex items-center justify-center text-[#1A1635] hover:bg-[#FAF9FE] transition-colors"
              >
                <Bell className="w-[18px] h-[18px]" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#6B34E8] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {notifications.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 prepwise-card p-3 z-40">
                  <div className="flex items-center justify-between px-1 pb-2 border-b border-[#F0EDF8]">
                    <span className="font-display text-sm font-semibold text-[#1A1635]">Notifications</span>
                    <span className="text-xs text-[#6D658F]">ND2 Workspace</span>
                  </div>
                  <div className="mt-2 space-y-1.5 max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-[#6D658F] py-4 text-center">
                        You are all caught up. No pending alerts.
                      </p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            setNotifOpen(false);
                            navigate(n.actionUrl);
                          }}
                          className="w-full text-left p-2.5 rounded-xl hover:bg-[#F5F4FB] transition-colors"
                        >
                          <div className="text-xs font-semibold text-[#1A1635]">{n.title}</div>
                          <div className="text-xs text-[#6D658F] mt-0.5">{n.detail}</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen((v) => !v);
                  setNotifOpen(false);
                }}
                className="flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-full hover:bg-white transition-colors"
                aria-label="Account menu"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7B3FE4] to-[#5628C7] text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {initials}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-semibold text-[#1A1635] leading-tight whitespace-nowrap max-w-[140px] truncate">
                    {user?.full_name}
                  </div>
                  <div className="text-[11px] text-[#6D658F] whitespace-nowrap">
                    ND2 · {user?.role === 'admin' ? 'Administrator' : user?.department_name}
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-[#6D658F]" />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 prepwise-card p-2 z-40">
                  <div className="px-3 py-2 border-b border-[#F0EDF8]">
                    <div className="text-xs font-semibold text-[#1A1635] truncate">{user?.email}</div>
                    <div className="text-[11px] text-[#6D658F] mt-0.5">Academic Level: ND2</div>
                  </div>
                  <Link
                    to="/settings"
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 mt-1 rounded-xl text-xs font-medium text-[#1A1635] hover:bg-[#F5F4FB]"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Profile & Settings</span>
                  </Link>
                  <Link
                    to="/progress"
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-[#1A1635] hover:bg-[#F5F4FB]"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>My Progress</span>
                  </Link>
                  {user?.role === 'admin' && (
                    <Link
                      to="/admin"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-[#6B34E8] hover:bg-[#F5F4FB]"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Admin Console</span>
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 mt-1 border-t border-[#F0EDF8] text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-b-xl"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-7 py-6 max-w-[1320px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
