import { useState, useRef, useEffect, useCallback } from 'react';
import {
  QrCode, Link, Wifi, User, Upload, Camera, Download, Copy,
  CheckCircle2, XCircle, Loader2, ChevronRight,
  Phone, Mail, MapPin, FileText, Eye, EyeOff, RefreshCw, 
  AlertCircle, Check
} from 'lucide-react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';

// ─── Types ─────────────────────────────────────────────────────────
type TabId = 'generate' | 'wifi' | 'contact' | 'customize' | 'scan-upload' | 'scan-camera';

interface QrOptions {
  width: number;
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
  darkColor: string;
  lightColor: string;
  margin: number;
}

// ─── Helpers ───────────────────────────────────────────────────────
async function generateQrDataURL(text: string, opts: QrOptions): Promise<string> {
  return QRCode.toDataURL(text, {
    width: opts.width,
    margin: opts.margin,
    errorCorrectionLevel: opts.errorCorrectionLevel,
    color: { dark: opts.darkColor, light: opts.lightColor },
  });
}

function buildWifiString(ssid: string, password: string, type: string, hidden: boolean) {
  return `WIFI:T:${type};S:${ssid};P:${password};H:${hidden ? 'true' : 'false'};;`;
}

function buildVCardString(name: string, phone: string, email: string, company: string, address: string, website: string) {
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${name}`,
    company ? `ORG:${company}` : '',
    phone ? `TEL:${phone}` : '',
    email ? `EMAIL:${email}` : '',
    address ? `ADR:;;${address};;;;` : '',
    website ? `URL:${website}` : '',
    'END:VCARD',
  ].filter(Boolean).join('\n');
}

// ─── Shared QR Preview Card ─────────────────────────────────────────
function QrPreviewCard({ dataUrl, onDownload, onCopy, label }: {
  dataUrl: string | null;
  onDownload: () => void;
  onCopy: () => void;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!dataUrl) return null;

  return (
    <div style={{
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '1rem',
      marginTop: '1.5rem',
    }}>
      <div style={{
        background: 'white',
        borderRadius: 'var(--radius-sm)',
        padding: '0.75rem',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      }}>
        <img src={dataUrl} alt="Generated QR Code" style={{ display: 'block', width: 200, height: 200 }} />
      </div>
      {label && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', maxWidth: 260 }}>
          {label}
        </p>
      )}
      <div style={{ display: 'flex', gap: '0.75rem', width: '100%', maxWidth: 280 }}>
        <button
          className="btn-primary"
          onClick={onDownload}
          style={{ flex: 1, fontSize: '0.875rem' }}
          aria-label="Download QR code as PNG"
        >
          <Download size={15} /> Download PNG
        </button>
        <button
          className="btn-ghost"
          onClick={handleCopy}
          style={{ flex: 1, fontSize: '0.875rem' }}
          aria-label="Copy QR code to clipboard"
        >
          {copied ? <><Check size={15} /> Copied!</> : <><Copy size={15} /> Copy</>}
        </button>
      </div>
    </div>
  );
}

// ─── Tab: Generate ─────────────────────────────────────────────────
function GenerateTab() {
  const [input, setInput] = useState('');
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [inputType, setInputType] = useState<'url' | 'text' | 'email' | 'phone' | 'sms' | 'maps'>('url');

  const typeOptions = [
    { id: 'url', label: 'URL / Link', icon: <Link size={14} />, placeholder: 'https://example.com' },
    { id: 'text', label: 'Plain Text', icon: <FileText size={14} />, placeholder: 'Enter any text...' },
    { id: 'email', label: 'Email', icon: <Mail size={14} />, placeholder: 'name@example.com' },
    { id: 'phone', label: 'Phone', icon: <Phone size={14} />, placeholder: '+63 912 345 6789' },
    { id: 'sms', label: 'SMS', icon: <Mail size={14} />, placeholder: '+63 912 345 6789' },
    { id: 'maps', label: 'Maps / Address', icon: <MapPin size={14} />, placeholder: 'Manila, Philippines' },
  ] as const;

  const formatValue = () => {
    const v = input.trim();
    if (!v) return '';
    switch (inputType) {
      case 'url': return v.startsWith('http') ? v : `https://${v}`;
      case 'email': return `mailto:${v}`;
      case 'phone': return `tel:${v.replace(/\s/g, '')}`;
      case 'sms': return `sms:${v.replace(/\s/g, '')}`;
      case 'maps': return `https://maps.google.com/?q=${encodeURIComponent(v)}`;
      default: return v;
    }
  };

  const generate = async () => {
    const val = formatValue();
    if (!val) return;
    setIsLoading(true);
    try {
      const url = await generateQrDataURL(val, {
        width: 400, errorCorrectionLevel: 'M',
        darkColor: '#1e293b', lightColor: '#ffffff', margin: 2,
      });
      setQrUrl(url);
    } finally { setIsLoading(false); }
  };

  const download = () => {
    if (!qrUrl) return;
    const a = document.createElement('a'); a.href = qrUrl;
    a.download = `qrcode_${inputType}.png`; a.click();
  };

  const copy = () => {
    if (!qrUrl) return;
    fetch(qrUrl).then(r => r.blob()).then(b => navigator.clipboard.write([
      new ClipboardItem({ 'image/png': b })
    ])).catch(() => {});
  };

  const placeholder = typeOptions.find(t => t.id === inputType)?.placeholder ?? '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Type selector */}
      <div>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.625rem' }}>
          QR Code Type
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {typeOptions.map(t => (
            <button
              key={t.id}
              onClick={() => { setInputType(t.id); setQrUrl(null); setInput(''); }}
              aria-pressed={inputType === t.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.4rem 0.875rem', borderRadius: '2rem',
                border: inputType === t.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                background: inputType === t.id ? 'rgba(59,130,246,0.1)' : 'transparent',
                color: inputType === t.id ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer',
                transition: 'all 150ms',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div>
        <label htmlFor="qr-input" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
          Content
        </label>
        <input
          id="qr-input"
          type="text"
          value={input}
          onChange={e => { setInput(e.target.value); setQrUrl(null); }}
          placeholder={placeholder}
          onKeyDown={e => e.key === 'Enter' && generate()}
          style={{
            width: '100%', padding: '0.75rem 1rem',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-main)',
            fontSize: '0.9375rem', outline: 'none', boxSizing: 'border-box',
          }}
          aria-label="QR code content"
        />
      </div>

      <button
        className="download-btn"
        onClick={generate}
        disabled={!input.trim() || isLoading}
        aria-label="Generate QR code"
      >
        {isLoading ? <Loader2 className="spinner" size={18} /> : <QrCode size={18} />}
        Generate QR Code
      </button>

      <QrPreviewCard dataUrl={qrUrl} onDownload={download} onCopy={copy}
        label="Scan with any QR reader app" />
    </div>
  );
}

// ─── Tab: WiFi QR ──────────────────────────────────────────────────
function WifiTab() {
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [securityType, setSecurityType] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');
  const [hidden, setHidden] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generate = async () => {
    if (!ssid.trim()) return;
    setIsLoading(true);
    try {
      const str = buildWifiString(ssid, password, securityType, hidden);
      const url = await generateQrDataURL(str, {
        width: 400, errorCorrectionLevel: 'M',
        darkColor: '#1e293b', lightColor: '#ffffff', margin: 2,
      });
      setQrUrl(url);
    } finally { setIsLoading(false); }
  };

  const download = () => { if (qrUrl) { const a = document.createElement('a'); a.href = qrUrl; a.download = `wifi_${ssid}.png`; a.click(); } };
  const copy = () => { if (qrUrl) fetch(qrUrl).then(r => r.blob()).then(b => navigator.clipboard.write([new ClipboardItem({ 'image/png': b })])).catch(() => {}); };

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '0.75rem 1rem',
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text-main)',
    fontSize: '0.9375rem', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 'var(--radius-sm)', padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
        <Wifi size={15} style={{ flexShrink: 0, marginTop: 1, color: 'var(--primary)' }} />
        <span>Generate a QR code your guests can scan to join your WiFi network instantly.</span>
      </div>

      <div>
        <label htmlFor="wifi-ssid" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Network Name (SSID)</label>
        <input id="wifi-ssid" type="text" value={ssid} onChange={e => { setSsid(e.target.value); setQrUrl(null); }} placeholder="MyHomeWiFi" style={fieldStyle} aria-label="WiFi network name" />
      </div>

      <div>
        <label htmlFor="wifi-security" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Security Type</label>
        <select id="wifi-security" value={securityType} onChange={e => { setSecurityType(e.target.value as typeof securityType); setQrUrl(null); }} style={{ ...fieldStyle, cursor: 'pointer' }} aria-label="WiFi security type">
          <option value="WPA">WPA / WPA2 / WPA3</option>
          <option value="WEP">WEP</option>
          <option value="nopass">No Password (Open)</option>
        </select>
      </div>

      {securityType !== 'nopass' && (
        <div>
          <label htmlFor="wifi-password" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Password</label>
          <div style={{ position: 'relative' }}>
            <input id="wifi-password" type={showPw ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); setQrUrl(null); }} placeholder="••••••••" style={{ ...fieldStyle, paddingRight: '3rem' }} aria-label="WiFi password" />
            <button onClick={() => setShowPw(p => !p)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} aria-label={showPw ? 'Hide password' : 'Show password'}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer' }}>
        <input type="checkbox" checked={hidden} onChange={e => { setHidden(e.target.checked); setQrUrl(null); }} style={{ width: 16, height: 16 }} aria-label="Hidden network" />
        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Hidden network</span>
      </label>

      <button className="download-btn" onClick={generate} disabled={!ssid.trim() || isLoading} aria-label="Generate WiFi QR code">
        {isLoading ? <Loader2 className="spinner" size={18} /> : <Wifi size={18} />}
        Generate WiFi QR
      </button>

      <QrPreviewCard dataUrl={qrUrl} onDownload={download} onCopy={copy} label="Scan to join WiFi instantly — no typing required!" />
    </div>
  );
}

