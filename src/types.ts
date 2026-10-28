export interface TeacherUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt?: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  grade: string | null;
  section: string | null;
  description: string | null;
  teacherId: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    subjects: number;
  };
  subjects?: Array<{
    id: string;
    name: string;
    code: string | null;
  }>;
}

export interface SchoolSubject {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  classId: string;
  teacherId: string;
  createdAt: string;
  updatedAt: string;
  class?: {
    id: string;
    name: string;
    grade: string | null;
    section: string | null;
  };
}

export interface SchoolResourcePage {
  id: string;
  resourceId: string;
  pageNumber: number;
  text: string | null;
  wordCount: number | null;
  createdAt?: string;
}

export interface SchoolResource {
  id: string;
  name: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  processingStatus: 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED';
  processingError: string | null;
  teacherId: string;
  classId: string;
  subjectId: string;
  createdAt: string;
  updatedAt: string;
  class?: {
    id: string;
    name: string;
    grade: string | null;
    section: string | null;
  };
  subject?: {
    id: string;
    name: string;
    code: string | null;
  };
  file?: {
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  };
  pages?: SchoolResourcePage[];
  _count?: {
    pages: number;
  };
}

export interface PaperQuestion {
  id: string;
  paperId: string;
  sectionId: string;
  choiceGroupId: string | null;
  choiceOption: string | null;
  position: number;
  questionText: string;
  originalSourceText: string | null;
  marks: number;
  isCompulsory?: boolean;
  sourceResourceId: string | null;
  sourcePageNumber: number | null;
  sourceQuestionNumber: string | null;
  sourceChapter: string | null;
  visualAssetUrl?: string | null;
  cropCoordinates?: string | null;
  sourceResource?: {
    id: string;
    name: string;
    fileType: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ChoiceGroup {
  id: string;
  paperId: string;
  sectionId: string;
  position: number;
  label: string | null;
  marks: number | null;
  questions?: PaperQuestion[];
  createdAt: string;
  updatedAt: string;
}

export interface PartConfig {
  id?: string;
  name: string;
  questionsProvided: number;
  questionsToAnswer: number;
  targetQuestions?: number;
  marksPerQuestion: number;
  hasInternalChoice: boolean;
  choiceCount: number;
  instructions?: string;
  compulsoryQuestions?: string;
}

export interface PaperSection {
  id: string;
  paperId: string;
  name: string;
  instructions: string | null;
  position: number;
  targetQuestions?: number;
  questionsProvided?: number;
  questionsToAnswer?: number;
  compulsoryQuestions?: string | null;
  marksPerQuestion?: number;
  hasInternalChoice?: boolean;
  choiceCount?: number;
  questions?: PaperQuestion[];
  choiceGroups?: ChoiceGroup[];
  createdAt: string;
  updatedAt: string;
}

export interface SchoolPaper {
  id: string;
  teacherId: string;
  classId: string;
  subjectId: string;
  schoolName: string | null;
  examinationName: string;
  academicYear?: string | null;
  date: string | null;
  duration: string | null;
  totalMarks: number;
  actualMarks?: number;
  generalInstructions?: string | null;
  creationMode: 'MANUAL' | 'AI';
  status: 'DRAFT' | 'READY' | 'PUBLISHED';
  isArchived?: boolean;
  pdfGeneratedAt?: string | null;
  pdfVersion?: number;
  createdAt: string;
  updatedAt: string;
  class?: {
    id: string;
    name: string;
    grade: string | null;
    section: string | null;
  };
  subject?: {
    id: string;
    name: string;
    code: string | null;
  };
  sections?: PaperSection[];
  choiceGroups?: ChoiceGroup[];
  questions?: PaperQuestion[];
  pdfHistories?: PdfHistory[];
  sectionsCount?: number;
  questionsCount?: number;
}

export interface SystemSettings {
  id: string;
  teacherId: string;
  schoolName: string | null;
  schoolAddress: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  website: string | null;
  logoUrl: string | null;
  academicYear: string | null;
  defaultExamName: string | null;
  defaultClassId: string | null;
  defaultSubjectId: string | null;
  defaultTotalMarks: number;
  defaultDuration: string;
  defaultInstructions: string | null;
  fontSizePreference: 'COMPACT' | 'NORMAL' | 'LARGE';
  showWatermark: boolean;
  watermarkText: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BankQuestion {
  id: string;
  teacherId: string;
  classId: string | null;
  subjectId: string | null;
  chapter: string | null;
  topic: string | null;
  questionText: string;
  marks: number;
  questionType: 'MCQ' | 'SHORT' | 'LONG' | 'NUMERICAL' | 'CASE_STUDY' | 'SUBJECTIVE';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  visualAssetUrl?: string | null;
  cropCoordinates?: string | null;
  sourceResourceId?: string | null;
  sourcePageNumber?: number | null;
  sourceQuestionNumber?: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  class?: {
    id: string;
    name: string;
  } | null;
  subject?: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  papersCount?: number;
}

export interface PdfHistory {
  id: string;
  paperId: string;
  version: number;
  status: string;
  totalMarks: number;
  questionCount: number;
  pageCount: number;
  notes: string | null;
  generatedAt: string;
  paper?: {
    id: string;
    examinationName: string;
    schoolName: string | null;
  };
}

export interface AuditLog {
  id: string;
  teacherId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
}

export type ActiveTab =
  | 'dashboard'
  | 'classes'
  | 'subjects'
  | 'create-paper'
  | 'resources'
  | 'papers'
  | 'question-bank'
  | 'settings'
  | 'exam-patterns';
