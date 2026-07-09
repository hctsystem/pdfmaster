import { useState, useRef } from 'react';
import { Upload, Download, ZoomIn, ZoomOut, FileText } from 'lucide-react';

export default function PdfViewerTool() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [zoom, setZoom] = useState(100);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleFile = (file: File) => {
    if (file.type !== 'application/pdf') return;
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    const url = URL.createObjectURL(file);
    setPdfUrl(url);
    setFileName(file.name);
    setZoom(100);
  };

  const handleFiles = (files: FileList) => {
    if (files.length > 0) handleFile(files[0]);
  };

  const handleDownload = () => {
    if (!pdfUrl) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = fileName;
    a.click();
  };

  const zoomIn  = () => setZoom(z => Math.min(z + 25, 200));
  const zoomOut = () => setZoom(z => Math.max(z - 25, 50));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {!pdfUrl ? (
        <div
          className={`upload-area ${isDragging ? 'dragging' : ''}`}
          style={{ minHeight: 280 }}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Upload PDF to view"
          onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
        >
          <FileText size={56} className="upload-icon" aria-hidden="true" />
          <div>
            <p><strong style={{ color: 'var(--text-main)' }}>Drag & Drop PDF</strong> or click to browse</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              View and navigate your PDF document in-browser
            </p>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="application/pdf"
            onChange={e => e.target.files && handleFiles(e.target.files)}
            aria-label="Select PDF file"
          />
        </div>
      ) : (
        <div
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
          role="main"
          aria-label={`Viewing: ${fileName}`}
        >
          {/* Toolbar */}
          <div className="viewer-toolbar" role="toolbar" aria-label="PDF viewer controls">
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
              <FileText size={16} color="var(--text-muted)" aria-hidden="true" />
              <span style={{
                fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>
                {fileName}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <button
                className="editor-tool-btn"
                onClick={zoomOut}
                disabled={zoom <= 50}
                aria-label="Zoom out"
                title="Zoom Out"
              >
                <ZoomOut size={15} />
              </button>
              <span className="page-counter" aria-label={`Zoom: ${zoom}%`}>{zoom}%</span>
              <button
                className="editor-tool-btn"
                onClick={zoomIn}
                disabled={zoom >= 200}
                aria-label="Zoom in"
                title="Zoom In"
              >
                <ZoomIn size={15} />
              </button>
            </div>

            <button
              className="editor-tool-btn"
              onClick={() => { setPdfUrl(null); setFileName(''); }}
              aria-label="Open different PDF"
            >
              <Upload size={14} />
              Change
            </button>
            <button
              className="editor-tool-btn"
              onClick={handleDownload}
              style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}
              aria-label={`Download ${fileName}`}
            >
              <Download size={14} />
              Download
            </button>
          </div>

          {/* PDF iframe */}
          <div
            style={{
              height: 'calc(100vh - 280px)',
              minHeight: 500,
              overflow: 'auto',
              background: '#525659',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              padding: '1.5rem',
            }}
            role="document"
          >
            <iframe
              ref={iframeRef}
              src={`${pdfUrl}#zoom=${zoom}&toolbar=1&navpanes=1`}
              title={`PDF Viewer: ${fileName}`}
              style={{
                width: `${zoom}%`,
                height: '100%',
                minHeight: 600,
                border: 'none',
                borderRadius: '4px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                background: '#fff',
                maxWidth: '100%',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
