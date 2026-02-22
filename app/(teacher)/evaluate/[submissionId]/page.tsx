'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { XCircle, AlertTriangle, CheckCircle2, Save } from 'lucide-react';

interface Test {
  testId: string; title: string; subject: string; totalMarks: number;
  questions: Array<{ questionNumber: number; marks: number; description?: string }>;
}
interface Submission {
  submissionId: string; testId: string; studentName: string;
  department: string; year: number; division: string; subject: string;
  answerSheetUrl: string; fileName: string; fileSize: number; fileType: string;
  fileHash?: string; uploadedAt: string; status: string;
}
interface QuestionMark {
  questionNumber: number; maxMarks: number; marksObtained: number; comment: string;
}
interface QuestionTiming {
  questionNumber: number; startTime: Date; endTime?: Date;
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

/* ─── Grade helper ─── */
function getGrade(pct: number) {
  if (pct >= 90) return { label: 'A+', color: 'rgba(74,222,128,1)',  bg: 'rgba(34,197,94,0.15)',  border: 'rgba(34,197,94,0.3)'   };
  if (pct >= 80) return { label: 'A',  color: 'rgba(74,222,128,1)',  bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.25)'  };
  if (pct >= 70) return { label: 'B+', color: 'rgba(147,197,253,1)', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)' };
  if (pct >= 60) return { label: 'B',  color: 'rgba(147,197,253,1)', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.2)'  };
  if (pct >= 50) return { label: 'C',  color: 'rgba(253,224,71,1)',  bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.25)' };
  if (pct >= 40) return { label: 'D',  color: 'rgba(253,186,116,1)', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.25)' };
  return           { label: 'F',  color: 'rgba(252,165,165,1)', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.25)'  };
}

/* ─── Shared dark input style ─── */
const baseInput: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9,
  padding: '0.62rem 0.85rem', color: '#f0f0f0',
  fontFamily: "'Inter',sans-serif", fontSize: '0.85rem', fontWeight: 500,
  outline: 'none', transition: 'border-color 0.2s, background 0.2s',
};

function DarkInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [f, setF] = useState(false);
  return (
    <input {...props}
      style={{ ...baseInput, borderColor: f ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.1)', background: f ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)' }}
      onFocus={e => { setF(true); props.onFocus?.(e); }}
      onBlur={e  => { setF(false); props.onBlur?.(e); }}
    />
  );
}

function DarkTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const [f, setF] = useState(false);
  return (
    <textarea {...props}
      style={{ ...baseInput, resize: 'vertical', minHeight: 90, lineHeight: 1.6, borderColor: f ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.1)', background: f ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)' } as React.CSSProperties}
      onFocus={e => { setF(true); props.onFocus?.(e); }}
      onBlur={e  => { setF(false); props.onBlur?.(e); }}
    />
  );
}

/* ─── Nav back ─── */
function NavBack({ href, label }: { href: string; label: string }) {
  const [h, setH] = useState(false);
  return (
    <Link href={href} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', fontWeight: 600, color: h ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)', textDecoration: 'none', transition: 'color 0.2s' }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      {label}
    </Link>
  );
}