// ─── Tab: Contact / vCard QR ───────────────────────────────────────
function ContactTab() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [address, setAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generate = async () => {
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      const vcard = buildVCardString(name, phone, email, company, address, website);
      const url = await generateQrDataURL(vcard, {
        width: 400, errorCorrectionLevel: 'M',
        darkColor: '#1e293b', lightColor: '#ffffff', margin: 2,
      });
      setQrUrl(url);
    } finally { setIsLoading(false); }
  };

  const download = () => { if (qrUrl) { const a = document.createElement('a'); a.href = qrUrl; a.download = `contact_${name}.png`; a.click(); } };
  const copy = () => { if (qrUrl) fetch(qrUrl).then(r => r.blob()).then(b => navigator.clipboard.write([new ClipboardItem({ 'image/png': b })])).catch(() => {}); };

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '0.75rem 1rem',
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text-main)',
    fontSize: '0.9375rem', outline: 'none', boxSizing: 'border-box',
  };

  const fields = [
    { id: 'vc-name', label: 'Full Name *', value: name, setter: setName, placeholder: 'Harold Trinidad', icon: <User size={14} />, required: true },
    { id: 'vc-phone', label: 'Phone', value: phone, setter: setPhone, placeholder: '+63 912 345 6789', icon: <Phone size={14} />, required: false },
    { id: 'vc-email', label: 'Email', value: email, setter: setEmail, placeholder: 'name@example.com', icon: <Mail size={14} />, required: false },
    { id: 'vc-company', label: 'Company / Organization', value: company, setter: setCompany, placeholder: 'My Company Inc.', icon: <FileText size={14} />, required: false },
    { id: 'vc-address', label: 'Address', value: address, setter: setAddress, placeholder: 'Manila, Philippines', icon: <MapPin size={14} />, required: false },
    { id: 'vc-website', label: 'Website', value: website, setter: setWebsite, placeholder: 'https://example.com', icon: <Link size={14} />, required: false },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {fields.map(f => (
        <div key={f.id}>
          <label htmlFor={f.id} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            {f.icon} {f.label}
          </label>
          <input
            id={f.id} type="text" value={f.value}
            onChange={e => { f.setter(e.target.value); setQrUrl(null); }}
            placeholder={f.placeholder} style={fieldStyle}
            aria-label={f.label} aria-required={f.required}
          />
        </div>
      ))}

      <button className="download-btn" onClick={generate} disabled={!name.trim() || isLoading} aria-label="Generate contact QR code">
        {isLoading ? <Loader2 className="spinner" size={18} /> : <User size={18} />}
        Generate Contact QR
      </button>

      <QrPreviewCard dataUrl={qrUrl} onDownload={download} onCopy={copy} label="Scan to save contact to phone instantly" />
    </div>
  );
}

