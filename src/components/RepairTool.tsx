import { useRef, useState } from 'react';
import { FileText, Wrench, Loader2, Download, Trash2 } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

export default function RepairTool() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError('');
    setSuccess('');
    setFile(files[0]);
  };

  const reset = () => {
    setFile(null);
    setError('');
    setSuccess('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRepair = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError('');
    setSuccess('');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer, {
        ignoreEncryption: true,
        throwOnInvalidObject: false,
      } as Parameters<typeof PDFDocument.load>[1]);

      const repairedBytes = await pdfDoc.save();
      const blob = new Blob([repairedBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = file.name.replace(/\.pdf$/i, '');
      a.download = `repaired_${baseName}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccess('PDF repaired and downloaded successfully!');
    } catch (err) {
      console.error(err);
      setError('This PDF may be too corrupted to repair automatically.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
          Repair PDF
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Attempt to fix corrupted or damaged PDF files by re-parsing and re-saving the structure.
        </p>
      </div>

      {!file ? (
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
          <Wrench size={48} className="upload-icon" />
          <div>
            <p><strong style={{ color: 'var(--text-main)' }}>Drag &amp; Drop PDF</strong> or click to browse</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Upload even potentially corrupted PDF files
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
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="file-item">
            <div className="file-info">
              <FileText size={18} color="var(--primary)" />
              <div className="file-details">
                <h4>{file.name}</h4>
                <p>{(file.size / 1024).toFixed(0)} KB</p>
              </div>
            </div>
            <button className="btn-icon" onClick={reset} title="Remove file">
              <Trash2 size={15} />
            </button>
          </div>

          <div
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <Wrench size={20} color="var(--primary)" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
              <div>
                <p style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem', fontSize: '0.95rem' }}>
                  How PDF Repair Works
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
                  Re-parses and re-saves the PDF structure, fixing minor corruptions, orphaned
                  cross-reference tables, and metadata issues. Encryption is bypassed where
                  possible. Severely damaged files may not be recoverable.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div
              style={{
                background: 'var(--error-bg)',
                border: '1px solid var(--error)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem 1rem',
                color: 'var(--error)',
                fontSize: '0.875rem',
              }}
            >
              {error}
            </div>
          )}
          {success && (
            <div
              style={{
                background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
                border: '1px solid var(--primary)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem 1rem',
                color: 'var(--primary)',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              {success}
            </div>
          )}

          <button
            className="download-btn"
            onClick={handleRepair}
            disabled={isProcessing}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            {isProcessing ? <Loader2 className="spinner" size={20} /> : <Download size={20} />}
            {isProcessing ? 'Repairing PDF...' : 'Repair PDF'}
          </button>
        </div>
      )}
    </div>
  );
}
