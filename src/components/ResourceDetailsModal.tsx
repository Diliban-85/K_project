import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Calendar,
  Layers,
  School,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Eye,
  Trash2,
  RefreshCw,
  HardDrive,
} from 'lucide-react';
import { SchoolResource } from '../types';

interface ResourceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  resourceId: string;
  onOpenPdfViewer: (resourceId: string, title: string, page?: number) => void;
  onDeleteResource: (resourceId: string) => void;
}

export const ResourceDetailsModal: React.FC<ResourceDetailsModalProps> = ({
  isOpen,
  onClose,
  resourceId,
  onOpenPdfViewer,
  onDeleteResource,
}) => {
  const [resource, setResource] = useState<SchoolResource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePageTab, setActivePageTab] = useState<number>(1);

  useEffect(() => {
    if (!isOpen || !resourceId) return;

    setLoading(true);
    setError(null);

    const fetchDetails = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`/api/resources/${resourceId}`, { headers });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch resource details');
        }

        setResource(data.resource);
      } catch (err: any) {
        setError(err.message || 'Error loading details');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [isOpen, resourceId]);

  if (!isOpen) return null;

  const isPdf =
    resource?.fileType === 'application/pdf' ||
    resource?.file?.mimeType === 'application/pdf' ||
    resource?.file?.originalName.toLowerCase().endsWith('.pdf');

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'READY':
        return (
          <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>Ready</span>
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center space-x-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-600" />
            <span>Processing</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center space-x-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 border border-red-200">
            <AlertCircle className="h-3.5 w-3.5 text-red-600" />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            <span>{status}</span>
          </span>
        );
    }
  };

  return (
    <div
      id="resource-details-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="resource-details-modal"
        className="w-full max-w-3xl rounded-lg border border-slate-200 bg-white shadow-xl max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 truncate max-w-md">
                {resource?.name || 'Resource Details'}
              </h2>
              <p className="text-xs text-slate-500">Document Overview &amp; Extraction Foundation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="py-12 text-center">
              <RefreshCw className="mx-auto h-6 w-6 text-slate-400 animate-spin" />
              <p className="mt-3 text-sm text-slate-500 font-medium">Loading resource metadata...</p>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 p-4 border border-red-200 text-sm text-red-700 flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Error Loading Resource</p>
                <p className="mt-0.5 text-xs">{error}</p>
              </div>
            </div>
          )}

          {!loading && resource && (
            <>
              {/* Primary metadata grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-lg bg-slate-50 p-4 border border-slate-200">
                <div>
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                    Status
                  </span>
                  <div className="mt-1">{getStatusBadge(resource.processingStatus)}</div>
                </div>

                <div>
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                    File Type
                  </span>
                  <p className="mt-1 text-xs font-semibold text-slate-800 truncate">
                    {resource.file?.mimeType || resource.fileType}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                    File Size
                  </span>
                  <p className="mt-1 text-xs font-semibold text-slate-800">
                    {formatFileSize(resource.fileSize)}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                    Uploaded On
                  </span>
                  <p className="mt-1 text-xs font-semibold text-slate-800">
                    {formatDate(resource.createdAt)}
                  </p>
                </div>
              </div>

              {/* Hierarchy Context */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-md border border-slate-200 p-3.5 bg-white">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700">
                    <School className="h-4 w-4 text-slate-500" />
                    <span>Assigned Class</span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {resource.class?.name || 'Class'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {resource.class?.grade ? `Grade ${resource.class.grade}` : ''}{' '}
                    {resource.class?.section ? `• Section ${resource.class.section}` : ''}
                  </p>
                </div>

                <div className="rounded-md border border-slate-200 p-3.5 bg-white">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700">
                    <BookOpen className="h-4 w-4 text-slate-500" />
                    <span>Assigned Subject</span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {resource.subject?.name || 'Subject'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Code: {resource.subject?.code || 'None'}
                  </p>
                </div>
              </div>

              {/* Private Storage Information */}
              <div className="rounded-md border border-slate-200 p-3.5 bg-slate-50/70">
                <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700">
                  <HardDrive className="h-4 w-4 text-slate-500" />
                  <span>S3-Compatible Storage Vault</span>
                </div>
                <div className="mt-1 text-xs text-slate-600 font-mono break-all">
                  Key: {resource.storagePath}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Storage Provider: {resource.file?.storageProvider || 'local-s3-compatible'} &bull; Private and isolated
                </p>
              </div>

              {/* Processing notices */}
              {resource.processingError && (
                <div className="rounded-md bg-amber-50 p-3 border border-amber-200 text-xs text-amber-800">
                  <strong>Notice:</strong> {resource.processingError}
                </div>
              )}

              {/* Extracted Pages Section (for PDFs) */}
              {resource.pages && resource.pages.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                      <Layers className="h-4 w-4 text-slate-500" />
                      <span>Extracted Document Pages ({resource.pages.length})</span>
                    </h3>
                    <span className="text-[11px] text-slate-500">
                      Click page to preview extracted text
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-md overflow-hidden">
                    {/* Page selector buttons */}
                    <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50 p-1.5 space-x-1 scrollbar-none">
                      {resource.pages.map((p) => (
                        <button
                          key={p.pageNumber}
                          onClick={() => setActivePageTab(p.pageNumber)}
                          className={`rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                            activePageTab === p.pageNumber
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Page {p.pageNumber} ({p.wordCount || 0} w)
                        </button>
                      ))}
                    </div>

                    {/* Page content box */}
                    <div className="p-4 bg-white max-h-48 overflow-y-auto">
                      {(() => {
                        const page = resource.pages.find((p) => p.pageNumber === activePageTab);
                        if (!page || !page.text) {
                          return (
                            <p className="text-xs text-slate-400 italic">
                              No text extracted on this page.
                            </p>
                          );
                        }
                        return (
                          <div className="text-xs text-slate-800 leading-relaxed font-mono whitespace-pre-wrap">
                            {page.text}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <div>
            <button
              onClick={() => {
                if (window.confirm(`Are you sure you want to delete "${resource?.name}"?`)) {
                  onDeleteResource(resourceId);
                  onClose();
                }
              }}
              className="inline-flex items-center space-x-1 rounded-md px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Resource</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>

            {isPdf && (
              <button
                id="details-view-pdf-btn"
                onClick={() => {
                  onClose();
                  onOpenPdfViewer(resourceId, resource?.name || 'Document', activePageTab);
                }}
                className="inline-flex items-center space-x-1.5 rounded-md bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition-colors shadow-xs"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Open in PDF Viewer</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
