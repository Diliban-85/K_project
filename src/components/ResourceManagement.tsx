import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderOpen,
  Plus,
  School,
  BookOpen,
  FileText,
  Trash2,
  Eye,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  Layers,
} from 'lucide-react';
import { SchoolClass, SchoolSubject, SchoolResource } from '../types';
import { ResourceUploadModal } from './ResourceUploadModal';
import { ResourceDetailsModal } from './ResourceDetailsModal';
import { PdfViewerModal } from './PdfViewerModal';

interface ResourceManagementProps {
  onNavigateToClasses?: () => void;
  onNavigateToSubjects?: () => void;
}

export const ResourceManagement: React.FC<ResourceManagementProps> = ({
  onNavigateToClasses,
  onNavigateToSubjects,
}) => {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [resources, setResources] = useState<SchoolResource[]>([]);

  // Selected filters
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [detailsResourceId, setDetailsResourceId] = useState<string | null>(null);
  const [pdfViewerState, setPdfViewerState] = useState<{
    isOpen: boolean;
    resourceId: string;
    title: string;
    page: number;
  }>({
    isOpen: false,
    resourceId: '',
    title: '',
    page: 1,
  });

  const getHeaders = () => {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  // Fetch classes
  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch('/api/classes', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setClasses(data.classes || []);
      }
    } catch (e) {
      console.error('Error loading classes in ResourceManagement:', e);
    }
  }, []);

  // Fetch subjects (filtered if class is chosen)
  const fetchSubjects = useCallback(async () => {
    try {
      const url = selectedClassId
        ? `/api/subjects?classId=${encodeURIComponent(selectedClassId)}`
        : '/api/subjects';
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSubjects(data.subjects || []);
      }
    } catch (e) {
      console.error('Error loading subjects in ResourceManagement:', e);
    }
  }, [selectedClassId]);

  // Fetch resources with active filters
  const fetchResources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedClassId) params.append('classId', selectedClassId);
      if (selectedSubjectId) params.append('subjectId', selectedSubjectId);

      const qs = params.toString();
      const url = qs ? `/api/resources?${qs}` : '/api/resources';

      const res = await fetch(url, { headers: getHeaders() });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load resources');
      }

      setResources(data.resources || []);
    } catch (err: any) {
      setError(err.message || 'Error loading resources');
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, selectedSubjectId]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  // Handle deleting a resource
  const handleDeleteResource = async (id: string) => {
    try {
      const res = await fetch(`/api/resources/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete resource');
      }

      setSuccessMessage('Resource removed from private storage.');
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchResources();
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  const handleOpenPdf = (resourceId: string, title: string, page: number = 1) => {
    setPdfViewerState({
      isOpen: true,
      resourceId,
      title,
      page,
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const isPdf = (res: SchoolResource) =>
    res.fileType === 'application/pdf' ||
    res.file?.mimeType === 'application/pdf' ||
    res.file?.originalName.toLowerCase().endsWith('.pdf');

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
              Phase 2 System
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Teacher &rarr; Class &rarr; Subject &rarr; Resources
            </span>
          </div>
          <h1 className="mt-1 text-xl font-bold text-slate-900 tracking-tight">
            Educational Resource Management
          </h1>
          <p className="text-sm text-slate-500">
            Upload, browse, inspect, and preview curriculum documents in private storage.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchResources}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
            title="Refresh resources list"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            id="upload-resource-btn"
            onClick={() => setIsUploadOpen(true)}
            disabled={classes.length === 0}
            className="inline-flex items-center space-x-1.5 rounded-md bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Upload Resource</span>
          </button>
        </div>
      </div>

      {/* Hierarchy Navigation & Filter Bar */}
      <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700">
              <Filter className="h-3.5 w-3.5 text-slate-500" />
              <span>Hierarchy Scope:</span>
            </div>

            {/* Class filter */}
            <div className="flex items-center space-x-1.5">
              <School className="h-3.5 w-3.5 text-slate-400" />
              <select
                id="resource-class-filter"
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setSelectedSubjectId(''); // reset subject when class changes
                }}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-slate-900 focus:outline-none"
              >
                <option value="">All Classes ({classes.length})</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.grade ? `(Grade ${c.grade})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject filter */}
            <div className="flex items-center space-x-1.5">
              <BookOpen className="h-3.5 w-3.5 text-slate-400" />
              <select
                id="resource-subject-filter"
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-slate-900 focus:outline-none"
              >
                <option value="">
                  {selectedClassId ? 'All Class Subjects' : 'All Subjects'} ({subjects.length})
                </option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.code ? `[${s.code}]` : ''}
                  </option>
                ))}
              </select>
            </div>

            {(selectedClassId || selectedSubjectId) && (
              <button
                onClick={() => {
                  setSelectedClassId('');
                  setSelectedSubjectId('');
                }}
                className="text-xs text-slate-500 hover:text-slate-800 underline"
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500">
            Total Resources: <span className="font-semibold text-slate-900">{resources.length}</span>
          </div>
        </div>
      </div>

      {/* Success banner */}
      {successMessage && (
        <div
          id="resource-success-banner"
          className="rounded-md bg-emerald-50 p-3 border border-emerald-200 text-sm text-emerald-800 flex items-center space-x-2"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div
          id="resource-error-banner"
          className="rounded-md bg-red-50 p-4 border border-red-200 text-sm text-red-700 flex items-start space-x-2"
        >
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Error loading resources</p>
            <p className="mt-0.5 text-xs">{error}</p>
          </div>
        </div>
      )}

      {/* Prerequisite warning if 0 classes exist */}
      {!loading && classes.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
          <School className="mx-auto h-8 w-8 text-amber-600" />
          <h3 className="mt-2 text-sm font-semibold text-amber-900">Class &amp; Subject Prerequisite</h3>
          <p className="mt-1 text-xs text-amber-700 max-w-md mx-auto">
            Resources are stored within the Teacher &rarr; Class &rarr; Subject hierarchy. Please create a
            class and subject first before uploading educational resources.
          </p>
          <div className="mt-4 flex justify-center space-x-3">
            <button
              onClick={onNavigateToClasses}
              className="rounded-md bg-amber-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-amber-800"
            >
              Create Class First
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && !error && (
        <div className="rounded-md border border-slate-200 bg-white p-12 text-center">
          <RefreshCw className="mx-auto h-6 w-6 text-slate-400 animate-spin" />
          <p className="mt-3 text-sm text-slate-500 font-medium">Querying private resource vault...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && resources.length === 0 && classes.length > 0 && (
        <div
          id="resource-empty-state"
          className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/50 p-12 text-center"
        >
          <FolderOpen className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="mt-3 text-sm font-semibold text-slate-900">No resources found</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            {selectedClassId || selectedSubjectId
              ? 'No documents found matching your filter selection. Try clearing the filters or upload a new resource.'
              : 'You have not uploaded any educational documents yet. Upload textbooks, curriculum guides, or PDFs to begin.'}
          </p>
          <div className="mt-5">
            <button
              onClick={() => setIsUploadOpen(true)}
              className="inline-flex items-center space-x-1.5 rounded-md bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Upload Your First Resource</span>
            </button>
          </div>
        </div>
      )}

      {/* Resources Table */}
      {!loading && !error && resources.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <tr>
                <th scope="col" className="px-5 py-3">Resource Name &amp; File</th>
                <th scope="col" className="px-5 py-3">Class / Subject</th>
                <th scope="col" className="px-5 py-3">Status</th>
                <th scope="col" className="px-5 py-3">Size &amp; Pages</th>
                <th scope="col" className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {resources.map((res) => {
                const isDocPdf = isPdf(res);
                const pageCount = res._count?.pages ?? (res.pages?.length ?? 0);

                return (
                  <tr key={res.id} id={`resource-row-${res.id}`} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-start space-x-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-100 text-slate-700 border border-slate-200 shrink-0 mt-0.5">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => setDetailsResourceId(res.id)}
                            className="font-semibold text-slate-900 hover:text-slate-950 hover:underline text-left block"
                          >
                            {res.name}
                          </button>
                          <p className="text-[11px] text-slate-400 font-mono truncate max-w-xs mt-0.5">
                            {res.file?.originalName || res.name}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-xs text-slate-700">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1">
                          <School className="h-3 w-3 text-slate-400" />
                          <span className="font-medium text-slate-900">{res.class?.name || 'Class'}</span>
                        </div>
                        <div className="flex items-center space-x-1 text-slate-500">
                          <BookOpen className="h-3 w-3 text-slate-400" />
                          <span>{res.subject?.name || 'Subject'}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      {res.processingStatus === 'READY' && (
                        <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          <span>Ready</span>
                        </span>
                      )}
                      {res.processingStatus === 'PROCESSING' && (
                        <span className="inline-flex items-center space-x-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">
                          <RefreshCw className="h-3 w-3 animate-spin text-blue-600" />
                          <span>Processing</span>
                        </span>
                      )}
                      {res.processingStatus === 'FAILED' && (
                        <span className="inline-flex items-center space-x-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 border border-red-200">
                          <AlertCircle className="h-3 w-3 text-red-600" />
                          <span>Failed</span>
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-xs text-slate-600">
                      <p className="font-medium">{formatFileSize(res.fileSize)}</p>
                      {pageCount > 0 && (
                        <p className="text-[11px] text-slate-400 flex items-center space-x-1 mt-0.5">
                          <Layers className="h-3 w-3" />
                          <span>{pageCount} {pageCount === 1 ? 'page' : 'pages'}</span>
                        </p>
                      )}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {isDocPdf && (
                          <button
                            id={`view-pdf-btn-${res.id}`}
                            onClick={() => handleOpenPdf(res.id, res.name)}
                            className="inline-flex items-center space-x-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                            title="Open in Document Viewer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>View PDF</span>
                          </button>
                        )}

                        <button
                          onClick={() => setDetailsResourceId(res.id)}
                          className="inline-flex items-center rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                          title="View Details"
                        >
                          <FileText className="h-4 w-4" />
                        </button>

                        <button
                          id={`delete-resource-${res.id}`}
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete "${res.name}"?`)) {
                              handleDeleteResource(res.id);
                            }
                          }}
                          className="inline-flex items-center rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                          title="Delete resource"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Modal */}
      <ResourceUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        classes={classes}
        initialClassId={selectedClassId}
        initialSubjectId={selectedSubjectId}
        onUploadSuccess={(newRes) => {
          setSuccessMessage(`Resource "${newRes.name}" uploaded successfully!`);
          setTimeout(() => setSuccessMessage(null), 4000);
          fetchResources();
        }}
      />

      {/* Details Modal */}
      {detailsResourceId && (
        <ResourceDetailsModal
          isOpen={!!detailsResourceId}
          onClose={() => setDetailsResourceId(null)}
          resourceId={detailsResourceId}
          onOpenPdfViewer={handleOpenPdf}
          onDeleteResource={handleDeleteResource}
        />
      )}

      {/* PDF Viewer Modal */}
      {pdfViewerState.isOpen && (
        <PdfViewerModal
          isOpen={pdfViewerState.isOpen}
          onClose={() => setPdfViewerState((prev) => ({ ...prev, isOpen: false }))}
          resourceId={pdfViewerState.resourceId}
          resourceTitle={pdfViewerState.title}
          initialPage={pdfViewerState.page}
        />
      )}
    </div>
  );
};
