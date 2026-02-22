'use client';

import { useEffect, useState, useRef } from 'react';
import { Landmark, FileText, CheckCircle2, ClipboardList, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface User {
  userId: string; name: string; email: string;
  department: string; subjects: string[];
}
interface Stats {
  totalSubmissions: number; evaluatedSubmissions: number;
  pendingSubmissions: number; testsCreated: number;
  pendingGrievances?: number;
}

/* ─── Cursor ─── */
function DashCursor() {
  const dotRef  = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let dx = window.innerWidth / 2, dy = window.innerHeight / 2;
    let rx = dx, ry = dy; let raf: number;
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
  return (
    <>
      <div ref={dotRef}  className="c-dot" />
      <div ref={ringRef} className="c-ring" />
    </>
  );
}

/* ─── Stat card ─── */
function StatCard({ value, label, accent }: { value: number; label: string; accent: string }) {
  return (
    <div style={{
      background: '#090909', border: `1px solid ${accent}33`,
      borderRadius: 14, padding: '1.35rem 1.4rem',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -20, right: -20, width: 70, height: 70, borderRadius: '50%', background: `${accent}18`, filter: 'blur(20px)', pointerEvents: 'none' }} />
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.8rem', lineHeight: 1, color: accent, marginBottom: '0.3rem' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.38)' }}>
        {label}
      </div>
    </div>
  );
}

