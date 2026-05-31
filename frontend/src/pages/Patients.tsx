import React, { useState, useEffect, useMemo } from 'react';
import { ctApi } from '../lib/api';
import { User } from '../types/fhir';
import { CTBtn, CTBadge, CTAvatar } from '../components/ui';

interface PatientsProps {
  navigate: (page: string, params?: Record<string, unknown>) => void;
  currentUser: User | null;
}

interface MappedPatient {
  id: string;
  dbId: number;
  name: string;
  initials: string;
  age: number;
  gender: string;
  blood: string;
  primary: { code: string; desc: string };
  lastObs: string;
  daysAgo: number;
  bp: { sys: number; dia: number };
  hr: number;
  heart: { score: number; cat: string };
  status: 'critical' | 'active' | 'stable' | string;
  alerts: number;
}

const FILTER_OPTS = ['Όλοι', 'Κρίσιμοι', 'Ενεργοί', 'Σταθεροί'];
const SORT_OPTS = [
  { value: 'lastObs', label: 'Τελ. παρατήρηση' },
  { value: 'heart',   label: 'HEART Score ↓'   },
  { value: 'name',    label: 'Όνομα Α→Ω'        },
  { value: 'age',     label: 'Ηλικία ↓'         },
];

const NAV_ITEMS = [
  { id: 'patients', label: 'Ασθενείς'  },
  { id: 'schedule', label: 'Πρόγραμμα' },
  { id: 'messages', label: 'Μηνύματα'  },
  { id: 'reports',  label: 'Αναφορές'  },
  { id: 'settings', label: 'Ρυθμίσεις' },
];

// ── NavBar ─────────────────────────────────────────────────
interface NavBarProps {
  alertCount: number;
  currentUser: User | null;
}

const NavBar: React.FC<NavBarProps> = ({ alertCount, currentUser }) => {
  const name = currentUser ? currentUser.name : 'Δρ. Νικολάου';
  const initials = currentUser ? currentUser.name.split(' ').map(n => n[0]).join('') : 'ΝΙ';
  
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--nav)',
        padding: '0 24px',
        height: 52,
        flexShrink: 0,
        borderBottom: '1px solid var(--nav-border)',
      }}
    >
      <span style={{ fontWeight: 700, fontSize: 16, color: 'oklch(90% 0.04 245)', letterSpacing: 0.3 }}>
        CardioTrack
      </span>
      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.18)', margin: '0 6px' }} />
      <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.88)' }}>Ασθενείς</span>
      <div style={{ flex: 1 }} />
      {alertCount > 0 && (
        <span
          style={{
            padding: '3px 11px',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            background: 'var(--red-bg)',
            border: '1px solid var(--red-bdr)',
            color: 'var(--red)',
          }}
        >
          ● {alertCount} ειδοποιήσεις
        </span>
      )}
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginLeft: 10 }}>{name}</span>
      <CTAvatar initials={initials} size={32} bg="oklch(30% 0.06 255)" color="oklch(80% 0.08 245)" border="oklch(40% 0.07 255)" />
      <button
        onClick={() => (window as unknown as { ctLogout?: () => void }).ctLogout?.()}
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.5)',
          cursor: 'pointer',
          fontSize: 12,
          marginLeft: 12,
          fontFamily: 'var(--font)',
          transition: 'color 0.12s',
          outline: 'none',
        }}
        onMouseEnter={e => (e.target as HTMLButtonElement).style.color = '#fff'}
        onMouseLeave={e => (e.target as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)'}
      >
        Έξοδος ↪
      </button>
    </div>
  );
};

// ── Doctor left nav ────────────────────────────────────────
interface DocNavProps {
  active: string;
  currentUser: User | null;
}

