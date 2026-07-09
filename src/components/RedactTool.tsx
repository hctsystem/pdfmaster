import { useState, useRef, useEffect, useCallback } from 'react';
import { FileText, Square, Trash2, Loader2, Download, EyeOff } from 'lucide-react';
import { PDFDocument, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface Rect { x: number; y: number; w: number; h: number; }
interface Point { x: number; y: number; }

const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement): Point => {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
};

export default function RedactTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rects, setRects] = useState<Record<number, Rect[]>>({});
  const [drawing, setDrawing] = useState(false);
  const [startPt, setStartPt] = useState<Point | null>(null);
  const [currentRect, setCurrentRect] = useState<Rect | null>(null);

  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const renderPage = useCallback(async (doc: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
    setIsRendering(true);
    try {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = pdfCanvasRef.current!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx as any, viewport, canvas }).promise;
      const overlay = overlayCanvasRef.current!;
      overlay.width = viewport.width;
      overlay.height = viewport.height;
    } catch (err) {
      console.error('Render error:', err);
    } finally {
      setIsRendering(false);
    }
  }, []);

  const handleFiles = async (files: FileList) => {
    const f = files[0];
    if (!f || f.type !== 'application/pdf') return;
    setFile(f); setRects({}); setCurrentPage(1); setCurrentRect(null); setStartPt(null); setDrawing(false);
    const arrayBuffer = await f.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    pdfDocRef.current = doc;
    setPageCount(doc.numPages);
    await renderPage(doc, 1);
  };

  useEffect(() => {
    if (pdfDocRef.current) renderPage(pdfDocRef.current, currentPage);
  }, [currentPage, renderPage]);

  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d')!;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    const pageRects = rects[currentPage] || [];
    ctx.fillStyle = 'rgba(220,38,38,0.45)';
    ctx.strokeStyle = 'rgba(220,38,38,0.85)';
    ctx.lineWidth = 2;
    for (const r of pageRects) {
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    }
    if (currentRect) {
      ctx.fillStyle = 'rgba(239,68,68,0.3)';
      ctx.strokeStyle = 'rgba(239,68,68,0.9)';
      ctx.setLineDash([5, 4]);
      ctx.fillRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h);
      ctx.strokeRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h);
      ctx.setLineDash([]);
    }
  }, [rects, currentRect, currentPage]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!overlayCanvasRef.current) return;
    const pos = getCanvasPos(e, overlayCanvasRef.current);
    setDrawing(true); setStartPt(pos);
    setCurrentRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || !startPt || !overlayCanvasRef.current) return;
    const pos = getCanvasPos(e, overlayCanvasRef.current);
    setCurrentRect({ x: Math.min(pos.x, startPt.x), y: Math.min(pos.y, startPt.y), w: Math.abs(pos.x - startPt.x), h: Math.abs(pos.y - startPt.y) });
  };

  const finalizeRect = (pos: Point) => {
    if (!startPt) return;
    const newRect: Rect = { x: Math.min(pos.x, startPt.x), y: Math.min(pos.y, startPt.y), w: Math.abs(pos.x - startPt.x), h: Math.abs(pos.y - startPt.y) };
    if (newRect.w > 4 && newRect.h > 4) {
      setRects(prev => ({ ...prev, [currentPage]: [...(prev[currentPage] || []), newRect] }));
    }
    setDrawing(false); setStartPt(null); setCurrentRect(null);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || !overlayCanvasRef.current) return;
    finalizeRect(getCanvasPos(e, overlayCanvasRef.current));
  };

  const handleMouseLeave = () => {
    if (drawing && currentRect && currentRect.w > 4 && currentRect.h > 4) {
      setRects(prev => ({ ...prev, [currentPage]: [...(prev[currentPage] || []), currentRect] }));
    }
    setDrawing(false); setStartPt(null); setCurrentRect(null);
  };

  const undoLast = () => setRects(prev => {
    const pr = prev[currentPage];
    if (!pr || pr.length === 0) return prev;
    const updated = pr.slice(0, -1);
    if (updated.length === 0) { const { [currentPage]: _, ...rest } = prev; return rest; }
    return { ...prev, [currentPage]: updated };
  });

  const clearPage = () => setRects(prev => { const { [currentPage]: _, ...rest } = prev; return rest; });

  const totalRectCount = Object.values(rects).reduce((s, a) => s + a.length, 0);

  const applyRedactions = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const bytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes);
      const pages = pdfDoc.getPages();
      for (const [pgStr, pgRects] of Object.entries(rects)) {
        const pi = parseInt(pgStr, 10) - 1;
        if (pi < 0 || pi >= pages.length) continue;
        const pdfPage = pages[pi];
        const { width: pdfW, height: pdfH } = pdfPage.getSize();
        const pdfJsPage = await pdfDocRef.current!.getPage(pi + 1);
        const vp = pdfJsPage.getViewport({ scale: 1.5 });
        const scaleX = pdfW / vp.width;
        const scaleY = pdfH / vp.height;
        for (const r of pgRects) {
          pdfPage.drawRectangle({ x: r.x * scaleX, y: pdfH - (r.y + r.h) * scaleY, width: r.w * scaleX, height: r.h * scaleY, color: rgb(0, 0, 0), opacity: 1 });
        }
      }
      const saved = await pdfDoc.save();
      const blob = new Blob([saved as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `redacted_${file.name}`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to apply redactions.');
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setFile(null); setRects({}); setPageCount(0); setCurrentPage(1);
    setCurrentRect(null); setStartPt(null); setDrawing(false);
    pdfDocRef.current?.cleanup(); pdfDocRef.current = null;
  };

  const currentPageRects = rects[currentPage] || [];

  return (
    <div className="tool-split-layout">
      <div className="tool-controls-panel">
        {!file ? (
          <div
            className={`upload-area ${isDragging ? 'dragging' : ''}`}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
            role="button" tabIndex={0} aria-label="Upload PDF to redact"
            onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            <EyeOff size={48} className="upload-icon" aria-hidden="true" />
            <div>
              <p><strong style={{ color: 'var(--text-main)' }}>Drag & Drop PDF</strong> or click to browse</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Draw rectangles to permanently redact sensitive content</p>
            </div>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={e => e.target.files && handleFiles(e.target.files)} accept="application/pdf" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="file-item">
              <div className="file-info">
                <FileText size={18} color="var(--primary)" aria-hidden="true" />
                <div className="file-details">
                  <h4>{file.name}</h4>
                  <p>{(file.size / 1024).toFixed(0)} KB · {pageCount} page{pageCount !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <button className="btn-icon" onClick={reset} aria-label="Remove file"><Trash2 size={15} /></button>
            </div>

            {pageCount > 1 && (
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Navigate pages</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button className="editor-tool-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} aria-label="Previous page">‹</button>
                  <span className="page-counter" aria-live="polite">{currentPage} / {pageCount}</span>
                  <button className="editor-tool-btn" onClick={() => setCurrentPage(p => Math.min(pageCount, p + 1))} disabled={currentPage >= pageCount} aria-label="Next page">›</button>
                </div>
              </div>
            )}

            <div style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <Square size={14} style={{ flexShrink: 0, marginTop: 2, color: '#dc2626' }} aria-hidden="true" />
              <span><strong style={{ color: 'var(--text-secondary)' }}>Click and drag</strong> on the preview to draw redaction boxes. Red overlays show the areas — the final PDF will have solid black rectangles.</span>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Redaction areas — page {currentPage}</label>
                {currentPageRects.length > 0 && (
                  <button className="btn-ghost" onClick={clearPage} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }} aria-label="Clear all redactions on this page">Clear page</button>
                )}
              </div>
              {currentPageRects.length === 0 ? (
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '0.75rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>No redactions on this page yet</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {currentPageRects.map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.75rem', color: 'var(--text-secondary)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Square size={12} color="#dc2626" aria-hidden="true" /> Area {i + 1}</span>
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{Math.round(r.w)}×{Math.round(r.h)}px</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={undoLast} disabled={currentPageRects.length === 0} aria-label="Undo last redaction on this page">
                <Square size={14} /> Undo Last
              </button>
            </div>

            {totalRectCount > 0 && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                {totalRectCount} redaction{totalRectCount !== 1 ? 's' : ''} across {Object.keys(rects).length} page{Object.keys(rects).length !== 1 ? 's' : ''}
              </p>
            )}

            <button className="download-btn" onClick={applyRedactions} disabled={isProcessing || totalRectCount === 0} aria-label="Apply redactions and download PDF">
              {isProcessing ? <Loader2 className="spinner" size={20} /> : <Download size={20} />}
              {isProcessing ? 'Applying Redactions…' : 'Apply Redactions & Download'}
            </button>
          </div>
        )}
      </div>

      <div className="tool-preview-panel">
        <div className="preview-panel-header">
          <h4>{file ? `Page ${currentPage} — Draw redaction rectangles` : 'PDF Preview'}</h4>
          {isRendering && <Loader2 className="spinner" size={14} color="var(--primary)" aria-label="Rendering…" />}
        </div>
        <div className="preview-panel-body" style={{ minHeight: 520, position: 'relative', overflow: 'auto', padding: file ? 0 : undefined, display: 'flex', justifyContent: 'center', alignItems: file ? 'flex-start' : 'center' }}>
          {file ? (
            <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
              <canvas ref={pdfCanvasRef} aria-label={`PDF page ${currentPage}`} style={{ display: 'block', maxWidth: '100%' }} />
              <canvas
                ref={overlayCanvasRef}
                aria-label="Draw redaction rectangles here"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'crosshair', touchAction: 'none' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
              />
            </div>
          ) : isRendering ? (
            <div className="preview-empty" role="status"><Loader2 size={40} className="spinner" color="var(--primary)" /><p>Rendering PDF…</p></div>
          ) : (
            <div className="preview-empty" role="img" aria-label="No PDF uploaded"><EyeOff size={48} aria-hidden="true" /><p>Upload a PDF to start redacting</p></div>
          )}
        </div>
      </div>
    </div>
  );
}
