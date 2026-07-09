import { useState, useEffect } from 'react';
import { Heart, Sparkles, Bug, ExternalLink, Mail, X, CheckSquare, Square } from 'lucide-react';

type TabType = 'about' | 'changelog' | 'bug';

export default function DeveloperModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('about');
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Bug report form state
  const [bugEmail, setBugEmail] = useState('');
  const [bugDesc, setBugDesc] = useState('');
  const [bugSteps, setBugSteps] = useState('');

  useEffect(() => {
    // Check localStorage for "don't show again" preference on mount
    const isHidden = localStorage.getItem('pdfmaster_hide_dev_modal');
    if (!isHidden) {
      // Show modal on first load after a short delay
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Listen to custom event to open the modal from anywhere in the app
  useEffect(() => {
    const handleOpenModal = (e: Event) => {
      const customEvent = e as CustomEvent<TabType>;
      if (customEvent.detail) {
        setActiveTab(customEvent.detail);
      }
      setIsOpen(true);
    };

    window.addEventListener('open-dev-modal', handleOpenModal);
    return () => window.removeEventListener('open-dev-modal', handleOpenModal);
  }, []);

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('pdfmaster_hide_dev_modal', 'true');
    }
    setIsOpen(false);
  };

  const handleDontShowToggle = () => {
    setDontShowAgain(!dontShowAgain);
  };

  // Submit bug report via mailto link
  const submitBugViaEmail = () => {
    const subject = encodeURIComponent('[PDFMaster Bug Report]');
    const body = encodeURIComponent(
      `Email: ${bugEmail}\n\nDescription of the bug:\n${bugDesc}\n\nSteps to reproduce:\n${bugSteps}\n\n---\nSent from PDFMaster Client`
    );
    window.location.href = `mailto:haroldcalotrinidad@gmail.com?subject=${subject}&body=${body}`;
  };

  // Create GitHub issue
  const openGithubIssue = () => {
    const title = encodeURIComponent('Bug Report: [Short description]');
    const body = encodeURIComponent(
      `### Bug Description\n${bugDesc}\n\n### Steps to Reproduce\n${bugSteps}\n\n---\n*Reported via PDFMaster App*`
    );
    window.open(`https://github.com/hctsystem/pdfmaster/issues/new?title=${title}&body=${body}`, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 100 }} role="dialog" aria-modal="true">
      <div 
        className="modal-content glass-card" 
        style={{ 
          maxWidth: 620, 
          width: '95%',
          display: 'flex', 
          flexDirection: 'column',
          maxHeight: '90vh',
          padding: 0,
          border: '1px solid var(--border)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={18} color="var(--primary)" />
            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>PDFMaster Info & Updates</h3>
          </div>
          <button className="btn-icon" onClick={handleClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div 
          style={{ 
            display: 'flex', 
            background: 'rgba(0,0,0,0.2)', 
            padding: '0.25rem 0.5rem',
            borderBottom: '1px solid var(--border)' 
          }}
        >
          {(['about', 'changelog', 'bug'] as TabType[]).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: 'none',
                background: 'none',
                color: activeTab === t ? 'var(--text-main)' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                borderBottom: activeTab === t ? '2px solid var(--primary)' : '2px solid transparent',
                transition: 'all var(--transition-fast)'
              }}
            >
              {t === 'about' && 'About & Donate'}
              {t === 'changelog' && 'Update Logs'}
              {t === 'bug' && 'Report a Bug'}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {/* TAB 1: ABOUT & DONATE */}
          {activeTab === 'about' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div 
                  style={{ 
                    width: 64, height: 64, 
                    borderRadius: '50%', 
                    background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.5rem', fontWeight: 800, color: 'white',
                    boxShadow: 'var(--glow)'
                  }}
                >
                  HT
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)' }}>Harold Calo Trinidad</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>Creator & Full Stack Developer</p>
                </div>
              </div>

              <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                Hi there! I created <strong>PDFMaster</strong> to give everyone a secure, private, and lightning-fast way to edit and manage PDF documents right in the browser. All core operations run locally on your device — your sensitive files are never uploaded to any server.
              </p>

              {/* Donation / GCash box */}
              <div 
                style={{ 
                  background: 'rgba(59,130,246,0.05)',
                  border: '1px solid rgba(59,130,246,0.15)',
                  borderRadius: 'var(--radius)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textAlign: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--secondary)' }}>
                  <Heart size={16} fill="var(--secondary)" />
                  <strong style={{ fontSize: '0.9rem' }}>Support the Project via GCash</strong>
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0, maxWidth: 440 }}>
                  This application is 100% free and open-source. If it helped you save time or work securely, donations of any amount are highly appreciated to help keep the server conversions active!
                </p>
                
                {/* GCash QR Image container */}
                <div 
                  style={{ 
                    background: 'white', 
                    padding: '0.5rem', 
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    marginTop: '0.5rem',
                    width: 180,
                    height: 180,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    position: 'relative'
                  }}
                >
                  <img 
                    src="/gcashqr.jpg" 
                    alt="GCash QR Code" 
                    onError={(e) => {
                      // Fallback placeholder if image not uploaded yet
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        const placeholder = document.createElement('div');
                        placeholder.style.color = '#374151';
                        placeholder.style.fontSize = '0.75rem';
                        placeholder.style.textAlign = 'center';
                        placeholder.style.padding = '1rem';
                        placeholder.innerHTML = '<strong>[GCash QR Placeholder]</strong><br/>Upload gcashqr.jpg to your public folder';
                        parent.appendChild(placeholder);
                      }
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: UPDATE LOGS */}
          {activeTab === 'changelog' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ borderLeft: '2px solid var(--primary)', paddingLeft: '1.25rem', position: 'relative' }}>
                <div style={{ position: 'absolute', left: -7, top: 4, width: 12, height: 12, borderRadius: '50%', background: 'var(--primary)', boxShadow: 'var(--glow)' }} />
                <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)' }}>
                  v1.1.0 — New Tools & Overhaul
                  <span style={{ fontSize: '0.75rem', color: 'var(--primary)', background: 'var(--primary-glow)', padding: '0.15rem 0.5rem', borderRadius: 100, marginLeft: '0.75rem', fontWeight: 600 }}>Latest</span>
                </h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0.5rem' }}>Released: July 2026</p>
                <ul style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', paddingLeft: '1.25rem', lineHeight: 1.7 }}>
                  <li><strong>12 New Tools:</strong> Added Remove Pages, Extract Pages, Organize PDF, PDF to JPG, HTML to PDF, Add Page Numbers, Watermark, Unlock, Redact, Compare, Repair, PDF to PDF/A.</li>
                  <li><strong>Categorized Dashboard:</strong> Organizes all 30+ tools under clean groups.</li>
                  <li><strong>Search & Filter:</strong> Real-time keyword search bar and fast category chips.</li>
                  <li><strong>Bug Fixes:</strong> Sign PDF dragging coordinates and Edit PDF blank rendering issues fully resolved.</li>
                  <li><strong>Cloud Integrations:</strong> Configured Docker-based deployments for Render.com backend.</li>
                </ul>
              </div>

              <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: '1.25rem', position: 'relative' }}>
                <div style={{ position: 'absolute', left: -7, top: 4, width: 12, height: 12, borderRadius: '50%', background: 'var(--border)' }} />
                <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)' }}>v1.0.0 — Initial Release</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0.5rem' }}>Released: June 2026</p>
                <ul style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', paddingLeft: '1.25rem', lineHeight: 1.7 }}>
                  <li>Core PDF utilities: PDF Viewer, Edit PDF, AI OCR Text Extract.</li>
                  <li>Basic features: Compress PDF, Merge PDF, Split PDF, Rotate PDF, Protect PDF, Sign PDF, JPG to PDF, Extract Images, Word to PDF.</li>
                  <li>Initial responsive client-side layout.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: REPORT A BUG */}
          {activeTab === 'bug' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--error)' }}>
                <Bug size={16} />
                <strong style={{ fontSize: '0.9rem' }}>Found an Issue? Report it Directly!</strong>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                If a tool is not working as expected, please describe it below. You can submit via a pre-filled email or log an open-source ticket directly on our GitHub Issues page.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                <div>
                  <label htmlFor="bug-email" style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 600 }}>Your Email (Optional)</label>
                  <input
                    id="bug-email"
                    type="email"
                    placeholder="Enter email so we can reach back…"
                    value={bugEmail}
                    onChange={e => setBugEmail(e.target.value)}
                    className="text-input"
                    style={{ fontSize: '0.8125rem', padding: '0.5rem 0.75rem' }}
                  />
                </div>
                <div>
                  <label htmlFor="bug-desc" style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 600 }}>What happened?</label>
                  <textarea
                    id="bug-desc"
                    rows={2}
                    placeholder="Describe the issue you encountered..."
                    value={bugDesc}
                    onChange={e => setBugDesc(e.target.value)}
                    className="text-input"
                    style={{ fontSize: '0.8125rem', padding: '0.5rem 0.75rem', fontFamily: 'inherit', resize: 'vertical' }}
                  />
                </div>
                <div>
                  <label htmlFor="bug-steps" style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 600 }}>Steps to reproduce</label>
                  <textarea
                    id="bug-steps"
                    rows={2}
                    placeholder="1. Uploaded a 5MB PDF&#10;2. Selected watermark tool&#10;3. Clicked generate..."
                    value={bugSteps}
                    onChange={e => setBugSteps(e.target.value)}
                    className="text-input"
                    style={{ fontSize: '0.8125rem', padding: '0.5rem 0.75rem', fontFamily: 'inherit', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button 
                    className="btn-ghost" 
                    onClick={submitBugViaEmail}
                    disabled={!bugDesc}
                    style={{ flex: 1, fontSize: '0.8125rem', padding: '0.5rem' }}
                  >
                    <Mail size={14} /> Send Email
                  </button>
                  <button 
                    className="btn-primary" 
                    onClick={openGithubIssue}
                    disabled={!bugDesc}
                    style={{ flex: 1, fontSize: '0.8125rem', padding: '0.5rem' }}
                  >
                    <ExternalLink size={14} /> GitHub Issue
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '1rem 1.5rem', 
            borderTop: '1px solid var(--border)',
            background: 'rgba(0,0,0,0.1)'
          }}
        >
          {/* Don't show again checkbox */}
          <button 
            onClick={handleDontShowToggle}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--text-muted)', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: 500
            }}
            aria-label="Toggle don't show this popup on startup"
          >
            {dontShowAgain ? <CheckSquare size={16} color="var(--primary)" /> : <Square size={16} />}
            Don't show on startup
          </button>
          
          <button 
            className="btn-primary" 
            onClick={handleClose}
            style={{ fontSize: '0.8125rem', padding: '0.5rem 1.25rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
