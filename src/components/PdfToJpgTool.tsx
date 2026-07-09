import { useRef, useState } from 'react';
import { FileText, Images, Loader2, Download, Trash2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export default function PdfToJpgTool() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [quality, setQuality] = useState(0.85);
  const [scale, setScale] = useState(1.5);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const selected = files[0];
    if (selected.type !== 'application/pdf') {
      setError('Please upload a valid PDF file.');
      return;
    }
    setError('');
    setFile(selected);
    const arrayBuffer = await selected.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    setPageCount(pdf.numPages);
  };

  const reset = () => {
    setFile(null);
    setPageCount(0);
    setProgress('');
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConvert = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError('');
    setProgress('');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const zip = new JSZip();
      const total = pdf.numPages;

      for (let i = 1; i <= total; i++) {
        setProgress(`Converting page ${i} of ${total}...`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx as any, viewport, canvas }).promise;
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64 = dataUrl.split(',')[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let b = 0; b < binary.length; b++) bytes[b] = binary.charCodeAt(b);
        const blob = new Blob([bytes], { type: 'image/jpeg' });
        const paddedIndex = String(i).padStart(3, '0');
        zip.file(`page_${paddedIndex}.jpg`, blob);
      }

      setProgress('Generating ZIP...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pdf-pages.zip';
      a.click();
      URL.revokeObjectURL(url);
      setProgress(`Done! ${total} page${total !== 1 ? 's' : ''} converted.`);
    } catch (err) {
      console.error(err);
      setError('Failed to convert PDF. The file may be corrupted or encrypted.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
          PDF to JPG
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Convert each page of a PDF into a JPG image, bundled in a ZIP archive.
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
          <Images size={48} className="upload-icon" />
          <div>
            <p><strong style={{ color: 'var(--text-main)' }}>Drag &amp; Drop PDF</strong> or click to browse</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Each page will be saved as a separate JPG
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
                <p>{(file.size / 1024).toFixed(0)} KB &middot; {pageCount} page{pageCount !== 1 ? 's' : ''}</p>
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
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                  JPEG Quality
                </label>
                <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.9rem' }}>
                  {Math.round(quality * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={1.0}
                step={0.05}
                value={quality}
                onChange={e => setQuality(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--primary)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                <span>50% (smaller)</span>
                <span>100% (best)</span>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                  Resolution Scale
                </label>
                <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.9rem' }}>
                  {scale.toFixed(1)}&times;
                </span>
              </div>
              <input
                type="range"
                min={1.0}
                max={3.0}
                step={0.25}
                value={scale}
                onChange={e => setScale(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--primary)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                <span>1x (72 dpi)</span>
                <span>3x (216 dpi)</span>
              </div>
            </div>
          </div>

          {progress && (
            <p style={{ color: 'var(--primary)', fontSize: '0.875rem', fontWeight: 500 }}>
              {progress}
            </p>
          )}
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

          <button
            className="download-btn"
            onClick={handleConvert}
            disabled={isProcessing}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            {isProcessing ? <Loader2 className="spinner" size={20} /> : <Download size={20} />}
            {isProcessing ? (progress || 'Processing...') : 'Convert to JPG'}
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
