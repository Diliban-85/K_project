import React, { useState, useEffect } from 'react';
import {
  FileText,
  FolderOpen,
  Files,
  Settings2,
  School,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Plus,
  RefreshCw,
  Database,
  Settings,
} from 'lucide-react';
import { ActiveTab, TeacherUser, SchoolClass, SchoolSubject } from '../types';

interface DashboardProps {
  teacher: TeacherUser;
  onNavigate: (tab: ActiveTab) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ teacher, onNavigate }) => {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [resourcesCount, setResourcesCount] = useState<number>(0);
  const [papersCount, setPapersCount] = useState<number>(0);
  const [questionsCount, setQuestionsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const getHeaders = () => {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [classRes, subjectRes, resRes, papersRes, questionsRes] = await Promise.all([
        fetch('/api/classes', { headers: getHeaders() }),
        fetch('/api/subjects', { headers: getHeaders() }),
        fetch('/api/resources', { headers: getHeaders() }),
        fetch('/api/papers', { headers: getHeaders() }),
        fetch('/api/question-bank', { headers: getHeaders() }),
      ]);
      if (classRes.ok) {
        const classData = await classRes.json();
        setClasses(classData.classes || []);
      }
      if (subjectRes.ok) {
        const subjectData = await subjectRes.json();
        setSubjects(subjectData.subjects || []);
      }
      if (resRes.ok) {
        const resData = await resRes.json();
        setResourcesCount(resData.resources ? resData.resources.length : 0);
      }
      if (papersRes.ok) {
        const pData = await papersRes.json();
        setPapersCount(pData.papers ? pData.papers.length : 0);
      }
      if (questionsRes.ok) {
        const qData = await questionsRes.json();
        setQuestionsCount(qData.totalCount !== undefined ? qData.totalCount : (qData.questions?.length || 0));
      }
    } catch (err) {
      console.error('Error fetching dashboard summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [teacher.id]);

  const primaryActions = [
    {
      id: 'create-paper' as ActiveTab,
      title: 'Create Paper',
      description: 'Design and format questions, choose blueprints, and generate exam papers.',
      icon: FileText,
      badge: 'Production Ready',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    {
      id: 'question-bank' as ActiveTab,
      title: 'Question Bank',
      description: 'Curate, filter, edit, categorize, and reuse questions across multiple exams.',
      icon: Database,
      badge: 'Phase 6 Ready',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    {
      id: 'resources' as ActiveTab,
      title: 'Resources',
      description: 'Upload textbooks, curriculum syllabus documents, and reference materials.',
      icon: FolderOpen,
      badge: 'Active',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    },
    {
      id: 'papers' as ActiveTab,
      title: 'Papers',
      description: 'Review saved examination papers, duplicate drafts, and generate print-ready PDFs.',
      icon: Files,
      badge: 'Active',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    },
    {
      id: 'settings' as ActiveTab,
      title: 'Settings & Backup',
      description: 'Configure institution profile, examination defaults, backup archives, and audit logs.',
      icon: Settings,
      badge: 'Phase 6 Ready',
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome & Teacher Header */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center space-x-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Authenticated Session Active</span>
              </span>
              <span className="text-xs text-slate-400 font-mono">• Scoped to Teacher ID: {teacher.id.slice(0, 8)}...</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 tracking-tight">
              Welcome, {teacher.name}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Staff Portal — Phase 2 Resource System Active. All classes, subjects, and curriculum documents
              below are strictly isolated to your teacher account.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={loadData}
              className="inline-flex items-center space-x-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
              title="Refresh dashboard counts"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => onNavigate('resources')}
              className="inline-flex items-center space-x-1.5 rounded-md bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors shadow-xs"
            >
              <FolderOpen className="h-4 w-4" />
              <span>Resources</span>
            </button>
          </div>
        </div>

        {/* Quick summary stats */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3 border-t border-slate-100 pt-5">
          <div className="rounded-md bg-slate-50 p-3 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">My Classes</span>
              <School className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {loading ? '...' : classes.length}
            </p>
          </div>

          <div className="rounded-md bg-slate-50 p-3 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">My Subjects</span>
              <BookOpen className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {loading ? '...' : subjects.length}
            </p>
          </div>

          <div className="rounded-md bg-slate-50 p-3 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Question Bank</span>
              <Database className="h-4 w-4 text-blue-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {loading ? '...' : questionsCount}
            </p>
          </div>

          <div className="rounded-md bg-slate-50 p-3 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">My Papers</span>
              <Files className="h-4 w-4 text-indigo-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {loading ? '...' : papersCount}
            </p>
          </div>

          <div className="rounded-md bg-slate-50 p-3 border border-slate-200 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Storage &amp; Auth</span>
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="mt-2 text-base font-bold text-emerald-700">Enforced</p>
          </div>
        </div>
      </div>

      {/* Required Dashboard Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
            Examination &amp; Assessment Tools
          </h2>
          <span className="text-xs text-slate-400 font-mono">Phase 1 Architecture</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {primaryActions.map((action) => {
            const Icon = action.icon;
            return (
              <div
                key={action.id}
                id={`dash-card-${action.id}`}
                onClick={() => onNavigate(action.id)}
                className="group flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 hover:shadow-sm cursor-pointer transition-all"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-800 border border-slate-200 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold border ${action.badgeColor}`}
                    >
                      {action.badge}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-900 group-hover:text-slate-950">
                    {action.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    {action.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-medium text-slate-700 group-hover:text-slate-900">
                  <span>Open workspace</span>
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick view of Teacher's Classes and Subjects */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Classes quick list */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <School className="h-4 w-4 text-slate-600" />
              <h3 className="text-sm font-semibold text-slate-900">Your Classes</h3>
            </div>
            <button
              onClick={() => onNavigate('classes')}
              className="text-xs font-medium text-slate-700 hover:text-slate-900 hover:underline"
            >
              Manage all ({classes.length}) &rarr;
            </button>
          </div>

          <div className="mt-3 divide-y divide-slate-100">
            {classes.length === 0 ? (
              <p className="py-4 text-xs text-slate-500 italic text-center">
                No classes registered yet. Create one via Class Management.
              </p>
            ) : (
              classes.slice(0, 4).map((cls) => (
                <div key={cls.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-800">{cls.name}</span>
                    <p className="text-[11px] text-slate-500">
                      {cls.grade ? `Grade ${cls.grade}` : ''} {cls.section ? `• Sec ${cls.section}` : ''}
                    </p>
                  </div>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 border border-slate-200">
                    {cls._count?.subjects ?? 0} subjects
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Subjects quick list */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-4 w-4 text-slate-600" />
              <h3 className="text-sm font-semibold text-slate-900">Your Subjects</h3>
            </div>
            <button
              onClick={() => onNavigate('subjects')}
              className="text-xs font-medium text-slate-700 hover:text-slate-900 hover:underline"
            >
              Manage all ({subjects.length}) &rarr;
            </button>
          </div>

          <div className="mt-3 divide-y divide-slate-100">
            {subjects.length === 0 ? (
              <p className="py-4 text-xs text-slate-500 italic text-center">
                No subjects registered yet. Create subjects in Subject Management.
              </p>
            ) : (
              subjects.slice(0, 4).map((sub) => (
                <div key={sub.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-800">{sub.name}</span>
                    <p className="text-[11px] text-slate-500">Class: {sub.class?.name || 'Class'}</p>
                  </div>
                  {sub.code && (
                    <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">
                      {sub.code}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
