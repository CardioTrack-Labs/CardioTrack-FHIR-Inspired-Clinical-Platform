import React, { useState } from 'react';
import { ctApi } from '../lib/api';
import { User } from '../types/fhir';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

const ROLES = [
  {
    id: 'doctor',
    label: 'Ιατρός',
    sub: 'Μόνο δικοί του ασθενείς',
    email: 'dr.smith@cardiotrack.dev',
    password: 'doctor123',
  },
  {
    id: 'cardiologist',
    label: 'Καρδιολόγος',
    sub: 'Όλοι οι ασθενείς, ECG',
    email: 'dr.cardio@cardiotrack.dev',
    password: 'doctor123',
  },
  {
    id: 'patient',
    label: 'Ασθενής',
    sub: 'Ιατρικό προφίλ, vitals',
    email: 'patient1@cardiotrack.dev',
    password: 'patient123',
  },
  {
    id: 'admin',
    label: 'Διαχειριστής',
    sub: 'Σύστημα, στατιστικά, ρόλοι',
    email: 'admin@cardiotrack.dev',
    password: 'admin123',
  },
];

const LEFT_STATS = [
  { label: 'Ασθενείς',      value: '10,240' },
  { label: 'ECG αναλύσεις', value: '48,302' },
  { label: 'Γιατροί',       value: '184'    },
  { label: 'Νοσοκομεία',    value: '12'     },
];

// ── Input helper ───────────────────────────────────────────
interface FormInputProps {
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  error?: string;
  mono?: boolean;
}

const FormInput: React.FC<FormInputProps> = ({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  mono,
}) => {
  return (
    <div>
      <label
        style={{
          fontSize: 12.5,
          fontWeight: 500,
          color: 'var(--ink-2)',
          display: 'block',
          marginBottom: 5,
        }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '9px 12px',
          fontSize: 14,
          border: `1px solid ${error ? 'var(--red-bdr)' : 'var(--border-s)'}`,
          borderRadius: 'var(--r)',
          background: 'var(--bg)',
          color: 'var(--ink)',
          fontFamily: mono ? 'var(--mono)' : 'var(--font)',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      {error && (
        <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 5 }}>{error}</div>
      )}
    </div>
  );
};

