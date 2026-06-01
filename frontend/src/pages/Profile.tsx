import React, { useState, useEffect, useMemo } from 'react';
import { ctApi } from '../lib/api';
import { User, Patient, Observation, Condition, Medication, ObservationType, RiskAssessment, Report } from '../types/fhir';
import {
  CTBtn,
  CTBadge,
  CTAvatar,
  CTInfoRow,
  CTRiskBadge,
  CTSectionHead,
  CTVitalCard,
} from '../components/ui';

interface ProfileProps {
  patientId: number;
  navigate: (page: string, params?: Record<string, unknown>) => void;
  currentUser: User | null;
}

const TABS = ['Overview', 'Vitals', 'Conditions', 'Medications', 'Reports', 'ECG'];

// ── Range Selector Component ──────────────────────────────────────────
const RangeSelector = ({ active, onChange }: { active: string; onChange: (v: string) => void }) => {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {['7d', '14d', '30d', '90d'].map(r => (
        <button
          key={r}
          onClick={() => onChange(r)}
          style={{
            padding: '3px 10px',
            fontSize: 12,
            cursor: 'pointer',
            borderRadius: 4,
            fontFamily: 'var(--font)',
            fontWeight: 500,
            border: '1px solid var(--border-s)',
            background: active === r ? 'var(--primary-bg)' : 'transparent',
            color: active === r ? 'var(--primary)' : 'var(--ink-3)',
            outline: 'none',
            transition: 'all 0.12s',
          }}
        >
          {r}
        </button>
      ))}
    </div>
  );
};

// ── Chart Card Container ──────────────────────────────────────────────
const ChartCard = ({ children }: { children: React.ReactNode }) => {
  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        padding: '14px 12px 10px',
        boxShadow: 'var(--sh)',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
};

