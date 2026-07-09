import { useState, useRef, useEffect, useCallback } from 'react';
import { FileText, GitCompare, ArrowLeftRight, Loader2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export default function CompareTool() {
  const [pdfA, setPdfA] = useState<File | null>(null);
  const [pdfB, setPdfB] = useState<File | null>(null);
  const [docA, setDocA] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [docB, setDocB] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageCountA, setPageCountA] = useState(0);
  const [pageCountB, setPageCountB] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [isDraggingA, setIsDraggingA] = useState(false);
  const [isDraggingB, setIsDraggingB] = useState(false);
  const [isRenderingA, setIsRenderingA] = useState(false);
  const [isRenderingB, setIsRenderingB] = useState(false);

  const canvasARef = useRef<HTMLCanvasElement>(null);
  const canvasBRef = useRef<HTMLCanvasElement>(null);
  const fileInputARef = useRef<HTMLInputElement>(null);
  const fileInputBRef = useRef<HTMLInputElement>(null);

  const minPageCount = Math.min(
    pageCountA || Infinity,
    pageCountB || Infinity
  ) === Infinity ? 0 : Math.min(pageCountA || 0, pageCountB || 0);

  const loadPdf = async (file: File): Promise<pdfjsLib.PDFDocumentProxy> => {
    const ab = await file.arrayBuffer();
    return pdfjsLib.getDocument({ data: ab }).promise;
  };

  const handleFilesA = async (files: FileList) => {
    const f = files[0];
    if (!f || f.type !== 'application/pdf') return;
    setPdfA(f);
    setCurrentPage(1);
    const doc = await loadPdf(f);
    setDocA(doc);
    setPageCountA(doc.numPages);
  };

  const handleFilesB = async (files: FileList) => {
    const f = files[0];
    if (!f || f.type !== 'application/pdf') return;
    setPdfB(f);
    setCurrentPage(1);
    const doc = await loadPdf(f);
    setDocB(doc);
    setPageCountB(doc.numPages);
  };

  const renderCanvas = useCallback(async (
    doc: pdfjsLib.PDFDocumentProxy,
    canvasRef: React.RefObject<HTMLCanvasElement | null>,
    pageNum: number,
    sc: number,
    setRendering: (v: boolean) => void
  ) => {
    if (!canvasRef.current) return;
    setRendering(true);
    try {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: sc });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx as any, viewport, canvas }).promise;
    } catch (err) {
      console.error('Render error:', err);
    } finally {
      setRendering(false);
    }
  }, []);

  useEffect(() => {
    if (docA && currentPage <= pageCountA) {
      renderCanvas(docA, canvasARef, currentPage, scale, setIsRenderingA);
    }
  }, [docA, currentPage, scale, pageCountA, renderCanvas]);

  useEffect(() => {
    if (docB && currentPage <= pageCountB) {
      renderCanvas(docB, canvasBRef, currentPage, scale, setIsRenderingB);
    }
  }, [docB, currentPage, scale, pageCountB, renderCanvas]);

  const swapPdfs = () => {
    // Swap files, docs, counts
    const tempFile = pdfA; setPdfA(pdfB); setPdfB(tempFile);
    const tempDoc = docA; setDocA(docB); setDocB(tempDoc);
    const tempCount = pageCountA; setPageCountA(pageCountB); setPageCountB(tempCount);
    // Swap canvas content by re-rendering (useEffect will handle it on next render)
  };

  const resetA = () => { setPdfA(null); setDocA(null); setPageCountA(0); };
  const resetB = () => { setPdfB(null); setDocB(null); setPageCountB(0); };

  const bothLoaded = !!docA && !!docB;

  const UploadZone = ({
    label,
    file,
    isDragging,
    onDragging,
    onFiles,
    inputRef,
    onReset,
  }: {
    label: string;
    file: File | null;
    isDragging: boolean;
    onDragging: (v: boolean) => void;
    onFiles: (f: FileList) => void;
    inputRef: React.RefObject<HTMLInputElement | null>;
    onReset: () => void;
  }) => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      {!file ? (
        <div
          className={`upload-area ${isDragging ? 'dragging' : ''}`}
          style={{ minHeight: 160, padding: '1.5rem 1rem' }}
          onDragOver={e => { e.preventDefault(); onDragging(true); }}
          onDragLeave={() => onDragging(false)}
          onDrop={e => { e.preventDefault(); onDragging(false); onFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          role="button" tabIndex={0}
          aria-label={`Upload ${label}`}
          onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
        >
          <FileText size={36} className="upload-icon" aria-hidden="true" />
          <div>
            <p style={{ fontSize: '0.875rem' }}><strong style={{ color: 'var(--text-main)' }}>Drop PDF</strong> or click</p>
          </div>
          <input type="file" ref={inputRef} style={{ display: 'none' }} onChange={e => e.target.files && onFiles(e.target.files)} accept="application/pdf" />
        </div>
      ) : (
        <div className="file-item">
          <div className="file-info">
            <FileText size={16} color="var(--primary)" aria-hidden="true" />
            <div className="file-details">
              <h4 style={{ fontSize: '0.8125rem' }}>{file.name}</h4>
              <p>{(file.size / 1024).toFixed(0)} KB · {label === 'Original PDF' ? pageCountA : pageCountB} pages</p>
            </div>
          </div>
          <button className="btn-icon" onClick={onReset} aria-label={`Remove ${label}`}><Trash2 size={14} /></button>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Upload row */}
      {(!pdfA || !pdfB) && (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <UploadZone
            label="Original PDF"
            file={pdfA}
            isDragging={isDraggingA}
            onDragging={setIsDraggingA}
            onFiles={handleFilesA}
            inputRef={fileInputARef}
            onReset={resetA}
          />
          <UploadZone
            label="Modified PDF"
            file={pdfB}
            isDragging={isDraggingB}
            onDragging={setIsDraggingB}
            onFiles={handleFilesB}
            inputRef={fileInputBRef}
            onReset={resetB}
          />
        </div>
      )}

      {/* File items when both loaded */}
      {pdfA && pdfB && (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="file-item" style={{ flex: 1, minWidth: 200 }}>
            <div className="file-info">
              <FileText size={16} color="var(--primary)" aria-hidden="true" />
              <div className="file-details">
                <h4 style={{ fontSize: '0.8125rem' }}>{pdfA.name}</h4>
                <p>{(pdfA.size / 1024).toFixed(0)} KB · {pageCountA} pages</p>
              </div>
            </div>
            <button className="btn-icon" onClick={resetA} aria-label="Remove original PDF"><Trash2 size={14} /></button>
          </div>
          <ArrowLeftRight size={18} color="var(--text-muted)" aria-hidden="true" style={{ flexShrink: 0 }} />
          <div className="file-item" style={{ flex: 1, minWidth: 200 }}>
            <div className="file-info">
              <FileText size={16} color="var(--primary)" aria-hidden="true" />
              <div className="file-details">
                <h4 style={{ fontSize: '0.8125rem' }}>{pdfB.name}</h4>
                <p>{(pdfB.size / 1024).toFixed(0)} KB · {pageCountB} pages</p>
              </div>
            </div>
            <button className="btn-icon" onClick={resetB} aria-label="Remove modified PDF"><Trash2 size={14} /></button>
          </div>
        </div>
      )}

      {/* Controls toolbar */}
      {bothLoaded && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '0.625rem 0.875rem', background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          {/* Page navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <button
              className="editor-tool-btn"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="page-counter" aria-live="polite">
              Page {currentPage} of {minPageCount}
            </span>
            <button
              className="editor-tool-btn"
              onClick={() => setCurrentPage(p => Math.min(minPageCount, p + 1))}
              disabled={currentPage >= minPageCount}
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 0.125rem' }} aria-hidden="true" />

          {/* Zoom controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <button
              className="editor-tool-btn"
              onClick={() => setScale(s => Math.max(0.5, +(s - 0.2).toFixed(1)))}
              disabled={scale <= 0.5}
              aria-label="Zoom out"
            >
              <ZoomOut size={16} />
            </button>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', minWidth: 42, textAlign: 'center' }}>
              {Math.round(scale * 100)}%
            </span>
            <button
              className="editor-tool-btn"
              onClick={() => setScale(s => Math.min(3, +(s + 0.2).toFixed(1)))}
              disabled={scale >= 3}
              aria-label="Zoom in"
            >
              <ZoomIn size={16} />
            </button>
          </div>

          <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 0.125rem' }} aria-hidden="true" />

          {/* Swap button */}
          <button
            className="btn-ghost"
            onClick={swapPdfs}
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem' }}
            aria-label="Swap Original and Modified PDFs"
          >
            <ArrowLeftRight size={15} /> Swap PDFs
          </button>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {(isRenderingA || isRenderingB) && <Loader2 className="spinner" size={14} color="var(--primary)" aria-label="Rendering…" />}
            {pageCountA !== pageCountB && (
              <span style={{ color: 'var(--error)', background: 'var(--error-bg)', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem' }}>
                Page counts differ ({pageCountA} vs {pageCountB}) — showing {minPageCount}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Side-by-side viewer */}
      {bothLoaded ? (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          {/* Side A */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.375rem', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.75rem', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} aria-hidden="true" />
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Original</span>
              {isRenderingA && <Loader2 className="spinner" size={12} color="var(--primary)" style={{ marginLeft: 'auto' }} />}
            </div>
            <div style={{ overflow: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: '#f8f8f8', minHeight: 400, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '0.5rem' }}>
              <canvas ref={canvasARef} aria-label={`Original PDF page ${currentPage}`} style={{ display: 'block', boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }} />
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 2, alignSelf: 'stretch', background: 'var(--border)', borderRadius: 1, flexShrink: 0, marginTop: 36 }} aria-hidden="true" />

          {/* Side B */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.375rem', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.75rem', background: 'rgba(234,88,12,0.08)', border: '1px solid rgba(234,88,12,0.2)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ea580c', flexShrink: 0 }} aria-hidden="true" />
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Modified</span>
              {isRenderingB && <Loader2 className="spinner" size={12} color="var(--primary)" style={{ marginLeft: 'auto' }} />}
            </div>
            <div style={{ overflow: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: '#f8f8f8', minHeight: 400, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '0.5rem' }}>
              <canvas ref={canvasBRef} aria-label={`Modified PDF page ${currentPage}`} style={{ display: 'block', boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }} />
            </div>
          </div>
        </div>
      ) : (
        !pdfA && !pdfB && (
          <div className="preview-empty" style={{ minHeight: 340 }} role="img" aria-label="No PDFs loaded">
            <GitCompare size={52} aria-hidden="true" />
            <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Upload two PDFs to compare</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Both PDFs will be displayed side by side with synchronized navigation
            </p>
          </div>
        )
      )}
    </div>
  );
}
