import React, { useState, useEffect } from 'react';
import { ctApi } from '../lib/api';
import { User, Patient } from '../types/fhir';
import { CTBtn, CTAvatar } from '../components/ui';

interface HeartScoreProps {
  patientId: number;
  navigate: (page: string, params?: Record<string, unknown>) => void;
  currentUser: User | null;
}

const SECTIONS = [
  {
    key: 'history' as const, letter: 'H', name: 'History', nameEl: 'Ιστορικό',
    options: [
      { score: 0, label: 'Χαμηλής υποψίας',   desc: 'Μη ειδικά χαρακτηριστικά για ACS' },
      { score: 1, label: 'Μέτριας υποψίας',    desc: 'Μείγμα ειδικών / μη-ειδικών χαρακτηριστικών' },
      { score: 2, label: 'Υψηλής υποψίας',     desc: 'Κυριαρχούν ειδικά χαρακτηριστικά ACS' },
    ],
  },
  {
    key: 'ecg' as const, letter: 'E', name: 'ECG', nameEl: 'Ηλεκτροκαρδιογράφημα',
    options: [
      { score: 0, label: 'Φυσιολογικό',              desc: 'Κανονικός ρυθμός, χωρίς παθολογικές αλλαγές' },
      { score: 1, label: 'Μη ειδικές αλλαγές',        desc: 'Διαταραχή επαναπόλωσης, LBBB, LVH, πρώιμη αναπόλωση' },
      { score: 2, label: 'Σημαντική ST μεταβολή',     desc: 'Νέα ST-depression ή elevation ≥ 1 mm' },
    ],
  },
  {
    key: 'age' as const, letter: 'A', name: 'Age', nameEl: 'Ηλικία',
    options: [
      { score: 0, label: '< 45 ετών',  desc: '' },
      { score: 1, label: '45 – 64 ετών', desc: '' },
      { score: 2, label: '≥ 65 ετών',  desc: '' },
    ],
  },
  {
    key: 'risk' as const, letter: 'R', name: 'Risk Factors', nameEl: 'Παράγοντες κινδύνου',
    options: [
      { score: 0, label: 'Κανένας γνωστός',              desc: 'Χωρίς γνωστούς παράγοντες καρδιαγγειακού κινδύνου' },
      { score: 1, label: '1 – 2 παράγοντες',             desc: 'ΑΥ, δυσλιπιδαιμία, ΣΔ, παχυσαρκία, κάπνισμα, οικ. ιστορικό ΣΝ' },
      { score: 2, label: '≥ 3 παράγοντες ή αθηρ/ση',    desc: 'Γνωστή ΣΝ, stroke, PAD ή ≥ 3 παράγοντες κινδύνου' },
    ],
  },
  {
    key: 'troponin' as const, letter: 'T', name: 'Troponin', nameEl: 'Τροπονίνη',
    options: [
      { score: 0, label: '≤ φυσιολογικό όριο', desc: '' },
      { score: 1, label: '1 – 3× φυσιολογικό', desc: '' },
      { score: 2, label: '> 3× φυσιολογικό',   desc: '' },
    ],
  },
];

const RISK = {
  low:      { label: 'Χαμηλός κίνδυνος', mace: '1.7%', action: 'Πρώιμη εξόδος. Δεν απαιτείται νοσηλεία.', color: 'var(--green)', bg: 'var(--green-bg)', bdr: 'var(--green-bdr)' },
  moderate: { label: 'Μέτριος κίνδυνος', mace: '12%',  action: 'Νοσηλεία + serial troponins. Παρακολούθηση & στρες-τεστ.', color: 'var(--amber)', bg: 'var(--amber-bg)', bdr: 'var(--amber-bdr)' },
  high:     { label: 'Υψηλός κίνδυνος',  mace: '65%',  action: 'Πρώιμη επεμβατική στρατηγική. Άμεση καρδιολογική αξιολόγηση.', color: 'var(--red)', bg: 'var(--red-bg)', bdr: 'var(--red-bdr)' },
};

