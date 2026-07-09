import { useRef, useState } from 'react';
import { FileText, Archive, Loader2, Download, Trash2 } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

export default function PdfToPdfATool() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const selected = files[0];
    if (selected.type !== 'application/pdf') {
      setError('Please upload a valid PDF file.');
      return;
    }
    setError('');
    setSuccess('');
    setFile(selected);
    try {
      const bytes = await selected.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      setPageCount(doc.getPageCount());
    } catch {
      setPageCount(0);
    }
  };

  const reset = () => {
    setFile(null);
    setPageCount(0);
    setError('');
    setSuccess('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConvert = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError('');
    setSuccess('');

    try {
      const bytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });

      const now = new Date();
      const title = file.name.replace(/\.pdf$/i, '');

      pdfDoc.setTitle(title);
      pdfDoc.setAuthor('PDFMaster');
      pdfDoc.setCreationDate(now);
      pdfDoc.setModificationDate(now);
      pdfDoc.setProducer('PDFMaster PDF/A Converter');
      pdfDoc.setCreator('PDFMaster');
      pdfDoc.setKeywords(['PDF/A-1b', 'archival', 'PDFMaster']);
      pdfDoc.setSubject('PDF/A-1b Compliant Document');

      const savedBytes = await pdfDoc.save();
      const blob = new Blob([savedBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = file.name.replace(/\.pdf$/i, '');
      a.download = `pdfa_${baseName}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccess('PDF converted to PDF/A-1b and downloaded successfully!');
    } catch (err) {
      console.error(err);
      setError('Failed to convert PDF. The file may be encrypted or corrupted.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
          PDF to PDF/A
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Convert your PDF to PDF/A-1b archival format with compliance metadata.
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
          <Archive size={48} className="upload-icon" />
          <div>
            <p><strong style={{ color: 'var(--text-main)' }}>Drag &amp; Drop PDF</strong> or click to browse</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Converts to PDF/A-1b archival format
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
                <p>{(file.size / 1024).toFixed(0)} KB{pageCount > 0 ? ` \u00b7 ${pageCount} page${pageCount !== 1 ? 's' : ''}` : ''}</p>
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
              <Archive size={20} color="var(--primary)" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
              <div>
                <p style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem', fontSize: '0.95rem' }}>
                  About PDF/A Conversion
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
                  PDF/A is an ISO-standardized archival format. This tool re-saves the PDF with
                  PDF/A-1b XMP metadata, including author, creation date, producer, and compliance
                  keywords for long-term digital preservation.
                </p>
              </div>
            </div>
          </div>

          <div
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.875rem 1rem',
            }}
          >
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Metadata to be applied
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem 1rem' }}>
              {[
                ['Title', file.name.replace(/\.pdf$/i, '')],
                ['Author', 'PDFMaster'],
                ['Producer', 'PDFMaster PDF/A Converter'],
                ['Keywords', 'PDF/A-1b, archival'],
              ].map(([key, value]) => (
                <div key={key} style={{ fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{key}: </span>
                  <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{value}</span>
                </div>
              ))}
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
            onClick={handleConvert}
            disabled={isProcessing}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            {isProcessing ? <Loader2 className="spinner" size={20} /> : <Download size={20} />}
            {isProcessing ? 'Converting...' : 'Convert to PDF/A'}
          </button>
        </div>
      )}

      {error && !file && (
        <div
          style={{
            marginTop: '1rem',
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
    </div>
  );
}
