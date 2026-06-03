import React, { useEffect, useRef, useState } from 'react';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CLINICAL WAVEFORM SYNTHESIS — Gaussian PQRST + SpO2 Pleth + Respiratory
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const G = (t: number, μ: number, σ: number, A: number) =>
  A * Math.exp(-((t - μ) ** 2) / (2 * σ * σ));

/** Gaussian-based PQRST complex (returns mV, approx ±1.5 mV range) */
const ecgSample = (tMs: number, rrMs: number, lead: 'I' | 'II' | 'III'): number => {
  const t = ((tMs % rrMs) + rrMs) % rrMs / rrMs;  // 0–1 within cardiac cycle
  
  let pAmp = 0.13, qAmp = -0.11, rAmp = 1.12, sAmp = -0.16, tAmp = 0.30;
  
  if (lead === 'I') {
    pAmp = 0.08; qAmp = -0.05; rAmp = 0.55; sAmp = -0.10; tAmp = 0.18;
  } else if (lead === 'III') {
    pAmp = 0.05; qAmp = -0.15; rAmp = 0.35; sAmp = -0.25; tAmp = 0.12;
  }
  
  return (
    G(t, 0.11, 0.022,  pAmp) +   // P wave
    G(t, 0.27, 0.007,  qAmp) +   // Q (negative)
    G(t, 0.30, 0.010,  rAmp) +   // R peak
    G(t, 0.33, 0.007,  sAmp) +   // S (negative)
    G(t, 0.46, 0.040,  tAmp) +   // T wave
    0.012 * Math.sin(2 * Math.PI * t * 0.8) +  // baseline wander
    (Math.random() - 0.5) * 0.016             // EMG noise
  );
};

/** Windkessel-inspired SpO2 plethysmography (0–1 amplitude, pre-scaled) */
const plethSample = (tMs: number, rrMs: number, spo2: number): number => {
  const t = ((tMs % rrMs) + rrMs) % rrMs / rrMs;
  let v = 0;
  if (t < 0.22)      v = Math.sin(Math.PI * t / 0.22);             // systolic rise
  else if (t < 0.38) v = 0.15 + 0.10 * Math.sin(Math.PI * (t - 0.22) / 0.16); // dicrotic notch
  else               v = 0.12 * Math.exp(-6 * (t - 0.38));          // diastolic run-off
  const pi = Math.max(0.2, (spo2 - 90) / 10);  // perfusion index
  return v * pi + (Math.random() - 0.5) * 0.008;
};

