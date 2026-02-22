// app/(auth)/login/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { GraduationCap, UserCog, Shield, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [formData, setFormData] = useState({ userId: '', password: '' });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    /* ─── CANVAS GRID ─── */
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        let W = (canvas.width = window.innerWidth);
        let H = (canvas.height = window.innerHeight);
        let mx = W / 2, my = H / 2, tmx = mx, tmy = my;
        const CELL = 52, RADIUS = 200, STRENGTH = 36;

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
                    const dx = x - mx, dy = y - my;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const inf = Math.max(0, 1 - dist / RADIUS);
                    const ease = inf * inf * (3 - 2 * inf);
                    const angle = Math.atan2(dy, dx);
                    const push = ease * STRENGTH;
                    const px = x + Math.cos(angle) * push, py = y + Math.sin(angle) * push;
                    y === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                }
                ctx.strokeStyle = 'rgba(255,255,255,0.13)';
                ctx.lineWidth = 0.7;
                ctx.stroke();
            }
            for (let y = 0; y <= H + CELL; y += CELL) {
                ctx.beginPath();
                for (let x = 0; x <= W; x += 3) {
                    const dx = x - mx, dy = y - my;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const inf = Math.max(0, 1 - dist / RADIUS);
                    const ease = inf * inf * (3 - 2 * inf);
                    const angle = Math.atan2(dy, dx);
                    const push = ease * STRENGTH;
                    const px = x + Math.cos(angle) * push, py = y + Math.sin(angle) * push;
                    x === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                }
                ctx.strokeStyle = 'rgba(255,255,255,0.13)';
                ctx.lineWidth = 0.7;
                ctx.stroke();
            }

            // Bright cursor glow
            const grad = ctx.createRadialGradient(mx, my, 0, mx, my, RADIUS);
            grad.addColorStop(0, 'rgba(255,255,255,0.12)');
            grad.addColorStop(0.4, 'rgba(255,255,255,0.04)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(mx, my, RADIUS, 0, Math.PI * 2); ctx.fill();

            raf = requestAnimationFrame(draw);
        };
        draw();

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', onResize);
            window.removeEventListener('mousemove', onMove);
        };
    }, []);

    /* ─── GSAP ENTRANCE ─── */
    useEffect(() => {
        const init = async () => {
            const gsapMod = await import('gsap');
            const gsap = gsapMod.gsap ?? (gsapMod as any).default;

            gsap.set(['#login-eyebrow', '#login-title', '#login-sub', '#login-card', '#back-link', '#creds-box'], {
                opacity: 0, y: 32,
            });

            const tl = gsap.timeline({ delay: 0.1, defaults: { ease: 'power3.out' } });
            tl
                .to('#login-eyebrow', { opacity: 1, y: 0, duration: 0.7 })
                .to('#login-title', { opacity: 1, y: 0, duration: 0.85 }, '-=0.4')
                .to('#login-sub', { opacity: 1, y: 0, duration: 0.7 }, '-=0.45')
                .to('#login-card', { opacity: 1, y: 0, duration: 0.9 }, '-=0.4')
                .to('#back-link', { opacity: 1, y: 0, duration: 0.6 }, '-=0.3')
                .to('#creds-box', { opacity: 1, y: 0, duration: 0.6 }, '-=0.3');
        };
        init();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(''); setSuccess(''); setLoading(true);
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(formData),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Login failed');

            // ── Role-based redirect ──
            const roleRoutes: Record<string, string> = {
                admin: '/audit-dashboard',
                teacher: '/dashboard',
                student: '/dashboard',
            };
            const role = data.data.user.role as string;
            const destination = roleRoutes[role] ?? '/dashboard';

            setSuccess(`Signed in as ${role}. Redirecting…`);
            setTimeout(() => { window.location.href = destination; }, 1000);

        } catch (err: any) {
            setError(err.message || 'An error occurred during login');
            setLoading(false);
        }
    };


    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&family=Bebas+Neue&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { background: #050505 !important; color-scheme: dark; }
        body {
          background: #050505 !important;
          color: #f0f0f0 !important;
          font-family: 'Inter', system-ui, sans-serif;
          overflow-x: hidden;
          cursor: none !important;
          min-height: 100vh;
        }
        #__next, main { background: #050505 !important; }

        /* ── Cursor ── */
        .c-dot {
          position: fixed; width: 8px; height: 8px;
          background: #fff; border-radius: 50%;
          pointer-events: none; z-index: 99999;
          transform: translate(-50%,-50%);
          mix-blend-mode: difference;
          box-shadow: 0 0 10px rgba(255,255,255,0.8);
        }
        .c-ring {
          position: fixed; width: 36px; height: 36px;
          border: 1.5px solid rgba(255,255,255,0.7);
          border-radius: 50%;
          pointer-events: none; z-index: 99998;
          transform: translate(-50%,-50%);
          mix-blend-mode: difference;
        }

        /* ── Canvas ── */
        #lgc { position: fixed; inset: 0; z-index: 0; pointer-events: none; }

        /* ── Page Root ── */
        #login-root {
          min-height: 100vh;
          background: #050505;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 5rem 1.5rem 3rem;
          position: relative; z-index: 1;
          /* Soft radial glow from center-top */
          background-image: radial-gradient(ellipse 70% 55% at 50% 0%, rgba(255,255,255,0.04) 0%, transparent 70%);
        }

        /* ── Navbar ── */
        #login-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 1.1rem 2.5rem;
          background: rgba(5,5,5,0.9);
          border-bottom: 1px solid rgba(255,255,255,0.1);
          backdrop-filter: blur(20px);
        }
        .ln-logo {
          display: flex; align-items: center; gap: 0.55rem;
          font-weight: 700; font-size: 0.92rem;
          letter-spacing: 0.04em; color: #f0f0f0;
          text-decoration: none;
        }
        .ln-logo-mark {
          width: 30px; height: 30px; border-radius: 7px;
          background: #f0f0f0;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.8rem; color: #000; font-weight: 900;
          box-shadow: 0 0 14px rgba(255,255,255,0.25);
        }
        .nav-secure {
          font-size: 0.72rem; font-weight: 700;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: rgba(255,255,255,0.35);
          display: flex; align-items: center; gap: 0.5rem;
        }
        .nav-secure::before {
          content: '';
          width: 6px; height: 6px; border-radius: 50%;
          background: rgba(255,255,255,0.4);
          display: inline-block;
        }

        /* ── Content wrapper ── */
        .login-inner {
          width: 100%; max-width: 430px;
          display: flex; flex-direction: column; align-items: center;
        }

        /* ── Eyebrow ── */
        #login-eyebrow {
          font-size: 0.7rem; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: rgba(255,255,255,0.45);
          margin-bottom: 1.1rem;
          display: flex; align-items: center; gap: 0.6rem;
        }
        .eyebrow-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #fff;
          box-shadow: 0 0 8px rgba(255,255,255,0.9);
          animation: blink 2s ease infinite;
        }
        @keyframes blink {
          0%,100% { opacity: 1; box-shadow: 0 0 8px rgba(255,255,255,0.9); }
          50% { opacity: 0.25; box-shadow: none; }
        }

        /* ── Title ── */
        #login-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(4rem, 11vw, 6.5rem);
          line-height: 0.88; letter-spacing: -0.01em;
          color: #fff;
          text-align: center;
          margin-bottom: 1rem;
          text-shadow: 0 0 60px rgba(255,255,255,0.15), 0 0 120px rgba(255,255,255,0.06);
        }
        .lt-solid  { display: block; color: #ffffff; }
        .lt-outline {
          display: block;
          -webkit-text-stroke: 2px rgba(255,255,255,0.65);
          color: transparent;
          text-shadow: none;
          filter: drop-shadow(0 0 12px rgba(255,255,255,0.25));
        }

        /* ── Sub text ── */
        #login-sub {
          font-size: 0.9rem; color: rgba(255,255,255,0.5);
          text-align: center; line-height: 1.72;
          font-weight: 300; margin-bottom: 2.25rem;
          max-width: 340px;
        }

        /* ── Card ── */
        #login-card {
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 18px;
          padding: 2.25rem;
          backdrop-filter: blur(20px);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.04),
            0 8px 40px rgba(0,0,0,0.5),
            inset 0 1px 0 rgba(255,255,255,0.1);
        }

        /* ── Alerts ── */
        .alert {
          display: flex; align-items: flex-start; gap: 0.7rem;
          padding: 0.9rem 1rem; border-radius: 10px;
          font-size: 0.83rem; line-height: 1.6;
          margin-bottom: 1.5rem; font-weight: 500;
        }
        .alert-error {
          background: rgba(255,60,60,0.08);
          border: 1px solid rgba(255,80,80,0.25);
          color: #ff7070;
        }
        .alert-success {
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.25);
          color: #4ade80;
        }

        /* ── Form labels ── */
        .form-label {
          display: block;
          font-size: 0.72rem; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: rgba(255,255,255,0.5);
          margin-bottom: 0.5rem;
        }

        /* ── Inputs ── */
        .form-input {
          width: 100%;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 10px;
          padding: 0.85rem 1rem;
          font-size: 0.9rem; font-weight: 400;
          color: #ffffff;
          font-family: 'Inter', system-ui, sans-serif;
          outline: none;
          transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
          caret-color: #fff;
        }
        .form-input::placeholder { color: rgba(255,255,255,0.22); }
        .form-input:focus {
          border-color: rgba(255,255,255,0.4);
          background: rgba(255,255,255,0.09);
          box-shadow: 0 0 0 3px rgba(255,255,255,0.06), 0 0 20px rgba(255,255,255,0.04);
        }
        .form-input:disabled { opacity: 0.4; cursor: not-allowed; }

        .form-group { margin-bottom: 1.1rem; }

        /* ── Submit button ── */
        .submit-btn {
          width: 100%; margin-top: 1.5rem;
          padding: 0.95rem 1rem;
          background: #ffffff; color: #000;
          font-weight: 800; font-size: 0.92rem;
          letter-spacing: 0.03em;
          border: none; border-radius: 10px; cursor: pointer;
          font-family: 'Inter', system-ui, sans-serif;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          box-shadow: 0 0 24px rgba(255,255,255,0.2), 0 4px 16px rgba(0,0,0,0.3);
        }
        .submit-btn:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-2px);
          box-shadow: 0 0 36px rgba(255,255,255,0.3), 0 8px 24px rgba(0,0,0,0.4);
        }
        .submit-btn:active:not(:disabled) { transform: translateY(0); }
        .submit-btn:disabled { opacity: 0.35; cursor: not-allowed; box-shadow: none; }

        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(0,0,0,0.25);
          border-top-color: #000;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        /* ── Card divider ── */
        .card-divider {
          height: 1px;
          background: rgba(255,255,255,0.09);
          margin: 1.75rem 0;
        }

        /* ── Role chips ── */
        .role-chips { display: flex; gap: 0.6rem; }
        .role-chip {
          flex: 1; padding: 0.6rem 0.5rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px; text-align: center;
          transition: border-color 0.2s, background 0.2s;
        }
        .role-chip:hover {
          background: rgba(255,255,255,0.07);
          border-color: rgba(255,255,255,0.22);
        }
        .role-chip-icon { font-size: 1.1rem; margin-bottom: 0.25rem; }
        .role-chip-label {
          font-size: 0.62rem; font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: rgba(255,255,255,0.35);
        }

        /* ── Back link ── */
        #back-link {
          margin-top: 1.4rem;
          font-size: 0.8rem; color: rgba(255,255,255,0.35);
          text-decoration: none;
          display: flex; align-items: center; gap: 0.4rem;
          transition: color 0.2s ease;
        }
        #back-link:hover { color: rgba(255,255,255,0.75); }

        /* ── Creds box ── */
        #creds-box {
          width: 100%; margin-top: 1rem;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px; padding: 1rem 1.2rem;
        }
        .creds-title {
          font-size: 0.64rem; font-weight: 700;
          letter-spacing: 0.16em; text-transform: uppercase;
          color: rgba(255,255,255,0.22);
          margin-bottom: 0.65rem;
        }
        .creds-row {
          display: flex; align-items: center;
          justify-content: space-between;
          padding: 0.45rem 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .creds-row:last-child { border-bottom: none; padding-bottom: 0; }
        .creds-role {
          font-size: 0.7rem; font-weight: 700;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: rgba(255,255,255,0.3);
        }
        .creds-val {
          font-size: 0.77rem;
          font-family: 'SF Mono', 'Fira Code', monospace;
          color: rgba(255,255,255,0.55);
          background: rgba(255,255,255,0.06);
          padding: 0.18rem 0.55rem; border-radius: 5px;
          border: 1px solid rgba(255,255,255,0.1);
        }

        /* ── Scrollbar ── */
        ::-webkit-scrollbar { width: 2px; }
        ::-webkit-scrollbar-track { background: #050505; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); }

        @media (max-width: 600px) {
          #login-title { font-size: clamp(3.2rem, 16vw, 5rem); }
          #login-nav { padding: 1rem 1.25rem; }
          #login-root { padding: 5rem 1rem 2.5rem; }
        }
      `}</style>

            <LoginCursor />
            <canvas ref={canvasRef} id="lgc" />

            {/* ─── Navbar ─── */}
            <nav id="login-nav">
                <Link href="/" className="ln-logo">
                    <div className="ln-logo-mark"><GraduationCap size={18} /></div>
                    GRADEX
                </Link>
                <span className="nav-secure">Secure Login</span>
            </nav>

            {/* ─── Page ─── */}
            <div id="login-root">
                <div className="login-inner">

                    {/* Eyebrow */}
                    <div id="login-eyebrow">
                        <span className="eyebrow-dot" />
                        Authentication Portal
                    </div>

                    {/* Headline */}
                    <div id="login-title">
                        <span className="lt-solid">WELCOME</span>
                        <span className="lt-outline">BACK</span>
                    </div>

                    <p id="login-sub">
                        Sign in to access your evaluation dashboard.
                        Your session is secured and encrypted.
                    </p>

                    {/* ─── Card ─── */}
                    <div id="login-card">

                        {error && (
                            <div className="alert alert-error">
                                <span><AlertTriangle size={18} /></span>
                                <span>{error}</span>
                            </div>
                        )}
                        {success && (
                            <div className="alert alert-success">
                                <span>✓</span>
                                <span>{success}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label htmlFor="userId" className="form-label">User ID</label>
                                <input
                                    id="userId" name="userId" type="text" required
                                    autoComplete="username"
                                    className="form-input"
                                    placeholder="ST2026001 or TCH2026001"
                                    value={formData.userId}
                                    onChange={handleChange}
                                    disabled={loading}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label htmlFor="password" className="form-label">Password</label>
                                <input
                                    id="password" name="password" type="password" required
                                    autoComplete="current-password"
                                    className="form-input"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={handleChange}
                                    disabled={loading}
                                />
                            </div>

                            <button type="submit" className="submit-btn" disabled={loading}>
                                {loading
                                    ? <><span className="spinner" /> Signing in…</>
                                    : <>Sign In →</>
                                }
                            </button>
                        </form>

                        <div className="card-divider" />

                        {/* Role chips */}
                        <div className="role-chips">
                            {[{ icon: <GraduationCap size={18} />, role: 'Student' }, { icon: <UserCog size={18} />, role: 'Teacher' }, { icon: <Shield size={18} />, role: 'Admin' }].map(({ icon, role }) => (
                                <div key={role} className="role-chip">
                                    <div className="role-chip-icon">{icon}</div>
                                    <div className="role-chip-label">{role}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Back */}
                    <Link href="/" id="back-link">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M8 2L4 6L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Back to Home
                    </Link>

                    {/* Creds */}
                    <div id="creds-box">
                        <div className="creds-title">Test Credentials</div>
                        {[
                            { role: 'Student', val: 'ST2026001 / password123' },
                            { role: 'Teacher', val: 'TCH2026001 / password123' },
                        ].map(c => (
                            <div key={c.role} className="creds-row">
                                <span className="creds-role">{c.role}</span>
                                <span className="creds-val">{c.val}</span>
                            </div>
                        ))}
                    </div>

                </div>
            </div>
        </>
    );
}

/* ─── Cursor ─── */
function LoginCursor() {
    const dotRef = useRef<HTMLDivElement>(null);
    const ringRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        let dx = window.innerWidth / 2, dy = window.innerHeight / 2;
        let rx = dx, ry = dy;
        let raf: number;
        const onMove = (e: MouseEvent) => { dx = e.clientX; dy = e.clientY; };
        window.addEventListener('mousemove', onMove);
        const loop = () => {
            if (dotRef.current) { dotRef.current.style.left = dx + 'px'; dotRef.current.style.top = dy + 'px'; }
            rx += (dx - rx) * 0.11; ry += (dy - ry) * 0.11;
            if (ringRef.current) { ringRef.current.style.left = rx + 'px'; ringRef.current.style.top = ry + 'px'; }
            raf = requestAnimationFrame(loop);
        };
        loop();
        return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf); };
    }, []);
    return (
        <>
            <div ref={dotRef} className="c-dot" />
            <div ref={ringRef} className="c-ring" />
        </>
    );
}
