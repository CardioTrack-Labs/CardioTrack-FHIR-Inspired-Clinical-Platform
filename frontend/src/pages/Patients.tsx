import React, { useState, useEffect, useMemo } from 'react';
import { ctApi } from '../lib/api';
import { User, Report } from '../types/fhir';
import { CTBtn, CTBadge, CTAvatar } from '../components/ui';
import { 
  Send, 
  FileText, 
  Clock, 
  CheckCircle, 
  Lock,
  ArrowRight
} from 'lucide-react';

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

// ── 1. Πρόγραμμα (Schedule View) ──────────────────────────────────────
const ScheduleView: React.FC = () => {
  const appointments = [
    { time: '09:00 - 09:30', patient: 'Γεώργιος Παπαδόπουλος', type: 'ECG Analysis Review', room: 'Αίθουσα 3 - Ηλεκτροκαρδιογράφημα', status: 'critical', desc: 'Έλεγχος επιπέδων τροπονίνης και ανάλυση HRV.' },
    { time: '10:00 - 10:30', patient: 'Ελένη Καρρά', type: 'Outpatient Follow-up', room: 'Εξωτερικά Ιατρεία - Αίθουσα 2', status: 'stable', desc: 'Μετεγχειρητικός έλεγχος HEART Score.' },
    { time: '11:15 - 12:00', patient: 'Νικόλαος Δημητρίου', type: 'Stress Test (Κόπωση)', room: 'Εργαστήριο Κοπώσεως', status: 'active', desc: 'Υποψία στεφανιαίας νόσου - Δυναμικό τεστ.' },
    { time: '13:00 - 13:30', patient: 'Μαρία Βασιλείου', type: 'Troponin Serial Review', room: 'ΜΕΘ - Κρεβάτι 3', status: 'critical', desc: 'Παρακολούθηση οξέος στεφανιαίου συνδρόμου.' },
    { time: '14:30 - 15:00', patient: 'Κωνσταντίνος Παπαδάκης', type: 'Routine Pacemaker Check', room: 'Αίθουσα 5', status: 'stable', desc: 'Εξαμηνιαίος έλεγχος βηματοδότη.' },
  ];

  return (
    <div style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', letterSpacing: -0.3, margin: 0 }}>
          Πρόγραμμα Επισκέψεων
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 4 }}>
          Κλινική ατζέντα καρδιολογικού τμήματος για σήμερα.
        </p>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {appointments.map((a, i) => {
          const badgeVariant = a.status === 'critical' ? 'high' : a.status === 'active' ? 'moderate' : 'low';
          const labelMap: Record<string, string> = {
            critical: 'Κρίσιμο',
            active: 'Ενεργό',
            stable: 'Σταθερό',
          };
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '16px 20px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-lg)',
                boxShadow: 'var(--sh)',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--primary)', fontFamily: 'var(--mono)', width: 120, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={15} /> {a.time}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>
                  {a.patient}
                  <CTBadge label={labelMap[a.status]} variant={badgeVariant} />
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>
                  <span style={{ fontWeight: 600 }}>{a.type}</span> · {a.room}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>
                  {a.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── 2. Μηνύματα (Interactive Clinical Messaging View) ─────────────────
interface ChatMessage {
  sender: 'patient' | 'doctor' | 'doctor-colleague';
  text: string;
  time: string;
}

interface MessageThread {
  id: number;
  name: string;
  unread: boolean;
  lastMsg: string;
  time: string;
  status: 'critical' | 'stable' | 'doctor';
  history: ChatMessage[];
}

const MessagesView: React.FC<{ currentUser: User | null }> = ({ currentUser }) => {
  // Map thread IDs directly to their seeded database User IDs:
  // Γεώργιος Παπαδόπουλος = UserID 5, Ελένη Καρρά = UserID 6, Δρ. Καρράς = UserID 4
  const initialThreads: MessageThread[] = [
    { id: 5, name: 'Γεώργιος Παπαδόπουλος', unread: true, lastMsg: 'Γιατρέ, ένιωσα ένα ελαφρύ σφίξιμο στο στήθος πριν λίγο.', time: '10:24', status: 'critical', history: [
      { sender: 'patient', text: 'Καλημέρα γιατρέ. Σας στέλνω γιατί ένιωσα ένα ελαφρύ σφίξιμο στο στήθος πριν από περίπου μία ώρα κατά τη διάρκεια ήπιας βάδισης.', time: '10:20' },
      { sender: 'doctor', text: 'Καλημέρα Γεώργιε. Το σφίξιμο αντανακλά κάπου αλλού, π.χ. στο αριστερό χέρι ή στην πλάτη; Συνοδεύεται από δύσπνοια ή εφίδρωση;', time: '10:22' },
      { sender: 'patient', text: 'Όχι, δεν αντανακλά κάπου αλλού. Απλά ένιωσα λίγο σφίξιμο. Τώρα που κάθομαι έχει υποχωρήσει κάπως, αλλά εξακολουθώ να ανησυχώ.', time: '10:24' }
    ]},
    { id: 6, name: 'Ελένη Καρρά', unread: false, lastMsg: 'Η πίεση μου σήμερα το πρωί ήταν 122/80. Όλα καλά!', time: 'Χθες', status: 'stable', history: [
      { sender: 'patient', text: 'Καλησπέρα γιατρέ, πήρα τη δόση του φαρμάκου κανονικά χθες.', time: 'Χθες 18:00' },
      { sender: 'doctor', text: 'Πολύ καλά Ελένη. Συνέχισε τις πρωινές μετρήσεις πίεσης και ενημέρωσέ με.', time: 'Χθες 18:15' },
      { sender: 'patient', text: 'Η πίεση μου σήμερα το πρωί ήταν 122/80. Όλα καλά!', time: 'Σήμερα 08:30' }
    ]},
    { id: 4, name: 'Δρ. Καρράς (Resident)', unread: false, lastMsg: 'Σας έστειλα το ECG του Patient 3 για review.', time: 'Χθες', status: 'doctor', history: [
      { sender: 'doctor-colleague', text: 'Καλησπέρα γιατρέ, σας έστειλα το ηλεκτροκαρδιογράφημα του Patient 3. Φαίνεται να έχει μια μικρή κατάσπαση του ST διαστήματος στην V5-V6.', time: 'Χθες 16:30' }
    ]}
  ];

  const [threads, setThreads] = useState<MessageThread[]>(initialThreads);
  const [activeId, setActiveId] = useState(5);
  const [inputText, setInputText] = useState('');
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const activeThread = threads.find(t => t.id === activeId) || threads[0];

  useEffect(() => {
    if (!currentUser) return;
    
    // Connect to WebSocket endpoint dynamically
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/^http:\/\/|^https:\/\//, '') : 'localhost:8080';
    const wsUrl = `${protocol}//${host}/ws?user_id=${currentUser.id}&role=${currentUser.role}`;
    
    console.log('[WS Doctor] Connecting to:', wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WS Doctor] Connected successfully');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[WS Doctor] Message received:', data);
        
        // Dynamic state updates inside matched thread
        setThreads(prev => prev.map(t => {
          if (t.id === data.sender_id) {
            return {
              ...t,
              unread: t.id !== activeId,
              lastMsg: data.text,
              time: data.time,
              history: [...t.history, {
                sender: data.role === 'cardiologist' || data.role === 'doctor' ? 'doctor-colleague' : 'patient',
                text: data.text,
                time: data.time
              }]
            };
          }
          return t;
        }));
      } catch (err) {
        console.error('[WS Doctor] Parse failed:', err);
      }
    };

    ws.onclose = () => {
      console.log('[WS Doctor] Disconnected');
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, [currentUser, activeId]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const timeStr = new Date().toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
    const payload = {
      sender_id: currentUser?.id,
      receiver_id: activeThread.id,
      text: inputText,
      time: timeStr
    };

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
      console.log('[WS Doctor] Outbound message sent:', payload);
    }

    setThreads(prev => prev.map(t => {
      if (t.id === activeId) {
        return {
          ...t,
          unread: false,
          lastMsg: inputText,
          time: timeStr,
          history: [...t.history, {
            sender: 'doctor',
            text: inputText,
            time: timeStr
          }]
        };
      }
      return t;
    }));
    setInputText('');
  };

  const handleThreadSelect = (id: number) => {
    setActiveId(id);
    setThreads(prev => prev.map(t => t.id === id ? { ...t, unread: false } : t));
    setMobileShowChat(true);
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', animation: 'fadeIn 0.2s ease-in-out' }}>
      <div style={{ marginBottom: 20 }} className={mobileShowChat ? 'max-md:hidden' : ''}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', letterSpacing: -0.3, margin: 0 }}>
          Κλινική Επικοινωνία
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 4 }}>
          Ανταλλάξτε μηνύματα με ασθενείς ή συναδέλφους ιατρούς.
        </p>
      </div>

      <div style={{ display: 'flex', flex: 1, gap: 20, overflow: 'hidden' }} className="max-md:!flex-col max-md:!overflow-auto">
        {/* Left Column - Thread List */}
        <div style={{ width: 280, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }} className={`max-md:!w-full max-md:flex-shrink-0 ${mobileShowChat ? 'max-md:!hidden' : ''}`}>
          {threads.map(t => {
            const isSel = t.id === activeId;
            const initials = t.name.split(' ').map(n => n[0]).join('');
            return (
              <button
                key={t.id}
                onClick={() => handleThreadSelect(t.id)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: 14,
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                  background: isSel ? 'var(--primary-bg)' : 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'all 0.12s',
                  position: 'relative',
                }}
              >
                {t.unread && (
                  <span style={{ position: 'absolute', top: 16, right: 14, width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)' }} />
                )}
                <CTAvatar initials={initials} size={36} bg={t.status === 'critical' ? 'var(--red-bg)' : 'var(--surface-2)'} color={t.status === 'critical' ? 'var(--red)' : 'var(--ink)'} border={t.status === 'critical' ? 'var(--red-bdr)' : 'var(--border)'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{t.time}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.lastMsg}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Column - Chat Pane */}
        <div style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className={`max-md:!w-full max-md:!h-full ${!mobileShowChat ? 'max-md:!hidden' : ''}`}>
          
          {/* Active Chat Header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} className="max-md:!px-3">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setMobileShowChat(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: 18,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  marginLeft: -8,
                  fontFamily: 'var(--font)',
                }}
                className="md:hidden font-semibold"
              >
                ←
              </button>
              <div>
                <span style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>{activeThread.name}</span>
                <span style={{ marginLeft: 8 }}>
                  <CTBadge label={activeThread.status === 'critical' ? 'Κρίσιμος' : activeThread.status === 'doctor' ? 'Συνάδελφος' : 'Σταθερός'} variant={activeThread.status === 'critical' ? 'high' : activeThread.status === 'doctor' ? 'pending' : 'normal'} />
                </span>
              </div>
            </div>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }} className="max-md:!hidden">HL7 Patient Consultation Channel</span>
          </div>

          {/* Message History */}
          <div style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {activeThread.history.map((m, i) => {
              const isDoc = m.sender === 'doctor';
              return (
                <div
                  key={i}
                  style={{
                    alignSelf: isDoc ? 'flex-end' : 'flex-start',
                    maxWidth: '70%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isDoc ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--r-lg)',
                      background: isDoc ? 'var(--primary)' : 'var(--surface-2)',
                      color: isDoc ? '#fff' : 'var(--ink)',
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
          </div>

          {/* Message Input Form */}
          <form onSubmit={handleSend} style={{ padding: 14, borderTop: '1px solid var(--border)', display: 'flex', gap: 10, background: 'var(--surface)' }}>
            <input
              type="text"
              placeholder="Πληκτρολογήστε μια απάντηση..."
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
            <CTBtn label="" variant="primary" type="submit" icon={<Send size={15} />} />
          </form>

        </div>
      </div>
    </div>
  );
};

// ── 3. Αναφορές (Global Reports Aggregator) ───────────────────────────
const GlobalReportsView: React.FC<{ patients: MappedPatient[]; navigate: (page: string, params?: Record<string, unknown>) => void }> = ({ patients, navigate }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const list: Report[] = [];
        // Sequential request loops to be Supabase-friendly (free pool limit 60)
        for (const p of patients) {
          const rList = await ctApi.getReports(p.dbId);
          list.push(...rList);
        }
        // Sort newest uploaded first
        list.sort((a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime());
        setReports(list);
      } catch (err) {
        console.error('Failed to load global reports:', err);
      } finally {
        setLoading(false);
      }
    };

    if (patients.length > 0) {
      fetchAll();
    } else {
      setLoading(false);
    }
  }, [patients]);

  const getPatientName = (patientId: number): string => {
    const match = patients.find(p => p.dbId === patientId);
    return match ? match.name : `Patient ID ${patientId}`;
  };

  const getPatientMrn = (patientId: number): string => {
    const match = patients.find(p => p.dbId === patientId);
    return match ? match.id : '-';
  };

  return (
    <div style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', letterSpacing: -0.3, margin: 0 }}>
          Κεντρικό Αρχείο Αναφορών
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 4 }}>
          Προβολή και λήψη όλων των ιατρικών γνωματεύσεων και εργαστηριακών εξετάσεων από το σύνολο των ασθενών.
        </p>
      </div>

      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh)', overflow: 'hidden' }}>
        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', color: 'var(--ink-3)', fontWeight: 600 }}>
              <th style={{ padding: '12px 16px' }}>Τίτλος Εξέτασης</th>
              <th style={{ padding: '12px 16px' }}>Κατηγορία</th>
              <th style={{ padding: '12px 16px' }}>Ασθενής</th>
              <th style={{ padding: '12px 16px' }}>Ημερομηνία</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ενέργεια</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1, 2, 3].map(idx => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '14px 16px' }}><div style={{ width: 140, height: 14, background: 'var(--surface)', borderRadius: 2, animation: 'pulse 1.5s infinite' }} /></td>
                  <td style={{ padding: '14px 16px' }}><div style={{ width: 80, height: 22, background: 'var(--surface)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} /></td>
                  <td style={{ padding: '14px 16px' }}><div style={{ width: 120, height: 14, background: 'var(--surface)', borderRadius: 2, animation: 'pulse 1.5s infinite' }} /></td>
                  <td style={{ padding: '14px 16px' }}><div style={{ width: 90, height: 14, background: 'var(--surface)', borderRadius: 2, animation: 'pulse 1.5s infinite' }} /></td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}><div style={{ width: 80, height: 28, background: 'var(--surface)', borderRadius: 'var(--r)', display: 'inline-block', animation: 'pulse 1.5s infinite' }} /></td>
                </tr>
              ))
            ) : reports.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--ink-3)' }}>
                  Δεν έχουν ανέβει διαγνωστικές αναφορές ακόμα.
                </td>
              </tr>
            ) : (
              reports.map(r => {
                const dateStr = new Date(r.report_date).toLocaleDateString('el-GR', { year: 'numeric', month: 'long', day: 'numeric' });
                const typeVariant = r.report_type === 'ECG' ? 'pending' : r.report_type === 'Lab' ? 'normal' : 'moderate';
                const fileUrl = r.file_url.startsWith('http') ? r.file_url : `${import.meta.env.VITE_API_URL || ''}${r.file_url}`;
                
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }} className="hover:bg-slate-50/50">
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--ink)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileText size={16} style={{ color: 'var(--ink-3)' }} />
                        {r.title}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <CTBadge label={r.report_type} variant={typeVariant} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 500, color: 'var(--ink-2)' }}>{getPatientName(r.patient_id)}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontFamily: 'var(--mono)', marginTop: 1 }}>{getPatientMrn(r.patient_id)}</div>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--ink-3)' }}>{dateStr}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <CTBtn 
                          label="Προφίλ" 
                          variant="secondary" 
                          size="sm" 
                          icon={<ArrowRight size={13} />} 
                          onClick={() => navigate('profile', { patientId: r.patient_id })}
                        />
                        <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                          <CTBtn label="Λήψη" variant="ghost" size="sm" />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
};

