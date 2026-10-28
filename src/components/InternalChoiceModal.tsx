import React, { useState } from 'react';
import { X, GitFork, Plus, AlertCircle } from 'lucide-react';
import { PaperSection } from '../types';

interface InternalChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  paperId: string;
  sections: PaperSection[];
  activeSectionId: string;
  onChoiceGroupCreated: () => void;
}

export const InternalChoiceModal: React.FC<InternalChoiceModalProps> = ({
  isOpen,
  onClose,
  paperId,
  sections,
  activeSectionId,
  onChoiceGroupCreated,
}) => {
  const [sectionId, setSectionId] = useState<string>(activeSectionId || (sections[0]?.id || ''));
  const [label, setLabel] = useState<string>('Answer either Option A OR Option B:');
  const [marks, setMarks] = useState<number>(5);
  const [questionAText, setQuestionAText] = useState<string>('');
  const [questionBText, setQuestionBText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!sectionId) {
      setError('Please select a target section');
      return;
    }

    if (!questionAText.trim()) {
      setError('Option A question text is required');
      return;
    }

    if (!questionBText.trim()) {
      setError('Option B question text is required');
      return;
    }

    if (marks < 0) {
      setError('Marks must be 0 or greater');
      return;
    }

    setSubmitting(true);

    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/papers/${paperId}/choice-groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          sectionId,
          label: label.trim(),
          marks,
          questionA: {
            questionText: questionAText.trim(),
          },
          questionB: {
            questionText: questionBText.trim(),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create internal choice group');
      }

      onChoiceGroupCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error creating choice group');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
              <GitFork className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Add Internal Choice (A OR B)</h2>
              <p className="text-xs text-slate-500">
                Structured choice group where students select one alternative.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Section <span className="text-red-500">*</span>
              </label>
              <select
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                required
              >
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Choice Marks <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={marks}
                onChange={(e) => setMarks(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Instructions / Group Label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Answer either Option A OR Option B:"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Option A Question Text <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={questionAText}
                onChange={(e) => setQuestionAText(e.target.value)}
                placeholder="Enter primary question option A..."
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 border rounded-sm">
                OR
              </span>
              <div className="border-t border-slate-200 w-full" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Option B Question Text <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={questionBText}
                onChange={(e) => setQuestionBText(e.target.value)}
                placeholder="Enter alternative question option B..."
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center space-x-1.5 rounded-md bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
            >
              <GitFork className="h-3.5 w-3.5" />
              <span>{submitting ? 'Creating...' : 'Create Choice Group'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
