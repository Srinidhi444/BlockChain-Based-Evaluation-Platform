'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { XCircle, RefreshCw, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

interface Evaluation {
  questionMarks: Array<{
    questionNumber: number; maxMarks: number;
    marksObtained: number; comment?: string;
  }>;
  totalMarksObtained: number; totalMarks: number;
  percentage: number; remarks?: string;
}

interface FormData {
  grievanceType: 'calculation_error' | 'reevaluation' | '';
  questionNumber: string;
  explanation: string;
}

/* ─── Cursor ─── */
function DashCursor() {
  const dotRef  = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let dx = window.innerWidth / 2, dy = window.innerHeight / 2;
    let rx = dx, ry = dy;
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
  return (
    <>
      <div ref={dotRef}  className="c-dot" />
      <div ref={ringRef} className="c-ring" />
    </>
  );
}

export default function FileGrievancePage() {
  const router = useRouter();
  const params = useParams();
  const submissionId = params.submissionId as string;

  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');

  const [formData, setFormData] = useState<FormData>({
    grievanceType: '', questionNumber: '', explanation: '',
  });

  useEffect(() => { fetchEvaluationData(); }, [submissionId]);

  const fetchEvaluationData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/student/results?submissionId=${submissionId}`);
      if (!res.ok) {
        if (res.status === 401) { router.push('/login'); return; }
        throw new Error('Failed to fetch evaluation');
      }
      const data = await res.json();
      setEvaluation(data.data.evaluation);
    } catch (err: any) { setError(err.message || 'Failed to load evaluation'); }
    finally { setLoading(false); }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.grievanceType) { setError('Please select a grievance type'); return; }
    if (formData.explanation.length < 20)   { setError('Explanation must be at least 20 characters'); return; }
    if (formData.explanation.length > 1000) { setError('Explanation cannot exceed 1000 characters'); return; }
    try {
      setSubmitting(true); setError(''); setSuccess('');
      const requestBody: any = {
        submissionId, grievanceType: formData.grievanceType,
        explanation: formData.explanation.trim(),
      };
      if (formData.questionNumber) requestBody.questionNumber = parseInt(formData.questionNumber);
      const res  = await fetch('/api/student/grievance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to file grievance');
      setSuccess('Grievance filed successfully! Redirecting…');
      setTimeout(() => router.push('/results'), 2000);
    } catch (err: any) { setError(err.message || 'Failed to file grievance'); }
    finally { setSubmitting(false); }
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
          <p style={{ marginTop: '1rem', fontSize: '0.88rem', fontWeight: 500, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>Loading evaluation…</p>
        </div>
      </div>
    </>
  );

  /* ── Not found ── */
  if (!evaluation) return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        html,body{background:#050505!important;margin:0;font-family:'Inter',sans-serif;cursor:none!important;}
        .c-dot{position:fixed;width:7px;height:7px;background:#fff;border-radius:50%;pointer-events:none;z-index:99999;transform:translate(-50%,-50%);mix-blend-mode:difference;}
        .c-ring{position:fixed;width:32px;height:32px;border:1px solid rgba(255,255,255,0.6);border-radius:50%;pointer-events:none;z-index:99998;transform:translate(-50%,-50%);mix-blend-mode:difference;}
      `}</style>
      <DashCursor />
      <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ background: '#090909', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 16, padding: '3rem 2rem', textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}><XCircle size={18} /></div>
          <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'rgba(252,165,165,0.9)', marginBottom: '1.5rem' }}>
            Evaluation not found
          </p>
          <Link href="/results" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.65rem 1.4rem', borderRadius: 10, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>
            ← Back to Results
          </Link>
        </div>
      </div>
    </>
  );

  const pct   = evaluation.percentage;
  const grade = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : pct >= 40 ? 'D' : 'F';
  const gradeColor = pct >= 70 ? 'rgba(74,222,128,1)' : pct >= 50 ? 'rgba(253,224,71,1)' : 'rgba(252,165,165,1)';

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

        .fade-up { animation: fadeUp 0.45s ease both; }

        .dark-select, .dark-textarea {
          width:100%; background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.1); border-radius:10px;
          padding:0.7rem 0.9rem; color:#f0f0f0;
          font-family:'Inter',sans-serif; font-size:0.88rem; font-weight:500;
          outline:none; transition:border-color 0.2s, background 0.2s;
          appearance:none; -webkit-appearance:none;
        }
        .dark-select:focus, .dark-textarea:focus {
          border-color:rgba(255,255,255,0.28);
          background:rgba(255,255,255,0.06);
        }
        .dark-select option { background:#1a1a1a; color:#f0f0f0; }
        .dark-textarea { resize:vertical; min-height:150px; line-height:1.6; }

        .dark-select-wrap { position:relative; }
        .dark-select-wrap::after {
          content:'';
          position:absolute; right:0.85rem; top:50%; transform:translateY(-50%);
          width:0; height:0;
          border-left:4px solid transparent;
          border-right:4px solid transparent;
          border-top:5px solid rgba(255,255,255,0.4);
          pointer-events:none;
        }

        .submit-btn {
          width:100%; padding:0.9rem;
          background:#f0f0f0; color:#000;
          font-family:inherit; font-size:0.95rem; font-weight:800;
          border:none; border-radius:10px; cursor:none;
          display:flex; align-items:center; justify-content:center; gap:0.5rem;
          transition:opacity 0.2s, box-shadow 0.2s;
          box-shadow:0 0 20px rgba(255,255,255,0.1);
        }
        .submit-btn:hover:not(:disabled) { opacity:0.88; box-shadow:0 0 30px rgba(255,255,255,0.18); }
        .submit-btn:disabled { opacity:0.3; cursor:not-allowed; box-shadow:none; }

        .q-bar-bg   { height:4px; border-radius:100px; background:rgba(255,255,255,0.07); overflow:hidden; margin-top:0.5rem; }
        .q-bar-fill { height:100%; border-radius:100px; transition:width 0.7s ease; }

        .section-label {
          font-size:0.68rem; font-weight:800; letter-spacing:0.16em;
          text-transform:uppercase; color:rgba(255,255,255,0.35); margin-bottom:0.75rem;
        }

        .grievance-scroll::-webkit-scrollbar { width:3px; }
        .grievance-scroll::-webkit-scrollbar-track { background:transparent; }
        .grievance-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:10px; }
      `}</style>

      <DashCursor />

      <div style={{ minHeight: '100vh', background: '#050505', fontFamily: "'Inter', system-ui, sans-serif" }}>

        {/* ── Nav ── */}
        <nav style={{
          height: 52, background: 'rgba(5,5,5,0.9)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(20px)',
          display: 'flex', alignItems: 'center', padding: '0 1.75rem',
          justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50,
        }}>
          <Link href="/results" style={{
            display: 'flex', alignItems: 'center', gap: '0.45rem',
            fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.45)',
            textDecoration: 'none', transition: 'color 0.2s',
          }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Results
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.28)', fontWeight: 500 }}>
            GRADEX
            <span style={{ color: 'rgba(255,255,255,0.18)' }}>/</span>
            <span style={{ color: 'rgba(255,255,255,0.55)' }}>File Grievance</span>
          </div>

          <div style={{ width: 80 }} />
        </nav>

        {/* ── Body ── */}
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2.25rem 1.25rem 4rem' }}>

          {/* Page heading */}
          <div className="fade-up" style={{ marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', marginBottom: '0.55rem' }}>
              Dispute Resolution
            </div>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2.4rem,5vw,3.5rem)', lineHeight: 0.95, color: '#ffffff', letterSpacing: '0.01em' }}>
              FILE A<br/>
              <span style={{ WebkitTextStroke: '0.5px rgba(255,255,255,0.9)', color: 'transparent' }}>GRIEVANCE</span>
            </h1>
          </div>

          {/* ── Two-column grid ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', alignItems: 'start' }}>

            {/* ══ LEFT: Current Evaluation ══ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Score card */}
              <div className="fade-up" style={{
                background: '#090909', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16, padding: '1.5rem', position: 'relative', overflow: 'hidden',
                animationDelay: '0.05s',
              }}>
                {/* Glow */}
                <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: '50%', background: `${gradeColor}22`, filter: 'blur(35px)', pointerEvents: 'none' }} />

                <div className="section-label">Current Evaluation</div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  {[
                    { label: 'Score',      val: `${evaluation.totalMarksObtained}/${evaluation.totalMarks}` },
                    { label: 'Percentage', val: `${evaluation.percentage.toFixed(1)}%` },
                    { label: 'Grade',      val: grade, color: gradeColor },
                  ].map(stat => (
                    <div key={stat.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '0.85rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', marginBottom: '0.4rem' }}>{stat.label}</div>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.9rem', lineHeight: 1, color: (stat as any).color || '#ffffff' }}>{stat.val}</div>
                    </div>
                  ))}
                </div>

                {/* Score bar */}
                <div style={{ height: 4, borderRadius: 100, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 100, width: `${evaluation.percentage}%`, background: gradeColor, boxShadow: `0 0 8px ${gradeColor}`, transition: 'width 1s ease' }} />
                </div>
              </div>

              {/* Q-wise breakdown */}
              <div className="fade-up grievance-scrol" style={{
                background: '#090909', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16, padding: '1.4rem', animationDelay: '0.1s',
                maxHeight: 420, overflowY: 'auto',
              }}>
                <div className="section-label">Question-wise Marks</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {evaluation.questionMarks.map(q => {
                    const ratio    = q.marksObtained / q.maxMarks;
                    const barColor = ratio >= 0.7 ? 'rgba(34,197,94,0.8)' : ratio >= 0.4 ? 'rgba(251,191,36,0.8)' : 'rgba(239,68,68,0.8)';
                    return (
                      <div key={q.questionNumber} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 11, padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
                              Q{q.questionNumber}
                            </div>
                            {q.comment && (
                              <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
                                💬 {q.comment}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#ffffff', flexShrink: 0 }}>
                            {q.marksObtained}/{q.maxMarks}
                          </div>
                        </div>
                        <div className="q-bar-bg">
                          <div className="q-bar-fill" style={{ width: `${ratio * 100}%`, background: barColor, boxShadow: `0 0 5px ${barColor}` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Remarks */}
              {evaluation.remarks && (
                <div className="fade-up" style={{
                  background: '#090909', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 14, padding: '1.25rem', animationDelay: '0.15s',
                }}>
                  <div className="section-label">Teacher's Remarks</div>
                  <p style={{ fontSize: '0.88rem', fontWeight: 500, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, fontStyle: 'italic' }}>
                    "{evaluation.remarks}"
                  </p>
                </div>
              )}
            </div>

            {/* ══ RIGHT: Grievance Form ══ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Form card */}
              <div className="fade-up" style={{
                background: '#090909', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16, padding: '1.5rem', animationDelay: '0.07s',
              }}>
                <div className="section-label">Grievance Details</div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

                  {/* Grievance Type */}
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.5)', marginBottom: '0.5rem' }}>
                      Grievance Type <span style={{ color: 'rgba(252,165,165,0.8)' }}>*</span>
                    </div>
                    <div className="dark-select-wrap">
                      <select
                        name="grievanceType"
                        value={formData.grievanceType}
                        onChange={handleInputChange}
                        className="dark-select"
                        required
                      >
                        <option value="">Select Type</option>
                        <option value="reevaluation">Re-evaluation Request (Different Teacher)</option>
                      </select>
                    </div>
                    {formData.grievanceType && (
                      <div style={{ marginTop: '0.45rem', padding: '0.55rem 0.75rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', fontSize: '0.76rem', fontWeight: 500, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                        {formData.grievanceType === 'calculation_error'
                          ? <><RefreshCw size={18} /> The same teacher will review for calculation mistakes</>
                          : '👤 A different teacher will re-evaluate your answer sheet'}
                      </div>
                    )}
                  </div>

                  {/* Question Number */}
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.5)', marginBottom: '0.5rem' }}>
                      Question Number <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 500 }}>(optional)</span>
                    </div>
                    <div className="dark-select-wrap">
                      <select
                        name="questionNumber"
                        value={formData.questionNumber}
                        onChange={handleInputChange}
                        className="dark-select"
                      >
                        <option value="">All Questions</option>
                        {evaluation.questionMarks.map(q => (
                          <option key={q.questionNumber} value={q.questionNumber}>
                            Question {q.questionNumber} ({q.marksObtained}/{q.maxMarks})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ marginTop: '0.35rem', fontSize: '0.73rem', fontWeight: 500, color: 'rgba(255,255,255,0.28)' }}>
                      Leave blank to dispute the entire evaluation
                    </div>
                  </div>

                  {/* Explanation */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.5)' }}>
                        Explanation <span style={{ color: 'rgba(252,165,165,0.8)' }}>*</span>
                      </div>
                      <div style={{
                        fontSize: '0.72rem', fontWeight: 600,
                        color: formData.explanation.length < 20
                          ? 'rgba(252,165,165,0.7)'
                          : formData.explanation.length > 900
                          ? 'rgba(253,224,71,0.8)'
                          : 'rgba(255,255,255,0.3)',
                      }}>
                        {formData.explanation.length}/1000
                      </div>
                    </div>
                    <textarea
                      name="explanation"
                      value={formData.explanation}
                      onChange={handleInputChange}
                      className="dark-textarea"
                      placeholder="Explain why you believe the marks should be reviewed. Be specific and polite. (Min 20 characters)"
                      required minLength={20} maxLength={1000}
                    />
                    {formData.explanation.length > 0 && formData.explanation.length < 20 && (
                      <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', fontWeight: 600, color: 'rgba(252,165,165,0.7)' }}>
                        {20 - formData.explanation.length} more characters needed
                      </div>
                    )}
                  </div>

                  {/* Error */}
                  {error && (
                    <div style={{ padding: '0.85rem 1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: '0.55rem' }}>
                      <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                      <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(252,165,165,0.95)' }}>{error}</p>
                    </div>
                  )}

                  {/* Success */}
                  {success && (
                    <div style={{ padding: '0.85rem 1rem', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: '0.55rem' }}>
                      <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                      <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(74,222,128,0.95)' }}>{success}</p>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={submitting || !!success}
                    className="submit-btn"
                  >
                    {submitting ? (
                      <>
                        <div style={{ width: 17, height: 17, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.2)', borderTop: '2px solid #000', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                        Submitting Grievance…
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                        </svg>
                        Submit Grievance
                      </>
                    )}
                  </button>

                </form>
              </div>

              {/* Info card */}
              <div className="fade-up" style={{
                background: '#090909', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16, padding: '1.4rem', animationDelay: '0.12s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <Info size={18} />
                  <div className="section-label" style={{ marginBottom: 0 }}>Important Information</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {[
                    'Grievances are reviewed within 3–5 working days',
                    'You can only file one grievance per submission',
                    'Re-evaluation results may increase, decrease, or remain the same',
                    'You will be notified once the review is complete',
                  ].map((note, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: '0.05rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)' }}>
                        {i + 1}
                      </div>
                      <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'rgba(255,255,255,0.45)', lineHeight: 1.55 }}>
                        {note}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
