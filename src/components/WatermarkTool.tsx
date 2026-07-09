import { useState, useRef, useEffect } from 'react';
import { FileText, Droplets, Loader2, Download, Trash2, Upload, Type, Image as ImageIcon } from 'lucide-react';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';

type WatermarkPosition = 'Diagonal (center)' | 'Tiled (3x3 grid)';
const POSITIONS: WatermarkPosition[] = ['Diagonal (center)', 'Tiled (3x3 grid)'];

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? rgb(
        parseInt(result[1], 16) / 255,
        parseInt(result[2], 16) / 255,
        parseInt(result[3], 16) / 255
      )
    : rgb(1, 0, 0);
}

export default function WatermarkTool() {
  const [file, setFile]                 = useState<File | null>(null);
  const [pageCount, setPageCount]       = useState<number>(0);
  const [isDragging, setIsDragging]     = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Watermark Settings
  const [watermarkType, setWatermarkType] = useState<'text' | 'image'>('text');
  
  // Text Watermark Config
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [fontSize, setFontSize]           = useState(60);
  const [color, setColor]                 = useState('#FF0000');
  
  // Image Watermark Config
  const [imageFile, setImageFile]         = useState<File | null>(null);
  const [imageScale, setImageScale]       = useState(0.5); // 0.1 to 1.5
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const imageInputRefRef = useRef<HTMLInputElement>(null);
  const [imgNaturalSize, setImgNaturalSize] = useState({ w: 100, h: 100 });

  // Shared Config
  const [opacity, setOpacity]             = useState(0.2); // 0.05 to 0.8
  const [position, setPosition]           = useState<WatermarkPosition>('Diagonal (center)');

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

  const handleImageUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!f.type.startsWith('image/')) {
      alert('Please upload an image file (PNG or JPG).');
      return;
    }
    
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    const url = URL.createObjectURL(f);
    setImageFile(f);
    setImagePreviewUrl(url);

    // Get natural dimensions
    const img = new Image();
    img.src = url;
    img.onload = () => {
      setImgNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
  };

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const reset = () => {
    setFile(null);
    setPageCount(0);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddWatermark = async () => {
    if (!file) return;
    if (watermarkType === 'text' && !watermarkText.trim()) return;
    if (watermarkType === 'image' && !imageFile) {
      setError('Please upload a watermark image.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const bytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes);
      const pages = pdfDoc.getPages();
      
      if (watermarkType === 'text') {
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const fillColor = hexToRgb(color);
        const text = watermarkText.trim();

        pages.forEach(page => {
          const { width, height } = page.getSize();
          const rotation = page.getRotation().angle;

          if (position === 'Diagonal (center)') {
            const textWidth = font.widthOfTextAtSize(text, fontSize);
            const angle = 45 - rotation;
            const rad = (angle * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const dx = (textWidth / 2) * cos - (fontSize / 2) * sin;
            const dy = (textWidth / 2) * sin + (fontSize / 2) * cos;

            page.drawText(text, {
              x: (width / 2) - dx,
              y: (height / 2) - dy,
              size: fontSize,
              font,
              color: fillColor,
              opacity,
              rotate: degrees(angle),
            });
          } else {
            // Tiled grid
            const cols = 3;
            const rows = 3;
            const cellW = width / cols;
            const cellH = height / rows;
            const tileFontSize = Math.round(fontSize * 0.45);
            const tileTextWidth = font.widthOfTextAtSize(text, tileFontSize);
            const angle = 30 - rotation;

            for (let row = 0; row < rows; row++) {
              for (let col = 0; col < cols; col++) {
                const cx = cellW * col + cellW / 2;
                const cy = cellH * row + cellH / 2;
                const rad = (angle * Math.PI) / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);
                const dx = (tileTextWidth / 2) * cos - (tileFontSize / 2) * sin;
                const dy = (tileTextWidth / 2) * sin + (tileFontSize / 2) * cos;

                page.drawText(text, {
                  x: cx - dx,
                  y: cy - dy,
                  size: tileFontSize,
                  font,
                  color: fillColor,
                  opacity,
                  rotate: degrees(angle),
                });
              }
            }
          }
        });
      } else if (watermarkType === 'image' && imageFile) {
        // Image Watermark Logic
        const imgBytes = await imageFile.arrayBuffer();
        const embeddedImg = imageFile.type === 'image/png' 
          ? await pdfDoc.embedPng(imgBytes)
          : await pdfDoc.embedJpg(imgBytes);
        
        pages.forEach(page => {
          const { width: pageW, height: pageH } = page.getSize();
          const rotation = page.getRotation().angle;

          // Scale dimensions based on uploader scale setting
          const imgW = imgNaturalSize.w * imageScale;
          const imgH = imgNaturalSize.h * imageScale;

          if (position === 'Diagonal (center)') {
            const angle = 45 - rotation;
            const rad = (angle * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            // dx/dy offsets from bottom-left corner of the rotated image
            const dx = (imgW / 2) * cos - (imgH / 2) * sin;
            const dy = (imgW / 2) * sin + (imgH / 2) * cos;

            page.drawImage(embeddedImg, {
              x: (pageW / 2) - dx,
              y: (pageH / 2) - dy,
              width: imgW,
              height: imgH,
              opacity,
              rotate: degrees(angle),
            });
          } else {
            // Tiled grid
            const cols = 3;
            const rows = 3;
            const cellW = pageW / cols;
            const cellH = pageH / rows;
            const tileScale = imageScale * 0.45;
            const tileW = imgNaturalSize.w * tileScale;
            const tileH = imgNaturalSize.h * tileScale;
            const angle = 30 - rotation;

            for (let row = 0; row < rows; row++) {
              for (let col = 0; col < cols; col++) {
                const cx = cellW * col + cellW / 2;
                const cy = cellH * row + cellH / 2;
                const rad = (angle * Math.PI) / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);
                const dx = (tileW / 2) * cos - (tileH / 2) * sin;
                const dy = (tileW / 2) * sin + (tileH / 2) * cos;

                page.drawImage(embeddedImg, {
                  x: cx - dx,
                  y: cy - dy,
                  width: tileW,
                  height: tileH,
                  opacity,
                  rotate: degrees(angle),
                });
              }
            }
          }
        });
      }

      const savedBytes = await pdfDoc.save();
      const blob = new Blob([savedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `watermarked_${file.name}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError('Failed to add watermark. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const previewFontSize = Math.max(14, Math.min(fontSize * 0.35, 40));

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
          <Droplets size={22} color="#fff" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Watermark PDF
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Stamp a custom text or image watermark on every page
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
          <Droplets size={48} className="upload-icon" />
          <div>
            <p>
              <strong style={{ color: 'var(--text-main)' }}>Drag & Drop PDF</strong> or click to browse
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Watermark will be applied to every page
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

          {/* Watermark Type Selector Tabs */}
          <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '0.25rem', borderRadius: 'var(--radius-sm)' }}>
            <button
              onClick={() => setWatermarkType('text')}
              style={{
                flex: 1, padding: '0.5rem', border: 'none', background: watermarkType === 'text' ? 'var(--primary)' : 'transparent',
                color: watermarkType === 'text' ? 'white' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600,
                borderRadius: 'calc(var(--radius-sm) - 3px)', transition: 'all 150ms', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem'
              }}
              aria-pressed={watermarkType === 'text'}
            >
              <Type size={14} /> Text Watermark
            </button>
            <button
              onClick={() => setWatermarkType('image')}
              style={{
                flex: 1, padding: '0.5rem', border: 'none', background: watermarkType === 'image' ? 'var(--primary)' : 'transparent',
                color: watermarkType === 'image' ? 'white' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600,
                borderRadius: 'calc(var(--radius-sm) - 3px)', transition: 'all 150ms', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem'
              }}
              aria-pressed={watermarkType === 'image'}
            >
              <ImageIcon size={14} /> Image Watermark
            </button>
          </div>

          {/* Live Preview */}
          <div
            style={{
              background: '#fff',
              border: '2px dashed var(--border)',
              borderRadius: 'var(--radius)',
              height: 140,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {watermarkType === 'text' ? (
              <span
                style={{
                  fontSize: `${previewFontSize}px`,
                  color: color,
                  opacity: Math.max(opacity * 3, 0.3),
                  fontFamily: 'Helvetica, Arial, sans-serif',
                  fontWeight: 700,
                  transform: position === 'Diagonal (center)' ? 'rotate(45deg)' : 'rotate(30deg)',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                  letterSpacing: '0.04em',
                  pointerEvents: 'none',
                }}
              >
                {watermarkText || 'WATERMARK'}
              </span>
            ) : imagePreviewUrl ? (
              <img
                src={imagePreviewUrl}
                alt="Watermark image preview"
                style={{
                  maxHeight: 100,
                  maxWidth: '80%',
                  opacity: opacity,
                  transform: position === 'Diagonal (center)' ? 'rotate(45deg)' : 'rotate(30deg)',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  objectFit: 'contain'
                }}
              />
            ) : (
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Upload a logo to see live image watermark preview
              </span>
            )}
            <span
              style={{
                position: 'absolute',
                bottom: 6,
                right: 10,
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
              }}
            >
              Live preview
            </span>
          </div>

          {/* Config Panel */}
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
            {watermarkType === 'text' ? (
              <>
                {/* Watermark Text */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label htmlFor="text-wm-val" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Watermark Text
                  </label>
                  <input
                    id="text-wm-val"
                    type="text"
                    value={watermarkText}
                    onChange={e => setWatermarkText(e.target.value)}
                    placeholder="e.g. CONFIDENTIAL"
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      background: 'var(--surface-2)',
                      color: 'var(--text-main)',
                      fontSize: '0.875rem',
                    }}
                    aria-label="Text to display as watermark"
                  />
                </div>

                {/* Font Size */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label htmlFor="font-size-slider" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Font Size
                    </label>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{fontSize}pt</span>
                  </div>
                  <input
                    id="font-size-slider"
                    type="range"
                    min={24}
                    max={120}
                    value={fontSize}
                    onChange={e => setFontSize(Number(e.target.value))}
                    style={{ width: '100%', cursor: 'pointer' }}
                    aria-label="Adjust watermark font size"
                  />
                </div>

                {/* Color */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label htmlFor="text-wm-color" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Watermark Color
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <input
                      id="text-wm-color"
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
                      aria-label="Choose watermark text color"
                    />
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {color.toUpperCase()}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Image Watermark File Uploader */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Upload Watermark Logo/Image
                  </label>
                  
                  {!imageFile ? (
                    <div
                      onClick={() => imageInputRefRef.current?.click()}
                      style={{
                        border: '2px dashed var(--border)', borderRadius: 'var(--radius-sm)',
                        padding: '1.5rem', textAlign: 'center', cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                        background: 'var(--surface-2)'
                      }}
                      role="button" tabIndex={0} aria-label="Upload logo image"
                      onKeyDown={e => e.key === 'Enter' && imageInputRefRef.current?.click()}
                    >
                      <Upload size={24} color="var(--primary)" aria-hidden="true" />
                      <div>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-main)', display: 'block' }}>Select logo file</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Supports PNG (transparent background recommended) or JPG</span>
                      </div>
                    </div>
                  ) : (
                    <div className="file-item">
                      <div className="file-info">
                        <ImageIcon size={18} color="var(--primary)" aria-hidden="true" />
                        <div className="file-details">
                          <h4>{imageFile.name}</h4>
                          <p>{imgNaturalSize.w} x {imgNaturalSize.h} px</p>
                        </div>
                      </div>
                      <button className="btn-icon" onClick={() => { setImageFile(null); setImagePreviewUrl(null); }} aria-label="Remove logo">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                  
                  <input
                    ref={imageInputRefRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => handleImageUpload(e.target.files)}
                    aria-label="Upload watermark image file"
                  />
                </div>

                {/* Scale Slider */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label htmlFor="image-scale-slider" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Image Scale
                    </label>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{Math.round(imageScale * 100)}%</span>
                  </div>
                  <input
                    id="image-scale-slider"
                    type="range"
                    min={10}
                    max={150}
                    step={5}
                    value={Math.round(imageScale * 100)}
                    onChange={e => setImageScale(Number(e.target.value) / 100)}
                    style={{ width: '100%', cursor: 'pointer' }}
                    aria-label="Scale watermark image size"
                  />
                </div>
              </>
            )}

            {/* Position */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="wm-pos-select" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Position
              </label>
              <select
                id="wm-pos-select"
                value={position}
                onChange={e => setPosition(e.target.value as WatermarkPosition)}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface-2)',
                  color: 'var(--text-main)',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
                aria-label="Select watermark positioning grid layout"
              >
                {POSITIONS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Opacity */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label htmlFor="opacity-slider" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Opacity
                </label>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{Math.round(opacity * 100)}%</span>
              </div>
              <input
                id="opacity-slider"
                type="range"
                min={5}
                max={80}
                value={Math.round(opacity * 100)}
                onChange={e => setOpacity(Number(e.target.value) / 100)}
                style={{ width: '100%', cursor: 'pointer' }}
                aria-label="Adjust watermark opacity transparency"
              />
            </div>
          </div>

          {/* Download Button */}
          <button
            className="download-btn"
            onClick={handleAddWatermark}
            disabled={isProcessing || (watermarkType === 'text' ? !watermarkText.trim() : !imageFile)}
            aria-label="Add watermark and download PDF"
          >
            {isProcessing ? <Loader2 className="spinner" size={20} /> : <Download size={20} />}
            {isProcessing ? 'Processing…' : 'Add Watermark & Download'}
          </button>
        </div>
      )}
    </div>
  );
}
