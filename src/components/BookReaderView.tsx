import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Crop,
  ChevronUp,
  ChevronDown,
  Trash2,
  Check,
  RotateCcw,
  ArrowRight,
  Layers,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { SchoolPaper, SchoolResource, PaperSection, PaperQuestion } from '../types';
import { CaptureEditorModal } from './CaptureEditorModal';
import { EditPaperStructureModal } from './EditPaperStructureModal';

// Ensure PDF.js worker is loaded from local public directory (fast, zero latency)
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  if (!(Promise as any).try) {
    (Promise as any).try = (fn: any, ...args: any[]) =>
      new Promise((resolve) => resolve(fn(...args)));
  }
}

interface BookReaderViewProps {
  paperId: string;
  initialResourceId?: string;
  initialPage?: number;
  classId: string;
  subjectId: string;
  onClose: () => void;
  onFinish: () => void;
  onPaperUpdated?: () => void;
}

interface CapturedRegion {
  pageNum: number;
  dataUrl: string;
  box: { x: number; y: number; width: number; height: number };
  extractedText: string;
}

interface SingleBookPageProps {
  pageNum: number;
  pdfDoc: any;
  scale: number;
  isVisible: boolean;
  activeSelectionBox: { x: number; y: number; width: number; height: number } | null;
  onCaptureRegion: (region: CapturedRegion) => void;
}

/**
 * SingleBookPage:
 * - Renders a high-quality PDF page canvas
 * - Handles drag-selection with a visible expanding selection box
 * - Retains the active selection box over the PDF page until confirmed or retaken
 * - Captures the exact high-resolution visual region (equations, diagrams, fractions, text)
 */
