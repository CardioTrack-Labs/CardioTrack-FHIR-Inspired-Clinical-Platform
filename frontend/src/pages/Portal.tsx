// src/pages/Portal.tsx — CardioTrack
// Patient Portal Dashboard — consumer-facing, patient-self view
// ─────────────────────────────────────────────────────────────
// Props: { navigate, currentUser }
// The component resolves the patient record by matching currentUser.id,
// then fetches observations, medications and conditions in parallel.
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useMemo } from 'react';
import { ctApi } from '../lib/api';
import { User, Patient, Observation, Medication, Condition, Report } from '../types/fhir';
import { CTAvatar, CTBadge } from '../components/ui';
import { Send, MessageSquare } from 'lucide-react';

// ── Props ─────────────────────────────────────────────────────
interface PortalProps {
  navigate: (page: string, params?: Record<string, unknown>) => void;
  currentUser: User | null;
}

// ── Tiny helpers ──────────────────────────────────────────────
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Καλημέρα';
  if (h < 18) return 'Καλό απόγευμα';
  return 'Καλησπέρα';
}

function todayLabel(): string {
  return new Date().toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}


function doctorInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}

const PORTAL_TABS = ['Αρχική', 'Vitals', 'Φάρμακα', 'Ραντεβού', 'Μηνύματα', 'Αναφορές'] as const;
type PortalTab = typeof PORTAL_TABS[number];

// ── SVG Sparkline ─────────────────────────────────────────────
interface SparklineProps {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}

const Sparkline: React.FC<SparklineProps> = ({ data, color, width = 120, height = 36 }) => {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const sx = (i: number) => (i / (data.length - 1)) * width;
  const sy = (v: number) => height - ((v - min) / range) * (height - 4) - 2;
  const d = data.map((v, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
  const last = data[data.length - 1];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height, display: 'block' }}>
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={sx(data.length - 1)} cy={sy(last)} r={3} fill={color} />
    </svg>
  );
};

// ── NavBar ────────────────────────────────────────────────────
interface NavBarProps {
  patient: Patient | null;
  onLogout: () => void;
}

const PortalNavBar: React.FC<NavBarProps> = ({ patient, onLogout }) => {
  const doctorName = patient?.assigned_doctor?.name ?? '—';
  const patientName = patient?.user?.name ?? '';
  const initials = patientName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'var(--nav)', padding: '0 24px',
      height: 52, flexShrink: 0,
      borderBottom: '1px solid var(--nav-border)',
    }} className="max-md:!px-3 max-md:!gap-2">
      <span style={{ fontWeight: 700, fontSize: 16, color: 'oklch(90% 0.04 245)', letterSpacing: 0.3 }}>
        CardioTrack
      </span>
      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.18)', margin: '0 6px' }} className="max-md:!hidden" />
      <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.88)' }} className="max-md:!hidden">Η υγεία μου</span>
      <div style={{ flex: 1 }} />
      {doctorName !== '—' && (
        <>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginRight: 4 }} className="max-md:!hidden">Γιατρός:</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginRight: 8 }} className="max-md:!hidden">{doctorName}</span>
        </>
      )}
      <CTAvatar initials={initials || 'ΑΣ'} size={32} />
      <button
        onClick={onLogout}
        style={{
          marginLeft: 6, fontSize: 12, color: 'rgba(255,255,255,0.5)',
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font)', padding: '4px 8px',
          borderRadius: 4, transition: 'color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.9)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
      >
        ↪ Έξοδος
      </button>
    </div>
  );
};

// ── Tab Bar ───────────────────────────────────────────────────
const PortalTabBar: React.FC<{ active: PortalTab; onChange: (t: PortalTab) => void }> = ({ active, onChange }) => (
  <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg)', paddingLeft: 32, flexShrink: 0 }} className="max-md:!pl-4 max-md:overflow-x-auto max-md:whitespace-nowrap max-md:scrollbar-none">
    {PORTAL_TABS.map(tab => (
      <button
        key={tab}
        onClick={() => onChange(tab)}
        style={{
          padding: '12px 22px', fontSize: 14, cursor: 'pointer',
          fontWeight: active === tab ? 600 : 400,
          fontFamily: 'var(--font)',
          color: active === tab ? 'var(--primary)' : 'var(--ink-3)',
          background: 'none', border: 'none',
          borderBottom: `2px solid ${active === tab ? 'var(--primary)' : 'transparent'}`,
          marginBottom: -1, transition: 'color 0.15s',
        }}
        className="max-md:flex-shrink-0 max-md:!px-4"
      >
        {tab}
      </button>
    ))}
  </div>
);

