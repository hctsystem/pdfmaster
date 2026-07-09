import { useState, useRef } from 'react';
import {
  Download, Loader2, Trash2,
  CheckCircle2, ArrowUp, ArrowDown, ListOrdered,
  Scissors, FileText
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

type Mode = 'extract' | 'organize';

export default function SplitTool() {
  const [file, setFile]           = useState<File | null>(null);
  const [mode, setMode]           = useState<Mode>('organize');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging]     = useState(false);
  const [pagesToExtract, setPagesToExtract] = useState('');
  const [pageOrder, setPageOrder]       = useState<number[]>([]);
  const [pageCount, setPageCount]       = useState(0);
  const [previewUrl, setPreviewUrl]     = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList) => {
    if (files.length > 0 && files[0].type === 'application/pdf') {
      const selectedFile = files[0];
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(selectedFile);
      setFile(selectedFile);
      setPreviewUrl(url);
      try {
        const bytes = await selectedFile.arrayBuffer();
        const pdf = await PDFDocument.load(bytes);
        const count = pdf.getPageCount();
        setPageCount(count);
        setPageOrder(Array.from({ length: count }, (_, i) => i));
      } catch (error) {
        console.error('Error loading PDF:', error);
      }
    }
  };

  const movePage = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...pageOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < newOrder.length) {
      [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
      setPageOrder(newOrder);
    }
  };

  const removePage = (index: number) => {
    setPageOrder(prev => prev.filter((_, i) => i !== index));
  };

  const processPdf = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const bytes = await file.arrayBuffer();
      const pdf = await PDFDocument.load(bytes);
      const newPdf = await PDFDocument.create();
      let finalPages: number[] = [];

      if (mode === 'extract') {
        const ranges = pagesToExtract.split(',').map(r => r.trim());
        ranges.forEach(range => {
          if (range.includes('-')) {
            const [start, end] = range.split('-').map(Number);
            for (let i = start; i <= end; i++) {
              if (i > 0 && i <= pageCount) finalPages.push(i - 1);
            }
          } else {
            const page = Number(range);
            if (page > 0 && page <= pageCount) finalPages.push(page - 1);
          }
        });
      } else {
        finalPages = pageOrder;
      }

      if (finalPages.length === 0) throw new Error('No pages selected.');
      const copiedPages = await newPdf.copyPages(pdf, finalPages);
      copiedPages.forEach(p => newPdf.addPage(p));

      const resultBytes = await newPdf.save();
      const blob = new Blob([resultBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${mode === 'organize' ? 'organized' : 'extracted'}_${file.name}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Failed to process PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
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
            role="button" tabIndex={0} aria-label="Upload PDF to split or organize"
            onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            <Scissors size={48} className="upload-icon" aria-hidden="true" />
            <div>
              <p><strong style={{ color: 'var(--text-main)' }}>Drag & Drop PDF</strong> or click to browse</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Reorder pages or extract a selection</p>
            </div>
            <input
              type="file" ref={fileInputRef} style={{ display: 'none' }}
              onChange={e => e.target.files && handleFiles(e.target.files)}
              accept="application/pdf"
              aria-label="Select PDF to split"
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="tabs" role="tablist" aria-label="Split tool mode">
              <button
                className={`tab ${mode === 'organize' ? 'active' : ''}`}
                onClick={() => setMode('organize')}
                role="tab" aria-selected={mode === 'organize'}
              >
                <ListOrdered size={15} aria-hidden="true" /> Reorder Pages
              </button>
              <button
                className={`tab ${mode === 'extract' ? 'active' : ''}`}
                onClick={() => setMode('extract')}
                role="tab" aria-selected={mode === 'extract'}
              >
                <Scissors size={15} aria-hidden="true" /> Extract Pages
              </button>
            </div>

            <div className="file-item">
              <div className="file-info">
                <CheckCircle2 size={18} color="var(--primary)" aria-hidden="true" />
                <div className="file-details">
                  <h4>{file.name}</h4>
                  <p>{pageCount} pages · {(file.size / 1024).toFixed(0)} KB</p>
                </div>
              </div>
              <button
                className="btn-icon"
                onClick={() => {
                  setFile(null);
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                  setPageCount(0); setPageOrder([]);
                }}
                aria-label="Remove file"
              >
                <Trash2 size={15} />
              </button>
            </div>

            {mode === 'organize' ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                  gap: '0.75rem',
                }}
                role="list"
                aria-label="Page order — reorder pages before saving"
              >
                {pageOrder.map((pageIdx, index) => (
                  <div
                    key={`${pageIdx}-${index}`}
                    className="page-card"
                    role="listitem"
                    aria-label={`Page ${pageIdx + 1} — position ${index + 1}`}
                  >
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Page</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>{pageIdx + 1}</div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.2rem', marginTop: '0.75rem' }}>
                      <button
                        className="btn-icon"
                        style={{ width: 28, height: 28 }}
                        onClick={() => movePage(index, 'up')}
                        disabled={index === 0}
                        aria-label={`Move page ${pageIdx + 1} up`}
                        title="Move up"
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        className="btn-icon"
                        style={{ width: 28, height: 28 }}
                        onClick={() => movePage(index, 'down')}
                        disabled={index === pageOrder.length - 1}
                        aria-label={`Move page ${pageIdx + 1} down`}
                        title="Move down"
                      >
                        <ArrowDown size={12} />
                      </button>
                      <button
                        className="btn-icon"
                        style={{ width: 28, height: 28, color: 'var(--error)' }}
                        onClick={() => removePage(index)}
                        aria-label={`Remove page ${pageIdx + 1}`}
                        title="Remove page"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <label htmlFor="pages-input" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  Pages to Extract (e.g. 1, 3-5, 7)
                </label>
                <input
                  id="pages-input"
                  type="text"
                  placeholder="e.g. 1, 3-5, 8"
                  value={pagesToExtract}
                  onChange={e => setPagesToExtract(e.target.value)}
                  className="text-input"
                  aria-label="Page numbers to extract"
                  aria-describedby="pages-hint"
                />
                <p id="pages-hint" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  Use commas to separate pages and hyphens for ranges. This PDF has {pageCount} pages.
                </p>
              </div>
            )}

            <button
              className="download-btn"
              onClick={processPdf}
              disabled={isProcessing || (mode === 'extract' && !pagesToExtract) || (mode === 'organize' && pageOrder.length === 0)}
              aria-label={mode === 'organize' ? 'Save new page order as PDF' : 'Extract selected pages as PDF'}
            >
              {isProcessing ? <Loader2 className="spinner" size={20} /> : <Download size={20} />}
              {mode === 'organize' ? 'Save New Sequence' : 'Extract Pages'}
            </button>
          </div>
        )}
      </div>

      {/* ── Preview Panel ── */}
      <div className="tool-preview-panel">
        <div className="preview-panel-header">
          <h4>PDF Preview</h4>
          {pageCount > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{pageCount} pages</span>}
        </div>
        <div className="preview-panel-body" style={{ height: 520 }}>
          {previewUrl ? (
            <iframe
              src={previewUrl}
              title={`Preview: ${file?.name}`}
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          ) : (
            <div className="preview-empty" role="img" aria-label="No PDF loaded">
              <FileText size={48} aria-hidden="true" />
              <p>Upload a PDF to preview it</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