// ─── Tab: Customize QR ─────────────────────────────────────────────
function CustomizeTab() {
  const [input, setInput] = useState('https://example.com');
  const [darkColor, setDarkColor] = useState('#1e293b');
  const [lightColor, setLightColor] = useState('#ffffff');
  const [size, setSize] = useState(400);
  const [margin, setMargin] = useState(2);
  const [ecLevel, setEcLevel] = useState<'L' | 'M' | 'Q' | 'H'>('M');
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generate = useCallback(async () => {
    if (!input.trim()) return;
    setIsLoading(true);
    try {
      const url = await generateQrDataURL(input.trim(), { width: size, errorCorrectionLevel: ecLevel, darkColor, lightColor, margin });
      setQrUrl(url);
    } finally { setIsLoading(false); }
  }, [input, size, ecLevel, darkColor, lightColor, margin]);

  const download = () => { if (qrUrl) { const a = document.createElement('a'); a.href = qrUrl; a.download = 'custom_qrcode.png'; a.click(); } };
  const copy = () => { if (qrUrl) fetch(qrUrl).then(r => r.blob()).then(b => navigator.clipboard.write([new ClipboardItem({ 'image/png': b })])).catch(() => {}); };

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '0.75rem 1rem',
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text-main)',
    fontSize: '0.9375rem', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <label htmlFor="cust-input" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Content</label>
        <input id="cust-input" type="text" value={input} onChange={e => { setInput(e.target.value); setQrUrl(null); }} placeholder="https://example.com" style={fieldStyle} aria-label="QR code content" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <label htmlFor="cust-dark" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Dark Color</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <input id="cust-dark" type="color" value={darkColor} onChange={e => { setDarkColor(e.target.value); setQrUrl(null); }} style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer', padding: 2 }} aria-label="QR code dark color" />
            <code style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{darkColor}</code>
          </div>
        </div>
        <div>
          <label htmlFor="cust-light" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Light Color</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <input id="cust-light" type="color" value={lightColor} onChange={e => { setLightColor(e.target.value); setQrUrl(null); }} style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer', padding: 2 }} aria-label="QR code light color" />
            <code style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{lightColor}</code>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="cust-size" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
          <span>Size (pixels)</span><span style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>{size}px</span>
        </label>
        <input id="cust-size" type="range" min={200} max={1000} step={50} value={size} onChange={e => { setSize(Number(e.target.value)); setQrUrl(null); }} style={{ width: '100%', cursor: 'pointer' }} aria-label="QR code size" />
      </div>

      <div>
        <label htmlFor="cust-margin" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
          <span>Quiet Zone (Margin)</span><span style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>{margin} cells</span>
        </label>
        <input id="cust-margin" type="range" min={0} max={6} step={1} value={margin} onChange={e => { setMargin(Number(e.target.value)); setQrUrl(null); }} style={{ width: '100%', cursor: 'pointer' }} aria-label="QR code margin" />
      </div>

      <div>
        <label htmlFor="cust-ec" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Error Correction Level</label>
        <select id="cust-ec" value={ecLevel} onChange={e => { setEcLevel(e.target.value as typeof ecLevel); setQrUrl(null); }} style={{ ...fieldStyle, cursor: 'pointer' }} aria-label="Error correction level">
          <option value="L">L — Low (7% restoration)</option>
          <option value="M">M — Medium (15% restoration)</option>
          <option value="Q">Q — Quartile (25% restoration)</option>
          <option value="H">H — High (30% restoration, best for logos)</option>
        </select>
      </div>

      <button className="download-btn" onClick={generate} disabled={!input.trim() || isLoading} aria-label="Generate customized QR code">
        {isLoading ? <Loader2 className="spinner" size={18} /> : <QrCode size={18} />}
        Generate Custom QR
      </button>

      <QrPreviewCard dataUrl={qrUrl} onDownload={download} onCopy={copy} />
    </div>
  );
}

