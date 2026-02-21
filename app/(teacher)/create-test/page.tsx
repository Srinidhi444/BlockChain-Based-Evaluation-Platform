'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Question {
  questionNumber: number; marks: number; description: string;
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

/* ─── Field label ─── */
function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.5)', marginBottom: '0.5rem' }}>
      {children}
      {required && <span style={{ color: 'rgba(252,165,165,0.8)', marginLeft: '0.2rem' }}>*</span>}
    </div>
  );
}

/* ─── Shared input style ─── */
const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
  padding: '0.7rem 0.9rem', color: '#f0f0f0',
  fontFamily: "'Inter', sans-serif", fontSize: '0.88rem', fontWeight: 500,
  outline: 'none', transition: 'border-color 0.2s, background 0.2s',
};

function DarkInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <input {...props}
      style={{ ...inputStyle, borderColor: focused ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.1)', background: focused ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)', ...props.style }}
      onFocus={e => { setFocused(true); props.onFocus?.(e); }}
      onBlur={e  => { setFocused(false); props.onBlur?.(e); }}
    />
  );
}

function DarkSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <select {...props}
        style={{ ...inputStyle, appearance: 'none', WebkitAppearance: 'none', borderColor: focused ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.1)', background: focused ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)', cursor: 'none', paddingRight: '2.2rem' }}
        onFocus={e => { setFocused(true); props.onFocus?.(e); }}
        onBlur={e  => { setFocused(false); props.onBlur?.(e); }}
      />
      <div style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '5px solid rgba(255,255,255,0.35)', pointerEvents: 'none' }} />
    </div>
  );
}

