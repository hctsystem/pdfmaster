import { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2, PenTool, Trash2, X, Check, FileText, Move } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import SignatureCanvas from 'react-signature-canvas';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface SigPos {
  x: number; // fraction of container width (0–1)
  y: number; // fraction of container height (0–1)
}

export default function SignTool() {
  const [file, setFile]               = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging]     = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isRendering, setIsRendering]   = useState(false);
  const [pageDataUrl, setPageDataUrl]   = useState<string | null>(null);
  const [pageCount, setPageCount]       = useState(0);
  const [currentPage, setCurrentPage]   = useState(1);
  const [sigPos, setSigPos]             = useState<SigPos>({ x: 0.55, y: 0.78 });
  const [isDraggingSig, setIsDraggingSig] = useState(false);
  const [dragOffset, setDragOffset]     = useState({ x: 0, y: 0 });

  // pdfjs document reference
  const pdfDocRef    = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const sigCanvas    = useRef<SignatureCanvas>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sigImgRef    = useRef<HTMLImageElement>(null);

  // ── Load and render PDF ──────────────────────────────────────────
  const renderPage = useCallback(async (doc: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
    setIsRendering(true);
    try {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width  = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx as any, viewport, canvas }).promise;
      setPageDataUrl(canvas.toDataURL('image/jpeg', 0.85));
    } catch (err) {
      console.error('Render error:', err);
    } finally {
      setIsRendering(false);
    }
  }, []);

  const handleFiles = async (files: FileList) => {
    const f = files[0];
    if (!f || f.type !== 'application/pdf') return;
    setFile(f);
    setSignatureData(null);
    setPageDataUrl(null);
    setCurrentPage(1);

    const arrayBuffer = await f.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const doc = await loadingTask.promise;
    pdfDocRef.current = doc;
    setPageCount(doc.numPages);
    renderPage(doc, 1);
  };

  useEffect(() => {
    if (pdfDocRef.current) renderPage(pdfDocRef.current, currentPage);
  }, [currentPage, renderPage]);

  // ── Draggable signature — uses window listeners to capture fast moves ──
  const onSigMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const sigEl = sigImgRef.current;
    if (!sigEl) return;
    const rect = sigEl.getBoundingClientRect();
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setIsDraggingSig(true);
  };

  // Attach window-level listeners only while dragging so fast mouse moves are never lost
  useEffect(() => {
    if (!isDraggingSig) return;

    const handleMove = (e: MouseEvent) => {
      if (!containerRef.current || !sigImgRef.current) return;
      e.preventDefault();
      const containerRect = containerRef.current.getBoundingClientRect();
      const sigRect       = sigImgRef.current.getBoundingClientRect();
      let x = (e.clientX - containerRect.left - dragOffset.x) / containerRect.width;
      let y = (e.clientY - containerRect.top  - dragOffset.y) / containerRect.height;
      const maxX = 1 - sigRect.width  / containerRect.width;
      const maxY = 1 - sigRect.height / containerRect.height;
      x = Math.max(0, Math.min(maxX, x));
      y = Math.max(0, Math.min(maxY, y));
      setSigPos({ x, y });
    };

    const handleUp = () => setIsDraggingSig(false);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup',  handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup',  handleUp);
    };
  }, [isDraggingSig, dragOffset]);

  // ── Signature canvas ─────────────────────────────────────────────
  const clearSignature = () => { sigCanvas.current?.clear(); setSignatureData(null); };
  const saveSignature  = () => {
    if (sigCanvas.current?.isEmpty()) return;
    setSignatureData(sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png') || null);
    setShowSignModal(false);
  };

  // ── Save signed PDF ──────────────────────────────────────────────
  const signPdf = async () => {
    if (!file || !signatureData || !containerRef.current) return;
    setIsProcessing(true);
    try {
      const bytes = await file.arrayBuffer();
      const pdf = await PDFDocument.load(bytes);
      const pages = pdf.getPages();
      const targetPage = pages[currentPage - 1] ?? pages[pages.length - 1];
      const { width: pdfW, height: pdfH } = targetPage.getSize();

      // Signature intrinsic size — scale to ~30% of page width
      const sigImg    = sigImgRef.current!;
      const sigAspect = sigImg.naturalWidth / sigImg.naturalHeight;
      const sigWpdf   = pdfW * 0.28;
      const sigHpdf   = sigWpdf / sigAspect;

      // Map sigPos fractions → PDF coordinates (Y axis flipped)
      const pdfX = sigPos.x * pdfW;
      const pdfY = pdfH - sigPos.y * pdfH - sigHpdf;

      const pngImage = await pdf.embedPng(signatureData);
      targetPage.drawImage(pngImage, {
        x: Math.max(0, Math.min(pdfX, pdfW - sigWpdf)),
        y: Math.max(0, Math.min(pdfY, pdfH - sigHpdf)),
        width: sigWpdf,
        height: sigHpdf,
      });

      const signedBytes = await pdf.save();
      const blob = new Blob([signedBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `signed_${file.name}`; a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert('Failed to sign PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setFile(null); setSignatureData(null); setPageDataUrl(null);
    setPageCount(0); setCurrentPage(1);
    pdfDocRef.current?.cleanup();
    pdfDocRef.current = null;
  };

  return (
    <>
      <div className="tool-split-layout">
        {/* ── Controls ── */}
        <div className="tool-controls-panel">
          {!file ? (
            <div
              className={`upload-area ${isDragging ? 'dragging' : ''}`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              role="button" tabIndex={0} aria-label="Upload PDF to sign"
              onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
            >
              <PenTool size={48} className="upload-icon" aria-hidden="true" />
              <div>
                <p><strong style={{ color: 'var(--text-main)' }}>Drag & Drop PDF</strong> or click to browse</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Draw a signature then drag it anywhere on the page
                </p>
              </div>
              <input
                type="file" ref={fileInputRef} style={{ display: 'none' }}
                onChange={e => e.target.files && handleFiles(e.target.files)}
                accept="application/pdf"
                aria-label="Select PDF to sign"
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="file-item">
                <div className="file-info">
                  <PenTool size={18} color="var(--primary)" aria-hidden="true" />
                  <div className="file-details">
                    <h4>{file.name}</h4>
                    <p>{(file.size / 1024).toFixed(0)} KB · {pageCount} pages</p>
                  </div>
                </div>
                <button className="btn-icon" onClick={reset} aria-label="Remove file">
                  <Trash2 size={15} />
                </button>
              </div>

              {/* Page picker */}
              {pageCount > 1 && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    Sign on page
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button className="editor-tool-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} aria-label="Previous page">‹</button>
                    <span className="page-counter" aria-live="polite">{currentPage} / {pageCount}</span>
                    <button className="editor-tool-btn" onClick={() => setCurrentPage(p => Math.min(pageCount, p + 1))} disabled={currentPage >= pageCount} aria-label="Next page">›</button>
                  </div>
                </div>
              )}

              {/* Signature */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Signature
                </label>
                {!signatureData ? (
                  <button
                    className="btn-ghost"
                    style={{ width: '100%', padding: '1.5rem', border: '2px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}
                    onClick={() => setShowSignModal(true)}
                    aria-label="Open signature pad to draw your signature"
                  >
                    <PenTool size={18} /> Draw Signature
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ background: 'white', borderRadius: 'var(--radius-sm)', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
                      <img src={signatureData} alt="Your signature" style={{ maxHeight: 64, maxWidth: '100%' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn-ghost" onClick={clearSignature} style={{ flex: 1 }} aria-label="Clear signature"><Trash2 size={14} /> Clear</button>
                      <button className="btn-ghost" onClick={() => setShowSignModal(true)} style={{ flex: 1 }} aria-label="Redraw signature"><PenTool size={14} /> Redraw</button>
                    </div>
                  </div>
                )}
              </div>

              {signatureData && (
                <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <Move size={14} style={{ flexShrink: 0, marginTop: 1, color: 'var(--primary)' }} aria-hidden="true" />
                  <span><strong style={{ color: 'var(--text-secondary)' }}>Drag</strong> the signature in the preview to position it exactly where you want.</span>
                </div>
              )}

              <button
                className="download-btn"
                onClick={signPdf}
                disabled={isProcessing || !signatureData}
                aria-label="Sign PDF and download"
              >
                {isProcessing ? <Loader2 className="spinner" size={20} /> : <Check size={20} />}
                Sign & Download PDF
              </button>
            </div>
          )}
        </div>

        {/* ── Preview Panel — PDF canvas + draggable signature ── */}
        <div className="tool-preview-panel">
          <div className="preview-panel-header">
            <h4>{signatureData ? 'Drag signature to position' : 'PDF Preview'}</h4>
            {isRendering && <Loader2 className="spinner" size={14} color="var(--primary)" />}
          </div>
          <div
            className="preview-panel-body"
            style={{ height: 560, position: 'relative', overflow: 'hidden', padding: 0 }}
            ref={containerRef}
          >
            {pageDataUrl ? (
              <>
                {/* PDF page image */}
                <img
                  src={pageDataUrl}
                  alt={`PDF page ${currentPage} preview`}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', userSelect: 'none' }}
                  draggable={false}
                />

                {/* Draggable signature overlay */}
                {signatureData && (
                  <img
                    ref={sigImgRef}
                    src={signatureData}
                    alt="Signature — drag to reposition"
                    draggable={false}
                    onMouseDown={onSigMouseDown}
                    style={{
                      position: 'absolute',
                      left: `${sigPos.x * 100}%`,
                      top:  `${sigPos.y * 100}%`,
                      width: '28%',
                      cursor: isDraggingSig ? 'grabbing' : 'grab',
                      filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))',
                      userSelect: 'none',
                      transition: isDraggingSig ? 'none' : 'box-shadow 0.2s',
                      outline: isDraggingSig ? '2px dashed var(--primary)' : '2px dashed transparent',
                      borderRadius: 4,
                    }}
                  />
                )}
              </>
            ) : isRendering ? (
              <div className="preview-empty" role="status">
                <Loader2 size={40} className="spinner" color="var(--primary)" />
                <p>Rendering PDF…</p>
              </div>
            ) : (
              <div className="preview-empty" role="img" aria-label="No PDF loaded">
                <FileText size={48} aria-hidden="true" />
                <p>Upload a PDF to preview it</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Signature modal */}
      {showSignModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Signature pad">
          <div className="modal-content" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3>Draw your signature</h3>
              <button className="btn-icon" onClick={() => setShowSignModal(false)} aria-label="Close signature pad"><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Draw your signature below, then drag it to your desired position on the PDF.
              </p>
              <div style={{ background: 'white', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <SignatureCanvas
                  ref={sigCanvas}
                  canvasProps={{ width: 476, height: 200, className: 'sigCanvas' }}
                  backgroundColor="rgba(255,255,255,1)"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={clearSignature} aria-label="Clear the signature pad">Clear</button>
              <button className="btn-primary" onClick={saveSignature} aria-label="Save signature">
                <Check size={16} /> Save Signature
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
