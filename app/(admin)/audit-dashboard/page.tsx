'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import FloatingChat from "@/components/FloatingChat";
import Link from 'next/link';

interface AuditLog {
  auditId: string; eventType: string; timestamp: string; userId: string;
  userName: string; userRole: string; department: string; submissionId?: string;
  questionNumber?: number; marksAwarded?: number; timeSpent?: number; markingPattern?: string;
}

interface Stats {
  totalLogs: number; eventTypeCounts: Record<string, number>;
}

const PAGE_LIMIT = 100;

/* ─── Cursor ─── */
function DashCursor() {
  const dotRef  = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let dx = window.innerWidth / 2, dy = window.innerHeight / 2, rx = dx, ry = dy;
    let raf: number;
    const onMove = (e: MouseEvent) => { dx = e.clientX; dy = e.clientY; };
    window.addEventListener('mousemove', onMove);
    const loop = () => {
      if (dotRef.current)  { dotRef.current.style.left = dx + 'px'; dotRef.current.style.top  = dy + 'px'; }
      rx += (dx - rx) * 0.11; ry += (dy - ry) * 0.11;
      if (ringRef.current) { ringRef.current.style.left = rx + 'px'; ringRef.current.style.top = ry + 'px'; }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf); };
  }, []);
  return (<><div ref={dotRef} className="c-dot" /><div ref={ringRef} className="c-ring" /></>);
}

/* ─── Stat card ─── */
function StatCard({ value, label, accent }: { value: React.ReactNode; label: string; accent: string }) {
  return (
    <div style={{ background: '#090909', border: `1px solid ${accent}33`, borderRadius: 14, padding: '1.1rem 1.3rem', position: 'relative', overflow: 'hidden', flex: 1, minWidth: 0 }}>
      <div style={{ position: 'absolute', top: -18, right: -18, width: 60, height: 60, borderRadius: '50%', background: `${accent}18`, filter: 'blur(18px)', pointerEvents: 'none' }} />
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '2.4rem', lineHeight: 1, color: accent, marginBottom: '0.25rem' }}>{value}</div>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)' }}>{label}</div>
    </div>
  );
}

/* ─── Role badge config ─── */
function roleConfig(role: string) {
  const m: Record<string, { color: string; bg: string; border: string }> = {
    teacher: { color: 'rgba(74,222,128,1)',  bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.25)'  },
    admin:   { color: 'rgba(216,180,254,1)', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.25)' },
  };
  return m[role] || { color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)' };
}

/* ─── Pattern badge config ─── */
function patternConfig(p: string) {
  if (p === 'strict')  return { color: 'rgba(252,165,165,1)', bg: 'rgba(239,68,68,0.1)',      border: 'rgba(239,68,68,0.25)'   };
  if (p === 'lenient') return { color: 'rgba(74,222,128,1)',  bg: 'rgba(34,197,94,0.1)',      border: 'rgba(34,197,94,0.25)'   };
  return                      { color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)'  };
}

/* ─── Pill badge ─── */
function Pill({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) {
  return (
    <span style={{ padding: '0.2rem 0.65rem', borderRadius: 100, background: bg, border: `1px solid ${border}`, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color, whiteSpace: 'nowrap' as const }}>
      {label}
    </span>
  );
}

/* ─── Dark input / select ─── */
const baseField: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9,
  padding: '0.62rem 0.9rem', color: '#f0f0f0',
  fontFamily: "'Inter',sans-serif", fontSize: '0.83rem', fontWeight: 500,
  outline: 'none', transition: 'border-color 0.2s, background 0.2s',
};
function DarkInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [f, setF] = useState(false);
  return <input {...props} style={{ ...baseField, borderColor: f ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.1)', background: f ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)' }} onFocus={() => setF(true)} onBlur={() => setF(false)} />;
}
function DarkSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const [f, setF] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <select {...props} style={{ ...baseField, appearance: 'none', WebkitAppearance: 'none', cursor: 'none', paddingRight: '2.2rem', borderColor: f ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.1)', background: f ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)' }} onFocus={() => setF(true)} onBlur={() => setF(false)} />
      <div style={{ position: 'absolute', right: '0.8rem', top: '50%', transform: 'translateY(-50%)', width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '5px solid rgba(255,255,255,0.35)', pointerEvents: 'none' }} />
    </div>
  );
}

