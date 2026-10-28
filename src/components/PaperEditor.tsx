import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Edit2,
  ChevronUp,
  ChevronDown,
  FileText,
  AlertTriangle,
  CheckCircle2,
  GitFork,
  BookOpen,
  ArrowRightLeft,
  Calendar,
  Clock,
  Award,
  Layers,
  HelpCircle,
  Eye,
  RefreshCw,
  FileCheck,
} from 'lucide-react';
import { SchoolPaper, PaperSection, PaperQuestion, ChoiceGroup } from '../types';
import { ResourceQuestionPickerModal } from './ResourceQuestionPickerModal';
import { InternalChoiceModal } from './InternalChoiceModal';
import { BookReaderView } from './BookReaderView';
import { EditPaperStructureModal } from './EditPaperStructureModal';
import { PaperPdfPreview } from './PaperPdfPreview';
import { validatePaperComprehensive } from '../utils/paperValidation';

interface PaperEditorProps {
  paperId: string;
  onBack: () => void;
}

export const PaperEditor: React.FC<PaperEditorProps> = ({ paperId, onBack }) => {
  const [paper, setPaper] = useState<SchoolPaper | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Modals & Views state
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [isBookReaderOpen, setIsBookReaderOpen] = useState<boolean>(false);
  const [isResourcePickerOpen, setIsResourcePickerOpen] = useState<boolean>(false);
  const [isChoiceModalOpen, setIsChoiceModalOpen] = useState<boolean>(false);
  const [isStructureModalOpen, setIsStructureModalOpen] = useState<boolean>(false);
  const [activeSectionId, setActiveSectionId] = useState<string>('');

  // Editing modals/states
  const [editingQuestion, setEditingQuestion] = useState<PaperQuestion | null>(null);
  const [editQuestionText, setEditQuestionText] = useState<string>('');
  const [editQuestionMarks, setEditQuestionMarks] = useState<number>(1);
  const [editQuestionSectionId, setEditQuestionSectionId] = useState<string>('');
  const [showOriginalSource, setShowOriginalSource] = useState<Record<string, boolean>>({});

  // Section editing
  const [addingSection, setAddingSection] = useState<boolean>(false);
  const [newSectionName, setNewSectionName] = useState<string>('');
  const [newSectionInstructions, setNewSectionInstructions] = useState<string>('');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState<string>('');
  const [editingSectionInstructions, setEditingSectionInstructions] = useState<string>('');

  // Quick manual question add state (inline)
  const [addingManualToSectionId, setAddingManualToSectionId] = useState<string | null>(null);
  const [manualQuestionText, setManualQuestionText] = useState<string>('');
  const [manualMarks, setManualMarks] = useState<number>(1);

  const getHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const loadPaper = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/papers/${paperId}`, { headers: getHeaders() });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load paper draft');
      }
      const data = await res.json();
      setPaper(data.paper);
      if (data.paper.sections && data.paper.sections.length > 0 && !activeSectionId) {
        setActiveSectionId(data.paper.sections[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load paper');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPaper();
  }, [paperId]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex items-center space-x-2 text-slate-500 text-xs">
          <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
          <span>Loading examination paper editor...</span>
        </div>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-xs text-red-700">
        <p className="font-semibold text-sm">Failed to open paper</p>
        <p className="mt-1">{error || 'Paper record could not be retrieved.'}</p>
        <button
          onClick={onBack}
          className="mt-4 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
        >
          Back to Papers
        </button>
      </div>
    );
  }

  if (isPreviewOpen) {
    return (
      <PaperPdfPreview
        paperId={paperId}
        onBackToEditor={() => {
          setIsPreviewOpen(false);
          loadPaper();
        }}
        onBackToPapers={onBack}
      />
    );
  }

  // Calculate actual total marks across paper
  // If a Part has questionsToAnswer and marksPerQuestion defined, its contribution is questionsToAnswer * marksPerQuestion
  const sections = paper.sections || [];
  const allQuestions = paper.questions || [];
  const choiceGroups = paper.choiceGroups || [];

  let actualTotalMarks = 0;
  for (const sec of sections) {
    const secQuestions = sec.questions || [];
    const toAnswer = Number(sec.questionsToAnswer || sec.targetQuestions || 0);
    const marksPerQ = Number(sec.marksPerQuestion) || 1;

    if (toAnswer > 0) {
      actualTotalMarks += toAnswer * marksPerQ;
    } else {
      const seenChoiceInSec = new Set<string>();
      for (const q of secQuestions) {
        if (q.choiceGroupId) {
          if (!seenChoiceInSec.has(q.choiceGroupId)) {
            seenChoiceInSec.add(q.choiceGroupId);
            actualTotalMarks += q.marks;
          }
        } else {
          actualTotalMarks += q.marks;
        }
      }
    }
  }

  // Comprehensive validation
  const validationResult = validatePaperComprehensive(paper);

  const marksMismatch = actualTotalMarks !== paper.totalMarks;

  // Calculate global question numbers sequentially and continuously across all Parts:
  // Part A: Q.1 – Q.14, Part B: Q.15 – Q.28, Part C: Q.29 – ...
  // Uses questionsProvided and questionsToAnswer so numbering remains continuous even as questions are added/removed
  let currentStartNumber = 1;
  const questionNumberMap: Record<string, number> = {};
  const choiceGroupNumberMap: Record<string, number> = {};
  const sectionStartNumberMap: Record<string, number> = {};
  const sectionEndNumberMap: Record<string, number> = {};

  for (const sec of sections) {
    const secQuestions = sec.questions || [];
    sectionStartNumberMap[sec.id] = currentStartNumber;

    let partQCounter = currentStartNumber;
    for (const q of secQuestions) {
      if (q.choiceGroupId) {
        if (!choiceGroupNumberMap[q.choiceGroupId]) {
          choiceGroupNumberMap[q.choiceGroupId] = partQCounter++;
        }
      } else {
        questionNumberMap[q.id] = partQCounter++;
      }
    }

    const provided = Number(sec.questionsProvided || sec.targetQuestions || 0);
    const actualFilled = partQCounter - currentStartNumber;
    const partSpan = Math.max(provided, actualFilled);

    sectionEndNumberMap[sec.id] = currentStartNumber + (partSpan > 0 ? partSpan - 1 : 0);
    currentStartNumber += (partSpan > 0 ? partSpan : (secQuestions.length || 0));
  }

  // Handle Save Paper Draft
  const handleSaveDraft = async () => {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/papers/${paper.id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({
          status: 'DRAFT',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save paper');
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Error saving paper');
    } finally {
      setSaving(false);
    }
  };

  // Section actions
  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;

    try {
      const res = await fetch(`/api/papers/${paper.id}/sections`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          name: newSectionName.trim(),
          instructions: newSectionInstructions.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add section');
      }

      setNewSectionName('');
      setNewSectionInstructions('');
      setAddingSection(false);
      await loadPaper();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateSection = async (sectionId: string) => {
    if (!editingSectionName.trim()) return;

    try {
      const res = await fetch(`/api/papers/${paper.id}/sections/${sectionId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({
          name: editingSectionName.trim(),
          instructions: editingSectionInstructions.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update section');
      }

      setEditingSectionId(null);
      await loadPaper();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm('Are you sure you want to delete this section and all questions inside it?')) return;

    try {
      const res = await fetch(`/api/papers/${paper.id}/sections/${sectionId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete section');
      }

      await loadPaper();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Question actions
  const handleAddManualQuestion = async (sectionId: string) => {
    if (!manualQuestionText.trim()) return;

    try {
      const res = await fetch(`/api/papers/${paper.id}/questions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          sectionId,
          questionText: manualQuestionText.trim(),
          marks: manualMarks,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add question');
      }

      setManualQuestionText('');
      setManualMarks(1);
      setAddingManualToSectionId(null);
      await loadPaper();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleOpenEditQuestion = (q: PaperQuestion) => {
    setEditingQuestion(q);
    setEditQuestionText(q.questionText);
    setEditQuestionMarks(q.marks);
    setEditQuestionSectionId(q.sectionId);
  };

  const handleSaveEditedQuestion = async () => {
    if (!editingQuestion || !editQuestionText.trim()) return;

    try {
      const res = await fetch(`/api/papers/${paper.id}/questions/${editingQuestion.id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({
          questionText: editQuestionText.trim(),
          marks: editQuestionMarks,
          sectionId: editQuestionSectionId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update question');
      }

      setEditingQuestion(null);
      await loadPaper();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Remove this question from the paper?')) return;

    try {
      const res = await fetch(`/api/papers/${paper.id}/questions/${questionId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove question');
      }

      await loadPaper();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteChoiceGroup = async (choiceGroupId: string) => {
    if (!confirm('Remove this internal choice group and its paired questions?')) return;

    try {
      const res = await fetch(`/api/papers/${paper.id}/choice-groups/${choiceGroupId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete choice group');
      }

      await loadPaper();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleMoveQuestion = async (section: PaperSection, index: number, direction: 'up' | 'down') => {
    const secQuestions = [...(section.questions || [])];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= secQuestions.length) return;

    // Swap elements
    const temp = secQuestions[index];
    secQuestions[index] = secQuestions[targetIndex];
    secQuestions[targetIndex] = temp;

    const questionIds = secQuestions.map((q) => q.id);

    try {
      const res = await fetch(`/api/papers/${paper.id}/reorder-questions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          sectionId: section.id,
          questionIds,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reorder questions');
      }

      await loadPaper();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="inline-flex items-center space-x-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Papers</span>
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-slate-900">{paper.examinationName}</h1>
              <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200 uppercase">
                {paper.status}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {paper.class?.name} &bull; {paper.subject?.name} &bull; {paper.schoolName || 'School Assessment'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {saveSuccess && (
            <span className="inline-flex items-center space-x-1 text-xs text-emerald-700 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              <span>Draft Saved</span>
            </span>
          )}

          <button
            onClick={() => setIsStructureModalOpen(true)}
            className="inline-flex items-center space-x-1.5 rounded-md border border-neutral-300 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 transition-colors shadow-2xs"
            title="Edit Parts and Questions Structure"
          >
            <Layers className="h-3.5 w-3.5 text-blue-600" />
            <span>Edit Structure</span>
          </button>

          <button
            onClick={() => setIsBookReaderOpen(true)}
            className="inline-flex items-center space-x-1.5 rounded-md border border-neutral-300 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 transition-colors shadow-2xs"
            title="Open digital textbook to select and add questions manually"
          >
            <BookOpen className="h-3.5 w-3.5 text-neutral-700" />
            <span>Manual Selection (Book Reader)</span>
          </button>

          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className="inline-flex items-center space-x-1.5 rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? 'Saving...' : 'Save Draft'}</span>
          </button>

          <button
            onClick={() => setIsPreviewOpen(true)}
            className="inline-flex items-center space-x-1.5 rounded-md bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors shadow-xs"
            title="Review full paper and generate final print-ready PDF"
          >
            <FileCheck className="h-3.5 w-3.5" />
            <span>Review &amp; PDF Preview</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-xs text-red-700 border border-red-200 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-bold">
            &times;
          </button>
        </div>
      )}

      {/* Metadata & Marks Validation Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Class &amp; Subject</span>
              <span className="font-semibold text-slate-800 truncate block">
                {paper.class?.name} &bull; {paper.subject?.name}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Exam Date</span>
              <span className="font-semibold text-slate-800 block">{paper.date || 'Not set'}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Duration</span>
              <span className="font-semibold text-slate-800 block">{paper.duration || '3 Hours'}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Parts Count</span>
              <span className="font-semibold text-slate-800 block">{sections.length} Parts</span>
            </div>
          </div>
        </div>

        {/* Total Marks Banner */}
        <div
          className={`rounded-xl border p-4 flex flex-col justify-between shadow-xs ${
            marksMismatch
              ? 'border-amber-300 bg-amber-50/70 text-amber-900'
              : 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Total Paper Marks</span>
              {marksMismatch ? (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              )}
            </div>
            <div className="mt-1.5 flex items-baseline space-x-1">
              <span className="text-2xl font-black">{actualTotalMarks}</span>
              <span className="text-xs text-slate-500 font-medium">/ {paper.totalMarks} marks</span>
            </div>
          </div>

          {marksMismatch ? (
            <p className="mt-2 text-[11px] font-medium text-amber-800 leading-tight">
              &bull; Marks mismatch: Questions sum to {actualTotalMarks} marks, but target total is {paper.totalMarks} marks.
            </p>
          ) : (
            <p className="mt-2 text-[11px] font-medium text-emerald-800">
              &bull; Perfect match with configured total marks.
            </p>
          )}
        </div>
      </div>

      {/* Validation Issues Alert Banner */}
      {validationResult && !validationResult.isValid && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-xs text-red-900 shadow-xs space-y-2.5">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <h4 className="font-bold text-sm text-red-900">
              {validationResult.errors.length} Paper Validation Issue{validationResult.errors.length > 1 ? 's' : ''} Detected
            </h4>
          </div>
          <div className="rounded-lg bg-white/90 border border-red-200 p-3 divide-y divide-red-100">
            {validationResult.errors.map((err) => (
              <div key={err.id} className="py-1 first:pt-0 last:pb-0 flex items-start space-x-2 text-xs">
                <span className="text-red-600 font-bold">&bull;</span>
                <span className="text-red-800 font-medium">{err.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sections List */}
      <div className="space-y-6">
        {sections.map((section, secIdx) => {
          // Calculate section subtotal and structure details
          const secQuestions = section.questions || [];
          const secChoiceGroups = section.choiceGroups || [];
          const provided = Number(section.questionsProvided || section.targetQuestions || secQuestions.length || 0);
          const toAnswer = Number(section.questionsToAnswer || section.targetQuestions || provided || 0);
          const marksPerQ = Number(section.marksPerQuestion) || 1;
          const sectionPlannedMarks = toAnswer > 0 ? toAnswer * marksPerQ : 0;
          const startQ = sectionStartNumberMap[section.id] || 1;
          const endQ = sectionEndNumberMap[section.id] || startQ;
          const compulsoryNums = section.compulsoryQuestions
            ? section.compulsoryQuestions
                .split(',')
                .map((s) => parseInt(s.trim(), 10))
                .filter((n) => !isNaN(n))
            : [];

          const seenInSec = new Set<string>();
          let sectionMarksSum = 0;

          for (const q of secQuestions) {
            if (q.choiceGroupId) {
              if (!seenInSec.has(q.choiceGroupId)) {
                seenInSec.add(q.choiceGroupId);
                sectionMarksSum += q.marks;
              }
            } else {
              sectionMarksSum += q.marks;
            }
          }

          // Build ordered list of items (either standalone Question or ChoiceGroup)
          const processedChoiceGroups = new Set<string>();
          const renderedItems: Array<
            | { type: 'question'; data: PaperQuestion }
            | { type: 'choiceGroup'; group: ChoiceGroup; questions: PaperQuestion[] }
          > = [];

          for (const q of secQuestions) {
            if (q.choiceGroupId) {
              if (!processedChoiceGroups.has(q.choiceGroupId)) {
                processedChoiceGroups.add(q.choiceGroupId);
                const group = secChoiceGroups.find((g) => g.id === q.choiceGroupId) || {
                  id: q.choiceGroupId,
                  paperId: paper.id,
                  sectionId: section.id,
                  position: q.position,
                  label: 'Answer either Option A OR Option B:',
                  marks: q.marks,
                  createdAt: '',
                  updatedAt: '',
                };
                const groupQuestions = secQuestions.filter((item) => item.choiceGroupId === q.choiceGroupId);
                renderedItems.push({
                  type: 'choiceGroup',
                  group,
                  questions: groupQuestions,
                });
              }
            } else {
              renderedItems.push({ type: 'question', data: q });
            }
          }

          return (
            <div
              key={section.id}
              className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden"
            >
              {/* Part Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 bg-slate-50 px-5 py-3 gap-2">
                <div className="flex items-center space-x-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                    {String.fromCharCode(65 + secIdx)}
                  </span>
                  <div>
                    {editingSectionId === section.id ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={editingSectionName}
                          onChange={(e) => setEditingSectionName(e.target.value)}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold"
                        />
                        <button
                          onClick={() => handleUpdateSection(section.id)}
                          className="rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingSectionId(null)}
                          className="text-[11px] text-slate-500 hover:text-slate-800"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-bold text-slate-900">{section.name}</h2>
                        <span className="text-xs text-slate-600 font-semibold font-exam">
                          (Q.{startQ} – Q.{endQ})
                        </span>
                        {compulsoryNums.length > 0 && (
                          <span className="rounded bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 text-[10px] font-bold">
                            Compulsory: Q.{compulsoryNums.join(', ')}
                          </span>
                        )}
                        <button
                          onClick={() => {
                            setEditingSectionId(section.id);
                            setEditingSectionName(section.name);
                            setEditingSectionInstructions(section.instructions || '');
                          }}
                          className="rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
                          title="Rename Part"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    {section.instructions && (
                      <p className="text-xs italic text-slate-600 font-exam mt-0.5">{section.instructions}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <span className="rounded-md bg-white border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-xs">
                    {toAnswer > 0 ? (
                      <span>
                        {toAnswer} &times; {marksPerQ} = {sectionPlannedMarks} marks ({secQuestions.length}/{provided} questions)
                      </span>
                    ) : (
                      <span>Subtotal: {sectionMarksSum} marks</span>
                    )}
                  </span>
                  {sections.length > 1 && (
                    <button
                      onClick={() => handleDeleteSection(section.id)}
                      className="rounded p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete this Part"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Questions within Part */}
              <div className="p-5 space-y-4">
                {renderedItems.length === 0 && provided === 0 && (
                  <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                    No questions in this Part yet. Add a question or extract one from your curriculum resources.
                  </div>
                )}
                {renderedItems.map((item, itemIdx) => {
                  if (item.type === 'question') {
                    const q = item.data;
                    const qNumber = questionNumberMap[q.id] || itemIdx + 1;
                    const hasOriginal = !!q.originalSourceText && q.originalSourceText !== q.questionText;
                    const isCompulsory = q.isCompulsory || compulsoryNums.includes(qNumber);

                    return (
                      <div
                        key={q.id}
                        className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs hover:border-slate-300 transition-colors space-y-2.5 font-exam"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start space-x-2.5 flex-1">
                            <div className="flex items-center space-x-1.5 shrink-0">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-800 font-exam">
                                {qNumber}
                              </span>
                              {isCompulsory && (
                                <span className="rounded bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider font-exam">
                                  [Compulsory]
                                </span>
                              )}
                            </div>
                            <div className="space-y-1.5 flex-1">
                              {q.visualAssetUrl && (
                                <div className="my-1 max-w-full overflow-hidden">
                                  <img
                                    src={q.visualAssetUrl}
                                    alt="Visual Question"
                                    className="max-w-full h-auto max-h-[340px] object-contain rounded border border-slate-200 bg-white"
                                    style={{ imageRendering: '-webkit-optimize-contrast' as any }}
                                  />
                                </div>
                              )}
                              {q.questionText && q.questionText !== '[Visual Question]' && (
                                <p className="text-sm font-exam font-normal text-slate-900 leading-relaxed whitespace-pre-wrap">
                                  {q.questionText}
                                </p>
                              )}

                              {/* Source Traceability Tag */}
                              {q.sourceResourceId && (
                                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-sans text-slate-500">
                                  <span className="inline-flex items-center space-x-1 rounded bg-blue-50 px-2 py-0.5 text-blue-700 font-medium">
                                    <BookOpen className="h-3 w-3" />
                                    <span>
                                      Source: {q.sourceResource?.name || 'Textbook'}
                                      {q.sourcePageNumber ? ` (Pg ${q.sourcePageNumber})` : ''}
                                      {q.sourceQuestionNumber ? ` [${q.sourceQuestionNumber}]` : ''}
                                    </span>
                                  </span>

                                  {hasOriginal && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setShowOriginalSource((prev) => ({
                                          ...prev,
                                          [q.id]: !prev[q.id],
                                        }))
                                      }
                                      className="inline-flex items-center space-x-1 text-[10px] text-slate-400 hover:text-slate-600 underline"
                                    >
                                      <Eye className="h-3 w-3" />
                                      <span>
                                        {showOriginalSource[q.id] ? 'Hide Original Source' : 'View Original Source'}
                                      </span>
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Collapsible original source text */}
                              {showOriginalSource[q.id] && q.originalSourceText && (
                                <div className="mt-1 rounded-md bg-slate-50 p-2 text-[11px] font-sans text-slate-600 border border-slate-200">
                                  <span className="font-semibold text-slate-700 block mb-0.5">
                                    Original Source Excerpt (Immutable):
                                  </span>
                                  <p className="whitespace-pre-wrap leading-relaxed font-exam">
                                    {q.originalSourceText}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Marks & Controls */}
                          <div className="flex items-center space-x-1.5 shrink-0 font-sans">
                            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700 font-exam">
                              [{q.marks}]
                            </span>

                            {/* Move Up / Down */}
                            <button
                              disabled={itemIdx === 0}
                              onClick={() => handleMoveQuestion(section, itemIdx, 'up')}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20"
                              title="Move up"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button
                              disabled={itemIdx === renderedItems.length - 1}
                              onClick={() => handleMoveQuestion(section, itemIdx, 'down')}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20"
                              title="Move down"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>

                            {/* Edit Question */}
                            <button
                              onClick={() => handleOpenEditQuestion(q)}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                              title="Edit question text / marks / move Part"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>

                            {/* Delete Question */}
                            <button
                              onClick={() => handleDeleteQuestion(q.id)}
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              title="Remove question"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    // ChoiceGroup block
                    const group = item.group;
                    const qList = item.questions;
                    const qNumber = choiceGroupNumberMap[group.id] || itemIdx + 1;
                    const isGroupCompulsory = compulsoryNums.includes(qNumber);

                    return (
                      <div
                        key={group.id}
                        className="rounded-lg border-2 border-indigo-200/80 bg-indigo-50/20 p-4 shadow-2xs space-y-3 font-exam"
                      >
                        <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                          <div className="flex items-center space-x-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-700 text-[11px] font-bold text-white font-exam">
                              {qNumber}
                            </span>
                            {isGroupCompulsory && (
                              <span className="rounded bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider font-exam">
                                [Compulsory]
                              </span>
                            )}
                            <span className="text-xs font-semibold text-indigo-900 font-exam">
                              {group.label || 'Answer either Option A OR Option B:'}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 font-sans">
                            <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-800 font-exam">
                              [{group.marks || qList[0]?.marks || 5}]
                            </span>
                            <button
                              onClick={() => handleDeleteChoiceGroup(group.id)}
                              className="rounded p-1 text-slate-400 hover:text-red-600"
                              title="Remove choice group"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {qList.map((q, optIdx) => (
                              <div
                                key={q.id}
                                className="rounded-md border border-slate-200 bg-white p-3 space-y-2"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-indigo-700">
                                    Option {q.choiceOption || (optIdx === 0 ? 'A' : 'B')}
                                  </span>
                                  <button
                                    onClick={() => handleOpenEditQuestion(q)}
                                    className="text-slate-400 hover:text-blue-600"
                                    title="Edit option"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </button>
                                </div>
                                <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                                  {q.questionText}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                  })}

                {/* Unfilled Question Slots for this Part based on questionsProvided */}
                {provided > secQuestions.length && (
                  <div className="space-y-2 pt-1 font-exam">
                    {Array.from({ length: provided - secQuestions.length }).map((_, slotIdx) => {
                      const slotQNum = startQ + secQuestions.length + slotIdx;
                      const isSlotCompulsory = compulsoryNums.includes(slotQNum);

                      return (
                        <div
                          key={`empty-slot-${section.id}-${slotIdx}`}
                          onClick={() => {
                            setActiveSectionId(section.id);
                            setIsBookReaderOpen(true);
                          }}
                          className="group flex items-center justify-between gap-3 p-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 hover:bg-blue-50/40 hover:border-blue-400 cursor-pointer transition-all font-exam"
                          title="Click to select question from Book (PDF) for this slot"
                        >
                          <div className="flex items-center space-x-2.5">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200/80 text-[11px] font-bold text-slate-500 font-exam">
                              {slotQNum}
                            </span>
                            {isSlotCompulsory && (
                              <span className="rounded bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider font-exam">
                                [Compulsory]
                              </span>
                            )}
                            <span className="text-xs text-slate-500 group-hover:text-blue-700 font-sans">
                              [ Empty Question Slot &bull; Click to select from Textbook ]
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-slate-400 font-exam">
                            [{marksPerQ}]
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Inline Manual Question Quick Adder */}
                {addingManualToSectionId === section.id && (
                  <div className="rounded-lg border border-slate-300 bg-slate-50/70 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800">Add Manual Question</span>
                      <button
                        onClick={() => setAddingManualToSectionId(null)}
                        className="text-xs text-slate-400 hover:text-slate-600"
                      >
                        Cancel
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={manualQuestionText}
                      onChange={(e) => setManualQuestionText(e.target.value)}
                      placeholder="Type the full examination question text here..."
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <label className="text-xs font-medium text-slate-700">Marks:</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={manualMarks}
                          onChange={(e) => setManualMarks(Math.max(0, parseInt(e.target.value, 10) || 0))}
                          className="w-16 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-900"
                        />
                      </div>
                      <button
                        onClick={() => handleAddManualQuestion(section.id)}
                        disabled={!manualQuestionText.trim()}
                        className="rounded-md bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        Add to Part
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Buttons within Part */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setAddingManualToSectionId(section.id);
                      setManualQuestionText('');
                      setManualMarks(1);
                    }}
                    className="inline-flex items-center space-x-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                  >
                    <Plus className="h-3.5 w-3.5 text-slate-500" />
                    <span>Add Manual Question</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveSectionId(section.id);
                      setIsBookReaderOpen(true);
                    }}
                    className="inline-flex items-center space-x-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 transition-colors shadow-2xs"
                  >
                    <BookOpen className="h-3.5 w-3.5 text-neutral-700" />
                    <span>Select from Book (PDF)</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveSectionId(section.id);
                      setIsChoiceModalOpen(true);
                    }}
                    className="inline-flex items-center space-x-1.5 rounded-md border border-indigo-200 bg-indigo-50/80 px-3 py-1.5 text-xs font-medium text-indigo-800 hover:bg-indigo-100 transition-colors shadow-2xs"
                  >
                    <GitFork className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Add Internal Choice (A/B)</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Add New Part Block */}
        {addingSection ? (
          <form
            onSubmit={handleAddSection}
            className="rounded-xl border border-slate-300 bg-slate-50 p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-900">Create New Paper Part</h3>
              <button
                type="button"
                onClick={() => setAddingSection(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Cancel
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Part Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  placeholder="e.g. Part B: Short Answer Questions"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Instructions (Optional)
                </label>
                <input
                  type="text"
                  value={newSectionInstructions}
                  onChange={(e) => setNewSectionInstructions(e.target.value)}
                  placeholder="e.g. Answer any 4 questions out of 6"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setAddingSection(false)}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newSectionName.trim()}
                className="rounded-md bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Create Part
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setAddingSection(true)}
              className="inline-flex items-center space-x-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Plus className="h-4 w-4 text-slate-500" />
              <span>Add New Part</span>
            </button>

            <button
              onClick={handleSaveDraft}
              disabled={saving}
              className="inline-flex items-center space-x-1.5 rounded-md bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Saving Draft...' : 'Save Draft Paper'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Edit Question Modal */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-semibold text-slate-900">Edit Question</h3>
              <button
                onClick={() => setEditingQuestion(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                &times;
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Question Text <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={editQuestionText}
                  onChange={(e) => setEditQuestionText(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                />
                {editingQuestion.originalSourceText && (
                  <p className="mt-1 text-[11px] text-slate-400">
                    Note: Editing this question does not overwrite the original source excerpt.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Allocated Marks
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editQuestionMarks}
                    onChange={(e) => setEditQuestionMarks(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Move to Part
                  </label>
                  <select
                    value={editQuestionSectionId}
                    onChange={(e) => setEditQuestionSectionId(e.target.value)}
                    className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-900"
                  >
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingQuestion(null)}
                  className="rounded-md border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditedQuestion}
                  disabled={!editQuestionText.trim()}
                  className="rounded-md bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Book Reader View for digital textbook manual selection */}
      {isBookReaderOpen && (
        <BookReaderView
          paperId={paper.id}
          classId={paper.classId}
          subjectId={paper.subjectId}
          onClose={() => {
            setIsBookReaderOpen(false);
            loadPaper();
          }}
          onFinish={() => {
            setIsBookReaderOpen(false);
            loadPaper();
          }}
          onPaperUpdated={() => loadPaper()}
        />
      )}

      {/* Resource Question Picker Modal (Legacy fallback) */}
      {isResourcePickerOpen && (
        <ResourceQuestionPickerModal
          isOpen={true}
          onClose={() => setIsResourcePickerOpen(false)}
          paperId={paper.id}
          classId={paper.classId}
          subjectId={paper.subjectId}
          sections={sections}
          activeSectionId={activeSectionId}
          onQuestionAdded={loadPaper}
        />
      )}

      {/* Internal Choice Modal */}
      {isChoiceModalOpen && (
        <InternalChoiceModal
          isOpen={true}
          onClose={() => setIsChoiceModalOpen(false)}
          paperId={paper.id}
          sections={sections}
          activeSectionId={activeSectionId}
          onChoiceGroupCreated={loadPaper}
        />
      )}

      {/* Edit Paper Structure Modal */}
      {isStructureModalOpen && paper && (
        <EditPaperStructureModal
          isOpen={isStructureModalOpen}
          paper={paper}
          onClose={() => setIsStructureModalOpen(false)}
          onSaved={(updatedPaper) => {
            setPaper(updatedPaper);
            loadPaper();
          }}
        />
      )}
    </div>
  );
};
