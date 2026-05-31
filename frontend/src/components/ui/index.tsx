import React from 'react';

// ── CTBtn Props & Component ───────────────────────────────────────────
interface CTBtnProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'nav';
  icon?: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  size?: 'sm' | 'md' | 'lg';
  full?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export const CTBtn: React.FC<CTBtnProps> = ({
  label,
  variant = 'primary',
  icon,
  onClick,
  size = 'md',
  full,
  disabled,
  type = 'button',
}) => {
  const pad = size === 'sm' ? '5px 12px' : size === 'lg' ? '10px 22px' : '7px 16px';
  const fs = size === 'sm' ? 13 : 14;
  
  const vMap = {
    primary:   { bg: 'var(--primary)',    color: '#fff',          border: 'transparent',       shadow: '0 1px 2px oklch(0% 0 0 / .18)' },
    secondary: { bg: 'var(--surface-2)',  color: 'var(--ink)',    border: 'var(--border-s)',    shadow: 'none' },
    ghost:     { bg: 'transparent',       color: 'var(--primary)', border: 'var(--primary-bdr)', shadow: 'none' },
    danger:    { bg: 'var(--red-bg)',     color: 'var(--red)',     border: 'var(--red-bdr)',     shadow: 'none' },
    nav:       { bg: 'transparent',       color: 'rgba(255,255,255,0.72)', border: 'rgba(255,255,255,0.22)', shadow: 'none' },
  };
  
  const v = vMap[variant] || vMap.primary;
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: pad,
        fontSize: fs,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: `1px solid ${v.border}`,
        borderRadius: 'var(--r)',
        background: v.bg,
        color: v.color,
        boxShadow: v.shadow,
        width: full ? '100%' : 'auto',
        whiteSpace: 'nowrap',
        transition: 'opacity 0.15s',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon && <span style={{ fontSize: fs + 1 }}>{icon}</span>}
      {label}
    </button>
  );
};

// ── CTBadge Props & Component ─────────────────────────────────────────
interface CTBadgeProps {
  label: string;
  variant?: 'active' | 'abnormal' | 'high' | 'normal' | 'resolved' | 'low' | 'chronic' | 'moderate' | 'pending' | 'done' | 'failed';
}

export const CTBadge: React.FC<CTBadgeProps> = ({ label, variant = 'normal' }) => {
  const vMap = {
    active:   { bg: 'var(--red-bg)',     color: 'var(--red)',     border: 'var(--red-bdr)'   },
    abnormal: { bg: 'var(--red-bg)',     color: 'var(--red)',     border: 'var(--red-bdr)'   },
    high:     { bg: 'var(--red-bg)',     color: 'var(--red)',     border: 'var(--red-bdr)'   },
    normal:   { bg: 'var(--green-bg)',   color: 'var(--green)',   border: 'var(--green-bdr)' },
    resolved: { bg: 'var(--green-bg)',   color: 'var(--green)',   border: 'var(--green-bdr)' },
    low:      { bg: 'var(--green-bg)',   color: 'var(--green)',   border: 'var(--green-bdr)' },
    chronic:  { bg: 'var(--amber-bg)',   color: 'var(--amber)',   border: 'var(--amber-bdr)' },
    moderate: { bg: 'var(--amber-bg)',   color: 'var(--amber)',   border: 'var(--amber-bdr)' },
    pending:  { bg: 'var(--primary-bg)', color: 'var(--primary)', border: 'var(--primary-bdr)' },
    done:     { bg: 'var(--green-bg)',   color: 'var(--green)',   border: 'var(--green-bdr)' },
    failed:   { bg: 'var(--red-bg)',     color: 'var(--red)',     border: 'var(--red-bdr)'   },
  };
  
  const v = vMap[variant] || vMap.normal;
  
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: 0.15,
        background: v.bg,
        color: v.color,
        border: `1px solid ${v.border}`,
      }}
    >
      {label}
    </span>
  );
};

// ── CTVitalCard Props & Component ─────────────────────────────────────
interface CTVitalCardProps {
  label: string;
  value: string | number;
  unit: string;
  status?: string;
}

