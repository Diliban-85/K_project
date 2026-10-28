import React, { useState, useEffect } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  School,
  BookOpen,
} from 'lucide-react';
import { SchoolClass, SchoolSubject } from '../types';

interface ResourceUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: SchoolClass[];
  initialClassId?: string;
  initialSubjectId?: string;
  onUploadSuccess: (newResource: any) => void;
}

export const ResourceUploadModal: React.FC<ResourceUploadModalProps> = ({
  isOpen,
  onClose,
  classes,
  initialClassId = '',
  initialSubjectId = '',
  onUploadSuccess,
}) => {
  const [name, setName] = useState('');
  const [selectedClassId, setSelectedClassId] = useState(initialClassId);
  const [selectedSubjectId, setSelectedSubjectId] = useState(initialSubjectId);
  const [availableSubjects, setAvailableSubjects] = useState<SchoolSubject[]>([]);
  const [file, setFile] = useState<File | null>(null);

  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'processing' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Sync initial class selection
  useEffect(() => {
    if (initialClassId) {
      setSelectedClassId(initialClassId);
    } else if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }, [initialClassId, classes, selectedClassId]);

  // Fetch subjects for currently selected class
  useEffect(() => {
    if (!selectedClassId) {
      setAvailableSubjects([]);
      setSelectedSubjectId('');
      return;
    }

    const fetchSubjects = async () => {
      setLoadingSubjects(true);
      try {
        const token = localStorage.getItem('auth_token');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`/api/subjects?classId=${encodeURIComponent(selectedClassId)}`, {
          headers,
        });
        const data = await res.json();
        if (res.ok) {
          const subs: SchoolSubject[] = data.subjects || [];
          setAvailableSubjects(subs);
          if (subs.length > 0) {
            // Keep selected if valid, otherwise pick first
            if (!subs.some((s) => s.id === selectedSubjectId)) {
              setSelectedSubjectId(subs[0].id);
            }
          } else {
            setSelectedSubjectId('');
          }
        }
      } catch (err) {
        console.error('Error loading class subjects:', err);
      } finally {
        setLoadingSubjects(false);
      }
    };

    fetchSubjects();
  }, [selectedClassId]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];

      // Validate size (50MB)
      if (selected.size > 50 * 1024 * 1024) {
        setError('File exceeds the 50MB limit.');
        return;
      }

      setFile(selected);
      // Auto-suggest resource name if not filled
      if (!name.trim()) {
        const baseName = selected.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
        setName(baseName);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Resource name is required.');
      return;
    }

    if (!selectedClassId) {
      setError('Please select a target class.');
      return;
    }

    if (!selectedSubjectId) {
      setError('Please select a target subject.');
      return;
    }

    if (!file) {
      setError('Please select a document file to upload.');
      return;
    }

    setUploading(true);
    setUploadProgress('uploading');

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('classId', selectedClassId);
      formData.append('subjectId', selectedSubjectId);
      formData.append('file', file);

      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      setUploadProgress('processing');

      const res = await fetch('/api/resources', {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setUploadProgress('done');
      onUploadSuccess(data.resource);
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred during resource upload');
      setUploadProgress('idle');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      id="resource-upload-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !uploading) onClose();
      }}
    >
      <div
        id="resource-upload-modal"
        className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-900 text-white">
              <UploadCloud className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Upload Educational Resource</h3>
              <p className="text-xs text-slate-500">Associate documents with a class and subject</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div
            id="upload-error-banner"
            className="mt-4 rounded-md bg-red-50 p-3 border border-red-200 text-xs text-red-700 flex items-start space-x-2"
          >
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Class Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-700">Select Class *</label>
            <select
              required
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white focus:border-slate-900 focus:outline-none"
            >
              <option value="" disabled>
                Choose class...
              </option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} {cls.grade ? `(Grade ${cls.grade})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Subject Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-700">Select Subject *</label>
            {loadingSubjects ? (
              <div className="mt-1 flex items-center space-x-2 text-xs text-slate-500 py-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Loading subjects for selected class...</span>
              </div>
            ) : availableSubjects.length === 0 ? (
              <p className="mt-1 text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                No subjects found in this class. Please add a subject in Subject Management first.
              </p>
            ) : (
              <select
                required
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white focus:border-slate-900 focus:outline-none"
              >
                {availableSubjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name} {sub.code ? `[${sub.code}]` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Resource Name */}
          <div>
            <label className="block text-xs font-medium text-slate-700">Resource Name / Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Unit 3 - Mechanics Textbook Syllabus"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none"
            />
          </div>

          {/* File Picker */}
          <div>
            <label className="block text-xs font-medium text-slate-700">Document File *</label>
            <div className="mt-1 flex justify-center rounded-lg border-2 border-dashed border-slate-300 px-6 pt-5 pb-6 hover:border-slate-400 transition-colors">
              <div className="space-y-1 text-center">
                <FileText className="mx-auto h-8 w-8 text-slate-400" />
                <div className="flex text-xs text-slate-600 justify-center">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer rounded bg-white font-medium text-slate-900 underline hover:text-slate-700"
                  >
                    <span>Choose a file</span>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      required
                      accept=".pdf,.docx,.doc,.pptx,.ppt,.jpg,.jpeg,.png,.webp"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-[11px] text-slate-500">
                  PDF, DOCX, PPTX, or Images up to 50MB
                </p>
                {file && (
                  <div className="mt-2 inline-flex items-center space-x-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800 border border-slate-200">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Upload and processing status */}
          {uploading && (
            <div className="rounded-md bg-blue-50 p-3 border border-blue-200 text-xs text-blue-800 flex items-center space-x-2">
              <RefreshCw className="h-4 w-4 animate-spin text-blue-600 shrink-0" />
              <span>
                {uploadProgress === 'uploading'
                  ? 'Transferring document to private storage vault...'
                  : 'Processing document pages & text boundaries...'}
              </span>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="rounded-md border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              id="submit-upload-resource-btn"
              type="submit"
              disabled={uploading || availableSubjects.length === 0}
              className="inline-flex items-center space-x-1.5 rounded-md bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs"
            >
              {uploading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="h-4 w-4" />
                  <span>Upload &amp; Process</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
