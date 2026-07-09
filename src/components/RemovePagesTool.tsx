import { useState, useRef, useCallback } from 'react';
import { FileText, Trash2, Loader2, Download } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

export default function RemovePagesTool() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFile = useCallback(async (f: File) => {
    if (!f || f.type !== 'application/pdf') return;
    const bytes = await f.arrayBuffer();
    const pdfDoc = await PDFDocument.load(bytes);
    setFile(f);
    setPageCount(pdfDoc.getPageCount());
    setSelectedPages(new Set());
  }, []);

  const handleFiles = (files: FileList | null) => {
    if (files && files[0]) loadFile(files[0]);
  };

  const togglePage = (pageIndex: number) => {
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (next.has(pageIndex)) {
        next.delete(pageIndex);
      } else {
        next.add(pageIndex);
      }
      return next;
    });
  };

  const reset = () => {
    setFile(null);
    setPageCount(0);
    setSelectedPages(new Set());
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemove = async () => {
    if (!file || selectedPages.size === 0 || selectedPages.size === pageCount) return;
    setIsProcessing(true);
    try {
      const bytes = await file.arrayBuffer();
      const srcDoc = await PDFDocument.load(bytes);
      const newDoc = await PDFDocument.create();

      const indicesToKeep = Array.from({ length: pageCount }, (_, i) => i).filter(
        i => !selectedPages.has(i)
      );
      const copied = await newDoc.copyPages(srcDoc, indicesToKeep);
      copied.forEach(page => newDoc.addPage(page));

      const pdfBytes = await newDoc.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace(/\.pdf$/i, '') + '_removed.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to remove pages:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const allSelected = selectedPages.size === pageCount;
  const canRemove = selectedPages.size > 0 && !allSelected;

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
        <Trash2 size={48} className="upload-icon" />
        <div>
          <p><strong style={{ color: 'var(--text-main)' }}>Drag & Drop PDF</strong> or click to browse</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Select pages to permanently remove from your PDF
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
            <FileText size={18} color="var(--primary)" />
            <div className="file-details">
              <h4>{file.name}</h4>
              <p>{(file.size / 1024).toFixed(0)} KB · {pageCount} pages</p>
            </div>
          </div>
          <button className="btn-icon" onClick={reset} title="Remove file">
            <Trash2 size={15} />
          </button>
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Click page cards to mark them for removal.
          </p>

          {/* Selection summary */}
          <div style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Selected for removal
            </span>
            <span style={{
              fontWeight: 700,
              fontSize: '1rem',
              color: selectedPages.size > 0 ? 'var(--error)' : 'var(--text-muted)',
            }}>
              {selectedPages.size} / {pageCount}
            </span>
          </div>

          {allSelected && (
            <p style={{ fontSize: '0.8rem', color: 'var(--error)', marginBottom: '0.75rem' }}>
              Cannot remove all pages. Deselect at least one page.
            </p>
          )}

          {selectedPages.size > 0 && !allSelected && (
            <button
              className="btn-ghost"
              style={{ width: '100%', marginBottom: '0.5rem', fontSize: '0.8rem' }}
              onClick={() => setSelectedPages(new Set())}
            >
              Clear selection
            </button>
          )}
        </div>

        <button
          className="download-btn"
          onClick={handleRemove}
          disabled={!canRemove || isProcessing}
          style={{ marginTop: 'auto' }}
        >
          {isProcessing ? <Loader2 className="spinner" size={20} /> : <Download size={20} />}
          {isProcessing ? 'Processing…' : 'Remove Selected Pages'}
        </button>
      </aside>

      {/* Preview Panel */}
      <section className="tool-preview-panel">
        <div className="preview-panel-header">
          <span>Pages — click to select for removal</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn-ghost"
              style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem' }}
              onClick={() => setSelectedPages(new Set(Array.from({ length: pageCount }, (_, i) => i)))}
            >
              Select All
            </button>
            <button
              className="btn-ghost"
              style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem' }}
              onClick={() => setSelectedPages(new Set())}
            >
              Deselect All
            </button>
          </div>
        </div>
        <div className="preview-panel-body">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.75rem',
            padding: '1rem',
          }}>
            {Array.from({ length: pageCount }, (_, i) => {
              const isSelected = selectedPages.has(i);
              return (
                <button
                  key={i}
                  onClick={() => togglePage(i)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '1.25rem 0.75rem',
                    borderRadius: 'var(--radius)',
                    border: `2px solid ${isSelected ? 'var(--error)' : 'var(--border)'}`,
                    background: isSelected ? 'var(--error-bg)' : 'var(--surface-2)',
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                    position: 'relative',
                    outline: 'none',
                  }}
                  title={isSelected ? `Deselect page ${i + 1}` : `Select page ${i + 1} for removal`}
                >
                  {isSelected && (
                    <div style={{
                      position: 'absolute',
                      top: '0.4rem',
                      right: '0.4rem',
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: 'var(--error)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5.5L4 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                  <FileText
                    size={32}
                    color={isSelected ? 'var(--error)' : 'var(--text-muted)'}
                    style={{ opacity: isSelected ? 1 : 0.6 }}
                  />
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: isSelected ? 'var(--error)' : 'var(--text-secondary)',
                  }}>
                    Page {i + 1}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
