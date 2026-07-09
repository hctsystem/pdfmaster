import { useState, useRef } from 'react';
import { Loader2, FileText, Trash2, AlertTriangle } from 'lucide-react';

export default function WordToPdfTool() {
  const [file, setFile]             = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging]     = useState(false);
  const [serverError, setServerError]   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList) => {
    if (files.length > 0) {
      const f = files[0];
      if (f.name.endsWith('.doc') || f.name.endsWith('.docx')) {
        setFile(f);
        setServerError(false);
      } else {
        alert('Please select a valid Word document (.doc or .docx)');
      }
    }
  };

  const convertFile = async () => {
    if (!file) return;
    setIsProcessing(true);
    setServerError(false);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch('http://localhost:3001/api/convert/word-to-pdf', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Conversion failed on server');
      }
      const blob = await response.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${file.name.split('.')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error(error);
      setServerError(true);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 680 }}>
      {/* Server requirement notice */}
      <div style={{
        background: 'rgba(96,165,250,0.08)',
        border: '1px solid rgba(96,165,250,0.2)',
        borderRadius: 'var(--radius-sm)',
        padding: '1rem 1.25rem',
        display: 'flex', alignItems: 'flex-start', gap: '0.75rem'
      }}>
        <AlertTriangle size={18} color="var(--secondary)" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
        <div style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text-main)' }}>Backend Server Required</strong>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            This tool requires the local Express server (<code style={{ color: 'var(--secondary)' }}>cd server && node index.js</code>) and LibreOffice to be installed on your system.
          </p>
        </div>
      </div>

      {serverError && (
        <div style={{
          background: 'var(--error-bg)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 'var(--radius-sm)',
          padding: '1rem 1.25rem',
          fontSize: '0.875rem',
          color: 'var(--error)',
        }} role="alert">
          <strong>Connection failed.</strong> Make sure the local server is running on port 3001 and LibreOffice is installed.
        </div>
      )}

      {!file ? (
        <div
          className={`upload-area ${isDragging ? 'dragging' : ''}`}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
          role="button" tabIndex={0} aria-label="Upload Word document to convert to PDF"
          onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
        >
          <FileText size={48} className="upload-icon" aria-hidden="true" />
          <div>
            <p><strong style={{ color: 'var(--text-main)' }}>Drag & Drop Word Document</strong> or click to browse</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Supports .doc and .docx files</p>
          </div>
          <input
            type="file" ref={fileInputRef} style={{ display: 'none' }}
            onChange={e => e.target.files && handleFiles(e.target.files)}
            accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            aria-label="Select Word document"
          />
        </div>
      ) : (
        <div className="tool-controls-panel">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="file-item">
              <div className="file-info">
                <FileText size={18} color="var(--secondary)" aria-hidden="true" />
                <div className="file-details">
                  <h4>{file.name}</h4>
                  <p>{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              </div>
              <button className="btn-icon" onClick={() => { setFile(null); setServerError(false); }} aria-label="Remove file">
                <Trash2 size={15} />
              </button>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              High-fidelity conversion preserving formatting, fonts, and layout via LibreOffice on the local server.
            </p>

            <button
              className="download-btn"
              onClick={convertFile}
              disabled={isProcessing}
              aria-label={`Convert ${file.name} to PDF`}
            >
              {isProcessing ? <Loader2 className="spinner" size={20} /> : <FileText size={20} />}
              {isProcessing ? 'Converting…' : 'Convert to PDF'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
