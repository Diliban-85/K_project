import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  BookOpen,
  AlertCircle,
  RotateCcw,
  Copy,
  Check,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Ensure PDF.js worker is loaded from local public directory (fast, 0 latency)
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  if (!(Promise as any).try) {
    (Promise as any).try = (fn: any, ...args: any[]) =>
      new Promise((resolve) => resolve(fn(...args)));
  }
}

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  resourceId: string;
  resourceTitle: string;
  initialPage?: number;
}

interface SinglePdfPageProps {
  pageNum: number;
  pdfDoc: any;
  scale: number;
  isVisible: boolean;
}

const SinglePdfPage: React.FC<SinglePdfPageProps> = React.memo(
  ({ pageNum, pdfDoc, scale, isVisible }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const textLayerRef = useRef<HTMLDivElement | null>(null);
    const renderTaskRef = useRef<any>(null);
    const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(
      null
    );

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

          const outputScale = window.devicePixelRatio || 1;
          canvas.width = Math.floor(viewport.width * outputScale);
          canvas.height = Math.floor(viewport.height * outputScale);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;

          const context = canvas.getContext('2d');
          if (!context) return;

          const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

          const renderTask = page.render({
            canvasContext: context,
            transform,
            viewport,
          });
          renderTaskRef.current = renderTask;

          await renderTask.promise;
          if (isCancelled) return;

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
              console.warn(`Text layer warning on page ${pageNum}:`, textErr);
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

    const displayWidth = pageDimensions?.width || Math.floor(750 * scale);
    const displayHeight = pageDimensions?.height || Math.floor(1060 * scale);

    return (
      <div
        id={`viewer-page-${pageNum}`}
        data-page-number={pageNum}
        className="relative mx-auto my-6 flex flex-col items-center select-text"
        style={{ width: `${displayWidth}px`, minHeight: `${displayHeight}px` }}
      >
        <div
          className="relative bg-white border border-neutral-300 rounded-sm shadow-md transition-shadow hover:shadow-lg overflow-hidden"
          style={{ width: `${displayWidth}px`, height: `${displayHeight}px` }}
        >
          {isVisible ? (
            <>
              <canvas ref={canvasRef} className="block select-none" />
              <div
                ref={textLayerRef}
                className="textLayer absolute top-0 left-0 overflow-hidden pointer-events-auto select-text"
              />
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-neutral-50 text-neutral-400">
              <span className="text-xs font-mono">Page {pageNum}</span>
            </div>
          )}

          <div className="absolute bottom-2 right-4 pointer-events-none select-none rounded bg-neutral-900/10 px-2 py-0.5 text-[11px] font-mono font-medium text-neutral-600">
            Page {pageNum}
          </div>
        </div>
      </div>
    );
  }
);

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  isOpen,
  onClose,
  resourceId,
  resourceTitle,
  initialPage = 1,
}) => {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.15);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Jump input state
  const [isEditingPage, setIsEditingPage] = useState<boolean>(false);
  const [pageInput, setPageInput] = useState<string>('');

  // Virtualization visibility
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([initialPage]));
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen || !resourceId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setPdfDoc(null);

    const loadDoc = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const fileUrl = `/api/resources/${resourceId}/file${token ? `?auth_token=${token}` : ''}`;

        const loadingTask = pdfjsLib.getDocument({
          url: fileUrl,
          httpHeaders: token ? { Authorization: `Bearer ${token}` } : {},
          withCredentials: true,
          cMapUrl: '/cmaps/',
          cMapPacked: true,
          disableRange: false,
          disableStream: false,
          disableAutoFetch: true,
        });

        const doc = await loadingTask.promise;
        if (!isMounted) return;

        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setLoading(false);

        const startPage = Math.min(Math.max(1, initialPage), doc.numPages);
        setCurrentPage(startPage);

        setTimeout(() => {
          scrollToPage(startPage, false);
        }, 150);
      } catch (err: any) {
        if (!isMounted) return;
        console.error('Failed to open PDF:', err);
        setError('Failed to open document. Please verify document format.');
        setLoading(false);
      }
    };

    loadDoc();

    return () => {
      isMounted = false;
    };
  }, [isOpen, resourceId, initialPage]);

  // Track scroll position to update current page and virtualize visible pages
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !pdfDoc || !isOpen) return;

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
          const el = document.getElementById(`viewer-page-${p}`);
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
          setVisiblePages(visible);
        }

        if (closestPage !== currentPage) {
          setCurrentPage(closestPage);
        }
      }, 50);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [pdfDoc, totalPages, currentPage, isOpen]);

  const scrollToPage = (targetPage: number, smooth: boolean = true) => {
    const clamped = Math.min(Math.max(1, targetPage), totalPages);
    const targetEl = document.getElementById(`viewer-page-${clamped}`);
    if (targetEl && scrollContainerRef.current) {
      targetEl.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'start',
      });
      setCurrentPage(clamped);
      setVisiblePages((prev) => new Set([...prev, clamped]));
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-100 text-neutral-900 select-none">
      {/* Reader Toolbar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-300 bg-white px-4 shadow-xs">
        <div className="flex items-center space-x-3">
          <button
            onClick={onClose}
            className="flex items-center space-x-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            <span>Close</span>
          </button>

          <div className="h-4 w-px bg-neutral-200" />

          <div className="flex items-center space-x-2">
            <BookOpen className="h-4 w-4 text-neutral-600 hidden sm:block" />
            <span className="text-xs font-semibold text-neutral-800 max-w-[200px] sm:max-w-md truncate">
              {resourceTitle}
            </span>
          </div>
        </div>

        {/* Center: Zoom and Page Jump [ 09 / 344 ] */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center rounded-md border border-neutral-300 bg-neutral-50 p-0.5">
            <button
              onClick={() => setScale((s) => Math.max(0.75, Number((s - 0.15).toFixed(2))))}
              className="rounded p-1 text-neutral-600 hover:bg-neutral-200"
              title="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 text-[11px] font-mono font-medium text-neutral-700">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale((s) => Math.min(2.0, Number((s + 0.15).toFixed(2))))}
              className="rounded p-1 text-neutral-600 hover:bg-neutral-200"
              title="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Page Jump Control */}
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
                title="Click to jump to page"
              >
                <span className="font-bold underline decoration-neutral-400 underline-offset-2 group-hover:decoration-neutral-900">
                  {formatPageDisplay(currentPage, totalPages)}
                </span>
                <span className="text-neutral-400">/</span>
                <span className="text-neutral-500">{totalPages}</span>
              </button>
            )}
          </div>
        </div>

        <div>
          <button
            onClick={onClose}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 transition-colors"
          >
            Done Reading
          </button>
        </div>
      </header>

      {/* Main Continuous Scroll Area */}
      <div
        ref={scrollContainerRef}
        className="relative flex-1 overflow-y-auto bg-neutral-200/70 p-4 sm:p-6"
      >
        {loading ? (
          <div className="flex h-96 flex-col items-center justify-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent" />
            <p className="text-xs font-medium text-neutral-600">Opening digital textbook...</p>
          </div>
        ) : error ? (
          <div className="mx-auto max-w-md my-12 rounded-lg border border-neutral-300 bg-white p-6 text-center shadow-xs">
            <AlertCircle className="mx-auto h-8 w-8 text-neutral-400" />
            <h3 className="mt-2 text-sm font-bold text-neutral-900">Unable to load document</h3>
            <p className="mt-1 text-xs text-neutral-600">{error}</p>
            <button
              onClick={() => {
                setLoading(true);
                setError(null);
              }}
              className="mt-4 inline-flex items-center space-x-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Retry</span>
            </button>
          </div>
        ) : pdfDoc ? (
          <div className="mx-auto flex flex-col items-center pb-24">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <SinglePdfPage
                key={pageNum}
                pageNum={pageNum}
                pdfDoc={pdfDoc}
                scale={scale}
                isVisible={visiblePages.has(pageNum)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};