export default function CreateTestPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    title: '', subject: '', department: '',
    year: 1, division: 'ALL', academicYear: '2025-26',
    examType: 'midterm', examDate: '', totalMarks: 0,
  });

  const [questions, setQuestions] = useState<Question[]>([
    { questionNumber: 1, marks: 0, description: '' },
  ]);

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'year' ? parseInt(value) : value }));
  };

  const handleQuestionChange = (index: number, field: keyof Question, value: string | number) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: field === 'marks' || field === 'questionNumber' ? Number(value) : value };
    setQuestions(updated);
    setFormData(prev => ({ ...prev, totalMarks: updated.reduce((s, q) => s + q.marks, 0) }));
  };

  const addQuestion = () => {
    setQuestions(prev => [...prev, { questionNumber: prev.length + 1, marks: 0, description: '' }]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length === 1) return;
    const updated = questions.filter((_, i) => i !== index).map((q, i) => ({ ...q, questionNumber: i + 1 }));
    setQuestions(updated);
    setFormData(prev => ({ ...prev, totalMarks: updated.reduce((s, q) => s + q.marks, 0) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (questions.some(q => q.marks <= 0)) { setError('All questions must have marks greater than 0'); return; }
    if (formData.totalMarks === 0) { setError('Total marks must be greater than 0'); return; }
    try {
      setLoading(true);
      const res  = await fetch('/api/teacher/create-test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, questions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create test');
      setSuccess('Test created successfully! Redirecting…');
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (err: any) { setError(err.message || 'Failed to create test'); }
    finally { setLoading(false); }
  };

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

        input[type='date']::-webkit-calendar-picker-indicator { filter:invert(0.6); cursor:none; }
        input[type='number']::-webkit-inner-spin-button,
        input[type='number']::-webkit-outer-spin-button { opacity:0.3; }

        .create-scroll::-webkit-scrollbar { width:3px; }
        .create-scroll::-webkit-scrollbar-track { background:transparent; }
        .create-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:10px; }
      `}</style>

      <DashCursor />

      <div style={{ minHeight: '100vh', background: '#050505', fontFamily: "'Inter', system-ui, sans-serif" }}>

        {/* ── Nav ── */}
        <nav style={{
          height: 52, background: 'rgba(5,5,5,0.92)', borderBottom: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center',
          padding: '0 1.75rem', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <NavBackLink href="/dashboard" label="Dashboard" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.28)', fontWeight: 500 }}>
            EvalChain <span style={{ color: 'rgba(255,255,255,0.18)' }}>/</span>
            <span style={{ color: 'rgba(255,255,255,0.55)' }}>Create Test</span>
          </div>
          <div style={{ width: 100 }} />
        </nav>

        {/* ── Body ── */}
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '2.25rem 1.25rem 4rem' }}>

          {/* Heading */}
          <div className="fade-up" style={{ marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', marginBottom: '0.55rem' }}>
              Teacher Portal
            </div>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2.4rem,5vw,3.5rem)', lineHeight: 0.95, color: '#ffffff', letterSpacing: '0.01em' }}>
              CREATE<br/>
              <span style={{ WebkitTextStroke: '0.5px rgba(255,255,255,0.9)', color: 'transparent' }}>QUESTION PAPER</span>
            </h1>
          </div>

          <form onSubmit={handleSubmit}>

            {/* ── Section 1: Basic Info ── */}
            <div className="fade-up2" style={{ background: '#090909', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '1.5rem', marginBottom: '1rem' }}>
              <SectionLabel icon="📋">Test Details</SectionLabel>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

                <div style={{ gridColumn: '1 / -1' }}>
                  <Label required>Test Title</Label>
                  <DarkInput type="text" name="title" required placeholder="e.g., Data Structures Mid-term" value={formData.title} onChange={handleInputChange} />
                </div>

                <div>
                  <Label required>Subject</Label>
                  <DarkInput type="text" name="subject" required placeholder="e.g., Data Structures" value={formData.subject} onChange={handleInputChange} />
                </div>

                <div>
                  <Label required>Department</Label>
                  <DarkInput type="text" name="department" required placeholder="e.g., Computer Science" value={formData.department} onChange={handleInputChange} />
                </div>

                <div>
                  <Label required>Year</Label>
                  <DarkSelect name="year" required value={formData.year} onChange={handleInputChange}>
                    <option value={1}>First Year</option>
                    <option value={2}>Second Year</option>
                    <option value={3}>Third Year</option>
                    <option value={4}>Fourth Year</option>
                  </DarkSelect>
                </div>

                <div>
                  <Label>Division</Label>
                  <DarkInput type="text" name="division" placeholder="A, B, C or ALL" value={formData.division} onChange={handleInputChange} />
                </div>

                <div>
                  <Label required>Academic Year</Label>
                  <DarkInput type="text" name="academicYear" required placeholder="2025-26" value={formData.academicYear} onChange={handleInputChange} />
                </div>

                <div>
                  <Label required>Exam Type</Label>
                  <DarkSelect name="examType" required value={formData.examType} onChange={handleInputChange}>
                    <option value="midterm">Mid-term</option>
                    <option value="endsem">End Semester</option>
                    <option value="assignment">Assignment</option>
                    <option value="quiz">Quiz</option>
                  </DarkSelect>
                </div>

                <div>
                  <Label required>Exam Date</Label>
                  <DarkInput type="date" name="examDate" required value={formData.examDate} onChange={handleInputChange} />
                </div>

              </div>
            </div>

            {/* ── Section 2: Questions ── */}
            <div className="fade-up3" style={{ background: '#090909', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '1.5rem', marginBottom: '1rem' }}>

              {/* Questions header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <SectionLabel icon="❓" noMargin>Questions</SectionLabel>
                {/* Total marks pill */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.9rem', borderRadius: 100, background: 'rgba(147,197,253,0.1)', border: '1px solid rgba(147,197,253,0.25)' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'rgba(147,197,253,0.7)' }}>Total</span>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.4rem', lineHeight: 1, color: 'rgba(147,197,253,1)' }}>{formData.totalMarks}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'rgba(147,197,253,0.6)' }}>marks</span>
                </div>
              </div>

              {/* Question rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                {questions.map((q, idx) => (
                  <QuestionRow
                    key={idx}
                    question={q}
                    index={idx}
                    canRemove={questions.length > 1}
                    onChange={handleQuestionChange}
                    onRemove={removeQuestion}
                  />
                ))}
              </div>

              {/* Add question */}
              <AddQuestionButton onClick={addQuestion} />
            </div>

            {/* ── Error / Success ── */}
            {error && (
              <div style={{ marginBottom: '1rem', padding: '0.85rem 1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: '0.55rem' }}>
                <span style={{ flexShrink: 0 }}>⚠️</span>
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(252,165,165,0.95)' }}>{error}</p>
              </div>
            )}
            {success && (
              <div style={{ marginBottom: '1rem', padding: '0.85rem 1rem', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: '0.55rem' }}>
                <span style={{ flexShrink: 0 }}>✅</span>
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(74,222,128,0.95)' }}>{success}</p>
              </div>
            )}

            {/* ── Submit row ── */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <SubmitButton loading={loading} disabled={loading || !!success} />
              <CancelLink href="/dashboard" />
            </div>

          </form>
        </div>
      </div>
    </>
  );
}

/* ──────────── Sub-components ──────────── */

function NavBackLink({ href, label }: { href: string; label: string }) {
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

function SectionLabel({ icon, children, noMargin }: { icon: string; children: React.ReactNode; noMargin?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: noMargin ? 0 : '1.1rem' }}>
      <span style={{ fontSize: '1rem' }}>{icon}</span>
      <span style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)' }}>
        {children}
      </span>
    </div>
  );
}

function QuestionRow({ question, index, canRemove, onChange, onRemove }: {
  question: Question; index: number; canRemove: boolean;
  onChange: (i: number, f: keyof Question, v: string | number) => void;
  onRemove: (i: number) => void;
}) {
  const [removeHover, setRemoveHover] = useState(false);
  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '1rem 1.1rem', position: 'relative' }}>
      {/* Left number tag */}
      <div style={{ position: 'absolute', left: '-1px', top: '50%', transform: 'translateY(-50%)', width: 3, height: '60%', background: 'rgba(147,197,253,0.5)', borderRadius: '0 3px 3px 0', boxShadow: '0 0 8px rgba(147,197,253,0.3)' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        {/* Q number badge */}
        <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue',sans-serif", fontSize: '1rem', color: 'rgba(255,255,255,0.5)' }}>
          {question.questionNumber}
        </div>

        {/* Description */}
        <div style={{ flex: 2 }}>
          <input
            type="text"
            placeholder="Question description (optional)"
            value={question.description}
            onChange={e => onChange(index, 'description', e.target.value)}
            style={{ ...inputStyle, width: '100%' }}
            onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)')}
            onBlur={e  => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
          />
        </div>

        {/* Marks */}
        <div style={{ flex: '0 0 110px' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              placeholder="Marks"
              min="0"
              required
              value={question.marks || ''}
              onChange={e => onChange(index, 'marks', e.target.value)}
              style={{ ...inputStyle, width: '100%', paddingRight: '2.5rem', textAlign: 'center', fontWeight: 800 }}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(147,197,253,0.5)')}
              onBlur={e  => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
            />
            <div style={{ position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.25)', pointerEvents: 'none' }}>
              pts
            </div>
          </div>
        </div>

        {/* Remove */}
        {canRemove && (
          <button type="button" onClick={() => onRemove(index)} style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: removeHover ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${removeHover ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'none', transition: 'all 0.2s' }}
            onMouseEnter={() => setRemoveHover(true)}
            onMouseLeave={() => setRemoveHover(false)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={removeHover ? 'rgba(252,165,165,0.9)' : 'rgba(255,255,255,0.35)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function AddQuestionButton({ onClick }: { onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button type="button" onClick={onClick} style={{ width: '100%', padding: '0.75rem', borderRadius: 11, background: h ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)', border: `1px dashed ${h ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 700, color: h ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)', cursor: 'none', fontFamily: 'inherit', transition: 'all 0.2s' }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      Add Question
    </button>
  );
}

function SubmitButton({ loading, disabled }: { loading: boolean; disabled: boolean }) {
  const [h, setH] = useState(false);
  return (
    <button type="submit" disabled={disabled} style={{ flex: 1, padding: '0.9rem', borderRadius: 11, background: disabled ? 'rgba(255,255,255,0.08)' : h ? 'rgba(240,240,240,0.92)' : '#f0f0f0', border: 'none', color: '#000', fontFamily: 'inherit', fontSize: '0.95rem', fontWeight: 800, cursor: disabled ? 'not-allowed' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'opacity 0.2s, box-shadow 0.2s', opacity: disabled ? 0.35 : 1, boxShadow: h && !disabled ? '0 0 28px rgba(255,255,255,0.18)' : 'none' }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      {loading ? (
        <>
          <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.2)', borderTop: '2px solid #000', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
          Creating Test…
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Create Test
        </>
      )}
    </button>
  );
}

function CancelLink({ href }: { href: string }) {
  const [h, setH] = useState(false);
  return (
    <Link href={href} style={{ padding: '0.9rem 1.6rem', borderRadius: 11, background: h ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${h ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)'}`, fontSize: '0.9rem', fontWeight: 700, color: h ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)', textDecoration: 'none', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      Cancel
    </Link>
  );
}