// ── Vital Card (consumer-friendly) ───────────────────────────
interface VitalInfo {
  label: string;
  value: string;
  unit: string;
  status: 'normal' | 'elevated' | 'abnormal';
  note: string;
}

const PatientVitalCard: React.FC<VitalInfo> = ({ label, value, unit, status, note }) => {
  const abn = status !== 'normal';
  const color = abn ? 'var(--red)' : 'var(--green)';
  const bg    = abn ? 'var(--red-bg)' : 'var(--bg)';
  const bdr   = abn ? 'var(--red-bdr)' : 'var(--border)';
  return (
    <div style={{
      background: bg, border: `1.5px solid ${bdr}`,
      borderRadius: 'var(--r-lg)', padding: '18px 20px',
      boxShadow: 'var(--sh)', flex: '1 1 160px',
    }}>
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 500, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 700, color: abn ? 'var(--red)' : 'var(--ink)', fontFamily: 'var(--mono)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>{unit}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 10, fontSize: 12.5, fontWeight: 600, color }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
        {note}
      </div>
    </div>
  );
};

// ── Derive vital cards from observations ──────────────────────
function deriveVitals(observations: Observation[]): VitalInfo[] {
  const latest: Record<string, Observation> = {};
  for (const obs of observations) {
    const existing = latest[obs.type];
    if (!existing || new Date(obs.recorded_at) > new Date(existing.recorded_at)) {
      latest[obs.type] = obs;
    }
  }

  const cards: VitalInfo[] = [];

  const sys = latest['systolic_bp'];
  const dia = latest['diastolic_bp'];
  if (sys && dia) {
    const abn = sys.is_abnormal || dia.is_abnormal;
    cards.push({
      label: 'Πίεση αίματος',
      value: `${Math.round(sys.value)}/${Math.round(dia.value)}`,
      unit: 'mmHg',
      status: abn ? 'elevated' : 'normal',
      note: abn ? 'Ελαφρά αυξημένη' : 'Φυσιολογική',
    });
  }

  const hr = latest['heart_rate'];
  if (hr) {
    cards.push({
      label: 'Καρδιακοί παλμοί',
      value: String(Math.round(hr.value)),
      unit: 'bpm',
      status: hr.is_abnormal ? 'abnormal' : 'normal',
      note: hr.is_abnormal ? 'Μη φυσιολογικοί' : 'Φυσιολογικοί',
    });
  }

  const spo2 = latest['spo2'];
  if (spo2) {
    cards.push({
      label: 'Κορεσμός οξυγόνου',
      value: String(Math.round(spo2.value)),
      unit: '%',
      status: spo2.is_abnormal ? 'abnormal' : 'normal',
      note: spo2.is_abnormal ? 'Χαμηλός' : 'Φυσιολογικός',
    });
  }

  const gluc = latest['glucose'];
  if (gluc) {
    cards.push({
      label: 'Γλυκόζη',
      value: String(Math.round(gluc.value)),
      unit: 'mg/dL',
      status: gluc.is_abnormal ? 'elevated' : 'normal',
      note: gluc.is_abnormal ? 'Αυξημένη' : 'Φυσιολογική',
    });
  }

  return cards;
}

// ── Tab: Αρχική ───────────────────────────────────────────────
interface HomeTabProps {
  patient: Patient | null;
  vitals: VitalInfo[];
  bpTrend: number[];
  latestBP: string;
  medications: Medication[];
  medState: boolean[];
  setMedState: React.Dispatch<React.SetStateAction<boolean[]>>;
  onTabChange: (t: PortalTab) => void;
}