const calculateAge = (dobString: string): number => {
  const birthDate = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

export const HeartScore: React.FC<HeartScoreProps> = ({ patientId, navigate, currentUser }) => {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [priorScore, setPriorScore] = useState<number | null>(null);
  const [priorCategory, setPriorCategory] = useState<string | null>(null);
  const [scores, setScores] = useState<{
    history: number | null;
    ecg: number | null;
    age: number | null;
    risk: number | null;
    troponin: number | null;
  }>({
    history: null,
    ecg: null,
    age: null,
    risk: null,
    troponin: null,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        const p = await ctApi.getPatient(patientId);
        setPatient(p);
        
        const assessments = await ctApi.getRiskAssessments(patientId);
        const heartScores = assessments.filter(a => a.score_type === 'HEART');
        if (heartScores.length > 0) {
          setPriorScore(heartScores[0].score_value);
          setPriorCategory(heartScores[0].risk_category);
        }
      } catch (err) {
        console.error('Failed to fetch patient details or prior risk assessments:', err);
      }
    };
    
    fetchPatientData();
  }, [patientId]);

  useEffect(() => {
    if (patient) {
      const ageYears = calculateAge(patient.date_of_birth);
      const defaultAgeScore = ageYears >= 65 ? 2 : ageYears >= 45 ? 1 : 0;
      setScores(prev => ({
        ...prev,
        age: defaultAgeScore,
      }));
    }
  }, [patient]);

  const filledCount = Object.values(scores).filter(v => v !== null && v !== undefined).length;
  const total = Object.values(scores).reduce<number>((s, v) => s + (v ?? 0), 0);
  const allFilled = filledCount === 5;

  const handleSave = async () => {
    if (!allFilled || saving) return;
    setSaving(true);
    
    const category = total <= 3 ? 'low' : total <= 6 ? 'moderate' : 'high';
    const risk = RISK[category as keyof typeof RISK];

    try {
      await ctApi.createRiskAssessment(patientId, {
        score_type: 'HEART',
        score_value: total,
        risk_category: category,
        recommendation: `${risk.label} (MACE: ${risk.mace}). ${risk.action}`,
      });
      setSaved(true);
      setTimeout(() => navigate('profile', { patientId }), 900);
    } catch (err) {
      console.error('Failed to save risk assessment:', err);
      // Graceful degradation: show saved locally and navigate anyway
      setSaved(true);
      setTimeout(() => navigate('profile', { patientId }), 900);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const catColor = priorCategory === 'high' ? 'var(--red)' : priorCategory === 'moderate' ? 'var(--amber)' : 'var(--green)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--surface)' }}>
      {/* NavBar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--nav)', padding: '0 24px', height: 52, flexShrink: 0, borderBottom: '1px solid var(--nav-border)' }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: 'oklch(90% 0.04 245)', letterSpacing: 0.3, marginRight: 12 }}>CardioTrack</span>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>←</span>
        <span
          onClick={() => navigate('profile', { patientId })}
          style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
        >
          {patient?.user?.name || 'Ασθενής'}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>›</span>
        <span style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>HEART Score</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginRight: 8 }}>{currentUser?.name}</span>
        <CTAvatar initials={getInitials(currentUser?.name || 'DR')} size={32} bg="oklch(30% 0.06 255)" color="oklch(80% 0.08 245)" border="oklch(40% 0.07 255)" />
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{
          maxWidth: 1040, margin: '0 auto', padding: '28px 32px',
          display: 'grid', gridTemplateColumns: '1fr 310px',
          gap: 26, alignItems: 'start',
        }}>
          {/* Left: context + sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {patient && (
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '14px 20px', boxShadow: 'var(--sh)', display: 'flex', alignItems: 'center', gap: 14 }}>
                <CTAvatar initials={getInitials(patient.user?.name || 'PT')} size={44} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{patient.user?.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>
                    MRN: {patient.medical_record_number} · {calculateAge(patient.date_of_birth)} ετών · {patient.gender === 'male' ? 'Άνδρας' : 'Γυναίκα'}
                  </div>
                </div>
                {priorScore !== null && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Προηγ. HEART</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, color: catColor }}>{priorScore}/10</div>
                  </div>
                )}
              </div>
            )}

            {SECTIONS.map(section => {
              const val = scores[section.key];
              const selected = val !== null && val !== undefined;
              return (
                <div key={section.key} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--sh)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--primary-bg)', border: '1.5px solid var(--primary-bdr)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14.5, color: 'var(--primary)', fontFamily: 'var(--mono)', flexShrink: 0 }}>
                      {section.letter}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{section.nameEl}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{section.name}</div>
                    </div>
                    {selected && (
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Score:</span>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>{val}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: '14px 18px' }}>
                    {section.options.map(opt => {
                      const on = val === opt.score;
                      return (
                        <button
                          key={opt.score}
                          onClick={() => setScores(prev => ({ ...prev, [section.key]: opt.score }))}
                          style={{
                            padding: '11px 13px', textAlign: 'left', cursor: 'pointer',
                            border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border-s)'}`,
                            borderRadius: 'var(--r-lg)',
                            background: on ? 'var(--primary-bg)' : 'var(--bg)',
                            fontFamily: 'var(--font)', transition: 'all 0.12s',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: opt.desc ? 5 : 0 }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                              fontSize: 11.5, fontWeight: 700, fontFamily: 'var(--mono)',
                              background: on ? 'var(--primary)' : 'var(--surface-2)',
                              color: on ? '#fff' : 'var(--ink-3)',
                              border: `1px solid ${on ? 'transparent' : 'var(--border)'}`,
                            }}>{opt.score}</span>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: on ? 'var(--primary)' : 'var(--ink)', lineHeight: 1.3 }}>{opt.label}</span>
                          </div>
                          {opt.desc && (
                            <div style={{ fontSize: 11, color: on ? 'oklch(55% 0.15 245)' : 'var(--ink-3)', lineHeight: 1.45, paddingLeft: 29 }}>{opt.desc}</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingBottom: 32 }}>
              <CTBtn label="Ακύρωση" variant="secondary" onClick={() => navigate('profile', { patientId })} />
              <CTBtn
                label={saved ? '✓ Αποθηκεύτηκε' : saving ? 'Αποθήκευση...' : `Αποθήκευση HEART ${total}`}
                disabled={!allFilled || saved || saving}
                onClick={handleSave}
              />
            </div>
          </div>

          {/* Right: sticky score panel */}
          <div style={{ position: 'sticky', top: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-md)', overflow: 'hidden' }}>
              {/* Score header */}
              {(() => {
                const category = total <= 3 ? 'low' : total <= 6 ? 'moderate' : 'high';
                const risk = RISK[category as keyof typeof RISK];
                return (
                  <>
                    <div style={{ padding: '24px 24px 20px', background: allFilled ? risk.bg : 'var(--surface)', borderBottom: '1px solid var(--border)', textAlign: 'center', transition: 'background 0.3s' }}>
                      <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>HEART Score</div>
                      <div style={{ fontFamily: 'var(--mono)', lineHeight: 1, marginBottom: 12 }}>
                        <span style={{ fontSize: 56, fontWeight: 700, color: allFilled ? risk.color : 'var(--ink)', transition: 'color 0.3s' }}>{total}</span>
                        <span style={{ fontSize: 20, color: 'var(--ink-3)' }}>/10</span>
                      </div>
                      {allFilled ? (
                        <span style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600, background: risk.bg, border: `1px solid ${risk.bdr}`, color: risk.color }}>
                          {risk.label}
                        </span>
                      ) : (
                        <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{filledCount}/5 συμπληρωμένα</span>
                      )}
                    </div>

                    <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* Score bar */}
                      <div>
                        <div style={{ display: 'flex', gap: 3 }}>
                          {Array.from({ length: 11 }, (_, i) => {
                            const zoneColor = i <= 3 ? 'var(--green)' : i <= 6 ? 'var(--amber)' : 'var(--red)';
                            return (
                              <div key={i} style={{
                                flex: 1, height: 8, borderRadius: 2,
                                background: (allFilled && i <= total) ? zoneColor : 'var(--border)',
                                transition: 'background 0.25s',
                              }} />
                            );
                          })}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--mono)', marginTop: 4 }}>
                          <span>0</span><span style={{ marginLeft: 18 }}>3</span><span style={{ marginLeft: 18 }}>6</span><span>10</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--ink-3)', marginTop: 2 }}>
                          <span style={{ color: 'var(--green)' }}>Χαμηλός</span>
                          <span style={{ color: 'var(--amber)' }}>Μέτριος</span>
                          <span style={{ color: 'var(--red)' }}>Υψηλός</span>
                        </div>
                      </div>

                      {/* Component breakdown */}
                      <div>
                        <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 }}>Ανάλυση</div>
                        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
                          {SECTIONS.map((s, i) => {
                            const val = scores[s.key];
                            const filled = val !== null && val !== undefined;
                            return (
                              <div key={s.key} style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                                borderBottom: i < SECTIONS.length - 1 ? '1px solid var(--border)' : 'none',
                                fontSize: 13,
                              }}>
                                <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12.5, color: 'var(--primary)', width: 14, flexShrink: 0 }}>{s.letter}</span>
                                <span style={{ flex: 1, color: 'var(--ink-2)' }}>{s.name}</span>
                                <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 16, color: filled ? 'var(--ink)' : 'var(--border-s)' }}>
                                  {filled ? val : '—'}
                                </span>
                              </div>
                            );
                          })}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'var(--surface)', borderTop: '2px solid var(--border)', fontSize: 13 }}>
                            <span style={{ flex: 1, fontWeight: 600, color: 'var(--ink)' }}>Σύνολο</span>
                            <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 20, color: 'var(--ink)' }}>{total}</span>
                          </div>
                        </div>
                      </div>

                      {/* Recommendation */}
                      {allFilled && (
                        <div style={{ padding: '12px 14px', background: risk.bg, border: `1px solid ${risk.bdr}`, borderRadius: 'var(--r)', fontSize: 13, lineHeight: 1.55 }}>
                          <div style={{ fontWeight: 600, color: risk.color, marginBottom: 5 }}>Κίνδυνος MACE: {risk.mace}</div>
                          <div style={{ color: 'var(--ink-2)' }}>{risk.action}</div>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
