import React from 'react';
import { School, BookOpen, Layers, FileText, FolderOpen, Files, Settings2, LogOut, User as UserIcon, Database, Settings } from 'lucide-react';
import { ActiveTab, TeacherUser } from '../types';

interface NavbarProps {
  teacher: TeacherUser;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  teacher,
  activeTab,
  onSelectTab,
  onLogout,
}) => {
  const navItems: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Layers },
    { id: 'classes', label: 'Classes', icon: School },
    { id: 'subjects', label: 'Subjects', icon: BookOpen },
    { id: 'create-paper', label: 'Create Paper', icon: FileText },
    { id: 'resources', label: 'Resources', icon: FolderOpen },
    { id: 'papers', label: 'Papers', icon: Files },
    { id: 'question-bank', label: 'Question Bank', icon: Database },
    { id: 'settings', label: 'Settings & Backup', icon: Settings },
    { id: 'exam-patterns', label: 'Exam Patterns', icon: Settings2 },
  ];

  return (
    <header id="staff-header" className="border-b border-slate-200 bg-white sticky top-0 z-30">
      {/* Top institution bar */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-slate-900 text-white">
              <School className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-slate-900 text-base tracking-tight">
                  School Staff Portal
                </span>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 border border-emerald-200">
                  Production Ready
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Academic Year 2025–2026 • Teacher Workspace
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-3 rounded-md bg-slate-50 px-3 py-1.5 border border-slate-200">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-700">
                <UserIcon className="h-4 w-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-slate-900 leading-none">{teacher.name}</p>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">{teacher.email}</p>
              </div>
            </div>

            <button
              id="navbar-logout-btn"
              onClick={onLogout}
              className="inline-flex items-center space-x-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-xs"
              title="Sign out of teacher account"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation bar */}
      <nav id="staff-nav-tabs" className="border-t border-slate-100 bg-slate-50/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 overflow-x-auto py-2 scrollbar-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-tab-${item.id}`}
                  onClick={() => onSelectTab(item.id)}
                  className={`inline-flex items-center space-x-2 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </header>
  );
};
