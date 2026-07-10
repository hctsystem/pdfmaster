import { useState, useRef, useEffect } from 'react';
import { Loader2, FileText, Trash2, FileSpreadsheet, Presentation, Check, AlertCircle } from 'lucide-react';

interface DocumentConverterProps {
  fromName: string;         // e.g. "Word"
  toName: string;           // e.g. "PDF"
  endpoint: string;         // e.g. "word-to-pdf"
  accept: string;           // e.g. ".doc,.docx"
  acceptDescription: string; // e.g. "Supports .doc and .docx files"
}

export default function DocumentConverterTool({
  fromName,
  toName,
  endpoint,
  accept,
  acceptDescription
}: DocumentConverterProps) {
  const [file, setFile]                 = useState<File | null>(null);
  const [isProcessing, setIsProcessing]   = useState(false);
  const [isDragging, setIsDragging]       = useState(false);
  const [serverError, setServerError]     = useState<string | null>(null);
  const [serverStatus, setServerStatus]   = useState<'checking' | 'online' | 'offline'>('checking');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiHost = import.meta.env.VITE_API_URL || 'https://pdfmaster-backend-thhj.onrender.com';

  // ── Verify Server Connection on Mount ──────────────────────────
  useEffect(() => {
    const checkServer = async () => {
      try {
        // We do a simple ping to see if server is alive.
        // If the server is on Render, it might take ~30s to spin up if cold-started.
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout
        
        const response = await fetch(`${apiHost}/api/convert/word-to-pdf`, {
          method: 'POST',
          signal: controller.signal
        }).catch(() => null);
        
        clearTimeout(timeoutId);
        
        // Since we didn't send a file, the server should respond with 400 'No file uploaded.'
        // If it responds with 400, it means it is online!
        if (response && (response.status === 400 || response.status === 200)) {
          setServerStatus('online');
        } else {
          setServerStatus('offline');
        }
      } catch {
        setServerStatus('offline');
      }
    };
    checkServer();
  }, [apiHost]);

  const handleFiles = (files: FileList) => {
    if (files.length > 0) {
      const f = files[0];
      const ext = `.${f.name.split('.').pop()?.toLowerCase()}`;
      const allowedExts = accept.split(',').map(e => e.trim().toLowerCase());
      
      if (allowedExts.includes(ext) || accept === '*') {
        setFile(f);
        setServerError(null);
      } else {
        alert(`Invalid file type. Please upload a file with format: ${accept}`);
      }
    }
  };

  const convertFile = async () => {
    if (!file) return;
    setIsProcessing(true);
    setServerError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${apiHost}/api/convert/${endpoint}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errMsg = 'Conversion failed on server.';
        try {
          const errData = await response.json();
          errMsg = errData.error || errMsg;
        } catch {
          // ignore
        }
        throw new Error(errMsg);
      }

      const blob = await response.blob();
      const url  = URL.createObjectURL(blob);
      
      // Determine file extension to save as
      let targetExt = '.pdf';
      if (toName === 'Word') targetExt = '.docx';
      else if (toName === 'PowerPoint') targetExt = '.pptx';
      else if (toName === 'Excel') targetExt = '.xlsx';

      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${baseName}${targetExt}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error(error);
      setServerError(error.message || 'Connection failed. Cloud converter might be sleeping.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Render Format-Specific Icons ──
  const getFormatIcon = (format: string, size = 22, color = 'var(--text-secondary)') => {
    const norm = format.toLowerCase();
    if (norm === 'word') {
      return <FileText size={size} color={color} />;
    } else if (norm === 'powerpoint' || norm === 'ppt') {
      return <Presentation size={size} color={color} />;
    } else if (norm === 'excel' || norm === 'xls') {
      return <FileSpreadsheet size={size} color={color} />;
    }
    return <FileText size={size} color={color} />; // default to pdf / document icon
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 680 }}>
      {/* Cloud Server Connectivity Status Badge */}
      <div style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '0.875rem 1.25rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Converter Server:</span>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {apiHost.replace(/^https?:\/\//, '')}
          </span>
        </div>
        
        {serverStatus === 'checking' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--warning)', fontWeight: 700 }}>
            <Loader2 className="spinner" size={12} /> Connecting…
          </span>
        )}
        {serverStatus === 'online' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--success)', fontWeight: 700 }}>
            ● Ready (Cloud Server Online)
          </span>
        )}
        {serverStatus === 'offline' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--error)', fontWeight: 700 }}>
            ● Offline (Connecting Local Fallback)
          </span>
        )}
      </div>

      {/* Connection Failure / Timeout Warning */}
      {serverError && (
        <div style={{
          background: 'var(--error-bg)',
          border: '1px solid var(--error)',
          borderRadius: 'var(--radius-sm)',
          padding: '1rem 1.25rem',
          fontSize: '0.875rem',
          color: 'var(--error)',
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'flex-start'
        }} role="alert">
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Conversion Failed:</strong> {serverError}
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem', lineHeight: 1.5 }}>
              Render servers spin down when idle. It can take up to 60 seconds to boot up on the first request. Please try again in a few moments.
            </p>
          </div>
        </div>
      )}

      {/* Upload Zone */}
      {!file ? (
        <div
          className={`upload-area ${isDragging ? 'dragging' : ''}`}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
          role="button" tabIndex={0} aria-label={`Upload ${fromName} document to convert to ${toName}`}
          onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
        >
          {getFormatIcon(fromName, 48, 'var(--primary)')}
          <div>
            <p><strong style={{ color: 'var(--text-main)' }}>Drag & Drop {fromName} Document</strong> or click to browse</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{acceptDescription}</p>
          </div>
          <input
            type="file" ref={fileInputRef} style={{ display: 'none' }}
            onChange={e => e.target.files && handleFiles(e.target.files)}
            accept={accept}
            aria-label={`Select ${fromName} file`}
          />
        </div>
      ) : (
        <div className="tool-controls-panel">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* File info card */}
            <div className="file-item">
              <div className="file-info">
                {getFormatIcon(fromName, 18, 'var(--primary)')}
                <div className="file-details">
                  <h4>{file.name}</h4>
                  <p>{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              </div>
              <button className="btn-icon" onClick={() => { setFile(null); setServerError(null); }} aria-label="Remove file">
                <Trash2 size={15} />
              </button>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Preserves structural layouts, table borders, embedded images, and fonts via the cloud converter server.
            </p>

            <button
              className="download-btn"
              onClick={convertFile}
              disabled={isProcessing}
              aria-label={`Convert ${file.name} to ${toName}`}
            >
              {isProcessing ? <Loader2 className="spinner" size={20} /> : <Check size={20} />}
              {isProcessing ? 'Converting document…' : `Convert to ${toName}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
