'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

interface ParsedStudent {
  name: string; email: string; department: string; year: number; division: string;
}
interface ImportResult {
  row: number; success: boolean; skipped?: boolean; name?: string; email?: string;
  userId?: string; password?: string; emailSent?: boolean; error?: string;
}

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

function NavBack({ href, label }: { href: string; label: string }) {
  const [h, setH] = useState(false);
  return (
    <Link href={href}
      style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', fontWeight: 600, color: h ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)', textDecoration: 'none', transition: 'color 0.2s' }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      {label}
    </Link>
  );
}

/* ─── Parse CSV ─── */
function parseCSV(text: string): { students: ParsedStudent[]; errors: string[] } {
  const errors: string[] = [];
  const students: ParsedStudent[] = [];

  // Normalize line endings
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());

  if (lines.length === 0) { errors.push('CSV file is empty'); return { students, errors }; }

  // Detect header row: if first row contains "name" or "email" (case-insensitive), skip it
  const firstLineLower = lines[0].toLowerCase();
  const hasHeader = firstLineLower.includes('name') || firstLineLower.includes('email');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  // Parse each row: name, email, department, year, division
  dataLines.forEach((line, idx) => {
    const rowNum = hasHeader ? idx + 2 : idx + 1;
    if (!line.trim()) return;

    // Simple CSV split (handles quoted fields)
    const cols = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map(c => c.replace(/^"|"$/g, '').trim()) ?? line.split(',').map(c => c.trim());

    if (cols.length < 5) {
      errors.push(`Row ${rowNum}: Expected 5 columns (name,email,department,year,division), got ${cols.length}`);
      return;
    }

    const [name, email, department, yearStr, division] = cols;
    const year = parseInt(yearStr, 10);

    if (!name)       { errors.push(`Row ${rowNum}: Name is empty`); return; }
    if (!email)      { errors.push(`Row ${rowNum}: Email is empty`); return; }
    if (!department) { errors.push(`Row ${rowNum}: Department is empty`); return; }
    if (isNaN(year) || year < 1 || year > 4) { errors.push(`Row ${rowNum}: Year "${yearStr}" is invalid (must be 1-4)`); return; }
    if (!division)   { errors.push(`Row ${rowNum}: Division is empty`); return; }

    students.push({ name, email, department, year, division: division.toUpperCase() });
  });

  return { students, errors };
}