const HomeTab: React.FC<HomeTabProps> = ({
  patient, vitals, bpTrend, latestBP, medications, medState, setMedState, onTabChange,
}) => {
  const patientFirstName = patient?.user?.name?.split(' ')[0] ?? '';
  const doctorName = patient?.assigned_doctor?.name ?? '—';
  const morningMeds = medications.filter(m => m.frequency?.toLowerCase().includes('morning') || m.frequency?.toLowerCase().includes('πρωί') || m.frequency?.toLowerCase().includes('πρωινή'));
  // Fallback: if no freq info, show first half as morning
  const displayMorning = morningMeds.length > 0 ? morningMeds : medications.slice(0, Math.ceil(medications.length / 2));
  const takenCount = displayMorning.filter((_, i) => medState[i]).length;

  const bpAbn = bpTrend.length > 0 && bpTrend[bpTrend.length - 1] >= 140;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      {/* Greeting */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', margin: 0, letterSpacing: -0.3 }}>
            {greeting()}{patientFirstName ? `, ${patientFirstName}` : ''}
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 4 }}>
            {doctorName !== '—' && `Γιατρός: ${doctorName}`}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Σήμερα</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-2)' }}>{todayLabel()}</div>
        </div>
      </div>

      {/* Vitals strip */}
      {vitals.length > 0 && (
        <section>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12 }}>
            Τελευταίες μετρήσεις
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {vitals.map(v => <PatientVitalCard key={v.label} {...v} />)}
          </div>
        </section>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }} className="max-md:!grid-cols-1 max-md:!gap-4">
        {/* BP trend */}
        {bpTrend.length > 0 && (
          <section>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12 }}>
              Πίεση — τελευταίες {bpTrend.length} ημέρες
            </div>
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '16px 20px', boxShadow: 'var(--sh)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--mono)', color: bpAbn ? 'var(--red)' : 'var(--ink)', lineHeight: 1 }}>
                    {latestBP}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>mmHg · σήμερα</div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <Sparkline data={bpTrend} color="var(--primary)" />
                </div>
              </div>
              {bpAbn && (
                <div style={{ padding: '10px 12px', background: 'var(--red-bg)', border: '1px solid var(--red-bdr)', borderRadius: 'var(--r)', fontSize: 12.5, color: 'var(--red)' }}>
                  Η πίεσή σας είναι ελαφρά αυξημένη. Συνεχίστε τα φάρμακα κανονικά.
                </div>
              )}
              {!bpAbn && (
                <div style={{ padding: '10px 12px', background: 'var(--green-bg)', border: '1px solid var(--green-bdr, var(--border))', borderRadius: 'var(--r)', fontSize: 12.5, color: 'var(--green)' }}>
                  Η πίεσή σας είναι φυσιολογική. Συνεχίστε την ίδια αγωγή!
                </div>
              )}
            </div>
          </section>
        )}

        {/* Morning meds quick view */}
        {displayMorning.length > 0 && (
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.7 }}>
                Φάρμακα σήμερα
              </div>
              <button
                onClick={() => onTabChange('Φάρμακα')}
                style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}
              >
                Όλα →
              </button>
            </div>
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh)', overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>
                ☀ Πρωί · {takenCount}/{displayMorning.length} ελήφθησαν
              </div>
              {displayMorning.map((m, i) => (
                <div
                  key={m.id}
                  onClick={() => setMedState(prev => { const n = [...prev]; n[i] = !n[i]; return n; })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 16px',
                    borderBottom: i < displayMorning.length - 1 ? '1px solid var(--border)' : 'none',
                    cursor: 'pointer',
                    background: medState[i] ? 'var(--green-bg)' : 'var(--bg)',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: 4,
                    border: `2px solid ${medState[i] ? 'var(--green)' : 'var(--border-s)'}`,
                    background: medState[i] ? 'var(--green)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, fontSize: 12, color: '#fff',
                    transition: 'all 0.15s',
                  }}>
                    {medState[i] ? '✓' : ''}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: medState[i] ? 'var(--ink-3)' : 'var(--ink)', textDecoration: medState[i] ? 'line-through' : 'none' }}>
                      {m.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{m.dosage}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Conditions snippet */}
    </div>
  );
};

// ── Tab: Vitals ───────────────────────────────────────────────
interface VitalsTabProps {
  vitals: VitalInfo[];
  bpTrend: number[];
  diaTrend: number[];
}

