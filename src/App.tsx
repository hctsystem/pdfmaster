import { useState, useMemo, useEffect } from 'react';
import {
  BrowserRouter as Router, Routes, Route, Link
} from 'react-router-dom';
import {
  Minimize2, Combine, SplitSquareVertical, Lock,
  PenTool, Image as ImageIcon, FileText,
  ArrowLeft, ShieldCheck, Zap, Globe, RotateCw,
  Eye, ScanText, Edit3, Images, Menu, X,
  FileSearch, ChevronRight, Scissors, LayoutGrid,
  Wrench, Archive, Printer, Hash, Droplets, Unlock,
  EyeOff, Search, FileImage, FileX,
  FileOutput, Layers, Columns2, QrCode, Wifi, User, Camera,
  Sun, Moon
} from 'lucide-react';

import CompressorTool     from './components/CompressorTool';
import MergeTool          from './components/MergeTool';
import SplitTool          from './components/SplitTool';
import ProtectTool        from './components/ProtectTool';
import SignTool           from './components/SignTool';
import ImageToPdfTool     from './components/ImageToPdfTool';
import RotateTool         from './components/RotateTool';
import ExtractImagesTool  from './components/ExtractImagesTool';
import DocumentConverterTool from './components/DocumentConverterTool';
import PdfViewerTool      from './components/PdfViewerTool';
import OcrTool            from './components/OcrTool';
import EditPdfTool        from './components/EditPdfTool';
import RemovePagesTool    from './components/RemovePagesTool';
import ExtractPagesTool   from './components/ExtractPagesTool';
import OrganizeTool       from './components/OrganizeTool';
import RepairTool         from './components/RepairTool';
import PdfToJpgTool       from './components/PdfToJpgTool';
import PdfToPdfATool      from './components/PdfToPdfATool';
import HtmlToPdfTool      from './components/HtmlToPdfTool';
import AddPageNumbersTool from './components/AddPageNumbersTool';
import WatermarkTool      from './components/WatermarkTool';
import UnlockTool         from './components/UnlockTool';
import RedactTool         from './components/RedactTool';
import CompareTool        from './components/CompareTool';
import QrToolsPage       from './components/QrToolsPage';
import CertificateGeneratorTool from './components/CertificateGeneratorTool';
import DeveloperModal    from './components/DeveloperModal';

import './App.css';

// ─── Tool categories & definitions ───────────────────────────────
interface ToolDef {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  glow: string;
  bg: string;
  category: string;
  isNew?: boolean;
}

