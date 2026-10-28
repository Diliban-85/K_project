import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Crop as CropIcon,
  Eraser,
  Undo2,
  RotateCcw,
  Check,
  CheckCircle2,
  Scissors,
  Square,
  Paintbrush,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { PaperSection } from '../types';

interface CaptureEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  capturedRegion: {
    pageNum: number;
    dataUrl: string;
    box: { x: number; y: number; width: number; height: number };
    extractedText: string;
  };
  resourceName?: string;
  sections: PaperSection[];
  activeSectionId: string;
  defaultMarks?: number;
  onConfirm: (result: {
    dataUrl: string;
    marks: number;
    sectionId: string;
    extractedText: string;
  }) => Promise<void>;
  onRetake: () => void;
}

type EditorMode = 'preview' | 'crop' | 'erase';
type EraseType = 'box' | 'brush';

export const CaptureEditorModal: React.FC<CaptureEditorModalProps> = ({
  isOpen,
  onClose,
  capturedRegion,
  resourceName,
  sections,
  activeSectionId,
  defaultMarks,
  onConfirm,
  onRetake,
}) => {
  // Current active image dataUrl (native high-resolution)
  const [currentDataUrl, setCurrentDataUrl] = useState<string>(capturedRegion.dataUrl);
  const [history, setHistory] = useState<string[]>([]);
  const [marks, setMarks] = useState<number>(defaultMarks || 1);
  const [sectionId, setSectionId] = useState<string>(activeSectionId || (sections[0]?.id ?? ''));
  const [mode, setMode] = useState<EditorMode>('preview');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Erase tool settings
  const [eraseType, setEraseType] = useState<EraseType>('box');
  const [brushSize, setBrushSize] = useState<number>(18);

  // References
  const previewImgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Interactive Crop drag state
  const cropContainerRef = useRef<HTMLDivElement | null>(null);
  const [isCroppingDrag, setIsCroppingDrag] = useState<boolean>(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropRect, setCropRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Interactive Erase drag state
  const isErasingDrag = useRef<boolean>(false);
  const eraseBoxStart = useRef<{ x: number; y: number } | null>(null);
  const [eraseBoxOverlay, setEraseBoxOverlay] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Reset state when a new capture region is provided
  useEffect(() => {
    setCurrentDataUrl(capturedRegion.dataUrl);
    setHistory([]);
    setMode('preview');
    setCropRect(null);

    const initialSecId = activeSectionId || (sections[0]?.id ?? '');
    setSectionId(initialSecId);
    const targetSec = sections.find((s) => s.id === initialSecId);
    setMarks(defaultMarks || targetSec?.marksPerQuestion || 1);
  }, [capturedRegion, activeSectionId, sections, defaultMarks]);

  const handleSectionChange = (newSecId: string) => {
    setSectionId(newSecId);
    const targetSec = sections.find((s) => s.id === newSecId);
    if (targetSec?.marksPerQuestion) {
      setMarks(targetSec.marksPerQuestion);
    }
  };

  // Load image onto interactive canvas when switching to 'erase' mode
  useEffect(() => {
    if (mode === 'erase' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
      };
      img.src = currentDataUrl;
    }
  }, [mode, currentDataUrl]);

  // Push to undo history
  const pushHistory = (newDataUrl: string) => {
    setHistory((prev) => [...prev, currentDataUrl]);
    setCurrentDataUrl(newDataUrl);
  };

  // Undo last modification
  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, prev.length - 1));
    setCurrentDataUrl(previous);
    setCropRect(null);
  };

  // Reset to original capture
  const handleResetToOriginal = () => {
    if (currentDataUrl === capturedRegion.dataUrl && history.length === 0) return;
    setHistory((prev) => [...prev, currentDataUrl]);
    setCurrentDataUrl(capturedRegion.dataUrl);
    setCropRect(null);
    setMode('preview');
  };

  // ==========================================
  // CROP LOGIC
  // ==========================================
  const handleCropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cropContainerRef.current) return;
    const rect = cropContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsCroppingDrag(true);
    setCropStart({ x, y });
    setCropRect({ x, y, width: 0, height: 0 });
  };

  const handleCropMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCroppingDrag || !cropStart || !cropContainerRef.current) return;
    const rect = cropContainerRef.current.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const currentY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    const left = Math.min(cropStart.x, currentX);
    const top = Math.min(cropStart.y, currentY);
    const width = Math.abs(currentX - cropStart.x);
    const height = Math.abs(currentY - cropStart.y);

    setCropRect({ x: left, y: top, width, height });
  };

  const handleCropMouseUp = () => {
    setIsCroppingDrag(false);
  };

  const handleApplyCrop = () => {
    if (!cropRect || cropRect.width < 10 || cropRect.height < 10) {
      alert('Please drag a selection rectangle over the area you want to keep.');
      return;
    }

    const container = cropContainerRef.current;
    if (!container) return;

    const img = new Image();
    img.onload = () => {
      const displayedWidth = container.clientWidth;
      const displayedHeight = container.clientHeight;

      const scaleX = img.naturalWidth / displayedWidth;
      const scaleY = img.naturalHeight / displayedHeight;

      const nativeX = Math.round(cropRect.x * scaleX);
      const nativeY = Math.round(cropRect.y * scaleY);
      const nativeW = Math.round(cropRect.width * scaleX);
      const nativeH = Math.round(cropRect.height * scaleY);

      const offscreen = document.createElement('canvas');
      offscreen.width = nativeW;
      offscreen.height = nativeH;
      const ctx = offscreen.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, nativeW, nativeH);
      ctx.drawImage(img, nativeX, nativeY, nativeW, nativeH, 0, 0, nativeW, nativeH);

      const croppedDataUrl = offscreen.toDataURL('image/png');
      pushHistory(croppedDataUrl);
      setCropRect(null);
      setMode('preview');
    };
    img.src = currentDataUrl;
  };

  // Quick Trims: Trim top / bottom percentages
  const handleQuickTrim = (direction: 'top' | 'bottom', percentage: number = 0.15) => {
    const img = new Image();
    img.onload = () => {
      const offscreen = document.createElement('canvas');
      const ctx = offscreen.getContext('2d');
      if (!ctx) return;

      const trimAmount = Math.round(img.naturalHeight * percentage);
      const newHeight = img.naturalHeight - trimAmount;
      if (newHeight < 20) return;

      offscreen.width = img.naturalWidth;
      offscreen.height = newHeight;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, offscreen.width, offscreen.height);

      if (direction === 'top') {
        ctx.drawImage(
          img,
          0,
          trimAmount,
          img.naturalWidth,
          newHeight,
          0,
          0,
          img.naturalWidth,
          newHeight
        );
      } else {
        ctx.drawImage(img, 0, 0, img.naturalWidth, newHeight, 0, 0, img.naturalWidth, newHeight);
      }

      const trimmedDataUrl = offscreen.toDataURL('image/png');
      pushHistory(trimmedDataUrl);
      setCropRect(null);
    };
    img.src = currentDataUrl;
  };

  // ==========================================
  // ERASE / WHITEOUT LOGIC
  // ==========================================
  const handleEraseMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    isErasingDrag.current = true;

    if (eraseType === 'brush') {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(clickX, clickY, (brushSize * scaleX) / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      eraseBoxStart.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      setEraseBoxOverlay({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        width: 0,
        height: 0,
      });
    }
  };

  const handleEraseMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isErasingDrag.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (eraseType === 'brush') {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const currentX = (e.clientX - rect.left) * scaleX;
        const currentY = (e.clientY - rect.top) * scaleY;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(currentX, currentY, (brushSize * scaleX) / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (eraseType === 'box' && eraseBoxStart.current) {
      const currentX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const currentY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

      const left = Math.min(eraseBoxStart.current.x, currentX);
      const top = Math.min(eraseBoxStart.current.y, currentY);
      const width = Math.abs(currentX - eraseBoxStart.current.x);
      const height = Math.abs(currentY - eraseBoxStart.current.y);

      setEraseBoxOverlay({ x: left, y: top, width, height });
    }
  };

  const handleEraseMouseUp = () => {
    if (!isErasingDrag.current) return;
    isErasingDrag.current = false;

    if (eraseType === 'box' && eraseBoxOverlay && canvasRef.current) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(
          eraseBoxOverlay.x * scaleX,
          eraseBoxOverlay.y * scaleY,
          eraseBoxOverlay.width * scaleX,
          eraseBoxOverlay.height * scaleY
        );
      }
      setEraseBoxOverlay(null);
      eraseBoxStart.current = null;
    }
  };

  const handleDoneErasing = () => {
    if (canvasRef.current) {
      const editedDataUrl = canvasRef.current.toDataURL('image/png');
      pushHistory(editedDataUrl);
    }
    setMode('preview');
  };

  // Submit to Paper
  const handleFinalAdd = async () => {
    if (!sectionId) {
      alert('Please select a section for this question.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onConfirm({
        dataUrl: currentDataUrl,
        marks: Number(marks) || 1,
        sectionId,
        extractedText: capturedRegion.extractedText || '',
      });
    } catch (err: any) {
      alert(err.message || 'Failed to add question to paper');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isModified = history.length > 0 || currentDataUrl !== capturedRegion.dataUrl;

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div className="flex flex-col w-full max-w-3xl rounded-xl border border-neutral-300 bg-white shadow-2xl overflow-hidden max-h-[92vh]">
        {/* ========================================================= */}
        {/* MODAL HEADER                                              */}
        {/* ========================================================= */}
        <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-5 py-3 shrink-0">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm sm:text-base font-bold text-neutral-900 font-sans">
                Selected Question Preview & Editor
              </h3>
              {isModified && (
                <span className="inline-flex items-center space-x-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                  <Sparkles className="h-3 w-3" />
                  <span>Edited</span>
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Source: Page {capturedRegion.pageNum} • {resourceName || 'Textbook'}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 transition-colors"
              title="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* TOOLBAR CONTROLS                                          */}
        {/* ========================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-white px-5 py-2.5 shrink-0 text-xs">
          {/* Mode Switchers */}
          <div className="flex items-center space-x-1.5 bg-neutral-100 p-1 rounded-lg">
            <button
              onClick={() => setMode('preview')}
              className={`flex items-center space-x-1.5 rounded-md px-3 py-1 font-semibold transition-all ${
                mode === 'preview'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Preview</span>
            </button>

            <button
              onClick={() => {
                setMode('crop');
                setCropRect(null);
              }}
              className={`flex items-center space-x-1.5 rounded-md px-3 py-1 font-semibold transition-all ${
                mode === 'crop'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <CropIcon className="h-3.5 w-3.5" />
              <span>Crop Region</span>
            </button>

            <button
              onClick={() => setMode('erase')}
              className={`flex items-center space-x-1.5 rounded-md px-3 py-1 font-semibold transition-all ${
                mode === 'erase'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Eraser className="h-3.5 w-3.5" />
              <span>Erase / Remove</span>
            </button>
          </div>

          {/* Sub-tools depending on active mode */}
          <div className="flex items-center space-x-2">
            {mode === 'crop' && (
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => handleQuickTrim('top', 0.15)}
                  className="rounded border border-neutral-300 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
                  title="Trim top 15% (removes unwanted top question)"
                >
                  Trim Top
                </button>
                <button
                  onClick={() => handleQuickTrim('bottom', 0.15)}
                  className="rounded border border-neutral-300 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
                  title="Trim bottom 15% (removes unwanted bottom question)"
                >
                  Trim Bottom
                </button>
                <button
                  onClick={handleApplyCrop}
                  disabled={!cropRect}
                  className="flex items-center space-x-1 rounded bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition-colors shadow-xs"
                >
                  <Check className="h-3 w-3" />
                  <span>Apply Crop</span>
                </button>
              </div>
            )}

            {mode === 'erase' && (
              <div className="flex items-center space-x-2">
                {/* Erase style: Box vs Brush */}
                <div className="flex items-center space-x-1 bg-neutral-100 p-0.5 rounded">
                  <button
                    onClick={() => setEraseType('box')}
                    className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                      eraseType === 'box'
                        ? 'bg-white text-neutral-900 shadow-2xs'
                        : 'text-neutral-600'
                    }`}
                    title="Drag a box to whiteout an entire block"
                  >
                    <Square className="h-3 w-3" />
                    <span>Whiteout Box</span>
                  </button>
                  <button
                    onClick={() => setEraseType('brush')}
                    className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                      eraseType === 'brush'
                        ? 'bg-white text-neutral-900 shadow-2xs'
                        : 'text-neutral-600'
                    }`}
                    title="Freehand brush to erase lines or numbers"
                  >
                    <Paintbrush className="h-3 w-3" />
                    <span>Brush</span>
                  </button>
                </div>

                {eraseType === 'brush' && (
                  <select
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-neutral-800"
                  >
                    <option value={10}>Small (10px)</option>
                    <option value={18}>Medium (18px)</option>
                    <option value={32}>Large (32px)</option>
                  </select>
                )}

                <button
                  onClick={handleDoneErasing}
                  className="flex items-center space-x-1 rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 transition-colors shadow-xs"
                >
                  <Check className="h-3 w-3" />
                  <span>Done Erasing</span>
                </button>
              </div>
            )}

            {/* Undo / Reset */}
            <div className="flex items-center space-x-1 pl-2 border-l border-neutral-200">
              <button
                onClick={handleUndo}
                disabled={history.length === 0}
                className="flex items-center space-x-1 rounded p-1 text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 transition-colors"
                title="Undo last change"
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span className="text-[11px] hidden sm:inline">Undo</span>
              </button>

              {isModified && (
                <button
                  onClick={handleResetToOriginal}
                  className="flex items-center space-x-1 rounded p-1 text-neutral-600 hover:bg-neutral-100 transition-colors"
                  title="Reset all changes back to original capture"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span className="text-[11px] hidden sm:inline">Reset</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* VISUAL WORKSPACE CANVASES / PREVIEWS                      */}
        {/* ========================================================= */}
        <div className="relative flex-1 overflow-auto bg-neutral-200/90 p-4 sm:p-6 flex items-center justify-center min-h-[320px] max-h-[56vh]">
          {/* MODE 1: Standard Preview */}
          {mode === 'preview' && (
            <div className="relative max-w-full overflow-auto rounded-lg border-2 border-neutral-300 bg-white p-4 shadow-sm">
              <img
                ref={previewImgRef}
                src={currentDataUrl}
                alt="Selected Question"
                className="max-w-full h-auto max-h-[46vh] object-contain block mx-auto select-none"
              />
            </div>
          )}

          {/* MODE 2: Crop Mode */}
          {mode === 'crop' && (
            <div className="relative flex flex-col items-center">
              <div className="mb-2 text-[11px] font-semibold text-neutral-700 bg-white/90 px-3 py-1 rounded-full shadow-2xs">
                Drag a rectangle over the exact question you want to keep
              </div>
              <div
                ref={cropContainerRef}
                onMouseDown={handleCropMouseDown}
                onMouseMove={handleCropMouseMove}
                onMouseUp={handleCropMouseUp}
                className="relative cursor-crosshair border-2 border-dashed border-indigo-500 bg-white shadow-md select-none inline-block overflow-hidden"
              >
                <img
                  src={currentDataUrl}
                  alt="Crop Target"
                  className="max-w-full h-auto max-h-[44vh] object-contain block pointer-events-none select-none"
                />

                {/* Interactive Crop Box Overlay */}
                {cropRect && (
                  <div
                    className="absolute border-2 border-blue-600 bg-blue-500/25 pointer-events-none z-20 shadow-sm ring-1 ring-white"
                    style={{
                      left: `${cropRect.x}px`,
                      top: `${cropRect.y}px`,
                      width: `${cropRect.width}px`,
                      height: `${cropRect.height}px`,
                    }}
                  >
                    <div className="absolute -top-5 left-0 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-t">
                      New Question Bounding Area
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MODE 3: Erase / Whiteout Mode */}
          {mode === 'erase' && (
            <div className="relative flex flex-col items-center">
              <div className="mb-2 text-[11px] font-semibold text-neutral-700 bg-white/90 px-3 py-1 rounded-full shadow-2xs">
                {eraseType === 'box'
                  ? 'Drag a box to whiteout unwanted questions or headers'
                  : 'Click or drag brush to erase text, formulas, or numbers'}
              </div>
              <div className="relative border-2 border-neutral-300 bg-white shadow-md inline-block overflow-hidden">
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleEraseMouseDown}
                  onMouseMove={handleEraseMouseMove}
                  onMouseUp={handleEraseMouseUp}
                  className={`block max-w-full h-auto max-h-[44vh] object-contain ${
                    eraseType === 'box' ? 'cursor-crosshair' : 'cursor-cell'
                  }`}
                />

                {/* Box erase preview rectangle */}
                {eraseBoxOverlay && (
                  <div
                    className="absolute border-2 border-dashed border-red-500 bg-white/70 pointer-events-none z-20"
                    style={{
                      left: `${eraseBoxOverlay.x}px`,
                      top: `${eraseBoxOverlay.y}px`,
                      width: `${eraseBoxOverlay.width}px`,
                      height: `${eraseBoxOverlay.height}px`,
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* FOOTER CONFIGURATION: MARKS, SECTION & ACTIONS            */}
        {/* ========================================================= */}
        <div className="border-t border-neutral-200 bg-neutral-50 px-5 py-4 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end mb-4">
            {/* Marks Input */}
            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1">
                Marks Allocated:
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={marks}
                  onChange={(e) => setMarks(parseInt(e.target.value, 10) || 1)}
                  className="w-24 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-center text-sm font-bold text-neutral-900 focus:border-neutral-900 focus:outline-none shadow-2xs"
                />
                <span className="text-xs text-neutral-500 font-medium">marks</span>

                {/* Quick Marks Pills */}
                <div className="flex items-center space-x-1 pl-2">
                  {[1, 2, 3, 4, 5].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMarks(m)}
                      className={`h-6 w-6 rounded text-xs font-semibold transition-colors ${
                        marks === m
                          ? 'bg-neutral-900 text-white'
                          : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Target Part */}
            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1">
                Add to Part:
              </label>
              <select
                value={sectionId}
                onChange={(e) => handleSectionChange(e.target.value)}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-900 focus:border-neutral-900 focus:outline-none shadow-2xs"
              >
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name} {sec.marksPerQuestion ? `(${sec.marksPerQuestion} mark${sec.marksPerQuestion > 1 ? 's' : ''}/q)` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-neutral-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onRetake}
              className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors shadow-2xs"
            >
              Retake Selection
            </button>

            <button
              type="button"
              onClick={handleFinalAdd}
              disabled={isSubmitting}
              className="inline-flex items-center space-x-2 rounded-md bg-neutral-900 px-5 py-2 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 transition-colors shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Adding to Paper...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Add to Paper</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