// ─── Tab: Scan (Upload) ────────────────────────────────────────────
function ScanUploadTab() {
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Please upload an image file (JPG, PNG, WebP, etc.)'); return; }
    setIsProcessing(true); setResult(null); setError(null);
    try {
      const reader = new FileReader();
      const imgSrc = await new Promise<string>((res, rej) => { reader.onload = () => res(reader.result as string); reader.onerror = rej; reader.readAsDataURL(file); });
      setImageSrc(imgSrc);
      const img = new Image(); img.src = imgSrc;
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
      if (code) { setResult(code.data); }
      else { setError('No QR code found in this image. Try a clearer photo or a different image.'); }
    } catch { setError('Failed to read the image. Please try again.'); }
    finally { setIsProcessing(false); }
  };

  const handleFiles = (files: FileList) => { if (files[0]) processFile(files[0]); };

  const copyResult = () => {
    if (result) { navigator.clipboard.writeText(result).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const openResult = () => {
    if (!result) return;
    const url = result.startsWith('http') ? result : result.startsWith('mailto:') || result.startsWith('tel:') ? result : null;
    if (url) window.open(url, '_blank', 'noopener');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {!imageSrc ? (
        <div
          className={`upload-area ${isDragging ? 'dragging' : ''}`}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
          role="button" tabIndex={0} aria-label="Upload image to scan QR code"
          onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
        >
          <Upload size={48} className="upload-icon" aria-hidden="true" />
          <div>
            <p><strong style={{ color: 'var(--text-main)' }}>Drag & Drop Image</strong> or click to browse</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Supports JPG, PNG, WebP, GIF, BMP</p>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files && handleFiles(e.target.files)} aria-label="Select image to scan" />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <img src={imageSrc} alt="Uploaded image for QR scan" style={{ maxHeight: 250, objectFit: 'contain', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
          <button className="btn-ghost" onClick={() => { setImageSrc(null); setResult(null); setError(null); }} style={{ alignSelf: 'flex-start' }} aria-label="Upload a different image">
            <RefreshCw size={14} /> Try Different Image
          </button>
        </div>
      )}

      {isProcessing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          <Loader2 className="spinner" size={16} /> Scanning for QR code...
        </div>
      )}

      {result && (
        <div style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 'var(--radius-sm)', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#16a34a', fontWeight: 700, fontSize: '0.875rem' }}>
            <CheckCircle2 size={16} /> QR Code Decoded!
          </div>
          <p style={{ wordBreak: 'break-all', color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>{result}</p>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.875rem' }}>
            <button className="btn-primary" onClick={copyResult} style={{ fontSize: '0.8125rem', padding: '0.4rem 0.875rem' }} aria-label="Copy decoded QR code content">
              {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
            </button>
            {(result.startsWith('http') || result.startsWith('mailto:') || result.startsWith('tel:')) && (
              <button className="btn-ghost" onClick={openResult} style={{ fontSize: '0.8125rem', padding: '0.4rem 0.875rem' }} aria-label="Open decoded URL">
                <ChevronRight size={13} /> Open Link
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-sm)', padding: '0.875rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <XCircle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          <p style={{ color: 'var(--text-main)', fontSize: '0.875rem', margin: 0 }}>{error}</p>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Scan (Camera) ────────────────────────────────────────────
function ScanCameraTab() {
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionAsked, setPermissionAsked] = useState(false);
  const [copied, setCopied] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  const stopScanning = useCallback(() => {
    setIsScanning(false);
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const scan = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scan); return;
    }
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
    if (code) { setResult(code.data); stopScanning(); }
    else { rafRef.current = requestAnimationFrame(scan); }
  }, [stopScanning]);

  const startScanning = async () => {
    setError(null); setResult(null); setPermissionAsked(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setIsScanning(true);
      rafRef.current = requestAnimationFrame(scan);
    } catch {
      setError('Camera access was denied or not available. Please check your browser permissions and try again.');
      setIsScanning(false);
    }
  };

  useEffect(() => () => stopScanning(), [stopScanning]);

  const copyResult = () => {
    if (result) { navigator.clipboard.writeText(result).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {!permissionAsked && (
        <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 'var(--radius-sm)', padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <Camera size={15} style={{ flexShrink: 0, marginTop: 1, color: 'var(--primary)' }} />
          <span>This tool uses your device camera to scan QR codes in real-time. You'll be asked to grant camera permission when you start.</span>
        </div>
      )}

      <div style={{ position: 'relative', borderRadius: 'var(--radius)', overflow: 'hidden', background: '#0a0a0a', minHeight: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--border)' }}>
        <video
          ref={videoRef}
          style={{ width: '100%', display: isScanning ? 'block' : 'none', maxHeight: 360 }}
          playsInline muted
          aria-label="Camera feed for QR scanning"
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} aria-hidden="true" />
        {!isScanning && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '2rem', textAlign: 'center' }}>
            <Camera size={48} style={{ color: 'rgba(255,255,255,0.2)' }} aria-hidden="true" />
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem', margin: 0 }}>
              {result ? 'QR code scanned successfully!' : 'Camera preview will appear here'}
            </p>
          </div>
        )}
        {isScanning && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 200, height: 200, border: '2px solid rgba(59,130,246,0.8)',
            borderRadius: 12, boxShadow: '0 0 0 4000px rgba(0,0,0,0.4)',
            pointerEvents: 'none'
          }} aria-label="Scanning area — point QR code here" />
        )}
      </div>

      {!isScanning && !result && (
        <button className="download-btn" onClick={startScanning} aria-label="Start camera QR scanner">
          <Camera size={18} /> Start Camera Scanner
        </button>
      )}
      {isScanning && (
        <button className="btn-ghost" onClick={stopScanning} aria-label="Stop camera scanning">
          <XCircle size={16} /> Stop Scanning
        </button>
      )}

      {result && (
        <div style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 'var(--radius-sm)', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#16a34a', fontWeight: 700, fontSize: '0.875rem' }}>
            <CheckCircle2 size={16} /> QR Code Scanned!
          </div>
          <p style={{ wordBreak: 'break-all', color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>{result}</p>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.875rem', flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={copyResult} style={{ fontSize: '0.8125rem', padding: '0.4rem 0.875rem' }} aria-label="Copy scanned QR code content">
              {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
            </button>
            <button className="btn-ghost" onClick={() => { setResult(null); startScanning(); }} style={{ fontSize: '0.8125rem', padding: '0.4rem 0.875rem' }} aria-label="Scan another QR code">
              <RefreshCw size={13} /> Scan Another
            </button>
            {result.startsWith('http') && (
              <button className="btn-ghost" onClick={() => window.open(result, '_blank', 'noopener')} style={{ fontSize: '0.8125rem', padding: '0.4rem 0.875rem' }} aria-label="Open scanned URL">
                <ChevronRight size={13} /> Open Link
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-sm)', padding: '0.875rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          <p style={{ color: 'var(--text-main)', fontSize: '0.875rem', margin: 0 }}>{error}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main QR Tools Page ────────────────────────────────────────────
const TABS: { id: TabId; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'generate', label: 'Generate', icon: <QrCode size={16} />, desc: 'URL, Text, Email, Phone & more' },
  { id: 'wifi', label: 'WiFi QR', icon: <Wifi size={16} />, desc: 'Share WiFi credentials via QR' },
  { id: 'contact', label: 'Contact Card', icon: <User size={16} />, desc: 'vCard QR for contacts' },
  { id: 'customize', label: 'Customize', icon: <QrCode size={16} />, desc: 'Colors, size, error correction' },
  { id: 'scan-upload', label: 'Scan Image', icon: <Upload size={16} />, desc: 'Decode QR from an image file' },
  { id: 'scan-camera', label: 'Scan Camera', icon: <Camera size={16} />, desc: 'Live camera QR scanner' },
];

export default function QrToolsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('generate');
  const tab = TABS.find(t => t.id === activeTab)!;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '2rem' }}>
        <div style={{
          width: 52, height: 52, borderRadius: 'var(--radius)',
          background: 'linear-gradient(135deg, #7C3AED, #3B82F6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          boxShadow: '0 8px 24px rgba(124,58,237,0.35)',
        }}>
          <QrCode size={26} color="#fff" aria-hidden="true" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-main)' }}>QR Code Tools</h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Generate, customize, and scan QR codes — 100% in your browser
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '2rem', padding: '0.375rem', background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            aria-pressed={activeTab === t.id}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 0.875rem', borderRadius: 'calc(var(--radius) - 3px)',
              border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600,
              background: activeTab === t.id ? 'var(--primary)' : 'transparent',
              color: activeTab === t.id ? '#fff' : 'var(--text-secondary)',
              transition: 'all 150ms',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Active tab description */}
      <div style={{ marginBottom: '1.5rem' }}>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {tab.desc}
        </p>
      </div>

      {/* Tab content */}
      <div style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '1.5rem',
      }}>
        {activeTab === 'generate'     && <GenerateTab />}
        {activeTab === 'wifi'         && <WifiTab />}
        {activeTab === 'contact'      && <ContactTab />}
        {activeTab === 'customize'    && <CustomizeTab />}
        {activeTab === 'scan-upload'  && <ScanUploadTab />}
        {activeTab === 'scan-camera'  && <ScanCameraTab />}
      </div>
    </div>
  );
}