const DocNav: React.FC<DocNavProps> = ({ active, currentUser }) => {
  const label = currentUser ? currentUser.name : 'Δρ. Νικολάου';
  return (
    <div
      style={{
        width: 196,
        flexShrink: 0,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 16,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          color: 'var(--ink-3)',
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          padding: '0 18px',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {NAV_ITEMS.map(item => {
        const on = item.id === active;
        return (
          <button
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '9px 18px',
              fontSize: 14,
              fontWeight: on ? 600 : 400,
              color: on ? 'var(--primary)' : 'var(--ink-2)',
              background: on ? 'var(--primary-bg)' : 'transparent',
              border: 'none',
              borderRight: `2px solid ${on ? 'var(--primary)' : 'transparent'}`,
              cursor: 'pointer',
              fontFamily: 'var(--font)',
              textAlign: 'left',
              width: '100%',
              transition: 'background 0.12s, color 0.12s',
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
};

// ── Stats strip ────────────────────────────────────────────
const StatsStrip: React.FC<{ patients: MappedPatient[] }> = ({ patients }) => {
  const total    = patients.length;
  const critical = patients.filter(p => p.status === 'critical').length;
  const highRisk = patients.filter(p => p.heart.cat === 'high').length;
  const alerts   = patients.reduce((s, p) => s + p.alerts, 0);
  
  const stats = [
    { label: 'Σύνολο Ασθενών', value: total,    sub: 'υπό παρακολούθηση',        color: 'var(--ink)',     bg: 'var(--bg)',         bdr: 'var(--border)'      },
    { label: 'Κρίσιμοι',       value: critical,  sub: 'απαιτούν άμεση προσοχή',   color: 'var(--red)',     bg: 'var(--red-bg)',     bdr: 'var(--red-bdr)'     },
    { label: 'Υψηλός Κίνδυνος',value: highRisk,  sub: 'HEART score ≥ 7',          color: 'var(--amber)',   bg: 'var(--amber-bg)',   bdr: 'var(--amber-bdr)'   },
    { label: 'Ειδοποιήσεις',   value: alerts,    sub: 'νέες σήμερα',              color: 'var(--primary)', bg: 'var(--primary-bg)', bdr: 'var(--primary-bdr)' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 26 }}>
      {stats.map(s => (
        <div
          key={s.label}
          style={{
            background: s.bg,
            border: `1px solid ${s.bdr}`,
            borderRadius: 'var(--r-lg)',
            padding: '16px 20px',
            boxShadow: 'var(--sh)',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--ink-3)',
              textTransform: 'uppercase',
              letterSpacing: 0.7,
              marginBottom: 6,
            }}
          >
            {s.label}
          </div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 600,
              color: s.color,
              fontFamily: 'var(--mono)',
              lineHeight: 1.1,
            }}
          >
            {s.value}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{s.sub}</div>
        </div>
      ))}
    </div>
  );
};

// ── Toolbar ────────────────────────────────────────────────
interface ToolbarProps {
  search: string;
  onSearch: (v: string) => void;
  filter: string;
  onFilter: (v: string) => void;
  sort: string;
  onSort: (v: string) => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ search, onSearch, filter, onFilter, sort, onSort }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320 }}>
        <span
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 15,
            color: 'var(--ink-3)',
            pointerEvents: 'none',
          }}
        >
          ⌕
        </span>
        <input
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Όνομα, MRN, Διάγνωση…"
          style={{
            width: '100%',
            padding: '7px 12px 7px 32px',
            fontSize: 13.5,
            border: '1px solid var(--border-s)',
            borderRadius: 'var(--r)',
            background: 'var(--bg)',
            color: 'var(--ink)',
            fontFamily: 'var(--font)',
            outline: 'none',
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 5 }}>
        {FILTER_OPTS.map(f => (
          <button
            key={f}
            onClick={() => onFilter(f)}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              cursor: 'pointer',
              borderRadius: 'var(--r)',
              fontFamily: 'var(--font)',
              fontWeight: 500,
              border: `1px solid ${filter === f ? 'var(--primary)' : 'var(--border-s)'}`,
              background: filter === f ? 'var(--primary-bg)' : 'var(--bg)',
              color: filter === f ? 'var(--primary)' : 'var(--ink-2)',
              transition: 'all 0.12s',
            }}
          >
            {f}
          </button>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <select
        value={sort}
        onChange={e => onSort(e.target.value)}
        style={{
          padding: '6px 12px',
          fontSize: 13,
          border: '1px solid var(--border-s)',
          borderRadius: 'var(--r)',
          background: 'var(--bg)',
          color: 'var(--ink-2)',
          fontFamily: 'var(--font)',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        {SORT_OPTS.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <CTBtn label="+ Νέος Ασθενής" />
    </div>
  );
};

// ── Cell Helpers ───────────────────────────────────────────
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, [string, string]> = {
    critical: ['abnormal', 'Κρίσιμος'],
    active:   ['pending', 'Ενεργός'],
    stable:   ['normal', 'Σταθερός'],
  };
  const [variant, label] = map[status] || ['pending', 'Ενεργός'];
  return <CTBadge label={label} variant={variant as never} />;
};

const HeartScoreChip: React.FC<{ score: number; cat: string }> = ({ score, cat }) => {
  const color = cat === 'high' ? 'var(--red)' : cat === 'moderate' ? 'var(--amber)' : 'var(--green)';
  const bg    = cat === 'high' ? 'var(--red-bg)' : cat === 'moderate' ? 'var(--amber-bg)' : 'var(--green-bg)';
  const bdr   = cat === 'high' ? 'var(--red-bdr)' : cat === 'moderate' ? 'var(--amber-bdr)' : 'var(--green-bdr)';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 1,
        padding: '2px 9px',
        borderRadius: 4,
        background: bg,
        border: `1px solid ${bdr}`,
        fontFamily: 'var(--mono)',
        fontWeight: 600,
        color,
      }}
    >
      <span style={{ fontSize: 15 }}>{score}</span>
      <span style={{ fontSize: 11, opacity: 0.65 }}>/10</span>
    </span>
  );
};

