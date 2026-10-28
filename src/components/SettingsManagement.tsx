import React, { useState, useEffect } from 'react';
import {
  School,
  Settings,
  Download,
  Upload,
  FileSpreadsheet,
  Save,
  CheckCircle2,
  AlertTriangle,
  History,
  Clock,
  Shield,
  RefreshCw,
  Building,
  FileText,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { SystemSettings, SchoolClass, SchoolSubject, AuditLog } from '../types';

interface SettingsManagementProps {
  onNavigateToPapers?: () => void;
}

export const SettingsManagement: React.FC<SettingsManagementProps> = ({ onNavigateToPapers }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'defaults' | 'backup' | 'audit'>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Settings State
  const [settings, setSettings] = useState<SystemSettings>({
    id: '',
    teacherId: '',
    schoolName: 'Springfield High School',
    schoolAddress: '123 Education Lane, Academic City',
    contactPhone: '+1 (555) 019-2834',
    contactEmail: '',
    website: 'https://springfieldhigh.edu',
    logoUrl: '',
    academicYear: '2025-2026',
    defaultExamName: 'Annual Examination',
    defaultClassId: '',
    defaultSubjectId: '',
    defaultTotalMarks: 100,
    defaultDuration: '3 Hours',
    defaultInstructions:
      '1. All questions are compulsory unless specified.\n2. Read all questions carefully before answering.\n3. Write your Roll Number clearly on the answer sheet.\n4. Programmable calculators are not allowed unless stated.',
    fontSizePreference: 'NORMAL',
    showWatermark: false,
    watermarkText: 'CONFIDENTIAL',
    createdAt: '',
    updatedAt: '',
  });

  // Reference Classes & Subjects
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Restore State
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreData, setRestoreData] = useState<any | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreOptions, setRestoreOptions] = useState({
    restoreSettings: true,
    restoreQuestions: true,
  });

  // Load initial settings and classes
  const loadData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [settingsRes, classesRes, subjectsRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/classes'),
        fetch('/api/subjects'),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        if (data.settings) {
          setSettings(data.settings);
        }
      }

      if (classesRes.ok) {
        const cData = await classesRes.json();
        setClasses(cData.classes || []);
      }

      if (subjectsRes.ok) {
        const sData = await subjectsRes.json();
        setSubjects(sData.subjects || []);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load system settings.');
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/settings/audit-logs?limit=50');
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeTab]);

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      if (!settings.schoolName || !settings.schoolName.trim()) {
        throw new Error('School name cannot be empty.');
      }

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update settings.');
      }

      setSettings(data.settings);
      setSuccessMessage('Settings and School Profile successfully saved!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportJson = () => {
    window.open('/api/backup/export', '_blank');
  };

  const handleExportCsv = () => {
    window.open('/api/backup/export-csv', '_blank');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFile(file);
    setRestoreError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed.meta || !parsed.meta.app) {
          setRestoreError('Invalid backup file. Missing standard metadata signature.');
          setRestoreData(null);
          return;
        }

        setRestoreData(parsed);
      } catch (err) {
        setRestoreError('Unable to parse JSON file. Please ensure it is a valid backup file.');
        setRestoreData(null);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!restoreData) return;
    setRestoring(true);
    setRestoreError(null);

    try {
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backupData: restoreData,
          restoreSettings: restoreOptions.restoreSettings,
          restoreQuestions: restoreOptions.restoreQuestions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Backup restore failed.');
      }

      setSuccessMessage(
        `Backup restored successfully! ${data.summary?.restoredQuestions || 0} questions imported.`
      );
      setRestoreModalOpen(false);
      setRestoreFile(null);
      setRestoreData(null);
      loadData();
    } catch (err: any) {
      setRestoreError(err.message || 'Failed to restore backup.');
    } finally {
      setRestoring(false);
    }
  };

  const filteredSubjects = settings.defaultClassId
    ? subjects.filter((s) => s.classId === settings.defaultClassId)
    : subjects;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl bg-white border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-3 text-slate-500">
          <RefreshCw className="h-5 w-5 animate-spin text-slate-700" />
          <span className="text-sm font-medium">Loading system preferences and school profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div id="settings-management-container" className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-white p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs">
            <Building className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Administration & System Settings
              </h1>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
                Phase 6 Production
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Configure institution profile, examination defaults, backup archives, and audit records.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            id="save-settings-top-btn"
            onClick={() => handleSaveSettings()}
            disabled={saving}
            className="inline-flex items-center space-x-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
          >
            {saving ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="flex items-center space-x-2 rounded-lg bg-emerald-50 p-4 border border-emerald-200 text-xs font-medium text-emerald-800 shadow-xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center space-x-2 rounded-lg bg-red-50 p-4 border border-red-200 text-xs font-medium text-red-800 shadow-xs">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4 pt-2 shadow-xs space-x-2 overflow-x-auto">
        <button
          type="button"
          id="tab-btn-profile"
          onClick={() => setActiveTab('profile')}
          className={`inline-flex items-center space-x-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'profile'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Building className="h-4 w-4" />
          <span>School Profile</span>
        </button>

        <button
          type="button"
          id="tab-btn-defaults"
          onClick={() => setActiveTab('defaults')}
          className={`inline-flex items-center space-x-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'defaults'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Sliders className="h-4 w-4" />
          <span>Examination Defaults</span>
        </button>

        <button
          type="button"
          id="tab-btn-backup"
          onClick={() => setActiveTab('backup')}
          className={`inline-flex items-center space-x-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'backup'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Shield className="h-4 w-4" />
          <span>Data Backup & Export</span>
        </button>

        <button
          type="button"
          id="tab-btn-audit"
          onClick={() => setActiveTab('audit')}
          className={`inline-flex items-center space-x-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'audit'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <History className="h-4 w-4" />
          <span>Activity & Audit Trail</span>
        </button>
      </div>

      {/* Tab 1: School Profile */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveSettings} className="rounded-b-xl bg-white p-6 border border-t-0 border-slate-200 shadow-xs space-y-6">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Institution Profile</h2>
            <p className="text-xs text-slate-500">
              Information configured here appears on standard examination headers and metadata for new papers.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-700">
                School / Institution Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="input-school-name"
                required
                value={settings.schoolName || ''}
                onChange={(e) => setSettings({ ...settings, schoolName: e.target.value })}
                placeholder="e.g. Springfield High School"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-700">School Address</label>
              <input
                type="text"
                id="input-school-address"
                value={settings.schoolAddress || ''}
                onChange={(e) => setSettings({ ...settings, schoolAddress: e.target.value })}
                placeholder="e.g. 123 Education Lane, Academic City, State 90210"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Contact Telephone</label>
              <input
                type="text"
                id="input-contact-phone"
                value={settings.contactPhone || ''}
                onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
                placeholder="e.g. +1 (555) 019-2834"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Administrative Email</label>
              <input
                type="email"
                id="input-contact-email"
                value={settings.contactEmail || ''}
                onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                placeholder="e.g. principal@springfield.edu"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">School Website</label>
              <input
                type="url"
                id="input-website"
                value={settings.website || ''}
                onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                placeholder="e.g. https://springfieldhigh.edu"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Current Academic Year</label>
              <input
                type="text"
                id="input-academic-year"
                value={settings.academicYear || ''}
                onChange={(e) => setSettings({ ...settings, academicYear: e.target.value })}
                placeholder="e.g. 2025-2026"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-700">School Logo URL (Optional)</label>
              <input
                type="url"
                id="input-logo-url"
                value={settings.logoUrl || ''}
                onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                placeholder="https://example.com/logo.png"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
              />
              <p className="text-[11px] text-slate-400">
                Direct image link to your institution emblem or crest.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              id="save-profile-btn"
              disabled={saving}
              className="inline-flex items-center space-x-2 rounded-lg bg-slate-900 px-5 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Saving Profile...' : 'Save School Profile'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Examination Defaults */}
      {activeTab === 'defaults' && (
        <form onSubmit={handleSaveSettings} className="rounded-b-xl bg-white p-6 border border-t-0 border-slate-200 shadow-xs space-y-6">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Examination Defaults & Format</h2>
            <p className="text-xs text-slate-500">
              Pre-populate values when teachers draft new question papers. Changes will apply to future papers.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Default Examination Name</label>
              <input
                type="text"
                id="input-default-exam-name"
                value={settings.defaultExamName || ''}
                onChange={(e) => setSettings({ ...settings, defaultExamName: e.target.value })}
                placeholder="e.g. Annual Final Examination"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Default Examination Duration</label>
              <input
                type="text"
                id="input-default-duration"
                value={settings.defaultDuration || ''}
                onChange={(e) => setSettings({ ...settings, defaultDuration: e.target.value })}
                placeholder="e.g. 3 Hours (180 Minutes)"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Default Maximum Marks</label>
              <input
                type="number"
                id="input-default-total-marks"
                min="1"
                max="1000"
                value={settings.defaultTotalMarks || 100}
                onChange={(e) => setSettings({ ...settings, defaultTotalMarks: Number(e.target.value) || 100 })}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Default Class Pre-selection</label>
              <select
                id="select-default-class"
                value={settings.defaultClassId || ''}
                onChange={(e) => setSettings({ ...settings, defaultClassId: e.target.value, defaultSubjectId: '' })}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
              >
                <option value="">-- No Default Class --</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.section ? `(${c.section})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Default Subject Pre-selection</label>
              <select
                id="select-default-subject"
                value={settings.defaultSubjectId || ''}
                onChange={(e) => setSettings({ ...settings, defaultSubjectId: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
              >
                <option value="">-- No Default Subject --</option>
                {filteredSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.code ? `(${s.code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Print Typography Scale</label>
              <select
                id="select-font-size"
                value={settings.fontSizePreference || 'NORMAL'}
                onChange={(e) => setSettings({ ...settings, fontSizePreference: e.target.value as any })}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
              >
                <option value="COMPACT">Compact (High density, tight line spacing)</option>
                <option value="NORMAL">Standard Times New Roman (Recommended)</option>
                <option value="LARGE">Expanded (Large print readability)</option>
              </select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-700">Default Examination General Instructions</label>
              <textarea
                id="textarea-default-instructions"
                rows={4}
                value={settings.defaultInstructions || ''}
                onChange={(e) => setSettings({ ...settings, defaultInstructions: e.target.value })}
                placeholder="Enter standard numbered instructions for candidates..."
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              id="save-defaults-btn"
              disabled={saving}
              className="inline-flex items-center space-x-2 rounded-lg bg-slate-900 px-5 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Saving Defaults...' : 'Save Examination Defaults'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Tab 3: Data Backup & Restore */}
      {activeTab === 'backup' && (
        <div className="rounded-b-xl bg-white p-6 border border-t-0 border-slate-200 shadow-xs space-y-6">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Data Management, Export & Secure Backup
            </h2>
            <p className="text-xs text-slate-500">
              Export complete structured assessment archives in machine-readable JSON or spreadsheet CSV.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Export Card */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-4">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
                  <Download className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Download Administrative Backup (JSON)</h3>
                  <p className="text-[11px] text-slate-500">
                    Includes Question Bank, full Examination Papers with Parts, Choice Groups, and Settings.
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-white p-3 border border-slate-200 text-xs text-slate-600 space-y-1 font-mono text-[11px]">
                <p>&bull; Format: Safe Structured JSON</p>
                <p>&bull; Security: Zero password hashes or API credentials exported</p>
                <p>&bull; Compatibility: 100% Phase 1–6 compliant</p>
              </div>

              <button
                type="button"
                id="download-backup-json-btn"
                onClick={handleExportJson}
                className="w-full inline-flex items-center justify-center space-x-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-medium text-white hover:bg-slate-800 transition-colors shadow-xs"
              >
                <Download className="h-4 w-4" />
                <span>Download Complete JSON Backup</span>
              </button>
            </div>

            {/* CSV Export Card */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-4">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-700 text-white">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Export Examination Papers (CSV)</h3>
                  <p className="text-[11px] text-slate-500">
                    Spreadsheet report of papers, classes, marks, duration, and PDF versions.
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-white p-3 border border-slate-200 text-xs text-slate-600 space-y-1 font-mono text-[11px]">
                <p>&bull; Format: UTF-8 CSV</p>
                <p>&bull; Uses: Microsoft Excel, Google Sheets, LibreOffice</p>
                <p>&bull; Details: Class, Subject, Marks, PDF status</p>
              </div>

              <button
                type="button"
                id="download-papers-csv-btn"
                onClick={handleExportCsv}
                className="w-full inline-flex items-center justify-center space-x-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors shadow-xs"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Export Papers Summary CSV</span>
              </button>
            </div>
          </div>

          {/* Restore Section */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-600 text-white">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-amber-950">Restore Assessment Data from Backup File</h3>
                <p className="text-[11px] text-amber-800">
                  Safely import question bank records and settings from a previously downloaded JSON backup file.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                id="open-restore-modal-btn"
                onClick={() => setRestoreModalOpen(true)}
                className="inline-flex items-center space-x-2 rounded-lg bg-amber-700 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-800 transition-colors shadow-xs"
              >
                <Upload className="h-4 w-4" />
                <span>Upload & Validate Backup File...</span>
              </button>
              <span className="text-[11px] text-amber-900">
                Non-destructive merge: Existing records are preserved and deduplicated.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Audit Trail */}
      {activeTab === 'audit' && (
        <div className="rounded-b-xl bg-white p-6 border border-t-0 border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">System Audit & Activity Logs</h2>
              <p className="text-xs text-slate-500">
                Track chronological paper creations, PDF generations, duplications, and administrative updates.
              </p>
            </div>
            <button
              type="button"
              id="refresh-audit-logs-btn"
              onClick={loadAuditLogs}
              disabled={loadingLogs}
              className="inline-flex items-center space-x-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
              <span>Refresh Logs</span>
            </button>
          </div>

          {loadingLogs ? (
            <div className="py-8 text-center text-xs text-slate-500">Loading audit records...</div>
          ) : auditLogs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
              No audit logs recorded yet. System activities will appear here in chronological order.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 font-semibold text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Entity</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {auditLogs.map((log) => {
                    let actionBadge = 'bg-slate-100 text-slate-700 border-slate-200';
                    if (log.action.includes('PDF')) actionBadge = 'bg-blue-50 text-blue-700 border-blue-200';
                    if (log.action.includes('CREATED') || log.action.includes('DUPLICATED'))
                      actionBadge = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    if (log.action.includes('ARCHIVED'))
                      actionBadge = 'bg-amber-50 text-amber-700 border-amber-200';
                    if (log.action.includes('DELETED')) actionBadge = 'bg-red-50 text-red-700 border-red-200';

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold border ${actionBadge}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                          {log.entityType}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-[11px] max-w-md truncate">
                          {log.details || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {restoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-600 text-white">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Restore Assessment Data</h3>
                <p className="text-xs text-slate-500">Select an examination system backup JSON file.</p>
              </div>
            </div>

            {/* File Upload input */}
            <div className="rounded-lg border-2 border-dashed border-slate-200 p-4 text-center">
              <input
                type="file"
                id="restore-file-input"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
              <label
                htmlFor="restore-file-input"
                className="cursor-pointer inline-flex items-center space-x-2 rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <FileText className="h-4 w-4" />
                <span>{restoreFile ? restoreFile.name : 'Choose JSON Backup File...'}</span>
              </label>
            </div>

            {restoreError && (
              <div className="rounded-lg bg-red-50 p-3 border border-red-200 text-xs text-red-800">
                {restoreError}
              </div>
            )}

            {restoreData && (
              <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 space-y-2 text-xs">
                <p className="font-semibold text-slate-800">Backup File Verified:</p>
                <p className="text-slate-600">
                  &bull; App: {restoreData.meta?.app || 'Assessment Portal'} ({restoreData.meta?.exportedAt})
                </p>
                <p className="text-slate-600">
                  &bull; Bank Questions in backup: {restoreData.bankQuestions?.length || 0}
                </p>
                <p className="text-slate-600">
                  &bull; Papers in backup: {restoreData.papers?.length || 0}
                </p>

                <div className="pt-2 border-t border-slate-200 space-y-1.5">
                  <label className="flex items-center space-x-2 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={restoreOptions.restoreSettings}
                      onChange={(e) =>
                        setRestoreOptions({ ...restoreOptions, restoreSettings: e.target.checked })
                      }
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <span>Restore School Profile & Defaults</span>
                  </label>

                  <label className="flex items-center space-x-2 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={restoreOptions.restoreQuestions}
                      onChange={(e) =>
                        setRestoreOptions({ ...restoreOptions, restoreQuestions: e.target.checked })
                      }
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <span>Import and merge Question Bank items</span>
                  </label>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                id="cancel-restore-btn"
                onClick={() => {
                  setRestoreModalOpen(false);
                  setRestoreFile(null);
                  setRestoreData(null);
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-restore-btn"
                disabled={!restoreData || restoring}
                onClick={handleExecuteRestore}
                className="inline-flex items-center space-x-2 rounded-lg bg-amber-700 px-4 py-2 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-50 shadow-xs"
              >
                {restoring && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>{restoring ? 'Restoring...' : 'Confirm & Restore'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