/* ══════════════════════════ MAIN PAGE ══════════════════════════ */
export default function ImportStudentsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging]         = useState(false);
  const [fileName, setFileName]         = useState('');
  const [parseErrors, setParseErrors]   = useState<string[]>([]);
  const [students, setStudents]         = useState<ParsedStudent[]>([]);
  const [loading, setLoading]           = useState(false);
  const [results, setResults]           = useState<ImportResult[] | null>(null);
  const [importError, setImportError]   = useState('');
  const [successMsg, setSuccessMsg]     = useState('');

  const processFile = (file: File) => {
    if (!file.name.endsWith('.csv')) { setParseErrors(['Please upload a .csv file']); return; }
    setFileName(file.name);
    setParseErrors([]);
    setStudents([]);
    setResults(null);
    setImportError('');
    setSuccessMsg('');

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { students: parsed, errors } = parseCSV(text);
      setStudents(parsed);
      setParseErrors(errors);
    };
    reader.readAsText(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, []);

  const handleImport = async () => {
    if (students.length === 0) return;
    setLoading(true); setImportError(''); setSuccessMsg(''); setResults(null);
    try {
      const res  = await fetch('/api/admin/import-students', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ students }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setResults(data.data.results);
      setSuccessMsg(data.message);
    } catch (err: any) {
      setImportError(err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const downloadSample = () => {
    const csv = 'name,email,department,year,division\nJohn Smith,john@college.edu,Computer Science,2,A\nJane Doe,jane@college.edu,Information Technology,3,B';
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'sample_students.csv';
    a.click();
  };

  const successCount = results ? results.filter(r => r.success).length : 0;
  const skipCount    = results ? results.filter(r => r.skipped).length  : 0;
  const failCount    = results ? results.filter(r => !r.success && !r.skipped).length : 0;

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
        .fade-up2 { animation:fadeUp 0.45s ease both; animation-delay:0.08s; }
        .imp-table { width:100%; border-collapse:collapse; }
        .imp-table thead th { padding:0.6rem 0.85rem; text-align:left; font-size:0.62rem; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:rgba(255,255,255,0.3); white-space:nowrap; }
        .imp-table tbody tr { border-bottom:1px solid rgba(255,255,255,0.04); }
        .imp-table tbody tr:hover { background:rgba(255,255,255,0.025); }
        .imp-table tbody td { padding:0.7rem 0.85rem; font-size:0.8rem; color:rgba(255,255,255,0.6); vertical-align:middle; }
        .t-scroll::-webkit-scrollbar { height:6px; }
        .t-scroll::-webkit-scrollbar-track { background:transparent; }
        .t-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:10px; }
        select option { background:#1a1a1a; color:#f0f0f0; }
      `}</style>

      <DashCursor />

      <div style={{ minHeight: '100vh', background: '#050505', fontFamily: "'Inter',system-ui,sans-serif" }}>

        {/* ── Nav ── */}
        <nav style={{ height: 52, background: 'rgba(5,5,5,0.92)', borderBottom: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', padding: '0 1.75rem', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
          <NavBack href="/audit-dashboard" label="Admin Dashboard" />
          <div style={{ fontSize: '0.78rem', fontWeight: 500, color: 'rgba(255,255,255,0.28)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            GRADEX <span style={{ color: 'rgba(255,255,255,0.18)' }}>/</span>
            <span style={{ color: 'rgba(255,255,255,0.55)' }}>Import Students</span>
          </div>
          <div style={{ width: 90 }} />
        </nav>

        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2.25rem 1.25rem 4rem' }}>

          {/* ── Heading ── */}
          <div className="fade-up" style={{ marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', marginBottom: '0.55rem' }}>
              Admin Portal
            </div>
            <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(2.4rem,5vw,3.5rem)', lineHeight: 0.95, color: '#ffffff', letterSpacing: '0.01em' }}>
              IMPORT<br/>
              <span style={{ WebkitTextStroke: '0.5px rgba(255,255,255,0.9)', color: 'transparent' }}>STUDENTS</span>
            </h1>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', alignItems: 'start' }}>

            {/* ══ LEFT: Upload + Controls ══ */}
            <div className="fade-up2" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{ background: dragging ? 'rgba(255,255,255,0.06)' : '#090909', border: `2px dashed ${dragging ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)'}`, borderRadius: 14, padding: '2.5rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', cursor: 'none', transition: 'all 0.2s', textAlign: 'center' }}>
                <input ref={fileInputRef} type="file" accept=".csv" onChange={onFileChange} style={{ display: 'none' }} />
                <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </div>
                {fileName
                  ? <><p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>{fileName}</p>
                      <p style={{ fontSize: '0.75rem', fontWeight: 500, color: 'rgba(255,255,255,0.35)' }}>Click to change file</p></>
                  : <><p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'rgba(255,255,255,0.55)' }}>Drop CSV file here or click to browse</p>
                      <p style={{ fontSize: '0.75rem', fontWeight: 500, color: 'rgba(255,255,255,0.28)' }}>Accepts .csv files up to 500 students</p></>
                }
              </div>

              {/* CSV format info */}
              <div style={{ background: '#090909', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '1.3rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)', marginBottom: '0.85rem' }}>
                  CSV Format
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.78rem', color: 'rgba(147,197,253,0.8)', marginBottom: '0.85rem', overflowX: 'auto' }}>
                  name,email,department,year,division
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {[
                    { field: 'name', desc: 'Full name of the student' },
                    { field: 'email', desc: 'Student college email address' },
                    { field: 'department', desc: 'e.g. Computer Science' },
                    { field: 'year', desc: 'Academic year (1 – 4)' },
                    { field: 'division', desc: 'Single letter, e.g. A, B, C' },
                  ].map(r => (
                    <div key={r.field} style={{ display: 'flex', gap: '0.65rem', alignItems: 'baseline' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700, color: 'rgba(196,181,253,0.8)', flexShrink: 0, minWidth: 80 }}>{r.field}</span>
                      <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>{r.desc}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', marginBottom: '0.6rem' }}>
                    Header row is optional — it is auto-detected and skipped.
                  </p>
                  <SampleButton onClick={downloadSample} />
                </div>
              </div>

              {/* Parse errors */}
              {parseErrors.length > 0 && (
                <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 12, padding: '1rem 1.1rem' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'rgba(252,165,165,0.7)', marginBottom: '0.6rem' }}>
                    Parse Warnings ({parseErrors.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: 140, overflowY: 'auto' }}>
                    {parseErrors.map((e, i) => (
                      <p key={i} style={{ fontSize: '0.78rem', fontWeight: 500, color: 'rgba(252,165,165,0.85)' }}>• {e}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Import error */}
              {importError && (
                <div style={{ padding: '0.85rem 1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10 }}>
                  <p style={{ fontSize: '0.83rem', fontWeight: 600, color: 'rgba(252,165,165,0.95)' }}><AlertTriangle size={18} /> {importError}</p>
                </div>
              )}

              {/* Success message */}
              {successMsg && (
                <div style={{ padding: '0.85rem 1rem', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10 }}>
                  <p style={{ fontSize: '0.83rem', fontWeight: 600, color: 'rgba(74,222,128,0.95)' }}><CheckCircle2 size={18} /> {successMsg}</p>
                </div>
              )}

              {/* Import button */}
              {students.length > 0 && !results && (
                <ImportButton count={students.length} loading={loading} onClick={handleImport} />
              )}
              {results && (
                <ResetButton onClick={() => { setStudents([]); setFileName(''); setResults(null); setSuccessMsg(''); setParseErrors([]); setImportError(''); }} />
              )}
            </div>

            {/* ══ RIGHT: Preview / Results ══ */}
            <div className="fade-up2">

              {/* No file yet */}
              {!fileName && !results && (
                <div style={{ background: '#090909', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', textAlign: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                    </svg>
                  </div>
                  <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>No file selected</p>
                  <p style={{ fontSize: '0.78rem', fontWeight: 500, color: 'rgba(255,255,255,0.25)', lineHeight: 1.55 }}>Upload a CSV to preview students before importing.</p>
                </div>
              )}

              {/* Preview table */}
              {students.length > 0 && !results && (
                <div style={{ background: '#090909', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '1rem 1.2rem', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)', marginBottom: '0.25rem' }}>Preview</div>
                      <p style={{ fontSize: '0.83rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
                        {students.length} student{students.length !== 1 ? 's' : ''} ready to import
                      </p>
                    </div>
                    <div style={{ padding: '0.3rem 0.8rem', borderRadius: 100, background: 'rgba(147,197,253,0.1)', border: '1px solid rgba(147,197,253,0.25)', fontSize: '0.7rem', fontWeight: 800, color: 'rgba(147,197,253,0.8)', letterSpacing: '0.06em' }}>
                      {students.length} ROWS
                    </div>
                  </div>
                  <div className="t-scroll" style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
                    <table className="imp-table">
                      <thead>
                        <tr><th>#</th><th>Name</th><th>Email</th><th>Department</th><th>Year</th><th>Div</th></tr>
                      </thead>
                      <tbody>
                        {students.map((s, i) => (
                          <tr key={i}>
                            <td style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.72rem' }}>{i + 1}</td>
                            <td style={{ fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>{s.name}</td>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{s.email}</td>
                            <td>{s.department}</td>
                            <td>{s.year}</td>
                            <td>{s.division}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Results table */}
              {results && (
                <div style={{ background: '#090909', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
                  {/* Summary bar */}
                  <div style={{ padding: '1rem 1.2rem', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)', marginRight: 'auto' }}>Import Results</div>
                    <div style={{ padding: '0.28rem 0.75rem', borderRadius: 100, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.28)', fontSize: '0.68rem', fontWeight: 800, color: 'rgba(74,222,128,0.9)', letterSpacing: '0.06em' }}>
                      ✓ {successCount} Created
                    </div>
                    {skipCount > 0 && (
                      <div style={{ padding: '0.28rem 0.75rem', borderRadius: 100, background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.28)', fontSize: '0.68rem', fontWeight: 800, color: 'rgba(253,224,71,0.9)', letterSpacing: '0.06em' }}>
                        ↷ {skipCount} Skipped
                      </div>
                    )}
                    {failCount > 0 && (
                      <div style={{ padding: '0.28rem 0.75rem', borderRadius: 100, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.28)', fontSize: '0.68rem', fontWeight: 800, color: 'rgba(252,165,165,0.9)', letterSpacing: '0.06em' }}>
                        ✗ {failCount} Failed
                      </div>
                    )}
                  </div>
                  <div className="t-scroll" style={{ overflowX: 'auto', maxHeight: 460, overflowY: 'auto' }}>
                    <table className="imp-table">
                      <thead>
                        <tr><th>#</th><th>Status</th><th>Name</th><th>Email</th><th>User ID</th><th>Password</th><th>Email</th></tr>
                      </thead>
                      <tbody>
                        {results.map((r, i) => (
                          <tr key={i}>
                            <td style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.72rem' }}>{r.row}</td>
                            <td>
                              {r.success
                                ? <span style={{ padding: '0.2rem 0.6rem', borderRadius: 100, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', fontSize: '0.62rem', fontWeight: 800, color: 'rgba(74,222,128,0.9)', letterSpacing: '0.06em' }}>OK</span>
                                : r.skipped
                                  ? <span style={{ padding: '0.2rem 0.6rem', borderRadius: 100, background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.28)', fontSize: '0.62rem', fontWeight: 800, color: 'rgba(253,224,71,0.9)', letterSpacing: '0.06em' }}>SKIP</span>
                                  : <span style={{ padding: '0.2rem 0.6rem', borderRadius: 100, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', fontSize: '0.62rem', fontWeight: 800, color: 'rgba(252,165,165,0.9)', letterSpacing: '0.06em' }}>FAIL</span>
                              }
                            </td>
                            <td style={{ fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>{r.name || '—'}</td>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{r.email || '—'}</td>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: r.success ? 'rgba(147,197,253,0.85)' : r.skipped ? 'rgba(253,224,71,0.55)' : 'rgba(252,165,165,0.6)' }}>
                              {r.success ? r.userId : (r.error || '—')}
                            </td>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'rgba(196,181,253,0.8)' }}>
                              {r.success ? r.password : '—'}
                            </td>
                            <td>
                              {r.success && (
                                r.emailSent
                                  ? <span style={{ fontSize: '0.7rem', color: 'rgba(74,222,128,0.7)' }}>Sent</span>
                                  : <span style={{ fontSize: '0.7rem', color: 'rgba(253,224,71,0.7)' }}>Failed</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Download credentials CSV */}
                  {successCount > 0 && (
                    <div style={{ padding: '0.85rem 1.2rem', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                      <DownloadCredButton results={results} />
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
function SampleButton({ onClick }: { onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={e => { e.stopPropagation(); onClick(); }}
      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', borderRadius: 8, background: h ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.78rem', fontWeight: 700, color: h ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)', cursor: 'none', fontFamily: 'inherit', transition: 'all 0.2s' }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Download Sample CSV
    </button>
  );
}

function ImportButton({ count, loading, onClick }: { count: number; loading: boolean; onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} disabled={loading}
      style={{ width: '100%', padding: '0.88rem', borderRadius: 10, background: loading ? 'rgba(255,255,255,0.08)' : h ? 'rgba(240,240,240,0.92)' : '#f0f0f0', border: loading ? '1px solid rgba(255,255,255,0.12)' : 'none', color: loading ? 'rgba(255,255,255,0.6)' : '#000', fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 800, cursor: loading ? 'not-allowed' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.55rem', transition: 'all 0.2s', boxShadow: h && !loading ? '0 0 26px rgba(255,255,255,0.15)' : 'none' }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      {loading ? (
        <>
          <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.15)', borderTop: '2px solid rgba(255,255,255,0.75)', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
          Importing {count} Students…
        </>
      ) : (
        <>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Import {count} Student{count !== 1 ? 's' : ''}
        </>
      )}
    </button>
  );
}

function ResetButton({ onClick }: { onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick}
      style={{ width: '100%', padding: '0.75rem', borderRadius: 10, background: h ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: h ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)', fontFamily: 'inherit', fontSize: '0.88rem', fontWeight: 700, cursor: 'none', transition: 'all 0.2s' }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      Import Another File
    </button>
  );
}

function DownloadCredButton({ results }: { results: ImportResult[] }) {
  const [h, setH] = useState(false);
  const download = () => {
    const rows = ['name,email,userId,password,emailSent'];
    results.filter(r => r.success).forEach(r => {
      rows.push(`"${r.name}","${r.email}","${r.userId}","${r.password}","${r.emailSent}"`);
    });
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.join('\n'));
    a.download = `imported_credentials_${Date.now()}.csv`;
    a.click();
  };
  return (
    <button onClick={download}
      style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.52rem 1rem', borderRadius: 8, background: h ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', fontSize: '0.8rem', fontWeight: 700, color: h ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.45)', cursor: 'none', fontFamily: 'inherit', transition: 'all 0.2s' }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Download Credentials CSV
    </button>
  );
}