const ALL_TOOLS: ToolDef[] = [
  // Organize PDF
  {
    id: 'merge', title: 'Merge PDF',
    description: 'Combine multiple PDF files into one document.',
    icon: <Combine size={22} />, path: '/merge',
    color: '#3B82F6', glow: 'rgba(59,130,246,0.3)', bg: 'rgba(59,130,246,0.12)', category: 'Organize PDF',
  },
  {
    id: 'split', title: 'Split PDF',
    description: 'Separate pages or reorder your PDF document.',
    icon: <SplitSquareVertical size={22} />, path: '/split',
    color: '#8B5CF6', glow: 'rgba(139,92,246,0.3)', bg: 'rgba(139,92,246,0.12)', category: 'Organize PDF',
  },
  {
    id: 'remove-pages', title: 'Remove Pages',
    description: 'Delete specific pages from your PDF.',
    icon: <FileX size={22} />, path: '/remove-pages',
    color: '#EF4444', glow: 'rgba(239,68,68,0.3)', bg: 'rgba(239,68,68,0.12)', category: 'Organize PDF', isNew: true,
  },
  {
    id: 'extract-pages', title: 'Extract Pages',
    description: 'Pull out a page range into a new PDF file.',
    icon: <Scissors size={22} />, path: '/extract-pages',
    color: '#F97316', glow: 'rgba(249,115,22,0.3)', bg: 'rgba(249,115,22,0.12)', category: 'Organize PDF', isNew: true,
  },
  {
    id: 'organize', title: 'Organize PDF',
    description: 'Drag and drop to reorder pages in your PDF.',
    icon: <LayoutGrid size={22} />, path: '/organize',
    color: '#06B6D4', glow: 'rgba(6,182,212,0.3)', bg: 'rgba(6,182,212,0.12)', category: 'Organize PDF', isNew: true,
  },
  {
    id: 'rotate', title: 'Rotate PDF',
    description: 'Rotate PDF pages clockwise or counter-clockwise.',
    icon: <RotateCw size={22} />, path: '/rotate',
    color: '#14B8A6', glow: 'rgba(20,184,166,0.3)', bg: 'rgba(20,184,166,0.12)', category: 'Organize PDF',
  },

  // Optimize PDF
  {
    id: 'compress', title: 'Compress PDF',
    description: 'Reduce file size while preserving quality.',
    icon: <Minimize2 size={22} />, path: '/compress',
    color: '#F97316', glow: 'rgba(249,115,22,0.3)', bg: 'rgba(249,115,22,0.12)', category: 'Optimize PDF',
  },
  {
    id: 'repair', title: 'Repair PDF',
    description: 'Fix corrupted PDFs by re-parsing the structure.',
    icon: <Wrench size={22} />, path: '/repair',
    color: '#84CC16', glow: 'rgba(132,204,22,0.3)', bg: 'rgba(132,204,22,0.12)', category: 'Optimize PDF', isNew: true,
  },
  {
    id: 'ocr', title: 'OCR — Extract Text',
    description: 'Extract text from scanned PDFs and images.',
    icon: <ScanText size={22} />, path: '/ocr',
    color: '#A78BFA', glow: 'rgba(167,139,250,0.3)', bg: 'rgba(167,139,250,0.12)', category: 'Optimize PDF',
  },

  // Convert to PDF
  {
    id: 'image-to-pdf', title: 'JPG to PDF',
    description: 'Convert JPG, PNG, and WebP into high-quality PDFs.',
    icon: <ImageIcon size={22} />, path: '/image-to-pdf',
    color: '#22C55E', glow: 'rgba(34,197,94,0.3)', bg: 'rgba(34,197,94,0.12)', category: 'Convert to PDF',
  },
  {
    id: 'word-to-pdf', title: 'Word to PDF',
    description: 'High-fidelity conversion from .docx to .pdf.',
    icon: <FileText size={22} />, path: '/word-to-pdf',
    color: '#60A5FA', glow: 'rgba(96,165,250,0.3)', bg: 'rgba(96,165,250,0.12)', category: 'Convert to PDF',
  },
  {
    id: 'ppt-to-pdf', title: 'PowerPoint to PDF',
    description: 'Convert .pptx presentations to PDF format.',
    icon: <Layers size={22} />, path: '/ppt-to-pdf',
    color: '#F59E0B', glow: 'rgba(245,158,11,0.3)', bg: 'rgba(245,158,11,0.12)', category: 'Convert to PDF', isNew: true,
  },
  {
    id: 'excel-to-pdf', title: 'Excel to PDF',
    description: 'Convert .xlsx spreadsheets to PDF format.',
    icon: <Layers size={22} />, path: '/excel-to-pdf',
    color: '#10B981', glow: 'rgba(16,185,129,0.3)', bg: 'rgba(16,185,129,0.12)', category: 'Convert to PDF', isNew: true,
  },
  {
    id: 'html-to-pdf', title: 'HTML to PDF',
    description: 'Convert a web page or HTML code to PDF.',
    icon: <Printer size={22} />, path: '/html-to-pdf',
    color: '#EC4899', glow: 'rgba(236,72,153,0.3)', bg: 'rgba(236,72,153,0.12)', category: 'Convert to PDF', isNew: true,
  },

  // Convert from PDF
  {
    id: 'pdf-to-jpg', title: 'PDF to JPG',
    description: 'Convert each PDF page to a JPG image.',
    icon: <FileImage size={22} />, path: '/pdf-to-jpg',
    color: '#FBBF24', glow: 'rgba(251,191,36,0.3)', bg: 'rgba(251,191,36,0.12)', category: 'Convert from PDF', isNew: true,
  },
  {
    id: 'pdf-to-word', title: 'PDF to Word',
    description: 'Convert PDF documents to editable .docx files.',
    icon: <FileOutput size={22} />, path: '/pdf-to-word',
    color: '#60A5FA', glow: 'rgba(96,165,250,0.3)', bg: 'rgba(96,165,250,0.12)', category: 'Convert from PDF', isNew: true,
  },
  {
    id: 'pdf-to-ppt', title: 'PDF to PowerPoint',
    description: 'Convert PDF pages to .pptx presentation slides.',
    icon: <FileOutput size={22} />, path: '/pdf-to-ppt',
    color: '#F59E0B', glow: 'rgba(245,158,11,0.3)', bg: 'rgba(245,158,11,0.12)', category: 'Convert from PDF', isNew: true,
  },
  {
    id: 'pdf-to-excel', title: 'PDF to Excel',
    description: 'Extract tables from PDF into .xlsx spreadsheets.',
    icon: <FileOutput size={22} />, path: '/pdf-to-excel',
    color: '#10B981', glow: 'rgba(16,185,129,0.3)', bg: 'rgba(16,185,129,0.12)', category: 'Convert from PDF', isNew: true,
  },
  {
    id: 'pdf-to-pdfa', title: 'PDF to PDF/A',
    description: 'Convert PDF to the PDF/A archival standard.',
    icon: <Archive size={22} />, path: '/pdf-to-pdfa',
    color: '#818CF8', glow: 'rgba(129,140,248,0.3)', bg: 'rgba(129,140,248,0.12)', category: 'Convert from PDF', isNew: true,
  },

  // Edit PDF
  {
    id: 'edit-pdf', title: 'Edit PDF',
    description: 'Add text, highlights, and drawings on your PDF.',
    icon: <Edit3 size={22} />, path: '/edit-pdf',
    color: '#34D399', glow: 'rgba(52,211,153,0.3)', bg: 'rgba(52,211,153,0.12)', category: 'Edit PDF',
  },
  {
    id: 'add-page-numbers', title: 'Add Page Numbers',
    description: 'Stamp page numbers on every page of your PDF.',
    icon: <Hash size={22} />, path: '/add-page-numbers',
    color: '#A78BFA', glow: 'rgba(167,139,250,0.3)', bg: 'rgba(167,139,250,0.12)', category: 'Edit PDF', isNew: true,
  },
  {
    id: 'watermark', title: 'Add Watermark',
    description: 'Add a diagonal text watermark to all pages.',
    icon: <Droplets size={22} />, path: '/watermark',
    color: '#38BDF8', glow: 'rgba(56,189,248,0.3)', bg: 'rgba(56,189,248,0.12)', category: 'Edit PDF', isNew: true,
  },
  {
    id: 'extract-images', title: 'Extract Images',
    description: 'Pull all embedded images from a PDF into a ZIP.',
    icon: <Images size={22} />, path: '/extract-images',
    color: '#FBBF24', glow: 'rgba(251,191,36,0.3)', bg: 'rgba(251,191,36,0.12)', category: 'Edit PDF',
  },

  // PDF Viewer
  {
    id: 'viewer', title: 'PDF Viewer',
    description: 'Open and read PDF documents with page navigation.',
    icon: <Eye size={22} />, path: '/viewer',
    color: '#60A5FA', glow: 'rgba(96,165,250,0.3)', bg: 'rgba(96,165,250,0.12)', category: 'View & OCR',
  },

  // PDF Security
  {
    id: 'sign', title: 'Sign PDF',
    description: 'Draw a signature and drag it anywhere on the page.',
    icon: <PenTool size={22} />, path: '/sign',
    color: '#EC4899', glow: 'rgba(236,72,153,0.3)', bg: 'rgba(236,72,153,0.12)', category: 'PDF Security',
  },
  {
    id: 'protect', title: 'Protect PDF',
    description: 'Encrypt your PDF with a secure password.',
    icon: <Lock size={22} />, path: '/protect',
    color: '#EF4444', glow: 'rgba(239,68,68,0.3)', bg: 'rgba(239,68,68,0.12)', category: 'PDF Security',
  },
  {
    id: 'unlock', title: 'Unlock PDF',
    description: 'Remove password protection from a PDF.',
    icon: <Unlock size={22} />, path: '/unlock',
    color: '#F59E0B', glow: 'rgba(245,158,11,0.3)', bg: 'rgba(245,158,11,0.12)', category: 'PDF Security', isNew: true,
  },
  {
    id: 'redact', title: 'Redact PDF',
    description: 'Permanently black out sensitive content in your PDF.',
    icon: <EyeOff size={22} />, path: '/redact',
    color: '#6B7280', glow: 'rgba(107,114,128,0.3)', bg: 'rgba(107,114,128,0.12)', category: 'PDF Security', isNew: true,
  },
  {
    id: 'compare', title: 'Compare PDF',
    description: 'View two PDFs side-by-side to spot differences.',
    icon: <Columns2 size={22} />, path: '/compare',
    color: '#14B8A6', glow: 'rgba(20,184,166,0.3)', bg: 'rgba(20,184,166,0.12)', category: 'PDF Security', isNew: true,
  },
  {
    id: 'certificate', title: 'Certificate Generator',
    description: 'Upload templates, drag-and-drop fields, and export A4 landscape PDFs or batch generate from CSV.',
    icon: <FileText size={22} />, path: '/certificate',
    color: '#0EA5E9', glow: 'rgba(14,165,233,0.3)', bg: 'rgba(14,165,233,0.12)', category: 'Edit PDF', isNew: true,
  },
];

