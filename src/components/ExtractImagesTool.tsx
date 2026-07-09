import { useState, useRef } from 'react';
import { Loader2, Trash2, CheckCircle2, Images, Download, FileText } from 'lucide-react';
import { PDFDocument, PDFRawStream, PDFName } from 'pdf-lib';
import JSZip from 'jszip';

export default function ExtractImagesTool() {
  const [file, setFile]               = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging]     = useState(false);
  const [imageCount, setImageCount]     = useState<number | null>(null);
  const [previewUrl, setPreviewUrl]     = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList) => {
    if (files.length > 0 && files[0].type === 'application/pdf') {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const f = files[0];
      const url = URL.createObjectURL(f);
      setFile(f);
      setPreviewUrl(url);
      setImageCount(null);

      // Count images
      try {
        const bytes = await f.arrayBuffer();
        const pdf = await PDFDocument.load(bytes);
        let count = 0;
        for (const [, obj] of pdf.context.enumerateIndirectObjects()) {
          if (!(obj instanceof PDFRawStream)) continue;
          if (obj.dict.get(PDFName.of('Subtype')) === PDFName.of('Image')) count++;
        }
        setImageCount(count);
      } catch (e) { console.warn('Count error', e); }
    }
  };

  const extractImages = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const bytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes);
      const zip = new JSZip();
      let count = 0;

      for (const [, pdfObject] of pdfDoc.context.enumerateIndirectObjects()) {
        if (!(pdfObject instanceof PDFRawStream)) continue;
        const dict = pdfObject.dict;
        if (dict.get(PDFName.of('Subtype')) !== PDFName.of('Image')) continue;
        const filter = dict.get(PDFName.of('Filter'));
        const isJpeg = filter === PDFName.of('DCTDecode');
        const ext = isJpeg ? 'jpg' : 'png';
        zip.file(`image_${++count}.${ext}`, pdfObject.contents);
      }

      if (count === 0) {
        alert('No embedded images found in this PDF.');
        return;
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url; a.download = `extracted_images_${file.name}.zip`; a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert('Failed to extract images.');
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
            role="button" tabIndex={0} aria-label="Upload PDF to extract images from"
            onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            <Images size={48} className="upload-icon" aria-hidden="true" />
            <div>
              <p><strong style={{ color: 'var(--text-main)' }}>Drag & Drop PDF</strong> or click to browse</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Extracts all embedded images into a ZIP</p>
            </div>
            <input
              type="file" ref={fileInputRef} style={{ display: 'none' }}
              onChange={e => e.target.files && handleFiles(e.target.files)}
              accept="application/pdf"
              aria-label="Select PDF to extract images from"
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="file-item">
              <div className="file-info">
                <CheckCircle2 size={18} color="var(--success)" aria-hidden="true" />
                <div className="file-details">
                  <h4>{file.name}</h4>
                  <p>
                    {(file.size / 1024).toFixed(0)} KB
                    {imageCount !== null && (
                      <> · <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{imageCount} image{imageCount !== 1 ? 's' : ''} found</span></>
                    )}
                  </p>
                </div>
              </div>
              <button
                className="btn-icon"
                onClick={() => { setFile(null); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); setImageCount(null); }}
                aria-label="Remove file"
              >
                <Trash2 size={15} />
              </button>
            </div>

            {imageCount === 0 && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                No embedded images detected in this PDF.
              </div>
            )}

            {imageCount !== 0 && (
              <>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  All embedded images will be extracted and bundled into a ZIP archive for download.
                  Images are saved in their original format (JPG or PNG).
                </p>
                <button
                  className="download-btn"
                  onClick={extractImages}
                  disabled={isProcessing}
                  aria-label="Extract images and download as ZIP"
                >
                  {isProcessing ? <Loader2 className="spinner" size={20} /> : <Download size={20} />}
                  Extract & Download ZIP
                </button>
              </>
            )}
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