const SingleBookPage: React.FC<SingleBookPageProps> = React.memo(
  ({ pageNum, pdfDoc, scale, isVisible, activeSelectionBox, onCaptureRegion }) => {
    const pageContainerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const textLayerRef = useRef<HTMLDivElement | null>(null);
    const renderTaskRef = useRef<any>(null);

    const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(
      null
    );

    // Dynamic drag selection state
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
    const [selectionBox, setSelectionBox] = useState<{
      x: number;
      y: number;
      width: number;
      height: number;
    } | null>(null);

    // Discover page aspect ratio and dimensions
    useEffect(() => {
      if (!pdfDoc) return;
      let active = true;
      pdfDoc.getPage(pageNum).then((page: any) => {
        if (!active) return;
        const vp = page.getViewport({ scale });
        setPageDimensions({ width: Math.floor(vp.width), height: Math.floor(vp.height) });
      });
      return () => {
        active = false;
      };
    }, [pdfDoc, pageNum, scale]);

    // High-DPI canvas rendering when in or near viewport
    useEffect(() => {
      if (!pdfDoc || !isVisible) return;
      let isCancelled = false;

      const renderPage = async () => {
        try {
          if (renderTaskRef.current) {
            try {
              renderTaskRef.current.cancel();
            } catch (e) {}
          }

          const page = await pdfDoc.getPage(pageNum);
          if (isCancelled) return;

          const viewport = page.getViewport({ scale });
          const canvas = canvasRef.current;
          const textContainer = textLayerRef.current;
          if (!canvas) return;

          // High resolution for clear rendering of math symbols and text
          const outputScale = Math.max(window.devicePixelRatio || 1, 1.5);
          canvas.width = Math.floor(viewport.width * outputScale);
          canvas.height = Math.floor(viewport.height * outputScale);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;

          const context = canvas.getContext('2d');
          if (!context) return;

          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);

          const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

          const renderTask = page.render({
            canvasContext: context,
            transform,
            viewport,
          });
          renderTaskRef.current = renderTask;

          await renderTask.promise;
          if (isCancelled) return;

          // Render underlying text layer for selection / accessibility
          if (textContainer) {
            textContainer.innerHTML = '';
            textContainer.style.width = `${Math.floor(viewport.width)}px`;
            textContainer.style.height = `${Math.floor(viewport.height)}px`;

            try {
              const textContent = await page.getTextContent();
              if (isCancelled) return;

              const textLayer = new pdfjsLib.TextLayer({
                textContentSource: textContent,
                container: textContainer,
                viewport,
              });
              await textLayer.render();
            } catch (textErr) {
              // Ignore non-fatal text layer warnings
            }
          }
        } catch (err: any) {
          if (err?.name !== 'RenderingCancelledException') {
            console.warn(`Render error on page ${pageNum}:`, err);
          }
        }
      };

      renderPage();

      return () => {
        isCancelled = true;
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch (e) {}
        }
      };
    }, [pdfDoc, pageNum, scale, isVisible]);

    // Drag-selection mouse handlers
    const handleMouseDown = (e: React.MouseEvent) => {
      if (e.button !== 0 || !pageContainerRef.current) return;

      const rect = pageContainerRef.current.getBoundingClientRect();
      const startX = e.clientX - rect.left;
      const startY = e.clientY - rect.top;

      setIsDragging(true);
      setDragStart({ x: startX, y: startY });
      setSelectionBox({ x: startX, y: startY, width: 0, height: 0 });
    };

    useEffect(() => {
      if (!isDragging || !dragStart || !pageContainerRef.current) return;

      const handleWindowMouseMove = (e: MouseEvent) => {
        if (!pageContainerRef.current) return;
        const rect = pageContainerRef.current.getBoundingClientRect();
        const currentX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const currentY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

        const left = Math.min(dragStart.x, currentX);
        const top = Math.min(dragStart.y, currentY);
        const width = Math.abs(currentX - dragStart.x);
        const height = Math.abs(currentY - dragStart.y);

        setSelectionBox({ x: left, y: top, width, height });
      };

      const handleWindowMouseUp = async () => {
        setIsDragging(false);
        setDragStart(null);

        if (!selectionBox || selectionBox.width < 20 || selectionBox.height < 20) {
          setSelectionBox(null);
          return;
        }

        const container = pageContainerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) {
          setSelectionBox(null);
          return;
        }

        const finalBox = { ...selectionBox };

        try {
          const rect = container.getBoundingClientRect();
          const displayedWidth = rect.width;
          const displayedHeight = rect.height;

          // Normalized coordinates (0 to 1)
          const normX = Math.max(0, finalBox.x / displayedWidth);
          const normY = Math.max(0, finalBox.y / displayedHeight);
          const normW = Math.min(1 - normX, finalBox.width / displayedWidth);
          const normH = Math.min(1 - normY, finalBox.height / displayedHeight);

          let highResDataUrl = '';
          let extractedText = '';

          // 1. High-resolution direct render from PDF page at scale 2.5 for needle-sharp math equations & diagrams
          try {
            const page = await pdfDoc.getPage(pageNum);
            const highResScale = 2.5;
            const printViewport = page.getViewport({ scale: highResScale });

            const hrPageCanvas = document.createElement('canvas');
            hrPageCanvas.width = Math.round(printViewport.width);
            hrPageCanvas.height = Math.round(printViewport.height);
            const hrCtx = hrPageCanvas.getContext('2d');

            if (hrCtx) {
              hrCtx.fillStyle = '#ffffff';
              hrCtx.fillRect(0, 0, hrPageCanvas.width, hrPageCanvas.height);

              await page.render({
                canvasContext: hrCtx,
                viewport: printViewport,
              }).promise;

              const cropX = Math.round(normX * printViewport.width);
              const cropY = Math.round(normY * printViewport.height);
              const cropW = Math.round(normW * printViewport.width);
              const cropH = Math.round(normH * printViewport.height);

              const cropCanvas = document.createElement('canvas');
              cropCanvas.width = cropW;
              cropCanvas.height = cropH;
              const cropCtx = cropCanvas.getContext('2d');

              if (cropCtx) {
                cropCtx.fillStyle = '#ffffff';
                cropCtx.fillRect(0, 0, cropW, cropH);
                cropCtx.drawImage(hrPageCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
                highResDataUrl = cropCanvas.toDataURL('image/png');
              }
            }

            // Extract underlying text items for metadata and search
            const textContent = await page.getTextContent();
            if (textContent && textContent.items) {
              const matched = textContent.items.filter((item: any) => {
                if (!item.transform) return false;
                const pdfX = item.transform[4];
                const pdfY = item.transform[5];
                const [vx, vy] = printViewport.convertToViewportPoint(pdfX, pdfY);
                return (
                  vx >= Math.round(normX * printViewport.width) - 15 &&
                  vx <= Math.round((normX + normW) * printViewport.width) + 15 &&
                  vy >= Math.round(normY * printViewport.height) - 15 &&
                  vy <= Math.round((normY + normH) * printViewport.height) + 15
                );
              });
              extractedText = matched.map((i: any) => i.str).join(' ').trim();
            }
          } catch (highResErr) {
            console.warn('High-res render error, falling back to direct canvas crop:', highResErr);
          }

          // Fallback to screen canvas if high-res failed
          if (!highResDataUrl) {
            const scaleX = canvas.width / displayedWidth;
            const scaleY = canvas.height / displayedHeight;
            const cropX = Math.floor(finalBox.x * scaleX);
            const cropY = Math.floor(finalBox.y * scaleY);
            const cropW = Math.floor(finalBox.width * scaleX);
            const cropH = Math.floor(finalBox.height * scaleY);

            const fallbackCanvas = document.createElement('canvas');
            fallbackCanvas.width = cropW;
            fallbackCanvas.height = cropH;
            const fCtx = fallbackCanvas.getContext('2d');
            if (fCtx) {
              fCtx.fillStyle = '#ffffff';
              fCtx.fillRect(0, 0, cropW, cropH);
              fCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
              highResDataUrl = fallbackCanvas.toDataURL('image/png');
            }
          }

          onCaptureRegion({
            pageNum,
            dataUrl: highResDataUrl,
            box: finalBox,
            extractedText,
          });
        } catch (captureErr) {
          console.error('Failed to capture visual region:', captureErr);
        } finally {
          setSelectionBox(null);
        }
      };

      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleWindowMouseMove);
        window.removeEventListener('mouseup', handleWindowMouseUp);
      };
    }, [isDragging, dragStart, selectionBox, pageNum, pdfDoc, scale, onCaptureRegion]);

    const displayWidth = pageDimensions?.width || Math.floor(595 * scale);
    const displayHeight = pageDimensions?.height || Math.floor(842 * scale);

    // Active box to show: either actively dragging OR the confirmed selection waiting in preview modal
    const boxToShow = isDragging ? selectionBox : activeSelectionBox;

    return (
      <div
        id={`book-page-${pageNum}`}
        data-page-number={pageNum}
        className="relative mx-auto my-4 flex flex-col items-center select-none"
        style={{ width: `${displayWidth}px`, minHeight: `${displayHeight}px` }}
      >
        <div
          ref={pageContainerRef}
          onMouseDown={handleMouseDown}
          className="relative bg-white border border-neutral-300 rounded-xs shadow-md overflow-hidden cursor-crosshair group transition-shadow hover:shadow-lg"
          style={{ width: `${displayWidth}px`, height: `${displayHeight}px` }}
        >
          {isVisible ? (
            <>
              <canvas ref={canvasRef} className="block select-none pointer-events-none" />
              <div
                ref={textLayerRef}
                className="textLayer absolute top-0 left-0 overflow-hidden pointer-events-none opacity-0"
              />
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-neutral-50 text-neutral-400">
              <span className="text-xs font-mono">Page {pageNum}</span>
            </div>
          )}

          {/* 
            Visible Selection Box:
            - Displays while dragging
            - REMAINS VISIBLE over the PDF while the Selection Preview Modal is open
          */}
          {boxToShow && (
            <div
              className={`absolute pointer-events-none z-30 transition-all ${
                isDragging
                  ? 'border-2 border-indigo-600 bg-indigo-500/20'
                  : 'border-2 border-blue-600 bg-blue-500/25 ring-2 ring-blue-400/40 shadow-sm'
              }`}
              style={{
                left: `${boxToShow.x}px`,
                top: `${boxToShow.y}px`,
                width: `${boxToShow.width}px`,
                height: `${boxToShow.height}px`,
              }}
            >
              <div className="absolute -top-6 left-0 bg-blue-600 text-white text-[10px] font-sans font-semibold px-2 py-0.5 rounded-t shadow-xs whitespace-nowrap">
                {isDragging ? 'Dragging to Select Question...' : 'Selected Question Region'}
              </div>
            </div>
          )}

          {/* Page Watermark */}
          <div className="absolute bottom-2 right-3 pointer-events-none select-none rounded bg-neutral-900/10 px-2 py-0.5 text-[11px] font-mono font-medium text-neutral-600">
            Page {pageNum}
          </div>
        </div>
      </div>
    );
  }
);

