'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Grievance {
  grievanceId: string; submissionId: string; testId: string;
  studentName: string; grievanceType: 'calculation_error' | 'reevaluation';
  questionNumber?: number; explanation: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected'; filedAt: string;
}
interface GrievanceWithDetails {
  grievance: Grievance;
  submission: { answerSheetUrl: string; fileName: string; fileType: string; uploadedAt: string } | null;
  test: { title: string; subject: string; totalMarks: number } | null;
  originalEvaluation: { totalMarksObtained: number; totalMarks: number; percentage: number } | null;
}
interface Stats {
  total: number; pending: number; inProgress: number;
  completed: number; rejected: number; calculationError: number; reevaluation: number;
}

/* ─── Cursor ─── */
function DashCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let dx = window.innerWidth / 2, dy = window.innerHeight / 2, rx = dx, ry = dy;
    let raf: number;
    const onMove = (e: MouseEvent) => { dx = e.clientX; dy = e.clientY; };
    window.addEventListener('mousemove', onMove);
    const loop = () => {
      if (dotRef.current)  { dotRef.current.style.left  = dx + 'px'; dotRef.current.style.top  = dy + 'px'; }
      rx += (dx - rx) * 0.11; ry += (dy - ry) * 0.11;
      if (ringRef.current) { ringRef.current.style.left = rx + 'px'; ringRef.current.style.top = ry + 'px'; }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf); };
  }, []);
  return (<><div ref={dotRef} className="c-dot" /><div ref={ringRef} className="c-ring" /></>);
}

/* ─── Status config ─── */
function statusConfig(status: string) {
  const map: Record<string, { label: string; color: string; bg: string; border: string }> = {
    pending:     { label: 'Pending',     color: 'rgba(253,224,71,1)',   bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)'  },
    in_progress: { label: 'In Progress', color: 'rgba(147,197,253,1)', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.3)'  },
    completed:   { label: 'Completed',   color: 'rgba(74,222,128,1)',  bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.3)'   },
    rejected:    { label: 'Rejected',    color: 'rgba(252,165,165,1)', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)'   },
  };
  return map[status] || map.pending;
}

function typeConfig(type: string) {
  return type === 'calculation_error'
    ? { label: 'Calculation Error', color: 'rgba(147,197,253,1)', bg: 'rgba(59,130,246,0.1)',   border: 'rgba(59,130,246,0.3)'  }
    : { label: 'Re-evaluation',     color: 'rgba(216,180,254,1)', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.3)' };
}

/* ─── Dark select ─── */
function DarkSelect({ value, onChange, children }: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${focused ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 10, padding: '0.65rem 2.2rem 0.65rem 0.9rem',
          color: '#f0f0f0', fontFamily: "'Inter',sans-serif", fontSize: '0.85rem', fontWeight: 500,
          appearance: 'none', WebkitAppearance: 'none', outline: 'none', cursor: 'none',
          transition: 'border-color 0.2s',
        }}>
        {children}
      </select>
      <div style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '5px solid rgba(255,255,255,0.35)', pointerEvents: 'none' }} />
    </div>
  );
}

/* ─── Stat card ─── */
function StatCard({ value, label, accent }: { value: number; label: string; accent: string }) {
  return (
    <div style={{ background: '#090909', border: `1px solid ${accent}33`, borderRadius: 14, padding: '1.1rem 1.3rem', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -18, right: -18, width: 60, height: 60, borderRadius: '50%', background: `${accent}18`, filter: 'blur(18px)', pointerEvents: 'none' }} />
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '2.4rem', lineHeight: 1, color: accent, marginBottom: '0.2rem' }}>{value}</div>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)' }}>{label}</div>
    </div>
  );
}

