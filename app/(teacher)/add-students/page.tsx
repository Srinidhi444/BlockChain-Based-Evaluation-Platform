'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface StudentFormData {
  name: string; email: string; department: string; year: number; division: string;
}
interface CreatedStudent {
  userId: string; password: string; name: string; email: string; emailSent: boolean;
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

/* ─── Shared input style ─── */
const baseInput: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9,
  padding: '0.65rem 0.9rem', color: '#f0f0f0',
  fontFamily: "'Inter',sans-serif", fontSize: '0.85rem', fontWeight: 500,
  outline: 'none', transition: 'border-color 0.2s, background 0.2s',
};

function DarkInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [f, setF] = useState(false);
  return (
    <input {...props}
      style={{ ...baseInput, borderColor: f ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.1)', background: f ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)', ...props.style }}
      onFocus={e => { setF(true); props.onFocus?.(e); }}
      onBlur={e  => { setF(false); props.onBlur?.(e); }}
    />
  );
}

function DarkSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const [f, setF] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <select {...props}
        style={{ ...baseInput, appearance: 'none', WebkitAppearance: 'none', cursor: 'none', paddingRight: '2.2rem', borderColor: f ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.1)', background: f ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)' }}
        onFocus={e => { setF(true); props.onFocus?.(e); }}
        onBlur={e  => { setF(false); props.onBlur?.(e); }}
      />
      <div style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '5px solid rgba(255,255,255,0.35)', pointerEvents: 'none' }} />
    </div>
  );
}

/* ─── Field wrapper ─── */
function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.45)', marginBottom: '0.4rem', textTransform: 'uppercase' as const }}>
        {label}
        {required && <span style={{ color: 'rgba(252,165,165,0.7)', marginLeft: '0.2rem' }}>*</span>}
      </div>
      {children}
      {hint && <div style={{ fontSize: '0.7rem', fontWeight: 500, color: 'rgba(255,255,255,0.28)', marginTop: '0.3rem' }}>{hint}</div>}
    </div>
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

