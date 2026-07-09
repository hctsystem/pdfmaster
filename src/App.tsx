import { useState } from 'react';
import {
  BrowserRouter as Router, Routes, Route, Link
} from 'react-router-dom';
import {
  Minimize2, Combine, SplitSquareVertical, Lock,
  PenTool, Image as ImageIcon, FileText,
  ArrowLeft, ShieldCheck, Zap, Globe, RotateCw,
  Eye, ScanText, Edit3, Images, Menu, X,
  FileSearch, ChevronRight
} from 'lucide-react';

import CompressorTool from './components/CompressorTool';
import MergeTool from './components/MergeTool';
import SplitTool from './components/SplitTool';
import ProtectTool from './components/ProtectTool';
import SignTool from './components/SignTool';
import ImageToPdfTool from './components/ImageToPdfTool';
import RotateTool from './components/RotateTool';
import ExtractImagesTool from './components/ExtractImagesTool';
import WordToPdfTool from './components/WordToPdfTool';
import PdfViewerTool from './components/PdfViewerTool';
import OcrTool from './components/OcrTool';
import EditPdfTool from './components/EditPdfTool';

import './App.css';

// ─── Tool color themes ───────────────────────────────────────────
const toolColors: Record<string, { bg: string; color: string; glow: string }> = {
  compress:      { bg: 'rgba(249,115,22,0.12)',  color: '#F97316', glow: 'rgba(249,115,22,0.3)' },
  merge:         { bg: 'rgba(59,130,246,0.12)',  color: '#3B82F6', glow: 'rgba(59,130,246,0.3)' },
  split:         { bg: 'rgba(139,92,246,0.12)',  color: '#8B5CF6', glow: 'rgba(139,92,246,0.3)' },
  rotate:        { bg: 'rgba(20,184,166,0.12)',  color: '#14B8A6', glow: 'rgba(20,184,166,0.3)' },
  sign:          { bg: 'rgba(236,72,153,0.12)',  color: '#EC4899', glow: 'rgba(236,72,153,0.3)' },
  protect:       { bg: 'rgba(239,68,68,0.12)',   color: '#EF4444', glow: 'rgba(239,68,68,0.3)'  },
  'image-to-pdf':{ bg: 'rgba(34,197,94,0.12)',   color: '#22C55E', glow: 'rgba(34,197,94,0.3)'  },
  'word-to-pdf': { bg: 'rgba(59,130,246,0.12)',  color: '#60A5FA', glow: 'rgba(96,165,250,0.3)' },
  'extract-images':{ bg: 'rgba(251,191,36,0.12)',color: '#FBBF24', glow: 'rgba(251,191,36,0.3)' },
  viewer:        { bg: 'rgba(96,165,250,0.12)',  color: '#60A5FA', glow: 'rgba(96,165,250,0.3)' },
  ocr:           { bg: 'rgba(167,139,250,0.12)', color: '#A78BFA', glow: 'rgba(167,139,250,0.3)'},
  'edit-pdf':    { bg: 'rgba(52,211,153,0.12)',  color: '#34D399', glow: 'rgba(52,211,153,0.3)' },
};

// ─── Tool definitions ─────────────────────────────────────────────
const tools = [
  {
    id: 'viewer',
    title: 'PDF Viewer',
    description: 'Open and read PDF documents with page navigation and zoom.',
    icon: <Eye size={22} />,
    path: '/viewer',
    isPrivate: true,
    isNew: true,
  },
  {
    id: 'edit-pdf',
    title: 'Edit PDF',
    description: 'Add text, highlights, and freehand drawings directly on your PDF.',
    icon: <Edit3 size={22} />,
    path: '/edit-pdf',
    isPrivate: true,
    isNew: true,
  },
  {
    id: 'ocr',
    title: 'OCR — Extract Text',
    description: 'Extract text from scanned images & multi-page PDFs. Export as .txt or searchable PDF.',
    icon: <ScanText size={22} />,
    path: '/ocr',
    isPrivate: true,
    isNew: true,
  },
  {
    id: 'compress',
    title: 'Compress PDF & Images',
    description: 'Reduce file size while preserving quality.',
    icon: <Minimize2 size={22} />,
    path: '/compress',
    isPrivate: true,
  },
  {
    id: 'merge',
    title: 'Merge PDF',
    description: 'Combine multiple PDF files into one document.',
    icon: <Combine size={22} />,
    path: '/merge',
    isPrivate: true,
  },
  {
    id: 'split',
    title: 'Split & Organize',
    description: 'Separate pages or reorder your PDF document.',
    icon: <SplitSquareVertical size={22} />,
    path: '/split',
    isPrivate: true,
  },
  {
    id: 'rotate',
    title: 'Rotate PDF',
    description: 'Rotate PDF pages clockwise or counter-clockwise.',
    icon: <RotateCw size={22} />,
    path: '/rotate',
    isPrivate: true,
  },
  {
    id: 'sign',
    title: 'Sign PDF',
    description: 'Draw or upload a signature and stamp your PDF.',
    icon: <PenTool size={22} />,
    path: '/sign',
    isPrivate: true,
  },
  {
    id: 'protect',
    title: 'Protect PDF',
    description: 'Encrypt your PDF with a secure password.',
    icon: <Lock size={22} />,
    path: '/protect',
    isPrivate: true,
  },
  {
    id: 'image-to-pdf',
    title: 'Image to PDF',
    description: 'Convert JPG, PNG, and WebP into high-quality PDFs.',
    icon: <ImageIcon size={22} />,
    path: '/image-to-pdf',
    isPrivate: true,
  },
  {
    id: 'extract-images',
    title: 'Extract Images',
    description: 'Pull all embedded images from a PDF into a ZIP.',
    icon: <Images size={22} />,
    path: '/extract-images',
    isPrivate: true,
  },
  {
    id: 'word-to-pdf',
    title: 'Word to PDF',
    description: 'High-fidelity conversion from .docx to .pdf.',
    icon: <FileText size={22} />,
    path: '/word-to-pdf',
    isPrivate: false,
  },
];

