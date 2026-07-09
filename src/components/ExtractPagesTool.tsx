import { useState, useRef, useCallback } from 'react';
import { FileText, Scissors, Loader2, Download, Trash2 } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

function parsePageRange(input: string, maxPage: number): number[] {
  const pages = new Set<number>();
  const parts = input.split(',').map(s => s.trim()).filter(Boolean);

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map(s => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        const lo = Math.max(1, Math.min(start, end));
        const hi = Math.min(maxPage, Math.max(start, end));
        for (let p = lo; p <= hi; p++) pages.add(p);
      }
    } else {
      const p = parseInt(part, 10);
      if (!isNaN(p) && p >= 1 && p <= maxPage) pages.add(p);
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
}

export default function ExtractPagesTool() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [rangeInput, setRangeInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFile = useCallback(async (f: File) => {
    if (!f || f.type !== 'application/pdf') return;
    const bytes = await f.arrayBuffer();
    const pdfDoc = await PDFDocument.load(bytes);
    setFile(f);
    setPageCount(pdfDoc.getPageCount());
    setRangeInput('');
  }, []);

  const handleFiles = (files: FileList | null) => {
    if (files && files[0]) loadFile(files[0]);
  };

  const reset = () => {
    setFile(null);
    setPageCount(0);
    setRangeInput('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const parsedPages = rangeInput.trim() ? parsePageRange(rangeInput, pageCount) : [];
  const hasValidPages = parsedPages.length > 0;

  const handleExtract = async () => {
    if (!file || !hasValidPages) return;
    setIsProcessing(true);
    try {
      const bytes = await file.arrayBuffer();
      const srcDoc = await PDFDocument.load(bytes);
      const newDoc = await PDFDocument.create();

      // Convert 1-based page numbers to 0-based indices
      const indices = parsedPages.map(p => p - 1);
      const copied = await newDoc.copyPages(srcDoc, indices);
      copied.forEach(page => newDoc.addPage(page));

      const pdfBytes = await newDoc.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace(/\.pdf$/i, '') + '_extracted.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to extract pages:', err);
    } finally {
      setIsProcessing(false);
    }
  };

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
        <Scissors size={48} className="upload-icon" />
        <div>
          <p><strong style={{ color: 'var(--text-main)' }}>Drag & Drop PDF</strong> or click to browse</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Extract specific pages into a new PDF
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

        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Range input */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '0.4rem',
            }}>
              Page Range
            </label>
            <input
              type="text"
              value={rangeInput}
              onChange={e => setRangeInput(e.target.value)}
              placeholder={`e.g. 1-3, 5, 7-9`}
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1.5px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text-main)',
                fontSize: '0.9rem',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'var(--transition)',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
              Comma-separated pages or ranges (max page: {pageCount})
            </p>
          </div>

          {/* Stats */}
          <div style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Pages to extract</span>
            <span style={{
              fontWeight: 700,
              fontSize: '1rem',
              color: hasValidPages ? 'var(--primary)' : 'var(--text-muted)',
            }}>
              {parsedPages.length}
            </span>
          </div>
        </div>

        <button
          className="download-btn"
          onClick={handleExtract}
          disabled={!hasValidPages || isProcessing}
          style={{ marginTop: 'auto' }}
        >
          {isProcessing ? <Loader2 className="spinner" size={20} /> : <Download size={20} />}
          {isProcessing ? 'Extracting…' : 'Extract Pages'}
        </button>
      </aside>

      {/* Preview Panel */}
      <section className="tool-preview-panel">
        <div className="preview-panel-header">
          <span>Pages to Extract</span>
          {hasValidPages && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {parsedPages.length} page{parsedPages.length !== 1 ? 's' : ''} selected
            </span>
          )}
        </div>
        <div className="preview-panel-body">
          {!hasValidPages ? (
            <div className="preview-empty">
              <Scissors size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <p>Enter a page range to preview which pages will be extracted.</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Example: <code style={{ background: 'var(--surface-2)', padding: '0.1rem 0.35rem', borderRadius: 'var(--radius-sm)' }}>1-3, 5, 7-9</code>
              </p>
            </div>
          ) : (
            <div style={{ padding: '1rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                The following pages will be included in the extracted PDF:
              </p>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}>
                {parsedPages.map((pageNum, idx) => (
                  <div
                    key={pageNum}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.4rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface-2)',
                      border: '1.5px solid var(--primary)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: 'var(--primary)',
                    }}
                  >
                    <FileText size={13} />
                    <span>Page {pageNum}</span>
                    {idx < parsedPages.length - 1 && (
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '0.15rem' }}>→</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Visual order info */}
              <div style={{
                marginTop: '1.5rem',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}>
                <strong style={{ color: 'var(--text-main)' }}>Output PDF:</strong>{' '}
                {parsedPages.length} page{parsedPages.length !== 1 ? 's' : ''} extracted in order — pages{' '}
                {parsedPages.join(', ')} from "<em>{file.name}</em>"
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