// ── Login Page ────────────────────────────────────────────
export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [role, setRole] = useState('doctor');
  const [email, setEmail] = useState(ROLES[0].email);
  const [password, setPassword] = useState(ROLES[0].password);
  const [loading, setLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState('');

  const selectRole = (r: typeof ROLES[0]) => {
    setRole(r.id);
    setEmail(r.email);
    setPassword(r.password);
    setPwError('');
    setRegisterSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegistering) {
      if (!name.trim()) {
        setPwError('Εισάγετε το όνομά σας');
        return;
      }
      if (!email.trim() || !email.includes('@')) {
        setPwError('Εισάγετε έγκυρο email');
        return;
      }
      if (password.length < 6) {
        setPwError('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες');
        return;
      }
      setLoading(true);
      setPwError('');
      setRegisterSuccess('');
      try {
        await ctApi.register(email, password, name);
        setRegisterSuccess('Η εγγραφή ολοκληρώθηκε επιτυχώς! Μπορείτε να συνδεθείτε.');
        setIsRegistering(false);
        setPassword('');
        setPwError('');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Αποτυχία εγγραφής.';
        setPwError(msg);
      } finally {
        setLoading(false);
      }
    } else {
      if (!password.trim()) {
        setPwError('Εισάγετε κωδικό πρόσβασης');
        return;
      }
      setLoading(true);
      setPwError('');
      try {
        const user = await ctApi.login(email, password);
        onLoginSuccess(user);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Αποτυχία σύνδεσης. Ελέγξτε τα στοιχεία σας.';
        setPwError(msg);
      } finally {
        setLoading(false);
      }
    }
  };


  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'var(--font)' }} className="max-md:!flex-col">

      {/* ── Left brand panel ─────────────────────────────── */}
      <div
        style={{
          width: '42%',
          flexShrink: 0,
          background: 'var(--nav)',
          display: 'flex',
          flexDirection: 'column',
          padding: '48px 52px',
          position: 'relative',
          overflow: 'hidden',
        }}
        className="max-md:!hidden"
      >
        {/* Logo */}
        <div style={{ marginBottom: 'auto' }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'oklch(90% 0.04 245)', letterSpacing: 0.3 }}>
            CardioTrack
          </span>
        </div>

        {/* Headline */}
        <div style={{ marginBottom: 'auto', paddingTop: 72 }}>
          <h2
            style={{
              fontSize: 30,
              fontWeight: 600,
              color: '#fff',
              lineHeight: 1.25,
              letterSpacing: -0.5,
              marginBottom: 16,
            }}
          >
            Clinical decision support for modern cardiology.
          </h2>
          <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, margin: 0 }}>
            FHIR-inspired platform for real-time patient monitoring, ECG analysis, and evidence-based risk stratification.
          </p>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 56 }}>
          {LEFT_STATS.map(s => (
            <div
              key={s.label}
              style={{
                padding: '14px 16px',
                background: 'oklch(26% 0.05 255)',
                borderRadius: 8,
                border: '1px solid oklch(32% 0.055 255)',
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  color: 'oklch(88% 0.08 245)',
                  fontFamily: 'var(--mono)',
                  lineHeight: 1,
                }}
              >
                {s.value}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ECG decoration */}
        <svg
          viewBox="0 0 500 50"
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            width: '100%',
            height: 50,
            opacity: 0.07,
            pointerEvents: 'none',
          }}
        >
          <path
            d="M0,25 L55,25 L60,25 L63,8 L67,42 L71,3 L76,47 L80,25 L135,25 L140,25 L143,8 L147,42 L151,3 L156,47 L160,25 L215,25 L220,25 L223,8 L227,42 L231,3 L236,47 L240,25 L295,25 L300,25 L303,8 L307,42 L311,3 L316,47 L320,25 L375,25 L380,25 L383,8 L387,42 L391,3 L396,47 L400,25 L500,25"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* ── Right form panel ─────────────────────────────── */}
      <div
        style={{
          flex: 1,
          background: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px',
        }}
        className="max-md:!p-6"
      >
        <div style={{ width: '100%', maxWidth: 430 }}>

          {registerSuccess && (
            <div
              style={{
                marginBottom: 20,
                padding: '11px 14px',
                background: 'var(--green-bg)',
                border: '1px solid var(--green-bdr)',
                borderRadius: 'var(--r)',
                fontSize: 13.5,
                color: 'var(--green)',
                fontWeight: 500,
              }}
            >
              ✓ {registerSuccess}
            </div>
          )}

          <h1
            style={{
              fontSize: 26,
              fontWeight: 600,
              color: 'var(--ink)',
              letterSpacing: -0.3,
              marginBottom: 6,
            }}
          >
            {isRegistering ? 'Δημιουργία Λογαριασμού' : 'Καλώς ήρθατε'}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 30 }}>
            {isRegistering ? 'Εγγραφείτε ως ασθενής στο CardioTrack.' : 'Επιλέξτε ρόλο και συνδεθείτε στο σύστημα.'}
          </p>

          {/* Role selector - only show when logging in */}
          {!isRegistering && (
            <div style={{ marginBottom: 26 }}>
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: 'var(--ink-3)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.7,
                  marginBottom: 10,
                }}
              >
                Ρόλος
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {ROLES.map(r => {
                  const on = role === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => selectRole(r)}
                      style={{
                        padding: '12px 14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border-s)'}`,
                        borderRadius: 'var(--r-lg)',
                        background: on ? 'var(--primary-bg)' : 'var(--bg)',
                        fontFamily: 'var(--font)',
                        transition: 'all 0.12s',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: on ? 'var(--primary)' : 'var(--ink)',
                          marginBottom: 3,
                        }}
                      >
                        {r.label}
                      </div>
                      <div
                        style={{
                          fontSize: 11.5,
                          lineHeight: 1.4,
                          color: on ? 'oklch(55% 0.15 245)' : 'var(--ink-3)',
                        }}
                      >
                        {r.sub}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {isRegistering && (
              <FormInput
                label="Ονοματεπώνυμο"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="π.χ. Ιωάννης Παπαδόπουλος"
              />
            )}
            <FormInput
              label="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              mono
              placeholder="email@example.com"
            />
            <FormInput
              label="Κωδικός πρόσβασης"
              type="password"
              value={password}
              onChange={e => {
                setPassword(e.target.value);
                setPwError('');
              }}
              placeholder="••••••••"
              error={pwError}
            />

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 4,
                padding: '11px 0',
                fontSize: 15,
                fontWeight: 600,
                background: loading ? 'var(--primary-bg)' : 'var(--primary)',
                color: loading ? 'var(--primary)' : '#fff',
                border: `1px solid ${loading ? 'var(--primary-bdr)' : 'transparent'}`,
                borderRadius: 'var(--r)',
                cursor: loading ? 'wait' : 'pointer',
                fontFamily: 'var(--font)',
                transition: 'all 0.15s',
                boxShadow: loading ? 'none' : '0 1px 2px oklch(0% 0 0 / .18)',
              }}
            >
              {loading ? (isRegistering ? 'Εγγραφή…' : 'Σύνδεση…') : (isRegistering ? 'Εγγραφή →' : 'Σύνδεση →')}
            </button>
          </form>

          {/* Toggle login/register */}
          <div style={{ marginTop: 18, textAlign: 'center', fontSize: 13.5, color: 'var(--ink-3)' }}>
            {isRegistering ? (
              <>
                Έχετε ήδη λογαριασμό;{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(false);
                    setPwError('');
                    setRegisterSuccess('');
                    // Reset to default role inputs
                    setRole(ROLES[0].id);
                    setEmail(ROLES[0].email);
                    setPassword(ROLES[0].password);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    padding: 0,
                    fontFamily: 'var(--font)',
                  }}
                >
                  Σύνδεση
                </button>
              </>
            ) : (
              <>
                Δεν έχετε λογαριασμό;{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(true);
                    setEmail('');
                    setPassword('');
                    setName('');
                    setPwError('');
                    setRegisterSuccess('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    padding: 0,
                    fontFamily: 'var(--font)',
                  }}
                >
                  Εγγραφή ασθενούς
                </button>
              </>
            )}
          </div>

          {/* Demo hint - only show when logging in */}
          {!isRegistering && (
            <div
              style={{
                marginTop: 22,
                padding: '11px 14px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r)',
                fontSize: 12.5,
                color: 'var(--ink-3)',
                lineHeight: 1.6,
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>Demo: </span>
              Επιλέξτε ρόλο — email &amp; password συμπληρώνονται αυτόματα.
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