const BPCell: React.FC<{ bp: { sys: number; dia: number }; hr: number }> = ({ bp, hr }) => {
  const abn = bp.sys >= 140 || bp.dia >= 90;
  return (
    <div>
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontWeight: 500,
          fontSize: 13.5,
          color: abn ? 'var(--red)' : 'var(--ink-2)',
        }}
      >
        {bp.sys}/{bp.dia}
        {abn && <span style={{ marginLeft: 4, fontSize: 11 }}>↑</span>}
      </span>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1 }}>HR {hr} bpm</div>
    </div>
  );
};

const LastObsCell: React.FC<{ lastObs: string; daysAgo: number }> = ({ lastObs, daysAgo }) => {
  const color = daysAgo === 0 ? 'var(--green)' : daysAgo <= 3 ? 'var(--ink-3)' : 'var(--amber)';
  const label = daysAgo === 0 ? '● σήμερα' : daysAgo === 1 ? 'χθες' : `${daysAgo}ημ. πριν`;
  return (
    <div>
      <div style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>{lastObs}</div>
      <div style={{ fontSize: 11.5, color, marginTop: 2 }}>{label}</div>
    </div>
  );
};

// ── Patient table ──────────────────────────────────────────
const COLS = ['Ασθενής', 'Ηλικία', 'Κύρια Διάγνωση', 'Τελ. Παρατήρηση', 'BP / HR', 'HEART', 'Κατάσταση', ''];

interface PatientTableProps {
  patients: MappedPatient[];
  navigate: (page: string, params?: Record<string, unknown>) => void;
}

