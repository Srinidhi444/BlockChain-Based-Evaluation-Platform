'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RefreshCw, AlertTriangle, Sparkles, Inbox } from 'lucide-react';

interface Submission {
  _id: string; submissionId: string; testId: string;
  subject: string; department: string; year: number;
  division: string; status: string; uploadedAt: string;
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
      if (dotRef.current)  { dotRef.current.style.left = dx + 'px'; dotRef.current.style.top = dy + 'px'; }
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
    uploaded:         { label: 'New',         color: 'rgba(255,255,255,0.6)',  bg: 'rgba(255,255,255,0.07)', border: 'rgba(255,255,255,0.15)' },
    under_evaluation: { label: 'In Progress',  color: 'rgba(253,224,71,1)',    bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.3)'   },
    evaluated:        { label: 'Completed',    color: 'rgba(74,222,128,1)',    bg: 'rgba(34,197,94,0.1)',    border: 'rgba(34,197,94,0.3)'    },
  };
  return map[status] || { label: status, color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)' };
}

/* ─── Dark select ─── */
function DarkSelect({ value, onChange, children, minWidth }: {
  value: string; onChange: (v: string) => void;
  children: React.ReactNode; minWidth?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: '100%', minWidth: minWidth || 0,
          background: focused ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${focused ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 10, padding: '0.62rem 2.2rem 0.62rem 0.9rem',
          color: '#f0f0f0', fontFamily: "'Inter',sans-serif",
          fontSize: '0.83rem', fontWeight: 500,
          appearance: 'none', WebkitAppearance: 'none',
          outline: 'none', cursor: 'none', transition: 'border-color 0.2s, background 0.2s',
        }}>
        {children}
      </select>
      <div style={{ position: 'absolute', right: '0.8rem', top: '50%', transform: 'translateY(-50%)', width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '5px solid rgba(255,255,255,0.35)', pointerEvents: 'none' }} />
    </div>
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

/* ─── Evaluate link ─── */
function EvaluateLink({ href, evaluated }: { href: string; evaluated: boolean }) {
  const [h, setH] = useState(false);
  const accent = evaluated ? 'rgba(255,255,255,0.45)' : 'rgba(74,222,128,1)';
  return (
    <Link href={href} style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
      padding: '0.4rem 0.85rem', borderRadius: 8, textDecoration: 'none',
      background: h ? (evaluated ? 'rgba(255,255,255,0.06)' : 'rgba(34,197,94,0.12)') : (evaluated ? 'rgba(255,255,255,0.03)' : 'rgba(34,197,94,0.07)'),
      border: `1px solid ${h ? accent : (evaluated ? 'rgba(255,255,255,0.1)' : 'rgba(34,197,94,0.25)')}`,
      fontSize: '0.78rem', fontWeight: 700, color: accent,
      transition: 'all 0.2s', whiteSpace: 'nowrap' as const,
    }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      {evaluated ? 'View' : 'Evaluate'}
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </Link>
  );
}

/* ─── Refresh button ─── */
function RefreshButton({ onClick }: { onClick: () => void }) {
  const [h, setH] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const handleClick = () => { setSpinning(true); onClick(); setTimeout(() => setSpinning(false), 700); };
  return (
    <button onClick={handleClick} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.42rem 0.85rem', borderRadius: 8, background: h ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)', border: `1px solid ${h ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)'}`, fontSize: '0.78rem', fontWeight: 700, color: h ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.38)', cursor: 'none', fontFamily: 'inherit', transition: 'all 0.2s' }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      <span style={{ display: 'inline-block', animation: spinning ? 'spin 0.7s linear' : 'none' }}><RefreshCw size={18} /></span>
      Refresh
    </button>
  );
}

