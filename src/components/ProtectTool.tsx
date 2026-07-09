import { useState, useRef } from 'react';
import { Loader2, Lock, Trash2, ShieldCheck, FileText } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { encryptPDF } from '@pdfsmaller/pdf-encrypt-lite';

export default function ProtectTool() {
  const [file, setFile]           = useState<File | null>(null);
  const [password, setPassword]   = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging]     = useState(false);
  const [previewUrl, setPreviewUrl]     = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList) => {
    if (files.length > 0 && files[0].type === 'application/pdf') {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(files[0]);
      setFile(files[0]);
      setPreviewUrl(url);
    }
  };

  const protectPdf = async () => {
    if (!file || !password) {
      alert('Please provide both a PDF and a password.');
      return;
    }
    setIsProcessing(true);
    try {
      const bytes = await file.arrayBuffer();
      const pdf = await PDFDocument.load(bytes);
      const pdfBytes = await pdf.save();
      
      // Encrypt PDF bytes using pdf-encrypt-lite client-side
      const protectedBytes = await encryptPDF(pdfBytes, password);
      
      const blob = new Blob([protectedBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `protected_${file.name}`; a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert('Failed to protect PDF.');
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
            role="button" tabIndex={0} aria-label="Upload PDF to protect"
            onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            <Lock size={48} className="upload-icon" aria-hidden="true" />
            <div>
              <p><strong style={{ color: 'var(--text-main)' }}>Drag & Drop PDF</strong> or click to browse</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Encrypt your PDF with a password</p>
            </div>
            <input
              type="file" ref={fileInputRef} style={{ display: 'none' }}
              onChange={e => e.target.files && handleFiles(e.target.files)}
              accept="application/pdf"
              aria-label="Select PDF file to protect"
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="file-item">
              <div className="file-info">
                <Lock size={18} color="var(--error)" aria-hidden="true" />
                <div className="file-details">
                  <h4>{file.name}</h4>
                  <p>{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              </div>
              <button className="btn-icon" onClick={() => { setFile(null); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }} aria-label="Remove file">
                <Trash2 size={15} />
              </button>
            </div>

            <div>
              <label htmlFor="pdf-password" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Set Password
              </label>
              <input
                id="pdf-password"
                type="password"
                placeholder="Enter a secure password…"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="text-input"
                aria-label="Password to protect the PDF"
                onKeyDown={e => e.key === 'Enter' && !isProcessing && password && protectPdf()}
              />
            </div>

            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', padding: '0.875rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              <ShieldCheck size={14} style={{ marginRight: '0.375rem', verticalAlign: 'middle', color: 'var(--error)' }} aria-hidden="true" />
              Store your password safely — a forgotten PDF password cannot be recovered.
            </div>

            <button
              className="download-btn"
              onClick={protectPdf}
              disabled={isProcessing || !password}
              aria-label="Protect and download PDF"
            >
              {isProcessing ? <Loader2 className="spinner" size={20} /> : <Lock size={20} />}
              Protect PDF
            </button>
          </div>
        )}
      </div>

      {/* ── Preview Panel ── */}
      <div className="tool-preview-panel">
        <div className="preview-panel-header">
          <h4>PDF Preview</h4>
        </div>
        <div className="preview-panel-body" style={{ height: 500 }}>
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
