import React, { useState, useEffect } from 'react';
import { ctApi } from '../lib/api';
import { User } from '../types/fhir';
import { CTAvatar, CTBadge, CTBtn } from '../components/ui';
import { 
  Users, 
  Activity, 
  UserCheck, 
  Search, 
  ShieldAlert, 
  Filter, 
  CheckCircle2, 
  RefreshCw, 
  Database 
} from 'lucide-react';

interface AdminPanelProps {
  navigate: (page: string, params?: Record<string, unknown>) => void;
  currentUser: User | null;
}

interface Stats {
  total_users: number;
  total_patients: number;
  total_observations: number;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ navigate, currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const adminName = currentUser ? currentUser.name : 'Διαχειριστής';
  const adminInitials = currentUser ? currentUser.name.split(' ').map(n => n[0]).join('') : 'AD';

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      // Load stats and users sequentially to prevent Supabase PgBouncer spikes
      const statsRes = await ctApi.getAdminStats();
      setStats(statsRes);
      
      const usersRes = await ctApi.getAdminUsers();
      setUsers(usersRes);
    } catch (err: unknown) {
      console.error('Admin Panel loading failed:', err);
      setError(err instanceof Error ? err.message : 'Αποτυχία φόρτωσης δεδομένων.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRoleChange = async (userId: number, newRole: 'patient' | 'doctor' | 'cardiologist' | 'admin') => {
    setUpdatingUserId(userId);
    setToastMessage(null);
    try {
      await ctApi.changeUserRole(userId, newRole);
      
      // Update local state smoothly
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      
      // Update statistics locally if someone was promoted/demoted (stats could change dynamically)
      // Trigger temporary success notification
      setToastMessage('Ο ρόλος του χρήστη ενημερώθηκε επιτυχώς!');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Αποτυχία ενημέρωσης ρόλου.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Filter and Search logic
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = 
      selectedRoleFilter === 'all' || 
      user.role === selectedRoleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', fontFamily: 'var(--font)' }}>
      {/* ── Top Navigation Bar ───────────────────────────────── */}
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
        <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>
          Κονσόλα Διαχείρισης
        </span>
        <div style={{ flex: 1 }} />
        
        {toastMessage && (
          <span
            style={{
              padding: '4px 12px',
              borderRadius: 4,
              fontSize: 12.5,
              fontWeight: 500,
              background: 'var(--green-bg)',
              border: '1px solid var(--green-bdr)',
              color: 'var(--green)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              animation: 'fadeIn 0.2s ease-in-out',
            }}
          >
            <CheckCircle2 size={14} /> {toastMessage}
          </span>
        )}

        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginLeft: 10 }}>{adminName}</span>
        <CTAvatar initials={adminInitials} size={32} bg="oklch(30% 0.06 255)" color="oklch(80% 0.08 245)" border="oklch(40% 0.07 255)" />
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

      {/* ── Main Layout ──────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Sidebar Nav */}
        <div
          style={{
            width: 210,
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
            Διαχειριστής
          </div>

          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '10px 18px',
              fontSize: 13.5,
              fontWeight: 600,
              color: 'var(--primary)',
              background: 'var(--primary-bg)',
              border: 'none',
              borderLeft: '3px solid var(--primary)',
              textAlign: 'left',
              cursor: 'default',
            }}
          >
            <Users size={16} /> Χρήστες &amp; Ρόλοι
          </button>

          <button
            onClick={() => navigate('patients')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '10px 18px',
              fontSize: 13.5,
              fontWeight: 500,
              color: 'var(--ink-2)',
              background: 'none',
              border: 'none',
              borderLeft: '3px solid transparent',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'none';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-2)';
            }}
          >
            <Activity size={16} /> Λίστα Ασθενών
          </button>

          <div style={{ marginTop: 'auto', padding: '18px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-3)' }}>
              <Database size={13} />
              <span>Supabase DB Pool Active</span>
            </div>
          </div>
        </div>

        {/* ── Main Content Pane ───────────────────────────────── */}
        <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Welcome and Reload Banner */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', letterSpacing: -0.4 }}>
                Καλώς ορίσατε, {adminName}
              </h2>
              <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 2 }}>
                Διαχειριστείτε τους ρόλους των χρηστών και παρακολουθήστε την κατάσταση του συστήματος CardioTrack.
              </p>
            </div>
            
            <CTBtn 
              label="Ανανέωση" 
              variant="secondary" 
              icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />} 
              onClick={fetchData} 
              disabled={loading}
            />
          </div>

          {/* Error banner */}
          {error && (
            <div
              style={{
                padding: '12px 16px',
                background: 'var(--red-bg)',
                border: '1px solid var(--red-bdr)',
                borderRadius: 'var(--r)',
                color: 'var(--red)',
                fontSize: 13.5,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <ShieldAlert size={16} /> {error}
            </div>
          )}

          {/* ── System Stats Grid ─────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {/* Total Users Card */}
            <div
              style={{
                background: 'var(--bg)',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--r-lg)',
                padding: '18px 20px',
                boxShadow: 'var(--sh)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                  Εγγεγραμμένοι Χρήστες
                </div>
                <div style={{ fontSize: 32, fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--mono)', lineHeight: 1 }}>
                  {loading ? '...' : stats?.total_users ?? 0}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 5 }}>
                  Συνολικοί λογαριασμοί JWT
                </div>
              </div>
              <div style={{ padding: 12, borderRadius: '50%', background: 'var(--primary-bg)', color: 'var(--primary)' }}>
                <Users size={24} />
              </div>
            </div>

            {/* Total Patients Card */}
            <div
              style={{
                background: 'var(--bg)',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--r-lg)',
                padding: '18px 20px',
                boxShadow: 'var(--sh)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                  Προφίλ Ασθενών
                </div>
                <div style={{ fontSize: 32, fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--mono)', lineHeight: 1 }}>
                  {loading ? '...' : stats?.total_patients ?? 0}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 5 }}>
                  HL7 FHIR Patient Resources
                </div>
              </div>
              <div style={{ padding: 12, borderRadius: '50%', background: 'var(--green-bg)', color: 'var(--green)' }}>
                <UserCheck size={24} />
              </div>
            </div>

            {/* Total Observations Card */}
            <div
              style={{
                background: 'var(--bg)',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--r-lg)',
                padding: '18px 20px',
                boxShadow: 'var(--sh)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                  Ιατρικές Παρατηρήσεις
                </div>
                <div style={{ fontSize: 32, fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--mono)', lineHeight: 1 }}>
                  {loading ? '...' : stats?.total_observations ?? 0}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 5 }}>
                  FHIR Vitals (BP, HR, SpO2)
                </div>
              </div>
              <div style={{ padding: 12, borderRadius: '50%', background: 'var(--amber-bg)', color: 'var(--amber)' }}>
                <Activity size={24} />
              </div>
            </div>
          </div>

          {/* ── User Registry & Role Management ────────────────── */}
          <div
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)',
              padding: 20,
              boxShadow: 'var(--sh)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              flex: 1,
            }}
          >
            {/* Table controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} />
                <input
                  type="text"
                  placeholder="Αναζήτηση με όνομα ή email..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    fontSize: 13.5,
                    border: '1px solid var(--border-s)',
                    borderRadius: 'var(--r)',
                    background: 'var(--surface)',
                    color: 'var(--ink)',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Role filter pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 500, marginRight: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Filter size={13} /> Φίλτρο:
                </span>
                {['all', 'patient', 'doctor', 'cardiologist', 'admin'].map(roleOpt => {
                  const on = selectedRoleFilter === roleOpt;
                  const labelMap: Record<string, string> = {
                    all: 'Όλοι',
                    patient: 'Ασθενείς',
                    doctor: 'Ιατροί',
                    cardiologist: 'Καρδιολόγοι',
                    admin: 'Admins',
                  };
                  return (
                    <button
                      key={roleOpt}
                      onClick={() => setSelectedRoleFilter(roleOpt)}
                      style={{
                        padding: '5px 12px',
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                        border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                        borderRadius: 16,
                        background: on ? 'var(--primary-bg)' : 'var(--bg)',
                        color: on ? 'var(--primary)' : 'var(--ink-2)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {labelMap[roleOpt]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Users table */}
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', color: 'var(--ink-3)', fontWeight: 600 }}>
                    <th style={{ padding: '10px 16px' }}>Όνομα</th>
                    <th style={{ padding: '10px 16px' }}>Email</th>
                    <th style={{ padding: '10px 16px' }}>Ρόλος Χρήστη</th>
                    <th style={{ padding: '10px 16px' }}>Ημερομηνία Εγγραφής</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right' }}>Διαχείριση</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    // Loading skeleton rows
                    [1, 2, 3, 4].map(idx => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '14px 16px' }}><div style={{ width: 120, height: 14, background: 'var(--surface)', borderRadius: 2, animation: 'pulse 1.5s infinite' }} /></td>
                        <td style={{ padding: '14px 16px' }}><div style={{ width: 160, height: 14, background: 'var(--surface)', borderRadius: 2, animation: 'pulse 1.5s infinite' }} /></td>
                        <td style={{ padding: '14px 16px' }}><div style={{ width: 80, height: 22, background: 'var(--surface)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} /></td>
                        <td style={{ padding: '14px 16px' }}><div style={{ width: 100, height: 14, background: 'var(--surface)', borderRadius: 2, animation: 'pulse 1.5s infinite' }} /></td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}><div style={{ width: 110, height: 28, background: 'var(--surface)', borderRadius: 'var(--r)', display: 'inline-block', animation: 'pulse 1.5s infinite' }} /></td>
                      </tr>
                    ))
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--ink-3)' }}>
                        Δεν βρέθηκαν χρήστες με τα κριτήρια αναζήτησης.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(user => {
                      const isUpdating = updatingUserId === user.id;
                      const dateStr = user.createdAt ? new Date(user.createdAt).toLocaleDateString('el-GR', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';
                      
                      const badgeVariant = user.role === 'admin' ? 'high' : user.role === 'cardiologist' ? 'chronic' : user.role === 'doctor' ? 'pending' : 'normal';
                      const roleLabelMap: Record<string, string> = {
                        patient: 'Ασθενής',
                        doctor: 'Ιατρός',
                        cardiologist: 'Καρδιολόγος',
                        admin: 'Admin',
                      };

                      return (
                        <tr 
                          key={user.id} 
                          style={{ 
                            borderBottom: '1px solid var(--border)',
                            background: isUpdating ? 'var(--primary-bg)' : 'transparent',
                            transition: 'background 0.2s',
                          }}
                        >
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--ink)' }}>{user.name}</td>
                          <td style={{ padding: '12px 16px', fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-2)' }}>{user.email}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <CTBadge label={roleLabelMap[user.role] || user.role} variant={badgeVariant} />
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--ink-3)' }}>{dateStr}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <select
                              value={user.role}
                              disabled={isUpdating || user.id === currentUser?.id} // Don't let active admin self-demote accidentally
                              onChange={e => handleRoleChange(user.id, e.target.value as 'patient' | 'doctor' | 'cardiologist' | 'admin')}
                              style={{
                                padding: '5px 8px',
                                fontSize: 13,
                                border: '1px solid var(--border-s)',
                                borderRadius: 'var(--r)',
                                background: 'var(--bg)',
                                color: 'var(--ink)',
                                cursor: 'pointer',
                                outline: 'none',
                                transition: 'all 0.12s',
                              }}
                            >
                              <option value="patient">Ασθενής</option>
                              <option value="doctor">Ιατρός</option>
                              <option value="cardiologist">Καρδιολόγος</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* User count footer banner */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--ink-3)', padding: '4px 0' }}>
              <span>
                Εμφάνιση <strong>{filteredUsers.length}</strong> από <strong>{users.length}</strong> εγγεγραμμένους χρήστες
              </span>
              <span>
                CardioTrack Interoperability Engine v1.0.0
              </span>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