export const CTVitalCard: React.FC<CTVitalCardProps> = ({ label, value, unit, status }) => {
  const abn = status === 'abnormal';
  return (
    <div
      style={{
        background: abn ? 'var(--red-bg)' : 'var(--bg)',
        border: `1.5px solid ${abn ? 'var(--red-bdr)' : 'var(--border)'}`,
        borderRadius: 'var(--r-lg)',
        padding: '14px 18px',
        boxShadow: 'var(--sh)',
        minWidth: 130,
        flex: '1 1 130px',
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500, marginBottom: 5 }}>{label}</div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 600,
          lineHeight: 1,
          color: abn ? 'var(--red)' : 'var(--ink)',
          fontFamily: 'var(--mono)',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3 }}>{unit}</div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          marginTop: 9,
          fontSize: 12,
          fontWeight: 500,
          color: abn ? 'var(--red)' : 'var(--green)',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'currentColor',
            display: 'inline-block',
          }}
        />
        {abn ? 'Abnormal' : 'Normal'}
      </div>
    </div>
  );
};

// ── CTRiskBadge Props & Component ─────────────────────────────────────
interface CTRiskBadgeProps {
  score: number;
  category: 'low' | 'moderate' | 'high' | string;
}

export const CTRiskBadge: React.FC<CTRiskBadgeProps> = ({ score, category }) => {
  const cMap: Record<string, { main: string; bg: string; bdr: string }> = {
    low:      { main: 'var(--green)', bg: 'var(--green-bg)', bdr: 'var(--green-bdr)' },
    moderate: { main: 'var(--amber)', bg: 'var(--amber-bg)', bdr: 'var(--amber-bdr)' },
    high:     { main: 'var(--red)',   bg: 'var(--red-bg)',   bdr: 'var(--red-bdr)'   },
  };
  
  const c = cMap[category] || cMap.moderate;
  
  return (
    <div
      style={{
        background: c.bg,
        border: `1.5px solid ${c.bdr}`,
        borderRadius: 'var(--r-lg)',
        padding: '12px 16px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: 'var(--ink-3)',
          fontWeight: 500,
          marginBottom: 5,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        }}
      >
        HEART Score
      </div>
      <div style={{ fontFamily: 'var(--mono)', lineHeight: 1 }}>
        <span style={{ fontSize: 34, fontWeight: 600, color: c.main }}>{score}</span>
        <span style={{ fontSize: 15, color: 'var(--ink-3)' }}>/10</span>
      </div>
      <div
        style={{
          fontSize: 12,
          color: c.main,
          marginTop: 7,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {category} risk
      </div>
    </div>
  );
};

// ── CTAvatar Props & Component ────────────────────────────────────────
interface CTAvatarProps {
  initials: string;
  size?: number;
  bg?: string;
  color?: string;
  border?: string;
}

export const CTAvatar: React.FC<CTAvatarProps> = ({
  initials,
  size = 72,
  bg = 'var(--primary-bg)',
  color = 'var(--primary)',
  border = 'var(--primary-bdr)',
}) => {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        border: `2px solid ${border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: size * 0.3,
        fontWeight: 600,
        color,
      }}
    >
      {initials}
    </div>
  );
};

// ── CTInfoRow Props & Component ───────────────────────────────────────
interface CTInfoRowProps {
  label: string;
  value: string | number;
  mono?: boolean;
}

export const CTInfoRow: React.FC<CTInfoRowProps> = ({ label, value, mono }) => {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '3.5px 0', fontSize: 13.5 }}>
      <span style={{ color: 'var(--ink-3)', minWidth: 84, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--ink)', fontWeight: 500, fontFamily: mono ? 'var(--mono)' : undefined }}>
        {value}
      </span>
    </div>
  );
};

// ── CTSectionHead Props & Component ───────────────────────────────────
interface CTSectionHeadProps {
  title: string;
  action?: React.ReactNode;
}

export const CTSectionHead: React.FC<CTSectionHeadProps> = ({ title, action }) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <h3
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          color: 'var(--ink-3)',
          textTransform: 'uppercase',
          letterSpacing: 0.8,
        }}
      >
        {title}
      </h3>
      {action}
    </div>
  );
};

// ── CTDivider Props & Component ───────────────────────────────────────
interface CTDividerProps {
  my?: number;
}

export const CTDivider: React.FC<CTDividerProps> = ({ my = 16 }) => {
  return <div style={{ borderTop: '1px solid var(--border)', margin: `${my}px 0` }} />;
};
