import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload, Download, RefreshCw, Layers,
  Loader2, Bold, Italic, AlignLeft,
  AlignCenter, AlignRight, FileSpreadsheet, Trash2, Award, Plus
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

// ─── Types & Interfaces ─────────────────────────────────────────────
interface FieldConfig {
  id: string;
  name: string;
  text: string;
  x: number; // percentage left
  y: number; // percentage top
  fontFamily: string;
  fontSize: number; // in pt
  color: string;
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center' | 'right';
  presetKey: 'company' | 'shareholder' | 'body' | 'certNo';
}

interface SignatureState {
  id: 'president-sig' | 'secretary-sig';
  name: string;
  x: number; // percentage left
  y: number; // percentage top
  width: number; // in pt
  dataUrl: string | null;
}

interface SavedLayout {
  id: string;
  name: string;
  fields: {
    id: string;
    x: number;
    y: number;
    fontFamily: string;
    fontSize: number;
    color: string;
    bold: boolean;
    italic: boolean;
    align: 'left' | 'center' | 'right';
  }[];
  signatures: {
    id: string;
    x: number;
    y: number;
    width: number;
  }[];
}

const FONT_FAMILIES = [
  { value: "'UnifrakturMaguntia', 'Cloister Black', 'Old English Text MT', serif", label: 'Old English / Gothic' },
  { value: "'Great Vibes', 'Bickham Script Pro', cursive", label: 'Great Vibes (Script)' },
  { value: "'Alex Brush', 'Edwardian Script ITC', cursive", label: 'Alex Brush (Calligraphy)' },
  { value: "'Baskervville', 'Baskerville', Georgia, serif", label: 'Baskerville (Classic Serif)' },
  { value: "'EB Garamond', 'Garamond', serif", label: 'Garamond (Elegant Serif)' },
  { value: "'Cinzel', 'Copperplate Gothic', serif", label: 'Cinzel (Copperplate Serif)' },
  { value: "'Montserrat', sans-serif", label: 'Montserrat (Modern Sans)' },
];

const PRESETS = {
  company: { fontFamily: "'UnifrakturMaguntia', 'Cloister Black', 'Old English Text MT', serif", fontSize: 40, bold: true, italic: false, color: '#0f172a' },
  shareholder: { fontFamily: "'Great Vibes', 'Bickham Script Pro', cursive", fontSize: 46, bold: false, italic: false, color: '#0369a1' },
  body: { fontFamily: "'EB Garamond', 'Garamond', serif", fontSize: 20, bold: false, italic: false, color: '#1e293b' },
  certNo: { fontFamily: "'Cinzel', 'Copperplate Gothic', serif", fontSize: 16, bold: true, italic: false, color: '#991b1b' },
};

// ─── Default Template Canvas Generator ──────────────────────────────
function generateDefaultTemplate(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 1131; // A4 landscape aspect ratio approx
  const ctx = canvas.getContext('2d')!;

  // Background cream gradient
  const gradient = ctx.createRadialGradient(800, 565, 100, 800, 565, 800);
  gradient.addColorStop(0, '#fdfcf7');
  gradient.addColorStop(1, '#f5f1e6');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1600, 1131);

  // Ornate Borders
  ctx.lineWidth = 16;
  ctx.strokeStyle = '#c5a880'; // gold
  ctx.strokeRect(24, 24, 1552, 1083);

  ctx.lineWidth = 3;
  ctx.strokeStyle = '#856404'; // dark gold
  ctx.strokeRect(38, 38, 1524, 1055);

  // Inner thin border
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(133, 100, 4, 0.4)';
  ctx.strokeRect(48, 48, 1504, 1035);

  // Corner flourishes
  const drawCornerFlourish = (x: number, y: number, angle: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = '#856404';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(60, 0);
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 60);
    ctx.stroke();

    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(30, 30, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  drawCornerFlourish(55, 55, 0);
  drawCornerFlourish(1545, 55, Math.PI / 2);
  drawCornerFlourish(1545, 1075, Math.PI);
  drawCornerFlourish(55, 1075, -Math.PI / 2);

  // Soft watermark rays in center
  ctx.save();
  ctx.strokeStyle = 'rgba(197, 168, 128, 0.07)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 36) {
    ctx.moveTo(800, 565);
    ctx.lineTo(800 + Math.cos(angle) * 600, 565 + Math.sin(angle) * 600);
  }
  ctx.stroke();
  ctx.restore();

  // Central ornate circle
  ctx.save();
  ctx.translate(800, 565);
  ctx.strokeStyle = 'rgba(197, 168, 128, 0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 180, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 172, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Decorative text elements
  ctx.fillStyle = '#856404';
  ctx.font = 'italic 16px "EB Garamond", serif';
  ctx.textAlign = 'center';
  ctx.fillText('This Certifies that', 800, 385);
  ctx.fillText('is the registered holder of', 800, 520);
  ctx.fillText('transferable only on the books of the Corporation by the holder hereof in person.', 800, 630);
  ctx.fillText('In Witness Whereof, the Corporation has caused this Certificate to be signed by its officers.', 800, 740);

  // Signatures lines
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#c5a880';
  ctx.beginPath();
  ctx.moveTo(300, 810);
  ctx.lineTo(550, 810);
  ctx.moveTo(1050, 810);
  ctx.lineTo(1300, 810);
  ctx.stroke();

  return canvas.toDataURL('image/png');
}

