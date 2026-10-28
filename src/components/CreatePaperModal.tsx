import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  School,
  BookOpen,
  Calendar,
  Clock,
  Award,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
  Hash,
} from 'lucide-react';
import { SchoolClass, SchoolSubject, SchoolPaper, PartConfig } from '../types';
export type { PartConfig };

interface CreatePaperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (paper: SchoolPaper) => void;
  classes: SchoolClass[];
  subjects: SchoolSubject[];
}

export const CreatePaperModal: React.FC<CreatePaperModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  classes,
  subjects,
}) => {
  // Step: 1 = Basic Paper Details, 2 = Paper Structure Setup
  const [step, setStep] = useState<'details' | 'structure'>('details');

  // Step 1: Basic Paper Details
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [examinationName, setExaminationName] = useState<string>('');
  const [schoolName, setSchoolName] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [duration, setDuration] = useState<string>('3 Hours');
  const [totalMarks, setTotalMarks] = useState<number>(80);

  // Step 2: Paper Structure (Predefined Parts)
  const [parts, setParts] = useState<PartConfig[]>([
    {
      name: 'Part A',
      questionsProvided: 10,
      questionsToAnswer: 10,
      targetQuestions: 10,
      marksPerQuestion: 1,
      hasInternalChoice: false,
      choiceCount: 0,
      instructions: 'Answer all the questions.',
      compulsoryQuestions: '',
    },
    {
      name: 'Part B',
      questionsProvided: 14,
      questionsToAnswer: 10,
      targetQuestions: 14,
      marksPerQuestion: 2,
      hasInternalChoice: false,
      choiceCount: 0,
      instructions: 'Answer any 10 questions. Question 17 is compulsory.',
      compulsoryQuestions: '17',
    },
    {
      name: 'Part C',
      questionsProvided: 5,
      questionsToAnswer: 5,
      targetQuestions: 5,
      marksPerQuestion: 5,
      hasInternalChoice: false,
      choiceCount: 0,
      instructions: 'Answer all the questions.',
      compulsoryQuestions: '',
    },
  ]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Filter subjects based on selected class
  const availableSubjects = selectedClassId
    ? subjects.filter((s) => s.classId === selectedClassId)
    : subjects;

  useEffect(() => {
    if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  useEffect(() => {
    // Load default school settings if not filled
    const fetchDefaults = async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          if (data.settings) {
            const s = data.settings;
            if (!schoolName && s.schoolName) setSchoolName(s.schoolName);
            if (!examinationName && s.defaultExamName) setExaminationName(s.defaultExamName);
            if (s.defaultDuration && duration === '3 Hours') setDuration(s.defaultDuration);
            if (s.defaultTotalMarks && totalMarks === 80) setTotalMarks(s.defaultTotalMarks);
            if (s.defaultClassId && !selectedClassId) setSelectedClassId(s.defaultClassId);
            if (s.defaultSubjectId && !selectedSubjectId) setSelectedSubjectId(s.defaultSubjectId);
          }
        }
      } catch (e) {
        // Silently fall back to standard defaults
      }
    };
    if (isOpen) {
      fetchDefaults();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedClassId) {
      const classSubjects = subjects.filter((s) => s.classId === selectedClassId);
      if (classSubjects.length > 0) {
        setSelectedSubjectId(classSubjects[0].id);
      } else {
        setSelectedSubjectId('');
      }
    }
  }, [selectedClassId, subjects]);

  // Calculate live continuous question ranges across parts
  let runningQNumber = 1;
  const partRanges = parts.map((p) => {
    const provided = Math.max(1, Number(p.questionsProvided ?? p.targetQuestions ?? 1));
    const start = runningQNumber;
    const end = runningQNumber + provided - 1;
    runningQNumber = end + 1;
    return { start, end, provided };
  });

  // Calculate live structure total answerable marks and question counts
  const structureTotalMarks = parts.reduce(
    (acc, p) =>
      acc +
      (Number(p.questionsToAnswer ?? p.targetQuestions ?? 1) || 0) *
        (Number(p.marksPerQuestion) || 1),
    0
  );

  const totalQuestionsProvidedSum = parts.reduce(
    (acc, p) => acc + (Number(p.questionsProvided ?? p.targetQuestions ?? 1) || 0),
    0
  );

  const totalQuestionsToAnswerSum = parts.reduce(
    (acc, p) => acc + (Number(p.questionsToAnswer ?? p.targetQuestions ?? 1) || 0),
    0
  );

  // Part management helpers
  const handleAddPart = () => {
    const nextIndex = parts.length;
    const nextLetter = String.fromCharCode(65 + (nextIndex % 26));
    setParts((prev) => [
      ...prev,
      {
        name: `Part ${nextLetter}`,
        questionsProvided: 5,
        questionsToAnswer: 5,
        targetQuestions: 5,
        marksPerQuestion: 2,
        hasInternalChoice: false,
        choiceCount: 0,
        instructions: 'Answer all the questions.',
        compulsoryQuestions: '',
      },
    ]);
  };

  const handleUpdatePart = (index: number, updates: Partial<PartConfig>) => {
    setParts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const handleRemovePart = (index: number) => {
    if (parts.length <= 1) return;
    setParts((prev) => prev.filter((_, i) => i !== index));
  };

  const parseCompulsoryNumbers = (val?: string): number[] => {
    if (!val) return [];
    return val
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
  };

  const toggleCompulsoryNumber = (partIndex: number, qNum: number) => {
    const current = parseCompulsoryNumbers(parts[partIndex].compulsoryQuestions);
    let updated: number[];
    if (current.includes(qNum)) {
      updated = current.filter((n) => n !== qNum);
    } else {
      updated = [...current, qNum].sort((a, b) => a - b);
    }
    const str = updated.join(', ');

    // Optionally suggest smart updated instruction if desired
    let newInstructions = parts[partIndex].instructions || '';
    const toAnswer = parts[partIndex].questionsToAnswer ?? parts[partIndex].questionsProvided ?? 1;
    const provided = parts[partIndex].questionsProvided ?? 1;
    if (updated.length > 0) {
      const compStr = updated.length === 1 ? `Question ${updated[0]}` : `Questions ${updated.join(', ')}`;
      if (provided > toAnswer) {
        newInstructions = `Answer any ${toAnswer} questions. ${compStr} is compulsory.`;
      } else {
        newInstructions = `Answer all the questions. ${compStr} is compulsory.`;
      }
    }

    handleUpdatePart(partIndex, { compulsoryQuestions: str, instructions: newInstructions });
  };

  const handleProceedToStructure = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedClassId) {
      setError('Please select an assigned class');
      return;
    }

    if (!selectedSubjectId) {
      setError('Please select a subject');
      return;
    }

    if (!examinationName.trim()) {
      setError('Examination name is required (e.g. Mid-Term Examination 2026)');
      return;
    }

    if (totalMarks <= 0) {
      setError('Target marks must be greater than 0');
      return;
    }

    setStep('structure');
  };

  const handleFinalSubmit = async () => {
    setError(null);

    if (parts.length === 0) {
      setError('Please define at least one Part for the paper structure.');
      return;
    }

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (!p.name.trim()) {
        setError(`Part #${i + 1} must have a valid name (e.g. Part A)`);
        return;
      }
      const provided = Number(p.questionsProvided ?? p.targetQuestions ?? 1) || 1;
      const toAnswer = Number(p.questionsToAnswer ?? p.targetQuestions ?? provided) || provided;
      if (provided <= 0) {
        setError(`${p.name} must have at least 1 question provided.`);
        return;
      }
      if (toAnswer <= 0) {
        setError(`${p.name} must have at least 1 question to answer.`);
        return;
      }
      if (toAnswer > provided) {
        setError(`${p.name}: Questions to answer (${toAnswer}) cannot exceed questions provided (${provided}).`);
        return;
      }
      if (p.marksPerQuestion <= 0) {
        setError(`${p.name} marks per question must be at least 1.`);
        return;
      }
    }

    setSubmitting(true);

    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/papers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          classId: selectedClassId,
          subjectId: selectedSubjectId,
          examinationName: examinationName.trim(),
          schoolName: schoolName.trim() || undefined,
          date: date.trim() || undefined,
          duration: duration.trim() || undefined,
          totalMarks: totalMarks,
          parts: parts.map((p) => {
            const provided = Number(p.questionsProvided ?? p.targetQuestions ?? 1) || 1;
            const toAnswer = Number(p.questionsToAnswer ?? p.targetQuestions ?? provided) || provided;
            return {
              name: p.name.trim(),
              targetQuestions: provided,
              questionsProvided: provided,
              questionsToAnswer: toAnswer,
              marksPerQuestion: Number(p.marksPerQuestion) || 1,
              hasInternalChoice: Boolean(p.hasInternalChoice),
              choiceCount: Number(p.choiceCount) || 0,
              instructions: p.instructions?.trim() || null,
              compulsoryQuestions: p.compulsoryQuestions?.trim() || null,
            };
          }),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create paper');
      }

      onCreated(data.paper);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error occurred while creating paper');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Create Examination Paper</h2>
              <p className="text-xs text-slate-500">
                Phase 3 Manual Selection &bull; Define structure before selecting questions
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

        {/* Step Progress Bar */}
        <div className="mt-4 flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                step === 'details'
                  ? 'bg-blue-600 text-white'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              {step === 'structure' ? '✓' : '1'}
            </span>
            <span className="text-xs font-semibold text-slate-800">1. Basic Paper Details</span>
          </div>

          <div className="h-0.5 w-12 bg-slate-200" />

          <div className="flex items-center space-x-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                step === 'structure'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              2
            </span>
            <span
              className={`text-xs font-semibold ${
                step === 'structure' ? 'text-slate-900' : 'text-slate-400'
              }`}
            >
              2. Paper Structure Setup
            </span>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200 flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Basic Paper Details */}
        {step === 'details' && (
          <form onSubmit={handleProceedToStructure} className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Class <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                >
                  <option value="" disabled>Select class...</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} {cls.grade ? `(${cls.grade}${cls.section ? `-${cls.section}` : ''})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subject <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                >
                  <option value="" disabled>Select subject...</option>
                  {availableSubjects.map((subj) => (
                    <option key={subj.id} value={subj.id}>
                      {subj.name} {subj.code ? `[${subj.code}]` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Examination Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={examinationName}
                onChange={(e) => setExaminationName(e.target.value)}
                placeholder="e.g. Annual Assessment 2026, Mid-Term Examination"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Institution / School Name (Optional)
              </label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="e.g. Delhi Public School / St. Mary's Academy"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Exam Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Duration
                </label>
                <input
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="e.g. 3 Hours"
                  className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Maximum Marks <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={totalMarks}
                  onChange={(e) => setTotalMarks(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center space-x-1.5 rounded-md bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors shadow-xs"
              >
                <span>Next: Define Paper Structure</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Paper Structure Setup */}
        {step === 'structure' && (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg bg-blue-50/60 p-3 border border-blue-100 text-xs text-blue-900 flex items-start space-x-2">
              <Layers className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" />
              <div>
                <p className="font-semibold">Predefine Your Question Paper Structure</p>
                <p className="text-blue-700 mt-0.5">
                  Specify the number of Parts (e.g. Part A, Part B, Part C), questions per Part, marks per question, and internal choices.
                  When you select questions from books, they will auto-populate into these structured slots.
                </p>
              </div>
            </div>

            {/* Dynamic Part Builder List */}
            <div className="space-y-4 max-h-[440px] overflow-y-auto pr-1">
              {parts.map((part, index) => {
                const range = partRanges[index] || { start: 1, end: 1, provided: 1 };
                const toAnswer = Number(part.questionsToAnswer ?? part.targetQuestions ?? range.provided) || 1;
                const provided = Number(part.questionsProvided ?? part.targetQuestions ?? range.provided) || 1;
                const marksPerQ = Number(part.marksPerQuestion) || 1;
                const partAnswerableMarks = toAnswer * marksPerQ;
                const compulsoryList = parseCompulsoryNumbers(part.compulsoryQuestions);

                return (
                  <div
                    key={index}
                    className="rounded-lg border border-slate-200 bg-white p-3.5 relative hover:border-slate-300 transition-all shadow-2xs space-y-3"
                  >
                    {/* Part Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center space-x-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                          {String.fromCharCode(65 + index)}
                        </span>
                        <input
                          type="text"
                          value={part.name}
                          onChange={(e) => handleUpdatePart(index, { name: e.target.value })}
                          placeholder="e.g. Part A"
                          className="font-bold text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded px-2 py-0.5 focus:border-blue-500 focus:bg-white focus:outline-hidden"
                        />
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 border border-slate-200">
                          Q.{range.start} – Q.{range.end}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2.5">
                        <div className="text-[11px] font-semibold text-slate-700 bg-blue-50/80 px-2.5 py-1 rounded border border-blue-200/80">
                          {toAnswer} to answer &bull; <span className="text-blue-700 font-bold">{partAnswerableMarks} Marks</span>
                        </div>

                        {parts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePart(index)}
                            className="rounded p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Remove this Part"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Numeric Controls: Provided, Answer, Marks */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Questions Provided
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={provided}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                            const newToAnswer = Math.min(toAnswer, val);
                            handleUpdatePart(index, {
                              questionsProvided: val,
                              targetQuestions: val,
                              questionsToAnswer: newToAnswer,
                            });
                          }}
                          className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 font-medium focus:border-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Questions to Answer
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={provided}
                          value={toAnswer}
                          onChange={(e) => {
                            const val = Math.min(provided, Math.max(1, parseInt(e.target.value, 10) || 1));
                            handleUpdatePart(index, {
                              questionsToAnswer: val,
                              instructions:
                                val < provided
                                  ? `Answer any ${val} questions.`
                                  : 'Answer all the questions.',
                            });
                          }}
                          className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 font-medium focus:border-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Marks per Question
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={marksPerQ}
                          onChange={(e) =>
                            handleUpdatePart(index, {
                              marksPerQuestion: Math.max(1, parseInt(e.target.value, 10) || 1),
                            })
                          }
                          className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 font-medium focus:border-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Internal Choice?
                        </label>
                        <select
                          value={part.hasInternalChoice ? 'yes' : 'no'}
                          onChange={(e) =>
                            handleUpdatePart(index, {
                              hasInternalChoice: e.target.value === 'yes',
                              choiceCount: e.target.value === 'yes' ? 2 : 0,
                            })
                          }
                          className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 font-medium focus:border-blue-500"
                        >
                          <option value="no">No (Direct Questions)</option>
                          <option value="yes">Yes (With OR Choice)</option>
                        </select>
                      </div>
                    </div>

                    {/* Part Instruction line */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-semibold text-slate-700">
                          Part Instruction (Printed directly under Part heading)
                        </label>
                        <div className="flex items-center space-x-1.5 text-[10px]">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdatePart(index, { instructions: 'Answer all the questions.' })
                            }
                            className="text-blue-600 hover:underline"
                          >
                            "Answer all"
                          </button>
                          <span className="text-slate-300">&bull;</span>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdatePart(index, {
                                instructions: `Answer any ${toAnswer} questions.`,
                              })
                            }
                            className="text-blue-600 hover:underline"
                          >
                            "Answer any {toAnswer}"
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={part.instructions || ''}
                        onChange={(e) => handleUpdatePart(index, { instructions: e.target.value })}
                        placeholder="e.g. Answer any 10 questions."
                        className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 font-medium focus:border-blue-500"
                      />
                    </div>

                    {/* Compulsory Question(s) Selection */}
                    <div className="rounded-md bg-slate-50 p-2.5 border border-slate-200/80">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-semibold text-slate-700">
                          Compulsory Question(s) (Optional)
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Click question number(s) to mark as compulsory
                        </span>
                      </div>

                      {/* Question Number Pills */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {Array.from({ length: range.end - range.start + 1 }, (_, i) => {
                          const qNum = range.start + i;
                          const isComp = compulsoryList.includes(qNum);
                          return (
                            <button
                              key={qNum}
                              type="button"
                              onClick={() => toggleCompulsoryNumber(index, qNum)}
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                                isComp
                                  ? 'bg-amber-500 text-white shadow-2xs'
                                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                              }`}
                            >
                              Q.{qNum} {isComp && '✓'}
                            </button>
                          );
                        })}
                      </div>

                      {compulsoryList.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-amber-900 font-medium bg-amber-50/80 px-2 py-1 rounded border border-amber-200/80">
                          <span className="font-semibold">Selected Compulsory:</span>
                          {compulsoryList.map((num) => (
                            <span
                              key={num}
                              className="inline-flex items-center space-x-1 bg-white border border-amber-300 px-1.5 py-0.2 rounded text-[11px] font-bold text-amber-800"
                            >
                              <span>Q.{num}</span>
                              <button
                                type="button"
                                onClick={() => toggleCompulsoryNumber(index, num)}
                                className="text-amber-700 hover:text-red-700 ml-0.5"
                                title="Remove"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Part Button */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleAddPart}
                className="inline-flex items-center space-x-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <Plus className="h-3.5 w-3.5 text-slate-500" />
                <span>+ Add Another Part</span>
              </button>

              <div className="text-xs text-slate-500">
                Provided: <span className="font-bold text-slate-800">{totalQuestionsProvidedSum}</span> &bull; To Answer:{' '}
                <span className="font-bold text-slate-800">{totalQuestionsToAnswerSum}</span>
              </div>
            </div>

            {/* Structure Summary & Comparison Banner */}
            <div className="rounded-lg bg-slate-100 p-3 text-xs border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <span className="text-slate-500">Structure Answerable Marks: </span>
                <span className="font-bold text-slate-900 text-sm">{structureTotalMarks} Marks</span>
                <span className="text-slate-400 mx-2">&bull;</span>
                <span className="text-slate-500">Target Maximum Marks: </span>
                <span className="font-bold text-slate-900 text-sm">{totalMarks} Marks</span>
              </div>

              {structureTotalMarks !== totalMarks ? (
                <button
                  type="button"
                  onClick={() => setTotalMarks(structureTotalMarks)}
                  className="inline-flex items-center space-x-1 text-[11px] font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded border border-blue-200"
                >
                  <span>Sync Target to {structureTotalMarks} Marks</span>
                </button>
              ) : (
                <span className="text-[11px] font-semibold text-emerald-700 flex items-center space-x-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Marks Perfectly Balanced</span>
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep('details')}
                className="inline-flex items-center space-x-1 rounded-md border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Details</span>
              </button>

              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={submitting}
                className="inline-flex items-center space-x-1.5 rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>{submitting ? 'Creating Structure...' : 'Continue to Question Selection'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