const CATEGORIES = [
  'All', 'Organize PDF', 'Optimize PDF', 'Convert to PDF',
  'Convert from PDF', 'Edit PDF', 'PDF Security', 'View & OCR',
];

// ─── Navbar ───────────────────────────────────────────────────────
function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return 'dark'; // default
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  };

  return (
    <>
      <nav className="navbar" role="navigation" aria-label="Main navigation">
        <Link to="/" className="navbar-logo" aria-label="PDFMaster Home">
          <div className="navbar-logo-icon" aria-hidden="true">
            <FileSearch size={18} color="white" />
          </div>
          <span><b>PDF</b>Master</span>
        </Link>
        <div className="navbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link
            to="/certificate"
            className="navbar-link-shortcut"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.4rem 0.875rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              fontSize: '0.8125rem',
              fontWeight: 700,
              transition: 'all 150ms'
            }}
            aria-label="Open Certificate Generator"
          >
            <FileText size={14} color="#0EA5E9" />
            <span className="navbar-shortcut-text">Cert Generator</span>
          </Link>

          <Link
            to="/qr"
            className="navbar-link-shortcut"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.4rem 0.875rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              fontSize: '0.8125rem',
              fontWeight: 700,
              transition: 'all 150ms'
            }}
            aria-label="Open QR Code Tools"
          >
            <QrCode size={14} color="#7C3AED" />
            <span className="navbar-shortcut-text">QR Tools</span>
          </Link>

          <button
            onClick={toggleTheme}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.5rem',
              borderRadius: 'var(--radius-sm)',
              transition: 'background var(--transition)',
            }}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <span className="navbar-badge">● Local</span>
          <button
            className="hamburger"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(v => !v)}
          >
            {mobileOpen ? <X size={20} color="var(--text-secondary)" /> : <Menu size={20} color="var(--text-secondary)" />}
          </button>
        </div>
      </nav>
      {mobileOpen && (
        <div
          className="modal-overlay"
          onClick={() => setMobileOpen(false)}
          style={{ alignItems: 'flex-start', paddingTop: '80px' }}
        >
          <div
            className="glass-card"
            style={{ width: '100%', maxWidth: 360, padding: '1rem', borderRadius: 'var(--radius)', animation: 'slideUp 200ms ease', maxHeight: '70vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            {ALL_TOOLS.slice(0, 8).map(tool => (
              <Link
                key={tool.id}
                to={tool.path}
                onClick={() => setMobileOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.875rem 1rem', borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-secondary)', textDecoration: 'none',
                  fontSize: '0.9rem', fontWeight: 600,
                  transition: 'background var(--transition)',
                }}
              >
                <span style={{ color: tool.color }}>{tool.icon}</span>
                {tool.title}
              </Link>
            ))}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
              <Link
                to="/"
                onClick={() => setMobileOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '0.5rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)',
                  background: 'var(--primary)', color: 'white',
                  textDecoration: 'none', fontSize: '0.875rem', fontWeight: 700
                }}
              >
                View All Tools <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Home Page ────────────────────────────────────────────────────