// ─── Navbar ───────────────────────────────────────────────────────
function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <>
      <nav className="navbar" role="navigation" aria-label="Main navigation">
        <Link to="/" className="navbar-logo" aria-label="PDFMaster Home">
          <div className="navbar-logo-icon" aria-hidden="true">
            <FileSearch size={18} color="white" />
          </div>
          <span><b>PDF</b>Master</span>
        </Link>
        <div className="navbar-actions">
          <span className="navbar-badge">● Local Processing</span>
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
      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="modal-overlay"
          onClick={() => setMobileOpen(false)}
          style={{ alignItems: 'flex-start', paddingTop: '80px' }}
        >
          <div
            className="glass-card"
            style={{ width: '100%', maxWidth: 360, padding: '1rem', borderRadius: 'var(--radius)', animation: 'slideUp 200ms ease' }}
            onClick={e => e.stopPropagation()}
          >
            {tools.slice(0, 6).map(tool => (
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
                <span style={{ color: toolColors[tool.id]?.color }}>{tool.icon}</span>
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
          Compress, merge, split, sign, protect, edit PDFs and extract text with OCR — all processed locally on your device.
        </p>
        <div className="hero-badges" role="list">
          <div className="hero-badge" role="listitem"><Zap size={14} aria-hidden="true" /> Lightning Fast</div>
          <div className="hero-badge" role="listitem"><ShieldCheck size={14} aria-hidden="true" /> Zero Upload</div>
          <div className="hero-badge" role="listitem"><Globe size={14} aria-hidden="true" /> Open Source</div>
          <div className="hero-badge" role="listitem"><ScanText size={14} aria-hidden="true" /> AI OCR Built In</div>
        </div>
      </section>

      {/* Tool Grid */}
      <main className="tools-section">
        <div className="section-header">
          <p className="section-label">All Tools</p>
          <h2 className="section-title">Everything you need for PDFs</h2>
        </div>
        <div className="tool-grid" role="list">
          {tools.map(tool => {
            const theme = toolColors[tool.id] || { bg: 'var(--surface-2)', color: 'var(--primary)', glow: '' };
            return (
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
                  style={{ background: theme.bg, color: theme.color, boxShadow: `0 4px 16px ${theme.glow}` }}
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
                    : tool.isPrivate
                      ? <span className="tag-private">Local</span>
                      : <span className="tag-cloud">Cloud</span>
                  }
                  <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                </div>
              </Link>
            );
          })}
        </div>
      </main>

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
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 1.25rem',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 999,
              fontSize: '0.8125rem',
              color: 'var(--text-secondary)',
            }}
          >
            <span aria-hidden="true">&#9998;</span>
            Developed by{' '}
            <strong style={{ color: 'var(--primary)' }}>Harold Trinidad</strong>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
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
        <Route path="/"              element={<Home />} />
        <Route path="/viewer"        element={<ToolWrapper title="PDF Viewer"><PdfViewerTool /></ToolWrapper>} />
        <Route path="/edit-pdf"      element={<ToolWrapper title="Edit PDF"><EditPdfTool /></ToolWrapper>} />
        <Route path="/ocr"           element={<ToolWrapper title="OCR — Extract Text"><OcrTool /></ToolWrapper>} />
        <Route path="/compress"      element={<ToolWrapper title="Compress PDF & Images"><CompressorTool /></ToolWrapper>} />
        <Route path="/merge"         element={<ToolWrapper title="Merge PDF"><MergeTool /></ToolWrapper>} />
        <Route path="/split"         element={<ToolWrapper title="Split & Organize"><SplitTool /></ToolWrapper>} />
        <Route path="/protect"       element={<ToolWrapper title="Protect PDF"><ProtectTool /></ToolWrapper>} />
        <Route path="/sign"          element={<ToolWrapper title="Sign PDF"><SignTool /></ToolWrapper>} />
        <Route path="/image-to-pdf"  element={<ToolWrapper title="Image to PDF"><ImageToPdfTool /></ToolWrapper>} />
        <Route path="/extract-images"element={<ToolWrapper title="Extract Images"><ExtractImagesTool /></ToolWrapper>} />
        <Route path="/rotate"        element={<ToolWrapper title="Rotate PDF"><RotateTool /></ToolWrapper>} />
        <Route path="/word-to-pdf"   element={<ToolWrapper title="Word to PDF"><WordToPdfTool /></ToolWrapper>} />
        <Route path="*"              element={<Home />} />
      </Routes>
    </Router>
  );
}
