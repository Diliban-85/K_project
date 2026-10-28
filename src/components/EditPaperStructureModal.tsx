import React, { useState } from 'react';
import {
  X,
  Layers,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Save,
  Info,
} from 'lucide-react';
import { SchoolPaper, PaperSection } from '../types';
import { PartConfig } from './CreatePaperModal';

interface EditPaperStructureModalProps {
  isOpen: boolean;
  paper: SchoolPaper;
  onClose: () => void;
  onSaved: (updatedPaper: SchoolPaper) => void;
}

export const EditPaperStructureModal: React.FC<EditPaperStructureModalProps> = ({
  isOpen,
  paper,
  onClose,
  onSaved,
}) => {
  // Initialize parts from paper sections
  const [parts, setParts] = useState<PartConfig[]>(() => {
    if (paper.sections && paper.sections.length > 0) {
      return paper.sections.map((s, idx) => {
        const provided = s.questionsProvided || s.targetQuestions || (s.questions?.length ? s.questions.length : 5);
        const toAnswer = s.questionsToAnswer || s.targetQuestions || provided;
        return {
          id: s.id,
          name: s.name || `Part ${String.fromCharCode(65 + idx)}`,
          targetQuestions: provided,
          questionsProvided: provided,
          questionsToAnswer: toAnswer,
          marksPerQuestion: s.marksPerQuestion || 1,
          hasInternalChoice: Boolean(s.hasInternalChoice),
          choiceCount: s.choiceCount || 0,
          instructions: s.instructions || '',
          compulsoryQuestions: s.compulsoryQuestions || '',
        };
      });
    }
    return [
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
    ];
  });

  const [totalMarks, setTotalMarks] = useState<number>(paper.totalMarks || 80);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Calculate live continuous question ranges across parts
  let runningQNumber = 1;
  const partRanges = parts.map((p) => {
    const provided = Math.max(1, Number(p.questionsProvided ?? p.targetQuestions ?? 1));
    const start = runningQNumber;
    const end = runningQNumber + provided - 1;
    runningQNumber = end + 1;
    return { start, end, provided };
  });

  // Calculate live structure total marks (based on questions to answer)
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

  if (!isOpen) return null;

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
    const part = parts[index];
    if (part.id) {
      const originalSection = paper.sections?.find((s) => s.id === part.id);
      const questionCount = originalSection?.questions?.length || 0;
      if (questionCount > 0) {
        alert(
          `Cannot remove "${part.name}" because it already contains ${questionCount} question(s). To remove this Part, first delete its questions from the paper editor.`
        );
        return;
      }
    }

    if (parts.length <= 1) {
      alert('The paper must retain at least one Part.');
      return;
    }

    setParts((prev) => prev.filter((_, i) => i !== index));
  };

  // Find any warnings where existing question count exceeds newly reduced target
  const warnings: string[] = [];
  parts.forEach((p) => {
    if (p.id) {
      const sec = paper.sections?.find((s) => s.id === p.id);
      const qCount = sec?.questions?.length || 0;
      if (qCount > p.targetQuestions) {
        warnings.push(
          `"${p.name}" currently has ${qCount} questions, which exceeds the new target of ${p.targetQuestions}. Existing questions will NOT be deleted, but the Part will show as exceeding target.`
        );
      }
    }
  });

  const handleSave = async () => {
    setError(null);

    if (parts.length === 0) {
      setError('At least one Part must be defined.');
      return;
    }

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (!p.name.trim()) {
        setError(`Part #${i + 1} must have a valid name`);
        return;
      }
      if (p.targetQuestions <= 0) {
        setError(`${p.name} must have at least 1 question specified.`);
        return;
      }
      if (p.marksPerQuestion <= 0) {
        setError(`${p.name} marks per question must be at least 1.`);
        return;
      }
    }

    setSaving(true);

    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/papers/${paper.id}/structure`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          parts: parts.map((p) => {
            const provided = Number(p.questionsProvided ?? p.targetQuestions ?? 1) || 1;
            const toAnswer = Number(p.questionsToAnswer ?? p.targetQuestions ?? provided) || provided;
            return {
              id: p.id,
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
          totalMarks,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update paper structure');
      }

      onSaved(data.paper);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error updating paper structure');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Edit Paper Structure</h2>
              <p className="text-xs text-slate-500">
                Modify Parts, questions provided/answered, marks per question, and compulsory questions
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

        {warnings.length > 0 && (
          <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200 space-y-1">
            <div className="flex items-center space-x-1.5 font-bold">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Structure Notice</span>
            </div>
            {warnings.map((w, i) => (
              <p key={i} className="pl-5 text-[11px] text-amber-700">
                &bull; {w}
              </p>
            ))}
          </div>
        )}

        {/* Dynamic Part List */}
        <div className="mt-4 space-y-4 max-h-[440px] overflow-y-auto pr-1">
          {parts.map((part, index) => {
            const originalSec = paper.sections?.find((s) => s.id === part.id);
            const questionCount = originalSec?.questions?.length || 0;
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
                    {part.id && (
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-200">
                        {questionCount} question(s) added
                      </span>
                    )}
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
                        title={
                          questionCount > 0
                            ? 'Cannot delete Part with existing questions'
                            : 'Remove this Part'
                        }
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
        <div className="flex items-center justify-between pt-3">
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

        {/* Summary Banner */}
        <div className="mt-3 rounded-lg bg-slate-100 p-3 text-xs border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <span className="text-slate-500">Structure Answerable: </span>
            <span className="font-bold text-slate-900">{structureTotalMarks} Marks</span>
            <span className="text-slate-400 mx-2">&bull;</span>
            <span className="text-slate-500">Paper Target: </span>
            <span className="font-bold text-slate-900">{totalMarks} Marks</span>
          </div>

          {structureTotalMarks !== totalMarks && (
            <button
              type="button"
              onClick={() => setTotalMarks(structureTotalMarks)}
              className="inline-flex items-center space-x-1 text-[11px] font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded border border-blue-200"
            >
              <span>Update Paper Target to {structureTotalMarks} Marks</span>
            </button>
          )}
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
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center space-x-1.5 rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? 'Saving Structure...' : 'Save Structure'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