const PortalVitalsTab: React.FC<VitalsTabProps> = ({ vitals, bpTrend, diaTrend }) => {
  const sysMean = bpTrend.length ? Math.round(bpTrend.reduce((a, b) => a + b, 0) / bpTrend.length) : 0;
  const sysMax = bpTrend.length ? Math.max(...bpTrend) : 0;
  const sysMin = bpTrend.length ? Math.min(...bpTrend) : 0;
  const diaMean = diaTrend.length ? Math.round(diaTrend.reduce((a, b) => a + b, 0) / diaTrend.length) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {vitals.length > 0 && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {vitals.map(v => <PatientVitalCard key={v.label} {...v} />)}
        </div>
      )}

      {bpTrend.length > 1 && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '18px 20px', boxShadow: 'var(--sh)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 14 }}>
            Πίεση αίματος — τελευταίες {bpTrend.length} ημέρες
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
            {bpTrend.map((v, i) => {
              const h = Math.max(4, ((v - 100) / 60) * 80);
              const abn = v >= 140;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }} title={`${v} mmHg`}>
                  <div style={{
                    width: '100%', height: h,
                    borderRadius: '3px 3px 0 0',
                    background: abn ? 'var(--red)' : 'var(--primary)',
                    opacity: 0.85,
                    transition: 'all 0.2s',
                  }} />
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--surface)', borderRadius: 'var(--r)', fontSize: 13, color: 'var(--ink-2)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>Μέσος: <strong>{sysMean}/{diaMean}</strong></span>
            <span style={{ color: 'var(--ink-3)' }}>|</span>
            <span>Υψηλότερη: <strong style={{ color: 'var(--red)' }}>{sysMax}</strong></span>
            <span style={{ color: 'var(--ink-3)' }}>|</span>
            <span>Χαμηλότερη: <strong style={{ color: 'var(--green)' }}>{sysMin}</strong></span>
          </div>
        </div>
      )}

      <div style={{ padding: '14px 18px', background: 'var(--amber-bg)', border: '1px solid var(--amber-bdr)', borderRadius: 'var(--r-lg)', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>
        <span style={{ fontWeight: 600, color: 'var(--amber)' }}>Υπενθύμιση: </span>
        Καταγράψτε την πίεσή σας κάθε πρωί πριν τα φάρμακα. Στόχος: κάτω από 140/90 mmHg.
      </div>

      {vitals.length === 0 && bpTrend.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink-3)', fontSize: 14 }}>
          Δεν υπάρχουν καταγεγραμμένες μετρήσεις ακόμα.
        </div>
      )}
    </div>
  );
};

// ── Tab: Φάρμακα ──────────────────────────────────────────────
interface MedsTabProps {
  medications: Medication[];
  medState: boolean[];
  setMedState: React.Dispatch<React.SetStateAction<boolean[]>>;
  doctorName: string;
}

const PortalMedsTab: React.FC<MedsTabProps> = ({ medications, medState, setMedState, doctorName }) => {
  // Split by frequency keywords; if no match, split half/half
  const morning = medications.filter(m => {
    const f = (m.frequency ?? '').toLowerCase();
    return f.includes('morning') || f.includes('πρωί') || f.includes('πρωινή') || f.includes('once');
  });
  const evening = medications.filter(m => {
    const f = (m.frequency ?? '').toLowerCase();
    return f.includes('evening') || f.includes('night') || f.includes('βράδυ') || f.includes('βραδινή');
  });

  // Fallback: if no keyword info at all, split in half
  const useFallback = morning.length === 0 && evening.length === 0 && medications.length > 0;
  const displayMorning = useFallback ? medications.slice(0, Math.ceil(medications.length / 2)) : morning;
  const displayEvening = useFallback ? medications.slice(Math.ceil(medications.length / 2)) : evening;

  const morningOffset = 0;
  const eveningOffset = displayMorning.length;

  const MedList: React.FC<{ meds: Medication[]; offset: number; label: string; icon: string }> = ({ meds, offset, label, icon }) => (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--sh)' }}>
      <div style={{ padding: '12px 18px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)' }}>{label}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-3)' }}>
          {meds.filter((_, i) => medState[offset + i]).length}/{meds.length} ελήφθησαν
        </span>
      </div>
      {meds.length === 0 && (
        <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--ink-3)' }}>Δεν υπάρχουν φάρμακα για αυτή την ώρα.</div>
      )}
      {meds.map((m, i) => (
        <div
          key={m.id}
          onClick={() => setMedState(prev => { const n = [...prev]; n[offset + i] = !n[offset + i]; return n; })}
          style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '13px 18px',
            borderBottom: i < meds.length - 1 ? '1px solid var(--border)' : 'none',
            cursor: 'pointer',
            background: medState[offset + i] ? 'var(--green-bg)' : 'var(--bg)',
            transition: 'background 0.15s',
          }}
        >
          <div style={{
            width: 24, height: 24, borderRadius: 6,
            border: `2px solid ${medState[offset + i] ? 'var(--green)' : 'var(--border-s)'}`,
            background: medState[offset + i] ? 'var(--green)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, fontSize: 13, color: '#fff',
            transition: 'all 0.15s',
          }}>
            {medState[offset + i] ? '✓' : ''}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 14.5, fontWeight: 500,
              color: medState[offset + i] ? 'var(--ink-3)' : 'var(--ink)',
              textDecoration: medState[offset + i] ? 'line-through' : 'none',
            }}>
              {m.name} <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{m.dosage}</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>{m.frequency}</div>
          </div>
          <CTBadge label={m.status === 'active' ? 'Ενεργό' : 'Διακοπή'} variant={m.status === 'active' ? 'active' : 'resolved'} />
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <MedList meds={displayMorning} offset={morningOffset} label="Πρωί — 08:00" icon="☀" />
      <MedList meds={displayEvening} offset={eveningOffset} label="Βράδυ — 22:00" icon="🌙" />
      <div style={{ padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>
        Κλικ σε κάθε φάρμακο για να επισημάνετε ότι το λάβατε.
        {doctorName !== '—' && ` Επικοινωνήστε με τον ${doctorName} για αλλαγές στη δοσολογία.`}
      </div>
    </div>
  );
};

