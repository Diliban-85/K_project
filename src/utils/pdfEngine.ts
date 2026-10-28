import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { SchoolPaper, PaperSection, PaperQuestion, ChoiceGroup } from '../types';

export interface SectionNumberingInfo {
  startNumber: number;
  endNumber: number;
  totalQuestions: number;
  compulsoryNumbers: number[];
  plannedMarks: number;
}

export interface PaperCalculationResult {
  sectionMap: Record<string, SectionNumberingInfo>;
  totalPlannedMarks: number;
  totalActualQuestions: number;
  totalPlannedQuestions: number;
  hasMarksMismatch: boolean;
  marksDifference: number;
}

/**
 * Calculates continuous global question numbers, planned marks, and compulsory questions
 * deterministically across all Parts of an examination paper.
 */
export function calculatePaperStats(paper: SchoolPaper): PaperCalculationResult {
  const sections = paper.sections || [];
  const sectionMap: Record<string, SectionNumberingInfo> = {};

  let currentGlobalNumber = 1;
  let totalPlannedMarks = 0;
  let totalActualQuestions = 0;
  let totalPlannedQuestions = 0;

  for (const section of sections) {
    const secQuestions = section.questions || [];
    const secChoiceGroups = section.choiceGroups || [];
    const provided = Number(section.questionsProvided || section.targetQuestions || secQuestions.length || 0);
    const toAnswer = Number(section.questionsToAnswer || section.targetQuestions || provided || 0);
    const marksPerQ = Number(section.marksPerQuestion) || 1;

    // Count unique question slots (where a choice group counts as 1 slot)
    const uniqueChoiceGroupIds = new Set<string>();
    let uniqueFilledSlots = 0;
    for (const q of secQuestions) {
      if (q.choiceGroupId) {
        if (!uniqueChoiceGroupIds.has(q.choiceGroupId)) {
          uniqueChoiceGroupIds.add(q.choiceGroupId);
          uniqueFilledSlots++;
        }
      } else {
        uniqueFilledSlots++;
      }
    }

    const startNumber = currentGlobalNumber;
    // The span of question numbers in this section
    const span = Math.max(provided, uniqueFilledSlots, 1);
    const endNumber = startNumber + span - 1;

    // Parse compulsory questions
    let compulsoryNumbers: number[] = [];
    if (section.compulsoryQuestions) {
      compulsoryNumbers = section.compulsoryQuestions
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
    }

    let plannedMarks = 0;
    if (toAnswer > 0) {
      plannedMarks = toAnswer * marksPerQ;
    } else {
      // Sum individual questions, deduplicating choice groups
      const seenChoice = new Set<string>();
      for (const q of secQuestions) {
        if (q.choiceGroupId) {
          if (!seenChoice.has(q.choiceGroupId)) {
            seenChoice.add(q.choiceGroupId);
            plannedMarks += q.marks || marksPerQ;
          }
        } else {
          plannedMarks += q.marks || marksPerQ;
        }
      }
    }

    totalPlannedMarks += plannedMarks;
    totalActualQuestions += secQuestions.length;
    totalPlannedQuestions += provided;

    sectionMap[section.id] = {
      startNumber,
      endNumber,
      totalQuestions: provided,
      compulsoryNumbers,
      plannedMarks,
    };

    currentGlobalNumber = endNumber + 1;
  }

  const hasMarksMismatch = totalPlannedMarks !== paper.totalMarks;
  const marksDifference = totalPlannedMarks - paper.totalMarks;

  return {
    sectionMap,
    totalPlannedMarks,
    totalActualQuestions,
    totalPlannedQuestions,
    hasMarksMismatch,
    marksDifference,
  };
}

/**
 * Deterministically generates and downloads an A4 PDF from rendered DOM page containers.
 * Uses high-resolution canvas capture with jsPDF to create a clean, black-and-white, print-ready document.
 */
export async function generateAndDownloadPdf(
  pageElements: HTMLElement[],
  filename: string,
  onProgress?: (progressText: string) => void
): Promise<void> {
  if (!pageElements || pageElements.length === 0) {
    throw new Error('No printable pages found to generate PDF');
  }

  // Create jsPDF instance in A4 portrait orientation (210mm x 297mm)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const totalPages = pageElements.length;

  for (let i = 0; i < totalPages; i++) {
    const pageEl = pageElements[i];
    if (onProgress) {
      onProgress(`Rendering Page ${i + 1} of ${totalPages}...`);
    }

    // Capture the A4 page container at 2.0x scale for crisp, print-ready rendering
    const canvas = await html2canvas(pageEl, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 794, // Standard A4 width in pixels at 96 DPI
      windowHeight: 1123, // Standard A4 height in pixels at 96 DPI
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    if (i > 0) {
      pdf.addPage('a4', 'portrait');
    }

    // A4 dimensions in mm: 210mm width, 297mm height
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  }

  if (onProgress) {
    onProgress('Finalizing and saving PDF...');
  }

  // Download PDF directly
  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/**
 * Triggers native high-fidelity browser print dialog.
 */
export function printExamPaper(): void {
  window.print();
}
