import { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2, PenTool, Trash2, Check, FileText, Move, X } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import SignatureCanvas from 'react-signature-canvas';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export default function SignTool() {
  const [file, setFile]                   = useState<File | null>(null);
  const [isProcessing, setIsProcessing]   = useState(false);
  const [isDragging, setIsDragging]       = useState(false);
  const [showModal, setShowModal]         = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isRendering, setIsRendering]     = useState(false);
  const [pageDataUrl, setPageDataUrl]     = useState<string | null>(null);
  const [pageCount, setPageCount]         = useState(0);
  const [currentPage, setCurrentPage]     = useState(1);
  // sigPos: pixels from top-left of the containerRef div
  const [sigPos, setSigPos]               = useState({ x: 40, y: 40 });
  const [isDraggingSig, setIsDraggingSig] = useState(false);
  const [dragOffset, setDragOffset]       = useState({ x: 0, y: 0 });

  // Customization States
  const [sigWidth, setSigWidth]           = useState(180); // adjustable signature display width (px)
  const [penColor, setPenColor]           = useState('#1e293b'); // pen color: slate, blue, red
  const [penWidth, setPenWidth]           = useState(3); // pen thickness

  const pdfDocRef    = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const sigCanvas    = useRef<SignatureCanvas>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sigImgRef    = useRef<HTMLImageElement>(null);

  // ── Render a PDF page to a data URL ─────────────────────────────
  const renderPage = useCallback(async (doc: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
    setIsRendering(true);
    try {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width  = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport, canvas }).promise;
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

    const buf = await f.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: buf }).promise;
    pdfDocRef.current = doc;
    setPageCount(doc.numPages);
    renderPage(doc, 1);
  };

  useEffect(() => {
    if (pdfDocRef.current) renderPage(pdfDocRef.current, currentPage);
  }, [currentPage, renderPage]);

  // ── Pointer-based drag (works for mouse and touch) ──────────────
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const sigEl = sigImgRef.current;
    if (!sigEl) return;
    const rect = sigEl.getBoundingClientRect();
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setIsDraggingSig(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!isDraggingSig || !containerRef.current || !sigImgRef.current) return;
    e.preventDefault();
    const cRect = containerRef.current.getBoundingClientRect();
    const sigEl = sigImgRef.current.getBoundingClientRect();
    let x = e.clientX - cRect.left - dragOffset.x;
    let y = e.clientY - cRect.top  - dragOffset.y;
    x = Math.max(0, Math.min(cRect.width  - sigEl.width,  x));
    y = Math.max(0, Math.min(cRect.height - sigEl.height, y));
    setSigPos({ x, y });
  }, [isDraggingSig, dragOffset]);

  const onPointerUp = useCallback(() => setIsDraggingSig(false), []);

  useEffect(() => {
    if (!isDraggingSig) return;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup',   onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup',   onPointerUp);
    };
  }, [isDraggingSig, onPointerMove, onPointerUp]);

  // ── Signature canvas ────────────────────────────────────────────
  const clearSignature = () => { sigCanvas.current?.clear(); };
  
  const saveSignature  = () => {
    const canvas = sigCanvas.current;
    if (!canvas) return;
    
    // Fallback if isEmpty() fails or is buggy on some devices
    let dataUrl: string | null = null;
    try {
      // getTrimmedCanvas drops outer empty spaces
      dataUrl = canvas.getTrimmedCanvas().toDataURL('image/png');
    } catch {
      // fallback to full canvas
      dataUrl = canvas.getCanvas().toDataURL('image/png');
    }
    
    if (dataUrl) {
      setSignatureData(dataUrl);
      setSigPos({ x: 40, y: 40 });
      setShowModal(false);
    }
  };

  // ── Stamp signature onto PDF and download ───────────────────────
  const signPdf = async () => {
    if (!file || !signatureData || !containerRef.current || !sigImgRef.current) return;
    setIsProcessing(true);
    try {
      const bytes  = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes);
      const pages  = pdfDoc.getPages();
      const page   = pages[currentPage - 1] ?? pages[pages.length - 1];

      // Rendered container size on screen
      const renderW = containerRef.current.clientWidth;
      const renderH = containerRef.current.clientHeight;

      // Signature natural size for aspect ratio
      const sigNatW = sigImgRef.current.naturalWidth;
      const sigNatH = sigImgRef.current.naturalHeight;
      const sigDisplayH = sigNatW > 0 ? (sigWidth * sigNatH / sigNatW) : sigWidth / 4;

      // Scale screen pixels → PDF units
      const { width: pdfW, height: pdfH } = page.getSize();
      const scaleX  = pdfW / renderW;
      const scaleY  = pdfH / renderH;

      const pdfSigW = sigWidth    * scaleX;
      const pdfSigH = sigDisplayH * scaleY;

      // sigPos.y is pixels from top in screen space; PDF y goes from bottom
      const pdfX = sigPos.x * scaleX;
      const pdfY = pdfH - (sigPos.y * scaleY) - pdfSigH;

      const pngImg = await pdfDoc.embedPng(signatureData);
      page.drawImage(pngImg, {
        x: Math.max(0, Math.min(pdfX, pdfW - pdfSigW)),
        y: Math.max(0, Math.min(pdfY, pdfH - pdfSigH)),
        width:  pdfSigW,
        height: pdfSigH,
      });

      const saved = await pdfDoc.save();
      const blob  = new Blob([saved.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement('a');
      a.href = url; a.download = `signed_${file.name}`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to sign PDF. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setFile(null); setSignatureData(null); setPageDataUrl(null);
    setPageCount(0); setCurrentPage(1);
    pdfDocRef.current = null;
  };

  // Compute displayed signature height for absolute positioning
  const sigDisplayH = sigImgRef.current && sigImgRef.current.naturalWidth > 0
    ? sigWidth * sigImgRef.current.naturalHeight / sigImgRef.current.naturalWidth
    : sigWidth / 4;

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
                aria-label="Select PDF file to sign"
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* File info */}
              <div className="file-item">
                <div className="file-info">
                  <PenTool size={18} color="var(--primary)" aria-hidden="true" />
                  <div className="file-details">
                    <h4>{file.name}</h4>
                    <p>{(file.size / 1024).toFixed(0)} KB · {pageCount} {pageCount === 1 ? 'page' : 'pages'}</p>
                  </div>
                </div>
                <button className="btn-icon" onClick={reset} aria-label="Remove file and start over">
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
                    <button
                      className="editor-tool-btn"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      aria-label="Previous page"
                    >‹</button>
                    <span className="page-counter" aria-live="polite">{currentPage} / {pageCount}</span>
                    <button
                      className="editor-tool-btn"
                      onClick={() => setCurrentPage(p => Math.min(pageCount, p + 1))}
                      disabled={currentPage >= pageCount}
                      aria-label="Next page"
                    >›</button>
                  </div>
                </div>
              )}

              {/* Signature section */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Your Signature
                </label>
                {!signatureData ? (
                  <button
                    className="btn-ghost"
                    style={{ width: '100%', padding: '1.5rem', border: '2px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}
                    onClick={() => setShowModal(true)}
                    aria-label="Open signature pad"
                  >
                    <PenTool size={18} /> Draw Signature
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ background: 'white', borderRadius: 'var(--radius-sm)', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
                      <img src={signatureData} alt="Your saved signature preview" style={{ maxHeight: 60, maxWidth: '100%' }} />
                    </div>

                    {/* Signature stamp width customization */}
                    <div>
                      <label htmlFor="sig-size-slider" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                        <span>Signature Width</span>
                        <span style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>{sigWidth}px</span>
                      </label>
                      <input
                        id="sig-size-slider"
                        type="range"
                        min={60}
                        max={400}
                        step={10}
                        value={sigWidth}
                        onChange={e => setSigWidth(Number(e.target.value))}
                        style={{ width: '100%', cursor: 'pointer' }}
                        aria-label="Adjust signature width"
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn-ghost"
                        onClick={() => { setSignatureData(null); setSigPos({ x: 40, y: 40 }); }}
                        style={{ flex: 1 }}
                        aria-label="Clear signature"
                      >
                        <Trash2 size={14} /> Clear
                      </button>
                      <button className="btn-ghost" onClick={() => setShowModal(true)} style={{ flex: 1 }} aria-label="Redraw signature">
                        <PenTool size={14} /> Redraw
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {signatureData && (
                <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <Move size={14} style={{ flexShrink: 0, marginTop: 1, color: 'var(--primary)' }} aria-hidden="true" />
                  <span><strong style={{ color: 'var(--text-secondary)' }}>Drag</strong> the signature in the preview panel to reposition it exactly where you want it.</span>
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

        {/* ── Preview Panel ── */}
        <div className="tool-preview-panel">
          <div className="preview-panel-header">
            <h4>{signatureData ? 'Drag signature to reposition' : 'PDF Preview'}</h4>
            {isRendering && <Loader2 className="spinner" size={14} color="var(--primary)" />}
          </div>
          <div
            className="preview-panel-body"
            style={{
              height: 560,
              background: '#525659',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem',
              overflow: 'auto',
            }}
          >
            {pageDataUrl ? (
              <div
                ref={containerRef}
                style={{ position: 'relative', display: 'inline-block', lineHeight: 0, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
              >
                <img
                  src={pageDataUrl}
                  alt={`PDF page ${currentPage} preview`}
                  style={{ maxHeight: 520, width: 'auto', display: 'block', userSelect: 'none' }}
                  draggable={false}
                />

                {signatureData && (
                  <img
                    ref={sigImgRef}
                    src={signatureData}
                    alt="Your signature — drag to reposition"
                    draggable={false}
                    onPointerDown={onPointerDown}
                    style={{
                      position: 'absolute',
                      left: `${sigPos.x}px`,
                      top:  `${sigPos.y}px`,
                      width: `${sigWidth}px`,
                      height: `${sigDisplayH}px`,
                      cursor: isDraggingSig ? 'grabbing' : 'grab',
                      filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.35))',
                      userSelect: 'none',
                      touchAction: 'none',
                      outline: isDraggingSig ? '2px dashed var(--primary)' : '2px dashed rgba(59,130,246,0.4)',
                      borderRadius: 4,
                    }}
                  />
                )}
              </div>
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

      {/* ── Signature Drawing Modal ── */}
      {showModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Draw your signature">
          <div className="modal-content" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3>Draw your signature</h3>
              <button className="btn-icon" onClick={() => setShowModal(false)} aria-label="Close signature pad">
                <X size={16} />
              </button>
            </div>
            
            <div className="modal-body">
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Draw your signature below. Adjust the pen options to customize.
              </p>
              
              {/* Pen Settings Controls */}
              <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1rem', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' }}>Pen Color</span>
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    {[
                      { hex: '#1e293b', name: 'Black' },
                      { hex: '#2563eb', name: 'Blue' },
                      { hex: '#dc2626', name: 'Red' },
                    ].map(c => (
                      <button
                        key={c.hex}
                        onClick={() => setPenColor(c.hex)}
                        aria-label={`Select ${c.name} pen color`}
                        style={{
                          width: 24, height: 24, borderRadius: '50%',
                          background: c.hex, cursor: 'pointer',
                          border: penColor === c.hex ? '2px solid var(--primary)' : '1px solid var(--border)',
                          transform: penColor === c.hex ? 'scale(1.15)' : 'none',
                          transition: 'all 150ms',
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="pen-width-select" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' }}>Pen Thickness</label>
                  <select
                    id="pen-width-select"
                    value={penWidth}
                    onChange={e => setPenWidth(Number(e.target.value))}
                    style={{
                      padding: '0.25rem 0.5rem', background: 'var(--surface-2)',
                      border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-main)', fontSize: '0.75rem', cursor: 'pointer'
                    }}
                    aria-label="Select pen thickness"
                  >
                    <option value={1}>Thin (1px)</option>
                    <option value={3}>Medium (3px)</option>
                    <option value={5}>Thick (5px)</option>
                  </select>
                </div>
              </div>

              <div style={{ background: 'white', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <SignatureCanvas
                  ref={sigCanvas}
                  canvasProps={{ width: 476, height: 200, className: 'sigCanvas' }}
                  backgroundColor="rgba(255,255,255,1)"
                  penColor={penColor}
                  minWidth={penWidth - 0.5}
                  maxWidth={penWidth + 0.5}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-ghost" onClick={clearSignature} aria-label="Clear the canvas">
                <Trash2 size={14} /> Clear
              </button>
              <button className="btn-primary" onClick={saveSignature} aria-label="Save the drawn signature">
                <Check size={16} /> Save Signature
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