// ── 4. Ρυθμίσεις (Settings View) ──────────────────────────────────────
const SettingsView: React.FC<{ currentUser: User | null }> = ({ currentUser }) => {
  const [vitalsAlerts, setVitalsAlerts] = useState(true);
  const [maceReports, setMaceReports] = useState(false);
  const [fhirSync, setFhirSync] = useState(true);
  const [saved, setSaved] = useState(false);

  const roleLabelMap: Record<string, string> = {
    doctor: 'Ιατρός',
    cardiologist: 'Καρδιολόγος',
    admin: 'Διαχειριστής',
    patient: 'Ασθενής',
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleStyle = (on: boolean) => ({
    width: 38,
    height: 20,
    borderRadius: 10,
    background: on ? 'var(--primary)' : 'var(--border-s)',
    position: 'relative' as const,
    cursor: 'pointer',
    border: 'none',
    outline: 'none',
    transition: 'background 0.2s',
    padding: 0,
  });

  const toggleKnobStyle = (on: boolean) => ({
    width: 14,
    height: 14,
    borderRadius: '50%',
    background: '#fff',
    position: 'absolute' as const,
    top: 3,
    left: on ? 21 : 3,
    transition: 'left 0.2s',
  });

  return (
    <div style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', letterSpacing: -0.3, margin: 0 }}>
          Ρυθμίσεις Συστήματος
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 4 }}>
          Διαμορφώστε τις προτιμήσεις του κλινικού σας λογαριασμού και τις ειδοποιήσεις.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 600 }}>
        {/* Profile Card */}
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px 24px', boxShadow: 'var(--sh)', display: 'flex', alignItems: 'center', gap: 16 }}>
          <CTAvatar initials={currentUser ? currentUser.name.split(' ').map(n => n[0]).join('') : 'ΝΙ'} size={48} />
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{currentUser ? currentUser.name : 'Δρ. Νικολάου'}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{currentUser ? currentUser.email : 'dr.smith@cardiotrack.dev'}</span>
              <CTBadge label={roleLabelMap[currentUser?.role || 'doctor']} variant={currentUser?.role === 'cardiologist' ? 'chronic' : 'pending'} />
            </div>
          </div>
        </div>

        {/* Configurations Form */}
        <form onSubmit={handleSave} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '24px', boxShadow: 'var(--sh)', display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
            Κλινικές Ειδοποιήσεις
          </div>

          {/* Toggle 1 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1, paddingRight: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Ειδοποιήσεις Κρίσιμων Τιμών</h4>
              <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>
                Να εμφανίζονται toast alerts στο UI όταν καταγράφονται observations (BP, SpO2) εκτός φυσιολογικών ορίων.
              </p>
            </div>
            <button type="button" onClick={() => setVitalsAlerts(!vitalsAlerts)} style={toggleStyle(vitalsAlerts)}>
              <span style={toggleKnobStyle(vitalsAlerts)} />
            </button>
          </div>

          {/* Toggle 2 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1, paddingRight: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Αυτόματη Αποστολή MACE Reports</h4>
              <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>
                Αποστολή αυτόματων αναφορών με email για ασθενείς με υψηλό κίνδυνο (HEART score ≥ 7).
              </p>
            </div>
            <button type="button" onClick={() => setMaceReports(!maceReports)} style={toggleStyle(maceReports)}>
              <span style={toggleKnobStyle(maceReports)} />
            </button>
          </div>

          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: '1px solid var(--border)', paddingBottom: 8, marginTop: 10 }}>
            Διαλειτουργικότητα (Interoperability)
          </div>

          {/* Toggle 3 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1, paddingRight: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>HL7 FHIR R4 Auto-Sync</h4>
              <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>
                Αυτόματος συγχρονισμός όλων των καταχωρήσεων με τον κεντρικό FHIR R4 server.
              </p>
            </div>
            <button type="button" onClick={() => setFhirSync(!fhirSync)} style={toggleStyle(fhirSync)}>
              <span style={toggleKnobStyle(fhirSync)} />
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Lock size={14} /> Security: TLS 1.3 Active
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {saved && (
                <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle size={15} /> Αποθηκεύτηκε!
                </span>
              )}
              <CTBtn label="Αποθήκευση" type="submit" variant="primary" />
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};


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
      className="max-md:!px-3 max-md:!gap-2"
    >
      <span style={{ fontWeight: 700, fontSize: 16, color: 'oklch(90% 0.04 245)', letterSpacing: 0.3 }}>
        CardioTrack
      </span>
      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.18)', margin: '0 6px' }} className="max-md:!hidden" />
      <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.88)' }} className="max-md:!hidden">Ασθενείς</span>
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
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginLeft: 10 }} className="max-md:!hidden">{name}</span>
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
  navigate?: (page: string, params?: Record<string, unknown>) => void;
  onChangeTab?: (tab: string) => void;
}

const DocNav: React.FC<DocNavProps> = ({ active, currentUser, navigate, onChangeTab }) => {
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
      className="max-md:!w-full max-md:!flex-row max-md:!pt-0 max-md:!border-r-0 max-md:!border-b max-md:!overflow-x-auto max-md:!scrollbar-none max-md:!whitespace-nowrap"
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
        className="max-md:!hidden"
      >
        {label}
      </div>
      {NAV_ITEMS.map(item => {
        const on = item.id === active;
        return (
          <button
            key={item.id}
            onClick={() => onChangeTab?.(item.id)}
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
            className={`max-md:!w-auto max-md:!py-3 max-md:!px-4 max-md:!border-r-0 max-md:!border-b-2 max-md:flex-shrink-0 ${on ? 'max-md:!border-b-[var(--primary)]' : 'max-md:!border-b-transparent'}`}
          >
            {item.label}
          </button>
        );
      })}

      {currentUser?.role === 'admin' && (
        <button
          onClick={() => navigate?.('admin')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '9px 18px',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--primary)',
            background: 'var(--primary-bg)',
            border: 'none',
            borderLeft: '3px solid var(--primary)',
            cursor: 'pointer',
            fontFamily: 'var(--font)',
            textAlign: 'left',
            width: '100%',
            transition: 'background 0.12s, color 0.12s',
            marginTop: 12,
          }}
          className="max-md:!w-auto max-md:!m-0 max-md:!border-l-0 max-md:!border-b-2 max-md:!border-b-[var(--primary)] max-md:flex-shrink-0"
        >
          ⚙️ Διαχείριση
        </button>
      )}
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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 26 }} className="max-md:!grid-cols-1 max-md:!gap-3">
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
  onImportFHIRClick: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ search, onSearch, filter, onFilter, sort, onSort, onImportFHIRClick }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320 }} className="max-md:!max-w-none max-md:!w-full max-md:!flex-none">
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
      <div style={{ display: 'flex', gap: 5 }} className="max-md:!w-full max-md:!overflow-x-auto max-md:!pb-1 max-md:!scrollbar-none max-md:!whitespace-nowrap max-md:!flex-nowrap">
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
        className="max-md:!w-full"
      >
        {SORT_OPTS.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <CTBtn label="Εισαγωγή από FHIR" variant="secondary" onClick={onImportFHIRClick} />
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
      <div className="overflow-x-auto">
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
  </div>
  );
};

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
          maxWidth: 440,
          padding: '24px',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'none',
            border: 'none',
            fontSize: 22,
            cursor: 'pointer',
            color: 'var(--ink-3)',
            lineHeight: 1,
          }}
        >
          ×
        </button>
        <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{title}</h3>
        {children}
      </div>
    </div>
  );
};

// ── Patients Dashboard Page ───────────────────────────────────
export const Patients: React.FC<PatientsProps> = ({ navigate, currentUser }) => {
  const [activeTab, setActiveTab] = useState('patients');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Όλοι');
  const [sort,   setSort]   = useState('lastObs');
  const [patients, setPatients] = useState<MappedPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // FHIR Ingestion states
  const [fhirModalOpen, setFhirModalOpen] = useState(false);
  const [fhirIdInput, setFhirIdInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);

  const loadPatients = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const filters: { doctor_id?: number } = {};
      if (currentUser && currentUser.role === 'doctor') {
        filters.doctor_id = currentUser.id;
      }

      const data = await ctApi.getPatients(filters);
      
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Αποτυχία φόρτωσης ασθενών.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, [currentUser]);

  const handleImportFHIR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fhirIdInput.trim()) return;
    
    setIsImporting(true);
    setImportStatus(null);
    try {
      const res = await ctApi.importFHIRPatient(fhirIdInput.trim());
      setImportStatus({ success: true, message: res.message || 'Ο ασθενής εισήχθη με επιτυχία!' });
      setFhirIdInput('');
      // Reload the patient list
      await loadPatients();
    } catch (err: any) {
      setImportStatus({
        success: false,
        message: err.message || 'Αποτυχία άντλησης από το HAPI FHIR Sandbox.'
      });
    } finally {
      setIsImporting(false);
    }
  };

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
          <DocNav active="patients" currentUser={currentUser} navigate={navigate} />
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
          <DocNav active="patients" currentUser={currentUser} navigate={navigate} />
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
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }} className="max-md:!flex-col max-md:!overflow-auto">
        <DocNav active={activeTab} currentUser={currentUser} navigate={navigate} onChangeTab={setActiveTab} />
        <main style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }} className="max-md:!p-4 max-md:!overflow-visible">
          
          {activeTab === 'patients' && (
            <>
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
                onImportFHIRClick={() => { setFhirModalOpen(true); setImportStatus(null); }}
              />
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 10 }}>
                {filtered.length === patients.length
                  ? `${patients.length} ασθενείς`
                  : `${filtered.length} από ${patients.length} ασθενείς`}
              </div>
              <PatientTable patients={filtered} navigate={navigate} />
            </>
          )}

          {activeTab === 'schedule' && <ScheduleView />}
          {activeTab === 'messages' && <MessagesView currentUser={currentUser} />}
          {activeTab === 'reports' && <GlobalReportsView patients={patients} navigate={navigate} />}
          {activeTab === 'settings' && <SettingsView currentUser={currentUser} />}

        </main>
      </div>

      {/* ── MODAL: Import from HAPI FHIR ── */}
      <Modal isOpen={fhirModalOpen} onClose={() => setFhirModalOpen(false)} title="Εισαγωγή Ασθενή από HAPI FHIR Sandbox">
        <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 16 }}>
          Χρησιμοποιείται το δημόσιο <strong>HAPI FHIR Server</strong> (<code>hapi.fhir.org/baseR4</code>) ως πηγή δεδομένων.
          Εισαγάγετε ένα FHIR Patient ID για να εισαχθούν τα δημογραφικά στοιχεία και τυχόν διαθέσιμη ECG Observation.
        </p>
        <form onSubmit={handleImportFHIR}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-2)', display: 'block', marginBottom: 5 }}>
              FHIR Patient ID
            </label>
            <input
              value={fhirIdInput}
              onChange={e => setFhirIdInput(e.target.value)}
              placeholder="π.χ. example, 123456, smart-1032702…"
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 13.5,
                border: '1px solid var(--border-s)',
                borderRadius: 'var(--r)',
                background: 'var(--bg)',
                color: 'var(--ink)',
                fontFamily: 'var(--mono)',
                boxSizing: 'border-box',
              }}
              disabled={isImporting}
            />
          </div>
          {importStatus && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--r)',
                fontSize: 13,
                marginBottom: 12,
                background: importStatus.success ? 'var(--green-bg)' : 'var(--red-bg)',
                border: `1px solid ${importStatus.success ? 'var(--green-bdr)' : 'var(--red-bdr)'}`,
                color: importStatus.success ? 'var(--green)' : 'var(--red)',
              }}
            >
              {importStatus.message}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setFhirModalOpen(false)}
              style={{
                padding: '7px 16px', fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
                border: '1px solid var(--border-s)', borderRadius: 'var(--r)',
                background: 'var(--bg)', color: 'var(--ink-2)',
              }}
            >
              Ακύρωση
            </button>
            <button
              type="submit"
              disabled={isImporting || !fhirIdInput.trim()}
              style={{
                padding: '7px 18px', fontSize: 13.5, fontWeight: 600, cursor: isImporting ? 'wait' : 'pointer',
                border: '1px solid transparent', borderRadius: 'var(--r)',
                background: 'var(--primary)', color: '#fff',
                opacity: (isImporting || !fhirIdInput.trim()) ? 0.6 : 1,
              }}
            >
              {isImporting ? 'Εισαγωγή…' : 'Εισαγωγή από FHIR'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
