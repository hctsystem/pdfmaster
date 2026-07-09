import { useState, useRef, useEffect } from 'react';
import {
  Upload, Download, Loader2, CheckCircle2,
  Trash2, Eye, X, FileImage
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { PDFDocument, PDFRawStream, PDFName, PDFNumber } from 'pdf-lib';
import JSZip from 'jszip';
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';

type Mode = 'image' | 'pdf';
type Status = 'pending' | 'processing' | 'done' | 'error';

interface QueueItem {
  id: string;
  file: File;
  compressedBlob?: Blob;
  status: Status;
  originalSize: number;
  compressedSize?: number;
  previewUrl?: string;
  originalUrl?: string;
}

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function CompressorTool() {
  const [mode, setMode]           = useState<Mode>('image');
  const [queue, setQueue]         = useState<QueueItem[]>([]);
  const [quality, setQuality]     = useState(0.8);
  const [pdfQuality, setPdfQuality] = useState(0.6);
  const [isDragging, setIsDragging] = useState(false);
  const [previewItem, setPreviewItem] = useState<QueueItem | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<QueueItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downsampleImage = async (bytes: Uint8Array, width: number, height: number, scale: number, quality: number): Promise<Uint8Array> => {
    return new Promise((resolve, reject) => {
      const blob = new Blob([bytes as any]);
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(width * scale);
        canvas.height = Math.floor(height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas error')); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => {
          if (!b) { reject(new Error('Blob error')); return; }
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(new Uint8Array(reader.result as ArrayBuffer));
            URL.revokeObjectURL(url);
          };
          reader.readAsArrayBuffer(b);
        }, 'image/jpeg', quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Load error')); };
      img.src = url;
    });
  };

  const processImage = async (file: File) => {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      initialQuality: quality,
    };
    return await imageCompression(file, options);
  };

  const processPdf = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const enumerateIndirectObjects = pdfDoc.context.enumerateIndirectObjects();
    const scale = pdfQuality > 0.7 ? 1 : 0.7;

    for (const [ref, pdfObject] of enumerateIndirectObjects) {
      if (!(pdfObject instanceof PDFRawStream)) continue;
      const dict = pdfObject.dict;
      if (dict.get(PDFName.of('Subtype')) !== PDFName.of('Image')) continue;
      try {
        const width = (dict.get(PDFName.of('Width')) as PDFNumber).asNumber();
        const height = (dict.get(PDFName.of('Height')) as PDFNumber).asNumber();
        if (width > 100 && height > 100) {
          const compressedBytes = await downsampleImage(pdfObject.contents, width, height, scale, pdfQuality);
          const newDict = dict.clone();
          newDict.set(PDFName.of('Width'), PDFNumber.of(Math.floor(width * scale)));
          newDict.set(PDFName.of('Height'), PDFNumber.of(Math.floor(height * scale)));
          newDict.set(PDFName.of('Length'), PDFNumber.of(compressedBytes.length));
          newDict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
          pdfDoc.context.assign(ref, PDFRawStream.of(newDict, compressedBytes));
        }
      } catch (e) { console.warn('Skipping image...', e); }
    }
    const bytes = await pdfDoc.save({ useObjectStreams: true });
    return new Blob([bytes as any], { type: 'application/pdf' });
  };

  const handleFiles = (files: FileList) => {
    const newItems: QueueItem[] = Array.from(files).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'pending',
      originalSize: file.size,
      originalUrl: URL.createObjectURL(file)
    }));
    setQueue(prev => [...prev, ...newItems]);
  };

  useEffect(() => {
    const processQueue = async () => {
      const nextItem = queue.find(item => item.status === 'pending');
      if (!nextItem) return;

      setQueue(prev => prev.map(item =>
        item.id === nextItem.id ? { ...item, status: 'processing' } : item
      ));

      try {
        let compressedBlob: Blob;
        if (mode === 'image') {
          compressedBlob = await processImage(nextItem.file);
        } else {
          compressedBlob = await processPdf(nextItem.file);
        }

        const newItem = {
          ...nextItem,
          status: 'done' as Status,
          compressedBlob,
          compressedSize: compressedBlob.size,
          previewUrl: URL.createObjectURL(compressedBlob)
        };

        setQueue(prev => prev.map(item =>
          item.id === nextItem.id ? newItem : item
        ));

        // Auto-select first done item for preview
        setSelectedPreview(prev => prev ? prev : newItem as QueueItem);
      } catch (error) {
        setQueue(prev => prev.map(item =>
          item.id === nextItem.id ? { ...item, status: 'error' } : item
        ));
      }
    };
    processQueue();
  }, [queue, mode, quality, pdfQuality]);

  const downloadAll = async () => {
    const doneItems = queue.filter(item => item.status === 'done' && item.compressedBlob);
    if (doneItems.length === 0) return;
    if (doneItems.length === 1) {
      const item = doneItems[0];
      const url = URL.createObjectURL(item.compressedBlob!);
      const a = document.createElement('a');
      a.href = url; a.download = `compressed_${item.file.name}`; a.click();
      return;
    }
    const zip = new JSZip();
    doneItems.forEach(item => zip.file(`compressed_${item.file.name}`, item.compressedBlob!));
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url; a.download = 'compressed_files.zip'; a.click();
  };

  return (
    <>
      <div className="tool-split-layout">
        {/* ── Controls ── */}
        <div className="tool-controls-panel">
          <div className="tabs" role="tablist" aria-label="Compression mode">
            <button
              className={`tab ${mode === 'image' ? 'active' : ''}`}
              onClick={() => { setMode('image'); setQueue([]); setSelectedPreview(null); }}
              role="tab" aria-selected={mode === 'image'} id="tab-image" aria-controls="panel-image"
            >
              <FileImage size={15} aria-hidden="true" /> Images
            </button>
            <button
              className={`tab ${mode === 'pdf' ? 'active' : ''}`}
              onClick={() => { setMode('pdf'); setQueue([]); setSelectedPreview(null); }}
              role="tab" aria-selected={mode === 'pdf'} id="tab-pdf" aria-controls="panel-pdf"
            >
              PDF Documents
            </button>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div className="setting-group">
              <label htmlFor="quality-slider">
                Compression Level: <strong style={{ color: 'var(--primary)' }}>{Math.round((mode === 'image' ? quality : pdfQuality) * 100)}%</strong>
              </label>
              <input
                id="quality-slider"
                type="range" min="0.1" max="1" step="0.05"
                value={mode === 'image' ? quality : pdfQuality}
                onChange={(e) => mode === 'image' ? setQuality(parseFloat(e.target.value)) : setPdfQuality(parseFloat(e.target.value))}
                className="range-input"
                aria-label={`Compression quality: ${Math.round((mode === 'image' ? quality : pdfQuality) * 100)}%`}
              />
            </div>
          </div>

          <div
            className={`upload-area ${isDragging ? 'dragging' : ''}`}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
            role="button" tabIndex={0} aria-label={`Upload ${mode === 'image' ? 'images' : 'PDF files'} to compress`}
            onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            <Upload size={44} className="upload-icon" aria-hidden="true" />
            <div>
              <p><strong style={{ color: 'var(--text-main)' }}>Drag & Drop</strong> or click to browse</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Supports bulk selection</p>
            </div>
            <input
              type="file" multiple ref={fileInputRef} style={{ display: 'none' }}
              onChange={e => e.target.files && handleFiles(e.target.files)}
              accept={mode === 'image' ? 'image/*' : 'application/pdf'}
              aria-label={`Select ${mode === 'image' ? 'image' : 'PDF'} files`}
            />
          </div>

          {queue.length > 0 && (
            <div className="file-list">
              <div className="file-list-header">
                <h3>Queue ({queue.length})</h3>
                <button
                  className="btn-primary"
                  onClick={downloadAll}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                  aria-label="Download all compressed files"
                >
                  <Download size={15} aria-hidden="true" />
                  Download All
                </button>
              </div>

              {queue.map(item => {
                const savings = item.compressedSize
                  ? Math.round((1 - item.compressedSize / item.originalSize) * 100)
                  : null;
                return (
                  <div
                    key={item.id}
                    className="file-item"
                    style={{ cursor: item.status === 'done' ? 'pointer' : 'default', borderColor: selectedPreview?.id === item.id ? 'var(--primary)' : undefined }}
                    onClick={() => item.status === 'done' && setSelectedPreview(item)}
                    role={item.status === 'done' ? 'button' : undefined}
                    aria-label={item.status === 'done' ? `Preview ${item.file.name}` : item.file.name}
                  >
                    <div className="file-info">
                      {item.status === 'processing'
                        ? <Loader2 className="spinner" size={18} color="var(--primary)" aria-label="Processing" />
                        : item.status === 'done'
                          ? <CheckCircle2 size={18} color="var(--success)" aria-label="Done" />
                          : item.status === 'error'
                            ? <X size={18} color="var(--error)" aria-label="Error" />
                            : <Upload size={18} color="var(--text-muted)" aria-label="Pending" />
                      }
                      <div className="file-details">
                        <h4>{item.file.name}</h4>
                        <p>
                          {formatSize(item.originalSize)}
                          {item.compressedSize && (
                            <> → <span style={{ color: 'var(--success)' }}>{formatSize(item.compressedSize)}</span>
                              {savings !== null && savings > 0 && <> <span style={{ color: 'var(--accent)', fontWeight: 700 }}>({savings}% saved)</span></>}
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="action-btns">
                      {item.status === 'done' && mode === 'image' && (
                        <button
                          className="btn-icon"
                          onClick={e => { e.stopPropagation(); setPreviewItem(item); }}
                          aria-label={`Compare original vs compressed for ${item.file.name}`}
                          title="Compare"
                        >
                          <Eye size={15} />
                        </button>
                      )}
                      <button
                        className="btn-icon"
                        onClick={e => { e.stopPropagation(); setQueue(q => q.filter(i => i.id !== item.id)); if (selectedPreview?.id === item.id) setSelectedPreview(null); }}
                        aria-label={`Remove ${item.file.name}`}
                        title="Remove"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Preview Panel ── */}
        <div className="tool-preview-panel">
          <div className="preview-panel-header">
            <h4>Preview</h4>
            {selectedPreview && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click a file to preview</span>
            )}
          </div>
          <div className="preview-panel-body" style={{ height: 480 }}>
            {selectedPreview ? (
              mode === 'image' && selectedPreview.previewUrl ? (
                <img
                  src={selectedPreview.previewUrl}
                  alt={`Compressed preview of ${selectedPreview.file.name}`}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', padding: '1rem' }}
                />
              ) : mode === 'pdf' && selectedPreview.previewUrl ? (
                <iframe
                  src={selectedPreview.previewUrl}
                  title={`Compressed PDF preview: ${selectedPreview.file.name}`}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              ) : null
            ) : (
              <div className="preview-empty" role="img" aria-label="No file selected for preview">
                <Upload size={48} aria-hidden="true" />
                <p>Upload and compress a file to see preview</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compare Modal */}
      {previewItem && (
        <div className="modal-overlay" onClick={() => setPreviewItem(null)} role="dialog" aria-modal="true" aria-label={`Compare: ${previewItem.file.name}`}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Before / After: {previewItem.file.name}</h3>
              <button className="btn-icon" onClick={() => setPreviewItem(null)} aria-label="Close comparison">
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '1rem' }}>
              <div className="slider-container" style={{ borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <ReactCompareSlider
                  itemOne={<ReactCompareSliderImage src={previewItem.originalUrl!} alt="Original" />}
                  itemTwo={<ReactCompareSliderImage src={previewItem.previewUrl!} alt="Compressed" />}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Original: {formatSize(previewItem.originalSize)}</span>
                <span style={{ color: 'var(--success)', fontWeight: 700 }}>Compressed: {previewItem.compressedSize ? formatSize(previewItem.compressedSize) : '—'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