/* ─── Tab button (only logs now) ─── */
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick}
      style={{ padding: '0.5rem 1.1rem', borderRadius: 9, fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 700, cursor: 'none', border: active ? '1px solid rgba(255,255,255,0.18)' : '1px solid transparent', background: active ? 'rgba(255,255,255,0.08)' : h ? 'rgba(255,255,255,0.04)' : 'transparent', color: active ? '#ffffff' : h ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.38)', transition: 'all 0.18s' }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      {children}
    </button>
  );
}

/* ─── Nav back ─── */
function NavBack({ href, label }: { href: string; label: string }) {
  const [h, setH] = useState(false);
  return (
    <Link href={href} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', fontWeight: 600, color: h ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)', textDecoration: 'none', transition: 'color 0.2s' }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      {label}
    </Link>
  );
}

/* ─── Export button ─── */
function ExportButton({ onClick, exporting }: { onClick: () => void; exporting: boolean }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} disabled={exporting}
      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.42rem 0.9rem', borderRadius: 8, background: h && !exporting ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.05)', border: `1px solid ${h && !exporting ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)'}`, fontSize: '0.8rem', fontWeight: 700, color: exporting ? 'rgba(255,255,255,0.25)' : h ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.45)', cursor: exporting ? 'not-allowed' : 'none', fontFamily: 'inherit', transition: 'all 0.2s', opacity: exporting ? 0.5 : 1 }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      {exporting
        ? <div style={{ width: 11, height: 11, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.15)', borderTop: '2px solid rgba(255,255,255,0.5)', animation: 'spin 0.7s linear infinite' }} />
        : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
      }
      {exporting ? 'Exporting…' : 'Export CSV'}
    </button>
  );
}

/* ─── Filter label ─── */
function FLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.38)', marginBottom: '0.4rem' }}>{children}</div>;
}

/* ─── Format event type ─── */
const formatEvent = (t: string | undefined | null): string => {
  if (!t || typeof t !== 'string') return '—';
  return t.split('_').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

/* ─── Filter: teacher/admin only ─── */
const teacherOnly = (logs: AuditLog[]): AuditLog[] =>
  logs.filter(l => l.userRole && l.userRole !== 'student');

/* ─── Client-side pagination ─── */
const ROWS_PER_PAGE = 15;
function paginate<T>(arr: T[], page: number): T[] {
  return arr.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);
}

/* ─── CSV builder (client-side, from allLogs) ─── */
function buildCSV(logs: AuditLog[]): string {
  const headers = ['Audit ID', 'Timestamp', 'Event Type', 'User ID', 'User Name', 'Role', 'Department', 'Submission ID', 'Question #', 'Marks Awarded', 'Time Spent (s)', 'Marking Pattern'];
  const escape  = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows    = logs.map(l => [
    l.auditId, l.timestamp, l.eventType, l.userId, l.userName,
    l.userRole, l.department, l.submissionId ?? '', l.questionNumber ?? '',
    l.marksAwarded ?? '', l.timeSpent ?? '', l.markingPattern ?? '',
  ].map(escape).join(','));
  return [headers.map(escape).join(','), ...rows].join('\n');
}

