import { useState, useRef } from 'react';
import { Copy, FileDown, ScanText, X, CheckCircle2, FileText, Search } from 'lucide-react';
import Tesseract from 'tesseract.js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

type Status = 'idle' | 'processing' | 'done' | 'error';

export default function OcrTool() {
  const [file, setFile]                   = useState<File | null>(null);
  const [previewUrl, setPreviewUrl]       = useState<string | null>(null);
  const [status, setStatus]               = useState<Status>('idle');
  const [progress, setProgress]           = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [ocrText, setOcrText]             = useState('');
  const [isDragging, setIsDragging]       = useState(false);
  const [copied, setCopied]               = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // words per page for searchable PDF
  const wordsDataRef = useRef<{ text: string; bbox: Tesseract.Bbox; pageW: number; pageH: number; pageIdx: number }[]>([]);

  const ACCEPTED_IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];

  const handleFiles = (files: FileList) => {
    const f = files[0];
    const accepted = [...ACCEPTED_IMAGES, 'application/pdf'];
    if (!f || !accepted.includes(f.type)) return;
    setFile(f);
    setOcrText('');
    setStatus('idle');
    setProgress(0);
    wordsDataRef.current = [];
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
  };

  // ── OCR a single canvas ──────────────────────────────────────────
  const ocrCanvas = async (
    canvas: HTMLCanvasElement,
    pageIdx: number,
    totalPages: number
  ): Promise<{ text: string; words: Tesseract.Word[] }> => {
    const { data } = await Tesseract.recognize(canvas, 'eng', {
      logger: (m: Tesseract.LoggerMessage) => {
        if (m.status === 'recognizing text') {
          const base = pageIdx / totalPages;
          const step = m.progress / totalPages;
          setProgress(Math.round((base + step) * 100));
          setProgressLabel(`Page ${pageIdx + 1} of ${totalPages} — Recognizing text…`);
        } else if (pageIdx === 0) {
          setProgressLabel(m.status);
        }
      },
    });
    return { text: data.text, words: (data as any).words ?? [] };
  };

  // ── Main OCR runner ──────────────────────────────────────────────
  const runOcr = async () => {
    if (!file) return;
    setStatus('processing');
    setProgress(0);
    setOcrText('');
    wordsDataRef.current = [];

    try {
      if (file.type === 'application/pdf') {
        // ── PDF: render each page to canvas then OCR ──────────────
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const doc = await loadingTask.promise;
        const numPages = doc.numPages;
        const allText: string[] = [];

        setProgressLabel(`Loading PDF (${numPages} pages)…`);

        for (let i = 0; i < numPages; i++) {
          setProgressLabel(`Rendering page ${i + 1} of ${numPages}…`);
          const page = await doc.getPage(i + 1);
          const scale = 2; // higher res = better OCR
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width  = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d')!;
          await page.render({ canvasContext: ctx as any, viewport, canvas }).promise;

          const { text, words } = await ocrCanvas(canvas, i, numPages);
          allText.push(`--- Page ${i + 1} ---\n${text.trim()}`);

          // Store word data for searchable PDF
          words.forEach(w => {
            if (w.text.trim()) {
              wordsDataRef.current.push({
                text: w.text,
                bbox: w.bbox,
                pageW: canvas.width,
                pageH: canvas.height,
                pageIdx: i,
              });
            }
          });
        }

        doc.cleanup();
        setOcrText(allText.join('\n\n').trim() || '(No text detected)');
        setStatus('done');
      } else {
        // ── Image: feed directly to Tesseract ─────────────────────
        const { data } = await Tesseract.recognize(file, 'eng', {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setProgress(Math.round(m.progress * 100));
              setProgressLabel(`Recognizing text… ${Math.round(m.progress * 100)}%`);
            } else {
              setProgressLabel(m.status);
            }
          },
        });

        // Store words for image → searchable PDF export
        const img = new Image();
        img.src = URL.createObjectURL(file);
        await new Promise(r => { img.onload = r; });
        ((data as any).words ?? []).forEach((w: any) => {
          if (w.text.trim()) {
            wordsDataRef.current.push({
              text: w.text,
              bbox: w.bbox,
              pageW: img.naturalWidth,
              pageH: img.naturalHeight,
              pageIdx: 0,
            });
          }
        });

        setOcrText(data.text.trim() || '(No text detected in this file)');
        setStatus('done');
      }
    } catch (err) {
      console.error('OCR failed:', err);
      setOcrText('OCR failed. Please try a clearer image or PDF.');
      setStatus('error');
    }
  };

  // ── Export searchable PDF ─────────────────────────────────────────
  const exportSearchablePdf = async () => {
    if (!file || !ocrText) return;
    setIsExportingPdf(true);
    try {
      let pdfDoc: PDFDocument;

      if (file.type === 'application/pdf') {
        // Use the original PDF as background
        const bytes = await file.arrayBuffer();
        pdfDoc = await PDFDocument.load(bytes);
      } else {
        // Create new PDF from image
        pdfDoc = await PDFDocument.create();
        const imgBytes = await file.arrayBuffer();
        const isJpeg = file.type === 'image/jpeg' || file.type === 'image/jpg';
        const pdfImg = isJpeg
          ? await pdfDoc.embedJpg(imgBytes)
          : await (() => {
              // Convert to PNG via canvas for non-JPEG
              return pdfDoc.embedPng(imgBytes).catch(async () => {
                const bmp = await createImageBitmap(file);
                const c = document.createElement('canvas');
                c.width = bmp.width; c.height = bmp.height;
                c.getContext('2d')!.drawImage(bmp, 0, 0);
                const blob = await new Promise<Blob>(r => c.toBlob(b => r(b!), 'image/png'));
                return pdfDoc.embedPng(await blob.arrayBuffer());
              });
            })();
        const page = pdfDoc.addPage([pdfImg.width, pdfImg.height]);
        page.drawImage(pdfImg, { x: 0, y: 0, width: pdfImg.width, height: pdfImg.height });
      }

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();

      // Overlay invisible text words at their bounding-box positions
      for (const w of wordsDataRef.current) {
        const page = pages[w.pageIdx];
        if (!page) continue;
        const { width: pW, height: pH } = page.getSize();

        const scaleX = pW  / w.pageW;
        const scaleY = pH  / w.pageH;

        const wordW = (w.bbox.x1 - w.bbox.x0) * scaleX;
        const wordH = (w.bbox.y1 - w.bbox.y0) * scaleY;
        const fontSize = Math.max(wordH * 0.9, 4);

        // PDF Y axis is from the bottom; canvas Y is from the top
        const pdfX = w.bbox.x0 * scaleX;
        const pdfY = pH - w.bbox.y1 * scaleY;

        try {
          page.drawText(w.text, {
            x: pdfX,
            y: pdfY,
            size: fontSize,
            font,
            color: rgb(1, 1, 1),  // white → invisible on white background
            opacity: 0.005,        // essentially transparent — only Ctrl+F can find it
            maxWidth: wordW * 1.1,
          });
        } catch (_) { /* skip words that cause layout errors */ }
      }

      const savedBytes = await pdfDoc.save();
      const blob = new Blob([savedBytes as any], { type: 'application/pdf' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `searchable_${file.name.replace(/\.[^.]+$/, '')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Searchable PDF export error:', err);
      alert('Failed to create searchable PDF. Please try again.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleCopy = async () => {
    if (!ocrText) return;
    await navigator.clipboard.writeText(ocrText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportTxt = () => {
    const blob = new Blob([ocrText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ocr_${file?.name ?? 'output'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null); setPreviewUrl(null);
    setStatus('idle'); setProgress(0); setOcrText('');
    wordsDataRef.current = [];
  };

  const isPdf = file?.type === 'application/pdf';

  return (
    <div className="tool-split-layout">
      {/* ── Left: Controls ── */}
      <div className="tool-controls-panel">
        {!file ? (
          <div
            className={`upload-area ${isDragging ? 'dragging' : ''}`}
            style={{ minHeight: 260 }}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
            role="button" tabIndex={0} aria-label="Upload image or PDF for OCR"
            onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            <ScanText size={52} className="upload-icon" aria-hidden="true" />
            <div>
              <p><strong style={{ color: 'var(--text-main)' }}>Drag & Drop</strong> or click to browse</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                Images (JPG, PNG, WebP) · PDF files (all pages)
              </p>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/*,application/pdf"
              onChange={e => e.target.files && handleFiles(e.target.files)}
              aria-label="Select image or PDF for OCR"
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* File info */}
            <div className="file-item">
              <div className="file-info">
                {isPdf
                  ? <FileText size={20} color="var(--primary)" aria-hidden="true" />
                  : <ScanText size={20} color="var(--accent)" aria-hidden="true" />
                }
                <div className="file-details">
                  <h4>{file.name}</h4>
                  <p>{(file.size / 1024).toFixed(1)} KB · {isPdf ? 'PDF Document' : 'Image'}</p>
                </div>
              </div>
              <button className="btn-icon" onClick={handleReset} aria-label="Remove file and start over">
                <X size={16} />
              </button>
            </div>

            {/* Run OCR */}
            {status === 'idle' && (
              <button className="btn-primary" onClick={runOcr} style={{ width: '100%', padding: '0.9375rem' }}>
                <ScanText size={18} aria-hidden="true" />
                {isPdf ? 'OCR All Pages' : 'Extract Text with OCR'}
              </button>
            )}

            {/* Progress */}
            {status === 'processing' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {progressLabel || 'Starting OCR…'}
                  </span>
                  <span style={{ fontSize: '0.875rem', color: 'var(--primary)', fontWeight: 700 }}>{progress}%</span>
                </div>
                <div className="progress-bar-wrapper" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                  <div className="progress-bar" style={{ width: `${progress}%` }} />
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  {isPdf ? 'Processing each page — this may take a few minutes…' : 'This may take a moment…'}
                </p>
              </div>
            )}

            {/* Done */}
            {(status === 'done' || status === 'error') && ocrText && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {status === 'done'
                    ? <CheckCircle2 size={18} color="var(--success)" aria-hidden="true" />
                    : <X size={18} color="var(--error)" aria-hidden="true" />
                  }
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: status === 'done' ? 'var(--success)' : 'var(--error)' }}>
                    {status === 'done' ? `Text extracted successfully` : 'Partial extraction'}
                  </span>
                </div>

                <label htmlFor="ocr-output" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Extracted Text
                </label>
                <textarea
                  id="ocr-output"
                  className="ocr-output"
                  value={ocrText}
                  onChange={e => setOcrText(e.target.value)}
                  aria-label="Extracted text from OCR — editable"
                  rows={10}
                />

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '0.625rem' }}>
                  <button
                    className="btn-ghost"
                    onClick={handleCopy}
                    style={{ flex: 1 }}
                    aria-label={copied ? 'Copied!' : 'Copy text to clipboard'}
                  >
                    {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={handleExportTxt}
                    style={{ flex: 1 }}
                    aria-label="Export extracted text as .txt file"
                  >
                    <FileDown size={16} />
                    .txt
                  </button>
                </div>

                {/* Searchable PDF button */}
                <button
                  className="btn-primary"
                  onClick={exportSearchablePdf}
                  disabled={isExportingPdf}
                  aria-label="Export as searchable PDF — text is embedded for Ctrl+F search"
                  style={{ width: '100%', padding: '0.9375rem' }}
                >
                  {isExportingPdf
                    ? <><ScanText size={18} className="spinner" /> Creating Searchable PDF…</>
                    : <><Search size={18} /> Export Searchable PDF</>
                  }
                </button>

                <button className="btn-ghost" onClick={runOcr} aria-label="Run OCR again">
                  <ScanText size={14} /> Re-run OCR
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right: Preview ── */}
      <div className="tool-preview-panel">
        <div className="preview-panel-header">
          <h4>{isPdf ? 'PDF Preview' : 'Image Preview'}</h4>
          {file && (
            <button className="btn-icon" onClick={handleReset} aria-label="Clear preview">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="preview-panel-body" style={{ height: 520 }}>
          {previewUrl && !isPdf ? (
            <img
              src={previewUrl}
              alt={`Preview of ${file?.name}`}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', padding: '1rem' }}
            />
          ) : previewUrl && isPdf ? (
            <iframe
              src={previewUrl}
              title={`PDF preview: ${file?.name}`}
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          ) : (
            <div className="preview-empty" role="img" aria-label="No file selected">
              <ScanText size={48} aria-hidden="true" />
              <p>Upload an image or PDF to see a preview</p>
              <p style={{ fontSize: '0.8125rem' }}>PDF files will be OCR'd page by page</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
