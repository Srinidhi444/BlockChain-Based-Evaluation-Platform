'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Link as LinkIcon, FileText, Image, Pin } from 'lucide-react';

interface Test {
  _id: string; testId: string; title: string;
  subject: string; department: string; examType: string;
  examDate: string; totalMarks: number;
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

export default function UploadPage() {
  const router = useRouter();
  const [tests, setTests]               = useState<Test[]>([]);
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [file, setFile]                 = useState<File | null>(null);
  const [filePreview, setFilePreview]   = useState<string | null>(null);
  const [loading, setLoading]           = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');
  const [blockchainInfo, setBlockchainInfo] = useState<{
    submissionId: string; blockchainTxHash: string; fileHash: string;
  } | null>(null);

  useEffect(() => { fetchAvailableTests(); }, []);

  const fetchAvailableTests = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/student/available-tests');
      if (!res.ok) {
        if (res.status === 401) { router.push('/login'); return; }
        throw new Error('Failed to fetch tests');
      }
      const data = await res.json();
      setTests(data.data.tests);
    } catch (err: any) {
      setError(err.message || 'Failed to load available tests');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) { setFile(null); setFilePreview(null); return; }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowed.includes(f.type)) {
      setError('Only PDF, JPEG, and PNG files are allowed');
      setFile(null); return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError(`File size (${(f.size / 1024 / 1024).toFixed(2)} MB) exceeds 10 MB limit`);
      setFile(null); return;
    }
    setFile(f); setError('');
    if (f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setFilePreview(ev.target?.result as string);
      reader.readAsDataURL(f);
    } else { setFilePreview(null); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBlockchainInfo(null);
    if (!selectedTest) { setError('Please select a test'); return; }
    if (!file)         { setError('Please select a file to upload'); return; }
    try {
      setUploading(true); setError(''); setSuccess('');
      const formData = new FormData();
      formData.append('testId', selectedTest.testId);
      formData.append('answerSheet', file);
      const res  = await fetch('/api/student/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      const { submissionId, blockchainTxHash, fileHash } = data.data;
      setBlockchainInfo({ submissionId, blockchainTxHash, fileHash });
      setSuccess('Submission recorded on blockchain successfully!');
      setFile(null); setFilePreview(null); setSelectedTest(null);
      fetchAvailableTests();
    } catch (err: any) {
      setError(err.message || 'Failed to upload answer sheet');
    } finally {
      setUploading(false);
    }
  };

  /* ── Loading screen ── */
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
          <p style={{ marginTop: '1rem', fontSize: '0.88rem', fontWeight: 500, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>
            Loading available tests…
          </p>
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

        /* ── Cursor ── */
        .c-dot{position:fixed;width:7px;height:7px;background:#fff;border-radius:50%;pointer-events:none;z-index:99999;transform:translate(-50%,-50%);mix-blend-mode:difference;}
        .c-ring{position:fixed;width:32px;height:32px;border:1px solid rgba(255,255,255,0.6);border-radius:50%;pointer-events:none;z-index:99998;transform:translate(-50%,-50%);mix-blend-mode:difference;}

        @keyframes spin    { to{transform:rotate(360deg);} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(16px);} to{opacity:1;transform:translateY(0);} }

        .upload-page-scroll::-webkit-scrollbar{width:3px;}
        .upload-page-scroll::-webkit-scrollbar-track{background:transparent;}
        .upload-page-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:10px;}

        .test-card{
          background:rgba(255,255,255,0.025);
          border:1px solid rgba(255,255,255,0.08);
          border-radius:12px; padding:1.1rem 1.25rem;
          cursor:pointer;
          transition:background 0.2s, border-color 0.2s, transform 0.2s;
        }
        .test-card:hover{
          background:rgba(255,255,255,0.04);
          border-color:rgba(255,255,255,0.15);
          transform:translateY(-1px);
        }
        .test-card.selected{
          background:rgba(255,255,255,0.06);
          border-color:rgba(255,255,255,0.3);
          box-shadow:0 0 0 1px rgba(255,255,255,0.08), 0 4px 20px rgba(0,0,0,0.3);
        }

        .drop-zone{
          border:1.5px dashed rgba(255,255,255,0.12);
          border-radius:14px; padding:2.5rem 1.5rem;
          text-align:center;
          transition:border-color 0.2s, background 0.2s;
          background:rgba(255,255,255,0.015);
        }
        .drop-zone:hover{
          border-color:rgba(255,255,255,0.28);
          background:rgba(255,255,255,0.03);
        }
        .drop-zone.has-file{
          border-style:solid;
          border-color:rgba(255,255,255,0.18);
          background:rgba(255,255,255,0.03);
        }

        .submit-btn{
          width:100%; padding:0.9rem;
          background:#f0f0f0; color:#000;
          font-family:inherit; font-size:0.95rem; font-weight:800;
          border:none; border-radius:10px; cursor:none;
          letter-spacing:0.01em;
          transition:opacity 0.2s, box-shadow 0.2s;
          box-shadow:0 0 20px rgba(255,255,255,0.1);
          display:flex; align-items:center; justify-content:center; gap:0.5rem;
        }
        .submit-btn:hover:not(:disabled){
          opacity:0.88;
          box-shadow:0 0 30px rgba(255,255,255,0.18);
        }
        .submit-btn:disabled{
          opacity:0.3; cursor:not-allowed;
          box-shadow:none;
        }

        .cancel-btn{
          padding:0.9rem 1.75rem;
          background:rgba(255,255,255,0.05);
          border:1px solid rgba(255,255,255,0.1);
          border-radius:10px; cursor:none;
          font-family:inherit; font-size:0.88rem; font-weight:600;
          color:rgba(255,255,255,0.55);
          text-decoration:none; display:flex; align-items:center;
          transition:background 0.2s, color 0.2s;
        }
        .cancel-btn:hover{
          background:rgba(255,255,255,0.08);
          color:rgba(255,255,255,0.85);
        }

        .section-label{
          font-size:0.68rem; font-weight:800;
          letter-spacing:0.16em; text-transform:uppercase;
          color:rgba(255,255,255,0.35); margin-bottom:0.75rem;
        }

        .fade-up{ animation:fadeUp 0.5s ease both; }
      `}</style>

      <DashCursor />

      <div style={{ minHeight: '100vh', background: '#050505', fontFamily: "'Inter', system-ui, sans-serif" }}>

        {/* ── Top Nav ── */}
        <nav style={{
          height: 52, background: 'rgba(5,5,5,0.9)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(20px)',
          display: 'flex', alignItems: 'center',
          padding: '0 1.75rem', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <Link href="/student-dashboard" style={{
            display: 'flex', alignItems: 'center', gap: '0.45rem',
            fontSize: '0.85rem', fontWeight: 600,
            color: 'rgba(255,255,255,0.45)', textDecoration: 'none',
            transition: 'color 0.2s',
          }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Dashboard
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.28)', fontWeight: 500 }}>
            GRADEX
            <span style={{ color: 'rgba(255,255,255,0.18)' }}>/</span>
            <span style={{ color: 'rgba(255,255,255,0.55)' }}>Upload</span>
          </div>

          <div style={{ width: 80 }} />
        </nav>

        {/* ── Page body ── */}
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '2.25rem 1.25rem 4rem' }}>

          {/* Page heading */}
          <div className="fade-up" style={{ marginBottom: '2rem' }}>
            <div style={{
              fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.18em',
              textTransform: 'uppercase' as const,
              color: 'rgba(255,255,255,0.3)', marginBottom: '0.55rem',
            }}>
              Answer Sheet
            </div>
            <h1 style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 'clamp(2.4rem, 5vw, 3.5rem)',
              lineHeight: 0.95, color: '#ffffff', letterSpacing: '0.01em',
            }}>
              SUBMIT YOUR<br/>
              <span style={{ WebkitTextStroke: '0.5px rgba(255,255,255,0.9)', color: 'transparent' }}>
                ANSWER SHEET
              </span>
            </h1>
          </div>

          {/* ── Error Banner ── */}
          {error && (
            <div className="fade-up" style={{
              marginBottom: '1.25rem', padding: '1rem 1.25rem',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 12, display: 'flex', alignItems: 'flex-start', gap: '0.65rem',
            }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'rgba(252,165,165,0.95)' }}>
                {error}
              </p>
            </div>
          )}

          {/* ── Success Banner ── */}
          {success && (
            <div className="fade-up" style={{
              marginBottom: '1.25rem', padding: '1rem 1.25rem',
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: 12, display: 'flex', alignItems: 'flex-start', gap: '0.65rem',
            }}>
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'rgba(74,222,128,0.95)' }}>
                {success}
              </p>
            </div>
          )}

          {/* ── Blockchain Info Card ── */}
          {blockchainInfo && (
            <div className="fade-up" style={{
              marginBottom: '1.5rem', padding: '1.25rem',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 14, position: 'relative', overflow: 'hidden',
            }}>
              {/* Glow orb */}
              <div style={{
                position: 'absolute', top: -30, right: -30, width: 100, height: 100,
                borderRadius: '50%', background: 'rgba(167,139,250,0.12)',
                filter: 'blur(30px)', pointerEvents: 'none',
              }} />

              <div style={{
                fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.16em',
                textTransform: 'uppercase' as const,
                color: 'rgba(167,139,250,0.85)', marginBottom: '1rem',
                display: 'flex', alignItems: 'center', gap: '0.4rem',
              }}>
                <LinkIcon size={18} /> Blockchain Verification
              </div>

              {[
                { label: 'Submission ID',       val: blockchainInfo.submissionId,     link: null },
                { label: 'File Hash (SHA-256)', val: blockchainInfo.fileHash,          link: null },
                { label: 'Transaction Hash',    val: blockchainInfo.blockchainTxHash,
                  link: `https://sepolia.etherscan.io/tx/${blockchainInfo.blockchainTxHash}` },
              ].map(row => (
                <div key={row.label} style={{ marginBottom: '0.85rem' }}>
                  <div style={{
                    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
                    textTransform: 'uppercase' as const,
                    color: 'rgba(255,255,255,0.3)', marginBottom: '0.25rem',
                  }}>
                    {row.label}
                  </div>
                  {row.link ? (
                    <a href={row.link} target="_blank" style={{
                      fontSize: '0.78rem', fontWeight: 500,
                      color: 'rgba(167,139,250,0.9)', wordBreak: 'break-all',
                      fontFamily: 'monospace', textDecoration: 'none',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(216,180,254,1)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(167,139,250,0.9)')}
                    >
                      {row.val} ↗
                    </a>
                  ) : (
                    <div style={{
                      fontSize: '0.78rem', fontWeight: 500,
                      color: 'rgba(255,255,255,0.55)', wordBreak: 'break-all',
                      fontFamily: 'monospace',
                    }}>
                      {row.val}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Form ── */}
          <form onSubmit={handleSubmit}>

            {/* ── Step 1: Select Test ── */}
            <div className="fade-up" style={{
              background: '#090909', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16, padding: '1.5rem', marginBottom: '1rem',
              animationDelay: '0.05s',
            }}>
              <div className="section-label">Step 1 — Select Test</div>

              {tests.length === 0 ? (
                <div style={{
                  padding: '1.75rem', textAlign: 'center',
                  background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)',
                  borderRadius: 12,
                }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📭</div>
                  <p style={{ fontSize: '0.92rem', fontWeight: 700, color: 'rgba(253,224,71,0.9)', marginBottom: '0.3rem' }}>
                    No tests available right now
                  </p>
                  <p style={{ fontSize: '0.8rem', fontWeight: 500, color: 'rgba(253,224,71,0.55)' }}>
                    Check back later or contact your teacher.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {tests.map(test => {
                    const isSelected = selectedTest?._id === test._id;
                    return (
                      <div
                        key={test._id}
                        onClick={() => setSelectedTest(test)}
                        className={`test-card${isSelected ? ' selected' : ''}`}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                              {/* Radio dot */}
                              <div style={{
                                width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                                border: `2px solid ${isSelected ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)'}`,
                                background: isSelected ? 'rgba(255,255,255,0.9)' : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.2s',
                              }}>
                                {isSelected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#000' }} />}
                              </div>
                              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: isSelected ? '#ffffff' : 'rgba(255,255,255,0.8)' }}>
                                {test.title}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '1.4rem', flexWrap: 'wrap' as const }}>
                              <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'rgba(255,255,255,0.45)' }}>
                                {test.subject}
                              </span>
                              <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                              <span style={{
                                fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em',
                                textTransform: 'uppercase' as const,
                                padding: '0.15rem 0.5rem', borderRadius: 100,
                                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                color: 'rgba(255,255,255,0.5)',
                              }}>
                                {test.examType}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.74rem', fontWeight: 500, color: 'rgba(255,255,255,0.28)', paddingLeft: '1.4rem', marginTop: '0.25rem' }}>
                              Exam date: {new Date(test.examDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          </div>

                          {/* Marks */}
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.28)', marginBottom: '0.2rem' }}>
                              Total Marks
                            </div>
                            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.8rem', lineHeight: 1, color: '#ffffff' }}>
                              {test.totalMarks}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Step 2: File Upload ── */}
            <div className="fade-up" style={{
              background: '#090909', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16, padding: '1.5rem', marginBottom: '1rem',
              animationDelay: '0.1s',
            }}>
              <div className="section-label">Step 2 — Upload Answer Sheet</div>

              <input
                type="file" id="file-upload"
                accept="application/pdf,image/jpeg,image/png,image/jpg"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                disabled={tests.length === 0}
              />

              <label
                htmlFor="file-upload"
                style={{ display: 'block', cursor: tests.length === 0 ? 'not-allowed' : 'none', opacity: tests.length === 0 ? 0.4 : 1 }}
              >
                <div className={`drop-zone${file ? ' has-file' : ''}`}>
                  {file ? (
                    <>
                      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
                        {file.type === 'application/pdf' ? <FileText size={18} /> : <Image size={18} />}
                      </div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.3rem' }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'rgba(255,255,255,0.4)' }}>
                        {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type}
                      </div>
                      <button
                        type="button"
                        onClick={e => { e.preventDefault(); setFile(null); setFilePreview(null); }}
                        style={{
                          marginTop: '1rem', padding: '0.4rem 1rem',
                          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                          borderRadius: 8, cursor: 'none', fontFamily: 'inherit',
                          fontSize: '0.8rem', fontWeight: 700, color: 'rgba(252,165,165,0.9)',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.18)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                      >
                        Remove File
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📁</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)', marginBottom: '0.3rem' }}>
                        Click to upload or drag and drop
                      </div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'rgba(255,255,255,0.35)' }}>
                        PDF, JPEG, PNG · up to 10 MB
                      </div>
                    </>
                  )}
                </div>
              </label>

              {/* Image preview */}
              {filePreview && (
                <div style={{ marginTop: '1.25rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', marginBottom: '0.65rem' }}>
                    Preview
                  </div>
                  <img
                    src={filePreview} alt="Preview"
                    style={{
                      maxHeight: 260, display: 'block', margin: '0 auto',
                      borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    }}
                  />
                </div>
              )}
            </div>

            {/* ── Important Notes ── */}
            <div className="fade-up" style={{
              background: '#090909', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16, padding: '1.25rem 1.5rem', marginBottom: '1.5rem',
              animationDelay: '0.15s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                <Pin size={18} />
                <div className="section-label" style={{ marginBottom: 0 }}>Important Notes</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {[
                  'Ensure your answer sheet is clear and readable',
                  'A unique SHA-256 hash will be generated to ensure integrity',
                  'This hash will be stored on-chain for immutability',
                  'You cannot modify the submission after upload',
                  'Evaluation will be done anonymously by teachers',
                ].map((note, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: '0.05rem',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.6rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)',
                    }}>
                      {i + 1}
                    </div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                      {note}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Submit ── */}
            <div className="fade-up" style={{ display: 'flex', gap: '0.75rem', animationDelay: '0.2s' }}>
              <button
                type="submit"
                disabled={!selectedTest || !file || uploading}
                className="submit-btn"
              >
                {uploading ? (
                  <>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%',
                      border: '2px solid rgba(0,0,0,0.2)', borderTop: '2px solid #000',
                      animation: 'spin 0.7s linear infinite', flexShrink: 0,
                    }} />
                    Uploading to Blockchain…
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M16 8l-4-4-4 4M12 4v12"/>
                    </svg>
                    Submit Answer Sheet
                  </>
                )}
              </button>

              <Link href="/student-dashboard" className="cancel-btn">
                Cancel
              </Link>
            </div>

          </form>
        </div>
      </div>
    </>
  );
}