export default function CertificateGeneratorTool() {
  const [templateSrc, setTemplateSrc] = useState<string>(() => generateDefaultTemplate());
  const [fields, setFields] = useState<FieldConfig[]>(() => [
    { id: 'company', name: 'Company Name', text: 'ACME CAPITAL CORPORATION', x: 50, y: 31, fontFamily: PRESETS.company.fontFamily, fontSize: PRESETS.company.fontSize, color: PRESETS.company.color, bold: PRESETS.company.bold, italic: PRESETS.company.italic, align: 'center', presetKey: 'company' },
    { id: 'shareholder', name: 'Shareholder Name', text: 'Sarah Jenkins', x: 50, y: 44, fontFamily: PRESETS.shareholder.fontFamily, fontSize: PRESETS.shareholder.fontSize, color: PRESETS.shareholder.color, bold: PRESETS.shareholder.bold, italic: PRESETS.shareholder.italic, align: 'center', presetKey: 'shareholder' },
    { id: 'certNo', name: 'Certificate Number', text: 'N°-094857', x: 80, y: 12, fontFamily: PRESETS.certNo.fontFamily, fontSize: PRESETS.certNo.fontSize, color: PRESETS.certNo.color, bold: PRESETS.certNo.bold, italic: PRESETS.certNo.italic, align: 'right', presetKey: 'certNo' },
    { id: 'parValue', name: 'Par Value', text: '$1.00', x: 20, y: 12, fontFamily: PRESETS.certNo.fontFamily, fontSize: 16, color: '#1e293b', bold: true, italic: false, align: 'left', presetKey: 'certNo' },
    { id: 'shares', name: 'Number of Shares', text: 'Five Thousand (5,000) Shares', x: 50, y: 56, fontFamily: PRESETS.body.fontFamily, fontSize: PRESETS.body.fontSize, color: PRESETS.body.color, bold: PRESETS.body.bold, italic: PRESETS.body.italic, align: 'center', presetKey: 'body' },
    { id: 'dateIssued', name: 'Date Issued', text: 'this 16th day of July, 2026', x: 50, y: 67, fontFamily: PRESETS.body.fontFamily, fontSize: 18, color: '#334155', bold: false, italic: true, align: 'center', presetKey: 'body' },
    { id: 'president', name: 'President Name', text: 'Marcus Aurelius', x: 26.5, y: 84.5, fontFamily: PRESETS.body.fontFamily, fontSize: 18, color: '#1e293b', bold: false, italic: false, align: 'center', presetKey: 'body' },
    { id: 'secretary', name: 'Secretary Name', text: 'Lucius Verus', x: 72.5, y: 84.5, fontFamily: PRESETS.body.fontFamily, fontSize: 18, color: '#1e293b', bold: false, italic: false, align: 'center', presetKey: 'body' },
  ]);
  const [signatures, setSignatures] = useState<SignatureState[]>(() => [
    { id: 'president-sig', name: 'President Signature', x: 26.5, y: 76.5, width: 100, dataUrl: null },
    { id: 'secretary-sig', name: 'Secretary Signature', x: 72.5, y: 76.5, width: 100, dataUrl: null },
  ]);
  const [selectedElement, setSelectedElement] = useState<{ id: string; type: 'field' | 'signature' } | null>(null);
  
  // Custom Date Issued, Shares & Currency States
  const [issueDay, setIssueDay] = useState('16th');
  const [issueMonth, setIssueMonth] = useState('July');
  const [issueYear, setIssueYear] = useState('2026');
  const [sharesCount, setSharesCount] = useState('Five Thousand (5,000) Shares');
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [parValueAmt, setParValueAmt] = useState('1.00');

  // Layout Save/Load State
  const [savedLayouts, setSavedLayouts] = useState<SavedLayout[]>([]);
  const [newLayoutName, setNewLayoutName] = useState<string>('');
  const [currentLayoutId, setCurrentLayoutId] = useState<string>('');

  // Batch CSV Processing State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvStatus, setCsvStatus] = useState<{ success?: boolean; message?: string; count?: number } | null>(null);
  
  // Progress/Status Overlay
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingMessage, setProcessingMessage] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const presSigRef = useRef<HTMLInputElement>(null);
  const secSigRef = useRef<HTMLInputElement>(null);

  // Width tracker for scaling fonts and layers
  const [previewWidth, setPreviewWidth] = useState(800);

  // Initialize Fonts and Layouts
  useEffect(() => {
    // Dynamic Google Fonts loading
    const linkId = 'google-fonts-certificate';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&family=Great+Vibes&family=Alex+Brush&family=EB+Garamond:ital,wght@0,400..700;1,400..700&family=Cinzel:wght@400..700&family=Montserrat:wght@400;700&display=swap';
      document.head.appendChild(link);
    }

    // Load custom layouts from localStorage
    const saved = localStorage.getItem('pdfmaster_cert_layouts');
    if (saved) {
      try {
        setSavedLayouts(JSON.parse(saved));
      } catch (err) {
        console.error('Failed to parse saved layouts:', err);
      }
    }
  }, []);

  // Sync Date Issued text
  useEffect(() => {
    setFields(prev => prev.map(f => f.id === 'dateIssued' ? { ...f, text: `this ${issueDay} day of ${issueMonth}, ${issueYear}` } : f));
  }, [issueDay, issueMonth, issueYear]);

  // Sync Shares text
  useEffect(() => {
    setFields(prev => prev.map(f => f.id === 'shares' ? { ...f, text: sharesCount } : f));
  }, [sharesCount]);

  // Sync Par Value text
  useEffect(() => {
    setFields(prev => prev.map(f => f.id === 'parValue' ? { ...f, text: `${currencySymbol}${parValueAmt}` } : f));
  }, [currencySymbol, parValueAmt]);

  // Update container size dynamically on resize
  useEffect(() => {
    if (!containerRef.current) return;
    const handleResize = () => {
      if (containerRef.current) {
        setPreviewWidth(containerRef.current.clientWidth);
      }
    };
    handleResize();
    const timer = setTimeout(handleResize, 100); // safety buffer
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [templateSrc]);

  // Selected Field Helper
  const getSelectedField = () => {
    if (!selectedElement) return null;
    if (selectedElement.type === 'field') {
      return fields.find(f => f.id === selectedElement.id) || null;
    } else {
      return signatures.find(s => s.id === selectedElement.id) || null;
    }
  };

  const updateSelectedField = (props: Partial<FieldConfig>) => {
    if (!selectedElement || selectedElement.type !== 'field') return;
    setFields(prev => prev.map(f => f.id === selectedElement.id ? { ...f, ...props } : f));
  };

  const updateSelectedSignature = (props: Partial<SignatureState>) => {
    if (!selectedElement || selectedElement.type !== 'signature') return;
    setSignatures(prev => prev.map(s => s.id === selectedElement.id ? { ...s, ...props } : s));
  };

  // ─── Drag & Drop Event Handlers ─────────────────────────────────────
  const startDrag = (e: React.MouseEvent, id: string, type: 'field' | 'signature') => {
    e.preventDefault();
    if (!containerRef.current) return;
    
    setSelectedElement({ id, type });
    const rect = containerRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    
    let initialX = 0;
    let initialY = 0;
    if (type === 'field') {
      const f = fields.find(x => x.id === id)!;
      initialX = f.x;
      initialY = f.y;
    } else {
      const s = signatures.find(x => x.id === id)!;
      initialX = s.x;
      initialY = s.y;
    }
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      
      const deltaXPercent = (deltaX / rect.width) * 100;
      const deltaYPercent = (deltaY / rect.height) * 100;
      
      let newX = Math.max(0, Math.min(100, initialX + deltaXPercent));
      let newY = Math.max(0, Math.min(100, initialY + deltaYPercent));
      
      newX = Math.round(newX * 10) / 10;
      newY = Math.round(newY * 10) / 10;
      
      if (type === 'field') {
        setFields(prev => prev.map(f => f.id === id ? { ...f, x: newX, y: newY } : f));
      } else {
        setSignatures(prev => prev.map(s => s.id === id ? { ...s, x: newX, y: newY } : s));
      }
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const startDragTouch = (e: React.TouchEvent, id: string, type: 'field' | 'signature') => {
    if (!containerRef.current) return;
    setSelectedElement({ id, type });
    
    const touch = e.touches[0];
    if (!touch) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const startX = touch.clientX;
    const startY = touch.clientY;
    
    let initialX = 0;
    let initialY = 0;
    if (type === 'field') {
      const f = fields.find(x => x.id === id)!;
      initialX = f.x;
      initialY = f.y;
    } else {
      const s = signatures.find(x => x.id === id)!;
      initialX = s.x;
      initialY = s.y;
    }
    
    const handleTouchMove = (moveEvent: TouchEvent) => {
      const moveTouch = moveEvent.touches[0];
      if (!moveTouch) return;
      
      const deltaX = moveTouch.clientX - startX;
      const deltaY = moveTouch.clientY - startY;
      
      const deltaXPercent = (deltaX / rect.width) * 100;
      const deltaYPercent = (deltaY / rect.height) * 100;
      
      let newX = Math.max(0, Math.min(100, initialX + deltaXPercent));
      let newY = Math.max(0, Math.min(100, initialY + deltaYPercent));
      
      newX = Math.round(newX * 10) / 10;
      newY = Math.round(newY * 10) / 10;
      
      if (type === 'field') {
        setFields(prev => prev.map(f => f.id === id ? { ...f, x: newX, y: newY } : f));
      } else {
        setSignatures(prev => prev.map(s => s.id === id ? { ...s, x: newX, y: newY } : s));
      }
    };
    
    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
    
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };

  // ─── File Upload Helpers ──────────────────────────────────────────
  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setTemplateSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>, id: 'president-sig' | 'secretary-sig') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSignatures(prev => prev.map(s => s.id === id ? { ...s, dataUrl: reader.result as string } : s));
    };
    reader.readAsDataURL(file);
  };

  // ─── Canvas Off-screen Drawer (High Res 300 DPI) ──────────────────
  const drawHighResCanvas = useCallback(async (customFields?: FieldConfig[]): Promise<HTMLCanvasElement> => {
    const renderFields = customFields || fields;
    
    const canvas = document.createElement('canvas');
    canvas.width = 3508; // 300 DPI A4 Landscape
    canvas.height = 2480;
    const ctx = canvas.getContext('2d')!;

    // Wait for custom fonts to load
    await document.fonts.ready;

    // Load background image
    const img = new Image();
    img.src = templateSrc;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load background template image.'));
    });

    // Draw background (stretched to cover, preserving A4 proportion)
    ctx.drawImage(img, 0, 0, 3508, 2480);

    // Draw signatures
    for (const sig of signatures) {
      if (sig.dataUrl) {
        const sigImg = new Image();
        sigImg.src = sig.dataUrl;
        await new Promise<void>((res) => { sigImg.onload = () => res(); });

        const sigW = sig.width * (3508 / 841.68); // scale points to A4 pixels
        const sigH = (sigW * sigImg.naturalHeight) / sigImg.naturalWidth;

        // Position coordinates
        const xPx = (sig.x / 100) * 3508 - sigW / 2;
        const yPx = (sig.y / 100) * 2480 - sigH / 2;

        ctx.drawImage(sigImg, xPx, yPx, sigW, sigH);
      }
    }

    // Draw text fields
    for (const f of renderFields) {
      ctx.save();
      
      const fontSizePx = f.fontSize * (3508 / 841.68); // convert pt to high-res pixels
      const fontStyleStr = `${f.italic ? 'italic ' : ''}${f.bold ? 'bold ' : ''}${fontSizePx}px ${f.fontFamily}`;
      ctx.font = fontStyleStr;
      ctx.fillStyle = f.color;
      ctx.textAlign = f.align;
      ctx.textBaseline = 'middle';

      const xPx = (f.x / 100) * 3508;
      const yPx = (f.y / 100) * 2480;

      ctx.fillText(f.text, xPx, yPx);
      ctx.restore();
    }

    return canvas;
  }, [templateSrc, fields, signatures]);

  // ─── Export Single PDF ────────────────────────────────────────────
  const exportPDF = async () => {
    setIsProcessing(true);
    setProcessingMessage('Generating High-Resolution A4 Landscape PDF...');
    try {
      const canvas = await drawHighResCanvas();
      const pngData = canvas.toDataURL('image/png'); // lossless

      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([841.68, 595.44]); // exact A4 landscape points

      const embeddedImage = await pdfDoc.embedPng(pngData);
      page.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: 841.68,
        height: 595.44,
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificate_${fields.find(f => f.id === 'shareholder')?.text.replace(/[^a-zA-Z0-9]/g, '_') || 'shares'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to generate PDF. Check browser memory or image resolutions.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── CSV Parser ───────────────────────────────────────────────────
  const parseCSV = (text: string): string[][] => {
    const lines: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let currentVal = '';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentVal += '"';
          i++; // skip duplicate quotes
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(currentVal.trim());
        currentVal = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        row.push(currentVal.trim());
        if (row.length > 0 && (row.length > 1 || row[0] !== '')) {
          lines.push(row);
        }
        row = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    if (currentVal || row.length > 0) {
      row.push(currentVal.trim());
      lines.push(row);
    }
    return lines;
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const rows = parseCSV(text);
      
      if (rows.length < 2) {
        setCsvStatus({ success: false, message: 'CSV must contain a header row and at least 1 data row.' });
        return;
      }

      // Validate Headers (CertificateNo, ShareholderName, Shares, IssueDate)
      const headers = rows[0].map(h => h.toLowerCase());
      const hasCert = headers.some(h => h.includes('certificateno') || h.includes('number') || h.includes('cert'));
      const hasName = headers.some(h => h.includes('shareholdername') || h.includes('name') || h.includes('shareholder'));
      const hasShares = headers.some(h => h.includes('shares') || h.includes('count'));
      const hasDate = headers.some(h => h.includes('date'));

      if (!hasCert || !hasName || !hasShares || !hasDate) {
        setCsvStatus({
          success: false,
          message: 'Missing columns. CSV requires headers resembling: CertificateNo, ShareholderName, Shares, IssueDate'
        });
        return;
      }

      setCsvStatus({
        success: true,
        message: `Parsed successfully. Ready to generate certificates.`,
        count: rows.length - 1
      });
    };
    reader.readAsText(file);
  };

  // ─── Batch Generate from CSV ──────────────────────────────────────
  const batchGenerate = async () => {
    if (!csvFile || !csvStatus?.success) return;
    setIsProcessing(true);
    setProgressPercent(0);
    setProcessingMessage('Parsing CSV and preparing batch export...');

    try {
      const fileReader = new FileReader();
      const csvText = await new Promise<string>((resolve) => {
        fileReader.onload = () => resolve(fileReader.result as string);
        fileReader.readAsText(csvFile);
      });

      const rows = parseCSV(csvText);
      const headers = rows[0].map(h => h.toLowerCase());

      // Identify column indices
      const certIdx = headers.findIndex(h => h.includes('certificateno') || h.includes('number') || h.includes('cert'));
      const nameIdx = headers.findIndex(h => h.includes('shareholdername') || h.includes('name') || h.includes('shareholder'));
      const sharesIdx = headers.findIndex(h => h.includes('shares') || h.includes('count'));
      const dateIdx = headers.findIndex(h => h.includes('date'));

      const dataRows = rows.slice(1);
      const total = dataRows.length;
      
      const zip = new JSZip();

      for (let i = 0; i < total; i++) {
        const row = dataRows[i];
        if (row.length < 4) continue; // safety check

        const certVal = row[certIdx] || '';
        const nameVal = row[nameIdx] || '';
        const sharesVal = row[sharesIdx] || '';
        const dateVal = row[dateIdx] || '';

        setProcessingMessage(`Generating certificate ${i + 1} of ${total} (${nameVal})...`);
        setProgressPercent(Math.round(((i) / total) * 100));

        // Create updated fields local clone
        const batchFields = fields.map(f => {
          if (f.id === 'certNo') return { ...f, text: certVal };
          if (f.id === 'shareholder') return { ...f, text: nameVal };
          if (f.id === 'shares') return { ...f, text: sharesVal.includes('Shares') ? sharesVal : `${sharesVal} Shares` };
          if (f.id === 'dateIssued') return { ...f, text: dateVal };
          return f;
        });

        // Draw Canvas and compile PDF
        const canvas = await drawHighResCanvas(batchFields);
        const pngData = canvas.toDataURL('image/png');

        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([841.68, 595.44]);

        const embeddedImage = await pdfDoc.embedPng(pngData);
        page.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: 841.68,
          height: 595.44,
        });

        const pdfBytes = await pdfDoc.save();
        const filename = `cert_${nameVal.replace(/[^a-zA-Z0-9]/g, '_')}_${certVal}.pdf`;
        zip.file(filename, pdfBytes);
      }

      setProgressPercent(100);
      setProcessingMessage('Packaging into a ZIP archive...');
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `batch_certificates_${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Batch generation encountered memory limits or file problems.');
    } finally {
      setIsProcessing(false);
      setProgressPercent(0);
    }
  };

  // ─── Local Storage Layout Templates ───────────────────────────────
  const saveCurrentLayout = () => {
    if (!newLayoutName.trim()) return;
    const layoutId = Date.now().toString();
    const newLayout: SavedLayout = {
      id: layoutId,
      name: newLayoutName.trim(),
      fields: fields.map(f => ({
        id: f.id, x: f.x, y: f.y, fontFamily: f.fontFamily, fontSize: f.fontSize,
        color: f.color, bold: f.bold, italic: f.italic, align: f.align
      })),
      signatures: signatures.map(s => ({
        id: s.id, x: s.x, y: s.y, width: s.width
      }))
    };

    const updated = [...savedLayouts, newLayout];
    setSavedLayouts(updated);
    localStorage.setItem('pdfmaster_cert_layouts', JSON.stringify(updated));
    setCurrentLayoutId(layoutId);
    setNewLayoutName('');
  };

  const loadSavedLayout = (layoutId: string) => {
    if (!layoutId) return;
    const layout = savedLayouts.find(l => l.id === layoutId);
    if (!layout) return;

    setFields(prev => prev.map(f => {
      const match = layout.fields.find(lf => lf.id === f.id);
      return match ? { ...f, ...match } : f;
    }));

    setSignatures(prev => prev.map(s => {
      const match = layout.signatures.find(ls => ls.id === s.id);
      return match ? { ...s, x: match.x, y: match.y, width: match.width } : s;
    }));

    setCurrentLayoutId(layoutId);
  };

  const deleteSavedLayout = (layoutId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedLayouts.filter(l => l.id !== layoutId);
    setSavedLayouts(updated);
    localStorage.setItem('pdfmaster_cert_layouts', JSON.stringify(updated));
    if (currentLayoutId === layoutId) {
      setCurrentLayoutId('');
    }
  };

  const activeField = getSelectedField();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 340px', gap: '1.5rem', alignItems: 'stretch', width: '100%', boxSizing: 'border-box' }}>
      
      {/* ─── Left Panel: Data Entry & Template Loading ─── */}
      <div style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        maxHeight: '85vh',
        overflowY: 'auto'
      }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Award size={18} color="var(--primary)" /> Certificate Setup
        </h3>

        {/* Template Image Picker */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Background Template</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn-ghost"
              style={{ flex: 1, fontSize: '0.75rem', padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem', justifyContent: 'center' }}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload certificate background template"
            >
              <Upload size={13} /> Upload Template
            </button>
            <button
              className="btn-ghost"
              style={{ fontSize: '0.75rem', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => setTemplateSrc(generateDefaultTemplate())}
              title="Reset to default ornate template"
              aria-label="Reset background template"
            >
              <RefreshCw size={13} />
            </button>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleTemplateUpload}
            aria-label="Select template image file"
          />
        </div>

        {/* Saved Layouts Templates */}
        {savedLayouts.length > 0 && (
          <div>
            <label htmlFor="select-layout" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Layout Coordinates</label>
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              <select
                id="select-layout"
                value={currentLayoutId}
                onChange={e => loadSavedLayout(e.target.value)}
                style={{
                  flex: 1, padding: '0.45rem 0.75rem', fontSize: '0.8125rem',
                  background: 'var(--surface-3)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-xs)', color: 'var(--text-main)', cursor: 'pointer'
                }}
                aria-label="Load layout template"
              >
                <option value="">-- Choose Layout --</option>
                {savedLayouts.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              {currentLayoutId && (
                <button
                  onClick={(e) => deleteSavedLayout(currentLayoutId, e)}
                  className="btn-ghost"
                  style={{ padding: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--error)' }}
                  title="Delete Layout"
                  aria-label="Delete layout template"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Certificate Text Inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Field Entries</h4>
          
          {/* Generic Text Inputs */}
          {fields.filter(f => !['shares', 'dateIssued', 'parValue'].includes(f.id)).map(f => (
            <div key={f.id}>
              <label htmlFor={`input-${f.id}`} style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{f.name}</label>
              <input
                id={`input-${f.id}`}
                type="text"
                value={f.text}
                onChange={e => setFields(prev => prev.map(field => field.id === f.id ? { ...field, text: e.target.value } : field))}
                style={{
                  width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.8125rem',
                  background: 'var(--surface-3)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-xs)', color: 'var(--text-main)', outline: 'none'
                }}
                aria-label={f.name}
              />
            </div>
          ))}

          {/* Custom shares input block */}
          <div>
            <label htmlFor="input-shares-count" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Number of Shares</label>
            <input
              id="input-shares-count"
              type="text"
              value={sharesCount}
              onChange={e => setSharesCount(e.target.value)}
              placeholder="e.g. Five Thousand (5,000)"
              style={{
                width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.8125rem',
                background: 'var(--surface-3)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xs)', color: 'var(--text-main)', outline: 'none'
              }}
              aria-label="Number of shares text"
            />
          </div>

          {/* Custom par value currency block */}
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '0.5rem' }}>
            <div>
              <label htmlFor="select-currency" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Currency</label>
              <select
                id="select-currency"
                value={currencySymbol}
                onChange={e => setCurrencySymbol(e.target.value)}
                style={{
                  width: '100%', padding: '0.5rem 0.5rem', fontSize: '0.8125rem',
                  background: 'var(--surface-3)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-xs)', color: 'var(--text-main)', outline: 'none',
                  cursor: 'pointer'
                }}
                aria-label="Currency symbol select"
              >
                <option value="$">$ (USD)</option>
                <option value="₱">₱ (PHP)</option>
                <option value="€">€ (EUR)</option>
                <option value="£">£ (GBP)</option>
                <option value="¥">¥ (JPY/CNY)</option>
              </select>
            </div>
            <div>
              <label htmlFor="input-par-value" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Par Value Amount</label>
              <input
                id="input-par-value"
                type="text"
                value={parValueAmt}
                onChange={e => setParValueAmt(e.target.value)}
                placeholder="e.g. 1.00"
                style={{
                  width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.8125rem',
                  background: 'var(--surface-3)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-xs)', color: 'var(--text-main)', outline: 'none'
                }}
                aria-label="Par value share price"
              />
            </div>
          </div>

          {/* Custom date issued inputs */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Date Issued</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: '0.375rem' }}>
              <input
                type="text"
                value={issueDay}
                onChange={e => setIssueDay(e.target.value)}
                placeholder="Day (16th)"
                style={{
                  width: '100%', padding: '0.5rem 0.5rem', fontSize: '0.8125rem',
                  background: 'var(--surface-3)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-xs)', color: 'var(--text-main)', outline: 'none',
                  textAlign: 'center'
                }}
                aria-label="Issue date day"
              />
              <input
                type="text"
                value={issueMonth}
                onChange={e => setIssueMonth(e.target.value)}
                placeholder="Month (July)"
                style={{
                  width: '100%', padding: '0.5rem 0.5rem', fontSize: '0.8125rem',
                  background: 'var(--surface-3)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-xs)', color: 'var(--text-main)', outline: 'none',
                  textAlign: 'center'
                }}
                aria-label="Issue date month"
              />
              <input
                type="text"
                value={issueYear}
                onChange={e => setIssueYear(e.target.value)}
                placeholder="Year (2026)"
                style={{
                  width: '100%', padding: '0.5rem 0.5rem', fontSize: '0.8125rem',
                  background: 'var(--surface-3)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-xs)', color: 'var(--text-main)', outline: 'none',
                  textAlign: 'center'
                }}
                aria-label="Issue date year"
              />
            </div>
          </div>
        </div>

        {/* Signatures Upload */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Signature Images</h4>
          
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>President Signature</label>
              {signatures[0].dataUrl && (
                <button
                  onClick={() => setSignatures(prev => prev.map(s => s.id === 'president-sig' ? { ...s, dataUrl: null } : s))}
                  style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: '0.6875rem', cursor: 'pointer', fontWeight: 600 }}
                  aria-label="Remove President Signature"
                >
                  Remove
                </button>
              )}
            </div>
            <button
              className="btn-ghost"
              style={{ width: '100%', padding: '0.45rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem', justifyContent: 'center' }}
              onClick={() => presSigRef.current?.click()}
              aria-label="Upload President Signature image"
            >
              {signatures[0].dataUrl ? '✓ Signature Loaded' : <><Upload size={12} /> Upload PNG</>}
            </button>
            <input
              type="file"
              ref={presSigRef}
              accept="image/png,image/jpeg"
              style={{ display: 'none' }}
              onChange={e => handleSignatureUpload(e, 'president-sig')}
              aria-label="President signature image selector"
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Secretary Signature</label>
              {signatures[1].dataUrl && (
                <button
                  onClick={() => setSignatures(prev => prev.map(s => s.id === 'secretary-sig' ? { ...s, dataUrl: null } : s))}
                  style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: '0.6875rem', cursor: 'pointer', fontWeight: 600 }}
                  aria-label="Remove Secretary Signature"
                >
                  Remove
                </button>
              )}
            </div>
            <button
              className="btn-ghost"
              style={{ width: '100%', padding: '0.45rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem', justifyContent: 'center' }}
              onClick={() => secSigRef.current?.click()}
              aria-label="Upload Secretary Signature image"
            >
              {signatures[1].dataUrl ? '✓ Signature Loaded' : <><Upload size={12} /> Upload PNG</>}
            </button>
            <input
              type="file"
              ref={secSigRef}
              accept="image/png,image/jpeg"
              style={{ display: 'none' }}
              onChange={e => handleSignatureUpload(e, 'secretary-sig')}
              aria-label="Secretary signature image selector"
            />
          </div>
        </div>

        {/* CSV Batch Upload */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <FileSpreadsheet size={14} color="var(--primary)" /> Batch Processing
          </h4>
          
          <button
            className="btn-ghost"
            style={{ width: '100%', padding: '0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem', justifyContent: 'center' }}
            onClick={() => csvInputRef.current?.click()}
            aria-label="Import CSV for batch generation"
          >
            {csvFile ? `Imported: ${csvFile.name.substring(0, 16)}...` : <><Upload size={12} /> Import CSV file</>}
          </button>
          
          <input
            type="file"
            ref={csvInputRef}
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleCsvUpload}
            aria-label="CSV file import selector"
          />

          {csvStatus && (
            <div style={{
              background: csvStatus.success ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
              border: `1px solid ${csvStatus.success ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`,
              borderRadius: 'var(--radius-xs)', padding: '0.625rem', fontSize: '0.75rem'
            }}>
              <p style={{ margin: 0, color: csvStatus.success ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>
                {csvStatus.message}
              </p>
              {csvStatus.success && csvStatus.count && (
                <button
                  onClick={batchGenerate}
                  className="download-btn"
                  style={{ width: '100%', padding: '0.45rem', fontSize: '0.75rem', marginTop: '0.5rem', fontWeight: 700 }}
                  aria-label="Generate batch PDF certificates"
                >
                  Generate {csvStatus.count} Certificates
                </button>
              )}
            </div>
          )}
          
          <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>
            Columns required: <code>CertificateNo</code>, <code>ShareholderName</code>, <code>Shares</code>, <code>IssueDate</code>.
          </p>
        </div>
      </div>

      {/* ─── Center Panel: Draggable Canvas Preview ─── */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        boxSizing: 'border-box'
      }}>
        {/* Main Canvas Container maintaining A4 Landscape proportion */}
        <div
          ref={containerRef}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 860,
            aspectRatio: '1600 / 1131',
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            userSelect: 'none',
          }}
        >
          {templateSrc && (
            <img
              src={templateSrc}
              alt="Stock Certificate template preview"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                pointerEvents: 'none'
              }}
            />
          )}

          {/* Render Text Fields */}
          {fields.map(f => {
            const fontScale = previewWidth / 841.68;
            const isSelected = selectedElement?.type === 'field' && selectedElement?.id === f.id;
            
            return (
              <div
                key={f.id}
                onMouseDown={e => startDrag(e, f.id, 'field')}
                onTouchStart={e => startDragTouch(e, f.id, 'field')}
                style={{
                  position: 'absolute',
                  left: `${f.x}%`,
                  top: `${f.y}%`,
                  transform: f.align === 'center' ? 'translate(-50%, -50%)' : f.align === 'right' ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
                  fontFamily: f.fontFamily,
                  fontSize: `${f.fontSize * fontScale}px`,
                  color: f.color,
                  fontWeight: f.bold ? 'bold' : 'normal',
                  fontStyle: f.italic ? 'italic' : 'normal',
                  textAlign: f.align,
                  whiteSpace: 'nowrap',
                  cursor: 'move',
                  padding: '4px 8px',
                  borderRadius: 4,
                  border: isSelected ? '1.5px dashed var(--primary)' : '1px solid transparent',
                  background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                  transition: 'background 100ms, border-color 150ms',
                }}
                aria-label={`Draggable field: ${f.name}`}
              >
                {f.text || f.name}
              </div>
            );
          })}

          {/* Render Signatures */}
          {signatures.map(s => {
            const fontScale = previewWidth / 841.68;
            const sigWidthPx = s.width * fontScale;
            const isSelected = selectedElement?.type === 'signature' && selectedElement?.id === s.id;

            return (
              <div
                key={s.id}
                onMouseDown={e => startDrag(e, s.id, 'signature')}
                onTouchStart={e => startDragTouch(e, s.id, 'signature')}
                style={{
                  position: 'absolute',
                  left: `${s.x}%`,
                  top: `${s.y}%`,
                  transform: 'translate(-50%, -50%)',
                  width: sigWidthPx,
                  cursor: 'move',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: isSelected ? '1.5px dashed var(--primary)' : '1px dashed rgba(255,255,255,0.15)',
                  background: isSelected ? 'rgba(59, 130, 246, 0.08)' : s.dataUrl ? 'transparent' : 'rgba(255,255,255,0.02)',
                  minHeight: sigWidthPx * 0.5,
                  borderRadius: 4,
                  padding: 2
                }}
                aria-label={`Draggable signature area: ${s.name}`}
              >
                {s.dataUrl ? (
                  <img
                    src={s.dataUrl}
                    alt={s.name}
                    style={{ width: '100%', pointerEvents: 'none', display: 'block' }}
                  />
                ) : (
                  <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>
                    {s.name}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Global Export Button below Preview */}
        <button
          className="download-btn"
          onClick={exportPDF}
          style={{ width: '100%', maxWidth: 440, height: 48, borderRadius: 'var(--radius)', fontSize: '0.9375rem', fontWeight: 800, marginTop: '1.25rem', gap: '0.5rem' }}
          aria-label="Export single certificate as PDF"
        >
          <Download size={18} /> Export Landscape PDF
        </button>
      </div>

      {/* ─── Right Panel: Typography & Styles Customizer ─── */}
      <div style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        maxHeight: '85vh',
        overflowY: 'auto'
      }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Layers size={18} color="var(--primary)" /> Typography Controls
        </h3>

        {activeField ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Selected Element</p>
              <h4 style={{ margin: '0.25rem 0 0', fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-main)' }}>{activeField.name}</h4>
            </div>

            {selectedElement?.type === 'field' ? (
              // TEXT FIELD CONTROLS
              <>
                {/* Font Preset Buttons */}
                {(activeField as FieldConfig).presetKey && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Quick Presets</label>
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <button
                        onClick={() => updateSelectedField(PRESETS[(activeField as FieldConfig).presetKey])}
                        className="btn-ghost"
                        style={{ flex: 1, fontSize: '0.75rem', padding: '0.4rem 0.625rem', fontWeight: 600 }}
                        aria-label="Apply default typography preset"
                      >
                        Reset to Preset Default
                      </button>
                    </div>
                  </div>
                )}

                {/* Font Family selector */}
                <div>
                  <label htmlFor="font-family" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Font Family</label>
                  <select
                    id="font-family"
                    value={(activeField as FieldConfig).fontFamily}
                    onChange={e => updateSelectedField({ fontFamily: e.target.value })}
                    style={{
                      width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.8125rem',
                      background: 'var(--surface-3)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-xs)', color: 'var(--text-main)', cursor: 'pointer'
                    }}
                    aria-label="Select typography font family"
                  >
                    {FONT_FAMILIES.map(font => (
                      <option key={font.value} value={font.value}>{font.label}</option>
                    ))}
                  </select>
                </div>

                {/* Font Size slider */}
                <div>
                  <label htmlFor="font-size" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                    <span>Font Size</span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{(activeField as FieldConfig).fontSize}pt</span>
                  </label>
                  <input
                    id="font-size"
                    type="range"
                    min={8}
                    max={120}
                    value={(activeField as FieldConfig).fontSize}
                    onChange={e => updateSelectedField({ fontSize: parseInt(e.target.value) })}
                    style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--primary)' }}
                    aria-label="Adjust font size"
                  />
                </div>

                {/* Formatting Toggles */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Weight & Style</label>
                    <div style={{ display: 'flex', gap: '2px', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)', padding: 2 }}>
                      <button
                        onClick={() => updateSelectedField({ bold: !(activeField as FieldConfig).bold })}
                        style={{
                          flex: 1, padding: '0.4rem', border: 'none', borderRadius: 4, cursor: 'pointer',
                          background: (activeField as FieldConfig).bold ? 'var(--primary)' : 'transparent',
                          color: (activeField as FieldConfig).bold ? '#fff' : 'var(--text-secondary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                        title="Toggle Bold"
                        aria-pressed={(activeField as FieldConfig).bold}
                      >
                        <Bold size={14} />
                      </button>
                      <button
                        onClick={() => updateSelectedField({ italic: !(activeField as FieldConfig).italic })}
                        style={{
                          flex: 1, padding: '0.4rem', border: 'none', borderRadius: 4, cursor: 'pointer',
                          background: (activeField as FieldConfig).italic ? 'var(--primary)' : 'transparent',
                          color: (activeField as FieldConfig).italic ? '#fff' : 'var(--text-secondary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                        title="Toggle Italic"
                        aria-pressed={(activeField as FieldConfig).italic}
                      >
                        <Italic size={14} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Text Alignment</label>
                    <div style={{ display: 'flex', gap: '2px', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)', padding: 2 }}>
                      {(['left', 'center', 'right'] as const).map(align => {
                        const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight;
                        const isCurrent = (activeField as FieldConfig).align === align;
                        return (
                          <button
                            key={align}
                            onClick={() => updateSelectedField({ align })}
                            style={{
                              flex: 1, padding: '0.4rem', border: 'none', borderRadius: 4, cursor: 'pointer',
                              background: isCurrent ? 'var(--primary)' : 'transparent',
                              color: isCurrent ? '#fff' : 'var(--text-secondary)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                            title={`Align ${align}`}
                            aria-pressed={isCurrent}
                          >
                            <Icon size={14} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Font Color */}
                <div>
                  <label htmlFor="font-color" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>Color Picker</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--surface-3)', border: '1px solid var(--border)', padding: '0.5rem', borderRadius: 'var(--radius-xs)' }}>
                    <input
                      id="font-color"
                      type="color"
                      value={(activeField as FieldConfig).color}
                      onChange={e => updateSelectedField({ color: e.target.value })}
                      style={{ width: 34, height: 34, padding: 0, border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)', cursor: 'pointer' }}
                      aria-label="Font color picker"
                    />
                    <code style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{(activeField as FieldConfig).color}</code>
                  </div>

                  {/* Swatches */}
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    {['#0f172a', '#991b1b', '#1e3a8a', '#b45309', '#064e3b', '#581c87', '#ffffff'].map(c => (
                      <button
                        key={c}
                        onClick={() => updateSelectedField({ color: c })}
                        style={{
                          width: 24, height: 24, borderRadius: '50%', background: c,
                          border: `1.5px solid ${c === '#ffffff' ? 'var(--border)' : 'transparent'}`,
                          cursor: 'pointer', boxShadow: 'var(--shadow-sm)'
                        }}
                        title={c}
                        aria-label={`Select color swatch: ${c}`}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              // SIGNATURE LAYER CONTROLS
              <div>
                <label htmlFor="sig-width" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                  <span>Signature Scale Width</span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{(activeField as SignatureState).width}pt</span>
                </label>
                <input
                  id="sig-width"
                  type="range"
                  min={40}
                  max={250}
                  value={(activeField as SignatureState).width}
                  onChange={e => updateSelectedSignature({ width: parseInt(e.target.value) })}
                  style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--primary)' }}
                  aria-label="Adjust signature scale width"
                />
              </div>
            )}

            {/* Position Display Indicator */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Anchor Position</p>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                <span>Left: {activeField.x}%</span>
                <span>Top: {activeField.y}%</span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Layers size={32} style={{ opacity: 0.25, marginBottom: '0.5rem' }} />
            <p style={{ margin: 0, fontSize: '0.8125rem', lineHeight: 1.5 }}>
              Click on a text field or signature box in the preview to style and position it.
            </p>
          </div>
        )}

        {/* Save Current Coordinates Layout */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.625rem', marginTop: 'auto' }}>
          <h4 style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Save Preset Layout</h4>
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            <input
              type="text"
              value={newLayoutName}
              onChange={e => setNewLayoutName(e.target.value)}
              placeholder="e.g. Ornate Ribbon Gold"
              style={{
                flex: 1, padding: '0.45rem 0.625rem', fontSize: '0.8125rem',
                background: 'var(--surface-3)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xs)', color: 'var(--text-main)', outline: 'none'
              }}
              aria-label="New layout name"
            />
            <button
              onClick={saveCurrentLayout}
              disabled={!newLayoutName.trim()}
              className="btn-primary"
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              aria-label="Save layout configuration"
            >
              <Plus size={14} /> Save
            </button>
          </div>
        </div>
      </div>

      {/* ─── Global Progress/Processing Overlay ─── */}
      {isProcessing && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '1rem', zIndex: 9999
        }}>
          <div style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '2rem', display: 'flex',
            flexDirection: 'column', alignItems: 'center', gap: '1rem',
            width: '100%', maxWidth: 400, boxShadow: 'var(--shadow-lg)'
          }}>
            <Loader2 className="spinner" size={32} color="var(--primary)" />
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', textAlign: 'center' }}>
              {processingMessage}
            </h4>
            
            {progressPercent > 0 && (
              <div style={{ width: '100%', marginTop: '0.5rem' }}>
                <div style={{ background: 'var(--surface-3)', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${progressPercent}%`, background: 'var(--primary)', height: '100%', transition: 'width 200ms' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  <span>Progress</span>
                  <span>{progressPercent}%</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
