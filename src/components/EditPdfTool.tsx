import { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Loader2, Type, Highlighter, Pencil, Trash2, X, FileText, RotateCcw } from 'lucide-react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source for pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

type DrawTool = 'text' | 'draw' | 'highlight' | 'none';

interface Annotation {
  id: string;
  type: 'text' | 'draw' | 'highlight';
  pageIndex: number;
  // text annotation
  x?: number;
  y?: number;
  text?: string;
  fontSize?: number;
  color?: string;
  // draw / highlight path
  points?: { x: number; y: number }[];
  strokeColor?: string;
  strokeWidth?: number;
  fillColor?: string;
}

export default function EditPdfTool() {
  const [file, setFile]                 = useState<File | null>(null);
  const [pdfUrl, setPdfUrl]             = useState<string | null>(null);
  const [pdfDoc, setPdfDoc]             = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount]       = useState(0);
  const [currentPage, setCurrentPage]   = useState(1);
  const [scale, setScale]               = useState(1.2);
  const [isDragging, setIsDragging]     = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRendering, setIsRendering]   = useState(false);

  const [activeTool, setActiveTool]     = useState<DrawTool>('none');
  const [annotations, setAnnotations]   = useState<Annotation[]>([]);
  const [isDrawing, setIsDrawing]       = useState(false);
  const [currentPath, setCurrentPath]   = useState<{ x: number; y: number }[]>([]);
  const [textColor, setTextColor]       = useState('#2563eb');
  const [fontSize, setFontSize]         = useState(16);

  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const overlayRef   = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingTextRef = useRef<{ x: number; y: number } | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  // ── Load PDF ─────────────────────────────────────────────────────
  const handleFiles = async (files: FileList) => {
    const f = files[0];
    if (!f || f.type !== 'application/pdf') return;
    setFile(f);
    setAnnotations([]);
    setCurrentPage(1);
    setActiveTool('none');

    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    const url = URL.createObjectURL(f);
    setPdfUrl(url);

    try {
      const loadingTask = pdfjsLib.getDocument({ url });
      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setPageCount(doc.numPages);
    } catch (err) {
      console.error('Failed to load PDF:', err);
    }
  };

  // ── Render PDF page to canvas ─────────────────────────────────────
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;
    setIsRendering(true);

    try {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      canvas.width  = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext('2d')!;
      const renderTask = page.render({ canvasContext: ctx as any, viewport, canvas: canvasRef.current! });
      renderTaskRef.current = renderTask;
      await renderTask.promise;

      // Sync overlay canvas size
      if (overlayRef.current) {
        overlayRef.current.width  = viewport.width;
        overlayRef.current.height = viewport.height;
      }

      // Redraw annotations on overlay
      drawAnnotations();
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('Render error:', err);
      }
    } finally {
      setIsRendering(false);
    }
  }, [pdfDoc, currentPage, scale, annotations]);

  useEffect(() => { renderPage(); }, [pdfDoc, currentPage, scale]);
  useEffect(() => { drawAnnotations(); }, [annotations, currentPage]);

  // ── Draw annotations on overlay ──────────────────────────────────
  const drawAnnotations = () => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d')!;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const pageAnns = annotations.filter(a => a.pageIndex === currentPage - 1);
    for (const ann of pageAnns) {
      if (ann.type === 'draw' && ann.points && ann.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(ann.points[0].x, ann.points[0].y);
        ann.points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.strokeStyle = ann.strokeColor ?? '#EF4444';
        ctx.lineWidth   = ann.strokeWidth ?? 3;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.stroke();
      }
      if (ann.type === 'highlight' && ann.points && ann.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(ann.points[0].x, ann.points[0].y);
        ann.points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.strokeStyle = 'rgba(251,191,36,0.5)';
        ctx.lineWidth   = 20;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.stroke();
      }
      if (ann.type === 'text' && ann.x !== undefined && ann.y !== undefined && ann.text) {
        ctx.font         = `${ann.fontSize ?? fontSize}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillStyle    = ann.color ?? textColor;
        ctx.fillText(ann.text, ann.x, ann.y);
      }
    }
  };

  // ── Mouse events for drawing ──────────────────────────────────────
  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (overlayRef.current!.width / rect.width),
      y: (e.clientY - rect.top) * (overlayRef.current!.height / rect.height),
    };
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'none') return;
    const pos = getPos(e);

    if (activeTool === 'text') {
      // Prompt for text via a simple inline UI
      pendingTextRef.current = pos;
      const inputText = window.prompt('Enter text to add:');
      if (inputText && inputText.trim()) {
        setAnnotations(prev => [...prev, {
          id: crypto.randomUUID(),
          type: 'text',
          pageIndex: currentPage - 1,
          x: pos.x, y: pos.y,
          text: inputText.trim(),
          fontSize,
          color: textColor,
        }]);
      }
      return;
    }

    setIsDrawing(true);
    setCurrentPath([pos]);
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || activeTool === 'none' || activeTool === 'text') return;
    const pos = getPos(e);
    setCurrentPath(prev => {
      const updated = [...prev, pos];
      // Live draw on overlay
      const overlay = overlayRef.current;
      if (overlay) {
        const ctx = overlay.getContext('2d')!;
        if (activeTool === 'draw') {
          ctx.beginPath();
          ctx.moveTo(prev[prev.length - 1]?.x ?? pos.x, prev[prev.length - 1]?.y ?? pos.y);
          ctx.lineTo(pos.x, pos.y);
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth   = 3;
          ctx.lineCap     = 'round';
          ctx.stroke();
        }
        if (activeTool === 'highlight') {
          ctx.beginPath();
          ctx.moveTo(prev[prev.length - 1]?.x ?? pos.x, prev[prev.length - 1]?.y ?? pos.y);
          ctx.lineTo(pos.x, pos.y);
          ctx.strokeStyle = 'rgba(251,191,36,0.5)';
          ctx.lineWidth   = 20;
          ctx.lineCap     = 'round';
          ctx.stroke();
        }
      }
      return updated;
    });
  };

  const onMouseUp = () => {
    if (!isDrawing || activeTool === 'none' || activeTool === 'text') return;
    setIsDrawing(false);
    if (currentPath.length < 2) { setCurrentPath([]); return; }

    setAnnotations(prev => [...prev, {
      id: crypto.randomUUID(),
      type: activeTool as 'draw' | 'highlight',
      pageIndex: currentPage - 1,
      points: currentPath,
      strokeColor: activeTool === 'draw' ? '#EF4444' : '#FBBF24',
      strokeWidth: activeTool === 'draw' ? 3 : 20,
    }]);
    setCurrentPath([]);
  };

  // ── Undo last annotation ──────────────────────────────────────────
  const undo = () => {
    setAnnotations(prev => {
      const pageAnns = prev.filter(a => a.pageIndex === currentPage - 1);
      if (!pageAnns.length) return prev;
      const lastId = pageAnns[pageAnns.length - 1].id;
      return prev.filter(a => a.id !== lastId);
    });
  };

  // ── Save annotated PDF ────────────────────────────────────────────
  const saveAnnotatedPdf = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const bytes   = await file.arrayBuffer();
      const pdfLibDoc = await PDFDocument.load(bytes);
      const font    = await pdfLibDoc.embedFont(StandardFonts.Helvetica);
      const pages   = pdfLibDoc.getPages();

      for (const ann of annotations) {
        const page = pages[ann.pageIndex];
        if (!page) continue;
        const { height } = page.getSize();

        if (ann.type === 'text' && ann.x !== undefined && ann.y !== undefined && ann.text) {
          // Convert canvas coords back to PDF coords
          const canvas = canvasRef.current;
          const scaleX = canvas ? page.getWidth()  / canvas.width  : 1;
          const scaleY = canvas ? page.getHeight() / canvas.height : 1;
          const hex = ann.color ?? '#2563eb';
          const r = parseInt(hex.slice(1,3), 16) / 255;
          const g = parseInt(hex.slice(3,5), 16) / 255;
          const b = parseInt(hex.slice(5,7), 16) / 255;

          page.drawText(ann.text, {
            x: ann.x * scaleX,
            y: height - ann.y * scaleY,
            size: (ann.fontSize ?? 16) * scaleX,
            font,
            color: rgb(r, g, b),
          });
        }

        if ((ann.type === 'draw' || ann.type === 'highlight') && ann.points && ann.points.length > 1) {
          const canvas = canvasRef.current;
          const scaleX = canvas ? page.getWidth()  / canvas.width  : 1;
          const scaleY = canvas ? page.getHeight() / canvas.height : 1;

          const r = ann.type === 'highlight' ? 1 : 0.94;
          const g = ann.type === 'highlight' ? 0.75 : 0.27;
          const b = ann.type === 'highlight' ? 0.14 : 0.27;

          for (let i = 0; i < ann.points.length - 1; i++) {
            const p1 = ann.points[i];
            const p2 = ann.points[i + 1];
            page.drawLine({
              start: { x: p1.x * scaleX, y: height - p1.y * scaleY },
              end:   { x: p2.x * scaleX, y: height - p2.y * scaleY },
              thickness: (ann.strokeWidth ?? 3) * scaleX,
              color: rgb(r, g, b),
              opacity: ann.type === 'highlight' ? 0.4 : 1,
            });
          }
        }
      }

      const savedBytes = await pdfLibDoc.save();
      const blob = new Blob([savedBytes as any], { type: 'application/pdf' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `edited_${file.name}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to save the PDF. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const toolOptions: { id: DrawTool; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'text',      label: 'Add Text',  icon: <Type size={15} />,        color: '#3B82F6' },
    { id: 'highlight', label: 'Highlight', icon: <Highlighter size={15} />, color: '#FBBF24' },
    { id: 'draw',      label: 'Draw',      icon: <Pencil size={15} />,      color: '#EF4444' },
  ];

  if (!file) {
    return (
      <div
        className={`upload-area ${isDragging ? 'dragging' : ''}`}
        style={{ minHeight: 300 }}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload PDF to edit"
        onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
      >
        <FileText size={56} className="upload-icon" aria-hidden="true" />
        <div>
          <p><strong style={{ color: 'var(--text-main)' }}>Drag & Drop PDF</strong> or click to browse</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Add text, highlights, and drawings on your PDF
          </p>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="application/pdf"
          onChange={e => e.target.files && handleFiles(e.target.files)}
          aria-label="Select PDF file to edit"
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* ── Toolbar ── */}
      <div className="editor-toolbar" role="toolbar" aria-label="PDF annotation tools">
        {/* Tool Selection */}
        <div style={{ display: 'flex', gap: '0.375rem', borderRight: '1px solid var(--border)', paddingRight: '0.75rem', marginRight: '0.25rem' }}>
          {toolOptions.map(t => (
            <button
              key={t.id}
              className={`editor-tool-btn ${activeTool === t.id ? 'active' : ''}`}
              onClick={() => setActiveTool(activeTool === t.id ? 'none' : t.id)}
              aria-label={t.label}
              aria-pressed={activeTool === t.id}
              title={t.label}
              style={activeTool === t.id ? { color: t.color, borderColor: t.color, background: `${t.color}18` } : {}}
            >
              {t.icon}
              <span className="sr-only" style={{ fontSize: '0.8125rem' }}>{t.label}</span>
              <span style={{ fontSize: '0.8125rem' }}>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Color & size picker for text tool */}
        {activeTool === 'text' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label htmlFor="text-color-picker" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Color</label>
            <input
              id="text-color-picker"
              type="color"
              value={textColor}
              onChange={e => setTextColor(e.target.value)}
              style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 4 }}
              aria-label="Text color"
            />
            <label htmlFor="font-size-input" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Size</label>
            <input
              id="font-size-input"
              type="number"
              value={fontSize}
              min={8}
              max={72}
              onChange={e => setFontSize(Number(e.target.value))}
              style={{
                width: 56, padding: '0.25rem 0.5rem',
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 4, color: 'var(--text-main)',
                fontFamily: 'inherit', fontSize: '0.8125rem'
              }}
              aria-label="Font size in points"
            />
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Page navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <button
            className="editor-tool-btn"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            ‹
          </button>
          <span className="page-counter" aria-live="polite" aria-atomic="true">
            {currentPage} / {pageCount}
          </span>
          <button
            className="editor-tool-btn"
            onClick={() => setCurrentPage(p => Math.min(pageCount, p + 1))}
            disabled={currentPage >= pageCount}
            aria-label="Next page"
          >
            ›
          </button>
        </div>

        {/* Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', borderLeft: '1px solid var(--border)', paddingLeft: '0.75rem' }}>
          <button className="editor-tool-btn" onClick={() => setScale(s => Math.max(0.5, s - 0.2))} aria-label="Zoom out">−</button>
          <span className="page-counter" aria-label={`Zoom: ${Math.round(scale * 100)}%`}>{Math.round(scale * 100)}%</span>
          <button className="editor-tool-btn" onClick={() => setScale(s => Math.min(3, s + 0.2))} aria-label="Zoom in">+</button>
        </div>

        {/* Actions */}
        <button className="editor-tool-btn" onClick={undo} aria-label="Undo last annotation" title="Undo">
          <RotateCcw size={14} />
        </button>
        <button
          className="editor-tool-btn"
          onClick={() => setAnnotations(ann => ann.filter(a => a.pageIndex !== currentPage - 1))}
          aria-label="Clear annotations on current page"
          title="Clear page"
          style={{ color: 'var(--error)' }}
        >
          <Trash2 size={14} />
        </button>
        <button className="editor-tool-btn" onClick={() => { setFile(null); setPdfDoc(null); setPdfUrl(null); }} aria-label="Close PDF">
          <X size={14} />
          Close
        </button>
        <button
          className="btn-primary"
          onClick={saveAnnotatedPdf}
          disabled={isProcessing}
          aria-label="Save and download edited PDF"
          style={{ fontSize: '0.8125rem', padding: '0.5rem 1rem' }}
        >
          {isProcessing ? <Loader2 size={14} className="spinner" /> : <Download size={14} />}
          Save PDF
        </button>
      </div>

      {/* ── Canvas Area ── */}
      <div
        style={{
          position: 'relative',
          background: '#525659',
          borderRadius: 'var(--radius)',
          overflow: 'auto',
          minHeight: 500,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '1.5rem',
          border: '1px solid var(--border)',
        }}
        role="img"
        aria-label={`PDF editor — Page ${currentPage} of ${pageCount}`}
      >
        {isRendering && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)', zIndex: 10, borderRadius: 'inherit',
          }}>
            <Loader2 size={36} className="spinner" color="white" />
          </div>
        )}

        {/* PDF render canvas */}
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', top: '1.5rem', left: '50%', transform: 'translateX(-50%)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
          aria-hidden="true"
        />

        {/* Annotation overlay canvas */}
        <canvas
          ref={overlayRef}
          style={{
            position: 'absolute', top: '1.5rem', left: '50%', transform: 'translateX(-50%)',
            cursor: activeTool === 'none' ? 'default' : activeTool === 'text' ? 'text' : 'crosshair',
            zIndex: 5,
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          aria-label={`Annotation layer — active tool: ${activeTool}`}
          role="img"
          tabIndex={0}
        />

        {/* Spacer to correct scroll height */}
        <canvas ref={canvasRef} style={{ visibility: 'hidden' }} aria-hidden="true" />
      </div>
    </div>
  );
}
