'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import RecentSubmissions from './components/RecentSubmissions';

interface User {
  userId: string; name: string; email: string;
  department: string; year: number; division: string;
}
interface Stats {
  totalSubmissions: number; evaluatedSubmissions: number; pendingResults: number;
}

export default function StudentDashboard() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [user, setUser]   = useState<User | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [activeNav, setActiveNav] = useState('dashboard');

  /* ─── Canvas ─── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W = (canvas.width = window.innerWidth);
    let H = (canvas.height = window.innerHeight);
    let mx = W / 2, my = H / 2, tmx = mx, tmy = my;
    const CELL = 52, RADIUS = 180, STRENGTH = 30;
    const onResize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    const onMove = (e: MouseEvent) => { tmx = e.clientX; tmy = e.clientY; };
    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMove);
    let raf: number;
    const draw = () => {
      mx += (tmx - mx) * 0.07; my += (tmy - my) * 0.07;
      ctx.clearRect(0, 0, W, H);
      for (let x = 0; x <= W + CELL; x += CELL) {
        ctx.beginPath();
        for (let y = 0; y <= H; y += 3) {
          const dx = x - mx, dy = y - my, dist = Math.sqrt(dx*dx+dy*dy);
          const inf = Math.max(0,1-dist/RADIUS), ease = inf*inf*(3-2*inf);
          const a = Math.atan2(dy,dx), p = ease*STRENGTH;
          y===0 ? ctx.moveTo(x+Math.cos(a)*p,y+Math.sin(a)*p) : ctx.lineTo(x+Math.cos(a)*p,y+Math.sin(a)*p);
        }
        ctx.strokeStyle='rgba(255,255,255,0.07)'; ctx.lineWidth=0.7; ctx.stroke();
      }
      for (let y = 0; y <= H + CELL; y += CELL) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 3) {
          const dx = x - mx, dy = y - my, dist = Math.sqrt(dx*dx+dy*dy);
          const inf = Math.max(0,1-dist/RADIUS), ease = inf*inf*(3-2*inf);
          const a = Math.atan2(dy,dx), p = ease*STRENGTH;
          x===0 ? ctx.moveTo(x+Math.cos(a)*p,y+Math.sin(a)*p) : ctx.lineTo(x+Math.cos(a)*p,y+Math.sin(a)*p);
        }
        ctx.strokeStyle='rgba(255,255,255,0.07)'; ctx.lineWidth=0.7; ctx.stroke();
      }
      const g = ctx.createRadialGradient(mx,my,0,mx,my,RADIUS);
      g.addColorStop(0,'rgba(255,255,255,0.05)'); g.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(mx,my,RADIUS,0,Math.PI*2); ctx.fill();
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize',onResize); window.removeEventListener('mousemove',onMove); };
  }, []);

  /* ─── GSAP ─── */
  useEffect(() => {
    if (loading) return;
    const init = async () => {
      const gsapMod = await import('gsap');
      const gsap = gsapMod.gsap ?? (gsapMod as any).default;
      gsap.set('.bento-cell', { opacity: 0, y: 24, scale: 0.97 });
      gsap.to('.bento-cell', { opacity:1, y:0, scale:1, duration:0.65, stagger:{each:0.07,from:'start'}, ease:'power3.out', delay:0.1 });
    };
    init();
  }, [loading]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const userRes = await fetch('/api/auth/me');
      if (!userRes.ok) { router.push('/login'); return; }
      setUser((await userRes.json()).data.user);
      const sRes = await fetch('/api/student/stats');
      if (sRes.ok) setStats((await sRes.json()).data.stats);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
  };

  const navItems = [
    { id: 'dashboard', icon: '⊞', label: 'Dashboard' },
    { id: 'upload',    icon: '↑',  label: 'Upload',      href: '/upload' },
    { id: 'results',   icon: '◈',  label: 'Results',     href: '/results' },
    { id: 'grievances',icon: '⚑',  label: 'Grievances',  href: '/grievances' },
    { id: 'profile',   icon: '◉',  label: 'Profile',     href: '/profile' },
  ];

  if (loading) return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&family=Bebas+Neue&display=swap');
        html,body{background:#050505!important;margin:0;font-family:'Inter',sans-serif;}
        @keyframes spin{to{transform:rotate(360deg);}}
      `}</style>
      <div style={{minHeight:'100vh',background:'#050505',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{textAlign:'center'}}>
          <div style={{width:40,height:40,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.1)',borderTop:'2px solid rgba(255,255,255,0.7)',animation:'spin 0.7s linear infinite',margin:'0 auto'}}/>
          <p style={{marginTop:'1.25rem',fontSize:'0.9rem',fontWeight:600,color:'rgba(255,255,255,0.4)',letterSpacing:'0.1em'}}>LOADING…</p>
        </div>
      </div>
    </>
  );

  if (error) return (
    <div style={{minHeight:'100vh',background:'#050505',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Inter,sans-serif'}}>
      <div style={{textAlign:'center'}}>
        <p style={{color:'#ff6b6b',fontSize:'1rem',fontWeight:600}}>{error}</p>
        <button onClick={fetchData} style={{marginTop:'0.75rem',fontSize:'0.875rem',color:'rgba(255,255,255,0.45)',background:'none',border:'none',cursor:'pointer',textDecoration:'underline'}}>Retry</button>
      </div>
    </div>
  );

  const evalRate = stats?.totalSubmissions
    ? Math.round((stats.evaluatedSubmissions / stats.totalSubmissions) * 100) : 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&family=Bebas+Neue&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html{background:#050505!important;color-scheme:dark;}
        body{background:#050505!important;color:#f0f0f0!important;font-family:'Inter',system-ui,sans-serif;overflow-x:hidden;cursor:none!important;}
        #__next,main{background:#050505!important;}

        .c-dot{position:fixed;width:8px;height:8px;background:#fff;border-radius:50%;pointer-events:none;z-index:99999;transform:translate(-50%,-50%);mix-blend-mode:difference;}
        .c-ring{position:fixed;width:34px;height:34px;border:1.5px solid rgba(255,255,255,0.65);border-radius:50%;pointer-events:none;z-index:99998;transform:translate(-50%,-50%);mix-blend-mode:difference;}
        #dbc{position:fixed;inset:0;z-index:0;pointer-events:none;}

        /* ── Shell ── */
        #shell{display:flex;min-height:100vh;background:#050505;position:relative;z-index:1;}

        /* ── Sidebar ── */
        #sidebar{
          width:240px;flex-shrink:0;
          background:#080808;
          border-right:1px solid rgba(255,255,255,0.08);
          display:flex;flex-direction:column;
          position:sticky;top:0;height:100vh;
          transition:width 0.3s ease;
          overflow:hidden;
        }
        #sidebar.collapsed{width:64px;}

        .sb-top{
          padding:1.4rem 1.1rem;
          border-bottom:1px solid rgba(255,255,255,0.07);
          display:flex;align-items:center;justify-content:space-between;flex-shrink:0;
        }
        .sb-logo{display:flex;align-items:center;gap:0.55rem;text-decoration:none;overflow:hidden;white-space:nowrap;}
        .sb-logo-mark{
          width:32px;height:32px;border-radius:8px;background:#f0f0f0;
          display:flex;align-items:center;justify-content:center;
          font-size:0.85rem;color:#000;font-weight:900;flex-shrink:0;
          box-shadow:0 0 12px rgba(255,255,255,0.15);
        }
        .sb-logo-text{font-weight:800;font-size:1rem;color:#ffffff;letter-spacing:0.01em;}

        .sb-collapse-btn{
          background:none;border:none;cursor:pointer;
          color:rgba(255,255,255,0.4);font-size:1rem;
          padding:0.25rem;border-radius:5px;flex-shrink:0;transition:color 0.2s;
        }
        .sb-collapse-btn:hover{color:rgba(255,255,255,0.8);}

        .sb-user{
          padding:1.1rem;
          border-bottom:1px solid rgba(255,255,255,0.07);flex-shrink:0;
        }
        .sb-avatar{
          width:40px;height:40px;border-radius:10px;
          background:rgba(255,255,255,0.1);
          border:1px solid rgba(255,255,255,0.18);
          display:flex;align-items:center;justify-content:center;
          font-family:'Bebas Neue',sans-serif;font-size:1.3rem;color:#ffffff;
          flex-shrink:0;
        }
        /* ↑↑ BOOSTED: name & id in sidebar */
        .sb-user-name{font-size:0.95rem;font-weight:700;color:#ffffff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .sb-user-id{font-size:0.78rem;color:rgba(255,255,255,0.45);margin-top:0.15rem;white-space:nowrap;}

        .sb-nav{flex:1;padding:0.85rem 0;overflow-y:auto;}
        /* ↑↑ BOOSTED: nav item text */
        .sb-nav-item{
          display:flex;align-items:center;gap:0.8rem;
          padding:0.8rem 1.1rem;
          text-decoration:none;
          font-size:0.9rem;font-weight:600;
          color:rgba(255,255,255,0.5);
          transition:color 0.2s,background 0.2s;
          cursor:pointer;border:none;background:none;
          font-family:inherit;width:100%;text-align:left;
          white-space:nowrap;overflow:hidden;position:relative;
        }
        .sb-nav-item:hover{color:rgba(255,255,255,0.85);background:rgba(255,255,255,0.04);}
        .sb-nav-item.active{color:#ffffff;background:rgba(255,255,255,0.07);}
        .sb-nav-item.active::before{
          content:'';position:absolute;left:0;top:0;bottom:0;width:3px;
          background:#fff;box-shadow:0 0 10px rgba(255,255,255,0.5);
        }
        .sb-nav-icon{width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;}

        .sb-footer{padding:1.1rem;border-top:1px solid rgba(255,255,255,0.07);flex-shrink:0;}
        /* ↑↑ BOOSTED: logout */
        .sb-logout-btn{
          display:flex;align-items:center;gap:0.65rem;
          width:100%;padding:0.7rem 0.6rem;
          background:none;border:none;cursor:pointer;
          font-size:0.88rem;font-weight:600;
          color:rgba(255,255,255,0.4);
          font-family:inherit;border-radius:8px;
          transition:color 0.2s,background 0.2s;white-space:nowrap;overflow:hidden;
        }
        .sb-logout-btn:hover{color:#ff6b6b;background:rgba(255,80,80,0.07);}

        /* ── Main ── */
        #main{flex:1;display:flex;flex-direction:column;min-width:0;}

        /* ── Topbar ── */
        #topbar{
          height:56px;flex-shrink:0;
          background:rgba(5,5,5,0.88);
          border-bottom:1px solid rgba(255,255,255,0.08);
          backdrop-filter:blur(20px);
          display:flex;align-items:center;justify-content:space-between;
          padding:0 2rem;position:sticky;top:0;z-index:50;
        }
        /* ↑↑ BOOSTED: breadcrumb */
        .topbar-breadcrumb{
          display:flex;align-items:center;gap:0.6rem;
          font-size:0.9rem;color:rgba(255,255,255,0.45);
          font-weight:600;letter-spacing:0.01em;
        }
        .topbar-breadcrumb span{color:rgba(255,255,255,0.65);}
        .topbar-right{display:flex;align-items:center;gap:0.85rem;}
        /* ↑↑ BOOSTED: date */
        .topbar-date{font-size:0.85rem;color:rgba(255,255,255,0.5);font-weight:500;letter-spacing:0.01em;}
        .topbar-upload-btn{
          display:flex;align-items:center;gap:0.45rem;
          padding:0.55rem 1.2rem;
          background:#f0f0f0;color:#000;
          font-weight:800;font-size:0.85rem;
          letter-spacing:0.01em;border:none;border-radius:9px;cursor:pointer;
          font-family:inherit;text-decoration:none;
          transition:opacity 0.2s,box-shadow 0.2s;
          box-shadow:0 0 18px rgba(255,255,255,0.15);
        }
        .topbar-upload-btn:hover{opacity:0.85;box-shadow:0 0 28px rgba(255,255,255,0.25);}

        /* ── Bento ── */
        #bento{
          flex:1;padding:1.75rem;
          display:grid;grid-template-columns:repeat(12,1fr);
          grid-auto-rows:auto;gap:1rem;align-content:start;
        }
        .bento-cell{
          background:#090909;border:1px solid rgba(255,255,255,0.09);
          border-radius:14px;overflow:hidden;position:relative;
          transition:border-color 0.2s ease,transform 0.2s ease;
        }
        .bento-cell:hover{border-color:rgba(255,255,255,0.18);}

        .cell-greeting   {grid-column:span 8;padding:2rem 2rem 1.75rem;}
        .cell-clock      {grid-column:span 4;padding:1.75rem;}
        .cell-stat-total {grid-column:span 4;padding:1.5rem;}
        .cell-stat-eval  {grid-column:span 4;padding:1.5rem;}
        .cell-stat-pend  {grid-column:span 4;padding:1.5rem;}
        .cell-progress   {grid-column:span 4;padding:1.5rem;}
        .cell-submissions{grid-column:span 8;}
        .cell-actions    {grid-column:span 4;padding:1.5rem;}
        .cell-profile    {grid-column:span 4;padding:1.5rem;}
        .cell-stages     {grid-column:span 4;padding:1.5rem;}

        /* ── Greeting ── */
        .greeting-eyebrow{
          font-size:0.72rem;font-weight:700;letter-spacing:0.18em;
          text-transform:uppercase;color:rgba(255,255,255,0.45);
          margin-bottom:0.9rem;display:flex;align-items:center;gap:0.55rem;
        }
        .greeting-dot{
          width:6px;height:6px;border-radius:50%;background:#fff;
          box-shadow:0 0 7px rgba(255,255,255,0.9);
          animation:blink 2s ease infinite;
        }
        @keyframes blink{0%,100%{opacity:1;}50%{opacity:0.15;}}
        .greeting-name{
          font-family:'Bebas Neue',sans-serif;
          font-size:clamp(3rem,4.5vw,5rem);
          line-height:0.9;letter-spacing:-0.01em;color:#fff;
        }
        .greeting-outline{
          -webkit-text-stroke:2px rgba(255,255,255,0.55);
          color:transparent;
          filter:drop-shadow(0 0 12px rgba(255,255,255,0.2));
        }
        .greeting-meta{
          margin-top:1.25rem;display:flex;align-items:center;gap:0.65rem;flex-wrap:wrap;
        }
        /* ↑↑ BOOSTED: meta chips */
        .greeting-meta-chip{
          padding:0.3rem 0.8rem;border-radius:100px;
          background:rgba(255,255,255,0.06);
          border:1px solid rgba(255,255,255,0.14);
          font-size:0.8rem;font-weight:600;letter-spacing:0.02em;
          color:rgba(255,255,255,0.65);
        }

        /* ── Clock ── */
        .clock-time{
          font-family:'Bebas Neue',sans-serif;
          font-size:clamp(3rem,5vw,4.8rem);
          line-height:1;color:#fff;letter-spacing:0.02em;
          text-shadow:0 0 40px rgba(255,255,255,0.12);
        }
        /* ↑↑ BOOSTED: clock date */
        .clock-date{font-size:0.88rem;color:rgba(255,255,255,0.55);margin-top:0.5rem;font-weight:500;}
        .clock-ampm{
          font-family:'Bebas Neue',sans-serif;font-size:1.6rem;
          color:rgba(255,255,255,0.4);margin-left:0.35rem;
        }

        /* ── Stats ── */
        .stat-accent-bar{height:2px;width:100%;position:absolute;top:0;left:0;right:0;}
        /* ↑↑ BOOSTED: stat label */
        .stat-label{
          font-size:0.75rem;font-weight:700;letter-spacing:0.14em;
          text-transform:uppercase;color:rgba(255,255,255,0.5);
          margin-bottom:0.75rem;
        }
        .stat-number{
          font-family:'Bebas Neue',sans-serif;
          font-size:clamp(3.5rem,5vw,6rem);
          line-height:1;color:#fff;letter-spacing:-0.01em;
        }
        /* ↑↑ BOOSTED: stat sub */
        .stat-sub{font-size:0.8rem;font-weight:500;color:rgba(255,255,255,0.4);margin-top:0.35rem;}
        .stat-watermark{
          position:absolute;right:1rem;bottom:-0.5rem;
          font-family:'Bebas Neue',sans-serif;font-size:7rem;line-height:1;
          color:rgba(255,255,255,0.025);pointer-events:none;user-select:none;
        }

        /* ── Progress ring ── */
        .prog-ring-wrap{display:flex;align-items:center;gap:1.4rem;}
        /* ↑↑ BOOSTED: ring label & desc */
        .prog-ring-pct{font-family:'Bebas Neue',sans-serif;font-size:3rem;line-height:1;color:#fff;}
        .prog-ring-desc{font-size:0.85rem;font-weight:500;color:rgba(255,255,255,0.45);margin-top:0.3rem;line-height:1.55;}

        /* ── Panel header ── */
        /* ↑↑ BOOSTED: panel headers */
        .panel-hdr{
          font-size:0.72rem;font-weight:800;letter-spacing:0.18em;
          text-transform:uppercase;color:rgba(255,255,255,0.4);
          margin-bottom:1.1rem;display:flex;align-items:center;justify-content:space-between;
        }

        /* ── Quick Actions ── */
        .actions-grid{display:grid;grid-template-columns:1fr 1fr;gap:0.65rem;margin-top:0.5rem;}
        .action-tile{
          padding:1.1rem;border-radius:10px;
          background:rgba(255,255,255,0.035);
          border:1px solid rgba(255,255,255,0.09);
          text-decoration:none;display:block;
          transition:background 0.2s,border-color 0.2s,transform 0.2s;cursor:pointer;
        }
        .action-tile:hover{background:rgba(255,255,255,0.07);border-color:rgba(255,255,255,0.2);transform:translateY(-2px);}
        .action-tile-icon{font-size:1.4rem;margin-bottom:0.5rem;}
        /* ↑↑ BOOSTED: action tile text */
        .action-tile-name{font-size:0.92rem;font-weight:700;color:#ffffff;letter-spacing:-0.01em;}
        .action-tile-desc{font-size:0.78rem;font-weight:500;color:rgba(255,255,255,0.45);margin-top:0.2rem;}
        .action-tile-badge{
          display:inline-block;margin-top:0.5rem;
          font-size:0.65rem;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;
          padding:0.22rem 0.55rem;border-radius:100px;
          background:rgba(255,255,255,0.09);border:1px solid rgba(255,255,255,0.14);
          color:rgba(255,255,255,0.6);
        }

        /* ── Profile ── */
        .profile-header{display:flex;align-items:center;gap:0.9rem;margin-bottom:1.1rem;}
        .profile-avatar{
          width:48px;height:48px;border-radius:12px;
          background:rgba(255,255,255,0.09);border:1px solid rgba(255,255,255,0.18);
          display:flex;align-items:center;justify-content:center;
          font-family:'Bebas Neue',sans-serif;font-size:1.6rem;color:#fff;flex-shrink:0;
        }
        /* ↑↑ BOOSTED: profile name & email */
        .profile-name{font-size:1rem;font-weight:700;color:#ffffff;letter-spacing:-0.01em;}
        .profile-email{font-size:0.8rem;font-weight:400;color:rgba(255,255,255,0.42);margin-top:0.12rem;}
        .profile-fields{display:grid;grid-template-columns:1fr 1fr;gap:0.55rem;}
        .pf-cell{
          background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.08);
          border-radius:8px;padding:0.7rem 0.85rem;
        }
        /* ↑↑ BOOSTED: profile field label & value */
        .pf-label{font-size:0.68rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.38);margin-bottom:0.25rem;}
        .pf-val{font-size:0.88rem;font-weight:600;color:rgba(255,255,255,0.82);}

        /* ── Stages ── */
        .stage-row{
          display:flex;align-items:flex-start;gap:0.8rem;
          padding:0.75rem 0;border-bottom:1px solid rgba(255,255,255,0.07);
        }
        .stage-row:last-child{border-bottom:none;}
        .stage-icon{
          width:32px;height:32px;border-radius:8px;
          background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.11);
          display:flex;align-items:center;justify-content:center;font-size:0.9rem;
          flex-shrink:0;margin-top:0.05rem;
        }
        /* ↑↑ BOOSTED: stage title & desc */
        .stage-title{font-size:0.88rem;font-weight:700;color:rgba(255,255,255,0.85);}
        .stage-desc{font-size:0.78rem;font-weight:400;color:rgba(255,255,255,0.42);margin-top:0.15rem;line-height:1.5;}

        /* ── Submissions wrap ── */
        .submissions-wrap{padding:1.5rem;}

        ::-webkit-scrollbar{width:2px;}
        ::-webkit-scrollbar-track{background:#050505;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);}
        @keyframes spin{to{transform:rotate(360deg);}}

        @media(max-width:1100px){
          .cell-greeting,.cell-clock{grid-column:span 12;}
          .cell-stat-total,.cell-stat-eval,.cell-stat-pend{grid-column:span 4;}
          .cell-progress,.cell-submissions{grid-column:span 12;}
          .cell-actions,.cell-profile,.cell-stages{grid-column:span 12;}
        }
        @media(max-width:768px){
          #sidebar{display:none;}
          #bento{padding:1rem;gap:0.75rem;}
          .cell-stat-total,.cell-stat-eval,.cell-stat-pend,.cell-greeting{grid-column:span 12;}
        }
      `}</style>

      <DashCursor />
      <canvas ref={canvasRef} id="dbc" />

      <div id="shell">

        {/* ═══ SIDEBAR ═══ */}
        <aside id="sidebar" className={sideCollapsed ? 'collapsed' : ''}>
          <div className="sb-top">
            <Link href="/" className="sb-logo">
              <div className="sb-logo-mark">🎓</div>
              {!sideCollapsed && <span className="sb-logo-text">EvalChain</span>}
            </Link>
            <button className="sb-collapse-btn" onClick={() => setSideCollapsed(p => !p)}>
              {sideCollapsed ? '→' : '←'}
            </button>
          </div>

          <div className="sb-user">
            <div style={{ display:'flex', alignItems:'center', gap:'0.7rem' }}>
              <div className="sb-avatar">{user?.name?.charAt(0).toUpperCase()}</div>
              {!sideCollapsed && (
                <div style={{ overflow:'hidden' }}>
                  <div className="sb-user-name">{user?.name}</div>
                  <div className="sb-user-id">{user?.userId}</div>
                </div>
              )}
            </div>
          </div>

          <nav className="sb-nav">
            {navItems.map(item => {
              const el = (
                <div key={item.id}
                  className={`sb-nav-item${activeNav === item.id ? ' active' : ''}`}
                  onClick={() => setActiveNav(item.id)}
                  title={sideCollapsed ? item.label : undefined}
                >
                  <span className="sb-nav-icon">{item.icon}</span>
                  {!sideCollapsed && item.label}
                </div>
              );
              return item.href
                ? <Link key={item.id} href={item.href} style={{ textDecoration:'none' }}>{el}</Link>
                : el;
            })}
          </nav>

          <div className="sb-footer">
            <button className="sb-logout-btn" onClick={handleLogout}>
              <span style={{ fontSize:'1rem' }}>⊗</span>
              {!sideCollapsed && 'Sign out'}
            </button>
          </div>
        </aside>

        {/* ═══ MAIN ═══ */}
        <div id="main">

          <div id="topbar">
            <div className="topbar-breadcrumb">
              EvalChain <span>/</span> Dashboard
            </div>
            <div className="topbar-right">
              <div className="topbar-date">
                {new Date().toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' })}
              </div>
              <Link href="/upload" className="topbar-upload-btn">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M16 8l-4-4-4 4M12 4v12"/>
                </svg>
                Upload Sheet
              </Link>
            </div>
          </div>

          {/* ═══ BENTO ═══ */}
          <div id="bento">

            {/* Greeting */}
            <div className="bento-cell cell-greeting">
              <div className="greeting-eyebrow">
                <span className="greeting-dot" />
                Good {greeting()}
              </div>
              <div className="greeting-name">
                <span style={{ display:'block', color:'#fff' }}>WELCOME,</span>
                <span className="greeting-outline">{user?.name?.toUpperCase()}</span>
              </div>
              <div className="greeting-meta">
                <span className="greeting-meta-chip">👨‍🎓 Student</span>
                {user?.department && <span className="greeting-meta-chip">{user.department}</span>}
                {user?.year       && <span className="greeting-meta-chip">Year {user.year}</span>}
                {user?.division   && <span className="greeting-meta-chip">Div {user.division}</span>}
              </div>
              <div style={{
                position:'absolute', right:'1.5rem', bottom:'0.5rem',
                fontFamily:"'Bebas Neue', sans-serif", fontSize:'7rem', lineHeight:1,
                color:'rgba(255,255,255,0.02)', userSelect:'none', pointerEvents:'none',
              }}>EVAL</div>
            </div>

            {/* Clock */}
            <div className="bento-cell cell-clock">
              <LiveClock />
            </div>

            {/* Stats */}
            {[
              { val: stats?.totalSubmissions    || 0, label:'Submissions', sub:'Total all time',    accent:'rgba(255,255,255,0.35)' },
              { val: stats?.evaluatedSubmissions || 0, label:'Evaluated',  sub:'Results available', accent:'rgba(34,197,94,0.7)'   },
              { val: stats?.pendingResults       || 0, label:'Pending',    sub:'Under evaluation',  accent:'rgba(251,191,36,0.7)'  },
            ].map((s, i) => (
              <div key={i} className={`bento-cell cell-stat-${['total','eval','pend'][i]}`}>
                <div className="stat-accent-bar" style={{ background: s.accent }} />
                <div className="stat-label">{s.label}</div>
                <div className="stat-number">{s.val}</div>
                <div className="stat-sub">{s.sub}</div>
                <div className="stat-watermark">{s.val}</div>
              </div>
            ))}

            {/* Progress ring */}
            <div className="bento-cell cell-progress">
              <div className="panel-hdr">Evaluation Rate</div>
              <div className="prog-ring-wrap">
                <ProgressRing pct={evalRate} />
                <div>
                  <div className="prog-ring-pct">{evalRate}%</div>
                  <div className="prog-ring-desc">
                    {stats?.evaluatedSubmissions || 0} of {stats?.totalSubmissions || 0} evaluated
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Submissions */}
            <div className="bento-cell cell-submissions">
              <div className="submissions-wrap">
                <div className="panel-hdr">
                  Recent Submissions
                  <span style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.35)', fontWeight:500, letterSpacing:0, textTransform:'none' }}>
                    Click any row for live progress
                  </span>
                </div>
                <RecentSubmissions />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bento-cell cell-actions">
              <div className="panel-hdr">Quick Actions</div>
              <div className="actions-grid">
                {[
                  { href:'/upload',     icon:'📤', name:'Upload',     desc:'Submit sheet' },
                  { href:'/results',    icon:'📊', name:'Results',    desc:'View marks',
                    badge: stats?.evaluatedSubmissions ? `${stats.evaluatedSubmissions} ready` : undefined },
                  { href:'/grievances', icon:'📝', name:'Grievances', desc:'Re-evaluation' },
                  { href:'/profile',    icon:'👤', name:'Profile',    desc:'Your details' },
                ].map(a => (
                  <Link key={a.href} href={a.href} className="action-tile">
                    <div className="action-tile-icon">{a.icon}</div>
                    <div className="action-tile-name">{a.name}</div>
                    <div className="action-tile-desc">{a.desc}</div>
                    {a.badge && <div className="action-tile-badge">{a.badge}</div>}
                  </Link>
                ))}
              </div>
            </div>

            {/* Profile */}
            <div className="bento-cell cell-profile">
              <div className="panel-hdr">Your Profile</div>
              <div className="profile-header">
                <div className="profile-avatar">{user?.name?.charAt(0).toUpperCase()}</div>
                <div>
                  <div className="profile-name">{user?.name}</div>
                  <div className="profile-email">{user?.email}</div>
                </div>
              </div>
              <div className="profile-fields">
                {[
                  { label:'Student ID', val: user?.userId },
                  { label:'Department', val: user?.department },
                  { label:'Year',       val: user?.year ? `Year ${user.year}` : '—' },
                  { label:'Division',   val: user?.division || '—' },
                ].map(f => (
                  <div key={f.label} className="pf-cell">
                    <div className="pf-label">{f.label}</div>
                    <div className="pf-val">{f.val || '—'}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stages */}
            <div className="bento-cell cell-stages">
              <div className="panel-hdr">How It Works</div>
              {[
                { icon:'📤', title:'Submitted',  desc:'Sheet uploaded & hashed on-chain' },
                { icon:'👤', title:'Assigned',   desc:'Anonymous evaluator assigned' },
                { icon:'🔄', title:'Evaluating', desc:'Questions marked live' },
                { icon:'✅', title:'Completed',  desc:'Result available, hash sealed' },
              ].map(s => (
                <div key={s.title} className="stage-row">
                  <div className="stage-icon">{s.icon}</div>
                  <div>
                    <div className="stage-title">{s.title}</div>
                    <div className="stage-desc">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Live Clock ─── */
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const hh   = time.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
  const ampm = time.getHours() >= 12 ? 'PM' : 'AM';
  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
      <div style={{ fontSize:'0.75rem', fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase', color:'rgba(255,255,255,0.4)', marginBottom:'0.5rem' }}>
        LOCAL TIME
      </div>
      <div>
        <div className="clock-time">
          {hh}<span className="clock-ampm">{ampm}</span>
        </div>
        <div className="clock-date">
          {time.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
        </div>
      </div>
      <div style={{ display:'flex', gap:'0.5rem', marginTop:'1rem', flexWrap:'wrap' }}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => (
          <div key={d} style={{
            fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.04em',
            color: i === time.getDay() ? '#fff' : 'rgba(255,255,255,0.3)',
            padding:'0.22rem 0.5rem',
            background: i === time.getDay() ? 'rgba(255,255,255,0.1)' : 'transparent',
            border:`1px solid ${i === time.getDay() ? 'rgba(255,255,255,0.2)' : 'transparent'}`,
            borderRadius:5,
          }}>{d}</div>
        ))}
      </div>
    </div>
  );
}

/* ─── Progress Ring ─── */
function ProgressRing({ pct }: { pct: number }) {
  const r = 30, c = 2 * Math.PI * r;
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" style={{ flexShrink:0 }}>
      <circle cx="38" cy="38" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5"/>
      <circle cx="38" cy="38" r={r} fill="none"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth="5" strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (pct / 100) * c}
        transform="rotate(-90 38 38)"
        style={{ transition:'stroke-dashoffset 1s ease' }}
      />
    </svg>
  );
}

/* ─── Cursor ─── */
function DashCursor() {
  const dotRef  = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let dx = window.innerWidth/2, dy = window.innerHeight/2, rx = dx, ry = dy;
    let raf: number;
    const onMove = (e: MouseEvent) => { dx = e.clientX; dy = e.clientY; };
    window.addEventListener('mousemove', onMove);
    const loop = () => {
      if (dotRef.current)  { dotRef.current.style.left  = dx+'px'; dotRef.current.style.top  = dy+'px'; }
      rx += (dx-rx)*0.11; ry += (dy-ry)*0.11;
      if (ringRef.current) { ringRef.current.style.left = rx+'px'; ringRef.current.style.top = ry+'px'; }
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
