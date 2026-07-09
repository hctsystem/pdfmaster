import { useState, useRef } from 'react';
import { Loader2, Trash2, Image as ImageIcon, Download } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

interface ImageItem {
  id: string;
  file: File;
  preview: string;
}

export default function ImageToPdfTool() {
  const [images, setImages]         = useState<ImageItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging]     = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<ImageItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList) => {
    const newItems = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview: URL.createObjectURL(file)
      }));
    setImages(prev => {
      const updated = [...prev, ...newItems];
      if (!selectedPreview && updated.length) setSelectedPreview(updated[0]);
      return updated;
    });
  };

  const convertToPdf = async () => {
    if (images.length === 0) return;
    setIsProcessing(true);
    try {
      const pdfDoc = await PDFDocument.create();
      for (const item of images) {
        const imageBytes = await item.file.arrayBuffer();
        let image;
        if (item.file.type === 'image/jpeg' || item.file.type === 'image/jpg') {
          image = await pdfDoc.embedJpg(imageBytes);
        } else if (item.file.type === 'image/png') {
          image = await pdfDoc.embedPng(imageBytes);
        } else {
          // Convert WebP etc. to PNG via canvas
          const bitmap = await createImageBitmap(item.file);
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width; canvas.height = bitmap.height;
          canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
          const blob = await new Promise<Blob>(r => canvas.toBlob(b => r(b!), 'image/png'));
          const bytes = await blob.arrayBuffer();
          image = await pdfDoc.embedPng(bytes);
        }
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
      }
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'images_to_pdf.pdf'; a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert('Failed to convert images to PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="tool-split-layout">
      {/* ── Controls ── */}
      <div className="tool-controls-panel">
        <div
          className={`upload-area ${isDragging ? 'dragging' : ''}`}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
          role="button" tabIndex={0} aria-label="Upload images to convert to PDF"
          onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
        >
          <ImageIcon size={44} className="upload-icon" aria-hidden="true" />
          <div>
            <p><strong style={{ color: 'var(--text-main)' }}>Drag & Drop Images</strong> or click to browse</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>JPG, PNG, WebP — each image becomes a PDF page</p>
          </div>
          <input
            type="file" multiple ref={fileInputRef} style={{ display: 'none' }}
            onChange={e => e.target.files && handleFiles(e.target.files)}
            accept="image/*"
            aria-label="Select image files"
          />
        </div>

        {images.length > 0 && (
          <div className="file-list">
            <div className="file-list-header">
              <h3>Images ({images.length})</h3>
              <button
                className="btn-primary"
                onClick={convertToPdf}
                disabled={isProcessing}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                aria-label="Convert images to PDF and download"
              >
                {isProcessing ? <Loader2 className="spinner" size={15} /> : <Download size={15} />}
                Convert to PDF
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.75rem' }}>
              {images.map((item, index) => (
                <div
                  key={item.id}
                  style={{
                    position: 'relative',
                    aspectRatio: '1',
                    border: `2px solid ${selectedPreview?.id === item.id ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'border-color var(--transition)',
                  }}
                  onClick={() => setSelectedPreview(item)}
                  role="button"
                  aria-label={`Image ${index + 1}: ${item.file.name}. Click to preview.`}
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && setSelectedPreview(item)}
                >
                  <img
                    src={item.preview}
                    alt={item.file.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: 'rgba(0,0,0,0.6)', fontSize: '0.625rem',
                    color: 'white', padding: '2px 4px', textAlign: 'center', fontWeight: 700
                  }}>
                    {index + 1}
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      URL.revokeObjectURL(item.preview);
                      setImages(prev => prev.filter(i => i.id !== item.id));
                      if (selectedPreview?.id === item.id) setSelectedPreview(null);
                    }}
                    style={{
                      position: 'absolute', top: 4, right: 4,
                      background: 'rgba(0,0,0,0.6)', border: 'none',
                      borderRadius: '50%', padding: 4, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    aria-label={`Remove ${item.file.name}`}
                    title="Remove"
                  >
                    <Trash2 size={12} color="white" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Preview Panel ── */}
      <div className="tool-preview-panel">
        <div className="preview-panel-header">
          <h4>{selectedPreview ? selectedPreview.file.name : 'Image Preview'}</h4>
          {images.length > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click image to preview</span>}
        </div>
        <div className="preview-panel-body" style={{ height: 480 }}>
          {selectedPreview ? (
            <img
              src={selectedPreview.preview}
              alt={`Preview of ${selectedPreview.file.name}`}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', padding: '1rem' }}
            />
          ) : (
            <div className="preview-empty" role="img" aria-label="No image selected">
              <ImageIcon size={48} aria-hidden="true" />
              <p>Upload images to preview them here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