/* ══════════════════════════ MAIN PAGE ══════════════════════════ */
export default function EvaluatePage() {
  const router = useRouter();
  const [submissions, setSubmissions]               = useState<Submission[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading]                       = useState(true);
  const [error, setError]                           = useState('');
  const [filters, setFilters] = useState({
    status: 'uploaded,under_evaluation', subject: '', year: '', division: '',
  });

  useEffect(() => { fetchSubmissions(); }, []);
  useEffect(() => { applyFilters(); }, [filters, submissions]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/teacher/submissions');
      if (!res.ok) { if (res.status === 401) { router.push('/login'); return; } throw new Error('Failed to fetch submissions'); }
      const data = await res.json();
      setSubmissions(data.data.submissions);
    } catch (err: any) { setError(err.message || 'Failed to load submissions'); }
    finally { setLoading(false); }
  };

  const applyFilters = () => {
    let f = submissions;
    if (filters.status)   { const s = filters.status.split(','); f = f.filter(x => s.includes(x.status)); }
    if (filters.subject)  f = f.filter(x => x.subject  === filters.subject);
    if (filters.year)     f = f.filter(x => x.year     === parseInt(filters.year));
    if (filters.division) f = f.filter(x => x.division === filters.division);
    setFilteredSubmissions(f);
  };

  const handleFilterChange = (key: string, value: string) => setFilters(prev => ({ ...prev, [key]: value }));
  const clearFilters = () => setFilters({ status: '', subject: '', year: '', division: '' });

  const uniqueSubjects  = [...new Set(submissions.map(s => s.subject))];
  const uniqueYears     = [...new Set(submissions.map(s => s.year))];
  const uniqueDivisions = [...new Set(submissions.map(s => s.division))];

  const hasActiveFilter = filters.subject || filters.year || filters.division || (filters.status !== 'uploaded,under_evaluation');

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
          <p style={{ marginTop: '1rem', fontSize: '0.88rem', fontWeight: 500, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>Loading submissions…</p>
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

        /* ── Table styles ── */
        .eval-table { width:100%; border-collapse:collapse; }

        .eval-table thead tr {
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .eval-table thead th {
          padding: 0.65rem 1rem;
          text-align: left;
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.3);
          white-space: nowrap;
        }
        .eval-table tbody tr {
          border-bottom: 1px solid rgba(255,255,255,0.05);
          transition: background 0.15s;
        }
        .eval-table tbody tr:last-child { border-bottom: none; }
        .eval-table tbody tr:hover { background: rgba(255,255,255,0.025); }
        .eval-table tbody td {
          padding: 0.9rem 1rem;
          font-size: 0.85rem;
          color: rgba(255,255,255,0.65);
          vertical-align: middle;
        }

        .e-scroll::-webkit-scrollbar { height:3px; }
        .e-scroll::-webkit-scrollbar-track { background:transparent; }
        .e-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:10px; }
      `}</style>

      <DashCursor />

      <div style={{ minHeight: '100vh', background: '#050505', fontFamily: "'Inter',system-ui,sans-serif" }}>

        {/* ── Nav ── */}
        <nav style={{ height: 52, background: 'rgba(5,5,5,0.92)', borderBottom: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', padding: '0 1.75rem', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
          <NavBack href="/dashboard" />
          <div style={{ fontSize: '0.78rem', fontWeight: 500, color: 'rgba(255,255,255,0.28)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            GRADEX <span style={{ color: 'rgba(255,255,255,0.18)' }}>/</span>
            <span style={{ color: 'rgba(255,255,255,0.55)' }}>Evaluate</span>
          </div>
          <div style={{ width: 90 }} />
        </nav>

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2.25rem 1.25rem 4rem' }}>

          {/* ── Heading ── */}
          <div className="fade-up" style={{ marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', marginBottom: '0.55rem' }}>
              Teacher Portal
            </div>
            <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(2.4rem,5vw,3.5rem)', lineHeight: 0.95, color: '#ffffff', letterSpacing: '0.01em' }}>
              EVALUATE<br/>
              <span style={{ WebkitTextStroke: '0.5px rgba(255,255,255,0.9)', color: 'transparent' }}>SUBMISSIONS</span>
            </h1>
          </div>

          {/* ── Filters panel ── */}
          <div className="fade-up2" style={{ background: '#090909', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '1.25rem 1.4rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)' }}>
                Filters
              </div>
              {hasActiveFilter && (
                <ClearBtn onClick={clearFilters} />
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.85rem' }}>
              <div>
                <FilterLabel>Status</FilterLabel>
                <DarkSelect value={filters.status} onChange={v => handleFilterChange('status', v)}>
                  <option value="">All</option>
                  <option value="uploaded">New</option>
                  <option value="under_evaluation">In Progress</option>
                  <option value="uploaded,under_evaluation">Pending</option>
                  <option value="evaluated">Completed</option>
                </DarkSelect>
              </div>
              <div>
                <FilterLabel>Subject</FilterLabel>
                <DarkSelect value={filters.subject} onChange={v => handleFilterChange('subject', v)}>
                  <option value="">All Subjects</option>
                  {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                </DarkSelect>
              </div>
              <div>
                <FilterLabel>Year</FilterLabel>
                <DarkSelect value={filters.year} onChange={v => handleFilterChange('year', v)}>
                  <option value="">All Years</option>
                  {uniqueYears.map(y => <option key={y} value={y}>Year {y}</option>)}
                </DarkSelect>
              </div>
              <div>
                <FilterLabel>Division</FilterLabel>
                <DarkSelect value={filters.division} onChange={v => handleFilterChange('division', v)}>
                  <option value="">All Divisions</option>
                  {uniqueDivisions.map(d => <option key={d} value={d}>Division {d}</option>)}
                </DarkSelect>
              </div>
            </div>
          </div>

          {/* ── Table panel ── */}
          <div className="fade-up3" style={{ background: '#090909', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '1.4rem' }}>

            {/* Panel header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)' }}>
                  Submissions
                </div>
                <div style={{ padding: '0.18rem 0.6rem', borderRadius: 100, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: "'Bebas Neue',sans-serif", fontSize: '1rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1 }}>
                  {filteredSubmissions.length}
                </div>
              </div>
              <RefreshButton onClick={fetchSubmissions} />
            </div>

            {/* Error */}
            {error && (
              <div style={{ marginBottom: '1rem', padding: '0.8rem 1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, display: 'flex', gap: '0.5rem' }}>
                <span><AlertTriangle size={18} /></span>
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(252,165,165,0.95)' }}>{error}</p>
              </div>
            )}

            {/* Empty */}
            {filteredSubmissions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                  {filters.status === 'uploaded,under_evaluation' ? <Sparkles size={18} /> : <Inbox size={18} />}
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'rgba(255,255,255,0.6)', marginBottom: '0.5rem' }}>
                  {filters.status === 'uploaded,under_evaluation' ? 'All caught up!' : 'No submissions found'}
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'rgba(255,255,255,0.3)', marginBottom: '1.25rem' }}>
                  {filters.status === 'uploaded,under_evaluation' ? 'No pending evaluations.' : 'Try adjusting your filters.'}
                </div>
                {hasActiveFilter && <ClearBtn onClick={clearFilters} />}
              </div>
            ) : (
              /* ── Table ── */
              <div className="e-scroll" style={{ overflowX: 'auto' }}>
                <table className="eval-table">
                  <thead>
                    <tr>
                      {['Subject', 'Class', 'Test ID', 'Uploaded', 'Status', 'Action'].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubmissions.map(sub => {
                      const sc = statusConfig(sub.status);
                      return (
                        <tr key={sub._id}>
                          {/* Subject */}
                          <td>
                            <span style={{ fontWeight: 700, color: '#ffffff' }}>{sub.subject}</span>
                          </td>

                          {/* Class */}
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' as const }}>
                              <span style={{ padding: '0.18rem 0.5rem', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.05em' }}>
                                {sub.department.substring(0, 3).toUpperCase()}
                              </span>
                              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.45)' }}>
                                Y{sub.year} · D{sub.division}
                              </span>
                            </div>
                          </td>

                          {/* Test ID */}
                          <td>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'rgba(255,255,255,0.32)', letterSpacing: '0.03em' }}>
                              {sub.testId.slice(0, 22)}…
                            </span>
                          </td>

                          {/* Uploaded */}
                          <td>
                            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>
                              {new Date(sub.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </td>

                          {/* Status badge */}
                          <td>
                            <span style={{ padding: '0.22rem 0.7rem', borderRadius: 100, background: sc.bg, border: `1px solid ${sc.border}`, fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: sc.color, whiteSpace: 'nowrap' as const }}>
                              {sc.label}
                            </span>
                          </td>

                          {/* Action */}
                          <td>
                            <EvaluateLink href={`/evaluate/${sub.submissionId}`} evaluated={sub.status === 'evaluated'} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── tiny helpers ─── */
function FilterLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.4)', marginBottom: '0.45rem' }}>{children}</div>;
}

function ClearBtn({ onClick }: { onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.38rem 0.8rem', borderRadius: 8, background: h ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)', border: `1px solid ${h ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'}`, fontSize: '0.78rem', fontWeight: 700, color: h ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.35)', cursor: 'none', fontFamily: 'inherit', transition: 'all 0.2s' }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
      Clear
    </button>
  );
}