/* ─── Action card ─── */
function ActionCard({
  href, icon, title, desc, accent, badge,
}: { href: string; icon: React.ReactNode; title: string; desc: string; accent: string; badge?: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link href={href} style={{
      display: 'block', textDecoration: 'none',
      background: hovered ? `${accent}12` : 'rgba(255,255,255,0.025)',
      border: `1px solid ${hovered ? accent : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 14, padding: '1.5rem 1.4rem',
      position: 'relative', overflow: 'hidden',
      transition: 'background 0.2s, border-color 0.2s, transform 0.2s',
      transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
      boxShadow: hovered ? `0 8px 28px rgba(0,0,0,0.35), 0 0 0 1px ${accent}22` : 'none',
    }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Left accent stripe */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent, opacity: hovered ? 1 : 0.4, transition: 'opacity 0.2s', boxShadow: `0 0 10px ${accent}` }} />
      {/* Badge */}
      {badge && badge > 0 && (
        <div style={{ position: 'absolute', top: '0.85rem', right: '0.85rem', width: 22, height: 22, borderRadius: '50%', background: 'rgba(239,68,68,0.85)', border: '1px solid rgba(239,68,68,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: '#fff' }}>
          {badge}
        </div>
      )}
      <div style={{ fontSize: '2rem', marginBottom: '0.85rem' }}>{icon}</div>
      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: hovered ? '#ffffff' : 'rgba(255,255,255,0.85)', marginBottom: '0.35rem', transition: 'color 0.2s' }}>
        {title}
      </div>
      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'rgba(255,255,255,0.38)', lineHeight: 1.5 }}>
        {desc}
      </div>
      {/* Arrow */}
      <div style={{ marginTop: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 700, color: accent, opacity: hovered ? 1 : 0, transition: 'opacity 0.2s' }}>
        Open
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>
    </Link>
  );
}

/* ─── Quick link row item ─── */
function QuickLink({ href, icon, title, sub, accent, badge }: { href: string; icon: string; title: string; sub: string; accent: string; badge?: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', gap: '0.85rem',
      padding: '0.85rem 1rem', borderRadius: 11, textDecoration: 'none',
      background: hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
      border: `1px solid ${hovered ? 'rgba(255,255,255,0.1)' : 'transparent'}`,
      transition: 'background 0.2s, border-color 0.2s',
      position: 'relative',
    }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${accent}18`, border: `1px solid ${accent}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: hovered ? '#ffffff' : 'rgba(255,255,255,0.75)', transition: 'color 0.2s' }}>{title}</div>
        <div style={{ fontSize: '0.74rem', fontWeight: 500, color: 'rgba(255,255,255,0.35)', marginTop: '0.1rem' }}>{sub}</div>
      </div>
      {badge && badge > 0 && (
        <div style={{ marginLeft: 'auto', width: 20, height: 20, borderRadius: '50%', background: 'rgba(239,68,68,0.85)', border: '1px solid rgba(239,68,68,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 800, color: '#fff', flexShrink: 0 }}>
          {badge}
        </div>
      )}
    </Link>
  );
}

export default function TeacherDashboard() {
  const router = useRouter();
  const [user, setUser]   = useState<User | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [logoutHover, setLogoutHover] = useState(false);

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const userRes = await fetch('/api/auth/me');
      if (!userRes.ok) { router.push('/login'); return; }
      const userData = await userRes.json();
      setUser(userData.data.user);

      const statsRes = await fetch('/api/teacher/stats');
      if (statsRes.ok) { const sd = await statsRes.json(); setStats(sd.data.stats); }

      const gRes = await fetch('/api/teacher/grievances?status=pending');
      if (gRes.ok) {
        const gData = await gRes.json();
        setStats(prev => ({ ...prev, pendingGrievances: gData.data.stats.pending || 0 } as Stats));
      }
    } catch (err: any) { setError(err.message || 'Failed to load dashboard data'); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  /* ── Loading ── */
  if (loading) return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Bebas+Neue&display=swap');
        html,body{background:#050505!important;margin:0;font-family:'Inter',sans-serif;cursor:none!important;}
        @keyframes spin{to{transform:rotate(360deg);}}
        .c-dot{position:fixed;width:7px;height:7px;background:#fff;border-radius:50%;pointer-events:none;z-index:99999;transform:translate(-50%,-50%);mix-blend-mode:difference;}
        .c-ring{position:fixed;width:32px;height:32px;border:1px solid rgba(255,255,255,0.6);border-radius:50%;pointer-events:none;z-index:99998;transform:translate(-50%,-50%);mix-blend-mode:difference;}
      `}</style>
      <DashCursor />
      <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.07)', borderTop: '2px solid rgba(255,255,255,0.5)', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
          <p style={{ marginTop: '1rem', fontSize: '0.88rem', fontWeight: 500, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>Loading dashboard…</p>
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
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px);} to{opacity:1;transform:translateY(0);} }

        .fade-up  { animation: fadeUp 0.45s ease both; }
        .fade-up2 { animation: fadeUp 0.45s ease both; animation-delay:0.07s; }
        .fade-up3 { animation: fadeUp 0.45s ease both; animation-delay:0.13s; }
        .fade-up4 { animation: fadeUp 0.45s ease both; animation-delay:0.19s; }

        .dash-scroll::-webkit-scrollbar { width:3px; }
        .dash-scroll::-webkit-scrollbar-track { background:transparent; }
        .dash-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:10px; }
      `}</style>

      <DashCursor />

      <div style={{ minHeight: '100vh', background: '#050505', fontFamily: "'Inter', system-ui, sans-serif" }}>

        {/* ── Nav ── */}
        <nav style={{
          height: 56, background: 'rgba(5,5,5,0.92)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(20px)',
          display: 'flex', alignItems: 'center',
          padding: '0 1.75rem', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.35rem', letterSpacing: '0.06em', color: '#ffffff' }}>
              GRADEX
            </div>
            <div style={{ padding: '0.18rem 0.55rem', borderRadius: 100, background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(216,180,254,0.9)' }}>
              Teacher
            </div>
          </div>

          {/* Nav actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {[
              { href: '/create-test', label: 'Create Test',   accent: 'rgba(147,197,253,1)' },
              { href: '/evaluate',    label: 'Evaluate',      accent: 'rgba(74,222,128,1)'  },
            ].map(item => (
              <NavLink key={item.href} href={item.href} label={item.label} accent={item.accent} />
            ))}

            {/* Grievances with badge */}
            <div style={{ position: 'relative' }}>
              <NavLink href="/grievances" label="Grievances" accent="rgba(216,180,254,1)" />
              {stats?.pendingGrievances && stats.pendingGrievances > 0 && (
                <div style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: '50%', background: 'rgba(239,68,68,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 800, color: '#fff', pointerEvents: 'none' }}>
                  {stats.pendingGrievances}
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 0.25rem' }} />

            {/* Logout */}
            <button onClick={handleLogout} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.42rem 0.85rem', borderRadius: 8,
              background: logoutHover ? 'rgba(239,68,68,0.12)' : 'transparent',
              border: `1px solid ${logoutHover ? 'rgba(239,68,68,0.3)' : 'transparent'}`,
              fontSize: '0.8rem', fontWeight: 600,
              color: logoutHover ? 'rgba(252,165,165,0.9)' : 'rgba(255,255,255,0.4)',
              cursor: 'none', fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
              onMouseEnter={() => setLogoutHover(true)}
              onMouseLeave={() => setLogoutHover(false)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
              Logout
            </button>
          </div>
        </nav>

        {/* ── Page body ── */}
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2.25rem 1.25rem 4rem' }}>

          {/* ── Welcome heading ── */}
          <div className="fade-up" style={{ marginBottom: '2.25rem' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', marginBottom: '0.55rem' }}>
              Teacher Portal
            </div>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2.6rem,5vw,4rem)', lineHeight: 0.95, color: '#ffffff', letterSpacing: '0.01em', marginBottom: '0.75rem' }}>
              WELCOME BACK,<br/>
              <span style={{ WebkitTextStroke: '0.5px rgba(255,255,255,0.9)', color: 'transparent' }}>
                {user?.name?.toUpperCase()}
              </span>
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' as const }}>
              <span style={{ padding: '0.25rem 0.7rem', borderRadius: 100, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>
                <Landmark size={18} /> {user?.department}
              </span>
              {user?.subjects.map(s => (
                <span key={s} style={{ padding: '0.25rem 0.7rem', borderRadius: 100, background: 'rgba(147,197,253,0.08)', border: '1px solid rgba(147,197,253,0.2)', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(147,197,253,0.8)' }}>
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* ── Stats row ── */}
          <div className="fade-up2" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '0.85rem', marginBottom: '1.5rem' }}>
            <StatCard value={stats?.testsCreated       || 0} label="Tests Created"      accent="rgba(147,197,253,1)" />
            <StatCard value={stats?.totalSubmissions    || 0} label="Total Submissions"  accent="rgba(255,255,255,0.6)" />
            <StatCard value={stats?.pendingSubmissions  || 0} label="Pending"            accent="rgba(253,224,71,1)"   />
            <StatCard value={stats?.evaluatedSubmissions || 0} label="Evaluated"         accent="rgba(74,222,128,1)"   />
            <StatCard value={stats?.pendingGrievances   || 0} label="Pending Grievances" accent="rgba(216,180,254,1)"  />
          </div>

          {/* ── Action cards ── */}
          <div className="fade-up3" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.85rem', marginBottom: '1.5rem' }}>
            <ActionCard href="/create-test"  icon={<FileText size={18} />} title="Create Test"    desc="Upload question paper and marking scheme"  accent="rgba(147,197,253,1)" />
            <ActionCard href="/evaluate"     icon={<CheckCircle2 size={18} />} title="Evaluate"       desc="Review and mark student submissions"       accent="rgba(74,222,128,1)"  />
            <ActionCard href="/grievances"   icon={<ClipboardList size={18} />} title="Grievances"     desc="Review and re-evaluate submissions"        accent="rgba(216,180,254,1)" badge={stats?.pendingGrievances} />
          </div>

          {/* ── Quick links ── */}

          {/* Error */}
          {error && (
            <div style={{ marginTop: '1rem', padding: '0.85rem 1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600, color: 'rgba(252,165,165,0.9)' }}>
              <AlertTriangle size={18} /> {error}
            </div>
          )}

        </div>
      </div>
    </>
  );
}

/* ─── Nav link helper ─── */
function NavLink({ href, label, accent }: { href: string; label: string; accent: string }) {
  const [h, setH] = useState(false);
  return (
    <Link href={href} style={{
      padding: '0.42rem 0.85rem', borderRadius: 8,
      background: h ? `${accent}14` : 'transparent',
      border: `1px solid ${h ? `${accent}40` : 'transparent'}`,
      fontSize: '0.8rem', fontWeight: 600,
      color: h ? accent : 'rgba(255,255,255,0.5)',
      textDecoration: 'none', transition: 'all 0.2s',
    }}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
    >
      {label}
    </Link>
  );
}