const PatientTable: React.FC<PatientTableProps> = ({ patients, navigate }) => {
  const [hovered, setHovered] = useState<string | null>(null);

  if (patients.length === 0) {
    return (
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          padding: '56px 0',
          textAlign: 'center',
          color: 'var(--ink-3)',
          background: 'var(--bg)',
          boxShadow: 'var(--sh)',
        }}
      >
        Δεν βρέθηκαν ασθενείς για τα επιλεγμένα φίλτρα.
      </div>
    );
  }

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
        boxShadow: 'var(--sh)',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
        <thead>
          <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
            {COLS.map(c => (
              <th
                key={c}
                style={{
                  padding: '10px 16px',
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--ink-3)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.7,
                  whiteSpace: 'nowrap',
                }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {patients.map((p, i) => {
            const isCrit = p.status === 'critical';
            const isHov  = hovered === p.id;
            const baseBg = isCrit ? 'oklch(98.8% 0.008 25)' : i % 2 ? 'var(--surface)' : 'var(--bg)';
            
            return (
              <tr
                key={p.id}
                onClick={() => navigate('profile', { patientId: p.dbId })}
                onMouseEnter={() => setHovered(p.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  borderBottom: i < patients.length - 1 ? '1px solid var(--border)' : 'none',
                  background: isHov ? 'var(--primary-bg)' : baseBg,
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
              >
                <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CTAvatar
                      initials={p.initials}
                      size={36}
                      bg={isCrit ? 'var(--red-bg)' : 'var(--primary-bg)'}
                      color={isCrit ? 'var(--red)' : 'var(--primary)'}
                      border={isCrit ? 'var(--red-bdr)' : 'var(--primary-bdr)'}
                    />
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          fontWeight: 600,
                          color: 'var(--ink)',
                          fontSize: 14,
                        }}
                      >
                        {p.name}
                        {p.alerts > 0 && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 18,
                              height: 18,
                              borderRadius: '50%',
                              background: 'var(--red)',
                              color: '#fff',
                              fontSize: 10,
                              fontWeight: 700,
                            }}
                          >
                            {p.alerts}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--ink-3)',
                          fontFamily: 'var(--mono)',
                          marginTop: 1,
                        }}
                      >
                        {p.id}
                      </div>
                    </div>
                  </div>
                </td>
                <td
                  style={{
                    padding: '12px 16px',
                    verticalAlign: 'middle',
                    whiteSpace: 'nowrap',
                    color: 'var(--ink-2)',
                  }}
                >
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>{p.age}ε</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1 }}>{p.gender}</div>
                </td>
                <td style={{ padding: '12px 16px', verticalAlign: 'middle', maxWidth: 240 }}>
                  <div style={{ fontWeight: 500, fontSize: 13.5 }}>{p.primary.desc}</div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: 'var(--ink-3)',
                      fontFamily: 'var(--mono)',
                      marginTop: 2,
                    }}
                  >
                    {p.primary.code}
                  </div>
                </td>
                <td style={{ padding: '12px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                  <LastObsCell lastObs={p.lastObs} daysAgo={p.daysAgo} />
                </td>
                <td style={{ padding: '12px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                  <BPCell bp={p.bp} hr={p.hr} />
                </td>
                <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                  <HeartScoreChip score={p.heart.score} cat={p.heart.cat} />
                </td>
                <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                  <StatusBadge status={p.status} />
                </td>
                <td
                  style={{
                    padding: '12px 16px',
                    verticalAlign: 'middle',
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: isHov ? 'var(--primary)' : 'var(--ink-3)',
                      fontWeight: 500,
                      transition: 'color 0.1s',
                    }}
                  >
                    Προβολή →
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ── Patients Dashboard Page ───────────────────────────────────
export const Patients: React.FC<PatientsProps> = ({ navigate, currentUser }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Όλοι');
  const [sort,   setSort]   = useState('lastObs');
  const [patients, setPatients] = useState<MappedPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchPatients = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const filters: { doctor_id?: number } = {};
        if (currentUser && currentUser.role === 'doctor') {
          filters.doctor_id = currentUser.id;
        }

        const data = await ctApi.getPatients(filters);
        
        if (active) {
          const mapped: MappedPatient[] = data.map(p => {
            const dob = new Date(p.date_of_birth);
            const ageDiff = Date.now() - dob.getTime();
            const ageDate = new Date(ageDiff);
            const age = Math.abs(ageDate.getUTCFullYear() - 1970);
            
            const name = p.user ? p.user.name : 'Unknown';
            const nameParts = name.split(' ');
            const initials = nameParts.map(n => n[0]).join('');

            return {
              id: p.medical_record_number || `MRN-${p.id}`,
              dbId: p.id,
              name: name,
              initials,
              age,
              gender: p.gender === 'Male' ? 'Άνδρας' : p.gender === 'Female' ? 'Γυναίκα' : 'Άλλο',
              blood: p.blood_type || 'O+',
              primary: { code: 'I10', desc: 'Essential (primary) hypertension' },
              lastObs: 'Σήμερα', 
              daysAgo: 0,
              bp: { sys: 120, dia: 80 }, 
              hr: 72,
              heart: { score: 4, cat: 'moderate' },
              status: 'active', 
              alerts: 0,
            };
          });
          setPatients(mapped);
        }
      } catch (err: unknown) {
        if (active) {
          const msg = err instanceof Error ? err.message : 'Αποτυχία φόρτωσης ασθενών.';
          setError(msg);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchPatients();
    return () => {
      active = false;
    };
  }, [currentUser]);

  const totalAlerts = patients.reduce((s, p) => s + p.alerts, 0);

  const filtered = useMemo(() => {
    let list = [...patients];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          p.primary.desc.toLowerCase().includes(q) ||
          p.primary.code.toLowerCase().includes(q)
      );
    }
    if      (filter === 'Κρίσιμοι') list = list.filter(p => p.status === 'critical');
    else if (filter === 'Ενεργοί')  list = list.filter(p => p.status === 'active');
    else if (filter === 'Σταθεροί') list = list.filter(p => p.status === 'stable');

    if      (sort === 'heart') list.sort((a, b) => b.heart.score - a.heart.score);
    else if (sort === 'name')  list.sort((a, b) => a.name.localeCompare(b.name, 'el'));
    else if (sort === 'age')   list.sort((a, b) => b.age - a.age);
    else                       list.sort((a, b) => a.daysAgo - b.daysAgo);
    return list;
  }, [patients, search, filter, sort]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
        <NavBar alertCount={0} currentUser={currentUser} />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <DocNav active="patients" currentUser={currentUser} />
          <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 32px' }}>
            <div style={{ textAlign: 'center', color: 'var(--primary)' }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  border: '3px solid var(--primary-bg)',
                  borderTopColor: 'var(--primary)',
                  animation: 'ct-spin 1s linear infinite',
                  margin: '0 auto 16px',
                }}
              />
              <style>{`
                @keyframes ct-spin {
                  to { transform: rotate(360deg); }
                }
              `}</style>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-2)' }}>Φόρτωση λίστας ασθενών...</div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
        <NavBar alertCount={0} currentUser={currentUser} />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <DocNav active="patients" currentUser={currentUser} />
          <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 32px' }}>
            <div
              style={{
                maxWidth: 400,
                padding: '24px 32px',
                textAlign: 'center',
                background: 'var(--red-bg)',
                border: '1px solid var(--red-bdr)',
                borderRadius: 'var(--r-lg)',
                boxShadow: 'var(--sh)',
              }}
            >
              <div style={{ fontSize: 32, color: 'var(--red)', marginBottom: 12 }}>⚠️</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--red)', marginBottom: 8 }}>
                Σφάλμα Επικοινωνίας
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-2)', marginBottom: 16 }}>{error}</div>
              <CTBtn label="Προσπάθεια ξανά" onClick={() => window.location.reload()} />
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
      <NavBar alertCount={totalAlerts} currentUser={currentUser} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <DocNav active="patients" currentUser={currentUser} />
        <main style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', letterSpacing: -0.3, margin: 0 }}>
              Ασθενείς μου
            </h1>
            <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 4 }}>
              {currentUser ? currentUser.name : 'Δρ. Νικολάου'} ·{' '}
              {currentUser
                ? currentUser.role === 'cardiologist'
                  ? 'Καρδιολόγος'
                  : 'Ιατρός'
                : 'Καρδιολόγος'}{' '}
              · {patients.length} ασθενείς υπό παρακολούθηση
            </p>
          </div>
          <StatsStrip patients={patients} />
          <Toolbar
            search={search}
            onSearch={setSearch}
            filter={filter}
            onFilter={setFilter}
            sort={sort}
            onSort={setSort}
          />
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 10 }}>
            {filtered.length === patients.length
              ? `${patients.length} ασθενείς`
              : `${filtered.length} από ${patients.length} ασθενείς`}
          </div>
          <PatientTable patients={filtered} navigate={navigate} />
        </main>
      </div>
    </div>
  );
};