// ── Tab: Ραντεβού ─────────────────────────────────────────────
interface AppointmentEntry {
  type: string;
  doctor: string;
  specialty: string;
  date: string;
  time: string;
  monthLabel: string;
  dayLabel: string;
  isNext: boolean;
}

// Static demo appointments (backend has no appointment endpoint yet)
function demoAppointments(doctorName: string): AppointmentEntry[] {
  if (!doctorName || doctorName === '—') return [];
  return [
    {
      type: 'Τακτικός έλεγχος',
      doctor: doctorName,
      specialty: 'Καρδιολόγος',
      date: 'Δευτέρα, 16 Ιουνίου 2025',
      time: '10:30',
      monthLabel: 'ΙΟΥ',
      dayLabel: '16',
      isNext: true,
    },
    {
      type: 'Αποτελέσματα lab',
      doctor: doctorName,
      specialty: 'Καρδιολόγος',
      date: 'Δευτέρα, 14 Ιουλίου 2025',
      time: '11:00',
      monthLabel: 'ΙΟΥ',
      dayLabel: '14',
      isNext: false,
    },
  ];
}

const PortalAppointmentsTab: React.FC<{ doctorName: string }> = ({ doctorName }) => {
  const appointments = demoAppointments(doctorName);
  const drInitials = doctorInitials(doctorName);

  if (appointments.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-3)', fontSize: 14 }}>
        Δεν υπάρχουν προγραμματισμένα ραντεβού.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {appointments.map((a, i) => (
        <div
          key={i}
          style={{
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)', padding: '18px 22px',
            boxShadow: 'var(--sh)', display: 'flex', alignItems: 'center', gap: 18,
          }}
        >
          <div style={{
            flexShrink: 0, width: 56, height: 56,
            borderRadius: 'var(--r-lg)',
            background: a.isNext ? 'var(--primary-bg)' : 'var(--surface)',
            border: `1px solid ${a.isNext ? 'var(--primary-bdr)' : 'var(--border)'}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: a.isNext ? 'var(--primary)' : 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
              {a.monthLabel}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: a.isNext ? 'var(--primary)' : 'var(--ink-2)', fontFamily: 'var(--mono)', lineHeight: 1 }}>
              {a.dayLabel}
            </div>
          </div>
          <CTAvatar initials={drInitials || 'ΔΡ'} size={42} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{a.type}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 3 }}>{a.doctor} · {a.specialty}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 2 }}>{a.date} στις {a.time}</div>
          </div>
          {a.isNext && <CTBadge label="Επόμενο" variant="pending" />}
        </div>
      ))}
    </div>
  );
};

// ── Tab: Αναφορές ─────────────────────────────────────────────
interface PortalReportsTabProps {
  conditions: Condition[];
  reports: Report[];
}

const PortalReportsTab: React.FC<PortalReportsTabProps> = ({ conditions, reports }) => {
  const getFileUrl = (url: string) => {
    if (url.startsWith('http')) return url;
    const base = (import.meta.env.VITE_API_URL || '').replace('/api/v1', '');
    return `${base || 'http://localhost:8080'}${url}`;
  };

  const getReportIcon = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'ECG': return '♡';
      case 'LAB': return '◎';
      case 'IMAGING': return 'Θ';
      case 'DISCHARGE': return '≡';
      default: return '🗎';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Conditions summary */}
      {conditions.length > 0 && (
        <section>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12 }}>
            Διαγνώσεις
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {conditions.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.status === 'active' ? 'var(--amber)' : c.status === 'resolved' ? 'var(--green)' : 'var(--ink-3)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{c.description}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                    {c.icd10Code} · {c.status === 'active' ? 'Ενεργή' : c.status === 'chronic' ? 'Χρόνια' : 'Αντιμετωπίστηκε'}
                    {c.onset_date && ` · από ${new Date(c.onset_date).getFullYear()}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Reports list */}
      <section>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12 }}>
          Έγγραφα
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reports.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', color: 'var(--ink-3)', fontSize: 13.5 }}>
              Δεν υπάρχουν ακόμη καταχωρημένες κλινικές αναφορές.
            </div>
          ) : (
            reports.map((r) => (
              <div
                key={r.id}
                onClick={() => window.open(getFileUrl(r.file_url), '_blank')}
                style={{
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-lg)', padding: '16px 20px',
                  boxShadow: 'var(--sh)', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 8,
                  background: 'var(--primary-bg)', border: '1px solid var(--primary-bdr)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, color: 'var(--primary)', flexShrink: 0,
                }}>
                  {getReportIcon(r.report_type)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{r.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>
                    {new Date(r.report_date).toLocaleDateString('el-GR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })} · {r.uploaded_by?.name || 'Δρ. Νικολάου'}
                  </div>
                </div>
                <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 500 }}>Προβολή ↓</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

// ── Loading skeleton ──────────────────────────────────────────
const PortalSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '32px' }}>
    {[200, 120, 180].map((w, i) => (
      <div key={i} style={{ height: w, background: 'var(--surface)', borderRadius: 'var(--r-lg)', animation: 'pulse 1.5s ease-in-out infinite' }} />
    ))}
  </div>
);

// ── Tab: Μηνύματα (Clinical Chat) ─────────────────────────────
interface PortalMessagesTabProps {
  patient: Patient | null;
  currentUser: User | null;
}

const PortalMessagesTab: React.FC<PortalMessagesTabProps> = ({ patient, currentUser }) => {
  const doctorId = patient?.assigned_doctor?.id || patient?.assigned_doctor_id || 2;
  const doctorName = patient?.assigned_doctor?.name || 'Δρ. Smith';
  const doctorRole = patient?.assigned_doctor?.role || 'doctor';
  
  const drInitials = doctorName
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

  const getInitialMessages = () => {
    if (currentUser?.id === 5) {
      return [
        { sender: 'patient' as const, text: 'Καλημέρα γιατρέ. Σας στέλνω γιατί ένιωσα ένα ελαφρύ σφίξιμο στο στήθος πριν από περίπου μία ώρα κατά τη διάρκεια ήπιας βάδισης.', time: '10:20' },
        { sender: 'doctor' as const, text: 'Καλημέρα Γεώργιε. Το σφίξιμο αντανακλά κάπου αλλού, π.χ. στο αριστερό χέρι ή στην πλάτη; Συνοδεύεται από δύσπνοια ή εφίδρωση;', time: '10:22' },
        { sender: 'patient' as const, text: 'Όχι, δεν αντανακλά κάπου αλλού. Απλά ένιωσα λίγο σφίξιμο. Τώρα που κάθομαι έχει υποχωρήσει κάπως, αλλά εξακολουθώ να ανησυχώ.', time: '10:24' }
      ];
    }
    return [
      { sender: 'doctor' as const, text: `Καλημέρα! Είμαι ο/η ${doctorName}, ο προσωπικός σας ιατρός. Πώς μπορώ να σας βοηθήσω σήμερα;`, time: '09:00' }
    ];
  };

  const [messages, setMessages] = useState<Array<{ sender: 'patient' | 'doctor'; text: string; time: string }>>(getInitialMessages);
  const [inputText, setInputText] = useState('');
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!currentUser) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let host = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/^http:\/\/|^https:\/\//, '') : 'localhost:8080';
    // Strip trailing /api/v1 since WS endpoints are registered at root level in Go
    host = host.replace(/\/api\/v1\/?$/, '');
    const wsUrl = `${protocol}//${host}/ws?user_id=${currentUser.id}&role=${currentUser.role}`;

    console.log('[WS Patient] Connecting to:', wsUrl);
    setWsStatus('connecting');
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WS Patient] Connected successfully');
      setWsStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[WS Patient] Message received:', data);

        // Ensure the message is from our assigned doctor
        if (data.sender_id === doctorId) {
          setMessages(prev => [
            ...prev,
            {
              sender: 'doctor',
              text: data.text,
              time: data.time || new Date().toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })
            }
          ]);
        }
      } catch (err) {
        console.error('[WS Patient] Parse failed:', err);
      }
    };

    ws.onclose = () => {
      console.log('[WS Patient] Disconnected');
      setWsStatus('disconnected');
    };

    ws.onerror = (err) => {
      console.error('[WS Patient] Socket error:', err);
      setWsStatus('disconnected');
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, [currentUser, doctorId]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const timeStr = new Date().toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
    const payload = {
      sender_id: currentUser?.id,
      receiver_id: doctorId,
      text: inputText,
      time: timeStr
    };

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
      console.log('[WS Patient] Outbound message sent:', payload);
    }

    setMessages(prev => [
      ...prev,
      {
        sender: 'patient',
        text: inputText,
        time: timeStr
      }
    ]);
    setInputText('');
  };

  const getStatusColor = () => {
    if (wsStatus === 'connected') return 'var(--green)';
    if (wsStatus === 'connecting') return 'var(--amber)';
    return 'var(--ink-3)';
  };

  const getStatusLabel = () => {
    if (wsStatus === 'connected') return 'Σε σύνδεση';
    if (wsStatus === 'connecting') return 'Σύνδεση...';
    return 'Αποσυνδεδεμένος';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)', animation: 'fadeIn 0.2s ease-in-out' }}>
      
      {/* Active Doctor Header */}
      <div style={{
        padding: '14px 20px',
        border: '1px solid var(--border)',
        borderBottom: 'none',
        borderRadius: 'var(--r-lg) var(--r-lg) 0 0',
        background: 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: 'var(--sh)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <CTAvatar initials={drInitials || 'ΔΡ'} size={38} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>{doctorName}</span>
              <CTBadge
                label={doctorRole === 'cardiologist' ? 'Καρδιολόγος' : 'Θεράπων Ιατρός'}
                variant={doctorRole === 'cardiologist' ? 'chronic' : 'pending'}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: getStatusColor(),
                display: 'inline-block'
              }} />
              <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{getStatusLabel()}</span>
            </div>
          </div>
        </div>
        <span style={{ fontSize: 12, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <MessageSquare size={13} /> Απευθείας κανάλι επικοινωνίας
        </span>
      </div>

      {/* Chat Messages Panel */}
      <div style={{
        flex: 1,
        border: '1px solid var(--border)',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: 'var(--sh)'
      }}>
        
        {/* Scrollable Message History */}
        <div style={{
          flex: 1,
          padding: 20,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 14
        }}>
          {messages.map((m, i) => {
            const isPatient = m.sender === 'patient';
            return (
              <div
                key={i}
                style={{
                  alignSelf: isPatient ? 'flex-end' : 'flex-start',
                  maxWidth: '70%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isPatient ? 'flex-end' : 'flex-start',
                  animation: 'fadeIn 0.15s ease-out'
                }}
              >
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--r-lg)',
                    background: isPatient ? 'var(--primary)' : 'var(--surface-2)',
                    color: isPatient ? '#fff' : 'var(--ink)',
                    fontSize: 13.5,
                    lineHeight: 1.45,
                    boxShadow: 'var(--sh)',
                  }}
                >
                  {m.text}
                </div>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4, fontFamily: 'var(--mono)' }}>
                  {m.time}
                </span>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Form Input */}
        <form onSubmit={handleSend} style={{
          padding: 14,
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 10,
          background: 'var(--surface)'
        }}>
          <input
            type="text"
            placeholder="Πληκτρολογήστε ένα μήνυμα για τον ιατρό σας..."
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            style={{
              flex: 1,
              padding: '9px 14px',
              fontSize: 14,
              border: '1px solid var(--border-s)',
              borderRadius: 'var(--r)',
              background: 'var(--bg)',
              color: 'var(--ink)',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 16px',
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--r)',
              cursor: 'pointer',
              fontSize: 13.5,
              fontWeight: 600,
              gap: 6,
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'oklch(from var(--primary) calc(l - 0.05) c h)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
          >
            <Send size={14} /> Αποστολή
          </button>
        </form>

      </div>
    </div>
  );
};