/* ─── Grievance card ─── */
function GrievanceCard({ item }: { item: GrievanceWithDetails }) {
  const { grievance, submission, test, originalEvaluation } = item;
  const [hovered, setHovered] = useState(false);
  const sc = statusConfig(grievance.status);
  const tc = typeConfig(grievance.grievanceType);

  return (
    <div
      style={{
        background: hovered ? 'rgba(255,255,255,0.03)' : '#090909',
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 14, padding: '1.35rem 1.5rem',
        transition: 'background 0.2s, border-color 0.2s, transform 0.18s',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        position: 'relative', overflow: 'hidden',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Left accent */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: sc.color, opacity: hovered ? 0.9 : 0.4, transition: 'opacity 0.2s', boxShadow: `0 0 8px ${sc.color}` }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap' as const }}>

        {/* ── Left: info ── */}
        <div style={{ flex: 1, minWidth: 280 }}>
          {/* Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' as const, marginBottom: '0.75rem' }}>
            <span style={{ padding: '0.22rem 0.7rem', borderRadius: 100, background: sc.bg, border: `1px solid ${sc.border}`, fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: sc.color }}>
              {sc.label}
            </span>
            <span style={{ padding: '0.22rem 0.7rem', borderRadius: 100, background: tc.bg, border: `1px solid ${tc.border}`, fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: tc.color }}>
              {tc.label}
            </span>
          </div>

          {/* Title */}
          <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.55rem' }}>
            {test?.title || 'Untitled Test'}
          </div>

          {/* Meta grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem 1.5rem', marginBottom: '0.75rem' }}>
            {[
              { k: 'Student',  v: grievance.studentName },
              { k: 'Subject',  v: test?.subject || 'N/A' },
              ...(grievance.questionNumber ? [{ k: 'Question', v: `#${grievance.questionNumber}` }] : []),
              ...(originalEvaluation ? [{ k: 'Original Score', v: `${originalEvaluation.totalMarksObtained}/${originalEvaluation.totalMarks} (${originalEvaluation.percentage.toFixed(1)}%)` }] : []),
            ].map(item => (
              <div key={item.k} style={{ display: 'flex', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{item.k}:</span>
                <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>{item.v}</span>
              </div>
            ))}
          </div>

          {/* Explanation */}
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 9, padding: '0.65rem 0.85rem', marginBottom: '0.65rem' }}>
            <p style={{ fontSize: '0.82rem', fontWeight: 500, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>
              "{grievance.explanation}"
            </p>
          </div>

          {/* Filed date */}
          <div style={{ fontSize: '0.72rem', fontWeight: 500, color: 'rgba(255,255,255,0.28)' }}>
            Filed {new Date(grievance.filedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(grievance.filedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {/* ── Right: actions ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', flexShrink: 0, minWidth: 170 }}>
          <ReviewLink href={`/reevaluate/${grievance.grievanceId}`} completed={grievance.status === 'completed'} />
          {submission && (
            <AnswerSheetLink href={submission.answerSheetUrl} />
          )}
        </div>

      </div>
    </div>
  );
}

function ReviewLink({ href, completed }: { href: string; completed: boolean }) {
  const [h, setH] = useState(false);
  const accent = completed ? 'rgba(255,255,255,0.5)' : 'rgba(74,222,128,1)';
  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
      padding: '0.7rem 1rem', borderRadius: 10, textDecoration: 'none',
      background: h ? (completed ? 'rgba(255,255,255,0.07)' : 'rgba(34,197,94,0.15)') : (completed ? 'rgba(255,255,255,0.04)' : 'rgba(34,197,94,0.08)'),
      border: `1px solid ${h ? accent : (completed ? 'rgba(255,255,255,0.12)' : 'rgba(34,197,94,0.25)')}`,
      fontSize: '0.82rem', fontWeight: 700, color: accent,
      transition: 'all 0.2s', whiteSpace: 'nowrap' as const,
    }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      {completed ? '👁️ View' : '📝 Review & Evaluate'}
    </Link>
  );
}

function AnswerSheetLink({ href }: { href: string }) {
  const [h, setH] = useState(false);
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
      padding: '0.7rem 1rem', borderRadius: 10, textDecoration: 'none',
      background: h ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${h ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)'}`,
      fontSize: '0.82rem', fontWeight: 600, color: h ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)',
      transition: 'all 0.2s', whiteSpace: 'nowrap' as const,
    }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      📄 View Answer Sheet
    </a>
  );
}

/* ══════════════════════════════════════════ MAIN PAGE ══════════════════════════════════════════ */
export default function TeacherGrievancesPage() {
  const router = useRouter();
  const [grievances, setGrievances] = useState<GrievanceWithDetails[]>([]);
  const [stats, setStats]           = useState<Stats | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType,   setFilterType]   = useState('');

  useEffect(() => { fetchGrievances(); }, [filterStatus, filterType]);

  const fetchGrievances = async () => {
    try {
      setLoading(true); setError('');
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterType)   params.append('type',   filterType);
      const res = await fetch(`/api/teacher/grievances?${params.toString()}`);
      if (!res.ok) { if (res.status === 401) { router.push('/login'); return; } throw new Error('Failed to fetch grievances'); }
      const data = await res.json();
      setGrievances(data.data.grievances);
      setStats(data.data.stats);
    } catch (err: any) { setError(err.message || 'Failed to load grievances'); }
    finally { setLoading(false); }
  };

  /* ── Loading ── */
  if (loading) return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Bebas+Neue&display=swap');
        html,body{background:#050505!important;margin:0;cursor:none!important;}
        @keyframes spin{to{transform:rotate(360deg);}}
        .c-dot{position:fixed;width:7px;height:7px;background:#fff;border-radius:50%;pointer-events:none;z-index:99999;transform:translate(-50%,-50%);mix-blend-mode:difference;}
        .c-ring{position:fixed;width:32px;height:32px;border:1px solid rgba(255,255,255,0.6);border-radius:50%;pointer-events:none;z-index:99998;transform:translate(-50%,-50%);mix-blend-mode:difference;}
      `}</style>
      <DashCursor />
      <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.07)', borderTop: '2px solid rgba(255,255,255,0.5)', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
          <p style={{ marginTop: '1rem', fontSize: '0.88rem', fontWeight: 500, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>Loading grievances…</p>
        </div>
      </div>
    </>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Bebas+Neue&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html{background:#050505!important;color-scheme:dark;}
        body{background:#050505!important;color:#f0f0f0;font-family:'Inter',system-ui,sans-serif;overflow-x:hidden;cursor:none!important;}

        .c-dot{position:fixed;width:7px;height:7px;background:#fff;border-radius:50%;pointer-events:none;z-index:99999;transform:translate(-50%,-50%);mix-blend-mode:difference;}
        .c-ring{position:fixed;width:32px;height:32px;border:1px solid rgba(255,255,255,0.6);border-radius:50%;pointer-events:none;z-index:99998;transform:translate(-50%,-50%);mix-blend-mode:difference;}

        @keyframes spin   { to{transform:rotate(360deg);} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px);} to{opacity:1;transform:translateY(0);} }

        .fade-up  { animation:fadeUp 0.45s ease both; }
        .fade-up2 { animation:fadeUp 0.45s ease both; animation-delay:0.07s; }
        .fade-up3 { animation:fadeUp 0.45s ease both; animation-delay:0.13s; }

        select option { background:#1a1a1a; color:#f0f0f0; }

        .g-scroll::-webkit-scrollbar { width:3px; }
        .g-scroll::-webkit-scrollbar-track { background:transparent; }
        .g-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:10px; }
      `}</style>

      <DashCursor />

      <div style={{ minHeight: '100vh', background: '#050505', fontFamily: "'Inter',system-ui,sans-serif" }}>

        {/* ── Nav ── */}
        <nav style={{ height: 52, background: 'rgba(5,5,5,0.92)', borderBottom: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', padding: '0 1.75rem', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
          <NavBack href="/dashboard" />
          <div style={{ fontSize: '0.78rem', fontWeight: 500, color: 'rgba(255,255,255,0.28)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            EvalChain <span style={{ color: 'rgba(255,255,255,0.18)' }}>/</span>
            <span style={{ color: 'rgba(255,255,255,0.55)' }}>Grievances</span>
          </div>
          <div style={{ width: 90 }} />
        </nav>

        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2.25rem 1.25rem 4rem' }}>

          {/* ── Heading ── */}
          <div className="fade-up" style={{ marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', marginBottom: '0.55rem' }}>
              Teacher Portal
            </div>
            <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(2.4rem,5vw,3.5rem)', lineHeight: 0.95, color: '#ffffff', letterSpacing: '0.01em' }}>
              ASSIGNED<br/>
              <span style={{ WebkitTextStroke: '0.5px rgba(255,255,255,0.9)', color: 'transparent' }}>GRIEVANCES</span>
            </h1>
          </div>

          {/* ── Stats ── */}
          {stats && (
            <div className="fade-up2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.85rem', marginBottom: '1.25rem' }}>
              <StatCard value={stats.total}      label="Total"       accent="rgba(255,255,255,0.55)" />
              <StatCard value={stats.pending}    label="Pending"     accent="rgba(253,224,71,1)"     />
              <StatCard value={stats.inProgress} label="In Progress" accent="rgba(147,197,253,1)"    />
              <StatCard value={stats.completed}  label="Completed"   accent="rgba(74,222,128,1)"     />
            </div>
          )}

          {/* ── Filters ── */}
          <div className="fade-up3" style={{ background: '#090909', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '1.25rem 1.4rem', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)', marginBottom: '0.9rem' }}>
              Filters
            </div>
            <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap' as const, alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.4)', marginBottom: '0.45rem' }}>Status</div>
                <DarkSelect value={filterStatus} onChange={setFilterStatus}>
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                </DarkSelect>
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.4)', marginBottom: '0.45rem' }}>Type</div>
                <DarkSelect value={filterType} onChange={setFilterType}>
                  <option value="">All Types</option>
                  <option value="calculation_error">Calculation Error</option>
                  <option value="reevaluation">Re-evaluation</option>
                </DarkSelect>
              </div>
              {(filterStatus || filterType) && (
                <ClearButton onClick={() => { setFilterStatus(''); setFilterType(''); }} />
              )}
            </div>
          </div>

          {/* ── Error ── */}
          {error && (
            <div style={{ marginBottom: '1rem', padding: '0.85rem 1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, display: 'flex', gap: '0.5rem' }}>
              <span>⚠️</span>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(252,165,165,0.95)' }}>{error}</p>
            </div>
          )}

          {/* ── Empty ── */}
          {grievances.length === 0 ? (
            <div style={{ background: '#090909', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '5rem 2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'rgba(255,255,255,0.7)', marginBottom: '0.5rem' }}>No Grievances Found</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'rgba(255,255,255,0.35)' }}>
                {filterStatus || filterType ? 'Try adjusting your filters' : 'No grievances have been assigned to you yet'}
              </div>
            </div>
          ) : (
            /* ── List ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {grievances.map(item => (
                <GrievanceCard key={item.grievance.grievanceId} item={item} />
              ))}
            </div>
          )}

        </div>
      </div>
    </>
  );
}

/* ─── Nav back ─── */
function NavBack({ href }: { href: string }) {
  const [h, setH] = useState(false);
  return (
    <Link href={href} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', fontWeight: 600, color: h ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)', textDecoration: 'none', transition: 'color 0.2s' }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      Dashboard
    </Link>
  );
}

/* ─── Clear button ─── */
function ClearButton({ onClick }: { onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} style={{ padding: '0.65rem 1.1rem', borderRadius: 10, background: h ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)', border: `1px solid ${h ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'}`, fontSize: '0.82rem', fontWeight: 700, color: h ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.38)', cursor: 'none', fontFamily: 'inherit', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
      Clear Filters
    </button>
  );
}
