import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit,
  Calendar,
  Clock,
  Award,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  FolderOpen,
  BookOpen,
  Layers,
  FileCheck,
  Copy,
  Archive,
  RotateCcw,
  History,
  Download,
  FileSpreadsheet,
  X,
  Eye,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { SchoolPaper, SchoolClass, SchoolSubject, PdfHistory } from '../types';
import { CreatePaperModal } from './CreatePaperModal';
import { PaperEditor } from './PaperEditor';
import { BookReaderView } from './BookReaderView';
import { EditPaperStructureModal } from './EditPaperStructureModal';
import { PaperPdfPreview } from './PaperPdfPreview';

interface PaperManagementProps {
  onNavigateToClasses: () => void;
  onNavigateToSubjects: () => void;
  initialSelectedPaperId?: string | null;
  autoOpenCreateModal?: boolean;
}

export const PaperManagement: React.FC<PaperManagementProps> = ({
  onNavigateToClasses,
  onNavigateToSubjects,
  initialSelectedPaperId = null,
  autoOpenCreateModal = false,
}) => {
  const [papers, setPapers] = useState<SchoolPaper[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [viewArchived, setViewArchived] = useState<boolean>(false);

  // Active views
  const [activePaperId, setActivePaperId] = useState<string | null>(initialSelectedPaperId);
  const [previewPaperId, setPreviewPaperId] = useState<string | null>(null);
  const [activeBookPaper, setActiveBookPaper] = useState<SchoolPaper | null>(null);
  const [structurePaper, setStructurePaper] = useState<SchoolPaper | null>(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(autoOpenCreateModal);
  const [historyModalPaper, setHistoryModalPaper] = useState<SchoolPaper | null>(null);
  const [pdfHistory, setPdfHistory] = useState<PdfHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const getHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (selectedClassFilter !== 'ALL') params.set('classId', selectedClassFilter);
      if (selectedSubjectFilter !== 'ALL') params.set('subjectId', selectedSubjectFilter);
      if (selectedStatusFilter !== 'ALL') params.set('status', selectedStatusFilter);
      params.set('isArchived', String(viewArchived));

      const [papersRes, classRes, subjectRes] = await Promise.all([
        fetch(`/api/papers?${params.toString()}`, { headers: getHeaders() }),
        fetch('/api/classes', { headers: getHeaders() }),
        fetch('/api/subjects', { headers: getHeaders() }),
      ]);

      if (papersRes.ok) {
        const pData = await papersRes.json();
        setPapers(pData.papers || []);
      }
      if (classRes.ok) {
        const cData = await classRes.json();
        setClasses(cData.classes || []);
      }
      if (subjectRes.ok) {
        const sData = await subjectRes.json();
        setSubjects(sData.subjects || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load examination papers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedClassFilter, selectedSubjectFilter, selectedStatusFilter, viewArchived]);

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedClassFilter('ALL');
    setSelectedSubjectFilter('ALL');
    setSelectedStatusFilter('ALL');
  };

  const handleDuplicate = async (paper: SchoolPaper) => {
    try {
      const res = await fetch(`/api/papers/${paper.id}/duplicate`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Duplication failed.');

      setActionMessage({
        type: 'success',
        text: `Paper "${paper.examinationName}" duplicated successfully as a new draft.`,
      });
      loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to duplicate paper.' });
    }
  };

  const handleToggleArchive = async (paper: SchoolPaper) => {
    const endpoint = paper.isArchived ? `/api/papers/${paper.id}/restore` : `/api/papers/${paper.id}/archive`;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update archive status.');

      setActionMessage({
        type: 'success',
        text: data.message || `Paper status updated.`,
      });
      loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to update archive state.' });
    }
  };

  const handleDeletePaper = async (paperId: string, examName: string) => {
    if (
      !confirm(
        `Are you sure you want to permanently delete "${examName}"? All sections, choice structures, and questions in this paper will be deleted.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/papers/${paperId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete paper');
      }

      setActionMessage({ type: 'success', text: `Paper "${examName}" deleted.` });
      setPapers((prev) => prev.filter((p) => p.id !== paperId));
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Error deleting paper' });
    }
  };

  const handleOpenPdfHistory = async (paper: SchoolPaper) => {
    setHistoryModalPaper(paper);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/papers/${paper.id}/pdf-history`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setPdfHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to load PDF history', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleExportSinglePaper = async (paper: SchoolPaper) => {
    try {
      const res = await fetch(`/api/papers/${paper.id}`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to load paper details');
      const data = await res.json();

      const blob = new Blob([JSON.stringify(data.paper, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `paper-${paper.examinationName.toLowerCase().replace(/[^a-z0-9]/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Could not export paper JSON.');
    }
  };

  // If a paper is open for PDF Preview, render PaperPdfPreview
  if (previewPaperId) {
    return (
      <PaperPdfPreview
        paperId={previewPaperId}
        onBackToPapers={() => {
          setPreviewPaperId(null);
          loadData();
        }}
        onBackToEditor={() => {
          const id = previewPaperId;
          setPreviewPaperId(null);
          setActivePaperId(id);
        }}
      />
    );
  }

  // If a paper is active in the editor, render PaperEditor
  if (activePaperId) {
    return (
      <PaperEditor
        paperId={activePaperId}
        onBack={() => {
          setActivePaperId(null);
          loadData();
        }}
      />
    );
  }

  const filteredSubjects =
    selectedClassFilter !== 'ALL'
      ? subjects.filter((s) => s.classId === selectedClassFilter)
      : subjects;

  return (
    <div id="paper-management-main" className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl bg-white p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Examination Papers
              </h1>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
                {papers.length} {viewArchived ? 'Archived' : 'Active'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Assemble questions, configure parts, enforce compulsory & choice constraints, and generate validated PDFs.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            id="export-csv-summary-btn"
            onClick={() => window.open('/api/backup/export-csv', '_blank')}
            className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
            title="Export summary of all papers to CSV"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            id="create-new-paper-main-btn"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center space-x-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 shadow-xs transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Create Paper</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionMessage && (
        <div
          className={`flex items-center justify-between rounded-lg p-4 text-xs font-medium border shadow-xs ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)}>
            <X className="h-4 w-4 opacity-70 hover:opacity-100" />
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-xs font-medium text-red-800 border border-red-200 shadow-xs">
          {error}
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="rounded-xl bg-white p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              id="search-papers-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search exam name, school, class..."
              className="w-full rounded-lg border border-slate-200 pl-9 pr-4 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
            />
          </div>

          {/* Class Filter */}
          <div>
            <select
              id="select-paper-filter-class"
              value={selectedClassFilter}
              onChange={(e) => {
                setSelectedClassFilter(e.target.value);
                setSelectedSubjectFilter('ALL');
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-slate-900 outline-none"
            >
              <option value="ALL">All Classes</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} {cls.grade ? `(${cls.grade})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Subject Filter */}
          <div>
            <select
              id="select-paper-filter-subject"
              value={selectedSubjectFilter}
              onChange={(e) => setSelectedSubjectFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-slate-900 outline-none"
            >
              <option value="ALL">All Subjects</option>
              {filteredSubjects.map((subj) => (
                <option key={subj.id} value={subj.id}>
                  {subj.name} {subj.code ? `[${subj.code}]` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              id="select-paper-filter-status"
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-slate-900 outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="READY">Ready / Generated</option>
              <option value="PUBLISHED">Published</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center space-x-2">
            {/* Active vs Archived Toggle */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
              <button
                type="button"
                id="view-active-papers-tab-btn"
                onClick={() => setViewArchived(false)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  !viewArchived
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Active Papers
              </button>
              <button
                type="button"
                id="view-archived-papers-tab-btn"
                onClick={() => setViewArchived(true)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  viewArchived
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Archived Papers
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              id="clear-paper-filters-btn"
              onClick={handleClearFilters}
              className="text-xs text-slate-500 hover:text-slate-900 underline underline-offset-2"
            >
              Clear Filters
            </button>
            <button
              type="button"
              id="refresh-papers-list-btn"
              onClick={loadData}
              className="inline-flex items-center space-x-1 text-xs text-slate-600 hover:text-slate-900"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Papers Grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl bg-white border border-slate-200">
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <RefreshCw className="h-4 w-4 animate-spin text-slate-700" />
            <span>Loading examination papers...</span>
          </div>
        </div>
      ) : papers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            {viewArchived ? 'No archived papers found' : 'No examination papers found'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm">
            {viewArchived
              ? 'Papers moved to the archive will appear here and can be restored back to your active workflow.'
              : 'Create your first paper to assemble questions, sections, and marks manually.'}
          </p>
          {!viewArchived && (
            <div className="mt-2 flex items-center space-x-3">
              {classes.length === 0 ? (
                <button
                  onClick={onNavigateToClasses}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 shadow-xs"
                >
                  Create a Class First
                </button>
              ) : (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="inline-flex items-center space-x-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 shadow-xs"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Paper</span>
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {papers.map((paper) => {
            const hasMarksMismatch =
              paper.actualMarks !== undefined && paper.actualMarks !== paper.totalMarks;

            return (
              <div
                key={paper.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition-all group space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            paper.status === 'READY'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {paper.status}
                        </span>

                        {paper.pdfVersion && paper.pdfVersion > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleOpenPdfHistory(paper)}
                            className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800 border border-blue-200 hover:bg-blue-100 transition-colors"
                            title="Click to view version history"
                          >
                            PDF v{paper.pdfVersion}
                          </button>
                        ) : null}

                        {paper.isArchived && (
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                            Archived
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-slate-800 transition-colors">
                        {paper.examinationName}
                      </h3>
                      <p className="text-xs text-slate-500 truncate">
                        {paper.class?.name} &bull; {paper.subject?.name}{' '}
                        {paper.academicYear ? `(${paper.academicYear})` : ''}
                      </p>
                    </div>

                    {/* Top card action menu */}
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDuplicate(paper)}
                        className="rounded p-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                        title="Duplicate Paper as New Draft"
                      >
                        <Copy className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleArchive(paper)}
                        className="rounded p-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                        title={paper.isArchived ? 'Restore to Active' : 'Move to Archive'}
                      >
                        {paper.isArchived ? (
                          <RotateCcw className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Archive className="h-4 w-4" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeletePaper(paper.id, paper.examinationName)}
                        className="rounded p-1 text-slate-400 hover:text-red-600 hover:bg-red-50"
                        title="Delete Paper"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Metadata Row */}
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-600">
                    <div>
                      <span className="text-slate-400 block">Exam Total Marks</span>
                      <span className="font-semibold text-slate-900">{paper.totalMarks} marks</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block">Calculated Sum</span>
                      <div className="flex items-center space-x-1">
                        <span className="font-semibold text-slate-900">{paper.actualMarks || 0} marks</span>
                        {hasMarksMismatch && (
                          <span title="Total marks mismatch with parts calculation">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 block">Parts / Questions</span>
                      <span className="font-medium text-slate-700">
                        {paper.sectionsCount || 0} parts &bull; {paper.questionsCount || 0} qs
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block">Duration / Date</span>
                      <span className="font-medium text-slate-700 truncate">
                        {paper.duration || '3 Hours'}
                      </span>
                    </div>
                  </div>

                  {/* Marks Warning if any */}
                  {hasMarksMismatch && (
                    <div className="mt-3 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800 border border-amber-200">
                      Warning: Allocated marks ({paper.actualMarks}) differ from total ({paper.totalMarks}).
                    </div>
                  )}
                </div>

                {/* Primary Action Buttons */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => setActivePaperId(paper.id)}
                      className="flex-1 inline-flex items-center justify-center space-x-1.5 rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      <span>Edit Paper</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPreviewPaperId(paper.id)}
                      className="inline-flex items-center justify-center space-x-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors shadow-xs"
                      title="Generate / Print PDF"
                    >
                      <FileCheck className="h-3.5 w-3.5" />
                      <span>PDF</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <button
                      type="button"
                      onClick={() => setStructurePaper(paper)}
                      className="text-slate-600 hover:text-slate-900 font-medium inline-flex items-center space-x-1"
                    >
                      <Layers className="h-3.5 w-3.5 text-blue-600" />
                      <span>Configure Parts</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveBookPaper(paper)}
                      className="text-slate-600 hover:text-slate-900 font-medium inline-flex items-center space-x-1"
                    >
                      <BookOpen className="h-3.5 w-3.5 text-slate-700" />
                      <span>Book Viewer</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExportSinglePaper(paper)}
                      className="text-slate-500 hover:text-slate-800 inline-flex items-center space-x-0.5"
                      title="Export Paper JSON"
                    >
                      <Download className="h-3 w-3" />
                      <span>JSON</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal 1: PDF Version History */}
      {historyModalPaper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <History className="h-4 w-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  PDF Version History: {historyModalPaper.examinationName}
                </h3>
              </div>
              <button
                onClick={() => setHistoryModalPaper(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingHistory ? (
              <div className="py-8 text-center text-xs text-slate-500">Loading version records...</div>
            ) : pdfHistory.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No archived generation logs yet. Generate your first PDF in the preview tab to record history.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 font-semibold text-slate-700">
                    <tr>
                      <th className="px-3 py-2">Version</th>
                      <th className="px-3 py-2">Timestamp</th>
                      <th className="px-3 py-2">Total Marks</th>
                      <th className="px-3 py-2">Questions</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pdfHistory.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2 font-bold text-slate-900">v{h.version}</td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
                          {new Date(h.generatedAt).toLocaleString()}
                        </td>
                        <td className="px-3 py-2">{h.totalMarks}</td>
                        <td className="px-3 py-2">{h.questionCount}</td>
                        <td className="px-3 py-2">
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                            {h.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setHistoryModalPaper(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Book Reader View if triggered */}
      {activeBookPaper && (
        <BookReaderView
          paperId={activeBookPaper.id}
          classId={activeBookPaper.classId}
          subjectId={activeBookPaper.subjectId}
          onClose={() => {
            setActiveBookPaper(null);
            loadData();
          }}
          onFinish={() => {
            const pid = activeBookPaper.id;
            setActiveBookPaper(null);
            setActivePaperId(pid);
          }}
          onPaperUpdated={() => loadData()}
        />
      )}

      {/* Edit Paper Structure Modal */}
      {structurePaper && (
        <EditPaperStructureModal
          isOpen={!!structurePaper}
          paper={structurePaper}
          onClose={() => setStructurePaper(null)}
          onSaved={() => {
            setStructurePaper(null);
            loadData();
          }}
        />
      )}

      {/* Create Paper Modal */}
      {isCreateModalOpen && (
        <CreatePaperModal
          isOpen={true}
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={(newPaper) => {
            setPapers((prev) => [newPaper, ...prev]);
            setActiveBookPaper(newPaper);
          }}
          classes={classes}
          subjects={subjects}
        />
      )}
    </div>
  );
};
