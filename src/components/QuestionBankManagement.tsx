import React, { useState, useEffect } from 'react';
import {
  Database,
  Search,
  Plus,
  Filter,
  Trash2,
  Edit2,
  Copy,
  Archive,
  RotateCcw,
  Eye,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  BookOpen,
  School,
  X,
  Layers,
  ArrowUpDown,
  Download,
  UploadCloud,
  FileText,
} from 'lucide-react';
import { BankQuestion, SchoolClass, SchoolSubject, SchoolPaper } from '../types';

interface QuestionBankProps {
  onNavigateToClasses?: () => void;
  onNavigateToSubjects?: () => void;
}

export const QuestionBankManagement: React.FC<QuestionBankProps> = ({
  onNavigateToClasses,
  onNavigateToSubjects,
}) => {
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [papers, setPapers] = useState<SchoolPaper[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [selectedSubjectId, setSelectedSubjectId] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedDifficulty, setSelectedDifficulty] = useState('ALL');
  const [minMarks, setMinMarks] = useState('');
  const [maxMarks, setMaxMarks] = useState('');
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewArchived, setViewArchived] = useState(false);

  // Status message
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Partial<BankQuestion> | null>(null);
  const [savingQuestion, setSavingQuestion] = useState(false);

  const [previewQuestion, setPreviewQuestion] = useState<BankQuestion | null>(null);

  const [deleteWarningModal, setDeleteWarningModal] = useState<{
    question: BankQuestion;
    warningText?: string;
  } | null>(null);

  const [importPaperModalOpen, setImportPaperModalOpen] = useState(false);
  const [importPaperId, setImportPaperId] = useState('');
  const [importing, setImporting] = useState(false);

  // Fetch Questions
  const loadQuestions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (selectedClassId !== 'ALL') params.set('classId', selectedClassId);
      if (selectedSubjectId !== 'ALL') params.set('subjectId', selectedSubjectId);
      if (selectedType !== 'ALL') params.set('questionType', selectedType);
      if (selectedDifficulty !== 'ALL') params.set('difficulty', selectedDifficulty);
      if (minMarks) params.set('minMarks', minMarks);
      if (maxMarks) params.set('maxMarks', maxMarks);
      params.set('isArchived', String(viewArchived));
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);

      const res = await fetch(`/api/question-bank?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions || []);
      }
    } catch (err) {
      console.error('Failed to load questions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Classes, Subjects, and Papers for filter dropdowns & import
  const loadContextData = async () => {
    try {
      const [classRes, subRes, papersRes] = await Promise.all([
        fetch('/api/classes'),
        fetch('/api/subjects'),
        fetch('/api/papers'),
      ]);

      if (classRes.ok) {
        const cData = await classRes.json();
        setClasses(cData.classes || []);
      }
      if (subRes.ok) {
        const sData = await subRes.json();
        setSubjects(sData.subjects || []);
      }
      if (papersRes.ok) {
        const pData = await papersRes.json();
        setPapers(pData.papers || []);
      }
    } catch (err) {
      console.error('Failed to load classes/subjects:', err);
    }
  };

  useEffect(() => {
    loadContextData();
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [
    search,
    selectedClassId,
    selectedSubjectId,
    selectedType,
    selectedDifficulty,
    minMarks,
    maxMarks,
    sortBy,
    sortOrder,
    viewArchived,
  ]);

  const handleClearFilters = () => {
    setSearch('');
    setSelectedClassId('ALL');
    setSelectedSubjectId('ALL');
    setSelectedType('ALL');
    setSelectedDifficulty('ALL');
    setMinMarks('');
    setMaxMarks('');
    setSortBy('updatedAt');
    setSortOrder('desc');
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion || !editingQuestion.questionText?.trim()) return;

    setSavingQuestion(true);
    setStatusMessage(null);

    try {
      const isEditing = Boolean(editingQuestion.id);
      const url = isEditing
        ? `/api/question-bank/${editingQuestion.id}`
        : '/api/question-bank';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: editingQuestion.questionText.trim(),
          marks: Number(editingQuestion.marks) || 1,
          questionType: editingQuestion.questionType || 'SUBJECTIVE',
          difficulty: editingQuestion.difficulty || 'MEDIUM',
          classId: editingQuestion.classId || null,
          subjectId: editingQuestion.subjectId || null,
          chapter: editingQuestion.chapter || null,
          topic: editingQuestion.topic || null,
          visualAssetUrl: editingQuestion.visualAssetUrl || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save question.');
      }

      setStatusMessage({
        type: 'success',
        text: isEditing ? 'Question updated successfully!' : 'Question added to Question Bank!',
      });
      setEditorModalOpen(false);
      setEditingQuestion(null);
      loadQuestions();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Save failed.' });
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleDuplicate = async (questionId: string) => {
    try {
      const res = await fetch(`/api/question-bank/${questionId}/duplicate`, {
        method: 'POST',
      });
      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Question duplicated successfully.' });
        loadQuestions();
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to duplicate question.' });
    }
  };

  const handleToggleArchive = async (questionId: string) => {
    try {
      const res = await fetch(`/api/question-bank/${questionId}/archive`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage({ type: 'success', text: data.message || 'Archive state updated.' });
        loadQuestions();
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to update archive state.' });
    }
  };

  const handleDeleteClick = async (question: BankQuestion) => {
    try {
      const res = await fetch(`/api/question-bank/${question.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (res.status === 409) {
        // In use warning
        setDeleteWarningModal({
          question,
          warningText: data.warning,
        });
        return;
      }

      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Question removed from bank.' });
        loadQuestions();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Delete failed.' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to delete question.' });
    }
  };

  const handleForceDelete = async () => {
    if (!deleteWarningModal) return;
    try {
      const res = await fetch(`/api/question-bank/${deleteWarningModal.question.id}?force=true`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Question permanently deleted.' });
        setDeleteWarningModal(null);
        loadQuestions();
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to delete.' });
    }
  };

  const handleImportFromPaper = async () => {
    if (!importPaperId) return;
    setImporting(true);
    try {
      const res = await fetch(`/api/question-bank/import-from-paper/${importPaperId}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage({ type: 'success', text: data.message });
        setImportPaperModalOpen(false);
        setImportPaperId('');
        loadQuestions();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Import failed.' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to import questions from paper.' });
    } finally {
      setImporting(false);
    }
  };

  const filteredSubjects =
    editingQuestion && editingQuestion.classId
      ? subjects.filter((s) => s.classId === editingQuestion.classId)
      : subjects;

  return (
    <div id="question-bank-container" className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-white p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Question Bank Management
              </h1>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
                {questions.length} {viewArchived ? 'Archived' : 'Active'} Questions
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Curate, filter, edit, categorize, and reuse questions across multiple examination papers.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            id="import-from-paper-btn"
            onClick={() => setImportPaperModalOpen(true)}
            className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
          >
            <UploadCloud className="h-4 w-4 text-slate-500" />
            <span>Import from Paper...</span>
          </button>

          <button
            type="button"
            id="add-new-question-btn"
            onClick={() => {
              setEditingQuestion({
                questionText: '',
                marks: 2,
                questionType: 'SHORT',
                difficulty: 'MEDIUM',
                classId: classes[0]?.id || '',
                subjectId: subjects[0]?.id || '',
              });
              setEditorModalOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 shadow-xs transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Question</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {statusMessage && (
        <div
          className={`flex items-center justify-between rounded-lg p-4 text-xs font-medium border shadow-xs ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)}>
            <X className="h-4 w-4 opacity-70 hover:opacity-100" />
          </button>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="rounded-xl bg-white p-5 border border-slate-200 shadow-xs space-y-4">
        {/* Top filter row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search Input */}
          <div className="relative sm:col-span-2 lg:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              id="search-question-bank-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search question text, chapter, topic..."
              className="w-full rounded-lg border border-slate-200 pl-9 pr-4 py-2 text-xs text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
            />
          </div>

          {/* Class Filter */}
          <div>
            <select
              id="filter-class-select"
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setSelectedSubjectId('ALL');
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-slate-900 outline-none"
            >
              <option value="ALL">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subject Filter */}
          <div>
            <select
              id="filter-subject-select"
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-slate-900 outline-none"
            >
              <option value="ALL">All Subjects</option>
              {(selectedClassId !== 'ALL'
                ? subjects.filter((s) => s.classId === selectedClassId)
                : subjects
              ).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Question Type */}
          <div>
            <select
              id="filter-type-select"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-slate-900 outline-none"
            >
              <option value="ALL">All Question Types</option>
              <option value="MCQ">Multiple Choice (MCQ)</option>
              <option value="SHORT">Short Answer</option>
              <option value="LONG">Long Answer</option>
              <option value="NUMERICAL">Numerical / Problem</option>
              <option value="CASE_STUDY">Case Study / Passage</option>
              <option value="SUBJECTIVE">Subjective</option>
            </select>
          </div>
        </div>

        {/* Second filter row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Difficulty Filter */}
            <div className="flex items-center space-x-1">
              <span className="text-slate-500 text-[11px] font-medium">Difficulty:</span>
              <select
                id="filter-difficulty-select"
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none"
              >
                <option value="ALL">All</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>

            {/* Marks Filter */}
            <div className="flex items-center space-x-1">
              <span className="text-slate-500 text-[11px] font-medium">Marks:</span>
              <input
                type="number"
                placeholder="Min"
                value={minMarks}
                onChange={(e) => setMinMarks(e.target.value)}
                className="w-14 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none"
              />
              <span className="text-slate-400">-</span>
              <input
                type="number"
                placeholder="Max"
                value={maxMarks}
                onChange={(e) => setMaxMarks(e.target.value)}
                className="w-14 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none"
              />
            </div>

            {/* Sort order */}
            <div className="flex items-center space-x-1">
              <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
              <select
                id="sort-by-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none"
              >
                <option value="updatedAt">Recently Modified</option>
                <option value="createdAt">Date Created</option>
                <option value="marks">Marks</option>
                <option value="questionText">Alphabetical</option>
              </select>
              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
              >
                {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Active vs Archived Toggle */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
              <button
                type="button"
                id="view-active-tab-btn"
                onClick={() => setViewArchived(false)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  !viewArchived
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Active Bank
              </button>
              <button
                type="button"
                id="view-archived-tab-btn"
                onClick={() => setViewArchived(true)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  viewArchived
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Archived
              </button>
            </div>

            <button
              type="button"
              id="clear-filters-btn"
              onClick={handleClearFilters}
              className="text-xs text-slate-500 hover:text-slate-900 underline underline-offset-2"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Questions List */}
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl bg-white border border-slate-200">
          <div className="flex items-center space-x-2 text-slate-500 text-xs">
            <RefreshCw className="h-4 w-4 animate-spin text-slate-700" />
            <span>Loading question bank repository...</span>
          </div>
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Database className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            {viewArchived ? 'No archived questions found' : 'No questions matching your criteria'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {viewArchived
              ? 'Questions archived from the bank will appear here and can be restored at any time.'
              : 'Create a new question, adjust your filter parameters, or import existing questions from drafted papers.'}
          </p>
          {!viewArchived && (
            <button
              type="button"
              onClick={() => {
                setEditingQuestion({
                  questionText: '',
                  marks: 2,
                  questionType: 'SHORT',
                  difficulty: 'MEDIUM',
                });
                setEditorModalOpen(true);
              }}
              className="inline-flex items-center space-x-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              <span>Add First Question</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {questions.map((q, idx) => (
            <div
              key={q.id}
              className="rounded-xl bg-white p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1 space-y-1.5">
                  {/* Metadata tags */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="font-semibold text-slate-500">#{idx + 1}</span>
                    {q.class && (
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                        {q.class.name}
                      </span>
                    )}
                    {q.subject && (
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                        {q.subject.name}
                      </span>
                    )}
                    <span className="rounded bg-slate-900 px-2 py-0.5 font-semibold text-white">
                      {q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 font-semibold ${
                        q.difficulty === 'EASY'
                          ? 'bg-emerald-100 text-emerald-800'
                          : q.difficulty === 'HARD'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {q.difficulty}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600 font-medium">
                      {q.questionType}
                    </span>
                    {q.chapter && (
                      <span className="text-slate-500 text-[11px]">
                        &bull; Ch: {q.chapter}
                      </span>
                    )}
                  </div>

                  {/* Question Text */}
                  <p className="text-xs text-slate-900 leading-relaxed font-serif whitespace-pre-wrap">
                    {q.questionText}
                  </p>

                  {/* Visual Crop Image Preview if attached */}
                  {q.visualAssetUrl && (
                    <div className="mt-2 inline-block rounded border border-slate-200 p-1 bg-slate-50">
                      <img
                        src={q.visualAssetUrl}
                        alt="Question diagram"
                        referrerPolicy="no-referrer"
                        className="max-h-24 max-w-xs object-contain"
                      />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-1.5 shrink-0 self-end sm:self-start">
                  <button
                    type="button"
                    onClick={() => setPreviewQuestion(q)}
                    className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                    title="Preview Question Details"
                  >
                    <Eye className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingQuestion(q);
                      setEditorModalOpen(true);
                    }}
                    className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                    title="Edit Question"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDuplicate(q.id)}
                    className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                    title="Duplicate Question"
                  >
                    <Copy className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleArchive(q.id)}
                    className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                    title={q.isArchived ? 'Restore from Archive' : 'Archive Question'}
                  >
                    {q.isArchived ? (
                      <RotateCcw className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Archive className="h-4 w-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteClick(q)}
                    className="p-1.5 rounded text-red-500 hover:text-red-700 hover:bg-red-50"
                    title="Delete Question"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal 1: Add/Edit Question */}
      {editorModalOpen && editingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                {editingQuestion.id ? 'Edit Bank Question' : 'Add New Bank Question'}
              </h3>
              <button
                onClick={() => {
                  setEditorModalOpen(false);
                  setEditingQuestion(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  Question Content / Prompt <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={editingQuestion.questionText || ''}
                  onChange={(e) =>
                    setEditingQuestion({ ...editingQuestion, questionText: e.target.value })
                  }
                  placeholder="Enter complete question text, instructions, and choices..."
                  className="w-full rounded-lg border border-slate-300 p-3 text-xs text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none font-serif leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Marks</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={editingQuestion.marks || 1}
                    onChange={(e) =>
                      setEditingQuestion({
                        ...editingQuestion,
                        marks: Number(e.target.value) || 1,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-slate-900 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Question Type</label>
                  <select
                    value={editingQuestion.questionType || 'SUBJECTIVE'}
                    onChange={(e) =>
                      setEditingQuestion({
                        ...editingQuestion,
                        questionType: e.target.value as any,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-slate-900 outline-none"
                  >
                    <option value="MCQ">Multiple Choice (MCQ)</option>
                    <option value="SHORT">Short Answer</option>
                    <option value="LONG">Long Answer</option>
                    <option value="NUMERICAL">Numerical / Problem</option>
                    <option value="CASE_STUDY">Case Study / Passage</option>
                    <option value="SUBJECTIVE">Subjective</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Difficulty</label>
                  <select
                    value={editingQuestion.difficulty || 'MEDIUM'}
                    onChange={(e) =>
                      setEditingQuestion({
                        ...editingQuestion,
                        difficulty: e.target.value as any,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-slate-900 outline-none"
                  >
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Class</label>
                  <select
                    value={editingQuestion.classId || ''}
                    onChange={(e) =>
                      setEditingQuestion({
                        ...editingQuestion,
                        classId: e.target.value,
                        subjectId: '',
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-slate-900 outline-none"
                  >
                    <option value="">-- Generic / No Class --</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Subject</label>
                  <select
                    value={editingQuestion.subjectId || ''}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, subjectId: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-slate-900 outline-none"
                  >
                    <option value="">-- Generic / No Subject --</option>
                    {filteredSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Chapter / Unit (Optional)</label>
                  <input
                    type="text"
                    value={editingQuestion.chapter || ''}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, chapter: e.target.value })
                    }
                    placeholder="e.g. Chapter 4: Thermodynamics"
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-slate-900 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Topic / Tag (Optional)</label>
                  <input
                    type="text"
                    value={editingQuestion.topic || ''}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, topic: e.target.value })
                    }
                    placeholder="e.g. Heat Engines & Entropy"
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-slate-900 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setEditorModalOpen(false);
                    setEditingQuestion(null);
                  }}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingQuestion}
                  className="inline-flex items-center space-x-2 rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {savingQuestion && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{savingQuestion ? 'Saving...' : 'Save Question'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Preview Question */}
      {previewQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Eye className="h-4 w-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">Question Preview</h3>
              </div>
              <button
                onClick={() => setPreviewQuestion(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 space-y-3 font-serif">
              <div className="flex justify-between items-center text-xs font-sans font-bold text-slate-700">
                <span>
                  {previewQuestion.class?.name || 'Class N/A'} • {previewQuestion.subject?.name || 'Subject N/A'}
                </span>
                <span className="rounded bg-slate-900 px-2 py-0.5 text-white">
                  [{previewQuestion.marks} Marks]
                </span>
              </div>

              <p className="text-sm text-slate-900 leading-relaxed whitespace-pre-wrap">
                {previewQuestion.questionText}
              </p>

              {previewQuestion.visualAssetUrl && (
                <div className="mt-2 text-center">
                  <img
                    src={previewQuestion.visualAssetUrl}
                    alt="Diagram"
                    referrerPolicy="no-referrer"
                    className="max-h-48 mx-auto rounded border border-slate-200 shadow-2xs"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
              <div>
                <span className="font-semibold text-slate-700">Difficulty:</span> {previewQuestion.difficulty}
              </div>
              <div>
                <span className="font-semibold text-slate-700">Type:</span> {previewQuestion.questionType}
              </div>
              {previewQuestion.chapter && (
                <div className="col-span-2">
                  <span className="font-semibold text-slate-700">Chapter:</span> {previewQuestion.chapter}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setPreviewQuestion(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Delete Warning / Confirmation */}
      {deleteWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-amber-300 space-y-4">
            <div className="flex items-center space-x-3 text-amber-600">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900">Question Reference Warning</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {deleteWarningModal.warningText ||
                'This question is referenced by existing examination papers. Deleting it completely may impact historical records. Archiving is recommended instead.'}
            </p>

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteWarningModal(null)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleToggleArchive(deleteWarningModal.question.id);
                  setDeleteWarningModal(null);
                }}
                className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
              >
                Archive Question (Recommended)
              </button>
              <button
                type="button"
                onClick={handleForceDelete}
                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Import From Paper */}
      {importPaperModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <UploadCloud className="h-4 w-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">Import Questions from Paper</h3>
              </div>
              <button
                onClick={() => setImportPaperModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Select an existing examination paper. All its questions will be scanned and saved to your central Question Bank repository.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Select Examination Paper</label>
              <select
                id="select-import-paper"
                value={importPaperId}
                onChange={(e) => setImportPaperId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900 focus:border-slate-900 outline-none"
              >
                <option value="">-- Choose a Paper --</option>
                {papers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.examinationName} ({p.class?.name || 'Class'} - {p.subject?.name || 'Subject'} - {p.totalMarks} Marks)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setImportPaperModalOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!importPaperId || importing}
                onClick={handleImportFromPaper}
                className="inline-flex items-center space-x-2 rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {importing && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>{importing ? 'Importing...' : 'Import Questions'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