/** Breathing (inspiration 35%, expiration 65%) */
const respSample = (tMs: number, breathMs: number): number => {
  const t = ((tMs % breathMs) + breathMs) % breathMs / breathMs;
  const v = t < 0.35
    ? Math.sin(Math.PI * t / 0.35)          // inspiration
    : Math.sin(Math.PI * (1 - t) / 0.65);   // expiration
  return v + (Math.random() - 0.5) * 0.012;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ECG PAPER GRID helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const drawGrid = (ctx: CanvasRenderingContext2D, w: number, h: number, minorPx = 10) => {
  const majorPx = minorPx * 5;
  ctx.lineWidth = 0.4;
  for (let x = 0; x <= w; x += minorPx) {
    ctx.strokeStyle = x % majorPx === 0 ? 'rgba(239,68,68,0.22)' : 'rgba(239,68,68,0.07)';
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y <= h; y += minorPx) {
    ctx.strokeStyle = y % majorPx === 0 ? 'rgba(239,68,68,0.22)' : 'rgba(239,68,68,0.07)';
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
};

const drawGridRange = (ctx: CanvasRenderingContext2D, xStart: number, xEnd: number, w: number, h: number, minorPx = 10) => {
  const majorPx = minorPx * 5;
  ctx.lineWidth = 0.4;
  
  // Draw vertical lines in the range [xStart, xEnd]
  const startX = Math.ceil(xStart / minorPx) * minorPx;
  for (let x = startX; x <= xEnd && x <= w; x += minorPx) {
    ctx.strokeStyle = x % majorPx === 0 ? 'rgba(239,68,68,0.22)' : 'rgba(239,68,68,0.07)';
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  
  // Draw horizontal lines across the range [xStart, xEnd]
  for (let y = 0; y <= h; y += minorPx) {
    ctx.strokeStyle = y % majorPx === 0 ? 'rgba(239,68,68,0.22)' : 'rgba(239,68,68,0.07)';
    ctx.beginPath(); ctx.moveTo(xStart, y); ctx.lineTo(Math.min(xEnd, w), y); ctx.stroke();
  }
};

const eraseAndRedrawGrid = (
  ctx: CanvasRenderingContext2D,
  xStart: number,
  eraseW: number,
  w: number,
  h: number,
  minorPx = 10
) => {
  ctx.fillStyle = '#03040c'; // BG color
  const xEnd = xStart + eraseW;
  if (xEnd <= w) {
    // Single contiguous area to clear
    ctx.fillRect(xStart, 0, eraseW, h);
    drawGridRange(ctx, xStart, xEnd, w, h, minorPx);
  } else {
    // Split into two areas due to wrap-around
    const w1 = w - xStart;
    ctx.fillRect(xStart, 0, w1, h);
    drawGridRange(ctx, xStart, w, w, h, minorPx);

    const w2 = xEnd - w;
    ctx.fillRect(0, 0, w2, h);
    drawGridRange(ctx, 0, w2, w, h, minorPx);
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface AlarmEntry { id: number; message: string; time: Date; severity: 'critical' | 'warning'; }

interface BedsideMonitorProps { patientId: number; }

export const BedsideMonitor: React.FC<BedsideMonitorProps> = ({ patientId }) => {
  // ── Display state (triggers React re-renders for numerics) ──────────────
  const [displayVitals, setDisplayVitals] = useState({
    hr: 72, spo2: 98.0, sbp: 120, dbp: 80, rr: 16, temp: 36.8, hrv: 65,
  });
  const [abnormalVitals, setAbnormalVitals] = useState<Record<string, boolean>>({});
  const [status, setStatus]   = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [clock, setClock]     = useState(new Date());
  const [alarms, setAlarms]   = useState<AlarmEntry[]>([]);
  const [leadMode, setLeadMode]   = useState<'I' | 'II' | 'III'>('II');
  const [sweepSpeed, setSweepSpeed] = useState<25 | 50>(25);

  // ── Animation refs — read by canvas loops without causing re-renders ────
  const hrRef    = useRef(72);
  const spo2Ref  = useRef(98);
  const rrRef    = useRef(16);
  const abnRef   = useRef<Record<string, boolean>>({});
  const sweepRef = useRef(sweepSpeed);
  sweepRef.current = sweepSpeed;
  const leadRef  = useRef(leadMode);
  leadRef.current = leadMode;

  // ── Canvas refs ─────────────────────────────────────────────────────────
  const ecgRef  = useRef<HTMLCanvasElement | null>(null);
  const spo2Ref2 = useRef<HTMLCanvasElement | null>(null);
  const rrRef2   = useRef<HTMLCanvasElement | null>(null);

  const alarmCtr = useRef(0);
  const audioCtx = useRef<AudioContext | null>(null);

  // ── Live clock ──────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Beep helper (called from animation loop) ────────────────────────────
  const beep = (freq: number, dur: number, vol: number) => {
    try {
      if (!audioCtx.current) {
        audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtx.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.start(); osc.stop(ctx.currentTime + dur);
    } catch { /* browser policy until first user gesture */ }
  };
  const beepRef = useRef(beep);
  beepRef.current = beep;

  // ── WebSocket — live vital updates from Go backend ──────────────────────
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const envApiUrl = import.meta.env.VITE_API_URL;
    let host = envApiUrl 
      ? envApiUrl.replace(/^http:\/\/|^https:\/\//, '') 
      : window.location.host;
    // Strip trailing /api/v1 since WS endpoints are registered at root level in Go
    host = host.replace(/\/api\/v1\/?$/, '');
    const ws = new WebSocket(`${protocol}//${host}/ws/live-monitor?patient_id=${patientId}`);
    setStatus('connecting');

    ws.onopen  = () => {
      console.log(`[WS Live Monitor] Connected for patient ${patientId}`);
      setStatus('connected');
    };
    ws.onerror = (err) => {
      console.error(`[WS Live Monitor] Connection error for patient ${patientId}:`, err);
      setStatus('disconnected');
    };
    ws.onclose = (event) => {
      console.warn(`[WS Live Monitor] Connection closed for patient ${patientId}. Code: ${event.code}, Reason: ${event.reason}`);
      setStatus('disconnected');
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const val = Number(msg.value);
        const isAbn = Boolean(msg.is_abnormal);

        // Update animation refs immediately (no re-render cost)
        if (msg.type === 'heart_rate') { hrRef.current   = val; }
        if (msg.type === 'spo2')       { spo2Ref.current = val; }
        if (msg.type === 'resp_rate')  { rrRef.current   = val; }
        abnRef.current[msg.type] = isAbn;
        
        // Trigger React UI updates for abnormal state immediately
        setAbnormalVitals(prev => {
          if (prev[msg.type] === isAbn) return prev;
          return { ...prev, [msg.type]: isAbn };
        });

        // Update numeric display
        setDisplayVitals(prev => {
          const next = { ...prev };
          if (msg.type === 'heart_rate')   next.hr   = val;
          if (msg.type === 'spo2')         next.spo2 = val;
          if (msg.type === 'systolic_bp')  next.sbp  = val;
          if (msg.type === 'diastolic_bp') next.dbp  = val;
          if (msg.type === 'resp_rate')    next.rr   = val;
          if (msg.type === 'temperature')  next.temp = val;
          if (msg.type === 'hrv_sdnn')     next.hrv  = val;
          return next;
        });

        // Alarm evaluation
        let alarm = '';
        let sev: 'critical' | 'warning' = 'warning';
        if (msg.type === 'heart_rate') {
          if (val > 130) { alarm = `Tachycardia — HR: ${val} bpm`; sev = 'critical'; }
          else if (val > 100) { alarm = `Elevated HR: ${val} bpm`; }
          else if (val < 40)  { alarm = `Severe Bradycardia — HR: ${val} bpm`; sev = 'critical'; }
          else if (val < 55)  { alarm = `Bradycardia — HR: ${val} bpm`; }
        }
        if (msg.type === 'spo2') {
          if (val < 88) { alarm = `Critical Hypoxia — SpO₂: ${val}%`; sev = 'critical'; }
          else if (val < 92) { alarm = `Low SpO₂: ${val}%`; }
        }
        if (msg.type === 'systolic_bp') {
          if (val > 180) { alarm = `Hypertensive Crisis — SBP: ${val} mmHg`; sev = 'critical'; }
          else if (val > 160) { alarm = `Hypertension — SBP: ${val} mmHg`; }
          else if (val < 80)  { alarm = `Hypotension — SBP: ${val} mmHg`; sev = 'critical'; }
        }
        if (msg.type === 'resp_rate') {
          if (val > 30 || val < 8) { alarm = `Abnormal RR: ${val} br/min`; sev = 'critical'; }
        }
        if (msg.type === 'temperature') {
          if (val > 39.5) { alarm = `Fever — Temp: ${val}°C`; }
          if (val < 35.0) { alarm = `Hypothermia — Temp: ${val}°C`; sev = 'critical'; }
        }

        if (alarm) {
          alarmCtr.current += 1;
          setAlarms(prev => [{ id: alarmCtr.current, message: alarm, time: new Date(), severity: sev }, ...prev].slice(0, 6));
          if (sev === 'critical') beepRef.current(1400, 0.3, 0.06);
        }
      } catch { /* ignore parse errors */ }
    };

    return () => ws.close();
  }, [patientId]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ECG CANVAS — runs ONCE, reads from refs (no restart = no flat-line glitch)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  useEffect(() => {
    const canvas = ecgRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const W = canvas.width;
    const H = canvas.height;
    const BG = '#03040c';
    const BASELINE = H * 0.60;   // ← shifted DOWN so R-peak has headroom
    const MV2PX = 34;            // 1 mV = 34 pixels (≈10mm/mV at 3.4px/mm)
    const ERASE_W = 30;          // px ahead of sweep arm to erase

    // Draw initial background + grid
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    drawGrid(ctx, W, H, 10);

    let timeMs = 0;
    let xPos = 0;
    let prevY = BASELINE;
    let lastTs = 0;
    let lastRBeat = -999; // timestamp of last R-peak (for beep debounce)
    let animId: number;

    const frame = (ts: number) => {
      if (lastTs === 0) lastTs = ts;
      const dt = Math.min(ts - lastTs, 50);
      lastTs = ts;
      timeMs += dt;

      const hr  = Math.max(30, Math.min(220, hrRef.current));
      const rrMs = 60000 / hr;
      const isAbn = abnRef.current.heart_rate || false;

      // Pixels per ms at current sweep speed
      const pxPerMs = (sweepRef.current * 4) / 1000; // 25mm/s × 4px/mm / 1000ms
      const advance = pxPerMs * dt;

      const newX = xPos + advance;
      const sample = ecgSample(timeMs, rrMs, leadRef.current);
      const newY = BASELINE - sample * MV2PX;

      // Clamp to canvas bounds (prevent bleeding outside canvas)
      const clampedY = Math.max(2, Math.min(H - 2, newY));

      // ── Erase strip ahead ────────────────────────────────────────────
      eraseAndRedrawGrid(ctx, newX % W, ERASE_W, W, H, 10);

      // ── Draw ECG trace ───────────────────────────────────────────────
      const color = isAbn ? '#f87171' : '#10b981';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 4;
      ctx.shadowColor = color;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      ctx.beginPath();
      if (newX < W) {
        // Normal sweep (no wrap this frame)
        ctx.moveTo(xPos, prevY);
        ctx.lineTo(newX, clampedY);
      } else {
        // Wrapping: draw to right edge, then restart from left
        const fracToEdge = (W - xPos) / advance;
        const edgeY = prevY + (clampedY - prevY) * fracToEdge;
        ctx.moveTo(xPos, prevY);
        ctx.lineTo(W, edgeY);
        ctx.stroke();

        ctx.beginPath();
        const wrappedX = newX % W;
        ctx.moveTo(0, edgeY);
        ctx.lineTo(wrappedX, clampedY);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // ── R-peak beep (fire once per beat via threshold crossing) ──────
      const cyclePos = timeMs % rrMs;
      const rPeakMs = rrMs * 0.30;
      if (cyclePos < rPeakMs && cyclePos + dt >= rPeakMs && timeMs - lastRBeat > rrMs * 0.5) {
        lastRBeat = timeMs;
        beepRef.current(isAbn ? 1100 : 800, 0.08, isAbn ? 0.05 : 0.025);
      }

      prevY = clampedY;
      xPos = newX % W;

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, []); // ← empty deps: starts ONCE, reads vitals from refs

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SPO2 PLETH CANVAS — same pattern, different synthesis
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  useEffect(() => {
    const canvas = spo2Ref2.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;
    const BG = '#03040c';
    const BASELINE = H * 0.65;
    const AMP = H * 0.55;    // max amplitude in px
    const ERASE_W = 24;

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    drawGrid(ctx, W, H, 8);

    let timeMs = 0, xPos = 0, prevY = BASELINE, lastTs = 0;
    let animId: number;

    const frame = (ts: number) => {
      if (lastTs === 0) lastTs = ts;
      const dt = Math.min(ts - lastTs, 50);
      lastTs = ts;
      timeMs += dt;

      const hr   = Math.max(30, Math.min(220, hrRef.current));
      const spo2 = spo2Ref.current;
      const rrMs = 60000 / hr;
      const isAbn = abnRef.current.spo2 || false;
      const pxPerMs = (sweepRef.current * 3) / 1000;
      const advance = pxPerMs * dt;
      const newX = xPos + advance;
      const sample = plethSample(timeMs, rrMs, spo2);
      const newY = Math.max(2, Math.min(H - 2, BASELINE - sample * AMP));

      // Erase ahead
      eraseAndRedrawGrid(ctx, newX % W, ERASE_W, W, H, 8);

      const color = isAbn ? '#f87171' : '#3b82f6';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.shadowBlur = 3;
      ctx.shadowColor = color;

      ctx.beginPath();
      if (newX < W) {
        ctx.moveTo(xPos, prevY);
        ctx.lineTo(newX, newY);
      } else {
        const fracToEdge = (W - xPos) / advance;
        const edgeY = prevY + (newY - prevY) * fracToEdge;
        ctx.moveTo(xPos, prevY);
        ctx.lineTo(W, edgeY);
        ctx.stroke();

        ctx.beginPath();
        const wrappedX = newX % W;
        ctx.moveTo(0, edgeY);
        ctx.lineTo(wrappedX, newY);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      prevY = newY;
      xPos = newX % W;
      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, []); // ← empty deps

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RESPIRATORY CANVAS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  useEffect(() => {
    const canvas = rrRef2.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;
    const BG = '#03040c';
    const BASELINE = H * 0.55;
    const AMP = H * 0.38;
    const ERASE_W = 20;

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    drawGrid(ctx, W, H, 8);

    let timeMs = 0, xPos = 0, prevY = BASELINE, lastTs = 0;
    let animId: number;

    const frame = (ts: number) => {
      if (lastTs === 0) lastTs = ts;
      const dt = Math.min(ts - lastTs, 50);
      lastTs = ts;
      timeMs += dt;

      const rr = Math.max(6, Math.min(40, rrRef.current));
      const breathMs = 60000 / rr;
      const isAbn = abnRef.current.resp_rate || false;
      const pxPerMs = (sweepRef.current * 2) / 1000;
      const advance = pxPerMs * dt;
      const newX = xPos + advance;
      const sample = respSample(timeMs, breathMs);
      const newY = Math.max(2, Math.min(H - 2, BASELINE - sample * AMP));

      // Erase ahead
      eraseAndRedrawGrid(ctx, newX % W, ERASE_W, W, H, 8);

      const color = isAbn ? '#f87171' : '#8b5cf6';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.7;
      ctx.shadowBlur = 2;
      ctx.shadowColor = color;

      ctx.beginPath();
      if (newX < W) {
        ctx.moveTo(xPos, prevY);
        ctx.lineTo(newX, newY);
      } else {
        const fracToEdge = (W - xPos) / advance;
        const edgeY = prevY + (newY - prevY) * fracToEdge;
        ctx.moveTo(xPos, prevY);
        ctx.lineTo(W, edgeY);
        ctx.stroke();

        ctx.beginPath();
        const wrappedX = newX % W;
        ctx.moveTo(0, edgeY);
        ctx.lineTo(wrappedX, newY);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      prevY = newY;
      xPos = newX % W;
      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, []); // ← empty deps

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // HELPERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const fmtClock = (d: Date) =>
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const mapVal = Math.round((displayVitals.dbp * 2 + displayVitals.sbp) / 3);

  const hrStatus = displayVitals.hr > 100 ? { label: 'TACH', c: 'var(--red)' }
    : displayVitals.hr < 55 ? { label: 'BRAD', c: 'var(--amber)' }
    : { label: 'NSR', c: '#10b981' };

  const statusColors = { connected: '#10b981', connecting: '#f59e0b', disconnected: '#ef4444' };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <div style={{
      background: '#03040c',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 'var(--r-lg)',
      padding: 16,
      fontFamily: 'var(--mono)',
      color: '#e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: statusColors[status],
            animation: status !== 'disconnected' ? 'pulse 2s infinite' : 'none',
          }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 1.5, textTransform: 'uppercase' }}>
            Bedside Monitor
          </span>
          <span style={{ fontSize: 10, color: '#334155' }}>Pt #{patientId}</span>
          {status === 'connected' && (
            <span style={{ fontSize: 10, color: '#10b981', fontWeight: 700 }}>● LIVE</span>
          )}
          {status === 'disconnected' && (
            <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 700 }}>⚠ OFFLINE</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Lead selector */}
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#475569', marginRight: 2 }}>LEAD</span>
            {(['I', 'II', 'III'] as const).map(l => (
              <button key={l} onClick={() => setLeadMode(l)} style={{
                padding: '2px 6px', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${leadMode === l ? '#10b981' : '#1e293b'}`,
                borderRadius: 3, fontFamily: 'var(--mono)',
                background: leadMode === l ? 'rgba(16,185,129,0.12)' : 'transparent',
                color: leadMode === l ? '#10b981' : '#475569',
              }}>{l}</button>
            ))}
          </div>
          {/* Sweep speed */}
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#475569', marginRight: 2 }}>SWEEP</span>
            {([25, 50] as const).map(s => (
              <button key={s} onClick={() => setSweepSpeed(s)} style={{
                padding: '2px 6px', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${sweepSpeed === s ? '#10b981' : '#1e293b'}`,
                borderRadius: 3, fontFamily: 'var(--mono)',
                background: sweepSpeed === s ? 'rgba(16,185,129,0.12)' : 'transparent',
                color: sweepSpeed === s ? '#10b981' : '#475569',
              }}>{s}mm/s</button>
            ))}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1.5, color: '#f8fafc' }}>
            {fmtClock(clock)}
          </div>
        </div>
      </div>

      {/* ── Main layout: waveforms | numerics ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 250px', gap: 10 }}>

        {/* Waveforms */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

          {/* ECG */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981' }}>ECG — Lead {leadMode}</span>
              <div style={{ display: 'flex', gap: 10 }}>
                <span style={{ fontSize: 10, color: hrStatus.c, fontWeight: 700 }}>{hrStatus.label}</span>
                <span style={{ fontSize: 10, color: '#475569' }}>{displayVitals.hr} bpm</span>
                <span style={{ fontSize: 9, color: '#334155' }}>{sweepSpeed}mm/s · 10mm/mV</span>
              </div>
            </div>
            <canvas ref={ecgRef} width={680} height={160}
              style={{ width: '100%', height: 160, borderRadius: 3, display: 'block' }} />
          </div>

          {/* SpO2 Pleth */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6' }}>PLETH (SpO₂)</span>
              <span style={{ fontSize: 10, color: abnormalVitals.spo2 ? '#f87171' : '#3b82f6' }}>
                {displayVitals.spo2.toFixed(1)}%
              </span>
            </div>
            <canvas ref={spo2Ref2} width={680} height={64}
              style={{ width: '100%', height: 64, borderRadius: 3, display: 'block' }} />
          </div>

          {/* Respiratory */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#8b5cf6' }}>RESP (CO₂)</span>
              <span style={{ fontSize: 10, color: abnormalVitals.resp_rate ? '#f87171' : '#8b5cf6' }}>
                {displayVitals.rr} br/min
              </span>
            </div>
            <canvas ref={rrRef2} width={680} height={50}
              style={{ width: '100%', height: 50, borderRadius: 3, display: 'block' }} />
          </div>
        </div>

        {/* ── Numeric parameter display ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>

          {/* HR */}
          <div style={{
            background: 'rgba(16,185,129,0.06)',
            border: `1px solid ${abnormalVitals.heart_rate ? '#ef4444' : 'rgba(16,185,129,0.2)'}`,
            borderRadius: 5, padding: '8px 12px',
            animation: abnormalVitals.heart_rate ? 'flash-alert 1s infinite' : 'none',
          }}>
            <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 1 }}>HR bpm</div>
            <div style={{ fontSize: 46, fontWeight: 800, lineHeight: 1, color: abnormalVitals.heart_rate ? '#f87171' : '#10b981' }}>
              {displayVitals.hr}
            </div>
            <div style={{ fontSize: 9, color: hrStatus.c, fontWeight: 700 }}>{hrStatus.label} · NSR</div>
          </div>

          {/* SpO2 */}
          <div style={{
            background: 'rgba(59,130,246,0.06)',
            border: `1px solid ${abnormalVitals.spo2 ? '#ef4444' : 'rgba(59,130,246,0.2)'}`,
            borderRadius: 5, padding: '8px 12px',
            animation: abnormalVitals.spo2 ? 'flash-alert 1s infinite' : 'none',
          }}>
            <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 1 }}>SpO₂ %</div>
            <div style={{ fontSize: 46, fontWeight: 800, lineHeight: 1, color: abnormalVitals.spo2 ? '#f87171' : '#3b82f6' }}>
              {displayVitals.spo2.toFixed(0)}
            </div>
            <div style={{ fontSize: 9, color: '#475569' }}>Pulse Ox</div>
          </div>

          {/* NIBP */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: `1px solid ${abnormalVitals.systolic_bp ? '#ef4444' : 'rgba(255,255,255,0.07)'}`,
            borderRadius: 5, padding: '8px 12px',
          }}>
            <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 1 }}>NIBP mmHg</div>
            <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1, color: abnormalVitals.systolic_bp ? '#f87171' : '#f1f5f9' }}>
              {displayVitals.sbp}/{displayVitals.dbp}
            </div>
            <div style={{ fontSize: 9, color: '#475569' }}>MAP: {mapVal} mmHg</div>
          </div>

          {/* RR + Temp side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
            <div style={{
              background: 'rgba(139,92,246,0.06)',
              border: `1px solid ${abnormalVitals.resp_rate ? '#ef4444' : 'rgba(139,92,246,0.2)'}`,
              borderRadius: 5, padding: '7px 10px',
            }}>
              <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 1 }}>RR</div>
              <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, color: abnormalVitals.resp_rate ? '#f87171' : '#8b5cf6' }}>
                {displayVitals.rr}
              </div>
              <div style={{ fontSize: 8, color: '#475569' }}>br/min</div>
            </div>
            <div style={{
              background: 'rgba(245,158,11,0.05)',
              border: `1px solid ${abnormalVitals.temperature ? '#ef4444' : 'rgba(245,158,11,0.2)'}`,
              borderRadius: 5, padding: '7px 10px',
            }}>
              <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 1 }}>TEMP</div>
              <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, color: abnormalVitals.temperature ? '#f87171' : '#f59e0b' }}>
                {displayVitals.temp.toFixed(1)}
              </div>
              <div style={{ fontSize: 8, color: '#475569' }}>°C</div>
            </div>
          </div>

          {/* HRV SDNN */}
          <div style={{
            background: 'rgba(99,102,241,0.05)',
            border: `1px solid ${abnormalVitals.hrv_sdnn ? '#ef4444' : 'rgba(99,102,241,0.2)'}`,
            borderRadius: 5, padding: '7px 12px',
          }}>
            <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 1 }}>HRV SDNN ms</div>
            <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: abnormalVitals.hrv_sdnn ? '#f87171' : '#818cf8' }}>
              {displayVitals.hrv.toFixed(0)}
            </div>
            <div style={{ fontSize: 9, color: displayVitals.hrv > 50 ? '#10b981' : displayVitals.hrv > 30 ? '#f59e0b' : '#ef4444' }}>
              {displayVitals.hrv > 50 ? 'Normal autonomic tone' : displayVitals.hrv > 30 ? 'Reduced HRV' : 'Low HRV — High risk'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Alarms ── */}
      {alarms.length > 0 && (
        <div style={{
          background: 'rgba(239,68,68,0.07)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 5, padding: '8px 12px',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', marginBottom: 5, letterSpacing: 1 }}>
            🚨 ALARMS
          </div>
          {alarms.map(al => (
            <div key={al.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, marginBottom: 2 }}>
              <span style={{ color: al.severity === 'critical' ? '#f87171' : '#fbbf24' }}>
                {al.severity === 'critical' ? '★' : '▲'}
              </span>
              <span style={{ color: '#fca5a5', flex: 1 }}>{al.message}</span>
              <span style={{ color: '#334155', fontSize: 9 }}>{al.time.toLocaleTimeString('en-GB')}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Legend ── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 12,
        borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 8,
        fontSize: 9, color: '#1e293b',
      }}>
        <span style={{ color: '#10b981' }}>● ECG/PLETH/RESP: Synthetic waveform — Gaussian PQRST, tempo synced to live HR/RR</span>
        <span style={{ color: '#3b82f6' }}>● Numerics: 100% Live — Go WebSocket stream (physiological random walk)</span>
        <span style={{ color: '#475569' }}>Clinical deploy: replace synthesis with HL7 MDC 272635 device stream</span>
      </div>
    </div>
  );
};
