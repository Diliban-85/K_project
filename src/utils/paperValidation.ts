import { SchoolPaper, PaperSection, PaperQuestion, ChoiceGroup } from '../types';
import { calculatePaperStats, PaperCalculationResult } from './pdfEngine';

export interface PaperValidationError {
  id: string;
  field?: string;
  sectionId?: string;
  sectionName?: string;
  questionId?: string;
  questionNumber?: number;
  message: string;
  severity: 'error' | 'warning';
  category:
    | 'marks'
    | 'parts'
    | 'questions'
    | 'compulsory'
    | 'choice_group'
    | 'metadata';
}

export interface ComprehensiveValidationResult {
  isValid: boolean; // true if 0 blocking errors
  errors: PaperValidationError[];
  warnings: PaperValidationError[];
  stats: PaperCalculationResult;
  summary: {
    totalErrors: number;
    totalWarnings: number;
    canGeneratePdf: boolean;
  };
}

/**
 * Validates an examination paper against all academic, structural, scoring, and layout constraints.
 */
export function validatePaperComprehensive(paper: SchoolPaper): ComprehensiveValidationResult {
  const errors: PaperValidationError[] = [];
  const warnings: PaperValidationError[] = [];

  const stats = calculatePaperStats(paper);
  const sections = paper.sections || [];
  const allQuestions = paper.questions || [];

  // 1. Metadata Validation
  if (!paper.examinationName || !paper.examinationName.trim()) {
    errors.push({
      id: 'err_exam_name',
      field: 'examinationName',
      message: 'Examination Name is required.',
      severity: 'error',
      category: 'metadata',
    });
  }

  if (!paper.totalMarks || paper.totalMarks <= 0) {
    errors.push({
      id: 'err_total_marks',
      field: 'totalMarks',
      message: 'Paper Maximum Marks must be a positive integer greater than 0.',
      severity: 'error',
      category: 'marks',
    });
  }

  if (!paper.schoolName || !paper.schoolName.trim()) {
    warnings.push({
      id: 'warn_school_name',
      field: 'schoolName',
      message: 'School Name is empty. The paper header will print without a top institution name.',
      severity: 'warning',
      category: 'metadata',
    });
  }

  // 2. Sections / Parts Validation
  if (sections.length === 0) {
    errors.push({
      id: 'err_no_sections',
      message: 'Paper has no Parts defined. An examination paper must have at least one Part (e.g. Part A).',
      severity: 'error',
      category: 'parts',
    });
  }

  // 3. Questions Global Presence
  if (allQuestions.length === 0) {
    errors.push({
      id: 'err_no_questions',
      message: 'No questions have been added to this examination paper. Please select questions before generating the PDF.',
      severity: 'error',
      category: 'questions',
    });
  }

  // 4. Section-by-Section Deep Validation
  const questionNumberMap = new Map<string, number>();
  const seenQuestionIds = new Set<string>();

  for (let secIdx = 0; secIdx < sections.length; secIdx++) {
    const section = sections[secIdx];
    const secInfo = stats.sectionMap[section.id];
    const secQuestions = section.questions || [];
    const secChoiceGroups = section.choiceGroups || [];

    const provided = Number(section.questionsProvided || section.targetQuestions || secQuestions.length || 0);
    const toAnswer = Number(section.questionsToAnswer || section.targetQuestions || provided || 0);
    const marksPerQ = Number(section.marksPerQuestion) || 1;

    // Validate questions provided vs to answer
    if (toAnswer > provided && provided > 0) {
      errors.push({
        id: `err_sec_answer_exceeds_${section.id}`,
        sectionId: section.id,
        sectionName: section.name,
        message: `${section.name}: Questions to answer (${toAnswer}) cannot exceed questions provided (${provided}).`,
        severity: 'error',
        category: 'parts',
      });
    }

    if (marksPerQ <= 0) {
      errors.push({
        id: `err_sec_invalid_marks_${section.id}`,
        sectionId: section.id,
        sectionName: section.name,
        message: `${section.name}: Marks per question must be greater than 0 (currently ${marksPerQ}).`,
        severity: 'error',
        category: 'marks',
      });
    }

    // Check unfilled slots
    if (provided > 0 && secQuestions.length < provided) {
      warnings.push({
        id: `warn_sec_unfilled_${section.id}`,
        sectionId: section.id,
        sectionName: section.name,
        message: `${section.name}: Has ${secQuestions.length} questions selected out of ${provided} planned question slots.`,
        severity: 'warning',
        category: 'questions',
      });
    }

    // Track global numbering for questions in this section
    let currentQNumber = secInfo?.startNumber || 1;
    const processedChoiceGroupIds = new Set<string>();

    for (const q of secQuestions) {
      // Check duplicate questions across paper
      if (seenQuestionIds.has(q.id)) {
        errors.push({
          id: `err_dup_q_${q.id}`,
          questionId: q.id,
          sectionId: section.id,
          sectionName: section.name,
          message: `Duplicate question detected in ${section.name} (Question ID: ${q.id.substring(0, 8)}).`,
          severity: 'error',
          category: 'questions',
        });
      }
      seenQuestionIds.add(q.id);

      // Validate question content (must have text or visual asset)
      const hasText = q.questionText && q.questionText.trim().length > 0 && q.questionText !== '[Visual Question]';
      const hasVisual = Boolean(q.visualAssetUrl);

      if (!hasText && !hasVisual) {
        errors.push({
          id: `err_empty_q_${q.id}`,
          questionId: q.id,
          sectionId: section.id,
          sectionName: section.name,
          questionNumber: currentQNumber,
          message: `${section.name}, Question ${currentQNumber}: Question content is empty (missing both text and visual clipping).`,
          severity: 'error',
          category: 'questions',
        });
      }

      // Validate question marks
      if (!q.marks || q.marks <= 0) {
        errors.push({
          id: `err_q_marks_${q.id}`,
          questionId: q.id,
          sectionId: section.id,
          sectionName: section.name,
          questionNumber: currentQNumber,
          message: `${section.name}, Question ${currentQNumber}: Allocated marks must be greater than 0.`,
          severity: 'error',
          category: 'marks',
        });
      }

      // If part has fixed marksPerQuestion, verify consistency
      if (marksPerQ > 0 && q.marks !== marksPerQ && !q.choiceGroupId) {
        warnings.push({
          id: `warn_q_marks_mismatch_${q.id}`,
          questionId: q.id,
          sectionId: section.id,
          sectionName: section.name,
          questionNumber: currentQNumber,
          message: `${section.name}, Question ${currentQNumber}: Has ${q.marks} marks, which differs from Part default (${marksPerQ} marks).`,
          severity: 'warning',
          category: 'marks',
        });
      }

      // Choice Group / Question Numbering step
      if (q.choiceGroupId) {
        if (!processedChoiceGroupIds.has(q.choiceGroupId)) {
          processedChoiceGroupIds.add(q.choiceGroupId);
          questionNumberMap.set(q.id, currentQNumber);
          currentQNumber++;
        } else {
          questionNumberMap.set(q.id, currentQNumber - 1);
        }
      } else {
        questionNumberMap.set(q.id, currentQNumber);
        currentQNumber++;
      }
    }

    // 5. Choice Groups Deep Validation in this Section
    for (const group of secChoiceGroups) {
      const groupQuestions = secQuestions.filter((q) => q.choiceGroupId === group.id);

      if (groupQuestions.length === 0) {
        errors.push({
          id: `err_choice_empty_${group.id}`,
          sectionId: section.id,
          sectionName: section.name,
          message: `${section.name}: Internal choice group has no questions attached.`,
          severity: 'error',
          category: 'choice_group',
        });
      } else if (groupQuestions.length === 1) {
        errors.push({
          id: `err_choice_single_${group.id}`,
          sectionId: section.id,
          sectionName: section.name,
          message: `${section.name}: Incomplete internal choice pair. Choice option (b) is missing (an internal choice must contain exactly 2 alternatives: (a) OR (b)).`,
          severity: 'error',
          category: 'choice_group',
        });
      } else if (groupQuestions.length > 2) {
        errors.push({
          id: `err_choice_overflow_${group.id}`,
          sectionId: section.id,
          sectionName: section.name,
          message: `${section.name}: Internal choice group contains ${groupQuestions.length} questions. A standard internal choice must have exactly 2 alternatives ((a) OR (b)).`,
          severity: 'error',
          category: 'choice_group',
        });
      } else if (groupQuestions.length === 2) {
        const [qA, qB] = groupQuestions;
        // Check if marks are consistent across options
        if (qA.marks !== qB.marks) {
          errors.push({
            id: `err_choice_marks_mismatch_${group.id}`,
            sectionId: section.id,
            sectionName: section.name,
            message: `${section.name}: Internal choice options have mismatched marks (${qA.marks} marks for option (a) vs ${qB.marks} marks for option (b)). Both choices must award identical marks.`,
            severity: 'error',
            category: 'choice_group',
          });
        }
        // Check if identical question was picked for both options
        if (qA.id === qB.id || (qA.questionText && qA.questionText === qB.questionText && !qA.visualAssetUrl)) {
          errors.push({
            id: `err_choice_duplicate_${group.id}`,
            sectionId: section.id,
            sectionName: section.name,
            message: `${section.name}: Duplicate question detected in internal choice group. Option (a) and Option (b) cannot be the same question.`,
            severity: 'error',
            category: 'choice_group',
          });
        }
      }
    }

    // 6. Compulsory Questions Validation
    if (section.compulsoryQuestions && section.compulsoryQuestions.trim().length > 0) {
      const compNumbers = section.compulsoryQuestions
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));

      const minAllowed = secInfo.startNumber;
      const maxAllowed = secInfo.endNumber;

      for (const compNum of compNumbers) {
        if (compNum < minAllowed || compNum > maxAllowed) {
          errors.push({
            id: `err_compulsory_out_of_range_${section.id}_${compNum}`,
            sectionId: section.id,
            sectionName: section.name,
            message: `${section.name}: Compulsory question #${compNum} is invalid because ${section.name} only spans questions ${minAllowed} to ${maxAllowed}.`,
            severity: 'error',
            category: 'compulsory',
          });
        }
      }

      if (toAnswer > 0 && compNumbers.length > toAnswer) {
        errors.push({
          id: `err_compulsory_exceeds_to_answer_${section.id}`,
          sectionId: section.id,
          sectionName: section.name,
          message: `${section.name}: Has ${compNumbers.length} compulsory questions configured, which exceeds the total questions to answer (${toAnswer}).`,
          severity: 'error',
          category: 'compulsory',
        });
      }
    }
  }

  // 7. Overall Marks Consistency Validation
  if (stats.hasMarksMismatch) {
    errors.push({
      id: 'err_marks_mismatch',
      field: 'totalMarks',
      message: `Total Planned Marks Mismatch: Configured examination maximum marks is ${paper.totalMarks}, but Parts & questions total ${stats.totalPlannedMarks} marks (difference of ${Math.abs(stats.marksDifference)} marks).`,
      severity: 'error',
      category: 'marks',
    });
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    errors,
    warnings,
    stats,
    summary: {
      totalErrors: errors.length,
      totalWarnings: warnings.length,
      canGeneratePdf: isValid,
    },
  };
}
