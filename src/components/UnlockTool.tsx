import { useState, useRef } from 'react';
import { Unlock, Eye, EyeOff, Loader2, Download, Shield, Trash2, FileText } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

export default function UnlockTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (f.type !== 'application/pdf') {
      setError('Please upload a valid PDF file.');
      return;
    }
    setError(null);
    setInfo(null);
    setPassword('');
    setFile(f);

    // Attempt to load without a password to detect encryption
    try {
      const bytes = await f.arrayBuffer();
      const pdf = await PDFDocument.load(bytes);
      setPageCount(pdf.getPageCount());
      setInfo('This PDF is not password-protected. You can download it directly.');
    } catch (err: unknown) {
      // If it fails, it's likely encrypted — show the password input
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('encrypt') || msg.toLowerCase().includes('password')) {
        setInfo(null);
        // Page count unknown until unlocked
        setPageCount(0);
      } else {
        setError('Could not read the PDF file.');
        setFile(null);
      }
    }
  };

  const reset = () => {
    setFile(null);
    setPageCount(0);
    setError(null);
    setInfo(null);
    setPassword('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUnlock = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);

    try {
      const bytes = await file.arrayBuffer();

      let pdfDoc: PDFDocument;

      // If the PDF is not encrypted (info is set), just load it normally
      if (info) {
        pdfDoc = await PDFDocument.load(bytes);
      } else {
        // Try with provided password
        try {
          pdfDoc = await PDFDocument.load(bytes, { password } as any);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (
            msg.toLowerCase().includes('password') ||
            msg.toLowerCase().includes('encrypt') ||
            msg.toLowerCase().includes('incorrect')
          ) {
            setError('Incorrect password or could not unlock this PDF.');
          } else {
            setError('Failed to unlock the PDF. Please try again.');
          }
          setIsProcessing(false);
          return;
        }
      }

      // Save without encryption
      const savedBytes = await pdfDoc.save();
      const blob = new Blob([savedBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `unlocked_${file.name}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError('Failed to unlock the PDF. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const isNotEncrypted = Boolean(info);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.75rem' }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 'var(--radius)',
            background: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Unlock size={22} color="#fff" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Unlock PDF
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Remove password protection from a PDF file
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: 'var(--error-bg)',
            border: '1px solid var(--error)',
            color: 'var(--error)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
          }}
        >
          <Shield size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          {error}
        </div>
      )}

      {!file ? (
        /* Upload Area */
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
          <Unlock size={48} className="upload-icon" />
          <div>
            <p>
              <strong style={{ color: 'var(--text-main)' }}>Drag & Drop PDF</strong> or click to browse
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Supports password-protected PDF files
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* File Item */}
          <div className="file-item">
            <div className="file-info">
              <FileText size={18} color="var(--primary)" />
              <div className="file-details">
                <h4>{file.name}</h4>
                <p>
                  {(file.size / 1024).toFixed(0)} KB
                  {pageCount > 0 ? ` · ${pageCount} page${pageCount !== 1 ? 's' : ''}` : ''}
                  {isNotEncrypted
                    ? ' · Not encrypted'
                    : ' · Password protected'}
                </p>
              </div>
            </div>
            <button className="btn-icon" onClick={reset} title="Remove file">
              <Trash2 size={15} />
            </button>
          </div>

          {/* Info banner: not encrypted */}
          {isNotEncrypted && (
            <div
              style={{
                background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--primary) 40%, transparent)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem 1rem',
                fontSize: '0.875rem',
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
              }}
            >
              <Shield size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                <strong style={{ color: 'var(--primary)' }}>No password needed.</strong>{' '}
                This PDF is not password-protected. Click below to download a clean copy.
              </span>
            </div>
          )}

          {/* Password input — only shown if encrypted */}
          {!isNotEncrypted && (
            <div
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              {/* Notice */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.6rem',
                  padding: '0.625rem 0.875rem',
                  background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)',
                }}
              >
                <Shield size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                Enter the PDF password to unlock it. The unlocked PDF will have no password restriction.
              </div>

              {/* Password Field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label
                  htmlFor="pdf-password"
                  style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}
                >
                  PDF Password
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    id="pdf-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(null); }}
                    placeholder="Enter password…"
                    autoComplete="off"
                    onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                    style={{
                      width: '100%',
                      padding: '0.55rem 2.75rem 0.55rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      border: error ? '1.5px solid var(--error)' : '1px solid var(--border)',
                      background: 'var(--surface-2)',
                      color: 'var(--text-main)',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    style={{
                      position: 'absolute',
                      right: '0.65rem',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Unlock / Download Button */}
          <button
            className="download-btn"
            onClick={handleUnlock}
            disabled={isProcessing || (!isNotEncrypted && !password)}
          >
            {isProcessing
              ? <Loader2 className="spinner" size={20} />
              : <Download size={20} />}
            {isProcessing
              ? 'Unlocking…'
              : isNotEncrypted
                ? 'Download PDF'
                : 'Unlock & Download'}
          </button>
        </div>
      )}
    </div>
  );
}
