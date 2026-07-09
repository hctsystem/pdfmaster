import { useState, useRef, useCallback } from 'react';
import { LayoutGrid, GripVertical, Trash2, Loader2, Download } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface ThumbnailEntry {
  originalIndex: number;
  dataUrl: string;
}

export default function OrganizeTool() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [thumbnails, setThumbnails] = useState<ThumbnailEntry[]>([]);
  const [pageOrder, setPageOrder] = useState<number[]>([]); // indices into thumbnails[]
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState({ current: 0, total: 0 });
  const [isProcessing, setIsProcessing] = useState(false);

  // Drag-reorder state
  const dragSrcIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFile = useCallback(async (f: File) => {
    if (!f || f.type !== 'application/pdf') return;
    setFile(f);
    setThumbnails([]);
    setPageOrder([]);
    setIsRendering(true);

    const bytes = await f.arrayBuffer();

    // Get page count via pdf-lib
    const pdfDoc = await PDFDocument.load(bytes);
    const count = pdfDoc.getPageCount();
    setPageCount(count);
    setRenderProgress({ current: 0, total: count });

    // Render thumbnails via pdfjs
    const loadingTask = pdfjsLib.getDocument({ data: bytes.slice(0) });
    const pdf = await loadingTask.promise;

    const entries: ThumbnailEntry[] = [];
    for (let i = 1; i <= count; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 0.3 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx as any, viewport, canvas }).promise;
      entries.push({ originalIndex: i - 1, dataUrl: canvas.toDataURL('image/jpeg', 0.8) });
      setRenderProgress({ current: i, total: count });
    }

    setThumbnails(entries);
    setPageOrder(entries.map((_, i) => i));
    setIsRendering(false);
  }, []);

  const handleFiles = (files: FileList | null) => {
    if (files && files[0]) loadFile(files[0]);
  };

  const reset = () => {
    setFile(null);
    setPageCount(0);
    setThumbnails([]);
    setPageOrder([]);
    setIsRendering(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Drag-to-reorder handlers ---
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    dragSrcIdx.current = idx;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIdx(idx);
  };

  const handleDragLeave = () => {
    setDragOverIdx(null);
  };

  const handleDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    setDragOverIdx(null);
    const src = dragSrcIdx.current;
    if (src === null || src === dropIdx) return;

    setPageOrder(prev => {
      const next = [...prev];
      const [moved] = next.splice(src, 1);
      next.splice(dropIdx, 0, moved);
      return next;
    });
    dragSrcIdx.current = null;
  };

  const handleDragEnd = () => {
    setDragOverIdx(null);
    dragSrcIdx.current = null;
  };

  // Delete a page from the order
  const deletePage = (orderIdx: number) => {
    setPageOrder(prev => prev.filter((_, i) => i !== orderIdx));
  };

  // Apply & Download
  const handleDownload = async () => {
    if (!file || pageOrder.length === 0) return;
    setIsProcessing(true);
    try {
      const bytes = await file.arrayBuffer();
      const srcDoc = await PDFDocument.load(bytes);
      const newDoc = await PDFDocument.create();

      // pageOrder[i] is an index into thumbnails[], thumbnails[j].originalIndex is the 0-based PDF page
      const originalIndices = pageOrder.map(i => thumbnails[i].originalIndex);
      const copied = await newDoc.copyPages(srcDoc, originalIndices);
      copied.forEach(page => newDoc.addPage(page));

      const pdfBytes = await newDoc.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace(/\.pdf$/i, '') + '_organized.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to organize PDF:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Upload screen
  if (!file) {
    return (
      <div
        className={`upload-area ${isDragging ? 'dragging' : ''}`}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
      >
        <LayoutGrid size={48} className="upload-icon" />
        <div>
          <p><strong style={{ color: 'var(--text-main)' }}>Drag & Drop PDF</strong> or click to browse</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Reorder and delete pages by dragging thumbnails
          </p>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="application/pdf"
          onChange={e => handleFiles(e.target.files)}
        />
      </div>
    );
  }

  return (
    <div className="tool-split-layout">
      {/* Controls Panel */}
      <aside className="tool-controls-panel">
        <div className="file-item">
          <div className="file-info">
            <LayoutGrid size={18} color="var(--primary)" />
            <div className="file-details">
              <h4>{file.name}</h4>
              <p>
                {(file.size / 1024).toFixed(0)} KB · {pageCount} pages
              </p>
            </div>
          </div>
          <button className="btn-icon" onClick={reset} title="Remove file">
            <Trash2 size={15} />
          </button>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {isRendering ? (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <Loader2 className="spinner" size={15} />
              Rendering page {renderProgress.current} of {renderProgress.total}…
            </div>
          ) : (
            <>
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Pages in output</span>
                  <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{pageOrder.length}</span>
                </div>
                {pageOrder.length < pageCount && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Deleted</span>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--error)' }}>
                      {pageCount - pageOrder.length}
                    </span>
                  </div>
                )}
              </div>

              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--text-secondary)' }}>Drag</strong> thumbnails to reorder.{' '}
                <strong style={{ color: 'var(--text-secondary)' }}>Click ×</strong> to delete a page.
              </p>
            </>
          )}
        </div>

        <button
          className="download-btn"
          onClick={handleDownload}
          disabled={isRendering || isProcessing || pageOrder.length === 0}
          style={{ marginTop: 'auto' }}
        >
          {isProcessing ? <Loader2 className="spinner" size={20} /> : <Download size={20} />}
          {isProcessing ? 'Saving…' : 'Apply & Download'}
        </button>
      </aside>

      {/* Preview Panel */}
      <section className="tool-preview-panel">
        <div className="preview-panel-header">
          <span>Page Order</span>
          {!isRendering && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {pageOrder.length} page{pageOrder.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="preview-panel-body">
          {isRendering ? (
            <div className="preview-empty">
              <Loader2 className="spinner" size={36} style={{ marginBottom: '0.75rem', opacity: 0.6 }} />
              <p style={{ fontWeight: 500 }}>
                Rendering page {renderProgress.current} of {renderProgress.total}
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Please wait while thumbnails are generated…
              </p>
              {/* Progress bar */}
              <div style={{
                width: '180px',
                height: '4px',
                borderRadius: '2px',
                background: 'var(--border)',
                marginTop: '1rem',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${renderProgress.total > 0 ? (renderProgress.current / renderProgress.total) * 100 : 0}%`,
                  background: 'var(--primary)',
                  borderRadius: '2px',
                  transition: 'width 0.2s ease',
                }} />
              </div>
            </div>
          ) : pageOrder.length === 0 ? (
            <div className="preview-empty">
              <LayoutGrid size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <p>All pages deleted. Upload a new file to start over.</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '0.75rem',
              padding: '1rem',
            }}>
              {pageOrder.map((thumbIdx, orderIdx) => {
                const thumb = thumbnails[thumbIdx];
                const isDragOver = dragOverIdx === orderIdx;

                return (
                  <div
                    key={`${thumbIdx}-${orderIdx}`}
                    draggable
                    onDragStart={e => handleDragStart(e, orderIdx)}
                    onDragOver={e => handleDragOver(e, orderIdx)}
                    onDragLeave={handleDragLeave}
                    onDrop={e => handleDrop(e, orderIdx)}
                    onDragEnd={handleDragEnd}
                    style={{
                      position: 'relative',
                      borderRadius: 'var(--radius)',
                      border: `2px solid ${isDragOver ? 'var(--primary)' : 'var(--border)'}`,
                      background: isDragOver ? 'color-mix(in srgb, var(--primary) 8%, var(--surface-2))' : 'var(--surface-2)',
                      overflow: 'hidden',
                      cursor: 'grab',
                      transition: 'border-color 0.15s ease, background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease',
                      transform: isDragOver ? 'scale(1.03)' : 'scale(1)',
                      boxShadow: isDragOver ? '0 4px 16px rgba(0,0,0,0.15)' : 'none',
                      userSelect: 'none',
                    }}
                  >
                    {/* Thumbnail image */}
                    <img
                      src={thumb.dataUrl}
                      alt={`Page ${thumb.originalIndex + 1}`}
                      style={{
                        width: '100%',
                        display: 'block',
                        pointerEvents: 'none',
                        aspectRatio: '3/4',
                        objectFit: 'cover',
                        background: '#fff',
                      }}
                      draggable={false}
                    />

                    {/* Drag handle overlay (top left) */}
                    <div style={{
                      position: 'absolute',
                      top: '0.35rem',
                      left: '0.35rem',
                      color: 'rgba(255,255,255,0.85)',
                      background: 'rgba(0,0,0,0.35)',
                      borderRadius: '4px',
                      padding: '2px 3px',
                      display: 'flex',
                      alignItems: 'center',
                      pointerEvents: 'none',
                    }}>
                      <GripVertical size={12} />
                    </div>

                    {/* Page number badge (bottom) */}
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)',
                      padding: '0.5rem 0.4rem 0.3rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: '#fff',
                        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                      }}>
                        {orderIdx + 1}
                        {thumb.originalIndex !== orderIdx && (
                          <span style={{ fontWeight: 400, opacity: 0.75, marginLeft: '2px' }}>
                            (p{thumb.originalIndex + 1})
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Delete button (top right) */}
                    <button
                      onClick={e => { e.stopPropagation(); deletePage(orderIdx); }}
                      style={{
                        position: 'absolute',
                        top: '0.3rem',
                        right: '0.3rem',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: 'rgba(0,0,0,0.5)',
                        border: 'none',
                        color: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        lineHeight: 1,
                        fontSize: '12px',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--error)')}
                      onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.5)')}
                      title={`Delete page ${thumb.originalIndex + 1}`}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