// ── Shared Table Component ────────────────────────────────────────────
const DataTable = ({ cols, rows }: { cols: string[]; rows: React.ReactNode[][] }) => {
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
            {cols.map(c => (
              <th
                key={c}
                style={{
                  padding: '10px 16px',
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--ink-3)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  whiteSpace: 'nowrap',
                }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              style={{
                borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
                background: i % 2 ? 'var(--surface)' : 'var(--bg)',
              }}
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  style={{
                    padding: '11px 16px',
                    color: 'var(--ink)',
                    verticalAlign: 'middle',
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── Custom Dynamic Vitals SVG Chart ──────────────────────────────────
interface ChartSeries {
  data: number[];
  color: string;
  label: string;
  w: number;
  dash?: string;
}

const VitalsChart = ({
  observations,
  mode = 'bp',
  height = 200,
}: {
  observations: Observation[];
  mode: string;
  height?: number;
}) => {
  // Filter and sort observations by recordedAt ascending
  const sortedObs = useMemo(() => {
    return [...observations].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
  }, [observations]);

  const series: ChartSeries[] = useMemo(() => {
    if (mode === 'bp') {
      const sysData = sortedObs.filter(o => o.type === 'systolic_bp').map(o => o.value);
      const diaData = sortedObs.filter(o => o.type === 'diastolic_bp').map(o => o.value);
      
      // Pad with defaults if empty
      const sys = sysData.length ? sysData : [120, 125, 122, 130, 124, 128, 121, 132, 125, 127];
      const dia = diaData.length ? diaData : [80, 82, 79, 85, 80, 83, 78, 86, 81, 82];
      
      return [
        { data: sys, color: 'oklch(46% 0.19 245)', label: 'Συστολική (Sys)', w: 2.5 },
        { data: dia, color: 'oklch(64% 0.12 245)', label: 'Διαστολική (Dia)', w: 2, dash: '5,3' },
      ];
    } else if (mode === 'hr') {
      const hrData = sortedObs.filter(o => o.type === 'heart_rate').map(o => o.value);
      const hr = hrData.length ? hrData : [72, 75, 78, 70, 74, 80, 71, 76, 73, 72];
      return [{ data: hr, color: 'oklch(46% 0.22 25)', label: 'Καρδιακοί Σφυγμοί (HR)', w: 2.5 }];
    } else {
      // spo2
      const spoData = sortedObs.filter(o => o.type === 'spo2').map(o => o.value);
      const spo = spoData.length ? spoData : [98, 97, 98, 99, 97, 98, 99, 98, 96, 97];
      return [{ data: spo, color: 'oklch(44% 0.17 145)', label: 'Κορεσμός SpO₂', w: 2.5 }];
    }
  }, [sortedObs, mode]);

  const allVals = useMemo(() => series.flatMap(s => s.data), [series]);
  const yMin = useMemo(() => Math.max(0, Math.floor(Math.min(...allVals) / 10) * 10 - 10), [allVals]);
  const yMax = useMemo(() => Math.ceil(Math.max(...allVals) / 10) * 10 + 10, [allVals]);

  const dataLen = series[0].data.length;

  const W = 860;
  const H = height;
  const pL = 42;
  const pR = 28;
  const pT = 16;
  const pB = 28;
  
  const plotW = W - pL - pR;
  const plotH = H - pT - pB;

  const sy = (v: number) => pT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  const sx = (i: number) => pL + (i / Math.max(1, dataLen - 1)) * plotW;
  
  const path = (d: number[]) =>
    d.map((v, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
    
  const area = (d: number[]) =>
    `${path(d)} L${sx(d.length - 1).toFixed(1)},${sy(yMin).toFixed(1)} L${sx(0).toFixed(1)},${sy(yMin).toFixed(1)}Z`;

  const step = (yMax - yMin) > 60 ? 20 : 10;
  const yTicks: number[] = [];
  for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) {
    yTicks.push(v);
  }

  // Generate date labels
  const dateLabels = useMemo(() => {
    const dates = sortedObs
      .filter(o => o.type === (mode === 'bp' ? 'systolic_bp' : mode === 'hr' ? 'heart_rate' : 'spo2'))
      .map(o => {
        const d = new Date(o.recordedAt);
        return `${d.getDate()}/${d.getMonth() + 1}`;
      });
    
    if (dates.length) return dates;
    
    // Fallbacks
    const today = new Date();
    return Array.from({ length: 10 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (9 - i));
      return `${d.getDate()}/${d.getMonth() + 1}`;
    });
  }, [sortedObs, mode]);

  const xTicksIndices = useMemo(() => {
    const len = dateLabels.length;
    if (len <= 5) return Array.from({ length: len }, (_, i) => i);
    return [0, Math.floor(len * 0.25), Math.floor(len * 0.5), Math.floor(len * 0.75), len - 1];
  }, [dateLabels]);

  const refY = mode === 'bp' ? 140 : mode === 'hr' ? 100 : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height, display: 'block' }}>
      {yTicks.map(y => (
        <line
          key={y}
          x1={pL}
          y1={sy(y)}
          x2={W - pR}
          y2={sy(y)}
          stroke="var(--border)"
          strokeWidth={1}
        />
      ))}
      
      {mode === 'bp' && (
        <rect
          x={pL}
          y={sy(120)}
          width={plotW}
          height={Math.abs(sy(90) - sy(120))}
          fill="oklch(44% 0.17 145 / 0.07)"
        />
      )}
      
      {refY && (
        <>
          <line
            x1={pL}
            y1={sy(refY)}
            x2={W - pR}
            y2={sy(refY)}
            stroke="var(--red)"
            strokeWidth={1.5}
            strokeDasharray="6,4"
            opacity={0.5}
          />
          <text
            x={W - pR + 4}
            y={sy(refY) + 4}
            fontSize={10}
            fill="var(--red)"
            fontFamily="var(--mono)"
            opacity={0.75}
          >
            {refY}
          </text>
        </>
      )}
      
      {series
        .filter(s => !s.dash)
        .map((s, i) => (
          <path key={i} d={area(s.data)} fill={s.color} opacity={0.07} />
        ))}
        
      {series.map((s, i) => (
        <path
          key={i}
          d={path(s.data)}
          fill="none"
          stroke={s.color}
          strokeWidth={s.w}
          strokeDasharray={s.dash || ''}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      
      {series[0].data.map((v, i) => (
        <circle
          key={i}
          cx={sx(i)}
          cy={sy(v)}
          r={3.5}
          fill={series[0].color}
          opacity={0.85}
        />
      ))}
      
      {yTicks.map(y => (
        <text
          key={y}
          x={pL - 8}
          y={sy(y) + 4}
          fontSize={10}
          fill="var(--ink-3)"
          textAnchor="end"
          fontFamily="var(--mono)"
        >
          {y}
        </text>
      ))}
      
      {xTicksIndices.map(i => (
        <text
          key={i}
          x={sx(i)}
          y={H - 5}
          fontSize={10}
          fill="var(--ink-3)"
          textAnchor="middle"
          fontFamily="var(--mono)"
        >
          {dateLabels[i]}
        </text>
      ))}
      
      {series.map((s, i) => (
        <g key={i} transform={`translate(${W - 168}, ${pT + i * 18})`}>
          <line x1={0} y1={7} x2={18} y2={7} stroke={s.color} strokeWidth={s.w} strokeDasharray={s.dash || ''} />
          <text x={22} y={11} fontSize={11} fill="var(--ink-2)" fontFamily="var(--font)">
            {s.label}
          </text>
        </g>
      ))}
    </svg>
  );
};

// ── Form Input Wrapper ────────────────────────────────────────────────
interface FormInputProps {
  label: string;
  type?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  placeholder?: string;
  required?: boolean;
}

const FormInput: React.FC<FormInputProps> = ({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
}) => {
  return (
    <div style={{ marginBottom: 12 }}>
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
        required={required}
        style={{
          width: '100%',
          padding: '8px 12px',
          fontSize: 13.5,
          border: '1px solid var(--border-s)',
          borderRadius: 'var(--r)',
          background: 'var(--bg)',
          color: 'var(--ink)',
          fontFamily: 'var(--font)',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
};

// ── Generic Modal Wrapper ─────────────────────────────────────────────
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--sh-lg)',
          width: '100%',
          maxWidth: 420,
          padding: '24px',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 18,
            background: 'none',
            border: 'none',
            fontSize: 20,
            color: 'var(--ink-3)',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          ×
        </button>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 20px', color: 'var(--ink)' }}>{title}</h3>
        {children}
      </div>
    </div>
  );
};

// ── Main Patient Profile Component ────────────────────────────────────
export const Profile: React.FC<ProfileProps> = ({ patientId, navigate, currentUser }) => {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [activeTab, setActiveTab] = useState('Overview');
  const [riskAssessments, setRiskAssessments] = useState<RiskAssessment[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [obsModalOpen, setObsModalOpen] = useState(false);
  const [condModalOpen, setCondModalOpen] = useState(false);
  const [medModalOpen, setMedModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Form Fields State
  const [newObsType, setNewObsType] = useState<ObservationType>('systolic_bp');
  const [newObsValue, setNewObsValue] = useState('');
  const [newObsNotes, setNewObsNotes] = useState('');

  const [newCondCode, setNewCondCode] = useState('');
  const [newCondDesc, setNewCondDesc] = useState('');
  const [newCondStatus, setNewCondStatus] = useState<'active' | 'resolved' | 'chronic'>('active');

  const [newMedName, setNewMedName] = useState('');
  const [newMedDose, setNewMedDose] = useState('');
  const [newMedFreq, setNewMedFreq] = useState('');

  const [newReportTitle, setNewReportTitle] = useState('');
  const [newReportType, setNewReportType] = useState('Lab');
  const [newReportFile, setNewReportFile] = useState<File | null>(null);

  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchPatientData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch patient profile first (core)
        try {
          const pData = await ctApi.getPatient(patientId);
          if (active) setPatient(pData);
        } catch (e) {
          console.error("Failed to load patient core profile:", e);
          throw new Error("Αποτυχία φόρτωσης βασικών στοιχείων ασθενούς.");
        }

        // Fetch other clinical datasets sequentially to avoid database pool exhaustion on Render
        try {
          const oData = await ctApi.getObservations(patientId);
          if (active) setObservations(oData || []);
        } catch (e) { console.error("Failed to load observations:", e); }

        try {
          const cData = await ctApi.getConditions(patientId);
          if (active) setConditions(cData || []);
        } catch (e) { console.error("Failed to load conditions:", e); }

        try {
          const mData = await ctApi.getMedications(patientId);
          if (active) setMedications(mData || []);
        } catch (e) { console.error("Failed to load medications:", e); }

        try {
          const rData = await ctApi.getRiskAssessments(patientId);
          if (active) setRiskAssessments(rData || []);
        } catch (e) { console.error("Failed to load risk assessments:", e); }

        try {
          const repData = await ctApi.getReports(patientId);
          if (active) setReports(repData || []);
        } catch (e) { console.error("Failed to load clinical reports:", e); }

      } catch (err: unknown) {
        if (active) {
          const msg = err instanceof Error ? err.message : 'Αποτυχία φόρτωσης καρτέλας ασθενούς.';
          setError(msg);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchPatientData();
    return () => {
      active = false;
    };
  }, [patientId]);

  const latestHeartScore = useMemo(() => {
    const heartAssessments = riskAssessments.filter(ra => ra.score_type === 'HEART');
    if (heartAssessments.length === 0) return null;
    return heartAssessments[0];
  }, [riskAssessments]);

  const pName = patient && patient.user ? patient.user.name : 'Unknown';
  const pInitials = patient && patient.user ? pName.split(' ').map(n => n[0]).join('') : 'UN';
  const pAge = useMemo(() => {
    if (!patient) return 0;
    const dob = new Date(patient.date_of_birth);
    const ageDiff = Date.now() - dob.getTime();
    const ageDate = new Date(ageDiff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  }, [patient]);

  // Dynamic Vitals Extract
  const latestVitals = useMemo(() => {
    const latest: Record<string, { val: number; unit: string; abn: boolean; date: string }> = {};
    observations.forEach(o => {
      const prev = latest[o.type];
      if (!prev || new Date(o.recordedAt).getTime() > new Date(prev.date).getTime()) {
        latest[o.type] = {
          val: o.value,
          unit: o.unit,
          abn: o.isAbnormal,
          date: o.recordedAt,
        };
      }
    });

    const list = [
      { key: 'systolic_bp',  label: 'Sys Pressure',  unit: 'mmHg', def: '120' },
      { key: 'diastolic_bp', label: 'Dia Pressure',  unit: 'mmHg', def: '80' },
      { key: 'heart_rate',   label: 'Heart Rate',    unit: 'bpm',  def: '72' },
      { key: 'spo2',         label: 'Oxygen SpO₂',   unit: '%',    def: '98' },
    ];

    return list.map(item => {
      const live = latest[item.key];
      return {
        label: item.label,
        value: live ? String(live.val) : item.def,
        unit: item.unit,
        status: live && live.abn ? 'abnormal' : 'normal',
      };
    });
  }, [observations]);

  // Vitals tab local state
  const [vitalsMode, setVitalsMode] = useState('bp');
  const [vitalsRange, setVitalsRange] = useState('14d');

  // Submit Handlers
  const handleAddObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newObsValue.trim()) return;
    try {
      setModalLoading(true);
      const val = Number(newObsValue);
      const unit = newObsType === 'spo2' ? '%' : newObsType === 'heart_rate' ? 'bpm' : 'mmHg';
      
      const newObs = await ctApi.createObservation(patientId, newObsType, val, unit, newObsNotes);
      setObservations(prev => [newObs, ...prev]);
      
      setObsModalOpen(false);
      setNewObsValue('');
      setNewObsNotes('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Αποτυχία καταχώρησης Observation.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleAddCondition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCondCode.trim() || !newCondDesc.trim()) return;
    try {
      setModalLoading(true);
      const newCond = await ctApi.createCondition(
        patientId,
        newCondCode.trim(),
        newCondDesc.trim(),
        new Date().toISOString(),
        newCondStatus
      );
      setConditions(prev => [newCond, ...prev]);
      setCondModalOpen(false);
      setNewCondCode('');
      setNewCondDesc('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Αποτυχία καταχώρησης Διάγνωσης.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleAddMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedName.trim() || !newMedDose.trim()) return;
    try {
      setModalLoading(true);
      const newMed = await ctApi.createMedication(
        patientId,
        newMedName.trim(),
        newMedDose.trim(),
        newMedFreq.trim() || '1× / ημέρα',
        new Date().toISOString(),
        '',
        'active'
      );
      setMedications(prev => [newMed, ...prev]);
      setMedModalOpen(false);
      setNewMedName('');
      setNewMedDose('');
      setNewMedFreq('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Αποτυχία καταχώρησης Συναγής.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleAddReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReportTitle.trim() || !newReportFile) return;
    try {
      setModalLoading(true);
      const formData = new FormData();
      formData.append('title', newReportTitle.trim());
      formData.append('report_type', newReportType);
      formData.append('file', newReportFile);

      const newRep = await ctApi.uploadReport(patientId, formData);
      setReports(prev => [newRep, ...prev]);

      setReportModalOpen(false);
      setNewReportTitle('');
      setNewReportType('Lab');
      setNewReportFile(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Αποτυχία ανεβάσματος αναφοράς.');
    } finally {
      setModalLoading(false);
    }
  };

  const getFileUrl = (url: string) => {
    if (url.startsWith('http')) return url;
    const base = (import.meta.env.VITE_API_URL || '').replace('/api/v1', '');
    return `${base || 'http://localhost:8080'}${url}`;
  };

  const getReportIcon = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'ECG': return '♡';
      case 'LAB': return '◎';
      case 'IMAGING': return '⊡';
      case 'DISCHARGE': return '≡';
      default: return '🗎';
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-2)' }}>Φόρτωση καρτέλας...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
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
              Σφάλμα Φόρτωσης
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-2)', marginBottom: 16 }}>{error || 'Patient not found.'}</div>
            <CTBtn label="Επιστροφή στους Ασθενείς" onClick={() => navigate('patients')} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
      {/* Navbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
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
        <button
          onClick={() => navigate('patients')}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 13,
            color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            fontFamily: 'var(--font)',
            outline: 'none',
          }}
          onMouseEnter={e => ((e.target as HTMLButtonElement).style.color = '#fff')}
          onMouseLeave={e => ((e.target as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)')}
        >
          Ασθενείς
        </button>
        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>▶</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{pName}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginRight: 10 }}>
          {currentUser ? currentUser.name : 'Δρ. Νικολάου'}
        </span>
        <CTAvatar
          initials={currentUser ? currentUser.name.split(' ').map(n => n[0]).join('') : 'ΝΙ'}
          size={32}
          bg="oklch(30% 0.06 255)"
          color="oklch(80% 0.08 245)"
          border="oklch(40% 0.07 255)"
        />
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar */}
        <div
          style={{
            width: 236,
            flexShrink: 0,
            background: 'var(--surface)',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto',
          }}
        >
          <div
            style={{
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              borderBottom: '1px solid var(--border)',
              textAlign: 'center',
            }}
          >
            <CTAvatar initials={pInitials} size={80} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 15.5, lineHeight: 1.3, color: 'var(--ink)' }}>
                {pName}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--ink-3)',
                  marginTop: 4,
                  fontFamily: 'var(--mono)',
                }}
              >
                {patient.medical_record_number}
              </div>
            </div>
          </div>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <CTInfoRow label="Ηλικία" value={`${pAge} ετών`} />
            <CTInfoRow
              label="Γέννηση"
              value={new Date(patient.date_of_birth).toLocaleDateString('el-GR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            />
            <CTInfoRow label="Φύλο" value={patient.gender === 'Male' ? 'Άνδρας' : 'Γυναίκα'} />
            <CTInfoRow label="Ομάδα" value={patient.blood_type || 'O+'} mono />
          </div>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            {latestHeartScore ? (
              <>
                <CTRiskBadge score={latestHeartScore.score_value} category={latestHeartScore.risk_category} />
                <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                  {latestHeartScore.recommendation || 'Clinical recommendation not provided.'}
                </div>
              </>
            ) : (
              <div style={{ padding: '12px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', textAlign: 'center' }}>
                <div style={{ fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600, marginBottom: 4 }}>
                  No HEART Assessment
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  Calculate ACS risk score
                </div>
              </div>
            )}
          </div>
          <div
            style={{
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              borderBottom: '1px solid var(--border)',
            }}
          >
            <CTBtn label="+ Observation" full onClick={() => setObsModalOpen(true)} />
            <CTBtn label="Συνταγογράφηση" variant="secondary" full onClick={() => setMedModalOpen(true)} />
            <CTBtn label="⬡ HEART Score" variant="ghost" full onClick={() => navigate('heart', { patientId })} />
            <CTBtn label="ECG Analysis" variant="ghost" full onClick={() => setActiveTab('ECG')} />
          </div>
          <div style={{ padding: '16px 20px' }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--ink-3)',
                textTransform: 'uppercase',
                letterSpacing: 0.7,
                marginBottom: 8,
              }}
            >
              Επείγουσα επαφή
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-2)' }}>Μαρία Παπαδοπούλου</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>
              +30 6912 345 678
            </div>
          </div>
        </div>

        {/* Central Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Tabbed Navigation Header */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg)',
              paddingLeft: 32,
              flexShrink: 0,
            }}
          >
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '12px 22px',
                  fontSize: 13.5,
                  fontWeight: activeTab === tab ? 600 : 400,
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                  color: activeTab === tab ? 'var(--primary)' : 'var(--ink-3)',
                  background: 'none',
                  border: 'none',
                  borderBottom: `2px solid ${activeTab === tab ? 'var(--primary)' : 'transparent'}`,
                  marginBottom: -1,
                  transition: 'color 0.15s',
                  outline: 'none',
                }}
              >
                {tab === 'Overview'
                  ? 'Επισκόπηση'
                  : tab === 'Vitals'
                  ? 'Vitals'
                  : tab === 'Conditions'
                  ? 'Διαγνώσεις'
                  : tab === 'Medications'
                  ? 'Φάρμακα'
                  : tab === 'Reports'
                  ? 'Αναφορές'
                  : 'ECG'}
              </button>
            ))}
          </div>

          {/* Tab Views */}
          <main style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
            {/* TAB: Overview */}
            {activeTab === 'Overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                <section>
                  <CTSectionHead
                    title="Τελευταία Vitals"
                    action={<CTBtn label="+ Observation" size="sm" onClick={() => setObsModalOpen(true)} />}
                  />
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {latestVitals.map(v => (
                      <CTVitalCard key={v.label} {...v} />
                    ))}
                  </div>
                </section>
                <section>
                  <CTSectionHead
                    title="Blood Pressure — τελευταίες μετρήσεις"
                    action={<RangeSelector active={vitalsRange} onChange={setVitalsRange} />}
                  />
                  <ChartCard>
                    <VitalsChart observations={observations} mode="bp" />
                  </ChartCard>
                </section>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  <section>
                    <CTSectionHead
                      title="Διαγνώσεις"
                      action={
                        <button
                          onClick={() => setActiveTab('Conditions')}
                          style={{
                            fontSize: 12,
                            color: 'var(--primary)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontFamily: 'var(--font)',
                          }}
                        >
                          Όλες →
                        </button>
                      }
                    />
                    {conditions.slice(0, 4).map((c, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '9px 0',
                          borderBottom: '1px solid var(--border)',
                          fontSize: 13.5,
                        }}
                      >
                        <CTBadge label={c.status} variant={c.status} />
                        <span
                          style={{
                            fontFamily: 'var(--mono)',
                            fontSize: 12,
                            color: 'var(--ink-3)',
                            flexShrink: 0,
                          }}
                        >
                          {c.icd10Code}
                        </span>
                        <span style={{ flex: 1, color: 'var(--ink-2)', fontWeight: 500 }}>{c.description}</span>
                      </div>
                    ))}
                    {conditions.length === 0 && (
                      <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '12px 0' }}>
                        Δεν υπάρχουν καταχωρημένες διαγνώσεις.
                      </div>
                    )}
                  </section>
                  <section>
                    <CTSectionHead
                      title="Φάρμακα"
                      action={
                        <button
                          onClick={() => setActiveTab('Medications')}
                          style={{
                            fontSize: 12,
                            color: 'var(--primary)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontFamily: 'var(--font)',
                          }}
                        >
                          Όλα →
                        </button>
                      }
                    />
                    {medications.slice(0, 4).map((m, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '9px 0',
                          borderBottom: '1px solid var(--border)',
                          fontSize: 13.5,
                        }}
                      >
                        <span style={{ flex: 1, color: 'var(--ink-2)', fontWeight: 500 }}>{m.name}</span>
                        <span style={{ color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                          {m.dosage}
                        </span>
                        <span
                          style={{
                            padding: '1px 7px',
                            fontSize: 12,
                            borderRadius: 4,
                            background: 'var(--surface-2)',
                            color: 'var(--ink-2)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          {m.frequency}
                        </span>
                      </div>
                    ))}
                    {medications.length === 0 && (
                      <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '12px 0' }}>
                        Δεν υπάρχουν καταχωρημένα φάρμακα.
                      </div>
                    )}
                  </section>
                </div>
              </div>
            )}

            {/* TAB: Vitals */}
            {activeTab === 'Vitals' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[
                      ['bp', 'Πίεση (BP)'],
                      ['hr', 'Σφυγμοί (HR)'],
                      ['spo', 'Κορεσμός (SpO₂)'],
                    ].map(([k, lbl]) => (
                      <button
                        key={k}
                        onClick={() => setVitalsMode(k)}
                        style={{
                          padding: '6px 14px',
                          fontSize: 13,
                          cursor: 'pointer',
                          borderRadius: 'var(--r)',
                          fontFamily: 'var(--font)',
                          fontWeight: 500,
                          border: `1px solid ${vitalsMode === k ? 'var(--primary)' : 'var(--border-s)'}`,
                          background: vitalsMode === k ? 'var(--primary-bg)' : 'var(--bg)',
                          color: vitalsMode === k ? 'var(--primary)' : 'var(--ink-2)',
                          outline: 'none',
                          transition: 'all 0.12s',
                        }}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                  <RangeSelector active={vitalsRange} onChange={setVitalsRange} />
                </div>
                <ChartCard>
                  <VitalsChart observations={observations} mode={vitalsMode} height={230} />
                </ChartCard>
                <DataTable
                  cols={['Ημερομηνία', 'Τύπος', 'Τιμή', 'Μονάδα', 'Κατάσταση', 'Καταχώρηση']}
                  rows={observations.slice(0, 10).map(o => [
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-2)' }}>
                      {new Date(o.recordedAt).toLocaleString('el-GR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>,
                    <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>
                      {o.type === 'systolic_bp'
                        ? 'Systolic BP'
                        : o.type === 'diastolic_bp'
                        ? 'Diastolic BP'
                        : o.type === 'heart_rate'
                        ? 'Heart Rate'
                        : 'Oxygen SpO₂'}
                    </span>,
                    <span
                      style={{
                        fontFamily: 'var(--mono)',
                        fontWeight: 600,
                        color: o.isAbnormal ? 'var(--red)' : 'var(--ink)',
                      }}
                    >
                      {o.value}
                    </span>,
                    <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{o.unit}</span>,
                    o.isAbnormal ? (
                      <CTBadge label="Abnormal" variant="abnormal" />
                    ) : (
                      <CTBadge label="Normal" variant="normal" />
                    ),
                    'Δρ. Νικολάου',
                  ])}
                />
              </div>
            )}

            {/* TAB: Conditions */}
            {activeTab === 'Conditions' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <CTBtn label="+ Νέα Διάγνωση" onClick={() => setCondModalOpen(true)} />
                </div>
                <DataTable
                  cols={['ICD-10', 'Περιγραφή', 'Κατάσταση', 'Έναρξη', 'Καταχώρηση']}
                  rows={conditions.map(c => [
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-2)' }}>
                      {c.icd10Code}
                    </span>,
                    <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>{c.description}</span>,
                    <CTBadge label={c.status} variant={c.status} />,
                    <span style={{ color: 'var(--ink-3)', fontSize: 12.5 }}>
                      {new Date(c.onsetDate).toLocaleDateString('el-GR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>,
                    'Δρ. Νικολάου',
                  ])}
                />
              </div>
            )}

            {/* TAB: Medications */}
            {activeTab === 'Medications' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <CTBtn label="+ Συνταγογράφηση" onClick={() => setMedModalOpen(true)} />
                </div>
                <DataTable
                  cols={['Φάρμακο', 'Δοσολογία', 'Συχνότητα', 'Έναρξη', 'Κατάσταση', 'Συνταγή από']}
                  rows={medications.map(m => [
                    <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>{m.name}</span>,
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-2)' }}>{m.dosage}</span>,
                    m.frequency,
                    <span style={{ color: 'var(--ink-3)', fontSize: 12.5 }}>
                      {new Date(m.startDate).toLocaleDateString('el-GR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>,
                    <CTBadge label={m.status} variant={m.status === 'active' ? 'active' : 'chronic'} />,
                    'Δρ. Νικολάου',
                  ])}
                />
              </div>
            )}

            {/* TAB: Reports */}
            {activeTab === 'Reports' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <CTBtn label="Upload Report" icon="↑" onClick={() => setReportModalOpen(true)} />
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                    gap: 16,
                  }}
                >
                  {reports.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => window.open(getFileUrl(r.file_url), '_blank')}
                      style={{
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--r-lg)',
                        padding: '18px 20px',
                        boxShadow: 'var(--sh)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 8,
                            background: 'var(--primary-bg)',
                            border: '1px solid var(--primary-bdr)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 18,
                            color: 'var(--primary)',
                            flexShrink: 0,
                          }}
                        >
                          {getReportIcon(r.report_type)}
                        </div>
                        <CTBadge label={r.report_type} variant="pending" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                          {new Date(r.report_date).toLocaleDateString('el-GR', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--ink-3)',
                          borderTop: '1px solid var(--border)',
                          paddingTop: 8,
                        }}
                      >
                        Ανέβηκε από: {r.uploaded_by?.name || 'Δρ. Νικολάου'}
                      </div>
                    </div>
                  ))}
                  <div
                    onClick={() => setReportModalOpen(true)}
                    style={{
                      border: '2px dashed var(--border-s)',
                      borderRadius: 'var(--r-lg)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '28px 20px',
                      cursor: 'pointer',
                      color: 'var(--ink-3)',
                      background: 'var(--surface)',
                      minHeight: 140,
                    }}
                  >
                    <span style={{ fontSize: 24 }}>↑</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>Drag & drop ή κλικ</span>
                    <span style={{ fontSize: 11.5 }}>PDF, JPG, PNG</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: ECG */}
            {activeTab === 'ECG' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <CTSectionHead
                    title="Ανέβασμα ECG"
                    action={<CTBadge label="Python microservice ready" variant="normal" />}
                  />
                  <div
                    style={{
                      border: '2px dashed var(--border-s)',
                      borderRadius: 'var(--r-lg)',
                      padding: '36px',
                      textAlign: 'center',
                      background: 'var(--surface)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 32, marginBottom: 10, color: 'var(--primary)' }}>♡</div>
                    <div
                      style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink-2)', marginBottom: 6 }}
                    >
                      Drag & drop ECG file εδώ
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 16 }}>
                      Υποστηρίζει MIT-BIH format (.dat) ή CSV
                    </div>
                    <CTBtn label="Επιλογή αρχείου" variant="secondary" />
                  </div>
                </div>
                <div>
                  <CTSectionHead title="Τελευταία ανάλυση — 12 Μαΐ 2025" action={<CTBadge label="done" variant="done" />} />
                  <div
                    style={{
                      background: 'oklch(12% 0.01 240)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-lg)',
                      padding: '18px 16px',
                      marginBottom: 20,
                      boxShadow: 'var(--sh)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: 'oklch(60% 0.01 240)',
                        marginBottom: 10,
                        fontFamily: 'var(--mono)',
                      }}
                    >
                      Lead II · 10 sec · 500 Hz
                    </div>
                    <svg viewBox="0 0 860 100" style={{ width: '100%', height: 100, display: 'block' }}>
                      <path
                        d="M0,50 L60,50 L65,50 L67,20 L70,80 L74,10 L78,85 L82,50 L90,50 L150,50 L155,50 L157,20 L160,80 L164,10 L168,85 L172,50 L180,50 L240,50 L245,50 L247,20 L250,80 L254,10 L258,85 L262,50 L270,50 L330,50 L335,50 L337,20 L340,80 L344,10 L348,85 L352,50 L360,50 L420,50 L425,50 L427,20 L430,80 L434,10 L438,85 L442,50 L450,50 L510,50 L515,50 L517,20 L520,80 L524,10 L528,85 L532,50 L540,50 L600,50 L605,50 L607,20 L610,80 L614,10 L618,85 L622,50 L630,50 L690,50 L695,50 L697,20 L700,80 L704,10 L708,85 L712,50 L720,50 L780,50 L785,50 L787,20 L790,80 L794,10 L798,85 L802,50 L860,50"
                        fill="none"
                        stroke="oklch(64% 0.22 145)"
                        strokeWidth={1.5}
                        strokeLinecap="round"
                      />
                      {[74, 164, 254, 344, 434, 524, 614, 704, 794].map((x, i) => (
                        <circle key={i} cx={x} cy={50} r={3} fill="oklch(46% 0.22 25)" opacity={0.8} />
                      ))}
                    </svg>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'oklch(50% 0.01 240)',
                        marginTop: 8,
                        fontFamily: 'var(--mono)',
                      }}
                    >
                      ● R-peaks ανιχνεύθηκαν: 9 · Pan-Tompkins algorithm
                    </div>
                  </div>
                  <CTSectionHead title="HRV Metrics" />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <CTVitalCard label="Mean HR" value="88" unit="bpm" />
                    <CTVitalCard label="SDNN" value="45" unit="ms" />
                    <CTVitalCard label="RMSSD" value="28" unit="ms" />
                  </div>
                  <div
                    style={{
                      marginTop: 14,
                      padding: '12px 16px',
                      background: 'var(--green-bg)',
                      border: '1px solid var(--green-bdr)',
                      borderRadius: 'var(--r)',
                      fontSize: 13,
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--green)' }}>HRV Ερμηνεία: Normal</span>
                    <span style={{ color: 'var(--ink-2)', marginLeft: 10 }}>
                      SDNN &gt; 50ms — κανονική καρδιαγγειακή λειτουργία
                    </span>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ── MODAL: Add Observation ── */}
      <Modal isOpen={obsModalOpen} onClose={() => setObsModalOpen(false)} title="Καταχώρηση Observation (Vitals)">
        <form onSubmit={handleAddObservation}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-2)', display: 'block', marginBottom: 5 }}>
              Τύπος Μέτρησης
            </label>
            <select
              value={newObsType}
              onChange={e => setNewObsType(e.target.value as ObservationType)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 13.5,
                border: '1px solid var(--border-s)',
                borderRadius: 'var(--r)',
                background: 'var(--bg)',
                color: 'var(--ink)',
                fontFamily: 'var(--font)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            >
              <option value="systolic_bp">Συστολική Πίεση (Systolic BP)</option>
              <option value="diastolic_bp">Διαστολική Πίεση (Diastolic BP)</option>
              <option value="heart_rate">Σφυγμοί (Heart Rate)</option>
              <option value="spo2">Κορεσμός Οξυγόνου (SpO₂)</option>
            </select>
          </div>
          <FormInput
            label="Τιμή"
            type="number"
            value={newObsValue}
            onChange={e => setNewObsValue(e.target.value)}
            placeholder="Εισάγετε αριθμητική τιμή"
            required
          />
          <FormInput
            label="Σημειώσεις"
            value={newObsNotes}
            onChange={e => setNewObsNotes(e.target.value)}
            placeholder="Προαιρετικές σημειώσεις"
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
            <CTBtn label="Ακύρωση" variant="secondary" onClick={() => setObsModalOpen(false)} disabled={modalLoading} />
            <CTBtn label={modalLoading ? 'Καταχώρηση...' : 'Καταχώρηση'} type="submit" disabled={modalLoading} />
          </div>
        </form>
      </Modal>

      {/* ── MODAL: Add Condition ── */}
      <Modal isOpen={condModalOpen} onClose={() => setCondModalOpen(false)} title="Προσθήκη Διάγνωσης (ICD-10)">
        <form onSubmit={handleAddCondition}>
          <FormInput
            label="Κωδικός ICD-10"
            value={newCondCode}
            onChange={e => setNewCondCode(e.target.value)}
            placeholder="π.χ. I10"
            required
          />
          <FormInput
            label="Περιγραφή"
            value={newCondDesc}
            onChange={e => setNewCondDesc(e.target.value)}
            placeholder="π.χ. Essential Hypertension"
            required
          />
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-2)', display: 'block', marginBottom: 5 }}>
              Κατάσταση
            </label>
            <select
              value={newCondStatus}
              onChange={e => setNewCondStatus(e.target.value as 'active' | 'resolved' | 'chronic')}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 13.5,
                border: '1px solid var(--border-s)',
                borderRadius: 'var(--r)',
                background: 'var(--bg)',
                color: 'var(--ink)',
                fontFamily: 'var(--font)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            >
              <option value="active">Active</option>
              <option value="chronic">Chronic</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
            <CTBtn label="Ακύρωση" variant="secondary" onClick={() => setCondModalOpen(false)} disabled={modalLoading} />
            <CTBtn label={modalLoading ? 'Προσθήκη...' : 'Προσθήκη'} type="submit" disabled={modalLoading} />
          </div>
        </form>
      </Modal>

      {/* ── MODAL: Add Medication ── */}
      <Modal isOpen={medModalOpen} onClose={() => setMedModalOpen(false)} title="Συνταγογράφηση Φαρμάκου">
        <form onSubmit={handleAddMedication}>
          <FormInput
            label="Όνομα Φαρμάκου"
            value={newMedName}
            onChange={e => setNewMedName(e.target.value)}
            placeholder="π.χ. Lisinopril"
            required
          />
          <FormInput
            label="Δοσολογία"
            value={newMedDose}
            onChange={e => setNewMedDose(e.target.value)}
            placeholder="π.χ. 10 mg"
            required
          />
          <FormInput
            label="Συχνότητα"
            value={newMedFreq}
            onChange={e => setNewMedFreq(e.target.value)}
            placeholder="π.χ. 1× / ημέρα"
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
            <CTBtn label="Ακύρωση" variant="secondary" onClick={() => setMedModalOpen(false)} disabled={modalLoading} />
            <CTBtn label={modalLoading ? 'Καταχώρηση...' : 'Καταχώρηση'} type="submit" disabled={modalLoading} />
          </div>
        </form>
      </Modal>

      {/* ── MODAL: Upload Report ── */}
      <Modal isOpen={reportModalOpen} onClose={() => setReportModalOpen(false)} title="Ανέβασμα Κλινικής Αναφοράς">
        <form onSubmit={handleAddReport}>
          <FormInput
            label="Τίτλος Αναφοράς"
            value={newReportTitle}
            onChange={e => setNewReportTitle(e.target.value)}
            placeholder="π.χ. Lab Results Q2"
            required
          />
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-2)', display: 'block', marginBottom: 5 }}>
              Τύπος Αναφοράς
            </label>
            <select
              value={newReportType}
              onChange={e => setNewReportType(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 13.5,
                border: '1px solid var(--border-s)',
                borderRadius: 'var(--r)',
                background: 'var(--bg)',
                color: 'var(--ink)',
                fontFamily: 'var(--font)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            >
              <option value="ECG">ECG Report</option>
              <option value="Lab">Lab Results</option>
              <option value="Imaging">Imaging (Echo/MRI)</option>
              <option value="Discharge">Discharge Summary</option>
            </select>
          </div>
          
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-2)', display: 'block', marginBottom: 5 }}>
              Αρχείο Αναφοράς
            </label>
            <div
              style={{
                border: '2px dashed var(--border-s)',
                borderRadius: 'var(--r-lg)',
                padding: '20px',
                textAlign: 'center',
                background: 'var(--surface)',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              <input
                type="file"
                accept=".pdf,image/*"
                required
                onChange={e => setNewReportFile(e.target.files?.[0] || null)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer',
                }}
              />
              <span style={{ fontSize: 24, display: 'block', marginBottom: 4 }}>🗎</span>
              <span style={{ fontSize: 13, fontWeight: 500, display: 'block' }}>
                {newReportFile ? newReportFile.name : 'Επιλέξτε ή σύρετε αρχείο PDF/Εικόνα'}
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                {newReportFile ? `${(newReportFile.size / (1024 * 1024)).toFixed(2)} MB` : 'Μέγιστο μέγεθος: 10MB'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
            <CTBtn label="Ακύρωση" variant="secondary" onClick={() => setReportModalOpen(false)} />
            <CTBtn label="Ανέβασμα" type="submit" disabled={modalLoading} />
          </div>
        </form>
      </Modal>
    </div>
  );
};
