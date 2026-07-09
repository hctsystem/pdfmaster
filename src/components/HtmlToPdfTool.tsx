import { useState } from 'react';
import { Globe, Code, Printer, ExternalLink, Info } from 'lucide-react';

type Tab = 'url' | 'html';

export default function HtmlToPdfTool() {
  const [activeTab, setActiveTab] = useState<Tab>('url');
  const [url, setUrl] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);

  const handleOpenUrl = () => {
    if (!url.trim()) return;
    const target = url.startsWith('http') ? url : `https://${url}`;
    window.open(target, '_blank', 'noopener,noreferrer');
  };

  const handlePrintHtml = () => {
    if (!htmlContent.trim()) return;
    setIsPrinting(true);
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const objectUrl = URL.createObjectURL(blob);
    const newWindow = window.open(objectUrl, '_blank');
    if (newWindow) {
      setTimeout(() => {
        newWindow.print();
        URL.revokeObjectURL(objectUrl);
        setIsPrinting(false);
      }, 800);
    } else {
      URL.revokeObjectURL(objectUrl);
      setIsPrinting(false);
      alert('Pop-up was blocked. Please allow pop-ups for this site and try again.');
    }
  };

  const tabButtonStyle = (tab: Tab): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.5rem 1.25rem',
    borderRadius: '999px',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    transition: 'var(--transition)',
    background: activeTab === tab ? 'var(--primary)' : 'transparent',
    color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
  });

  const noticeStyle: React.CSSProperties = {
    display: 'flex',
    gap: '0.625rem',
    alignItems: 'flex-start',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.75rem 1rem',
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.55,
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
          HTML to PDF
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Convert a web page or raw HTML to PDF using your browser's built-in print engine.
        </p>
      </div>

      {/* Pill tabs */}
      <div
        style={{
          display: 'inline-flex',
          gap: '0.25rem',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: '999px',
          padding: '0.25rem',
          marginBottom: '1.5rem',
        }}
      >
        <button style={tabButtonStyle('url')} onClick={() => setActiveTab('url')}>
          <Globe size={15} />
          Enter URL
        </button>
        <button style={tabButtonStyle('html')} onClick={() => setActiveTab('html')}>
          <Code size={15} />
          Paste HTML
        </button>
      </div>

      {/* URL Tab */}
      {activeTab === 'url' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={noticeStyle}>
            <Info size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
            <span>
              Enter a URL below and click <strong>Open in New Tab</strong>. In the new tab, use your
              browser&apos;s <strong>Print</strong> dialog (<kbd style={{ background: 'var(--border)', borderRadius: '3px', padding: '0 4px', fontSize: '0.8rem' }}>Ctrl+P</kbd>) and choose{' '}
              <strong>Save as PDF</strong> as the destination.
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>
              Web Page URL
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleOpenUrl()}
                style={{
                  flex: 1,
                  padding: '0.625rem 0.875rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface-2)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
              <button
                className="btn-primary"
                onClick={handleOpenUrl}
                disabled={!url.trim()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.625rem 1.25rem',
                  whiteSpace: 'nowrap',
                }}
              >
                <ExternalLink size={16} />
                Open in New Tab
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HTML Tab */}
      {activeTab === 'html' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={noticeStyle}>
            <Info size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
            <span>
              Paste your HTML below. Clicking <strong>Open &amp; Print</strong> will render it in a new
              window and open the print dialog. Choose <strong>Save as PDF</strong> as the destination.
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>
              HTML Content
            </label>
            <textarea
              placeholder={'<!DOCTYPE html>\n<html>\n  <body>\n    <h1>Hello, World!</h1>\n    <p>Your content here...</p>\n  </body>\n</html>'}
              value={htmlContent}
              onChange={e => setHtmlContent(e.target.value)}
              rows={14}
              style={{
                width: '100%',
                padding: '0.75rem 0.875rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                resize: 'vertical',
                outline: 'none',
                lineHeight: 1.6,
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            className="download-btn"
            onClick={handlePrintHtml}
            disabled={isPrinting || !htmlContent.trim()}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <Printer size={20} />
            {isPrinting ? 'Opening Print Dialog...' : 'Open & Print'}
          </button>
        </div>
      )}
    </div>
  );
}
