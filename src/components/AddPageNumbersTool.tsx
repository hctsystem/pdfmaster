import { useState, useRef } from 'react';
import { FileText, Hash, Loader2, Download, Trash2 } from 'lucide-react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

type Position =
  | 'Bottom Center'
  | 'Bottom Left'
  | 'Bottom Right'
  | 'Top Center'
  | 'Top Left'
  | 'Top Right';

type Format =
  | 'Page {n}'
  | '{n}'
  | 'Page {n} of {total}'
  | '{n} / {total}';

const POSITIONS: Position[] = [
  'Bottom Center',
  'Bottom Left',
  'Bottom Right',
  'Top Center',
  'Top Left',
  'Top Right',
];

const FORMATS: Format[] = [
  'Page {n}',
  '{n}',
  'Page {n} of {total}',
  '{n} / {total}',
];

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? rgb(
        parseInt(result[1], 16) / 255,
        parseInt(result[2], 16) / 255,
        parseInt(result[3], 16) / 255
      )
    : rgb(0, 0, 0);
}

function formatLabel(format: Format, n: number, total: number): string {
  return format
    .replace('{n}', String(n))
    .replace('{total}', String(total));
}

export default function AddPageNumbersTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Config
  const [position, setPosition] = useState<Position>('Bottom Center');
  const [startNumber, setStartNumber] = useState(1);
  const [fontSize, setFontSize] = useState(12);
  const [format, setFormat] = useState<Format>('Page {n}');
  const [color, setColor] = useState('#000000');

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (f.type !== 'application/pdf') {
      setError('Please upload a valid PDF file.');
      return;
    }
    setError(null);
    setFile(f);

    try {
      const bytes = await f.arrayBuffer();
      const pdf = await PDFDocument.load(bytes);
      setPageCount(pdf.getPageCount());
    } catch {
      setError('Could not read the PDF file.');
      setFile(null);
    }
  };

  const reset = () => {
    setFile(null);
    setPageCount(0);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddPageNumbers = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);

    try {
      const bytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();
      const total = pages.length;
      const fillColor = hexToRgb(color);

      pages.forEach((page, idx) => {
        const { width, height } = page.getSize();
        const n = startNumber + idx;
        const label = formatLabel(format, n, total + startNumber - 1);
        const textWidth = font.widthOfTextAtSize(label, fontSize);

        let x: number;
        let y: number;

        // Y position
        if (position.startsWith('Bottom')) {
          y = 20;
        } else {
          y = height - 30;
        }

        // X position
        if (position.endsWith('Center')) {
          x = (width - textWidth) / 2;
        } else if (position.endsWith('Left')) {
          x = 20;
        } else {
          // Right
          x = width - textWidth - 20;
        }

        page.drawText(label, {
          x,
          y,
          size: fontSize,
          font,
          color: fillColor,
        });
      });

      const savedBytes = await pdfDoc.save();
      const blob = new Blob([savedBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `numbered_${file.name}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError('Failed to add page numbers. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1rem' }}>
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
          <Hash size={22} color="#fff" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Add Page Numbers
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Stamp page numbers on every page of your PDF
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
          }}
        >
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
          <FileText size={48} className="upload-icon" />
          <div>
            <p>
              <strong style={{ color: 'var(--text-main)' }}>Drag & Drop PDF</strong> or click to browse
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Supports any PDF file
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
                <p>{(file.size / 1024).toFixed(0)} KB · {pageCount} page{pageCount !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <button className="btn-icon" onClick={reset} title="Remove file">
              <Trash2 size={15} />
            </button>
          </div>

          {/* Config Panel */}
          <div
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '1.25rem',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
            }}
          >
            {/* Position */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Position
              </label>
              <select
                value={position}
                onChange={e => setPosition(e.target.value as Position)}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface-2)',
                  color: 'var(--text-main)',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                {POSITIONS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Format */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Format
              </label>
              <select
                value={format}
                onChange={e => setFormat(e.target.value as Format)}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface-2)',
                  color: 'var(--text-main)',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                {FORMATS.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Start Number */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Start Number
              </label>
              <input
                type="number"
                min={0}
                value={startNumber}
                onChange={e => setStartNumber(Math.max(0, parseInt(e.target.value) || 1))}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface-2)',
                  color: 'var(--text-main)',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            {/* Font Size */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Font Size
              </label>
              <input
                type="number"
                min={6}
                max={72}
                value={fontSize}
                onChange={e => setFontSize(Math.max(6, Math.min(72, parseInt(e.target.value) || 12)))}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface-2)',
                  color: 'var(--text-main)',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            {/* Color */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Text Color
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="color"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  style={{
                    width: 40,
                    height: 36,
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    padding: '2px',
                    background: 'none',
                  }}
                />
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  {color.toUpperCase()}
                </span>
                {/* Live Preview */}
                <div
                  style={{
                    marginLeft: 'auto',
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: '#fff',
                    fontSize: `${Math.max(10, Math.min(fontSize, 18))}px`,
                    color: color,
                    fontFamily: 'Helvetica, Arial, sans-serif',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatLabel(format, startNumber, pageCount + startNumber - 1)}
                </div>
              </div>
            </div>
          </div>

          {/* Download Button */}
          <button
            className="download-btn"
            onClick={handleAddPageNumbers}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 className="spinner" size={20} /> : <Download size={20} />}
            {isProcessing ? 'Processing…' : 'Add Page Numbers & Download'}
          </button>
        </div>
      )}
    </div>
  );
}
