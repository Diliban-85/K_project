import React, { useState, useEffect, useCallback } from 'react';
import { School, Plus, Edit2, Trash2, BookOpen, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { SchoolClass } from '../types';
import { Dialog } from './ui/Dialog';

interface ClassManagementProps {
  onNavigateToSubjectsForClass?: (classId: string) => void;
}

export const ClassManagement: React.FC<ClassManagementProps> = ({
  onNavigateToSubjectsForClass,
}) => {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Form states
  const [selectedClass, setSelectedClass] = useState<SchoolClass | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    grade: '',
    section: '',
    description: '',
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
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/classes', {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load classes');
      }
      setClasses(data.classes || []);
    } catch (err: any) {
      setError(err.message || 'Error loading classes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const handleOpenCreate = () => {
    setFormData({ name: '', grade: '', section: '', description: '' });
    setFormError(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (cls: SchoolClass) => {
    setSelectedClass(cls);
    setFormData({
      name: cls.name,
      grade: cls.grade || '',
      section: cls.section || '',
      description: cls.description || '',
    });
    setFormError(null);
    setIsEditOpen(true);
  };

  const handleOpenDelete = (cls: SchoolClass) => {
    setSelectedClass(cls);
    setIsDeleteOpen(false);
    setIsDeleteOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Class name is required');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create class');
      }

      setIsCreateOpen(false);
      setActionSuccess(`Class "${formData.name.trim()}" created successfully`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchClasses();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass) return;
    if (!formData.name.trim()) {
      setFormError('Class name cannot be empty');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/classes/${selectedClass.id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update class');
      }

      setIsEditOpen(false);
      setActionSuccess(`Class renamed to "${formData.name.trim()}"`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchClasses();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedClass) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/classes/${selectedClass.id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete class');
      }

      setIsDeleteOpen(false);
      setActionSuccess(`Class "${selectedClass.name}" deleted successfully`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchClasses();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Class Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create, rename, and organize classes assigned under your teaching profile.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            id="refresh-classes-btn"
            onClick={fetchClasses}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
            title="Refresh classes list"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            id="create-class-btn"
            onClick={handleOpenCreate}
            className="inline-flex items-center space-x-1.5 rounded-md bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Create Class</span>
          </button>
        </div>
      </div>

      {/* Action feedback banners */}
      {actionSuccess && (
        <div
          id="class-success-banner"
          className="rounded-md bg-emerald-50 p-3 border border-emerald-200 text-sm text-emerald-800 flex items-center space-x-2"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div
          id="class-error-banner"
          className="rounded-md bg-red-50 p-4 border border-red-200 text-sm text-red-700 flex items-start space-x-2"
        >
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Error loading classes</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && !error && (
        <div id="class-loading-state" className="rounded-md border border-slate-200 bg-white p-12 text-center">
          <RefreshCw className="mx-auto h-6 w-6 text-slate-400 animate-spin" />
          <p className="mt-3 text-sm text-slate-500 font-medium">Loading teacher classes...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && classes.length === 0 && (
        <div
          id="class-empty-state"
          className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/50 p-12 text-center"
        >
          <School className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="mt-3 text-sm font-semibold text-slate-900">No classes found</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
            You haven't created any classes yet. Create your first class to start associating subjects
            and preparing exam papers.
          </p>
          <div className="mt-5">
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center space-x-1.5 rounded-md bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Create Your First Class</span>
            </button>
          </div>
        </div>
      )}

      {/* Classes list table */}
      {!loading && !error && classes.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <tr>
                <th scope="col" className="px-5 py-3">Class Name</th>
                <th scope="col" className="px-5 py-3">Grade &amp; Section</th>
                <th scope="col" className="px-5 py-3">Subjects Attached</th>
                <th scope="col" className="px-5 py-3">Description</th>
                <th scope="col" className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {classes.map((cls) => {
                const subjectCount = cls._count?.subjects ?? (cls.subjects?.length ?? 0);
                return (
                  <tr key={cls.id} id={`class-row-${cls.id}`} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      <div className="flex items-center space-x-2">
                        <School className="h-4 w-4 text-slate-500 shrink-0" />
                        <span>{cls.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      <div className="flex items-center space-x-1.5">
                        {cls.grade && (
                          <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 border border-slate-200">
                            Grade {cls.grade}
                          </span>
                        )}
                        {cls.section && (
                          <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 border border-slate-200">
                            Sec {cls.section}
                          </span>
                        )}
                        {!cls.grade && !cls.section && <span className="text-slate-400">—</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => onNavigateToSubjectsForClass?.(cls.id)}
                        className="inline-flex items-center space-x-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 hover:underline"
                        title="View subjects for this class"
                      >
                        <BookOpen className="h-3.5 w-3.5 text-slate-500" />
                        <span>{subjectCount} {subjectCount === 1 ? 'subject' : 'subjects'}</span>
                      </button>
                    </td>
                    <td className="px-5 py-4 text-slate-500 max-w-xs truncate">
                      {cls.description || <span className="text-slate-400 italic">No notes</span>}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          id={`edit-class-${cls.id}`}
                          onClick={() => handleOpenEdit(cls)}
                          className="inline-flex items-center rounded p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                          title="Rename / Edit class"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          id={`delete-class-${cls.id}`}
                          onClick={() => handleOpenDelete(cls)}
                          className="inline-flex items-center rounded p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                          title="Delete class"
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

      {/* Create Class Dialog */}
      <Dialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Class"
        description="Add a class to your teacher account."
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
              {formError}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-700">Class Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Grade 10 - Section A"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Grade / Year</label>
              <input
                type="text"
                placeholder="e.g. 10"
                value={formData.grade}
                onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Section</label>
              <input
                type="text"
                placeholder="e.g. A"
                value={formData.section}
                onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Description / Notes</label>
            <textarea
              rows={2}
              placeholder="Optional notes for this cohort"
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
              {submitting ? 'Creating...' : 'Save Class'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Rename / Edit Class Dialog */}
      <Dialog
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Rename / Edit Class"
        description="Update class title and details."
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
              {formError}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-700">Class Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Grade / Year</label>
              <input
                type="text"
                value={formData.grade}
                onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Section</label>
              <input
                type="text"
                value={formData.section}
                onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>
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
              {submitting ? 'Saving...' : 'Update Class'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Class"
        description="This action cannot be undone."
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete class{' '}
            <strong className="text-slate-900">"{selectedClass?.name}"</strong>?
          </p>
          <div className="rounded-md bg-amber-50 p-3 border border-amber-200 text-xs text-amber-800">
            <strong>Warning:</strong> Deleting this class will also delete any subjects associated
            with this class.
          </div>
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