export const BookReaderView: React.FC<BookReaderViewProps> = ({
  paperId,
  initialResourceId,
  initialPage = 1,
  classId,
  subjectId,
  onClose,
  onFinish,
  onPaperUpdated,
}) => {
  // 1. Data States
  const [paper, setPaper] = useState<SchoolPaper | null>(null);
  const [resources, setResources] = useState<SchoolResource[]>([]);
  const [selectedResource, setSelectedResource] = useState<SchoolResource | null>(null);
  const [loadingPaper, setLoadingPaper] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 2. Resizable Columns (Default 55% Left / 45% Right)
  const [leftWidth, setLeftWidth] = useState<number>(55);
  const isResizingRef = useRef<boolean>(false);

  // 3. PDF Reader States
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [pageInput, setPageInput] = useState<string>('');
  const [isEditingPage, setIsEditingPage] = useState<boolean>(false);
  const [scale, setScale] = useState<number>(0.8);
  const [fitPageScale, setFitPageScale] = useState<number>(0.8);
  const [loadingPdf, setLoadingPdf] = useState<boolean>(true);

  // 4. Virtualization & Scroll Containers
  const [visiblePageSet, setVisiblePageSet] = useState<Set<number>>(new Set([initialPage]));
  const bookScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pageInputRef = useRef<HTMLInputElement | null>(null);

  // 5. Active Selection & Preview Modal State
  const [activeSelection, setActiveSelection] = useState<{
    pageNum: number;
    box: { x: number; y: number; width: number; height: number };
  } | null>(null);

  const [capturedRegion, setCapturedRegion] = useState<CapturedRegion | null>(null);
  const [captureMarks, setCaptureMarks] = useState<number>(1);
  const [captureSectionId, setCaptureSectionId] = useState<string>('');
  const [isAddingQuestion, setIsAddingQuestion] = useState<boolean>(false);

  // Structure and validation dialogs
  const [isEditStructureOpen, setIsEditStructureOpen] = useState<boolean>(false);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState<boolean>(false);

  // 6. Right-Side Paper Inline Editing
  const [editingMarksId, setEditingMarksId] = useState<string | null>(null);
  const [tempMarksVal, setTempMarksVal] = useState<number>(1);

  // 7. Toast Notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const getHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // Reload paper data quietly without reloading the book
  const reloadPaperData = async () => {
    try {
      const res = await fetch(`/api/papers/${paperId}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setPaper(data.paper);
      }
    } catch (e) {
      console.error('Failed to reload paper:', e);
    }
  };

  // Calculate full-page fit scale so the entire page is visible without cropping
  const calculateAndApplyFitPageScale = useCallback((doc: any) => {
    if (!doc || !bookScrollContainerRef.current) return;
    const container = bookScrollContainerRef.current;
    const availableW = Math.max(container.clientWidth - 48, 280);
    const availableH = Math.max(container.clientHeight - 48, 380);

    doc.getPage(1).then((page: any) => {
      const defaultVp = page.getViewport({ scale: 1.0 });
      const fitW = availableW / defaultVp.width;
      const fitH = availableH / defaultVp.height;
      // Fit whole page within container as requested
      const optimalFit = Math.min(fitW, fitH);
      const clamped = Math.max(0.55, Math.min(Number(optimalFit.toFixed(2)), 1.0));
      setFitPageScale(clamped);
      setScale(clamped);
    });
  }, []);

  // Initialize paper & resources
  useEffect(() => {
    let mounted = true;
    const loadInit = async () => {
      setLoadingPaper(true);
      setError(null);
      try {
        const [paperRes, resListRes] = await Promise.all([
          fetch(`/api/papers/${paperId}`, { headers: getHeaders() }),
          fetch(`/api/resources?classId=${classId}&subjectId=${subjectId}`, {
            headers: getHeaders(),
          }),
        ]);

        if (!paperRes.ok) throw new Error('Failed to load paper details');
        const pData = await paperRes.json();
        if (!mounted) return;

        setPaper(pData.paper);
        if (pData.paper?.sections?.length > 0) {
          setCaptureSectionId(pData.paper.sections[0].id);
        }

        let resList: SchoolResource[] = [];
        if (resListRes.ok) {
          const rData = await resListRes.json();
          resList = rData.resources || [];
        }

        if (resList.length === 0) {
          const allRes = await fetch('/api/resources', { headers: getHeaders() });
          if (allRes.ok) {
            const allData = await allRes.json();
            resList = allData.resources || [];
          }
        }

        if (!mounted) return;
        setResources(resList);

        if (resList.length > 0) {
          const matched = initialResourceId
            ? resList.find((r) => r.id === initialResourceId) || resList[0]
            : resList[0];
          setSelectedResource(matched);
        }
      } catch (err: any) {
        if (!mounted) return;
        setError(err.message || 'Error initializing workspace');
      } finally {
        if (mounted) setLoadingPaper(false);
      }
    };

    loadInit();
    return () => {
      mounted = false;
    };
  }, [paperId, classId, subjectId, initialResourceId]);

  // Load PDF Document when selectedResource changes
  useEffect(() => {
    if (!selectedResource) return;
    let isCancelled = false;
    setLoadingPdf(true);
    setPdfDoc(null);

    const loadPdf = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const fileUrl = `/api/resources/${selectedResource.id}/file${
          token ? `?auth_token=${token}` : ''
        }`;

        const task = pdfjsLib.getDocument({
          url: fileUrl,
          httpHeaders: token ? { Authorization: `Bearer ${token}` } : {},
          withCredentials: true,
          cMapUrl: '/cmaps/',
          cMapPacked: true,
          disableRange: false,
          disableStream: false,
          disableAutoFetch: true,
        });

        const doc = await task.promise;
        if (isCancelled) return;

        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setLoadingPdf(false);

        // Automatically fit PDF page so entire page is visible within left panel
        calculateAndApplyFitPageScale(doc);

        const start = Math.min(Math.max(1, initialPage), doc.numPages);
        setCurrentPage(start);

        setTimeout(() => {
          scrollToPage(start, false);
        }, 120);
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Failed to load PDF:', err);
          setError('Failed to open digital textbook. Please verify PDF file.');
          setLoadingPdf(false);
        }
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [selectedResource, initialPage, calculateAndApplyFitPageScale]);

  // Track scroll position to update current page indicator and virtualize pages
  useEffect(() => {
    const container = bookScrollContainerRef.current;
    if (!container || !pdfDoc) return;

    let debounceTimer: any = null;

    const handleScroll = () => {
      if (debounceTimer) clearTimeout(debounceTimer);

      debounceTimer = setTimeout(() => {
        const containerRect = container.getBoundingClientRect();
        const containerMidY = containerRect.top + containerRect.height / 2;

        let closestPage = currentPage;
        let minDistance = Infinity;
        const visible = new Set<number>();

        for (let p = 1; p <= totalPages; p++) {
          const el = document.getElementById(`book-page-${p}`);
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.bottom >= containerRect.top - 800 && rect.top <= containerRect.bottom + 800) {
              visible.add(p);
            }

            const pageMidY = rect.top + rect.height / 2;
            const dist = Math.abs(pageMidY - containerMidY);
            if (dist < minDistance) {
              minDistance = dist;
              closestPage = p;
            }
          }
        }

        if (visible.size > 0) {
          setVisiblePageSet(visible);
        }

        if (closestPage !== currentPage) {
          setCurrentPage(closestPage);
        }
      }, 40);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [pdfDoc, totalPages, currentPage]);

  const scrollToPage = (targetPage: number, smooth: boolean = true) => {
    const clamped = Math.min(Math.max(1, targetPage), totalPages);
    const targetEl = document.getElementById(`book-page-${clamped}`);
    if (targetEl && bookScrollContainerRef.current) {
      targetEl.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'start',
      });
      setCurrentPage(clamped);
      setVisiblePageSet((prev) => new Set([...prev, clamped]));
    }
  };

  const formatPageDisplay = (page: number, total: number) => {
    const padCount = total >= 100 ? (page < 100 ? 2 : 3) : 2;
    return String(page).padStart(padCount, '0');
  };

  const handlePageJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(pageInput.trim(), 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      scrollToPage(parsed);
    }
    setIsEditingPage(false);
  };

  // Drag divider to resize columns
  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const totalWidth = window.innerWidth;
      const newPercent = Math.min(Math.max((moveEvent.clientX / totalWidth) * 100, 30), 72);
      setLeftWidth(newPercent);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Capture Callback: stores capture and leaves rectangle visible on PDF
  const handleCapturedRegion = useCallback(
    (region: CapturedRegion) => {
      setActiveSelection({
        pageNum: region.pageNum,
        box: region.box,
      });
      setCapturedRegion(region);

      const targetSec =
        paper?.sections?.find((s) => s.id === captureSectionId) || paper?.sections?.[0];
      const defaultMarks = targetSec?.marksPerQuestion || 1;
      setCaptureMarks(defaultMarks);

      if (paper?.sections?.length) {
        setCaptureSectionId((prev) => prev || paper.sections[0].id);
      }
    },
    [paper, captureSectionId]
  );

  // Retake Selection: dismisses modal and clears the selection rectangle
  const handleRetakeSelection = () => {
    setCapturedRegion(null);
    setActiveSelection(null);
  };

  // Add Captured Question to Paper:
  // Saves visual capture, page info, and metadata. Immediately updates right paper.
  const handleAddCapturedQuestionToPaper = async (editedData?: {
    dataUrl: string;
    marks: number;
    sectionId: string;
    extractedText: string;
  }) => {
    if (!capturedRegion) return;

    const targetSectionId = editedData?.sectionId || captureSectionId;
    if (!targetSectionId) {
      alert('Please select a target Part for this question.');
      return;
    }

    const finalMarks = editedData ? editedData.marks : Number(captureMarks) || 1;
    const finalDataUrl = editedData ? editedData.dataUrl : capturedRegion.dataUrl;
    const finalText = editedData?.extractedText || capturedRegion.extractedText;

    setIsAddingQuestion(true);
    try {
      const payload = {
        sectionId: targetSectionId,
        questionText: finalText || '[Visual Question]',
        originalSourceText: finalText || null,
        marks: finalMarks,
        sourceResourceId: selectedResource?.id || null,
        sourcePageNumber: capturedRegion.pageNum,
        visualAssetUrl: finalDataUrl,
        cropCoordinates: JSON.stringify(capturedRegion.box),
      };

      const res = await fetch(`/api/papers/${paperId}/questions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to add question');
      }

      await reloadPaperData();
      if (onPaperUpdated) onPaperUpdated();

      const secName =
        paper?.sections?.find((s) => s.id === targetSectionId)?.name || 'Part';
      showToast(`Question added to ${secName} [${finalMarks} Marks]`);

      // Check if current part is now complete, and auto-switch to next unfilled Part
      const currentSec = paper?.sections?.find((s) => s.id === targetSectionId);
      if (currentSec) {
        const newCount = (currentSec.questions?.length || 0) + 1;
        const targetCount = currentSec.questionsProvided || currentSec.targetQuestions || 0;
        if (targetCount > 0 && newCount >= targetCount) {
          const nextIncomplete = paper?.sections?.find(
            (s) =>
              s.id !== targetSectionId &&
              (s.questions?.length || 0) < (s.questionsProvided || s.targetQuestions || 0)
          );
          if (nextIncomplete) {
            setCaptureSectionId(nextIncomplete.id);
            if (nextIncomplete.marksPerQuestion) {
              setCaptureMarks(nextIncomplete.marksPerQuestion);
            }
            showToast(`${secName} target filled! Active part switched to ${nextIncomplete.name}`);
          }
        }
      }

      // Clear preview and active selection; left book stays at exact same scroll position
      setCapturedRegion(null);
      setActiveSelection(null);
    } catch (err: any) {
      alert(err.message || 'Failed to add question to paper');
    } finally {
      setIsAddingQuestion(false);
    }
  };

  // Attempt finish with structure validation
  const handleAttemptFinish = () => {
    if (!paper?.sections || paper.sections.length === 0) {
      onFinish();
      return;
    }
    const incompleteParts = paper.sections.filter(
      (sec) =>
        (sec.questions?.length || 0) <
        (sec.questionsToAnswer || sec.questionsProvided || sec.targetQuestions || 1)
    );
    if (incompleteParts.length > 0) {
      setIsValidationModalOpen(true);
    } else {
      onFinish();
    }
  };

  // Delete Question
  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Remove this question from the paper?')) return;
    try {
      const res = await fetch(`/api/papers/${paperId}/questions/${questionId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        await reloadPaperData();
        if (onPaperUpdated) onPaperUpdated();
        showToast('Question removed from paper');
      }
    } catch (e) {
      alert('Failed to delete question');
    }
  };

  // Move Question Up/Down
  const handleMoveQuestion = async (questionId: string, direction: 'UP' | 'DOWN') => {
    try {
      const res = await fetch(`/api/papers/${paperId}/questions/${questionId}/reorder`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ direction }),
      });
      if (res.ok) {
        await reloadPaperData();
        if (onPaperUpdated) onPaperUpdated();
      }
    } catch (e) {
      console.error('Failed to reorder question:', e);
    }
  };

  // Save Marks Edit
  const handleSaveMarksEdit = async (questionId: string) => {
    try {
      const res = await fetch(`/api/papers/${paperId}/questions/${questionId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ marks: Number(tempMarksVal) || 1 }),
      });
      if (res.ok) {
        setEditingMarksId(null);
        await reloadPaperData();
        if (onPaperUpdated) onPaperUpdated();
      }
    } catch (e) {
      alert('Failed to update marks');
    }
  };

  // Marks Calculation
  const totalAllocatedMarks =
    paper?.sections?.reduce((sum, sec) => {
      return (
        sum +
        (sec.questions?.reduce((qSum, q) => qSum + (q.marks || 0), 0) || 0) +
        (sec.choiceGroups?.reduce((cSum, cg) => cSum + (cg.marks || 0), 0) || 0)
      );
    }, 0) || 0;

  const totalQuestionsCount =
    paper?.sections?.reduce((count, sec) => count + (sec.questions?.length || 0), 0) || 0;

  const totalTargetQuestions =
    paper?.sections?.reduce(
      (count, sec) => count + (sec.targetQuestions || sec.questions?.length || 0),
      0
    ) || 0;

  let globalQuestionCounter = 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-900 text-neutral-900 select-none overflow-hidden">
      {/* ------------------------------------------------------------- */}
      {/* WORKSPACE HEADER BAR                                          */}
      {/* ------------------------------------------------------------- */}
      <header className="flex h-13 shrink-0 items-center justify-between border-b border-neutral-300 bg-white px-4 shadow-xs z-30">
        {/* Left Section: Back to Editor & Book Selector */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onClose}
            className="flex items-center space-x-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
            title="Return to Paper Editor"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Back to Editor</span>
          </button>

          <div className="h-4 w-px bg-neutral-200" />

          {/* Book / Resource Switcher */}
          <div className="flex items-center space-x-2">
            <BookOpen className="h-4 w-4 text-neutral-600 hidden md:block" />
            {resources.length > 1 ? (
              <select
                value={selectedResource?.id || ''}
                onChange={(e) => {
                  const found = resources.find((r) => r.id === e.target.value);
                  if (found) {
                    setSelectedResource(found);
                    setCurrentPage(1);
                  }
                }}
                className="max-w-[200px] sm:max-w-xs truncate rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-800 focus:border-neutral-500 focus:outline-none"
              >
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs font-semibold text-neutral-800 max-w-[180px] sm:max-w-xs truncate">
                {selectedResource?.name || 'Curriculum Textbook'}
              </span>
            )}
            <span className="hidden xl:inline text-[11px] text-neutral-500">
              ({paper?.subject?.name || 'Subject'})
            </span>
          </div>
        </div>

        {/* Center: Zoom Controls, Fit Page & Direct Page Jump */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Zoom controls & Fit Page */}
          <div className="flex items-center rounded-md border border-neutral-300 bg-neutral-50 p-0.5">
            <button
              onClick={() => setScale((s) => Math.max(0.5, Number((s - 0.1).toFixed(2))))}
              className="rounded p-1 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 text-[11px] font-mono font-medium text-neutral-700 select-none">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale((s) => Math.min(2.2, Number((s + 0.1).toFixed(2))))}
              className="rounded p-1 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <div className="h-3 w-px bg-neutral-300 mx-0.5" />
            <button
              onClick={() => {
                if (pdfDoc) {
                  calculateAndApplyFitPageScale(pdfDoc);
                } else {
                  setScale(fitPageScale);
                }
              }}
              className="flex items-center space-x-1 rounded px-1.5 py-0.5 text-[10px] font-sans font-semibold text-neutral-700 hover:bg-neutral-200 hover:text-neutral-900 transition-colors"
              title="Fit Entire Page to View"
            >
              <Maximize2 className="h-3 w-3" />
              <span className="hidden md:inline">Fit Page</span>
            </button>
          </div>

          {/* Page Jump: [ 09 / 344 ] */}
          <div className="flex items-center rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-mono text-neutral-800 shadow-2xs">
            {isEditingPage ? (
              <form onSubmit={handlePageJumpSubmit} className="flex items-center space-x-1">
                <input
                  ref={pageInputRef}
                  type="number"
                  min="1"
                  max={totalPages}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onBlur={() => setIsEditingPage(false)}
                  autoFocus
                  placeholder={String(currentPage)}
                  className="w-12 rounded border border-neutral-400 px-1 py-0.5 text-center text-xs font-mono font-bold text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
                <span className="text-neutral-400">/</span>
                <span className="text-neutral-600">{totalPages}</span>
                <button
                  type="submit"
                  className="ml-1 rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] font-sans font-medium text-white"
                >
                  Go
                </button>
              </form>
            ) : (
              <button
                onClick={() => {
                  setPageInput(String(currentPage));
                  setIsEditingPage(true);
                }}
                className="group flex items-center space-x-1.5 hover:text-neutral-950"
                title="Click to jump directly to page (e.g. 150)"
              >
                <span className="font-bold underline decoration-neutral-400 underline-offset-2 group-hover:decoration-neutral-900">
                  {formatPageDisplay(currentPage, totalPages)}
                </span>
                <span className="text-neutral-400">/</span>
                <span className="text-neutral-500">{totalPages}</span>
              </button>
            )}
          </div>

          {/* Tool status pill */}
          <div className="hidden lg:flex items-center space-x-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-600">
            <Crop className="h-3 w-3 text-neutral-500" />
            <span>Drag over question to capture</span>
          </div>
        </div>

        {/* Right Section: Marks summary, Structure button & Finish */}
        <div className="flex items-center space-x-3">
          <div className="hidden md:flex items-center space-x-3 text-xs">
            <div className="flex items-center space-x-1.5">
              <span className="text-neutral-500">Marks:</span>
              <span
                className={`font-mono font-bold ${
                  paper && totalAllocatedMarks === paper.totalMarks
                    ? 'text-emerald-600'
                    : 'text-neutral-900'
                }`}
              >
                {totalAllocatedMarks} / {paper?.totalMarks || 0}
              </span>
            </div>

            <div className="h-3 w-px bg-neutral-300" />

            <div className="flex items-center space-x-1.5">
              <span className="text-neutral-500">Questions:</span>
              <span className="font-mono font-bold text-neutral-900">
                {totalQuestionsCount} / {totalTargetQuestions || totalQuestionsCount}
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsEditStructureOpen(true)}
            className="hidden sm:inline-flex items-center space-x-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors shadow-2xs"
            title="Edit Parts and Questions Structure"
          >
            <Layers className="h-3.5 w-3.5 text-blue-600" />
            <span>Edit Structure</span>
          </button>

          <button
            onClick={handleAttemptFinish}
            className="flex items-center space-x-1.5 rounded-md bg-neutral-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 transition-colors shadow-xs"
          >
            <span>Finish</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* TWO-COLUMN PERSISTENT WORKSPACE                               */}
      {/* ------------------------------------------------------------- */}
      <div className="relative flex flex-1 overflow-hidden bg-neutral-200">
        {/* ============================================================= */}
        {/* LEFT COLUMN: PDF / BOOK VIEWER (Full Page Default)            */}
        {/* ============================================================= */}
        <div
          style={{ width: `${leftWidth}%` }}
          className="relative flex flex-col h-full overflow-hidden bg-neutral-200/80 border-r border-neutral-300"
        >
          <div
            ref={bookScrollContainerRef}
            className="relative flex-1 overflow-y-auto p-3 sm:p-5"
          >
            {loadingPdf ? (
              <div className="flex h-96 flex-col items-center justify-center space-y-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent" />
                <p className="text-xs font-medium text-neutral-600">
                  Fitting and loading digital textbook...
                </p>
              </div>
            ) : error ? (
              <div className="mx-auto max-w-md my-12 rounded-lg border border-neutral-300 bg-white p-6 text-center shadow-xs">
                <AlertCircle className="mx-auto h-8 w-8 text-neutral-400" />
                <h3 className="mt-2 text-sm font-bold text-neutral-900">
                  Unable to load digital textbook
                </h3>
                <p className="mt-1 text-xs text-neutral-600">{error}</p>
                <button
                  onClick={() => {
                    setError(null);
                    setLoadingPdf(true);
                  }}
                  className="mt-4 inline-flex items-center space-x-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Retry</span>
                </button>
              </div>
            ) : pdfDoc ? (
              <div className="mx-auto flex flex-col items-center pb-28">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <SingleBookPage
                    key={pageNum}
                    pageNum={pageNum}
                    pdfDoc={pdfDoc}
                    scale={scale}
                    isVisible={visiblePageSet.has(pageNum)}
                    activeSelectionBox={
                      activeSelection?.pageNum === pageNum ? activeSelection.box : null
                    }
                    onCaptureRegion={handleCapturedRegion}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* ============================================================= */}
        {/* RESIZABLE DIVIDER SPLITTER                                    */}
        {/* ============================================================= */}
        <div
          onMouseDown={handleMouseDownResize}
          className="w-1.5 hover:w-2 bg-neutral-300 hover:bg-neutral-400 active:bg-neutral-900 cursor-col-resize z-20 flex items-center justify-center transition-all group select-none shrink-0"
          title="Drag to resize columns (Double click to reset 55/45)"
          onDoubleClick={() => setLeftWidth(55)}
        >
          <div className="w-0.5 h-8 bg-neutral-400 group-hover:bg-neutral-600 rounded-full" />
        </div>

        {/* ============================================================= */}
        {/* RIGHT COLUMN: LIVE QUESTION PAPER PANEL                       */}
        {/* ============================================================= */}
        <div
          style={{ width: `${100 - leftWidth}%` }}
          className="relative flex flex-col h-full overflow-y-auto bg-neutral-100 p-4 sm:p-6"
        >
          {/* Sticky Part Switcher & Paper Controls Header */}
          <div className="mx-auto w-full max-w-[780px] mb-4 bg-white rounded-lg border border-neutral-300 p-3 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2 flex-wrap">
              <span className="text-xs font-bold text-neutral-600 uppercase tracking-wide">
                Target Part:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {paper?.sections?.map((sec) => {
                  const qCount = sec.questions?.length || 0;
                  const targetQ = sec.targetQuestions || qCount;
                  const isComplete = targetQ > 0 && qCount >= targetQ;
                  const isActive = captureSectionId === sec.id;

                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => {
                        setCaptureSectionId(sec.id);
                        if (sec.marksPerQuestion) {
                          setCaptureMarks(sec.marksPerQuestion);
                        }
                        showToast(`Target Part switched to ${sec.name}`);
                      }}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-neutral-900 text-white shadow-xs ring-2 ring-neutral-900/20'
                          : isComplete
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                          : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border border-neutral-200'
                      }`}
                      title={`${sec.name}: ${qCount} of ${targetQ} questions selected`}
                    >
                      <span>{sec.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                          isActive
                            ? 'bg-neutral-800 text-neutral-100'
                            : 'bg-white/90 text-neutral-700 border border-neutral-300'
                        }`}
                      >
                        {qCount}/{targetQ}
                      </span>
                      {isComplete && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setIsEditStructureOpen(true)}
                className="inline-flex items-center space-x-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md border border-blue-200 transition-colors shadow-2xs"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Edit Structure</span>
              </button>
            </div>
          </div>

          {/* Printable Question Paper Surface in Times New Roman */}
          <div className="mx-auto w-full max-w-[780px] bg-white border border-neutral-300 shadow-md p-8 sm:p-10 font-exam text-black min-h-[900px] flex flex-col justify-between">
            {/* Examination Header */}
            <div>
              {/* School Name */}
              <h1 className="text-center font-bold text-xl tracking-wide uppercase font-exam">
                {paper?.schoolName || 'CENTRAL MODEL SENIOR SECONDARY SCHOOL'}
              </h1>

              {/* Examination Title */}
              <h2 className="text-center font-bold text-base mt-1 tracking-normal uppercase font-exam">
                {paper?.examinationName || 'ANNUAL EXAMINATION'}
              </h2>

              {/* Exam Metadata Grid */}
              <div className="mt-4 pt-2 border-t-2 border-black flex items-center justify-between text-sm font-semibold font-exam">
                <div>
                  <span>Class: </span>
                  <span className="font-normal">{paper?.class?.name || 'Class X'}</span>
                  {paper?.class?.section && (
                    <span className="font-normal"> ({paper.class.section})</span>
                  )}
                </div>
                <div>
                  <span>Subject: </span>
                  <span className="font-normal">{paper?.subject?.name || 'Mathematics'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm font-semibold pb-2 border-b border-black font-exam">
                <div>
                  <span>Time Allowed: </span>
                  <span className="font-normal">{paper?.duration || '3 Hours'}</span>
                </div>
                <div>
                  <span>Maximum Marks: </span>
                  <span className="font-normal">{paper?.totalMarks || 80}</span>
                </div>
              </div>

              {/* Parts & Questions */}
              <div className="mt-6 space-y-8">
                {(!paper?.sections || paper.sections.length === 0) && (
                  <div className="py-12 text-center text-neutral-400 font-sans text-xs">
                    No parts configured in this paper yet.
                  </div>
                )}

                {paper?.sections?.map((section) => {
                  const sectionQuestions = section.questions || [];
                  const providedCount = Number(section.questionsProvided || section.targetQuestions || sectionQuestions.length || 0);
                  const toAnswerCount = Number(section.questionsToAnswer || section.targetQuestions || providedCount || 0);
                  const marksPerQ = Number(section.marksPerQuestion) || 1;
                  const partTotalMarks = toAnswerCount * marksPerQ;
                  const remainingSlotCount = Math.max(0, providedCount - sectionQuestions.length);

                  const compulsoryNums = section.compulsoryQuestions
                    ? section.compulsoryQuestions
                        .split(',')
                        .map((s) => parseInt(s.trim(), 10))
                        .filter((n) => !isNaN(n))
                    : [];

                  return (
                    <div key={section.id} className="space-y-4">
                      {/* Part Title & Marks Breakdown */}
                      <div className="text-center border-b border-neutral-200 pb-2">
                        <h3 className="font-bold text-base tracking-wider uppercase font-exam">
                          {section.name.toUpperCase().startsWith('PART')
                            ? section.name.toUpperCase()
                            : `PART ${section.name.toUpperCase()}`}
                        </h3>
                        <div className="text-xs font-exam text-neutral-700 mt-0.5">
                          <span>
                            ({toAnswerCount} &times; {marksPerQ} = {partTotalMarks} Marks)
                            {providedCount !== toAnswerCount && (
                              <span className="ml-1 text-neutral-500">
                                &bull; {providedCount} Questions Provided
                              </span>
                            )}
                          </span>
                        </div>
                        {section.instructions && (
                          <p className="text-sm font-semibold italic text-neutral-800 font-exam mt-1">
                            {section.instructions}
                          </p>
                        )}
                      </div>

                      {/* Part Questions & Empty Slots */}
                      <div className="space-y-3">
                        {sectionQuestions.map((q, qIdx) => {
                          globalQuestionCounter += 1;
                          const currentQNum = globalQuestionCounter;
                          const isFirst = qIdx === 0;
                          const isLast = qIdx === sectionQuestions.length - 1;
                          const isCompulsory = q.isCompulsory || compulsoryNums.includes(currentQNum);

                          return (
                            <div
                              key={q.id}
                              className="group relative flex items-start justify-between gap-3 py-3 border-b border-neutral-200/80 hover:bg-neutral-50/50 rounded px-1.5 transition-colors font-exam"
                            >
                              {/* Left: Question Number - standardized width & alignment with [Compulsory] tag */}
                              <div className="shrink-0 text-right pr-2 pt-0.5 font-bold text-base select-none font-exam text-neutral-900 flex items-center space-x-1.5">
                                <span>{currentQNum}.</span>
                                {isCompulsory && (
                                  <span className="text-[11px] font-bold font-exam text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-300">
                                    [Compulsory]
                                  </span>
                                )}
                              </div>

                              {/* Middle: Standardized question content */}
                              <div className="flex-1 min-w-0 font-exam">
                                {/* Primary Visual Representation: razor-sharp crop with optical scaling */}
                                {q.visualAssetUrl ? (
                                  <div className="my-0.5 max-w-full overflow-hidden">
                                    <img
                                      src={q.visualAssetUrl}
                                      alt={`Question ${currentQNum}`}
                                      className="max-w-full h-auto max-h-[340px] object-contain object-left block select-none"
                                      style={{
                                        imageRendering: '-webkit-optimize-contrast' as any,
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <p className="text-base leading-relaxed font-exam text-neutral-900 whitespace-pre-line">
                                    {q.questionText}
                                  </p>
                                )}

                                {/* Source Traceability Badge */}
                                <div className="mt-1 flex items-center space-x-2 text-[10px] font-sans text-neutral-400">
                                  {q.sourcePageNumber && (
                                    <span>Page {q.sourcePageNumber}</span>
                                  )}
                                  {q.sourceResource?.name && (
                                    <span>• {q.sourceResource.name}</span>
                                  )}
                                </div>
                              </div>

                              {/* Right: Cleanly Aligned Marks [ 2 ] + Controls */}
                              <div className="w-20 shrink-0 text-right pt-0.5 select-none font-exam flex flex-col items-end">
                                {editingMarksId === q.id ? (
                                  <div className="flex items-center space-x-1 font-sans">
                                    <input
                                      type="number"
                                      min="1"
                                      max="50"
                                      value={tempMarksVal}
                                      onChange={(e) =>
                                        setTempMarksVal(parseInt(e.target.value, 10) || 1)
                                      }
                                      className="w-12 rounded border border-neutral-400 px-1 py-0.5 text-center text-xs font-bold"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => handleSaveMarksEdit(q.id)}
                                      className="rounded bg-neutral-900 p-1 text-white hover:bg-neutral-800"
                                      title="Save Marks"
                                    >
                                      <Check className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={() => setEditingMarksId(null)}
                                      className="rounded bg-neutral-200 p-1 text-neutral-700 hover:bg-neutral-300"
                                      title="Cancel"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setEditingMarksId(q.id);
                                      setTempMarksVal(q.marks);
                                    }}
                                    className="font-bold text-base font-exam text-neutral-900 hover:underline hover:text-black px-1 py-0.5 rounded"
                                    title="Click to change marks"
                                  >
                                    [{q.marks}]
                                  </button>
                                )}

                                {/* Hover Actions: Move Up / Down, Delete */}
                                <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-0.5 font-sans transition-opacity mt-1">
                                  <button
                                    onClick={() => handleMoveQuestion(q.id, 'UP')}
                                    disabled={isFirst}
                                    className="p-1 rounded text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200 disabled:opacity-30"
                                    title="Move Up"
                                  >
                                    <ChevronUp className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => handleMoveQuestion(q.id, 'DOWN')}
                                    disabled={isLast}
                                    className="p-1 rounded text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200 disabled:opacity-30"
                                    title="Move Down"
                                  >
                                    <ChevronDown className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteQuestion(q.id)}
                                    className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                    title="Remove from paper"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Unfilled Target Question Slots */}
                        {remainingSlotCount > 0 &&
                          Array.from({ length: remainingSlotCount }).map((_, slotIdx) => {
                            globalQuestionCounter += 1;
                            const slotQNum = globalQuestionCounter;
                            const isNextSlot = slotIdx === 0 && captureSectionId === section.id;
                            const isSlotCompulsory = compulsoryNums.includes(slotQNum);

                            return (
                              <div
                                key={`empty-slot-${section.id}-${slotIdx}`}
                                onClick={() => {
                                  setCaptureSectionId(section.id);
                                  if (section.marksPerQuestion) {
                                    setCaptureMarks(section.marksPerQuestion);
                                  }
                                  showToast(`Target Part set to ${section.name} (Next: Q.${slotQNum})`);
                                }}
                                className={`group flex items-center justify-between gap-3 py-2.5 px-3 rounded border transition-all cursor-pointer font-exam ${
                                  isNextSlot
                                    ? 'border-blue-400 bg-blue-50/60 ring-1 ring-blue-300'
                                    : 'border-dashed border-neutral-300 bg-neutral-50/40 hover:bg-neutral-100 hover:border-neutral-400'
                                }`}
                                title="Click to select this Part as the target for question selection"
                              >
                                <div className="flex items-center space-x-2">
                                  <span className="w-8 text-right font-bold text-base font-exam text-neutral-400 select-none">
                                    {slotQNum}.
                                  </span>
                                  {isSlotCompulsory && (
                                    <span className="text-[11px] font-bold font-exam text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                      [Compulsory]
                                    </span>
                                  )}
                                  <span className="text-xs font-sans text-neutral-500">
                                    {isNextSlot ? (
                                      <span className="font-semibold text-blue-700">
                                        Next Question Slot &bull; Drag-select question from book on left to fill
                                      </span>
                                    ) : (
                                      <span className="text-neutral-400 group-hover:text-neutral-600">
                                        [ Empty Question Slot &bull; Click to target {section.name} ]
                                      </span>
                                    )}
                                  </span>
                                </div>

                                <div className="w-20 text-right font-bold text-base font-exam text-neutral-400 select-none">
                                  [{section.marksPerQuestion || 1}]
                                </div>
                              </div>
                            );
                          })}

                        {/* Option to Add Additional Question to this Part */}
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setCaptureSectionId(section.id);
                              if (section.marksPerQuestion) {
                                setCaptureMarks(section.marksPerQuestion);
                              }
                              showToast(
                                `Target Part set to ${section.name} (inherits default ${section.marksPerQuestion || 1} Marks). Drag-select on book to add.`
                              );
                            }}
                            className={`w-full flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded text-xs font-sans transition-colors border ${
                              captureSectionId === section.id
                                ? 'bg-blue-50 border-blue-300 text-blue-800 font-semibold'
                                : 'border-dashed border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-600'
                            }`}
                          >
                            <Plus className="h-3.5 w-3.5 text-neutral-500" />
                            <span>
                              {captureSectionId === section.id
                                ? `Active Selection Target: ${section.name} (${section.marksPerQuestion || 1} Marks)`
                                : `+ Add Question to ${section.name} (inherits ${section.marksPerQuestion || 1} Marks)`}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Paper Panel Sticky Actions */}
            <div className="mt-12 pt-6 border-t border-neutral-200 flex items-center justify-between font-sans">
              <button
                onClick={() => {
                  if (bookScrollContainerRef.current) {
                    bookScrollContainerRef.current.focus();
                  }
                  showToast('Ready to select next question on the left textbook');
                }}
                className="inline-flex items-center space-x-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 transition-colors shadow-2xs"
              >
                <Crop className="h-3.5 w-3.5 text-neutral-600" />
                <span>Continue Selecting</span>
              </button>

              <button
                onClick={handleAttemptFinish}
                className="inline-flex items-center space-x-1.5 rounded-md bg-neutral-900 px-5 py-2 text-xs font-semibold text-white hover:bg-neutral-800 transition-colors shadow-xs"
              >
                <span>Finish</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* CONFIRMATION FLOW: CAPTURE EDITOR & PREVIEW MODAL             */}
      {/* ------------------------------------------------------------- */}
      {capturedRegion && (
        <CaptureEditorModal
          isOpen={!!capturedRegion}
          onClose={handleRetakeSelection}
          capturedRegion={capturedRegion}
          resourceName={selectedResource?.name}
          sections={paper?.sections || []}
          activeSectionId={captureSectionId}
          defaultMarks={
            paper?.sections?.find((s) => s.id === captureSectionId)?.marksPerQuestion || 1
          }
          onConfirm={handleAddCapturedQuestionToPaper}
          onRetake={handleRetakeSelection}
        />
      )}

      {/* Structure Editor Modal */}
      {isEditStructureOpen && paper && (
        <EditPaperStructureModal
          isOpen={isEditStructureOpen}
          paper={paper}
          onClose={() => setIsEditStructureOpen(false)}
          onSaved={(updatedPaper) => {
            setPaper(updatedPaper);
            if (onPaperUpdated) onPaperUpdated();
            showToast('Paper structure updated successfully');
          }}
        />
      )}

      {/* Validation Notice Modal */}
      {isValidationModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs font-sans">
          <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center space-x-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">Paper Structure Notice</h3>
                  <p className="text-xs text-neutral-500">Some Parts have unfilled question slots</p>
                </div>
              </div>
              <button
                onClick={() => setIsValidationModalOpen(false)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {paper?.sections?.map((sec) => {
                const qCount = sec.questions?.length || 0;
                const targetQ = sec.targetQuestions || qCount;
                const isComplete = targetQ > 0 && qCount >= targetQ;

                return (
                  <div
                    key={sec.id}
                    className={`flex items-center justify-between rounded-lg p-2.5 border text-xs ${
                      isComplete
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                        : 'bg-amber-50/70 border-amber-200 text-amber-900'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="font-bold">{sec.name}</span>
                      <span className="text-[11px] text-neutral-500 font-normal">
                        ({sec.marksPerQuestion || 1} mark{(sec.marksPerQuestion || 1) > 1 ? 's' : ''}/q)
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold">
                        {qCount} / {targetQ} questions
                      </span>
                      {isComplete ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <span className="text-[10px] font-semibold bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded">
                          {targetQ - qCount} needed
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-lg bg-neutral-100 p-2.5 text-xs text-neutral-700 flex items-center justify-between">
              <span className="font-medium">Total Allocated Marks:</span>
              <span className="font-bold font-mono text-neutral-900">
                {totalAllocatedMarks} / {paper?.totalMarks || 0} Marks
              </span>
            </div>

            <div className="flex items-center justify-between space-x-2 pt-4 border-t border-neutral-100 mt-4">
              <button
                type="button"
                onClick={() => {
                  setIsValidationModalOpen(false);
                  const firstIncomplete = paper?.sections?.find(
                    (s) => (s.questions?.length || 0) < (s.targetQuestions || 0)
                  );
                  if (firstIncomplete) {
                    setCaptureSectionId(firstIncomplete.id);
                    if (firstIncomplete.marksPerQuestion) {
                      setCaptureMarks(firstIncomplete.marksPerQuestion);
                    }
                    showToast(`Target Part set to ${firstIncomplete.name}`);
                  }
                }}
                className="rounded-md border border-neutral-300 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors shadow-2xs"
              >
                Continue Selecting
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsValidationModalOpen(false);
                  onFinish();
                }}
                className="inline-flex items-center space-x-1.5 rounded-md bg-neutral-900 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800 transition-colors shadow-xs"
              >
                <span>Finish Anyway</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-70 flex items-center space-x-2 rounded-md bg-neutral-900 px-4 py-2.5 text-xs font-medium text-white shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