// ── Main Portal Component ─────────────────────────────────────
export const Portal: React.FC<PortalProps> = ({ navigate: _navigate, currentUser }) => {
  const [activeTab, setActiveTab] = useState<PortalTab>('Αρχική');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [medState, setMedState] = useState<boolean[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolve patient profile for this user, then load clinical data
  useEffect(() => {
    if (!currentUser) return;
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch the patient profile for this logged-in user via /patients/me
        const myPatient = await ctApi.getMyPatientProfile().catch(() => null);
        if (!active) return;
        setPatient(myPatient);

        if (myPatient) {
          const [obs, meds, conds, reps] = await Promise.all([
            ctApi.getObservations(myPatient.id),
            ctApi.getMedications(myPatient.id),
            ctApi.getConditions(myPatient.id),
            ctApi.getReports(myPatient.id),
          ]);
          if (!active) return;
          setObservations(obs ?? []);
          const activeMeds = (meds ?? []).filter(m => m.status === 'active');
          setMedications(activeMeds);
          setMedState(new Array(activeMeds.length).fill(false));
          setConditions(conds ?? []);
          setReports(reps ?? []);
        }
      } catch (err) {
        if (active) setError('Αδυναμία φόρτωσης δεδομένων. Παρακαλώ δοκιμάστε αργότερα.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, [currentUser]);

  // Derived data
  const vitals = useMemo(() => deriveVitals(observations), [observations]);

  const bpTrend = useMemo(() => {
    const sysObs = observations
      .filter(o => o.type === 'systolic_bp')
      .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
    return sysObs.slice(-14).map(o => Math.round(o.value));
  }, [observations]);

  const diaTrend = useMemo(() => {
    const diaObs = observations
      .filter(o => o.type === 'diastolic_bp')
      .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
    return diaObs.slice(-14).map(o => Math.round(o.value));
  }, [observations]);

  const latestBP = useMemo(() => {
    if (bpTrend.length === 0 || diaTrend.length === 0) return '—';
    return `${bpTrend[bpTrend.length - 1]}/${diaTrend[diaTrend.length - 1]}`;
  }, [bpTrend, diaTrend]);

  const doctorName = patient?.assigned_doctor?.name ?? '—';

  const handleLogout = () => {
    (window as unknown as { ctLogout?: () => void }).ctLogout?.();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
      <PortalNavBar patient={patient} onLogout={handleLogout} />
      <PortalTabBar active={activeTab} onChange={setActiveTab} />

      <main style={{
        flex: 1, overflow: 'auto',
        padding: '28px 32px',
        maxWidth: 900, width: '100%',
        margin: '0 auto', boxSizing: 'border-box',
      }}>
        {loading && <PortalSkeleton />}

        {!loading && error && (
          <div style={{ padding: '20px 24px', background: 'var(--red-bg)', border: '1px solid var(--red-bdr)', borderRadius: 'var(--r-lg)', color: 'var(--red)', fontSize: 14 }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {activeTab === 'Αρχική' && (
              <HomeTab
                patient={patient}
                vitals={vitals}
                bpTrend={bpTrend}
                latestBP={latestBP}
                medications={medications}
                medState={medState}
                setMedState={setMedState}
                onTabChange={setActiveTab}
              />
            )}
            {activeTab === 'Vitals' && (
              <PortalVitalsTab vitals={vitals} bpTrend={bpTrend} diaTrend={diaTrend} />
            )}
            {activeTab === 'Φάρμακα' && (
              <PortalMedsTab
                medications={medications}
                medState={medState}
                setMedState={setMedState}
                doctorName={doctorName}
              />
            )}
            {activeTab === 'Ραντεβού' && (
              <PortalAppointmentsTab doctorName={doctorName} />
            )}
            {activeTab === 'Μηνύματα' && (
              <PortalMessagesTab patient={patient} currentUser={currentUser} />
            )}
            {activeTab === 'Αναφορές' && (
              <PortalReportsTab conditions={conditions} reports={reports} />
            )}
          </>
        )}
      </main>
    </div>
  );
};
