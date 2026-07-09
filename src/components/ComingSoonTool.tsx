import { Clock } from 'lucide-react';

interface ComingSoonToolProps {
  toolName: string;
  description: string;
  iconName?: string;
}

export default function ComingSoonTool({ toolName, description }: ComingSoonToolProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '2rem',
      }}
    >
      <div
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '3rem 2rem',
          textAlign: 'center',
          maxWidth: 480,
          width: '100%',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
          }}
        >
          <Clock size={36} color="var(--primary)" />
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text-main)',
            marginBottom: '0.375rem',
          }}
        >
          {toolName}
        </h2>

        {/* Coming Soon badge */}
        <div style={{ marginBottom: '1rem' }}>
          <span
            style={{
              display: 'inline-block',
              background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
              color: 'var(--accent)',
              border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
              borderRadius: '999px',
              padding: '0.2rem 0.875rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Coming Soon
          </span>
        </div>

        {/* Description */}
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            lineHeight: 1.65,
            marginBottom: '1.5rem',
          }}
        >
          {description}
        </p>

        {/* Notice */}
        <div
          style={{
            background: 'color-mix(in srgb, var(--border) 40%, transparent)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.875rem 1rem',
            fontSize: '0.82rem',
            color: 'var(--text-muted)',
            lineHeight: 1.6,
          }}
        >
          This feature requires a backend server with LibreOffice or a conversion API. It will be
          available in a future update.
        </div>
      </div>
    </div>
  );
}
