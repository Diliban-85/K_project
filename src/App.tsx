import React, { useState, useEffect } from 'react';
import { TeacherUser, ActiveTab } from './types';
import { Navbar } from './components/Navbar';
import { AuthView } from './components/AuthView';
import { Dashboard } from './components/Dashboard';
import { ClassManagement } from './components/ClassManagement';
import { SubjectManagement } from './components/SubjectManagement';
import { ResourceManagement } from './components/ResourceManagement';
import { PaperManagement } from './components/PaperManagement';
import { PaperPdfPreview } from './components/PaperPdfPreview';
import { QuestionBankManagement } from './components/QuestionBankManagement';
import { SettingsManagement } from './components/SettingsManagement';
import { PlaceholderRoute } from './components/PlaceholderRoute';
import { School, RefreshCw } from 'lucide-react';

export default function App() {
  const [teacher, setTeacher] = useState<TeacherUser | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [subjectClassFilter, setSubjectClassFilter] = useState<string>('');

  // Support direct route /paper/:id/preview
  const [directPreviewPaperId, setDirectPreviewPaperId] = useState<string | null>(() => {
    const path = window.location.pathname;
    const match = path.match(/\/paper\/([a-zA-Z0-9_-]+)\/preview/);
    return match ? match[1] : null;
  });

  const checkAuth = async () => {
    setLoadingAuth(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/auth/me', { headers });
      if (res.ok) {
        const data = await res.json();
        setTeacher(data.user);
      } else {
        setTeacher(null);
      }
    } catch {
      setTeacher(null);
    } finally {
      setLoadingAuth(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLoginSuccess = (user: TeacherUser) => {
    setTeacher(user);
    setActiveTab('dashboard');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      localStorage.removeItem('auth_token');
      setTeacher(null);
      setActiveTab('dashboard');
    }
  };

  const handleNavigateToSubjectsForClass = (classId: string) => {
    setSubjectClassFilter(classId);
    setActiveTab('subjects');
  };

  // Initial loading state
  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900 text-white">
            <School className="h-6 w-6" />
          </div>
          <p className="mt-4 text-sm font-medium text-slate-700 flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin text-slate-500" />
            <span>Verifying teacher credentials...</span>
          </p>
        </div>
      </div>
    );
  }

  // Unauthenticated: Teacher Login & Registration
  if (!teacher) {
    return <AuthView onLoginSuccess={handleLoginSuccess} />;
  }

  // Authenticated Portal
  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col">
      <Navbar
        teacher={teacher}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if (tab !== 'subjects') {
            setSubjectClassFilter('');
          }
          setActiveTab(tab);
        }}
        onLogout={handleLogout}
      />

      <main className="flex-1 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {directPreviewPaperId ? (
            <PaperPdfPreview
              paperId={directPreviewPaperId}
              onBackToPapers={() => {
                if (window.history.pushState) {
                  window.history.pushState({}, '', '/');
                }
                setDirectPreviewPaperId(null);
                setActiveTab('papers');
              }}
            />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <Dashboard teacher={teacher} onNavigate={(tab) => setActiveTab(tab)} />
              )}

              {activeTab === 'classes' && (
                <ClassManagement
                  onNavigateToSubjectsForClass={handleNavigateToSubjectsForClass}
                />
              )}

              {activeTab === 'subjects' && (
                <SubjectManagement
                  initialClassFilter={subjectClassFilter}
                  onNavigateToClasses={() => setActiveTab('classes')}
                />
              )}

              {activeTab === 'resources' && (
                <ResourceManagement
                  onNavigateToClasses={() => setActiveTab('classes')}
                  onNavigateToSubjects={() => setActiveTab('subjects')}
                />
              )}

              {activeTab === 'create-paper' && (
                <PaperManagement
                  key="create-paper"
                  autoOpenCreateModal={true}
                  onNavigateToClasses={() => setActiveTab('classes')}
                  onNavigateToSubjects={() => setActiveTab('subjects')}
                />
              )}

              {activeTab === 'papers' && (
                <PaperManagement
                  key="papers-list"
                  autoOpenCreateModal={false}
                  onNavigateToClasses={() => setActiveTab('classes')}
                  onNavigateToSubjects={() => setActiveTab('subjects')}
                />
              )}

              {activeTab === 'question-bank' && (
                <QuestionBankManagement
                  onNavigateToClasses={() => setActiveTab('classes')}
                  onNavigateToSubjects={() => setActiveTab('subjects')}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsManagement
                  onNavigateToPapers={() => setActiveTab('papers')}
                />
              )}

              {activeTab === 'exam-patterns' && (
                <PlaceholderRoute tab={activeTab} onNavigate={(tab) => setActiveTab(tab)} />
              )}
            </>
          )}
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <p>School Examination Assessment Management System &bull; Phase 6 Production Ready</p>
      </footer>
    </div>
  );
}