/* ══════════════════════════ MAIN PAGE ══════════════════════════ */
export default function AuditDashboard() {
  const router = useRouter();

  const [allLogs, setAllLogs]           = useState<AuditLog[]>([]);
  const [hasMore, setHasMore]           = useState(true);
  const [apiFetchPage, setApiFetchPage] = useState(1);

  const [stats, setStats]               = useState<Stats | null>(null);

  const [loading, setLoading]           = useState(true);
  const [exporting, setExporting]       = useState(false);
  const [error, setError]               = useState('');

  const [eventType, setEventType]       = useState('');
  const [department, setDepartment]     = useState('');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');

  const [currentPage, setCurrentPage]   = useState(1);

  // Reset on filter change
  useEffect(() => {
    setAllLogs([]);
    setHasMore(true);
    setApiFetchPage(1);
    setCurrentPage(1);
  }, [eventType, department, dateFrom, dateTo]);

  // Fetch when API page changes
  useEffect(() => {
    fetchLogs(apiFetchPage);
  }, [apiFetchPage, eventType, department, dateFrom, dateTo]);

  const fetchLogs = async (apiPage: number) => {
    try {
      setLoading(true); setError('');
      const params = new URLSearchParams({ page: apiPage.toString(), limit: PAGE_LIMIT.toString() });
      if (eventType)  params.append('eventType',  eventType);
      if (department) params.append('department', department);
      if (dateFrom)   params.append('dateFrom',   dateFrom);
      if (dateTo)     params.append('dateTo',     dateTo);

      const logsRes = await fetch(`/api/admin/audit-logs?${params}`);
      if (!logsRes.ok) {
        if (logsRes.status === 401) { router.push('/login'); return; }
        throw new Error('Failed to fetch audit logs');
      }
      const logsData = await logsRes.json();
      const rawLogs: AuditLog[] = logsData.data.logs ?? [];
      const filtered = teacherOnly(rawLogs);

      if (apiPage === 1) { setAllLogs(filtered); }
      else               { setAllLogs(prev => [...prev, ...filtered]); }

      setStats(logsData.data.stats);
      setHasMore(rawLogs.length === PAGE_LIMIT);
    } catch (err: any) { setError(err.message || 'Failed to load dashboard data'); }
    finally { setLoading(false); }
  };

  /* ─── Export: fetch ALL pages, build CSV client-side ─── */
  const handleExportCSV = async () => {
    try {
      setExporting(true);
      let page = 1;
      let allFetched: AuditLog[] = [];
      let morePages = true;

      while (morePages) {
        const params = new URLSearchParams({ page: page.toString(), limit: PAGE_LIMIT.toString() });
        if (eventType)  params.append('eventType',  eventType);
        if (department) params.append('department', department);
        if (dateFrom)   params.append('dateFrom',   dateFrom);
        if (dateTo)     params.append('dateTo',     dateTo);

        const res = await fetch(`/api/admin/audit-logs?${params}`);
        if (!res.ok) throw new Error('Failed to fetch logs for export');

        const data = await res.json();
        const raw: AuditLog[] = data.data.logs ?? [];
        allFetched = [...allFetched, ...teacherOnly(raw)];

        morePages = raw.length === PAGE_LIMIT;
        page++;
      }

      const csv  = buildCSV(allFetched);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  // Pagination
  const visibleLogs  = paginate(allLogs, currentPage);
  const totalPages   = Math.max(1, Math.ceil(allLogs.length / ROWS_PER_PAGE));
  const onLastUiPage = currentPage >= totalPages;

  const handleNextPage = () => {
    if (!onLastUiPage) {
      setCurrentPage(p => p + 1);
    } else if (hasMore && !loading) {
      setApiFetchPage(apiFetchPage + 1);
      setCurrentPage(p => p + 1);
    }
  };
  const handlePrevPage = () => setCurrentPage(p => Math.max(1, p - 1));
  const isNextDisabled = onLastUiPage && !hasMore;
  const isPrevDisabled = currentPage === 1;

  /* ── Loading (initial) ── */
  if (loading && allLogs.length === 0) return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        html,body{background:#050505!important;margin:0;cursor:none!important;}
        @keyframes spin{to{transform:rotate(360deg);}}
        .c-dot{position:fixed;width:7px;height:7px;background:#fff;border-radius:50%;pointer-events:none;z-index:99999;transform:translate(-50%,-50%);mix-blend-mode:difference;}
        .c-ring{position:fixed;width:32px;height:32px;border:1px solid rgba(255,255,255,0.6);border-radius:50%;pointer-events:none;z-index:99998;transform:translate(-50%,-50%);mix-blend-mode:difference;}
      `}</style>
      <DashCursor />
      <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.07)', borderTop: '2px solid rgba(255,255,255,0.5)', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
          <p style={{ marginTop: '1rem', fontSize: '0.88rem', fontWeight: 500, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>Loading audit dashboard…</p>
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
        .fade-up4 { animation:fadeUp 0.45s ease both; animation-delay:0.18s; }

        select option { background:#1a1a1a; color:#f0f0f0; }
        input[type='date']::-webkit-calendar-picker-indicator { filter:invert(0.6); cursor:none; }

        .audit-table { width:100%; border-collapse:collapse; }
        .audit-table thead tr { border-bottom:1px solid rgba(255,255,255,0.07); }
        .audit-table thead th { padding:0.65rem 1rem; text-align:left; font-size:0.63rem; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; color:rgba(255,255,255,0.3); white-space:nowrap; }
        .audit-table tbody tr { border-bottom:1px solid rgba(255,255,255,0.04); transition:background 0.15s; }
        .audit-table tbody tr:last-child { border-bottom:none; }
        .audit-table tbody tr:hover { background:rgba(255,255,255,0.025); }
        .audit-table tbody td { padding:0.85rem 1rem; font-size:0.82rem; color:rgba(255,255,255,0.6); vertical-align:middle; }

        .a-scroll::-webkit-scrollbar { height:3px; width:3px; }
        .a-scroll::-webkit-scrollbar-track { background:transparent; }
        .a-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:10px; }
      `}</style>

      <DashCursor />

      <div style={{ minHeight: '100vh', background: '#050505', fontFamily: "'Inter',system-ui,sans-serif" }}>

        {/* ── Nav ── */}
        <nav style={{ height: 52, background: 'rgba(5,5,5,0.92)', borderBottom: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', padding: '0 1.75rem', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
          <NavBack href="/admin-dashboard" label="Admin Dashboard" />
          <div style={{ fontSize: '0.78rem', fontWeight: 500, color: 'rgba(255,255,255,0.28)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            EvalChain <span style={{ color: 'rgba(255,255,255,0.18)' }}>/</span>
            <span style={{ color: 'rgba(255,255,255,0.55)' }}>Audit & Bias</span>
          </div>
          <ExportButton onClick={handleExportCSV} exporting={exporting} />
        </nav>

        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '2.25rem 1.25rem 4rem' }}>

          {/* ── Heading ── */}
          <div className="fade-up" style={{ marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', marginBottom: '0.55rem' }}>
              Admin Portal
            </div>
            <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(2.4rem,5vw,3.5rem)', lineHeight: 0.95, color: '#ffffff', letterSpacing: '0.01em' }}>
              AUDIT &amp;<br/>
              <span style={{ WebkitTextStroke: '0.5px rgba(255,255,255,0.9)', color: 'transparent' }}>BIAS DETECTION</span>
            </h1>
          </div>

          {/* ── Simple stats (from stats) ── */}
          {stats && (
            <div className="fade-up2" style={{ display: 'flex', gap: '0.85rem', marginBottom: '1.25rem', flexWrap: 'wrap' as const }}>
              <StatCard value={stats.totalLogs} label="Total Logs" accent="rgba(147,197,253,1)" />
            </div>
          )}

          {/* ── Import Students card ── */}
          <div className="fade-up2" style={{ marginBottom: '1.5rem' }}>
            <Link href="/import-students" style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#090909', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 14, padding: '1.1rem 1.4rem', cursor: 'none', transition: 'border-color 0.2s, background 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(139,92,246,0.6)'; (e.currentTarget as HTMLDivElement).style.background = '#0d0d0d'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(139,92,246,0.3)'; (e.currentTarget as HTMLDivElement).style.background = '#090909'; }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(216,180,254,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginBottom: '0.2rem' }}>Import Students via CSV</div>
                    <div style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>Bulk upload student accounts — credentials auto-generated &amp; emailed</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.42rem 1rem', borderRadius: 8, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', fontSize: '0.8rem', fontWeight: 700, color: 'rgba(216,180,254,0.9)', whiteSpace: 'nowrap' as const }}>
                  Upload CSV
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                </div>
              </div>
            </Link>
          </div>

          {/* ── Tabs + Filters (only logs tab now) ── */}
          <div className="fade-up3" style={{ background: '#090909', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '1.25rem 1.4rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: '1rem' }}>
              <TabBtn active={true} onClick={() => { /* only logs */ }}>📋 Audit Logs</TabBtn>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.85rem' }}>
              <div><FLabel>Event Type</FLabel>
                <DarkSelect value={eventType} onChange={e => setEventType(e.target.value)}>
                  <option value="">All Events</option>
                  <option value="evaluation_started">Evaluation Started</option>
                  <option value="question_marked">Question Marked</option>
                  <option value="evaluation_completed">Evaluation Completed</option>
                  <option value="grievance_filed">Grievance Filed</option>
                  <option value="reevaluation_completed">Re-evaluation Completed</option>
                </DarkSelect>
              </div>
              <div><FLabel>Department</FLabel>
                <DarkInput type="text" placeholder="Filter by department" value={department} onChange={e => setDepartment(e.target.value)} />
              </div>
              <div><FLabel>Date From</FLabel>
                <DarkInput type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div><FLabel>Date To</FLabel>
                <DarkInput type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </div>
          </div>

          {/* ── Audit Logs ── */}
          <div className="fade-up4" style={{ background: '#090909', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '1.4rem' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)' }}>
                  Teacher &amp; Admin Logs
                </div>
                <div style={{ padding: '0.18rem 0.6rem', borderRadius: 100, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: "'Bebas Neue',sans-serif", fontSize: '1rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1 }}>
                  {allLogs.length}{hasMore ? '+' : ''}
                </div>
              </div>
              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.07)', borderTop: '2px solid rgba(255,255,255,0.4)', animation: 'spin 0.7s linear infinite' }} />
                  <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>Loading…</span>
                </div>
              )}
            </div>

            {error && (
              <div style={{ marginBottom: '1rem', padding: '0.8rem 1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 9, display: 'flex', gap: '0.5rem' }}>
                <span>⚠️</span>
                <p style={{ fontSize: '0.83rem', fontWeight: 600, color: 'rgba(252,165,165,0.95)' }}>{error}</p>
              </div>
            )}

            <div className="a-scroll" style={{ overflowX: 'auto' }}>
              <table className="audit-table">
                <thead>
                  <tr>{['Timestamp', 'Event', 'User', 'Role', 'Department', 'Details'].map(h => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {visibleLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>
                        No teacher logs found
                      </td>
                    </tr>
                  ) : visibleLogs.map(log => {
                    const rc = roleConfig(log.userRole);
                    return (
                      <tr key={log.auditId}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.75rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.38)' }}>
                          {new Date(log.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td>
                          <span style={{ padding: '0.2rem 0.6rem', borderRadius: 100, background: 'rgba(147,197,253,0.1)', border: '1px solid rgba(147,197,253,0.22)', fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: 'rgba(147,197,253,0.85)', whiteSpace: 'nowrap' as const }}>
                            {formatEvent(log.eventType)}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>{log.userName || '—'}</td>
                        <td><Pill label={log.userRole || '—'} color={rc.color} bg={rc.bg} border={rc.border} /></td>
                        <td style={{ color: 'rgba(255,255,255,0.5)' }}>{log.department || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' as const }}>
                            {log.questionNumber   && <span style={{ fontSize: '0.73rem', fontWeight: 600, color: 'rgba(255,255,255,0.45)' }}>Q{log.questionNumber}</span>}
                            {log.marksAwarded !== undefined && <span style={{ fontSize: '0.73rem', fontWeight: 600, color: 'rgba(255,255,255,0.45)' }}>{log.marksAwarded} pts</span>}
                            {log.timeSpent        && <span style={{ fontSize: '0.73rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)' }}>{log.timeSpent}s</span>}
                            {log.markingPattern   && (() => { const pc = patternConfig(log.markingPattern!); return <Pill label={log.markingPattern!} color={pc.color} bg={pc.bg} border={pc.border} />; })()}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <PaginationBtn dir="prev" disabled={isPrevDisabled} onClick={handlePrevPage} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)' }}>
                  Page {currentPage} of {totalPages}{hasMore ? '+' : ''}
                </span>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => Math.abs(p - currentPage) <= 2)
                    .map(p => (
                      <button key={p} onClick={() => setCurrentPage(p)}
                        style={{ width: 28, height: 28, borderRadius: 7, fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 700, cursor: 'none', border: p === currentPage ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.08)', background: p === currentPage ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)', color: p === currentPage ? '#fff' : 'rgba(255,255,255,0.4)', transition: 'all 0.15s' }}>
                        {p}
                      </button>
                    ))
                  }
                </div>
              </div>
              <PaginationBtn dir="next" disabled={isNextDisabled} loading={loading && onLastUiPage} onClick={handleNextPage} />
            </div>

            {/* Event summary */}
            {stats && Object.keys(stats.eventTypeCounts).length > 0 && (
              <div style={{ marginTop: '1rem', padding: '1rem 1.1rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', marginBottom: '0.75rem' }}>Event Type Summary</div>
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '0.55rem' }}>
                  {Object.entries(stats.eventTypeCounts)
                    .filter(([type]) => !!type)
                    .map(([type, count]) => (
                      <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0.7rem', borderRadius: 100, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255,255,255,0.45)' }}>{formatEvent(type)}</span>
                        <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1 }}>{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <FloatingChat />
    </>
  );
}

/* ─── Pagination btn ─── */
function PaginationBtn({ dir, disabled, loading, onClick }: { dir: 'prev' | 'next'; disabled: boolean; loading?: boolean; onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled || loading}
      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.85rem', borderRadius: 8, background: h && !disabled ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)', border: `1px solid ${h && !disabled ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)'}`, fontSize: '0.78rem', fontWeight: 700, color: disabled ? 'rgba(255,255,255,0.2)' : h ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)', cursor: disabled ? 'not-allowed' : 'none', fontFamily: 'inherit', transition: 'all 0.2s', opacity: disabled ? 0.4 : 1 }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      {dir === 'prev' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>}
      {loading
        ? <div style={{ width: 11, height: 11, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.15)', borderTop: '2px solid rgba(255,255,255,0.5)', animation: 'spin 0.7s linear infinite' }} />
        : (dir === 'prev' ? 'Prev' : 'Next')
      }
      {dir === 'next' && !loading && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>}
    </button>
  );
}
