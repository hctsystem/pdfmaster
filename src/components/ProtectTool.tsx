import { useState, useRef } from 'react';
import { Loader2, Lock, Trash2, FileText, Settings, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { encryptPDF, computePermissionFlags } from '../utils/pdfEncrypt';

export default function ProtectTool() {
  const [file, setFile]                 = useState<File | null>(null);
  const [password, setPassword]         = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging]     = useState(false);
  const [previewUrl, setPreviewUrl]     = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Permission settings
  const [allowPrint, setAllowPrint]     = useState(true);
  const [allowCopy, setAllowCopy]       = useState(true);
  const [allowEdit, setAllowEdit]       = useState(true);
  
  // UI visibility states
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPw, setShowPw]             = useState(false);
  const [showOpw, setShowOpw]           = useState(false);

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
      alert('Please provide both a PDF and an Open password.');
      return;
    }
    
    setIsProcessing(true);
    try {
      const bytes = await file.arrayBuffer();
      
      // Calculate the standard permissions bitmask
      const permBits = computePermissionFlags(allowPrint, allowCopy, allowEdit);
      
      // Encrypt PDF bytes using our custom TS implementation
      const protectedBytes = await encryptPDF(
        new Uint8Array(bytes),
        password,
        ownerPassword || null,
        permBits
      );
      
      const blob = new Blob([protectedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `protected_${file.name}`; a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error(error);
      alert(`Failed to protect PDF: ${error.message}`);
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
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Encrypt and restrict permissions (printing, copying, editing)
              </p>
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

            {/* Document Open Password */}
            <div>
              <label htmlFor="pdf-password" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Document Open Password *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="pdf-password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Password required to open the PDF…"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{
                    width: '100%', padding: '0.75rem 2.5rem 0.75rem 1rem',
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text-main)',
                    fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box'
                  }}
                  aria-label="Password to open the PDF"
                  onKeyDown={e => e.key === 'Enter' && !isProcessing && password && protectPdf()}
                />
                <button
                  onClick={() => setShowPw(p => !p)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Toggle Advanced Permissions Settings */}
            <button
              className="btn-ghost"
              onClick={() => setShowAdvanced(a => !a)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '0.5rem', width: '100%', padding: '0.625rem',
                fontSize: '0.8125rem', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', cursor: 'pointer'
              }}
              aria-expanded={showAdvanced}
            >
              <Settings size={14} />
              {showAdvanced ? 'Hide Restrictions & Permissions' : 'Configure Restrictions & Permissions'}
            </button>

            {showAdvanced && (
              <div style={{
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '1rem',
                display: 'flex', flexDirection: 'column', gap: '1rem'
              }}>
                <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Restrict Document Actions
                </h4>

                {/* Print toggle */}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={allowPrint}
                    onChange={e => setAllowPrint(e.target.checked)}
                    style={{ width: 16, height: 16, marginTop: 3 }}
                    aria-label="Allow Printing"
                  />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Allow Printing</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>If unchecked, readers cannot print this document.</span>
                  </div>
                </label>

                {/* Copy toggle */}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={allowCopy}
                    onChange={e => setAllowCopy(e.target.checked)}
                    style={{ width: 16, height: 16, marginTop: 3 }}
                    aria-label="Allow Copying"
                  />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Allow Text & Image Copying</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>If unchecked, readers cannot select and copy text or graphics.</span>
                  </div>
                </label>

                {/* Edit toggle */}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={allowEdit}
                    onChange={e => setAllowEdit(e.target.checked)}
                    style={{ width: 16, height: 16, marginTop: 3 }}
                    aria-label="Allow Modifying"
                  />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Allow Modifying & Form Filling</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>If unchecked, readers cannot edit text, annotate, or fill form fields.</span>
                  </div>
                </label>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.25rem 0' }} />

                {/* Owner Password */}
                <div>
                  <label htmlFor="owner-password" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                    Permissions Password (Owner Password)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="owner-password"
                      type={showOpw ? 'text' : 'password'}
                      placeholder="Password required to change these permissions…"
                      value={ownerPassword}
                      onChange={e => setOwnerPassword(e.target.value)}
                      style={{
                        width: '100%', padding: '0.5rem 2.5rem 0.5rem 0.75rem',
                        background: 'var(--surface-2)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)', color: 'var(--text-main)',
                        fontSize: '0.8125rem', outline: 'none', boxSizing: 'border-box'
                      }}
                      aria-label="Password to edit these permissions"
                    />
                    <button
                      onClick={() => setShowOpw(p => !p)}
                      style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                      aria-label={showOpw ? 'Hide owner password' : 'Show owner password'}
                    >
                      {showOpw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                    Prevents unauthorized users from removing restrictions.
                  </span>
                </div>
              </div>
            )}

            <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 'var(--radius-sm)', padding: '0.875rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 1, color: 'var(--primary)' }} aria-hidden="true" />
              <span>Make sure to save your passwords. Encrypted content cannot be retrieved or unlocked without the password.</span>
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
