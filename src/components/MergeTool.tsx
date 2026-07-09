import { useState, useRef } from 'react';
import { Upload, Download, Loader2, Trash2, FileText, GripVertical } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

interface QueueItem {
  id: string;
  file: File;
  previewUrl: string;
}

export default function MergeTool() {
  const [queue, setQueue]           = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging]     = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<QueueItem | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList) => {
    const newItems = Array.from(files)
      .filter(f => f.type === 'application/pdf')
      .map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        previewUrl: URL.createObjectURL(file)
      }));
    setQueue(prev => [...prev, ...newItems]);
    if (!selectedPreview && newItems.length) setSelectedPreview(newItems[0]);
  };

  // ── Drag-to-reorder ───────────────────────────────────────────────
  const dragSrcId = useRef<string | null>(null);

  const onDragStart = (id: string) => { dragSrcId.current = id; };
  const onDragOver  = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOverId(id); };
  const onDrop      = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);
    if (!dragSrcId.current || dragSrcId.current === targetId) return;
    setQueue(prev => {
      const items = [...prev];
      const srcIdx = items.findIndex(i => i.id === dragSrcId.current);
      const tgtIdx = items.findIndex(i => i.id === targetId);
      const [moved] = items.splice(srcIdx, 1);
      items.splice(tgtIdx, 0, moved);
      return items;
    });
    dragSrcId.current = null;
  };

  const mergePdfs = async () => {
    if (queue.length < 2) {
      alert('Please add at least 2 PDF files to merge.');
      return;
    }
    setIsProcessing(true);
    try {
      const mergedPdf = await PDFDocument.create();
      for (const item of queue) {
        const bytes = await item.file.arrayBuffer();
        const pdf = await PDFDocument.load(bytes);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach(page => mergedPdf.addPage(page));
      }
      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([mergedBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'merged_document.pdf'; a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert('Failed to merge PDFs.');
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
          role="button" tabIndex={0} aria-label="Upload PDF files to merge"
          onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
        >
          <Upload size={44} className="upload-icon" aria-hidden="true" />
          <div>
            <p><strong style={{ color: 'var(--text-main)' }}>Drag & Drop PDFs</strong> or click to browse</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Select multiple files • Drag to reorder</p>
          </div>
          <input
            type="file" multiple ref={fileInputRef} style={{ display: 'none' }}
            onChange={e => e.target.files && handleFiles(e.target.files)}
            accept="application/pdf"
            aria-label="Select PDF files to merge"
          />
        </div>

        {queue.length > 0 && (
          <div className="file-list">
            <div className="file-list-header">
              <h3>Files to Merge ({queue.length})</h3>
              <button
                className="btn-primary"
                onClick={mergePdfs}
                disabled={isProcessing || queue.length < 2}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                aria-label="Merge all PDFs and download"
              >
                {isProcessing ? <Loader2 className="spinner" size={15} /> : <Download size={15} />}
                Merge & Download
              </button>
            </div>

            {queue.map((item, index) => (
              <div
                key={item.id}
                className="file-item"
                draggable
                onDragStart={() => onDragStart(item.id)}
                onDragOver={e => onDragOver(e, item.id)}
                onDrop={e => onDrop(e, item.id)}
                onDragEnd={() => setDragOverId(null)}
                style={{
                  cursor: 'grab',
                  borderColor: dragOverId === item.id ? 'var(--primary)' : selectedPreview?.id === item.id ? 'var(--border-active)' : undefined,
                  opacity: dragOverId === item.id ? 0.6 : 1,
                }}
                onClick={() => setSelectedPreview(item)}
                role="button"
                aria-label={`${item.file.name} — position ${index + 1} of ${queue.length}. Click to preview.`}
              >
                <div className="file-info">
                  <GripVertical size={16} color="var(--text-muted)" aria-hidden="true" />
                  <span style={{ minWidth: 24, height: 24, borderRadius: '50%', background: 'var(--primary)', color: 'white', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {index + 1}
                  </span>
                  <div className="file-details">
                    <h4>{item.file.name}</h4>
                    <p>{(item.file.size / 1024).toFixed(0)} KB</p>
                  </div>
                </div>
                <button
                  className="btn-icon"
                  onClick={e => {
                    e.stopPropagation();
                    URL.revokeObjectURL(item.previewUrl);
                    setQueue(q => q.filter(i => i.id !== item.id));
                    if (selectedPreview?.id === item.id) setSelectedPreview(null);
                  }}
                  aria-label={`Remove ${item.file.name}`}
                  title="Remove"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}

            {queue.length < 2 && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>
                Add at least 2 PDF files to merge
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Preview Panel ── */}
      <div className="tool-preview-panel">
        <div className="preview-panel-header">
          <h4>{selectedPreview ? selectedPreview.file.name : 'PDF Preview'}</h4>
          {queue.length > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click a file to preview</span>}
        </div>
        <div className="preview-panel-body" style={{ height: 520 }}>
          {selectedPreview ? (
            <iframe
              src={selectedPreview.previewUrl}
              title={`Preview: ${selectedPreview.file.name}`}
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          ) : (
            <div className="preview-empty" role="img" aria-label="No PDF selected">
              <FileText size={48} aria-hidden="true" />
              <p>Upload PDFs to preview them here</p>
              <p style={{ fontSize: '0.8125rem' }}>Drag files to reorder before merging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
