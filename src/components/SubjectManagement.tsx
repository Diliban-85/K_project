import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Plus, Edit2, Trash2, School, AlertCircle, RefreshCw, CheckCircle2, Filter } from 'lucide-react';
import { SchoolClass, SchoolSubject } from '../types';
import { Dialog } from './ui/Dialog';

interface SubjectManagementProps {
  initialClassFilter?: string;
  onNavigateToClasses?: () => void;
}

export const SubjectManagement: React.FC<SubjectManagementProps> = ({
  initialClassFilter,
  onNavigateToClasses,
}) => {
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>(initialClassFilter || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Form states
  const [selectedSubject, setSelectedSubject] = useState<SchoolSubject | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    classId: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch('/api/classes', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) {
        setClasses(data.classes || []);
      }
    } catch (e) {
      console.error('Error fetching classes for dropdown:', e);
    }
  }, []);

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = selectedClassFilter
        ? `/api/subjects?classId=${encodeURIComponent(selectedClassFilter)}`
        : '/api/subjects';
      const res = await fetch(url, { headers: getHeaders() });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load subjects');
      }
      setSubjects(data.subjects || []);
    } catch (err: any) {
      setError(err.message || 'Error loading subjects');
    } finally {
      setLoading(false);
    }
  }, [selectedClassFilter]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const handleOpenCreate = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      classId: selectedClassFilter || (classes[0]?.id ?? ''),
    });
    setFormError(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (subject: SchoolSubject) => {
    setSelectedSubject(subject);
    setFormData({
      name: subject.name,
      code: subject.code || '',
      description: subject.description || '',
      classId: subject.classId,
    });
    setFormError(null);
    setIsEditOpen(true);
  };

  const handleOpenDelete = (subject: SchoolSubject) => {
    setSelectedSubject(subject);
    setIsDeleteOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Subject name is required');
      return;
    }
    if (!formData.classId) {
      setFormError('Please select an assigned class');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create subject');
      }

      setIsCreateOpen(false);
      setActionSuccess(`Subject "${formData.name.trim()}" created successfully`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchSubjects();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject) return;
    if (!formData.name.trim()) {
      setFormError('Subject name cannot be empty');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/subjects/${selectedSubject.id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update subject');
      }

      setIsEditOpen(false);
      setActionSuccess(`Subject updated to "${formData.name.trim()}"`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchSubjects();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedSubject) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/subjects/${selectedSubject.id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete subject');
      }

      setIsDeleteOpen(false);
      setActionSuccess(`Subject "${selectedSubject.name}" deleted successfully`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchSubjects();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Subject Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure academic subjects and assign them to your respective classes.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            id="refresh-subjects-btn"
            onClick={fetchSubjects}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
            title="Refresh subjects list"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            id="create-subject-btn"
            onClick={handleOpenCreate}
            disabled={classes.length === 0}
            className="inline-flex items-center space-x-1.5 rounded-md bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Create Subject</span>
          </button>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <span className="text-xs font-medium text-slate-700">Filter by Class:</span>
          <select
            id="subject-class-filter"
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-slate-900 focus:outline-none"
          >
            <option value="">All Classes ({classes.length})</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-500">
          Showing <span className="font-semibold text-slate-900">{subjects.length}</span>{' '}
          {subjects.length === 1 ? 'subject' : 'subjects'}
        </div>
      </div>

      {/* Success banner */}
      {actionSuccess && (
        <div
          id="subject-success-banner"
          className="rounded-md bg-emerald-50 p-3 border border-emerald-200 text-sm text-emerald-800 flex items-center space-x-2"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div
          id="subject-error-banner"
          className="rounded-md bg-red-50 p-4 border border-red-200 text-sm text-red-700 flex items-start space-x-2"
        >
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Error loading subjects</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Prerequisite: Prompt to create a class first if teacher has 0 classes */}
      {!loading && classes.length === 0 && (
        <div
          id="no-classes-warning"
          className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center"
        >
          <School className="mx-auto h-8 w-8 text-amber-600" />
          <h3 className="mt-2 text-sm font-semibold text-amber-900">Class Prerequisite Required</h3>
          <p className="mt-1 text-xs text-amber-700 max-w-md mx-auto">
            Subjects must be associated with a class owned by your account. Please create at least one
            class before creating subjects.
          </p>
          <div className="mt-4">
            <button
              onClick={onNavigateToClasses}
              className="inline-flex items-center space-x-1.5 rounded-md bg-amber-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-amber-800 transition-colors"
            >
              <School className="h-3.5 w-3.5" />
              <span>Go to Class Management</span>
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && !error && (
        <div id="subject-loading-state" className="rounded-md border border-slate-200 bg-white p-12 text-center">
          <RefreshCw className="mx-auto h-6 w-6 text-slate-400 animate-spin" />
          <p className="mt-3 text-sm text-slate-500 font-medium">Loading subjects...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && subjects.length === 0 && classes.length > 0 && (
        <div
          id="subject-empty-state"
          className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/50 p-12 text-center"
        >
          <BookOpen className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="mt-3 text-sm font-semibold text-slate-900">No subjects found</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
            {selectedClassFilter
              ? 'No subjects are registered under the selected class filter.'
              : 'You have not registered any subjects yet. Create subjects to associate them with your classes.'}
          </p>
          <div className="mt-5">
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center space-x-1.5 rounded-md bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Create Subject</span>
            </button>
          </div>
        </div>
      )}

      {/* Subjects Table */}
      {!loading && !error && subjects.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <tr>
                <th scope="col" className="px-5 py-3">Subject Name</th>
                <th scope="col" className="px-5 py-3">Code</th>
                <th scope="col" className="px-5 py-3">Assigned Class</th>
                <th scope="col" className="px-5 py-3">Description</th>
                <th scope="col" className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {subjects.map((sub) => (
                <tr key={sub.id} id={`subject-row-${sub.id}`} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-4 font-semibold text-slate-900">
                    <div className="flex items-center space-x-2">
                      <BookOpen className="h-4 w-4 text-slate-500 shrink-0" />
                      <span>{sub.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {sub.code ? (
                      <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-medium text-slate-700">
                        {sub.code}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center space-x-1 text-xs text-slate-800 bg-slate-100 px-2 py-1 rounded border border-slate-200 font-medium">
                      <School className="h-3 w-3 text-slate-500" />
                      <span>{sub.class?.name || 'Assigned Class'}</span>
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-500 max-w-xs truncate">
                    {sub.description || <span className="text-slate-400 italic">No description</span>}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end space-x-1">
                      <button
                        id={`edit-subject-${sub.id}`}
                        onClick={() => handleOpenEdit(sub)}
                        className="inline-flex items-center rounded p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        title="Rename / Edit subject"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        id={`delete-subject-${sub.id}`}
                        onClick={() => handleOpenDelete(sub)}
                        className="inline-flex items-center rounded p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                        title="Delete subject"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Subject Dialog */}
      <Dialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Subject"
        description="Add a subject to one of your classes."
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700">Assign to Class *</label>
            <select
              required
              value={formData.classId}
              onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white focus:border-slate-900 focus:outline-none"
            >
              <option value="" disabled>
                Select a class...
              </option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} {cls.grade ? `(Grade ${cls.grade})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Subject Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Physics, World History, Algebra II"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Course Code (Optional)</label>
            <input
              type="text"
              placeholder="e.g. PHY-101, MTH-201"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Description</label>
            <textarea
              rows={2}
              placeholder="Syllabus scope or curriculum overview"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Save Subject'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Edit / Rename Subject Dialog */}
      <Dialog
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Rename / Edit Subject"
        description="Update subject metadata or class association."
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700">Assigned Class *</label>
            <select
              required
              value={formData.classId}
              onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white focus:border-slate-900 focus:outline-none"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Subject Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Course Code</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Description</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Update Subject'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Subject"
        description="This action cannot be undone."
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete subject{' '}
            <strong className="text-slate-900">"{selectedSubject?.name}"</strong>?
          </p>
          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsDeleteOpen(false)}
              className="rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleDeleteConfirm}
              className="rounded-md bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