/* ─── Credential row ─── */
function CredRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.85rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}>
      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.32)', letterSpacing: '0.06em', textTransform: 'uppercase' as const, flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontFamily: mono ? 'monospace' : 'inherit', fontSize: '0.85rem', fontWeight: 700, color: 'rgba(147,197,253,1)', letterSpacing: mono ? '0.05em' : 0 }}>{value}</span>
        <button onClick={copy} title="Copy"
          style={{ width: 24, height: 24, borderRadius: 6, background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'none', transition: 'all 0.2s', flexShrink: 0 }}>
          {copied
            ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(74,222,128,0.9)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          }
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════ MAIN PAGE ══════════════════════════ */
export default function AddStudentsPage() {
  const router = useRouter();

  const [formData, setFormData] = useState<StudentFormData>({ name: '', email: '', department: '', year: 1, division: 'A' });
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');
  const [createdStudent, setCreatedStudent] = useState<CreatedStudent | null>(null);

  const departments = ['Computer Science', 'Information Technology', 'Electronics', 'Mechanical', 'Civil', 'Electrical', 'Chemical'];
  const divisions   = ['A', 'B', 'C', 'D', 'E'];
  const years       = [1, 2, 3, 4];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'year' ? parseInt(value) : value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) { setError('Please enter a valid email address'); return; }
    if (!formData.name || !formData.email || !formData.department) { setError('Please fill in all required fields'); return; }
    try {
      setLoading(true); setError(''); setSuccess(''); setCreatedStudent(null);
      const res  = await fetch('/api/teacher/add-student', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add student');
      setCreatedStudent({ userId: data.data.credentials.userId, password: data.data.credentials.password, name: data.data.student.name, email: data.data.student.email, emailSent: data.data.credentials.emailSent });
      setSuccess(data.message);
      setFormData(prev => ({ name: '', email: '', department: prev.department, year: prev.year, division: prev.division }));
    } catch (err: any) { setError(err.message || 'Failed to add student'); }
    finally { setLoading(false); }
  };

  const copyAllCredentials = () => {
    if (!createdStudent) return;
    navigator.clipboard.writeText(`Student Login Credentials\n\nName: ${createdStudent.name}\nUser ID: ${createdStudent.userId}\nPassword: ${createdStudent.password}\nEmail: ${createdStudent.email}`);
    alert('All credentials copied!');
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
        @keyframes slideIn{ from{opacity:0;transform:translateY(10px) scale(0.98);} to{opacity:1;transform:translateY(0) scale(1);} }

        .fade-up  { animation:fadeUp 0.45s ease both; }
        .fade-up2 { animation:fadeUp 0.45s ease both; animation-delay:0.08s; }
        .slide-in { animation:slideIn 0.4s ease both; }

        select option { background:#1a1a1a; color:#f0f0f0; }
      `}</style>

      <DashCursor />

      <div style={{ minHeight: '100vh', background: '#050505', fontFamily: "'Inter',system-ui,sans-serif" }}>

        {/* ── Nav ── */}
        <nav style={{ height: 52, background: 'rgba(5,5,5,0.92)', borderBottom: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', padding: '0 1.75rem', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
          <NavBack href="/dashboard" label="Dashboard" />
          <div style={{ fontSize: '0.78rem', fontWeight: 500, color: 'rgba(255,255,255,0.28)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            EvalChain <span style={{ color: 'rgba(255,255,255,0.18)' }}>/</span>
            <span style={{ color: 'rgba(255,255,255,0.55)' }}>Add Students</span>
          </div>
          <div style={{ width: 90 }} />
        </nav>

        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2.25rem 1.25rem 4rem' }}>

          {/* ── Heading ── */}
          <div className="fade-up" style={{ marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', marginBottom: '0.55rem' }}>
              Teacher Portal
            </div>
            <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(2.4rem,5vw,3.5rem)', lineHeight: 0.95, color: '#ffffff', letterSpacing: '0.01em' }}>
              ADD<br/>
              <span style={{ WebkitTextStroke: '0.5px rgba(255,255,255,0.9)', color: 'transparent' }}>STUDENTS</span>
            </h1>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', alignItems: 'start' }}>

            {/* ══ LEFT: Form ══ */}
            <div className="fade-up2" style={{ background: '#090909', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '1.5rem' }}>
              <div style={{ marginBottom: '1.4rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)', marginBottom: '0.5rem' }}>
                  New Student
                </div>
                <p style={{ fontSize: '0.82rem', fontWeight: 500, color: 'rgba(255,255,255,0.4)', lineHeight: 1.55 }}>
                  Enter student details to create their account. Credentials will be sent via email automatically.
                </p>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                <Field label="Full Name" required>
                  <DarkInput type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="Enter student's full name" required />
                </Field>

                <Field label="College Email" required hint="Credentials will be sent to this address">
                  <DarkInput type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="student@college.edu" required />
                </Field>

                <Field label="Department" required>
                  <DarkSelect name="department" value={formData.department} onChange={handleInputChange} required>
                    <option value="">Select Department</option>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </DarkSelect>
                </Field>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <Field label="Year" required>
                    <DarkSelect name="year" value={formData.year} onChange={handleInputChange} required>
                      {years.map(y => <option key={y} value={y}>Year {y}</option>)}
                    </DarkSelect>
                  </Field>
                  <Field label="Division" required>
                    <DarkSelect name="division" value={formData.division} onChange={handleInputChange} required>
                      {divisions.map(d => <option key={d} value={d}>Division {d}</option>)}
                    </DarkSelect>
                  </Field>
                </div>

                {/* Error */}
                {error && (
                  <div style={{ padding: '0.8rem 1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 9, display: 'flex', gap: '0.5rem' }}>
                    <span style={{ flexShrink: 0 }}>⚠️</span>
                    <p style={{ fontSize: '0.83rem', fontWeight: 600, color: 'rgba(252,165,165,0.95)' }}>{error}</p>
                  </div>
                )}

                {/* Success */}
                {success && (
                  <div style={{ padding: '0.8rem 1rem', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 9, display: 'flex', gap: '0.5rem' }}>
                    <span style={{ flexShrink: 0 }}>✅</span>
                    <p style={{ fontSize: '0.83rem', fontWeight: 600, color: 'rgba(74,222,128,0.95)' }}>{success}</p>
                  </div>
                )}

                {/* Submit */}
                <SubmitButton loading={loading} />
              </form>
            </div>

            {/* ══ RIGHT: Info / Credentials ══ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Instructions */}
              {!createdStudent && (
                <div className="fade-up2" style={{ background: '#090909', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '1.4rem' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)', marginBottom: '1rem' }}>
                    Instructions
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {[
                      'Fill in the student\'s details in the form',
                      'Use their official college email address',
                      'Click "Add Student" to create their account',
                      'Login credentials will be auto-generated and sent via email',
                      'You can copy and share credentials manually if needed',
                    ].map((step, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{ width: 22, height: 22, borderRadius: 7, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.45)', flexShrink: 0, marginTop: '0.05rem' }}>
                          {i + 1}
                        </div>
                        <span style={{ fontSize: '0.83rem', fontWeight: 500, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* What happens next (pre-creation) */}
              {!createdStudent && (
                <div style={{ background: '#090909', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '1.4rem' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)', marginBottom: '1rem' }}>
                    What Happens Next
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {[
                      { icon: '🔑', text: 'A unique User ID and password will be generated' },
                      { icon: '📧', text: 'Credentials will be sent to the student\'s email' },
                      { icon: '👤', text: 'Student can login immediately using their credentials' },
                      { icon: '🔒', text: 'Student should change their password on first login' },
                    ].map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                        <span style={{ fontSize: '1rem', flexShrink: 0 }}>{item.icon}</span>
                        <span style={{ fontSize: '0.83rem', fontWeight: 500, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Created student credentials */}
              {createdStudent && (
                <div className="slide-in" style={{ background: '#090909', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 14, padding: '1.4rem', position: 'relative', overflow: 'hidden' }}>
                  {/* Glow */}
                  <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', filter: 'blur(30px)', pointerEvents: 'none' }} />

                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>✅</div>
                      <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'rgba(74,222,128,0.9)' }}>Student Created!</span>
                    </div>
                    <EmailPill sent={createdStudent.emailSent} />
                  </div>

                  {/* Student info */}
                  <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '0.9rem 1rem', marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      {[
                        { k: 'Name',  v: createdStudent.name },
                        { k: 'Email', v: createdStudent.email },
                      ].map(row => (
                        <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', flexShrink: 0 }}>{row.k}</span>
                          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.65)', textAlign: 'right' }}>{row.v}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Credentials */}
                  <div style={{ marginBottom: '0.85rem' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', marginBottom: '0.55rem' }}>
                      Login Credentials
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      <CredRow label="User ID"  value={createdStudent.userId}   mono />
                      <CredRow label="Password" value={createdStudent.password} mono />
                    </div>
                  </div>

                  {/* Copy all */}
                  <CopyAllButton onClick={copyAllCredentials} />

                  {/* Email warning */}
                  {!createdStudent.emailSent && (
                    <div style={{ marginTop: '0.85rem', padding: '0.75rem 0.9rem', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 9 }}>
                      <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(253,224,71,0.85)', lineHeight: 1.5 }}>
                        <strong>⚠️ Note:</strong> Email could not be sent. Please share credentials with the student manually.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Sub-components ─── */
function SubmitButton({ loading }: { loading: boolean }) {
  const [h, setH] = useState(false);
  return (
    <button type="submit" disabled={loading}
      style={{ width: '100%', padding: '0.88rem', borderRadius: 10, background: loading ? 'rgba(255,255,255,0.05)' : h ? 'rgba(240,240,240,0.92)' : '#f0f0f0', border: 'none', color: '#000', fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 800, cursor: loading ? 'not-allowed' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'opacity 0.2s, box-shadow 0.2s', opacity: loading ? 0.35 : 1, boxShadow: h && !loading ? '0 0 26px rgba(255,255,255,0.15)' : 'none' }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      {loading
        ? <><div style={{ width: 15, height: 15, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.2)', borderTop: '2px solid #000', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />Creating Student…</>
        : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>Add Student</>
      }
    </button>
  );
}

function EmailPill({ sent }: { sent: boolean }) {
  return (
    <div style={{ padding: '0.22rem 0.7rem', borderRadius: 100, background: sent ? 'rgba(34,197,94,0.1)' : 'rgba(251,191,36,0.1)', border: `1px solid ${sent ? 'rgba(34,197,94,0.3)' : 'rgba(251,191,36,0.3)'}`, fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em', color: sent ? 'rgba(74,222,128,0.9)' : 'rgba(253,224,71,0.9)', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const }}>
      {sent ? '📧 Email Sent' : '⚠️ Email Failed'}
    </div>
  );
}

function CopyAllButton({ onClick }: { onClick: () => void }) {
  const [h, setH] = useState(false);
  const [copied, setCopied] = useState(false);
  const handle = () => { onClick(); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button onClick={handle}
      style={{ width: '100%', padding: '0.72rem', borderRadius: 9, background: copied ? 'rgba(34,197,94,0.1)' : h ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)', border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : h ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', fontSize: '0.83rem', fontWeight: 700, color: copied ? 'rgba(74,222,128,0.9)' : h ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)', cursor: 'none', fontFamily: 'inherit', transition: 'all 0.2s' }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      {copied
        ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>Copied!</>
        : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copy All Credentials</>
      }
    </button>
  );
}