/* ══════════════════════════ MAIN PAGE ══════════════════════════ */
export default function EvaluateSubmissionPage() {
  const router = useRouter();
  const params = useParams();
  const submissionId = params.submissionId as string;

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [test, setTest]             = useState<Test | null>(null);
  const [questionMarks, setQuestionMarks] = useState<QuestionMark[]>([]);
  const [remarks, setRemarks]       = useState('');
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');

  const [sessionStartTime]   = useState<Date>(() => new Date());
  const [questionTimings, setQuestionTimings] = useState<Map<number, QuestionTiming>>(new Map());
  const [currentQuestion, setCurrentQuestion] = useState<number | null>(null);

  const totalMarksObtained = questionMarks.reduce((s, q) => s + (q.marksObtained || 0), 0);
  const totalMarks         = questionMarks.reduce((s, q) => s + q.maxMarks, 0);
  const percentage         = totalMarks > 0 ? (totalMarksObtained / totalMarks) * 100 : 0;

  useEffect(() => { fetchEvaluationData(); }, [submissionId]);

  const fetchEvaluationData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/teacher/submission/${submissionId}`);
      if (!res.ok) { if (res.status === 401) { router.push('/login'); return; } throw new Error('Failed to fetch submission details'); }
      const data = await res.json();
      setSubmission(data.data.submission);
      setTest(data.data.test);
      const init = data.data.test.questions.map((q: any) => ({ questionNumber: q.questionNumber, maxMarks: q.marks, marksObtained: 0, comment: '' }));
      if (data.data.evaluation) { setQuestionMarks(data.data.evaluation.questionMarks); setRemarks(data.data.evaluation.remarks || ''); }
      else setQuestionMarks(init);
    } catch (err: any) { setError(err.message || 'Failed to load evaluation data'); }
    finally { setLoading(false); }
  };

  const handleQuestionFocus = (qn: number) => {
    if (currentQuestion === qn) return;
    if (currentQuestion !== null) {
      setQuestionTimings(prev => { const m = new Map(prev); const t = m.get(currentQuestion); if (t && !t.endTime) m.set(currentQuestion, { ...t, endTime: new Date() }); return m; });
    }
    setCurrentQuestion(qn);
    setQuestionTimings(prev => { const m = new Map(prev); if (!m.has(qn)) m.set(qn, { questionNumber: qn, startTime: new Date() }); return m; });
  };

  const handleQuestionBlur = (qn: number) => {
    setQuestionTimings(prev => { const m = new Map(prev); const t = m.get(qn); if (t && !t.endTime) m.set(qn, { ...t, endTime: new Date() }); return m; });
  };

  const getSessionData = () => {
    const end = new Date();
    return {
      sessionStartTime: sessionStartTime.toISOString(),
      sessionEndTime:   end.toISOString(),
      questionTimings:  Array.from(questionTimings.entries()).map(([qn, t], i) => {
        const et = t.endTime || end;
        return { questionNumber: qn, timeSpent: Math.max(Math.floor((et.getTime() - t.startTime.getTime()) / 1000), 0), markedAt: et.toISOString(), sequenceOrder: i + 1 };
      }),
    };
  };

  const handleMarksChange = (qn: number, value: string) => {
    const marks = parseFloat(value) || 0;
    const q = questionMarks.find(q => q.questionNumber === qn);
    if (q && marks > q.maxMarks) { setError(`Marks for Q${qn} cannot exceed ${q.maxMarks}`); return; }
    if (!questionTimings.has(qn)) handleQuestionFocus(qn);
    setQuestionMarks(prev => prev.map(q => q.questionNumber === qn ? { ...q, marksObtained: marks } : q));
    setError('');
  };

  const handleCommentChange = (qn: number, value: string) => {
    if (!questionTimings.has(qn)) handleQuestionFocus(qn);
    setQuestionMarks(prev => prev.map(q => q.questionNumber === qn ? { ...q, comment: value } : q));
  };

  const handleSaveDraft = async () => {
    try {
      setSaving(true); setError(''); setSuccess('');
      const res = await fetch('/api/teacher/evaluate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, questionMarks, remarks, isDraft: true, ...getSessionData() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save draft');
      setSuccess('Draft saved!'); setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) { setError(err.message || 'Failed to save draft'); }
    finally { setSaving(false); }
  };

  const handleFinalize = async () => {
    if (questionMarks.some(q => q.marksObtained < 0 || q.marksObtained > q.maxMarks)) { setError('Invalid marks entered'); return; }
    const confirmed = confirm(`Finalize evaluation?\n\nTotal: ${totalMarksObtained}/${totalMarks} (${percentage.toFixed(2)}%)\n\nThis will be stored on blockchain and cannot be undone.`);
    if (!confirmed) return;
    try {
      setSaving(true); setError(''); setSuccess('');
      if (currentQuestion !== null) handleQuestionBlur(currentQuestion);
      const res = await fetch('/api/teacher/evaluate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, questionMarks, remarks, isDraft: false, ...getSessionData() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to finalize evaluation');
      setSuccess('Evaluation finalized! Redirecting…');
      setTimeout(() => router.push('/evaluate'), 2000);
    } catch (err: any) { setError(err.message || 'Failed to finalize evaluation'); }
    finally { setSaving(false); }
  };

  const isPDF = (sub: Submission) => sub.fileType === 'application/pdf' || sub.answerSheetUrl.includes('data:application/pdf');

  const openInNewWindow = () => {
    if (!submission) return;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(`<!DOCTYPE html><html><head><title>Answer Sheet</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{display:flex;flex-direction:column;height:100vh;background:#050505;color:#f0f0f0;font-family:Inter,sans-serif;}.header{background:#0a0a0a;padding:1rem 1.5rem;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;align-items:center;}.content{flex:1;overflow:auto;display:flex;justify-content:center;align-items:start;padding:1rem;}embed,iframe{width:100%;height:100%;border:none;}img{max-width:100%;height:auto;}.btn{padding:0.5rem 1rem;background:rgba(255,255,255,0.1);color:#f0f0f0;border:1px solid rgba(255,255,255,0.2);border-radius:8px;cursor:pointer;font-size:0.875rem;}</style></head><body><div class="header"><h2 style="font-size:0.95rem;font-weight:700;">${submission.fileName}</h2><button class="btn" onclick="window.print()">🖨️ Print</button></div><div class="content">${isPDF(submission) ? `<embed src="${submission.answerSheetUrl}" type="application/pdf" style="width:100%;height:calc(100vh - 60px);" />` : `<img src="${submission.answerSheetUrl}" alt="Answer Sheet" />`}</div></body></html>`);
      w.document.close();
    }
  };

  /* ── Loading ── */
  if (loading) return (
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
          <p style={{ marginTop: '1rem', fontSize: '0.88rem', fontWeight: 500, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>Loading evaluation…</p>
        </div>
      </div>
    </>
  );

  /* ── Not found ── */
  if (!submission || !test) return (
    <>
      <style>{`html,body{background:#050505!important;margin:0;cursor:none!important;}.c-dot{position:fixed;width:7px;height:7px;background:#fff;border-radius:50%;pointer-events:none;z-index:99999;transform:translate(-50%,-50%);mix-blend-mode:difference;}.c-ring{position:fixed;width:32px;height:32px;border:1px solid rgba(255,255,255,0.6);border-radius:50%;pointer-events:none;z-index:99998;transform:translate(-50%,-50%);mix-blend-mode:difference;}`}</style>
      <DashCursor />
      <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#090909', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 16, padding: '3rem 2rem', textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}><XCircle size={18} /></div>
          <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'rgba(252,165,165,0.9)', marginBottom: '1.5rem' }}>Submission not found</p>
          <Link href="/evaluate" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.65rem 1.4rem', borderRadius: 10, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>
            ← Back to Submissions
          </Link>
        </div>
      </div>
    </>
  );

  const isReadOnly = submission.status === 'evaluated' || submission.status === 'published';
  const grade = getGrade(percentage);

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

        .eval-scroll::-webkit-scrollbar { width:3px; }
        .eval-scroll::-webkit-scrollbar-track { background:transparent; }
        .eval-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:10px; }
      `}</style>

      <DashCursor />

      <div style={{ minHeight: '100vh', background: '#050505', fontFamily: "'Inter',system-ui,sans-serif" }}>

        {/* ── Nav ── */}
        <nav style={{ height: 52, background: 'rgba(5,5,5,0.92)', borderBottom: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', padding: '0 1.75rem', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
          <NavBack href="/evaluate" label="Submissions" />
          <div style={{ fontSize: '0.78rem', fontWeight: 500, color: 'rgba(255,255,255,0.28)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            GRADEX <span style={{ color: 'rgba(255,255,255,0.18)' }}>/</span>
            <span style={{ color: 'rgba(255,255,255,0.55)' }}>Evaluate Sheet</span>
          </div>
          <div style={{ width: 90 }} />
        </nav>

        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem 1.25rem 4rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', alignItems: 'start' }}>

            {/* ══ LEFT: Answer Sheet ══ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: 68 }}>

              {/* Submission info */}
              <div className="fade-up" style={{ background: '#090909', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '1.3rem 1.4rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)', marginBottom: '0.9rem' }}>
                  Submission Details
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {[
                    { k: 'Student',  v: 'Anonymous (Blind Evaluation)' },
                    { k: 'Test',     v: test.title },
                    { k: 'Subject',  v: submission.subject },
                    { k: 'Class',    v: `${submission.department} · Y${submission.year} · D${submission.division}` },
                    { k: 'Uploaded', v: new Date(submission.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
                    ...(!isReadOnly ? [{ k: 'Session', v: sessionStartTime.toLocaleTimeString() }] : []),
                  ].map(row => (
                    <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.32)', flexShrink: 0 }}>{row.k}</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.65)', textAlign: 'right' }}>{row.v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Viewer */}
              <div className="fade-up" style={{ background: '#090909', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '1.3rem 1.4rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)', marginBottom: '0.9rem' }}>
                  Answer Sheet
                </div>

                {/* PDF / Image */}
                <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden', background: 'rgba(255,255,255,0.02)', marginBottom: '0.85rem' }}>
                  {isPDF(submission) ? (
                    <embed src={submission.answerSheetUrl} type="application/pdf" style={{ width: '100%', height: 520, display: 'block', border: 'none' }} title="Answer Sheet PDF" />
                  ) : (
                    <div className="eval-scroll" style={{ width: '100%', maxHeight: 520, overflowY: 'auto' }}>
                      <img src={submission.answerSheetUrl} alt="Answer Sheet" style={{ width: '100%', height: 'auto', display: 'block' }} />
                    </div>
                  )}
                </div>

                {/* File meta */}
                <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 9, padding: '0.75rem 0.9rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {[
                      { k: 'File',  v: submission.fileName },
                      { k: 'Size',  v: `${(submission.fileSize / 1024 / 1024).toFixed(2)} MB` },
                      { k: 'Type',  v: submission.fileType },
                      ...(submission.fileHash ? [{ k: 'Hash', v: submission.fileHash.substring(0, 16) + '…', mono: true }] : []),
                    ].map(row => (
                      <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{row.k}</span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', fontFamily: (row as any).mono ? 'monospace' : 'inherit', textAlign: 'right', wordBreak: 'break-all' }}>{row.v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Open in new window */}
                <OpenNewTabBtn onClick={openInNewWindow} />
              </div>
            </div>

            {/* ══ RIGHT: Marking Form ══ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Error / Success */}
              {error && (
                <div style={{ padding: '0.85rem 1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, display: 'flex', gap: '0.5rem' }}>
                  <span style={{ flexShrink: 0 }}><AlertTriangle size={18} /></span>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(252,165,165,0.95)' }}>{error}</p>
                </div>
              )}
              {success && (
                <div style={{ padding: '0.85rem 1rem', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, display: 'flex', gap: '0.5rem' }}>
                  <span style={{ flexShrink: 0 }}><CheckCircle2 size={18} /></span>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(74,222,128,0.95)' }}>{success}</p>
                </div>
              )}

              {/* Score card */}
              <div className="fade-up2" style={{ background: '#090909', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '1.4rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: `${grade.color}20`, filter: 'blur(30px)', pointerEvents: 'none' }} />
                <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)', marginBottom: '1rem' }}>
                  Score Summary
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.85rem', textAlign: 'center', marginBottom: '1rem' }}>
                  {[
                    { label: 'Marks',      val: `${totalMarksObtained}/${totalMarks}` },
                    { label: 'Percentage', val: `${percentage.toFixed(1)}%` },
                    { label: 'Grade',      val: grade.label, color: grade.color },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '0.85rem 0.5rem' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', marginBottom: '0.4rem' }}>{s.label}</div>
                      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '2rem', lineHeight: 1, color: (s as any).color || '#ffffff' }}>{s.val}</div>
                    </div>
                  ))}
                </div>
                {/* Score bar */}
                <div style={{ height: 4, borderRadius: 100, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 100, width: `${percentage}%`, background: grade.color, boxShadow: `0 0 8px ${grade.color}`, transition: 'width 0.6s ease' }} />
                </div>
              </div>

              {/* Q marking */}
              <div style={{ background: '#090909', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '1.4rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)', marginBottom: '1rem' }}>
                  Question-wise Marking
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {questionMarks.map((qm, idx) => {
                    const ratio = qm.marksObtained / qm.maxMarks;
                    const barColor = ratio >= 0.7 ? 'rgba(34,197,94,0.8)' : ratio >= 0.4 ? 'rgba(251,191,36,0.8)' : 'rgba(239,68,68,0.8)';
                    const desc = test.questions[idx]?.description;
                    return (
                      <div key={qm.questionNumber}
                        style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 11, padding: '1rem 1.1rem', position: 'relative', overflow: 'hidden' }}
                        onFocus={() => handleQuestionFocus(qm.questionNumber)}
                      >
                        {/* Left accent */}
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: barColor, borderRadius: '11px 0 0 11px' }} />

                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: desc ? '0.25rem' : 0 }}>
                              <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue',sans-serif", fontSize: '0.95rem', color: 'rgba(255,255,255,0.5)' }}>
                                {qm.questionNumber}
                              </div>
                              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>Question {qm.questionNumber}</span>
                            </div>
                            {desc && <p style={{ fontSize: '0.73rem', fontWeight: 500, color: 'rgba(255,255,255,0.38)', marginLeft: '2.2rem' }}>{desc}</p>}
                          </div>
                          <div style={{ padding: '0.22rem 0.65rem', borderRadius: 100, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.45)', flexShrink: 0, marginLeft: '0.5rem' }}>
                            Max {qm.maxMarks}
                          </div>
                        </div>

                        {/* Inputs row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '0.65rem', marginBottom: '0.65rem' }}>
                          <div>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.3)', marginBottom: '0.35rem', textTransform: 'uppercase' as const }}>Marks</div>
                            <DarkInput
                              type="number" min="0" max={qm.maxMarks} step="0.5"
                              value={qm.marksObtained} placeholder="0"
                              disabled={isReadOnly}
                              style={{ textAlign: 'center', fontWeight: 800, fontSize: '1rem' }}
                              onChange={e => handleMarksChange(qm.questionNumber, e.target.value)}
                              onFocus={() => handleQuestionFocus(qm.questionNumber)}
                              onBlur={() => handleQuestionBlur(qm.questionNumber)}
                            />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.3)', marginBottom: '0.35rem', textTransform: 'uppercase' as const }}>Comment</div>
                            <DarkInput
                              type="text" value={qm.comment} placeholder="Add feedback…"
                              disabled={isReadOnly}
                              onChange={e => handleCommentChange(qm.questionNumber, e.target.value)}
                              onFocus={() => handleQuestionFocus(qm.questionNumber)}
                              onBlur={() => handleQuestionBlur(qm.questionNumber)}
                            />
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div style={{ height: 4, borderRadius: 100, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 100, width: `${Math.min(ratio * 100, 100)}%`, background: barColor, transition: 'width 0.4s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* General remarks */}
              <div style={{ background: '#090909', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '1.4rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)', marginBottom: '0.75rem' }}>
                  General Remarks <span style={{ fontWeight: 500, letterSpacing: 0, textTransform: 'none' as const, color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem' }}>(optional)</span>
                </div>
                <DarkTextarea
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  disabled={isReadOnly}
                  placeholder="Add overall feedback for the student…"
                />
              </div>

              {/* Actions */}
              {!isReadOnly ? (
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <DraftButton onClick={handleSaveDraft} saving={saving} />
                  <FinalizeButton onClick={handleFinalize} saving={saving} />
                </div>
              ) : (
                <div style={{ background: '#090909', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 14, padding: '1.25rem', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.92rem', fontWeight: 700, color: 'rgba(74,222,128,0.9)' }}>
                    <CheckCircle2 size={18} /> This evaluation has been finalized
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Button sub-components ─── */
function DraftButton({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} disabled={saving} style={{ flex: 1, padding: '0.85rem', borderRadius: 11, background: h ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.14)', fontSize: '0.9rem', fontWeight: 700, color: h ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.5)', cursor: saving ? 'not-allowed' : 'none', fontFamily: 'inherit', opacity: saving ? 0.4 : 1, transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem' }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      {saving ? <LoadingSpinner dark /> : <Save size={18} />}
      {saving ? 'Saving…' : 'Save Draft'}
    </button>
  );
}

function FinalizeButton({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} disabled={saving} style={{ flex: 1, padding: '0.85rem', borderRadius: 11, background: saving ? 'rgba(34,197,94,0.05)' : h ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.12)', border: `1px solid ${h ? 'rgba(34,197,94,0.5)' : 'rgba(34,197,94,0.3)'}`, fontSize: '0.9rem', fontWeight: 800, color: 'rgba(74,222,128,1)', cursor: saving ? 'not-allowed' : 'none', fontFamily: 'inherit', opacity: saving ? 0.5 : 1, transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem' }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      {saving ? <LoadingSpinner /> : <CheckCircle2 size={18} />}
      {saving ? 'Finalizing…' : 'Finalize & Submit'}
    </button>
  );
}

function OpenNewTabBtn({ onClick }: { onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} style={{ width: '100%', padding: '0.7rem', borderRadius: 9, background: h ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${h ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.09)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', fontSize: '0.82rem', fontWeight: 700, color: h ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.38)', cursor: 'none', fontFamily: 'inherit', transition: 'all 0.2s' }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
      </svg>
      Open in New Tab
    </button>
  );
}

function LoadingSpinner({ dark }: { dark?: boolean }) {
  return <div style={{ width: 15, height: 15, borderRadius: '50%', border: `2px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(74,222,128,0.2)'}`, borderTop: `2px solid ${dark ? 'rgba(255,255,255,0.5)' : 'rgba(74,222,128,0.9)'}`, animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />;
}
