import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Printer,
  Download,
  FileCheck,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Edit3,
  Layers,
  BookOpen,
  Calendar,
  Clock,
  Award,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { SchoolPaper } from '../types';
import { DeterministicExamPaper } from './DeterministicExamPaper';
import { calculatePaperStats, generateAndDownloadPdf, printExamPaper } from '../utils/pdfEngine';
import { validatePaperComprehensive } from '../utils/paperValidation';

interface PaperPdfPreviewProps {
  paperId: string;
  onBackToEditor?: () => void;
  onBackToPapers?: () => void;
}

export const PaperPdfPreview: React.FC<PaperPdfPreviewProps> = ({
  paperId,
  onBackToEditor,
  onBackToPapers,
}) => {
  const [paper, setPaper] = useState<SchoolPaper | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // View state
  const [viewMode, setViewMode] = useState<'single' | 'all'>('all');
  const [activePageIndex, setActivePageIndex] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100); // percentage
  const [showWarningsDetails, setShowWarningsDetails] = useState<boolean>(false);

  // Generation state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<string>('');
  const [generationSuccessMessage, setGenerationSuccessMessage] = useState<string | null>(null);

  // Refs for rendering all A4 page containers into PDF
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

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
        throw new Error(data.error || 'Failed to load examination paper');
      }
      const data = await res.json();
      setPaper(data.paper);
    } catch (err: any) {
      setError(err.message || 'Unable to load paper details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPaper();
  }, [paperId]);

  // Comprehensive paper validation
  const validation = useMemo(() => {
    if (!paper) return null;
    return validatePaperComprehensive(paper);
  }, [paper]);

  const stats = validation?.stats || (paper ? calculatePaperStats(paper) : null);

  // Determine if paper was updated after the last PDF generation
  const isOutOfSync = Boolean(
    paper &&
      paper.pdfGeneratedAt &&
      new Date(paper.updatedAt).getTime() > new Date(paper.pdfGeneratedAt).getTime() + 1000
  );

  const handleGeneratePdf = async () => {
    if (!paper) return;

    if (validation && !validation.isValid) {
      setError('Please resolve all blocking validation errors in the paper before generating the PDF.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGenerationSuccessMessage(null);
    setGenerationProgress('Validating paper structure & registering version...');

    try {
      // 1. Call backend to validate and update PDF generation records
      const res = await fetch(`/api/papers/${paper.id}/generate-pdf`, {
        method: 'POST',
        headers: getHeaders(),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to register PDF generation');
      }

      const resData = await res.json();
      setPaper(resData.paper);

      // 2. Client-side deterministic PDF creation
      setGenerationProgress('Creating high-resolution A4 print document...');

      // Find all rendered page elements
      const elements: HTMLElement[] = [];
      for (let i = 0; i < totalPages; i++) {
        const el = document.getElementById(`exam-page-${i + 1}`);
        if (el) {
          elements.push(el);
        }
      }

      const schoolSafe = (paper.schoolName || 'School').replace(/[^a-zA-Z0-9_-]/g, '_');
      const subjectSafe = (paper.subject?.name || 'Subject').replace(/[^a-zA-Z0-9_-]/g, '_');
      const examSafe = (paper.examinationName || 'Exam').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${schoolSafe}_${subjectSafe}_${examSafe}_v${resData.pdfVersion || 1}.pdf`;

      await generateAndDownloadPdf(elements, filename, (prog) => {
        setGenerationProgress(prog);
      });

      setGenerationSuccessMessage(
        `PDF Version ${resData.pdfVersion || 1} generated successfully and downloaded to your device!`
      );
    } catch (err: any) {
      console.error('PDF generation error:', err);
      setError(err.message || 'An unexpected error occurred during PDF generation. Please try again.');
    } finally {
      setIsGenerating(false);
      setGenerationProgress('');
    }
  };

  const handleDownloadOnly = async () => {
    if (!paper) return;

    setIsGenerating(true);
    setError(null);
    setGenerationProgress('Preparing A4 PDF download...');

    try {
      const elements: HTMLElement[] = [];
      for (let i = 0; i < totalPages; i++) {
        const el = document.getElementById(`exam-page-${i + 1}`);
        if (el) {
          elements.push(el);
        }
      }

      const schoolSafe = (paper.schoolName || 'School').replace(/[^a-zA-Z0-9_-]/g, '_');
      const subjectSafe = (paper.subject?.name || 'Subject').replace(/[^a-zA-Z0-9_-]/g, '_');
      const examSafe = (paper.examinationName || 'Exam').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${schoolSafe}_${subjectSafe}_${examSafe}.pdf`;

      await generateAndDownloadPdf(elements, filename, (prog) => {
        setGenerationProgress(prog);
      });

      setGenerationSuccessMessage('PDF downloaded successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to download PDF.');
    } finally {
      setIsGenerating(false);
      setGenerationProgress('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center bg-slate-100 rounded-xl">
        <div className="text-center space-y-3">
          <RefreshCw className="h-7 w-7 animate-spin text-slate-700 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">Loading Examination Paper Preview...</p>
        </div>
      </div>
    );
  }

  if (error && !paper) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center space-y-4">
        <AlertTriangle className="h-8 w-8 text-red-600 mx-auto" />
        <h3 className="text-base font-bold text-red-900">Unable to load Paper Preview</h3>
        <p className="text-xs text-red-700">{error}</p>
        <div className="flex justify-center gap-3">
          <button
            onClick={loadPaper}
            className="rounded-md bg-red-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
          >
            Retry
          </button>
          {onBackToEditor && (
            <button
              onClick={onBackToEditor}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              Back to Editor
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!paper) return null;

  const canGenerate = validation?.isValid && !isGenerating;

  return (
    <div className="space-y-6">
      {/* Top Header / Control Toolbar */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 py-3 -mx-4 px-4 sm:-mx-8 sm:px-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left: Back & Title Metadata */}
          <div className="flex items-center space-x-3">
            <button
              onClick={onBackToEditor || onBackToPapers}
              className="inline-flex items-center space-x-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Editor</span>
            </button>

            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate max-w-[280px] sm:max-w-md">
                  {paper.examinationName}
                </h1>
                {paper.pdfVersion && paper.pdfVersion > 0 ? (
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-300">
                    PDF v{paper.pdfVersion} Generated
                  </span>
                ) : (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-300">
                    Draft Paper
                  </span>
                )}
                {isOutOfSync && (
                  <span className="rounded bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800 border border-orange-300">
                    Edited since v{paper.pdfVersion}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                {paper.class?.name} &bull; {paper.subject?.name} &bull; {paper.sections?.length || 0} Parts &bull; {paper.questions?.length || 0} Questions
              </p>
            </div>
          </div>

          {/* Center: Page Navigation & Zoom Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="inline-flex rounded-md border border-slate-300 bg-slate-100 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  viewMode === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Pages
              </button>
              <button
                type="button"
                onClick={() => setViewMode('single')}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  viewMode === 'single'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Page-by-Page
              </button>
            </div>

            {/* Page navigation (in single page mode) */}
            {viewMode === 'single' && (
              <div className="flex items-center space-x-1 border border-slate-300 rounded-md bg-white px-2 py-1 text-xs">
                <button
                  onClick={() => setActivePageIndex((p) => Math.max(1, p - 1))}
                  disabled={activePageIndex <= 1}
                  className="p-0.5 text-slate-600 hover:text-slate-900 disabled:opacity-30"
                  title="Previous Page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="font-semibold text-slate-800 px-1">
                  Page {activePageIndex} of {totalPages}
                </span>
                <button
                  onClick={() => setActivePageIndex((p) => Math.min(totalPages, p + 1))}
                  disabled={activePageIndex >= totalPages}
                  className="p-0.5 text-slate-600 hover:text-slate-900 disabled:opacity-30"
                  title="Next Page"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Zoom Controls */}
            <div className="flex items-center space-x-1 border border-slate-300 rounded-md bg-white px-2 py-1 text-xs">
              <button
                onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
                disabled={zoomLevel <= 50}
                className="p-0.5 text-slate-600 hover:text-slate-900 disabled:opacity-30"
                title="Zoom Out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="font-semibold text-slate-800 w-10 text-center">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
                disabled={zoomLevel >= 150}
                className="p-0.5 text-slate-600 hover:text-slate-900 disabled:opacity-30"
                title="Zoom In"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setZoomLevel(100)}
                className="text-[10px] text-slate-500 hover:text-slate-900 px-1 font-medium"
                title="Reset Zoom"
              >
                100%
              </button>
            </div>
          </div>

          {/* Right: Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => printExamPaper()}
              className="inline-flex items-center space-x-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
              title="Print directly using browser print dialog"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Paper</span>
            </button>

            {paper.pdfVersion && paper.pdfVersion > 0 && (
              <button
                onClick={handleDownloadOnly}
                disabled={isGenerating}
                className="inline-flex items-center space-x-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
                title="Download current PDF file directly"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download PDF</span>
              </button>
            )}

            <button
              onClick={handleGeneratePdf}
              disabled={!canGenerate}
              title={
                !validation?.isValid
                  ? 'Resolve blocking validation errors before generating PDF'
                  : 'Generate and register print-ready PDF'
              }
              className={`inline-flex items-center space-x-1.5 rounded-md px-4 py-1.5 text-xs font-semibold text-white transition-colors shadow-xs ${
                canGenerate
                  ? 'bg-slate-900 hover:bg-slate-800 cursor-pointer'
                  : 'bg-slate-400 cursor-not-allowed opacity-60'
              }`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : paper.pdfVersion && paper.pdfVersion > 0 ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Regenerate PDF (v{(paper.pdfVersion || 0) + 1})</span>
                </>
              ) : (
                <>
                  <FileCheck className="h-3.5 w-3.5" />
                  <span>Generate Final PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Generation Progress / Status Banners */}
      {generationProgress && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 flex items-center space-x-2">
          <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
          <span className="font-semibold">{generationProgress}</span>
        </div>
      )}

      {generationSuccessMessage && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{generationSuccessMessage}</span>
          </div>
          <button
            onClick={() => setGenerationSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-2"
          >
            &times;
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-700 hover:text-red-900 font-bold ml-2">
            &times;
          </button>
        </div>
      )}

      {/* Validation Status Panels */}
      {validation && !validation.isValid && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-xs text-red-900 shadow-xs space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start space-x-2.5">
              <ShieldAlert className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-bold text-sm text-red-900">
                  Paper Validation Failed ({validation.errors.length} Issue{validation.errors.length > 1 ? 's' : ''} Detected)
                </h4>
                <p className="text-xs text-red-700 mt-0.5">
                  The PDF cannot be finalized until all required validation rules are met.
                </p>
              </div>
            </div>
            {onBackToEditor && (
              <button
                onClick={onBackToEditor}
                className="inline-flex items-center space-x-1 shrink-0 rounded-md bg-red-900 text-white px-3 py-1.5 text-xs font-bold hover:bg-red-800 transition-colors shadow-2xs"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Fix in Paper Editor</span>
              </button>
            )}
          </div>

          <div className="rounded-lg bg-white/80 border border-red-200 p-3 divide-y divide-red-100">
            {validation.errors.map((err) => (
              <div key={err.id} className="py-1.5 first:pt-0 last:pb-0 flex items-start space-x-2">
                <span className="text-red-600 font-bold text-xs">&bull;</span>
                <span className="font-medium text-red-800">{err.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {validation && validation.isValid && validation.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="font-bold">
                Paper Ready for PDF Generation with {validation.warnings.length} Advisory Notice{validation.warnings.length > 1 ? 's' : ''}
              </span>
            </div>
            <button
              onClick={() => setShowWarningsDetails(!showWarningsDetails)}
              className="text-[11px] font-semibold text-amber-800 hover:text-amber-950 underline"
            >
              {showWarningsDetails ? 'Hide Notices' : 'Show Notices'}
            </button>
          </div>

          {showWarningsDetails && (
            <div className="rounded-md bg-white/80 border border-amber-200 p-2.5 divide-y divide-amber-100 text-[11px]">
              {validation.warnings.map((w) => (
                <div key={w.id} className="py-1 first:pt-0 last:pb-0 flex items-start space-x-2">
                  <span className="text-amber-600 font-bold">&bull;</span>
                  <span className="text-amber-800">{w.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {validation && validation.isValid && validation.warnings.length === 0 && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50/80 p-3 text-xs text-emerald-900 shadow-2xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-bold">
              ✓ Examination Paper Fully Validated: All scoring, parts, compulsory questions, and choice pairs verified.
            </span>
          </div>
        </div>
      )}

      {/* Main A4 Document Preview Stage */}
      <div className="bg-slate-200/80 rounded-2xl p-4 sm:p-8 flex justify-center overflow-auto border border-slate-300 shadow-inner">
        <div
          style={{
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
          }}
        >
          <DeterministicExamPaper
            paper={paper}
            activePageIndex={viewMode === 'single' ? activePageIndex : undefined}
            onTotalPagesCalculated={(total) => setTotalPages(total)}
            pageRefs={pageRefs}
          />
        </div>
      </div>
    </div>
  );
};

