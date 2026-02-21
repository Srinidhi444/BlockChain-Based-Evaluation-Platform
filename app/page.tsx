'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* ─── CANVAS GRID DISTORTION ─── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    let W = (canvas.width = window.innerWidth);
    let H = (canvas.height = window.innerHeight);
    let mx = W / 2, my = H / 2;
    let tmx = mx, tmy = my;
    const CELL = 52, RADIUS = 180, STRENGTH = 32;

    const onResize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    const onMove = (e: MouseEvent) => { tmx = e.clientX; tmy = e.clientY; };
    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMove);

    let raf: number;
    const draw = () => {
      mx += (tmx - mx) * 0.07;
      my += (tmy - my) * 0.07;
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
          const px = x + Math.cos(angle) * push;
          const py = y + Math.sin(angle) * push;
          y === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 0.6;
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
          const px = x + Math.cos(angle) * push;
          const py = y + Math.sin(angle) * push;
          x === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }

      const grad = ctx.createRadialGradient(mx, my, 0, mx, my, RADIUS);
      grad.addColorStop(0, 'rgba(255,255,255,0.06)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(mx, my, RADIUS, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  /* ─── GSAP SCROLL ANIMATIONS ─── */
  useEffect(() => {
    let ScrollTrigger: any;
    let lenis: any;

    const init = async () => {
      const gsapMod = await import('gsap');
      const ST = await import('gsap/ScrollTrigger');
      const LenisLib = (await import('lenis')).default;

      const gsap = gsapMod.gsap ?? (gsapMod as any).default;
      ScrollTrigger = ST.ScrollTrigger;
      gsap.registerPlugin(ScrollTrigger);

      // Lenis smooth scroll
      lenis = new LenisLib({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9 });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t: number) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);

      // ── Navbar scroll detection
      ScrollTrigger.create({
        start: 'top -60px',
        end: 'max',
        onUpdate(self: any) {
          const nav = document.getElementById('nav');
          if (!nav) return;
          nav.style.background = self.scroller.scrollTop > 60
            ? 'rgba(5,5,5,0.95)'
            : 'transparent';
          nav.style.borderBottom = self.scroller.scrollTop > 60
            ? '1px solid rgba(255,255,255,0.07)'
            : '1px solid transparent';
          nav.style.backdropFilter = self.scroller.scrollTop > 60 ? 'blur(20px)' : 'none';
        },
      });

      // ── Hero entrance (no scrub — just on load)
      gsap.set('#hero-badge', { opacity: 0, y: 30 });
      gsap.set('.hl', { y: '105%' });
      gsap.set('#hero-sub', { opacity: 0, y: 24 });
      gsap.set('#hero-ctas', { opacity: 0, y: 20 });
      gsap.set('#hero-stats', { opacity: 0, y: 30 });

      const htl = gsap.timeline({ delay: 0.2 });
      htl
        .to('#hero-badge', { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' })
        .to('.hl', { y: '0%', duration: 1, stagger: 0.1, ease: 'power4.out' }, '-=0.4')
        .to('#hero-sub', { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }, '-=0.5')
        .to('#hero-ctas', { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, '-=0.5')
        .to('#hero-stats', { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, '-=0.4');

      // ─── Scroll-fill text effect (the "fill up on scroll" for big section titles)
      // Uses a clip-path overlay: ghost text (dim) + filled text (bright) clipped by scroll progress
      document.querySelectorAll('.fill-text-wrap').forEach((wrap) => {
        const filled = wrap.querySelector('.fill-text-filled') as HTMLElement;
        if (!filled) return;
        gsap.fromTo(
          filled,
          { clipPath: 'inset(100% 0% 0% 0%)' },
          {
            clipPath: 'inset(0% 0% 0% 0%)',
            ease: 'none',
            scrollTrigger: {
              trigger: wrap,
              start: 'top 85%',
              end: 'top 20%',
              scrub: 1.2,
              toggleActions: 'play reverse play reverse',
            },
          }
        );
      });

      // ── Section label reveals
      gsap.utils.toArray('.sec-label').forEach((el: any) => {
        gsap.fromTo(el,
          { opacity: 0, letterSpacing: '0.4em' },
          {
            opacity: 1, letterSpacing: '0.2em',
            ease: 'none',
            scrollTrigger: {
              trigger: el,
              start: 'top 88%',
              end: 'top 60%',
              scrub: 1,
              toggleActions: 'play reverse play reverse',
            },
          }
        );
      });

      // ── Services cards — scrub from below
      gsap.fromTo('.service-card',
        { opacity: 0, y: 90, scale: 0.93 },
        {
          opacity: 1, y: 0, scale: 1,
          stagger: { each: 0.12, from: 'start' },
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '#services',
            start: 'top 65%',
            end: 'top 5%',
            scrub: 1.4,
            toggleActions: 'play reverse play reverse',
          },
        }
      );

      // ── Feature cards — alternating x direction scrub
      gsap.utils.toArray('.feature-card').forEach((card: any, i: number) => {
        gsap.fromTo(card,
          { opacity: 0, x: i % 2 === 0 ? -50 : 50, rotateY: i % 2 === 0 ? 8 : -8 },
          {
            opacity: 1, x: 0, rotateY: 0,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 82%',
              end: 'top 38%',
              scrub: 1,
              toggleActions: 'play reverse play reverse',
            },
          }
        );
      });

      // ── Importance — left/right scrub
      gsap.fromTo('#imp-left',
        { opacity: 0, x: -80 },
        {
          opacity: 1, x: 0,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '#importance',
            start: 'top 70%',
            end: 'top 15%',
            scrub: 1.6,
            toggleActions: 'play reverse play reverse',
          },
        }
      );
      gsap.fromTo('#imp-right',
        { opacity: 0, x: 80, scale: 0.92 },
        {
          opacity: 1, x: 0, scale: 1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '#importance',
            start: 'top 70%',
            end: 'top 15%',
            scrub: 1.6,
            toggleActions: 'play reverse play reverse',
          },
        }
      );
      gsap.utils.toArray('.imp-item').forEach((item: any, i: number) => {
        gsap.fromTo(item,
          { opacity: 0, x: -35 },
          {
            opacity: 1, x: 0,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: item,
              start: 'top 85%',
              end: 'top 55%',
              scrub: 1,
              toggleActions: 'play reverse play reverse',
            },
          }
        );
      });

      // ── Before/After cards
      gsap.fromTo('#before-card',
        { opacity: 0, x: -80, rotate: -1.5 },
        {
          opacity: 1, x: 0, rotate: 0,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '#before-after',
            start: 'top 70%',
            end: 'top 15%',
            scrub: 1.6,
            toggleActions: 'play reverse play reverse',
          },
        }
      );
      gsap.fromTo('#after-card',
        { opacity: 0, x: 80, rotate: 1.5 },
        {
          opacity: 1, x: 0, rotate: 0,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '#before-after',
            start: 'top 70%',
            end: 'top 15%',
            scrub: 1.6,
            toggleActions: 'play reverse play reverse',
          },
        }
      );

      // BA items individual scrub
      gsap.utils.toArray('.ba-before-item').forEach((item: any, i: number) => {
        gsap.fromTo(item,
          { opacity: 0, y: 28 },
          {
            opacity: 1, y: 0,
            scrollTrigger: {
              trigger: item,
              start: 'top 88%',
              end: 'top 60%',
              scrub: 0.9,
              toggleActions: 'play reverse play reverse',
            },
          }
        );
      });
      gsap.utils.toArray('.ba-after-item').forEach((item: any) => {
        gsap.fromTo(item,
          { opacity: 0, y: 28 },
          {
            opacity: 1, y: 0,
            scrollTrigger: {
              trigger: item,
              start: 'top 88%',
              end: 'top 60%',
              scrub: 0.9,
              toggleActions: 'play reverse play reverse',
            },
          }
        );
      });

      // ── Timeline steps
      gsap.utils.toArray('.timeline-step').forEach((step: any, i: number) => {
        gsap.fromTo(step,
          { opacity: 0, y: 60, scale: 0.94 },
          {
            opacity: 1, y: 0, scale: 1,
            scrollTrigger: {
              trigger: step,
              start: 'top 85%',
              end: 'top 45%',
              scrub: 1.1,
              toggleActions: 'play reverse play reverse',
            },
          }
        );
      });

      // ── CTA
      gsap.fromTo('#cta-inner',
        { opacity: 0, y: 70, scale: 0.95 },
        {
          opacity: 1, y: 0, scale: 1,
          scrollTrigger: {
            trigger: '#cta-section',
            start: 'top 70%',
            end: 'top 20%',
            scrub: 1.3,
            toggleActions: 'play reverse play reverse',
          },
        }
      );
    };

    init();

    return () => {
      if (ScrollTrigger) ScrollTrigger.getAll().forEach((t: any) => t.kill());
      if (lenis) lenis.destroy();
    };
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&family=Bebas+Neue&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html {
          background: #050505 !important;
          color-scheme: dark;
        }

        body {
          background: #050505 !important;
          color: #f0f0f0 !important;
          font-family: 'Inter', system-ui, sans-serif;
          overflow-x: hidden;
          cursor: none !important;
        }

        /* Kill any Tailwind light-mode overrides */
        #__next, main, .next-page { background: #050505 !important; }

        /* ── Custom Cursor ── */
        .c-dot {
          position: fixed; width: 7px; height: 7px;
          background: #fff; border-radius: 50%;
          pointer-events: none; z-index: 99999;
          transform: translate(-50%,-50%);
          mix-blend-mode: difference;
        }
        .c-ring {
          position: fixed; width: 34px; height: 34px;
          border: 1px solid rgba(255,255,255,0.55);
          border-radius: 50%;
          pointer-events: none; z-index: 99998;
          transform: translate(-50%,-50%);
          mix-blend-mode: difference;
        }

        /* ── Canvas ── */
        #gc {
          position: fixed; inset: 0;
          z-index: 0; pointer-events: none;
          opacity: 1;
        }

        /* ── Page root — FORCE dark ── */
        #page-root {
          background: #050505;
          color: #f0f0f0;
          min-height: 100vh;
          position: relative;
          z-index: 1;
        }

        /* ── NAVBAR ── */
        #nav {
          position: fixed; top: 0; left: 0; right: 0;
          z-index: 1000;
          display: flex; align-items: center; justify-content: space-between;
          padding: 1.15rem 2.5rem;
          background: transparent;
          border-bottom: 1px solid transparent;
          transition: background 0.4s ease, border-color 0.4s ease, backdrop-filter 0.4s ease;
        }
        .n-logo {
          display: flex; align-items: center; gap: 0.55rem;
          font-weight: 700; font-size: 0.9rem;
          letter-spacing: 0.04em; color: #f0f0f0;
          cursor: pointer; text-decoration: none;
        }
        .n-logo-mark {
          width: 30px; height: 30px; border-radius: 7px;
          background: #f0f0f0;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.82rem; color: #000; font-weight: 900;
        }
        .n-links { display: flex; gap: 0; }
        .n-btn {
          padding: 0.45rem 0.9rem;
          background: none; border: none;
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 0.82rem; font-weight: 500;
          color: rgba(240,240,240,0.5);
          cursor: pointer; border-radius: 6px;
          transition: color 0.2s, background 0.2s;
          letter-spacing: 0.01em;
        }
        .n-btn:hover { color: #f0f0f0; background: rgba(255,255,255,0.06); }
        .n-cta {
          padding: 0.55rem 1.25rem;
          background: #f0f0f0; color: #000;
          font-weight: 700; font-size: 0.82rem;
          border-radius: 8px; text-decoration: none;
          letter-spacing: 0.02em;
          transition: opacity 0.2s;
          white-space: nowrap;
        }
        .n-cta:hover { opacity: 0.82; }

        /* ── SECTION BASE ── */
        section {
          position: relative; z-index: 1;
          background: #050505;
        }

        /* ── Fill-text effect ── */
        /* Ghost (dim) sits behind; filled (bright) is clipped by scroll */
        .fill-text-wrap {
          position: relative;
          display: block;
          line-height: 0.92;
        }
        .fill-text-ghost {
          display: block;
          color: rgba(240,240,240,0.12);
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(3.2rem, 6.5vw, 6.5rem);
          letter-spacing: -0.01em;
          line-height: 0.92;
          white-space: nowrap;
          user-select: none;
        }
        .fill-text-filled {
          position: absolute;
          inset: 0;
          display: block;
          color: #f0f0f0;
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(3.2rem, 6.5vw, 6.5rem);
          letter-spacing: -0.01em;
          line-height: 0.92;
          white-space: nowrap;
          clip-path: inset(100% 0% 0% 0%);
          will-change: clip-path;
        }
        .fill-text-filled.outline {
          -webkit-text-stroke: 1.5px #f0f0f0;
          color: transparent;
        }
        .fill-text-ghost.outline {
          -webkit-text-stroke: 1.5px rgba(240,240,240,0.1);
          color: transparent;
        }

        /* ── Hero ── */
        #hero {
          min-height: 100vh;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 9rem 2rem 5rem;
          text-align: center;
          background: #050505;
        }
        #hero-badge {
          display: inline-flex; align-items: center; gap: 0.5rem;
          padding: 0.4rem 1.1rem;
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 100px;
          font-size: 0.71rem; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: rgba(240,240,240,0.45);
          margin-bottom: 2.5rem;
          background: rgba(255,255,255,0.03);
        }
        .badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #f0f0f0;
          animation: blink 2s ease infinite;
        }
        @keyframes blink {
          0%,100% { opacity: 1; } 50% { opacity: 0.25; }
        }

        /* Hero big type */
        .hero-headline {
          display: flex; flex-direction: column;
          align-items: center;
          margin-bottom: 2rem;
        }
        .hl-wrap {
          overflow: hidden;
          line-height: 0.92;
        }
        .hl {
          display: block;
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(5.5rem, 15vw, 15rem);
          font-weight: 400; letter-spacing: -0.01em;
          line-height: 0.92;
          color: #f0f0f0;
          will-change: transform;
        }
        .hl.outline {
          -webkit-text-stroke: 1.5px rgba(240,240,240,0.35);
          color: transparent;
        }
        #hero-sub {
          max-width: 480px;
          font-size: 1rem; line-height: 1.78;
          color: rgba(240,240,240,0.45);
          font-weight: 300;
          margin: 0 auto;
        }
        #hero-ctas {
          display: flex; gap: 1rem; justify-content: center;
          flex-wrap: wrap; margin-top: 2.25rem;
        }
        .btn-p {
          padding: 0.85rem 2rem;
          background: #f0f0f0; color: #000;
          font-weight: 700; font-size: 0.875rem;
          border-radius: 10px; text-decoration: none;
          border: none; cursor: pointer;
          font-family: 'Inter', system-ui, sans-serif;
          transition: opacity 0.2s;
          letter-spacing: 0.01em;
        }
        .btn-p:hover { opacity: 0.82; }
        .btn-g {
          padding: 0.85rem 2rem;
          background: transparent; color: rgba(240,240,240,0.6);
          font-weight: 500; font-size: 0.875rem;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.14);
          cursor: pointer;
          font-family: 'Inter', system-ui, sans-serif;
          transition: color 0.2s, border-color 0.2s;
        }
        .btn-g:hover { color: #f0f0f0; border-color: rgba(255,255,255,0.3); }

        #hero-stats {
          display: grid; grid-template-columns: repeat(3, 1fr);
          margin-top: 3.5rem;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px; overflow: hidden;
          max-width: 660px; width: 100%;
        }
        .stat-cell {
          padding: 1.5rem; text-align: center;
          border-right: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.02);
        }
        .stat-cell:last-child { border-right: none; }
        .stat-n {
          display: block;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 3rem; line-height: 1; color: #f0f0f0;
        }
        .stat-l {
          font-size: 0.7rem; color: rgba(240,240,240,0.3);
          text-transform: uppercase; letter-spacing: 0.09em;
          margin-top: 0.3rem; display: block;
        }

        /* ── Marquee ── */
        #mq-strip {
          border-top: 1px solid rgba(255,255,255,0.07);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          padding: 1rem 0; overflow: hidden;
          background: rgba(255,255,255,0.015);
          position: relative; z-index: 1;
        }
        @keyframes mq { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .mq-track {
          display: flex; width: max-content;
          animation: mq 26s linear infinite;
        }
        .mq-track:hover { animation-play-state: paused; }
        .mq-item {
          padding: 0 2.5rem;
          font-size: 0.74rem; font-weight: 600;
          letter-spacing: 0.14em; text-transform: uppercase;
          color: rgba(240,240,240,0.2);
          white-space: nowrap;
          display: flex; align-items: center; gap: 2.5rem;
        }
        .mq-item::after { content: '·'; color: rgba(255,255,255,0.12); }

        /* ── Section label ── */
        .sec-label {
          display: block;
          font-size: 0.68rem; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: rgba(240,240,240,0.25);
          margin-bottom: 1.5rem;
        }

        /* ── Container ── */
        .ctr { max-width: 1200px; margin: 0 auto; padding: 0 2.5rem; }

        /* ── SERVICES ── */
        #services {
          padding: 8rem 0;
          border-top: 1px solid rgba(255,255,255,0.07);
          background: #050505;
        }
        .svc-grid {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 1px; background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px; overflow: hidden;
          margin-top: 3.5rem;
        }
        @media (max-width: 900px) { .svc-grid { grid-template-columns: 1fr; } }
        .service-card {
          background: #050505; padding: 2.5rem;
          position: relative; overflow: hidden;
          transition: background 0.3s ease;
          will-change: transform, opacity;
        }
        .service-card:hover { background: #0e0e0e; }
        .sc-top {
          display: flex; align-items: flex-start;
          justify-content: space-between; margin-bottom: 2rem;
        }
        .sc-icon { font-size: 2rem; }
        .sc-badge {
          font-size: 0.62rem; font-weight: 800;
          letter-spacing: 0.16em; text-transform: uppercase;
          color: rgba(240,240,240,0.25);
          border: 1px solid rgba(255,255,255,0.1);
          padding: 0.28rem 0.7rem; border-radius: 100px;
        }
        .service-card h3 {
          font-size: 1.3rem; font-weight: 700;
          color: #f0f0f0; margin-bottom: 0.7rem;
          letter-spacing: -0.02em;
        }
        .service-card p {
          font-size: 0.855rem; line-height: 1.77;
          color: rgba(240,240,240,0.45); margin-bottom: 1.5rem;
        }
        .sc-list { list-style: none; display: flex; flex-direction: column; gap: 0.6rem; }
        .sc-list li {
          display: flex; align-items: center; gap: 0.6rem;
          font-size: 0.82rem; color: rgba(240,240,240,0.35);
        }
        .sc-list li::before { content: '→'; color: rgba(240,240,240,0.2); font-size: 0.75rem; }
        .sc-num {
          position: absolute; bottom: 1rem; right: 1.75rem;
          font-family: 'Bebas Neue', sans-serif; font-size: 5rem; line-height: 1;
          color: rgba(255,255,255,0.025); pointer-events: none;
        }

        /* ── FEATURES ── */
        #features {
          padding: 8rem 0;
          border-top: 1px solid rgba(255,255,255,0.07);
          background: #080808;
        }
        .feat-grid {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 1px; background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px; overflow: hidden;
          margin-top: 3.5rem;
        }
        @media (max-width: 900px) { .feat-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 560px) { .feat-grid { grid-template-columns: 1fr; } }
        .feature-card {
          background: #080808; padding: 2rem;
          transition: background 0.25s ease;
          will-change: transform, opacity;
        }
        .feature-card:hover { background: rgba(255,255,255,0.025); }
        .feat-icon {
          width: 42px; height: 42px;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.15rem; margin-bottom: 1.25rem;
        }
        .feature-card h4 {
          font-size: 0.95rem; font-weight: 700;
          color: #f0f0f0; margin-bottom: 0.55rem;
          letter-spacing: -0.01em;
        }
        .feature-card p {
          font-size: 0.8rem; line-height: 1.72; color: rgba(240,240,240,0.35);
        }

        /* ── IMPORTANCE ── */
        #importance {
          padding: 8rem 0;
          border-top: 1px solid rgba(255,255,255,0.07);
          background: #050505;
        }
        .imp-inner {
          max-width: 1200px; margin: 0 auto; padding: 0 2.5rem;
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 5rem; align-items: center;
        }
        @media (max-width: 800px) { .imp-inner { grid-template-columns: 1fr; gap: 3rem; } }
        .imp-item {
          display: flex; gap: 1rem; align-items: flex-start;
          padding: 1.25rem 0;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          will-change: transform, opacity;
        }
        .imp-item:last-child { border-bottom: none; }
        .imp-icon {
          width: 36px; height: 36px; flex-shrink: 0;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px; background: rgba(255,255,255,0.02);
          display: flex; align-items: center; justify-content: center;
          font-size: 0.95rem;
        }
        .imp-item h4 { font-size: 0.875rem; font-weight: 600; color: #f0f0f0; margin-bottom: 0.22rem; }
        .imp-item p { font-size: 0.8rem; color: rgba(240,240,240,0.3); line-height: 1.65; }

        /* Mock card */
        .mock-card {
          background: #0e0e0e;
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 16px; padding: 2rem;
        }
        .mock-head {
          display: flex; align-items: center; gap: 0.75rem;
          margin-bottom: 1.5rem; padding-bottom: 1.25rem;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .mock-av {
          width: 36px; height: 36px;
          background: rgba(255,255,255,0.07); border-radius: 8px;
          display: flex; align-items: center; justify-content: center; font-size: 1rem;
        }
        .mock-sid { font-size: 0.8rem; font-weight: 600; color: #f0f0f0; }
        .mock-sub { font-size: 0.72rem; color: rgba(240,240,240,0.3); margin-top: 0.1rem; }
        .mock-ok {
          font-size: 0.67rem; font-weight: 700; letter-spacing: 0.07em;
          padding: 0.3rem 0.7rem; border-radius: 100px;
          background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.18);
          color: #22c55e;
        }
        .mock-qrow { margin-bottom: 1rem; }
        .mock-ql {
          display: flex; justify-content: space-between;
          font-size: 0.77rem; color: rgba(240,240,240,0.35); margin-bottom: 0.33rem;
        }
        .mock-ql span:last-child { color: rgba(240,240,240,0.7); font-weight: 600; }
        .mock-bg { height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; }
        .mock-fill { height: 100%; border-radius: 2px; background: #f0f0f0; }
        .mock-foot {
          display: flex; justify-content: space-between; align-items: center;
          padding-top: 1.25rem; border-top: 1px solid rgba(255,255,255,0.07);
        }
        .mock-tl { font-size: 0.72rem; color: rgba(240,240,240,0.3); }
        .mock-tv {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 2.5rem; line-height: 1; color: #f0f0f0;
        }
        .mock-tv span { font-size: 1.1rem; color: rgba(240,240,240,0.3); }
        .mock-hash {
          font-size: 0.66rem; font-weight: 600;
          padding: 0.3rem 0.7rem;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 6px; color: rgba(240,240,240,0.3); font-family: monospace;
        }

        /* ── BEFORE / AFTER ── */
        #before-after {
          padding: 8rem 0;
          border-top: 1px solid rgba(255,255,255,0.07);
          background: #080808;
        }
        .ba-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 1.5rem; margin-top: 3.5rem;
        }
        @media (max-width: 768px) { .ba-grid { grid-template-columns: 1fr; } }
        .ba-card {
          border-radius: 16px; padding: 2.5rem;
          border: 1px solid rgba(255,255,255,0.08);
          position: relative; overflow: hidden;
          will-change: transform, opacity;
        }
        #before-card { background: rgba(255,50,50,0.025); border-color: rgba(255,50,50,0.1); }
        #after-card  { background: rgba(34,197,94,0.025); border-color: rgba(34,197,94,0.1); }
        .ba-label {
          display: inline-flex; align-items: center; gap: 0.5rem;
          font-size: 0.68rem; font-weight: 800; letter-spacing: 0.15em;
          text-transform: uppercase;
          padding: 0.32rem 0.88rem; border-radius: 100px;
          margin-bottom: 2rem;
        }
        #before-card .ba-label {
          background: rgba(255,50,50,0.08); border: 1px solid rgba(255,50,50,0.14);
          color: #ff5555;
        }
        #after-card .ba-label {
          background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.14);
          color: #22c55e;
        }
        .ba-item {
          display: flex; gap: 0.85rem; align-items: flex-start;
          padding: 1rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);
          will-change: transform, opacity;
        }
        .ba-item:last-child { border-bottom: none; }
        .ba-item-ic { font-size: 1rem; margin-top: 0.1rem; flex-shrink: 0; }
        .ba-item h5 { font-size: 0.855rem; font-weight: 600; color: rgba(240,240,240,0.6); margin-bottom: 0.18rem; }
        #before-card .ba-item p { font-size: 0.77rem; color: rgba(255,80,80,0.5); line-height: 1.6; }
        #after-card  .ba-item p { font-size: 0.77rem; color: rgba(34,197,94,0.55); line-height: 1.6; }

        /* ── HOW IT WORKS ── */
        #how-it-works {
          padding: 8rem 0;
          border-top: 1px solid rgba(255,255,255,0.07);
          background: #050505;
        }
        .tl-grid {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 1px; background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px; overflow: hidden;
          margin-top: 3.5rem;
        }
        @media (max-width: 900px) { .tl-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 560px) { .tl-grid { grid-template-columns: 1fr; } }
        .timeline-step {
          background: #050505; padding: 2rem;
          position: relative; overflow: hidden;
          transition: background 0.25s ease;
          will-change: transform, opacity;
        }
        .timeline-step:hover { background: #0b0b0b; }
        .step-num {
          font-family: 'Bebas Neue', sans-serif; font-size: 3.5rem; line-height: 1;
          color: rgba(255,255,255,0.04);
          position: absolute; top: 1rem; right: 1.5rem;
          pointer-events: none;
        }
        .step-ic { font-size: 1.5rem; margin-bottom: 0.9rem; display: block; }
        .timeline-step h4 {
          font-size: 0.92rem; font-weight: 700; color: #f0f0f0;
          margin-bottom: 0.45rem; letter-spacing: -0.01em;
        }
        .timeline-step p { font-size: 0.78rem; line-height: 1.72; color: rgba(240,240,240,0.3); }

        /* ── CTA ── */
        #cta-section {
          padding: 8rem 0 5rem;
          border-top: 1px solid rgba(255,255,255,0.07);
          text-align: center;
          background: #050505;
        }
        #cta-inner { }
        .cta-big {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(3.5rem, 10vw, 10rem);
          line-height: 0.9; letter-spacing: -0.01em;
          color: #f0f0f0; margin-bottom: 1.75rem;
        }
        .cta-big .out {
          -webkit-text-stroke: 1.5px rgba(240,240,240,0.25);
          color: transparent; display: block;
        }
        .cta-sub {
          font-size: 0.975rem; color: rgba(240,240,240,0.4);
          line-height: 1.78; max-width: 440px; margin: 0 auto 2.5rem;
          font-weight: 300;
        }
        .cta-btns { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }

        /* ── FOOTER ── */
        #footer {
          border-top: 1px solid rgba(255,255,255,0.07);
          padding: 2rem 2.5rem;
          display: flex; align-items: center;
          justify-content: space-between; flex-wrap: wrap; gap: 1rem;
          background: #050505; position: relative; z-index: 1;
        }
        .foot-copy { font-size: 0.74rem; color: rgba(240,240,240,0.2); }
        .foot-links { display: flex; gap: 1.75rem; }
        .foot-links a {
          font-size: 0.74rem; color: rgba(240,240,240,0.2);
          text-decoration: none; transition: color 0.2s;
        }
        .foot-links a:hover { color: rgba(240,240,240,0.5); }

        /* ── Scrollbar ── */
        ::-webkit-scrollbar { width: 2px; }
        ::-webkit-scrollbar-track { background: #050505; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }

        @media (max-width: 640px) {
          .n-links { display: none; }
          .hero-headline .hl { font-size: clamp(3.5rem, 18vw, 6rem); }
        }
      `}</style>

      {/* Cursor */}
      <Cursor />

      {/* Grid canvas */}
      <canvas ref={canvasRef} id="gc" />

      {/* PAGE ROOT — forces dark bg */}
      <div id="page-root">

        {/* ─── NAVBAR ─── */}
        <nav id="nav">
          <span className="n-logo" onClick={() => scrollTo('hero')}>
            <div className="n-logo-mark">🎓</div>
            EvalChain
          </span>
          <div className="n-links">
            {[['Home','hero'],['Services','services'],['Features','features'],['Why Us','importance'],['Before & After','before-after'],['How It Works','how-it-works']].map(([l,id]) => (
              <button key={id} className="n-btn" onClick={() => scrollTo(id)}>{l}</button>
            ))}
          </div>
          <Link href="/login" className="n-cta">Get Started →</Link>
        </nav>

        {/* ─── HERO ─── */}
        <section id="hero">
          <div id="hero-badge">
            <span className="badge-dot" />
            Blockchain-Powered Evaluation Platform
          </div>

          <div className="hero-headline">
            {['ANSWER SHEET', 'EVALUATION', 'REIMAGINED'].map((word, i) => (
              <div key={i} className="hl-wrap">
                <span className={`hl${i === 1 ? ' outline' : ''}`}>{word}</span>
              </div>
            ))}
          </div>

          <p id="hero-sub">
            AI-assisted grading with immutable blockchain audit trails.
            Zero bias. Full transparency. Built for modern universities.
          </p>

          <div id="hero-ctas">
            <Link href="/login" className="btn-p">Start Evaluating →</Link>
            <button className="btn-g" onClick={() => scrollTo('how-it-works')}>How It Works</button>
          </div>

          <div id="hero-stats">
            {[['10×','Faster Evaluation'],['100%','Tamper-Proof'],['0','Bias Cases']].map(([n,l]) => (
              <div key={n} className="stat-cell">
                <span className="stat-n">{n}</span>
                <span className="stat-l">{l}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ─── MARQUEE ─── */}
        <div id="mq-strip">
          <div className="mq-track">
            {[...Array(2)].map((_,k) => (
              <div key={k} style={{display:'flex'}}>
                {['Next.js 15','MongoDB Atlas','Blockchain Hash','AI Evaluation','JWT Auth','Flask MCP','Cloud Native','Audit Logs','Zero Bias','PDF Processing','Anonymous Grading','Grievance System'].map(t => (
                  <div key={t} className="mq-item">{t}</div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ─── SERVICES ─── */}
        <section id="services">
          <div className="ctr">
            <span className="sec-label">Services</span>
            <FillTitle lines={['EVERYTHING YOUR', 'INSTITUTION NEEDS']} outlineIdx={[1]} />
            <div className="svc-grid">
              {[
                { icon:'👨‍🎓', badge:'Student', num:'01', title:'Student Portal',
                  desc:'Upload answer sheet PDFs securely. Track evaluation in real-time with a timestamped live timeline. View per-question marks and final results instantly.',
                  items:['Secure PDF Upload','Live Evaluation Progress','Per-question Breakdown','Grievance & Re-evaluation'] },
                { icon:'👩‍🏫', badge:'Evaluator', num:'02', title:'Teacher Dashboard',
                  desc:'Evaluate anonymised submissions — no student names, no bias. Mark each question with scores and feedback. Every click logged for full accountability.',
                  items:['Anonymous Assignment View','Question-by-question Scoring','Time-tracked Audit Log','Draft & Final Submission'] },
                { icon:'🛡️', badge:'Admin', num:'03', title:'Admin Intelligence',
                  desc:'Full audit dashboard with AI-powered anomaly detection. Chat with MCP agent to surface bias patterns, grievance trends, and outlier evaluations instantly.',
                  items:['AI MCP Chat Agent','Bias & Anomaly Detection','Full Audit Trail View','Re-evaluation Management'] },
              ].map(s => (
                <div key={s.num} className="service-card">
                  <div className="sc-top">
                    <span className="sc-icon">{s.icon}</span>
                    <span className="sc-badge">{s.badge}</span>
                  </div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                  <ul className="sc-list">{s.items.map(i => <li key={i}>{i}</li>)}</ul>
                  <div className="sc-num">{s.num}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FEATURES ─── */}
        <section id="features">
          <div className="ctr">
            <span className="sec-label">Features</span>
            <FillTitle lines={['BUILT FOR TRUST,', 'SPEED & SCALE']} outlineIdx={[1]} />
            <div className="feat-grid">
              {[
                { icon:'⛓️', title:'Blockchain Hashing', desc:'Every submission and result is hashed on-chain. blockchainTxHash makes tampering mathematically impossible and permanently auditable.' },
                { icon:'🤖', title:'AI MCP Agent', desc:'Flask-powered LLM agent with direct MongoDB access. Detects bias, anomalies, and evaluation outliers on demand with natural language queries.' },
                { icon:'👁️', title:'Anonymous Grading', desc:"Teacher never sees the student's identity. Anonymised submission IDs ensure completely unbiased, fair evaluation at all times." },
                { icon:'📊', title:'Live Progress', desc:'Students watch their paper move through Submitted → Assigned → Evaluating → Completed in real time with event timestamps.' },
                { icon:'🕵️', title:'Full Audit Trail', desc:'Every teacher action — question opened, score given, time spent — is logged immutably to audit_logs. Nothing is hidden.' },
                { icon:'📝', title:'Grievance System', desc:'Students raise re-evaluation requests in one click. Admins track outcomes and mark changes with full historical accountability.' },
              ].map(f => (
                <div key={f.title} className="feature-card">
                  <div className="feat-icon">{f.icon}</div>
                  <h4>{f.title}</h4>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── IMPORTANCE ─── */}
        <section id="importance">
          <div className="imp-inner">
            <div id="imp-left">
              <span className="sec-label">Why It Matters</span>
              <FillTitle lines={['WHY', 'UNIVERSITIES', 'SWITCH']} outlineIdx={[2]} />
              <p style={{color:'rgba(240,240,240,0.38)',fontSize:'0.88rem',lineHeight:1.82,marginBottom:'2.5rem',fontWeight:300,maxWidth:400}}>
                Traditional paper evaluation is slow, opaque, and prone to human bias. Students deserve fair marks. Institutions deserve full auditability.
              </p>
              <div>
                {[
                  ['🎯','Eliminates Favouritism','Anonymous IDs mean teachers evaluate work, not names.'],
                  ['⏱️','Cuts Evaluation Time','AI-assisted pre-scoring reduces grading from days to hours.'],
                  ['🔍','Full Transparency','Students and admins see exactly what happened, when, and who.'],
                  ['⚖️','Built-in Dispute Resolution','Grievance workflows with re-evaluation tracking built in.'],
                ].map(([icon,title,sub]) => (
                  <div key={String(title)} className="imp-item">
                    <div className="imp-icon">{icon}</div>
                    <div><h4>{title}</h4><p>{sub}</p></div>
                  </div>
                ))}
              </div>
            </div>

            <div id="imp-right">
              <div className="mock-card">
                <div className="mock-head">
                  <div className="mock-av">📄</div>
                  <div>
                    <div className="mock-sid">Submission #0X5564</div>
                    <div className="mock-sub">Mathematics — Sem VI</div>
                  </div>
                  <div className="mock-ok">✓ Verified</div>
                </div>
                {[{q:'Q1 — Calculus',m:25,x:30},{q:'Q2 — Algebra',m:18,x:20},{q:'Q3 — Statistics',m:22,x:25}].map(r => (
                  <div key={r.q} className="mock-qrow">
                    <div className="mock-ql"><span>{r.q}</span><span>{r.m}/{r.x}</span></div>
                    <div className="mock-bg"><div className="mock-fill" style={{width:`${(r.m/r.x)*100}%`}} /></div>
                  </div>
                ))}
                <div className="mock-foot">
                  <div>
                    <div className="mock-tl">Total Score</div>
                    <div className="mock-tv">65<span>/75</span></div>
                  </div>
                  <div className="mock-hash">0x1a2b...c3d4</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── BEFORE / AFTER ─── */}
        <section id="before-after">
          <div className="ctr">
            <span className="sec-label">Transformation</span>
            <FillTitle lines={['THE EXAM SYSTEM,', 'REIMAGINED']} outlineIdx={[1]} />
            <div className="ba-grid">
              <div id="before-card" className="ba-card">
                <div className="ba-label">📦 Before</div>
                {[
                  ['📮','Physical Answer Sheets','Days of transit time, risk of loss in mail.'],
                  ['🤝','Known Student–Teacher Relations','Bias inevitable, grades inherently unfair.'],
                  ['📁','Results in Excel Sheets','Easily altered, zero audit trail.'],
                  ['📬','Grievances via Written Letters','Weeks to resolve, no tracking.'],
                  ['🕐','Manual Mark Tallying','Error-prone, extremely time-consuming.'],
                ].map(([icon,title,sub],i) => (
                  <div key={i} className="ba-item ba-before-item">
                    <span className="ba-item-ic">{icon}</span>
                    <div><h5>{title}</h5><p>{sub}</p></div>
                  </div>
                ))}
              </div>
              <div id="after-card" className="ba-card">
                <div className="ba-label">✨ Now</div>
                {[
                  ['☁️','Instant PDF Cloud Upload','Available to evaluator in seconds.'],
                  ['🎭','Full Anonymisation via IDs','Zero bias, mathematically guaranteed.'],
                  ['⛓️','Results Hashed on Blockchain','blockchainTxHash — immutable forever.'],
                  ['🖥️','One-click Grievance Portal','Tracked, timestamped, resolved in hours.'],
                  ['🤖','AI-Assisted Scoring','Faster, consistent, auditable marks.'],
                ].map(([icon,title,sub],i) => (
                  <div key={i} className="ba-item ba-after-item">
                    <span className="ba-item-ic">{icon}</span>
                    <div><h5>{title}</h5><p>{sub}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── HOW IT WORKS ─── */}
        <section id="how-it-works">
          <div className="ctr">
            <span className="sec-label">Workflow</span>
            <FillTitle lines={['HOW', 'IT WORKS']} outlineIdx={[1]} />
            <div className="tl-grid">
              {[
                { n:'01', icon:'📤', title:'Student Uploads PDF', desc:'Student logs in, uploads answer sheet PDF. System creates a submission with a unique anonymous ID and initial blockchainTxHash immediately.' },
                { n:'02', icon:'🎭', title:'Anonymous Assignment', desc:'System assigns the anonymised submission to an available teacher. Student identity completely hidden. Audit log entry created on assignment.' },
                { n:'03', icon:'✍️', title:'Question Evaluation', desc:'Teacher marks each question with a score and comment. Every action timestamps an audit_log entry — including exact time spent per question.' },
                { n:'04', icon:'🔒', title:'Result Sealed on Chain', desc:'On final submit, isDraft=false, evaluatedAt is stamped, evaluationHash written to blockchain. Result is now permanently immutable.' },
                { n:'05', icon:'📊', title:'Student Views Results', desc:'Student sees live timeline, per-question marks, and total score. Can raise a grievance in a single click if outcome is disputed.' },
                { n:'06', icon:'🤖', title:'Admin AI Oversight', desc:'Admin chats with the MCP AI agent to detect bias, anomalies, or unusual scoring patterns across all evaluations institution-wide.' },
              ].map(s => (
                <div key={s.n} className="timeline-step">
                  <div className="step-num">{s.n}</div>
                  <span className="step-ic">{s.icon}</span>
                  <h4>{s.title}</h4>
                  <p>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section id="cta-section">
          <div id="cta-inner" className="ctr">
            <div className="cta-big">
              <span>READY TO</span>
              <span className="out">MODERNISE?</span>
            </div>
            <p className="cta-sub">
              Join institutions that have eliminated evaluation bias, reduced grievances by 90%, and cut grading time in half.
            </p>
            <div className="cta-btns">
              <Link href="/login" className="btn-p" style={{fontSize:'1rem',padding:'1rem 2.5rem'}}>Get Started Free →</Link>
              <button className="btn-g" onClick={() => scrollTo('services')} style={{fontSize:'1rem',padding:'1rem 2.5rem'}}>Explore Platform</button>
            </div>
          </div>
        </section>

        {/* ─── FOOTER ─── */}
        <footer id="footer">
          <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
            <div className="n-logo-mark" style={{width:24,height:24,fontSize:'0.65rem',borderRadius:5}}>🎓</div>
            <span style={{fontSize:'0.82rem',fontWeight:700,color:'rgba(240,240,240,0.3)'}}>EvalChain</span>
          </div>
          <span className="foot-copy">© 2026 Answer Sheet Evaluation System. All rights reserved.</span>
          <div className="foot-links">
            <a href="#">Privacy</a><a href="#">Terms</a><a href="#">Contact</a>
          </div>
        </footer>

      </div>{/* /page-root */}
    </>
  );
}

/* ─── FillTitle component — ghost + filled clip-path scroll effect ─── */
function FillTitle({ lines, outlineIdx = [] }: { lines: string[]; outlineIdx?: number[] }) {
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      {lines.map((line, i) => (
        <div key={i} className="fill-text-wrap" style={{ display: 'block', position: 'relative', lineHeight: 0.92, marginBottom: '0.08em' }}>
          <span className={`fill-text-ghost${outlineIdx.includes(i) ? ' outline' : ''}`}>{line}</span>
          <span className={`fill-text-filled${outlineIdx.includes(i) ? ' outline' : ''}`}>{line}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Custom cursor ─── */
function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let dx = window.innerWidth / 2, dy = window.innerHeight / 2;
    let rx = dx, ry = dy;
    let raf: number;

    const onMove = (e: MouseEvent) => { dx = e.clientX; dy = e.clientY; };
    window.addEventListener('mousemove', onMove);

    const loop = () => {
      if (dotRef.current) {
        dotRef.current.style.left = dx + 'px';
        dotRef.current.style.top = dy + 'px';
      }
      rx += (dx - rx) * 0.11;
      ry += (dy - ry) * 0.11;
      if (ringRef.current) {
        ringRef.current.style.left = rx + 'px';
        ringRef.current.style.top = ry + 'px';
      }
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