function Home() {
  const [search, setSearch]     = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = useMemo(() => {
    return ALL_TOOLS.filter(t => {
      const matchesSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
      const matchesCat    = activeCategory === 'All' || t.category === activeCategory;
      return matchesSearch && matchesCat;
    });
  }, [search, activeCategory]);

  // Group tools by category (in display order)
  const grouped = useMemo(() => {
    if (activeCategory !== 'All' || search) return { [activeCategory || 'Results']: filtered };
    const groups: Record<string, ToolDef[]> = {};
    for (const t of filtered) {
      if (!groups[t.category]) groups[t.category] = [];
      groups[t.category].push(t);
    }
    return groups;
  }, [filtered, activeCategory, search]);

  return (
    <div className="page-wrapper">
      {/* Hero */}
      <section className="hero-section" aria-labelledby="hero-heading">
        <div className="hero-bg" aria-hidden="true" />
        <div className="hero-eyebrow" aria-label="All files processed locally">
          <ShieldCheck size={14} aria-hidden="true" />
          100% Private · No Upload Required
        </div>
        <h1 className="hero-title" id="hero-heading">
          Professional PDF Tools<br />
          <span className="hero-title-accent">Right in Your Browser</span>
        </h1>
        <p className="hero-subtitle">
          30+ tools to compress, merge, split, convert, sign, protect, edit and OCR your PDFs — all processed locally on your device.
        </p>
        <div className="hero-badges" role="list">
          <div className="hero-badge" role="listitem"><Zap size={14} aria-hidden="true" /> Lightning Fast</div>
          <div className="hero-badge" role="listitem"><ShieldCheck size={14} aria-hidden="true" /> Zero Upload</div>
          <div className="hero-badge" role="listitem"><Globe size={14} aria-hidden="true" /> Open Source</div>
          <div className="hero-badge" role="listitem"><ScanText size={14} aria-hidden="true" /> AI OCR Built In</div>
        </div>
      </section>

      {/* Search + Filter */}
      <div className="tools-search-bar-wrapper">
        <div className="tools-search-bar">
          <Search size={18} className="tools-search-icon" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search tools…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="tools-search-input"
            aria-label="Search PDF tools"
            id="tool-search"
          />
        </div>
        <div className="tools-category-chips" role="tablist" aria-label="Filter tools by category">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`category-chip ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
              role="tab"
              aria-selected={activeCategory === cat}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Tool Grid — grouped by category */}
      <main className="tools-section">
        {Object.entries(grouped).map(([cat, tools]) => (
          tools.length > 0 && (
            <div key={cat} className="category-section">
              {(activeCategory === 'All' && !search) && (
                <div className="category-section-header">
                  <h2 className="category-section-title">{cat}</h2>
                  <span className="category-section-count">{tools.length} tools</span>
                </div>
              )}
              <div className="tool-grid" role="list">
                {tools.map(tool => (
                  <Link
                    key={tool.id}
                    to={tool.path}
                    className="tool-card"
                    role="listitem"
                    aria-label={`${tool.title}: ${tool.description}`}
                  >
                    <div
                      className="tool-card-icon"
                      aria-hidden="true"
                      style={{ background: tool.bg, color: tool.color, boxShadow: `0 4px 16px ${tool.glow}` }}
                    >
                      {tool.icon}
                    </div>
                    <div className="tool-card-body">
                      <h3>{tool.title}</h3>
                      <p>{tool.description}</p>
                    </div>
                    <div className="tool-card-footer">
                      {tool.isNew
                        ? <span className="tag-new">New</span>
                        : <span className="tag-private">Local</span>
                      }
                      <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
            <Search size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
            <p>No tools found for "<strong style={{ color: 'var(--text-secondary)' }}>{search}</strong>"</p>
          </div>
        )}
      </main>

      {/* Side-by-side Promos Grid */}
      <section style={{ padding: '0 1.5rem 3rem', maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '1.5rem' }}>
        {/* QR Code Tools Promo Section */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(59,130,246,0.12) 100%)',
          border: '1px solid rgba(124,58,237,0.25)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          flexWrap: 'wrap',
          boxSizing: 'border-box'
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 'var(--radius)',
            background: 'linear-gradient(135deg, #7C3AED, #3B82F6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: '0 8px 24px rgba(124,58,237,0.4)',
          }} aria-hidden="true">
            <QrCode size={26} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-main)' }}>QR Code Tools</h2>
              <span style={{ background: 'linear-gradient(135deg, #7C3AED, #3B82F6)', color: '#fff', fontSize: '0.6875rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 999, letterSpacing: '0.04em' }}>NEW</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Generate, customize and scan QR codes — URL, WiFi, contacts, and more. Plus a live camera scanner.
            </p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              {[
                { icon: <QrCode size={12} />, label: 'Generate QR' },
                { icon: <Wifi size={12} />, label: 'WiFi QR' },
                { icon: <User size={12} />, label: 'vCard QR' },
                { icon: <Camera size={12} />, label: 'Camera Scan' },
              ].map(f => (
                <span key={f.label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <span style={{ color: '#7C3AED' }}>{f.icon}</span>{f.label}
                </span>
              ))}
            </div>
          </div>
          <Link
            to="/qr"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.6rem 1.2rem',
              background: 'linear-gradient(135deg, #7C3AED, #3B82F6)',
              color: 'white', borderRadius: 'var(--radius-sm)',
              textDecoration: 'none', fontWeight: 700, fontSize: '0.875rem',
              boxShadow: '0 4px 16px rgba(124,58,237,0.35)',
              transition: 'all 150ms', whiteSpace: 'nowrap', flexShrink: 0,
            }}
            aria-label="Open QR Code Tools"
          >
            Open QR Tools <ChevronRight size={14} />
          </Link>
        </div>

        {/* Certificate Generator Promo Section */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(14,165,233,0.12) 0%, rgba(59,130,246,0.12) 100%)',
          border: '1px solid rgba(14,165,233,0.25)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          flexWrap: 'wrap',
          boxSizing: 'border-box'
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 'var(--radius)',
            background: 'linear-gradient(135deg, #0EA5E9, #3B82F6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: '0 8px 24px rgba(14,165,233,0.4)',
          }} aria-hidden="true">
            <FileText size={26} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-main)' }}>Certificate Generator</h2>
              <span style={{ background: 'linear-gradient(135deg, #0EA5E9, #3B82F6)', color: '#fff', fontSize: '0.6875rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 999, letterSpacing: '0.04em' }}>NEW</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Upload templates, drag-and-drop text/signatures, and export 300 DPI landscape PDFs or batch generate from CSV.
            </p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              {[
                { icon: <FileText size={12} />, label: 'Drag & Drop Positioning' },
                { icon: <Edit3 size={12} />, label: 'Typography Customizer' },
                { icon: <Layers size={12} />, label: 'CSV Batch Mode' },
              ].map(f => (
                <span key={f.label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <span style={{ color: '#0EA5E9' }}>{f.icon}</span>{f.label}
                </span>
              ))}
            </div>
          </div>
          <Link
            to="/certificate"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.6rem 1.2rem',
              background: 'linear-gradient(135deg, #0EA5E9, #3B82F6)',
              color: 'white', borderRadius: 'var(--radius-sm)',
              textDecoration: 'none', fontWeight: 700, fontSize: '0.875rem',
              boxShadow: '0 4px 16px rgba(14,165,233,0.35)',
              transition: 'all 150ms', whiteSpace: 'nowrap', flexShrink: 0,
            }}
            aria-label="Open Certificate Generator"
          >
            Open Cert Tools <ChevronRight size={14} />
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="features-section" aria-labelledby="features-heading">
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon" aria-hidden="true"><ShieldCheck size={22} /></div>
            <h3 id="features-heading">Secure &amp; Private</h3>
            <p>Client-side processing means your files never leave your computer. No server uploads, no privacy risks.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon" aria-hidden="true"><Zap size={22} /></div>
            <h3>Lightning Fast</h3>
            <p>Parallel processing and zero upload wait times make PDFMaster the fastest document toolkit available.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon" aria-hidden="true"><Globe size={22} /></div>
            <h3>Open Source Power</h3>
            <p>Built with pdf-lib, Tesseract.js, pdfjs-dist and other world-class open source libraries.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          textAlign: 'center',
          padding: '2.5rem 1.5rem 3rem',
          borderTop: '1px solid var(--border)',
          marginTop: '2rem',
        }}
        role="contentinfo"
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: 32, height: 32,
                background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              aria-hidden="true"
            >
              <FileSearch size={16} color="white" />
            </div>
            <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>
              <b>PDF</b>Master
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 480 }}>
            A professional browser-based PDF toolkit. All processing happens locally on your device — zero uploads, maximum privacy.
          </p>
          <div
            onClick={() => window.dispatchEvent(new CustomEvent('open-dev-modal', { detail: 'about' }))}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 1.25rem',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 999,
              fontSize: '0.8125rem',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'background var(--transition)'
            }}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && window.dispatchEvent(new CustomEvent('open-dev-modal', { detail: 'about' }))}
          >
            <span aria-hidden="true">&#9998;</span>
            Developed by{' '}
            <strong style={{ color: 'var(--primary)' }}>Harold Calo Trinidad</strong>
          </div>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8125rem', marginTop: '0.5rem' }}>
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('open-dev-modal', { detail: 'about' }))}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}
            >
              About &amp; Donate
            </button>
            <span style={{ color: 'var(--border)' }}>•</span>
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('open-dev-modal', { detail: 'changelog' }))}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}
            >
              Changelog
            </button>
            <span style={{ color: 'var(--border)' }}>•</span>
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('open-dev-modal', { detail: 'bug' }))}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}
            >
              Report a Bug
            </button>
            <span style={{ color: 'var(--border)' }}>•</span>
            <Link
              to="/qr"
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', textDecoration: 'none', fontSize: '0.8125rem' }}
            >
              QR Code Tools
            </Link>
            <span style={{ color: 'var(--border)' }}>•</span>
            <Link
              to="/certificate"
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', textDecoration: 'none', fontSize: '0.8125rem' }}
            >
              Certificate Generator
            </Link>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            &copy; {new Date().getFullYear()} PDFMaster. Built with React, pdf-lib, Tesseract.js &amp; pdfjs-dist.
          </p>
        </div>
      </footer>
    </div>
  );
}

// ─── Tool Wrapper ─────────────────────────────────────────────────
function ToolWrapper({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="tool-page-wrapper">
      <div className="tool-page-container">
        <div className="tool-page-header">
          <Link to="/" className="back-link" aria-label="Back to Dashboard">
            <ArrowLeft size={16} aria-hidden="true" />
            Dashboard
          </Link>
          <h1 className="tool-page-title">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── App Router ───────────────────────────────────────────────────
export default function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/"                  element={<Home />} />
        {/* Viewer & OCR */}
        <Route path="/viewer"            element={<ToolWrapper title="PDF Viewer"><PdfViewerTool /></ToolWrapper>} />
        <Route path="/ocr"               element={<ToolWrapper title="OCR — Extract Text"><OcrTool /></ToolWrapper>} />
        {/* Organize */}
        <Route path="/merge"             element={<ToolWrapper title="Merge PDF"><MergeTool /></ToolWrapper>} />
        <Route path="/split"             element={<ToolWrapper title="Split PDF"><SplitTool /></ToolWrapper>} />
        <Route path="/remove-pages"      element={<ToolWrapper title="Remove Pages"><RemovePagesTool /></ToolWrapper>} />
        <Route path="/extract-pages"     element={<ToolWrapper title="Extract Pages"><ExtractPagesTool /></ToolWrapper>} />
        <Route path="/organize"          element={<ToolWrapper title="Organize PDF"><OrganizeTool /></ToolWrapper>} />
        <Route path="/rotate"            element={<ToolWrapper title="Rotate PDF"><RotateTool /></ToolWrapper>} />
        {/* Optimize */}
        <Route path="/compress"          element={<ToolWrapper title="Compress PDF & Images"><CompressorTool /></ToolWrapper>} />
        <Route path="/repair"            element={<ToolWrapper title="Repair PDF"><RepairTool /></ToolWrapper>} />
        {/* Convert to PDF */}
        <Route path="/image-to-pdf"      element={<ToolWrapper title="JPG to PDF"><ImageToPdfTool /></ToolWrapper>} />
        <Route path="/word-to-pdf"       element={<ToolWrapper title="Word to PDF"><DocumentConverterTool fromName="Word" toName="PDF" endpoint="word-to-pdf" accept=".doc,.docx" acceptDescription="Supports .doc and .docx files" /></ToolWrapper>} />
        <Route path="/ppt-to-pdf"        element={<ToolWrapper title="PowerPoint to PDF"><DocumentConverterTool fromName="PowerPoint" toName="PDF" endpoint="ppt-to-pdf" accept=".ppt,.pptx" acceptDescription="Supports .ppt and .pptx files" /></ToolWrapper>} />
        <Route path="/excel-to-pdf"      element={<ToolWrapper title="Excel to PDF"><DocumentConverterTool fromName="Excel" toName="PDF" endpoint="excel-to-pdf" accept=".xls,.xlsx" acceptDescription="Supports .xls and .xlsx files" /></ToolWrapper>} />
        <Route path="/html-to-pdf"       element={<ToolWrapper title="HTML to PDF"><HtmlToPdfTool /></ToolWrapper>} />
        {/* Convert from PDF */}
        <Route path="/pdf-to-jpg"        element={<ToolWrapper title="PDF to JPG"><PdfToJpgTool /></ToolWrapper>} />
        <Route path="/pdf-to-word"       element={<ToolWrapper title="PDF to Word"><DocumentConverterTool fromName="PDF" toName="Word" endpoint="pdf-to-word" accept=".pdf" acceptDescription="Upload a PDF file to convert to editable Word (.docx) document" /></ToolWrapper>} />
        <Route path="/pdf-to-ppt"        element={<ToolWrapper title="PDF to PowerPoint"><DocumentConverterTool fromName="PDF" toName="PowerPoint" endpoint="pdf-to-ppt" accept=".pdf" acceptDescription="Upload a PDF file to convert to PowerPoint (.pptx) slides" /></ToolWrapper>} />
        <Route path="/pdf-to-excel"      element={<ToolWrapper title="PDF to Excel"><DocumentConverterTool fromName="PDF" toName="Excel" endpoint="pdf-to-excel" accept=".pdf" acceptDescription="Upload a PDF file to convert tables to Excel (.xlsx) spreadsheet" /></ToolWrapper>} />
        <Route path="/pdf-to-pdfa"       element={<ToolWrapper title="PDF to PDF/A"><PdfToPdfATool /></ToolWrapper>} />
        {/* Edit PDF */}
        <Route path="/edit-pdf"          element={<ToolWrapper title="Edit PDF"><EditPdfTool /></ToolWrapper>} />
        <Route path="/add-page-numbers"  element={<ToolWrapper title="Add Page Numbers"><AddPageNumbersTool /></ToolWrapper>} />
        <Route path="/watermark"         element={<ToolWrapper title="Add Watermark"><WatermarkTool /></ToolWrapper>} />
        <Route path="/extract-images"    element={<ToolWrapper title="Extract Images"><ExtractImagesTool /></ToolWrapper>} />
        {/* Security */}
        <Route path="/sign"              element={<ToolWrapper title="Sign PDF"><SignTool /></ToolWrapper>} />
        <Route path="/protect"           element={<ToolWrapper title="Protect PDF"><ProtectTool /></ToolWrapper>} />
        <Route path="/unlock"            element={<ToolWrapper title="Unlock PDF"><UnlockTool /></ToolWrapper>} />
        <Route path="/redact"            element={<ToolWrapper title="Redact PDF"><RedactTool /></ToolWrapper>} />
        <Route path="/compare"           element={<ToolWrapper title="Compare PDF"><CompareTool /></ToolWrapper>} />
        {/* QR Code Tools */}
        <Route path="/qr"                element={<ToolWrapper title="QR Code Tools"><QrToolsPage /></ToolWrapper>} />
        {/* Certificate Generator */}
        <Route path="/certificate"       element={<ToolWrapper title="Stock Certificate Generator"><CertificateGeneratorTool /></ToolWrapper>} />
        <Route path="*"                  element={<Home />} />
      </Routes>
      <DeveloperModal />
    </Router>
  );
}
