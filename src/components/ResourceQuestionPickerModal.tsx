import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  FileText,
  Search,
  Check,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Plus,
  AlertCircle,
  FileSearch,
} from 'lucide-react';
import { SchoolResource, SchoolResourcePage, PaperSection } from '../types';
import { PdfViewerModal } from './PdfViewerModal';

interface ResourceQuestionPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  paperId: string;
  classId: string;
  subjectId: string;
  sections: PaperSection[];
  activeSectionId: string;
  onQuestionAdded: () => void;
}

export const ResourceQuestionPickerModal: React.FC<ResourceQuestionPickerModalProps> = ({
  isOpen,
  onClose,
  paperId,
  classId,
  subjectId,
  sections,
  activeSectionId,
  onQuestionAdded,
}) => {
  const [resources, setResources] = useState<SchoolResource[]>([]);
  const [loadingResources, setLoadingResources] = useState<boolean>(true);
  const [selectedResource, setSelectedResource] = useState<SchoolResource | null>(null);
  const [selectedPageNum, setSelectedPageNum] = useState<number>(1);
  const [activePdfViewerResource, setActivePdfViewerResource] = useState<SchoolResource | null>(null);

  // Form inputs for the question to add
  const [targetSectionId, setTargetSectionId] = useState<string>(activeSectionId);
  const [selectedExcerpt, setSelectedExcerpt] = useState<string>('');
  const [customQuestionText, setCustomQuestionText] = useState<string>('');
  const [marks, setMarks] = useState<number>(2);
  const [sourceQuestionNumber, setSourceQuestionNumber] = useState<string>('');
  const [sourceChapter, setSourceChapter] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const getHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  useEffect(() => {
    if (isOpen) {
      fetchResources();
      setTargetSectionId(activeSectionId || (sections[0]?.id || ''));
      setNotification(null);
    }
  }, [isOpen, activeSectionId, sections]);

  const fetchResources = async () => {
    setLoadingResources(true);
    try {
      // First try fetching resources matching this class and subject
      const res = await fetch(`/api/resources?classId=${classId}&subjectId=${subjectId}`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        let list: SchoolResource[] = data.resources || [];

        // If no resources found for exact class/subject, fetch all teacher's resources as fallback
        if (list.length === 0) {
          const allRes = await fetch('/api/resources', { headers: getHeaders() });
          if (allRes.ok) {
            const allData = await allRes.json();
            list = allData.resources || [];
          }
        }

        setResources(list);
        if (list.length > 0 && !selectedResource) {
          loadResourceDetails(list[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load resources:', err);
    } finally {
      setLoadingResources(false);
    }
  };

  const loadResourceDetails = async (resourceId: string) => {
    try {
      const res = await fetch(`/api/resources/${resourceId}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSelectedResource(data.resource);
        setSelectedPageNum(1);
      }
    } catch (err) {
      console.error('Failed to load resource details:', err);
    }
  };

  if (!isOpen) return null;

  const currentPageData: SchoolResourcePage | undefined = selectedResource?.pages?.find(
    (p) => p.pageNumber === selectedPageNum
  );

  const totalPages = selectedResource?.pages?.length || 1;

  const handleSelectTextFromPage = (text: string) => {
    const clean = text.trim();
    setSelectedExcerpt(clean);
    setCustomQuestionText(clean);
  };

  const handleAddQuestionToPaper = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);

    if (!targetSectionId) {
      setNotification({ type: 'error', message: 'Please select a destination section on the paper' });
      return;
    }

    if (!customQuestionText.trim()) {
      setNotification({ type: 'error', message: 'Question text is required' });
      return;
    }

    if (marks < 0) {
      setNotification({ type: 'error', message: 'Marks must be 0 or greater' });
      return;
    }

    setSubmitting(true);

    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/papers/${paperId}/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          sectionId: targetSectionId,
          questionText: customQuestionText.trim(),
          originalSourceText: selectedExcerpt.trim() || customQuestionText.trim(),
          marks: marks,
          sourceResourceId: selectedResource?.id || null,
          sourcePageNumber: selectedResource ? selectedPageNum : null,
          sourceQuestionNumber: sourceQuestionNumber.trim() || undefined,
          sourceChapter: sourceChapter.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add question to paper');
      }

      setNotification({
        type: 'success',
        message: `Question added to section with verified source traceability!`,
      });
      onQuestionAdded();

      // Reset selection form fields
      setSelectedExcerpt('');
      setCustomQuestionText('');
      setSourceQuestionNumber('');
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to add question' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="flex h-[88vh] w-full max-w-6xl flex-col rounded-xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-3.5">
          <div className="flex items-center space-x-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <FileSearch className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Select Questions from Uploaded Resources
              </h2>
              <p className="text-xs text-slate-500">
                Browse curriculum textbooks &amp; PDFs, extract real questions, and maintain source traceability.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="grid grid-cols-12 flex-1 overflow-hidden divide-x divide-slate-200">
          {/* Left Column: Resource List (3 cols) */}
          <div className="col-span-3 flex flex-col bg-slate-50/50 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Available Resources ({resources.length})
              </h3>
            </div>

            {loadingResources ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading resources...</div>
            ) : resources.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                <BookOpen className="mx-auto h-6 w-6 text-slate-400 mb-1" />
                <p>No resources found.</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Upload textbooks or question banks in the Resources tab first.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {resources.map((res) => {
                  const isSelected = selectedResource?.id === res.id;
                  return (
                    <button
                      key={res.id}
                      onClick={() => loadResourceDetails(res.id)}
                      className={`w-full text-left rounded-lg p-2.5 border transition-all text-xs ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/80 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-semibold text-slate-800 line-clamp-1">{res.name}</span>
                        <span className="shrink-0 text-[10px] font-mono uppercase rounded-sm bg-slate-100 px-1 py-0.5 text-slate-600">
                          {res.fileType.includes('pdf') ? 'PDF' : 'DOC'}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                        <span>{res.class?.name || 'Class'} &bull; {res.subject?.name || 'Subject'}</span>
                        <span>{res._count?.pages || res.pages?.length || 0} pgs</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Middle Column: Resource Viewer / Extracted Pages (5 cols) */}
          <div className="col-span-5 flex flex-col overflow-hidden bg-white">
            {selectedResource ? (
              <div className="flex flex-col h-full">
                {/* Resource Header & Page Bar */}
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 bg-slate-50/50">
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {selectedResource.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Page {selectedPageNum} of {totalPages} &bull; Status: {selectedResource.processingStatus}
                    </p>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      disabled={selectedPageNum <= 1}
                      onClick={() => setSelectedPageNum((p) => Math.max(1, p - 1))}
                      className="rounded-md border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                      title="Previous Page"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>

                    <button
                      disabled={selectedPageNum >= totalPages}
                      onClick={() => setSelectedPageNum((p) => Math.min(totalPages, p + 1))}
                      className="rounded-md border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                      title="Next Page"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>

                    {selectedResource.fileType.includes('pdf') && (
                      <button
                        onClick={() => setActivePdfViewerResource(selectedResource)}
                        className="inline-flex items-center space-x-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100"
                        title="Open in full PDF viewer"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>PDF View</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Page Content View */}
                <div className="flex-1 overflow-y-auto p-4">
                  {currentPageData?.text ? (
                    <div className="space-y-3">
                      <div className="rounded-md bg-amber-50 p-2.5 text-[11px] text-amber-800 border border-amber-200">
                        Select any question paragraph below or highlight text to import it into your examination paper.
                      </div>

                      <div className="space-y-2">
                        {currentPageData.text
                          .split(/\n\s*\n/)
                          .map((para) => para.trim())
                          .filter((para) => para.length > 5)
                          .map((paragraph, idx) => (
                            <div
                              key={idx}
                              onClick={() => handleSelectTextFromPage(paragraph)}
                              className="group relative cursor-pointer rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-800 hover:border-blue-400 hover:bg-blue-50/40 transition-colors"
                            >
                              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                                <span>Excerpt #{idx + 1}</span>
                                <span className="opacity-0 group-hover:opacity-100 text-blue-600 font-semibold transition-opacity">
                                  Click to Select &rarr;
                                </span>
                              </div>
                              <p className="whitespace-pre-wrap leading-relaxed">{paragraph}</p>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center text-center p-6 text-slate-400">
                      <FileText className="h-8 w-8 mb-2 text-slate-300" />
                      <p className="text-xs font-medium text-slate-600">
                        {selectedResource.processingStatus === 'PROCESSING'
                          ? 'Document text is currently being indexed...'
                          : 'No text extracted on this page.'}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400 max-w-xs">
                        Use the "PDF View" button above to view the page visually and copy question text directly into the builder.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-center p-8 text-slate-400 text-xs">
                Select a curriculum resource from the left panel to inspect its contents.
              </div>
            )}
          </div>

          {/* Right Column: Question Staging & Paper Addition (4 cols) */}
          <div className="col-span-4 flex flex-col overflow-y-auto bg-slate-50/30 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-3">
              Add Question to Paper
            </h3>

            {notification && (
              <div
                className={`mb-3 rounded-md p-2.5 text-xs border ${
                  notification.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}
              >
                {notification.message}
              </div>
            )}

            <form onSubmit={handleAddQuestionToPaper} className="space-y-4">
              {/* Destination Section */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Destination Section <span className="text-red-500">*</span>
                </label>
                <select
                  value={targetSectionId}
                  onChange={(e) => setTargetSectionId(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                >
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.name} ({sec.questions?.length || 0} questions)
                    </option>
                  ))}
                </select>
              </div>

              {/* Source Information / Traceability */}
              <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                <div className="text-[11px] font-semibold text-slate-600 flex items-center justify-between">
                  <span>Source Traceability</span>
                  <span className="rounded-sm bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">
                    Phase 2 Linked
                  </span>
                </div>
                <div className="text-xs text-slate-700">
                  <p className="truncate font-medium">{selectedResource?.name || 'None selected'}</p>
                  <p className="text-[11px] text-slate-400">Page Number: {selectedPageNum}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                      Source Q# (Optional)
                    </label>
                    <input
                      type="text"
                      value={sourceQuestionNumber}
                      onChange={(e) => setSourceQuestionNumber(e.target.value)}
                      placeholder="e.g. Q4(b)"
                      className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                      Chapter/Topic
                    </label>
                    <input
                      type="text"
                      value={sourceChapter}
                      onChange={(e) => setSourceChapter(e.target.value)}
                      placeholder="e.g. Chapter 3"
                      className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Original Source (Read-only preview) */}
              {selectedExcerpt && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-600">
                      Original Source Text (Immutable)
                    </label>
                  </div>
                  <div className="max-h-20 overflow-y-auto rounded-md border border-slate-200 bg-slate-100/70 p-2 text-[11px] text-slate-600 leading-relaxed">
                    {selectedExcerpt}
                  </div>
                </div>
              )}

              {/* Teacher's Paper Question Text */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Question Text for Paper <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={5}
                  value={customQuestionText}
                  onChange={(e) => setCustomQuestionText(e.target.value)}
                  placeholder="Enter or refine the question wording for this examination..."
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 leading-relaxed"
                  required
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  Editing this question does not change the original textbook source.
                </p>
              </div>

              {/* Marks */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Allocated Marks <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={marks}
                  onChange={(e) => setMarks(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting || !customQuestionText.trim()}
                className="w-full inline-flex items-center justify-center space-x-1.5 rounded-md bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
              >
                <Plus className="h-4 w-4" />
                <span>{submitting ? 'Adding...' : 'Add Question to Paper'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Embedded PDF Viewer Modal if teacher wants visual inspect */}
      {activePdfViewerResource && (
        <PdfViewerModal
          resource={activePdfViewerResource}
          isOpen={true}
          onClose={() => setActivePdfViewerResource(null)}
        />
      )}
    </div>
  );
};
