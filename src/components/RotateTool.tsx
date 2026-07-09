import { useState, useRef, useCallback } from 'react';
import { Loader2, RotateCw, Trash2, FileText } from 'lucide-react';
import { PDFDocument, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export default function RotateTool() {
  const [file, setFile]               = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging]     = useState(false);
  const [rotation, setRotation]         = useState(90);
  const [isRendering, setIsRendering]   = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  // ── Render page 1 to an off-screen canvas and store as data URL ───
  const renderPreview = useCallback(async (pdfFile: File) => {
    setIsRendering(true);
    try {
      if (renderTaskRef.current) renderTaskRef.current.cancel();

      const arrayBuffer = await pdfFile.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const doc = await loadingTask.promise;
      const page = await doc.getPage(1);

      const viewport = page.getViewport({ scale: 1.4 });
      const canvas = document.createElement('canvas');
      canvas.width  = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;

      const task = page.render({ canvasContext: ctx as any, viewport, canvas });
      renderTaskRef.current = task;
      await task.promise;

      setPreviewDataUrl(canvas.toDataURL('image/jpeg', 0.85));
      await doc.cleanup();
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') console.error(err);
    } finally {
      setIsRendering(false);
    }
  }, []);

  const handleFiles = (files: FileList) => {
    if (files.length > 0 && files[0].type === 'application/pdf') {
      setFile(files[0]);
      setPreviewDataUrl(null);
      renderPreview(files[0]);
    }
  };

  // ── CSS rotation applied live whenever `rotation` changes ─────────
  // (no re-render of PDF needed — just CSS transform on the img)

  const rotatePdf = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const bytes = await file.arrayBuffer();
      const pdf = await PDFDocument.load(bytes);
      pdf.getPages().forEach(page => {
        const current = page.getRotation().angle;
        page.setRotation(degrees(current + rotation));
      });
      const rotatedBytes = await pdf.save();
      const blob = new Blob([rotatedBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `rotated_${file.name}`; a.click();
      URL.revokeObjectURL(url);

      // Re-render the preview with the rotated PDF
      const rotatedFile = new File([blob], file.name, { type: 'application/pdf' });
      renderPreview(rotatedFile);
    } catch (error) {
      console.error(error);
      alert('Failed to rotate PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const angles = [
    { deg: 90,  label: '90° CW' },
    { deg: 180, label: '180°'   },
    { deg: 270, label: '90° CCW'},
  ];

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
            role="button" tabIndex={0} aria-label="Upload PDF to rotate"
            onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            <RotateCw size={48} className="upload-icon" aria-hidden="true" />
            <div>
              <p><strong style={{ color: 'var(--text-main)' }}>Drag & Drop PDF</strong> or click to browse</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Live preview shows rotation before downloading
              </p>
            </div>
            <input
              type="file" ref={fileInputRef} style={{ display: 'none' }}
              onChange={e => e.target.files && handleFiles(e.target.files)}
              accept="application/pdf"
              aria-label="Select PDF to rotate"
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="file-item">
              <div className="file-info">
                <RotateCw size={18} color="var(--primary)" aria-hidden="true" />
                <div className="file-details">
                  <h4>{file.name}</h4>
                  <p>{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              </div>
              <button
                className="btn-icon"
                onClick={() => { setFile(null); setPreviewDataUrl(null); }}
                aria-label="Remove file"
              >
                <Trash2 size={15} />
              </button>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                Rotation Angle
              </label>
              <div role="group" aria-label="Select rotation angle" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.625rem' }}>
                {angles.map(({ deg, label }) => (
                  <button
                    key={deg}
                    onClick={() => setRotation(deg)}
                    aria-pressed={rotation === deg}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                      padding: '1rem 0.5rem',
                      background: rotation === deg ? 'rgba(59,130,246,0.12)' : 'var(--bg)',
                      border: `1px solid ${rotation === deg ? 'var(--primary)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      transition: 'all var(--transition)', fontFamily: 'inherit',
                    }}
                  >
                    <RotateCw
                      size={24}
                      color={rotation === deg ? 'var(--primary)' : 'var(--text-muted)'}
                      style={{ transform: `rotate(${deg - 90}deg)`, transition: 'transform 0.3s' }}
                      aria-hidden="true"
                    />
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: rotation === deg ? 'var(--primary)' : 'var(--text-muted)' }}>
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Preview on the right rotates live — click <strong style={{ color: 'var(--text-secondary)' }}>Rotate & Download</strong> to save.
            </div>

            <button
              className="download-btn"
              onClick={rotatePdf}
              disabled={isProcessing}
              aria-label={`Rotate PDF by ${rotation}° and download`}
            >
              {isProcessing ? <Loader2 className="spinner" size={20} /> : <RotateCw size={20} />}
              Rotate & Download
            </button>
          </div>
        )}
      </div>

      {/* ── Preview Panel ── */}
      <div className="tool-preview-panel">
        <div className="preview-panel-header">
          <h4>Live Preview — {rotation}° rotation</h4>
          {isRendering && <Loader2 className="spinner" size={14} color="var(--primary)" />}
        </div>
        <div
          className="preview-panel-body"
          style={{ height: 520, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {previewDataUrl ? (
            <img
              src={previewDataUrl}
              alt={`PDF page 1 preview — rotated ${rotation}°`}
              style={{
                maxWidth: rotation === 90 || rotation === 270 ? '70%' : '100%',
                maxHeight: rotation === 90 || rotation === 270 ? '100%' : '90%',
                objectFit: 'contain',
                transform: `rotate(${rotation}deg)`,
                transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)',
                borderRadius: 4,
                boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
              }}
            />
          ) : isRendering ? (
            <div className="preview-empty" role="status" aria-label="Rendering page">
              <Loader2 size={40} className="spinner" color="var(--primary)" />
              <p>Rendering preview…</p>
            </div>
          ) : (
            <div className="preview-empty" role="img" aria-label="No PDF loaded">
              <FileText size={48} aria-hidden="true" />
              <p>Upload a PDF to see a live preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
