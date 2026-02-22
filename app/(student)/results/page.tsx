'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Link as LinkIcon, CheckCircle2, AlertTriangle, XCircle, BarChart2, FileText, RefreshCw } from 'lucide-react';

interface Submission {
  _id: string; submissionId: string; testId: string;
  subject: string; status: string; uploadedAt: string; answerSheetUrl: string;
}
interface Evaluation {
  _id: string; evaluationId: string; totalMarksObtained: number;
  totalMarks: number; percentage: number;
  questionMarks: Array<{ questionNumber: number; maxMarks: number; marksObtained: number; comment?: string }>;
  remarks?: string; evaluatedAt: string; teacherName: string;
}
interface Grievance {
  grievanceId: string; status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  grievanceType: 'calculation_error' | 'reevaluation'; filedAt: string;
}
interface ReEvaluation {
  reevaluationId: string; originalTotalMarksObtained: number; newTotalMarksObtained: number;
  originalPercentage: number; newPercentage: number; totalDifference: number;
  percentageDifference: number;
  comparisonData: Array<{ questionNumber: number; maxMarks: number; oldMarksObtained: number; newMarksObtained: number; difference: number }>;
  newRemarks?: string;
}
type BlockchainStatus = 'verified' | 'tampered' | 'not_found' | 'error' | 'loading' | 'idle';
interface BlockchainVerification { status: BlockchainStatus; recomputedHash?: string; onChainEvaluationHash?: string; message?: string; }
type FileHashStatus = 'verified' | 'tampered' | 'not_found' | 'error' | 'loading' | 'idle';
interface FileHashVerification { status: FileHashStatus; recomputedHash?: string; onChainFileHash?: string; message?: string; }

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

function grievanceBadge(status: string) {
  const map: Record<string, { text: string; color: string; bg: string; border: string }> = {
    pending:     { text: 'Pending Review', color: 'rgba(253,224,71,1)',   bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)'  },
    in_progress: { text: 'In Progress',    color: 'rgba(147,197,253,1)', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.3)'  },
    completed:   { text: 'Completed',      color: 'rgba(74,222,128,1)',  bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.3)'   },
    rejected:    { text: 'Rejected',       color: 'rgba(252,165,165,1)', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)'   },
  };
  return map[status] || map.pending;
}

/* ─── Blockchain Verify Button (with hover tooltip via React state) ─── */
function BlockchainVerifyButton({
  verification, onVerify,
}: { verification: BlockchainVerification; onVerify: () => void }) {
  const { status, recomputedHash, onChainEvaluationHash, message } = verification;
  const [tooltipVisible, setTooltipVisible] = useState(false);

  if (status === 'idle') return (
    <button onClick={onVerify} style={{
      display: 'flex', alignItems: 'center', gap: '0.45rem',
      padding: '0.45rem 0.9rem', borderRadius: 9,
      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
      fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)',
      cursor: 'none', fontFamily: 'inherit', transition: 'background 0.2s',
    }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
    >
      <LinkIcon size={18} /> Verify on Blockchain
    </button>
  );

  if (status === 'loading') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.9rem', borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
      <div style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.15)', borderTop: '1.5px solid rgba(255,255,255,0.6)', animation: 'spin 0.7s linear infinite' }} />
      Verifying…
    </div>
  );

  if (status === 'verified') return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setTooltipVisible(true)}
      onMouseLeave={() => setTooltipVisible(false)}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.45rem',
        padding: '0.45rem 0.9rem', borderRadius: 9,
        background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)',
        fontSize: '0.78rem', fontWeight: 700, color: 'rgba(74,222,128,1)',
        cursor: 'none',
      }}>
        <CheckCircle2 size={18} /> Verified on Blockchain
      </div>
      {tooltipVisible && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 200,
          background: '#111', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12, padding: '1rem', width: 340,
          boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
        }}>
          <p style={{ fontSize: '0.78rem', fontWeight: 800, color: 'rgba(74,222,128,1)', marginBottom: '0.75rem' }}>
            <CheckCircle2 size={18} /> Hashes Match — Evaluation Untampered
          </p>
          <div style={{ marginBottom: '0.6rem' }}>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', marginBottom: '0.25rem' }}>
              Recomputed Hash
            </p>
            <p style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'rgba(74,222,128,0.85)', wordBreak: 'break-all', lineHeight: 1.5 }}>
              {recomputedHash}
            </p>
          </div>
          <div>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', marginBottom: '0.25rem' }}>
              On-Chain Hash
            </p>
            <p style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'rgba(74,222,128,0.85)', wordBreak: 'break-all', lineHeight: 1.5 }}>
              {onChainEvaluationHash}
            </p>
          </div>
        </div>
      )}
    </div>
  );

  if (status === 'tampered') return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setTooltipVisible(true)}
      onMouseLeave={() => setTooltipVisible(false)}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.45rem',
        padding: '0.45rem 0.9rem', borderRadius: 9,
        background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)',
        fontSize: '0.78rem', fontWeight: 700, color: 'rgba(252,165,165,1)',
        animation: 'pulse 1.5s ease infinite', cursor: 'none',
      }}>
        <AlertTriangle size={18} /> Tampered!
      </div>
      {tooltipVisible && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 200,
          background: '#111', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 12, padding: '1rem', width: 340,
          boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
        }}>
          <p style={{ fontSize: '0.78rem', fontWeight: 800, color: 'rgba(252,165,165,1)', marginBottom: '0.75rem' }}>
            <AlertTriangle size={18} /> Hash Mismatch — Evaluation May Be Tampered
          </p>
          <div style={{ marginBottom: '0.6rem' }}>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', marginBottom: '0.25rem' }}>
              Recomputed from DB
            </p>
            <p style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'rgba(253,224,71,0.9)', wordBreak: 'break-all', lineHeight: 1.5 }}>
              {recomputedHash}
            </p>
          </div>
          <div>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', marginBottom: '0.25rem' }}>
              On-Chain Stored
            </p>
            <p style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'rgba(252,165,165,0.9)', wordBreak: 'break-all', lineHeight: 1.5 }}>
              {onChainEvaluationHash}
            </p>
          </div>
        </div>
      )}
    </div>
  );

  if (status === 'not_found') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.45rem 0.9rem', borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>
      📋 Not on Blockchain
    </div>
  );

  return (
    <div title={message} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.45rem 0.9rem', borderRadius: 9, background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(253,186,116,1)' }}>
      <XCircle size={18} /> Verify Failed
    </div>
  );
}

/* ─── File Hash Verify Button ─── */
function FileHashVerifyButton({
  verification, onVerify,
}: { verification: FileHashVerification; onVerify: () => void }) {
  const { status, recomputedHash, onChainFileHash, message } = verification;
  const [tooltipVisible, setTooltipVisible] = useState(false);

  if (status === 'idle') return (
    <button onClick={onVerify} style={{
      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem',
      padding: '0.75rem', borderRadius: 10,
      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
      fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)',
      cursor: 'none', fontFamily: 'inherit', transition: 'background 0.2s',
    }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.09)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
    >
      🔒 Verify File Integrity
    </button>
  );

  if (status === 'loading') return (
    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>
      <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.1)', borderTop: '1.5px solid rgba(255,255,255,0.5)', animation: 'spin 0.7s linear infinite' }} />
      Verifying File…
    </div>
  );

  if (status === 'verified') return (
    <div
      style={{ position: 'relative', width: '100%' }}
      onMouseEnter={() => setTooltipVisible(true)}
      onMouseLeave={() => setTooltipVisible(false)}
    >
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: 10, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', fontSize: '0.85rem', fontWeight: 700, color: 'rgba(74,222,128,1)', cursor: 'none' }}>
        <CheckCircle2 size={18} /> File Integrity Verified
      </div>
      {tooltipVisible && (
        <div style={{
          position: 'absolute', left: 0, bottom: 'calc(100% + 8px)', zIndex: 200,
          background: '#111', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12, padding: '1rem', width: '100%',
          boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
        }}>
          <p style={{ fontSize: '0.78rem', fontWeight: 800, color: 'rgba(74,222,128,1)', marginBottom: '0.75rem' }}>
            <CheckCircle2 size={18} /> File Hashes Match — Untampered
          </p>
          <div style={{ marginBottom: '0.6rem' }}>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', marginBottom: '0.25rem' }}>Recomputed Hash</p>
            <p style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'rgba(74,222,128,0.85)', wordBreak: 'break-all', lineHeight: 1.5 }}>{recomputedHash}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', marginBottom: '0.25rem' }}>On-Chain Hash</p>
            <p style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'rgba(74,222,128,0.85)', wordBreak: 'break-all', lineHeight: 1.5 }}>{onChainFileHash}</p>
          </div>
        </div>
      )}
    </div>
  );

  if (status === 'tampered') return (
    <div
      style={{ position: 'relative', width: '100%' }}
      onMouseEnter={() => setTooltipVisible(true)}
      onMouseLeave={() => setTooltipVisible(false)}
    >
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.85rem', fontWeight: 700, color: 'rgba(252,165,165,1)', animation: 'pulse 1.5s ease infinite', cursor: 'none' }}>
        <AlertTriangle size={18} /> File Has Been Tampered!
      </div>
      {tooltipVisible && (
        <div style={{
          position: 'absolute', left: 0, bottom: 'calc(100% + 8px)', zIndex: 200,
          background: '#111', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 12, padding: '1rem', width: '100%',
          boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
        }}>
          <p style={{ fontSize: '0.78rem', fontWeight: 800, color: 'rgba(252,165,165,1)', marginBottom: '0.75rem' }}>
            <AlertTriangle size={18} /> File Hash Mismatch — File May Be Tampered
          </p>
          <div style={{ marginBottom: '0.6rem' }}>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', marginBottom: '0.25rem' }}>Recomputed from File</p>
            <p style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'rgba(253,224,71,0.9)', wordBreak: 'break-all', lineHeight: 1.5 }}>{recomputedHash}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', marginBottom: '0.25rem' }}>On-Chain Stored</p>
            <p style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'rgba(252,165,165,0.9)', wordBreak: 'break-all', lineHeight: 1.5 }}>{onChainFileHash}</p>
          </div>
        </div>
      )}
    </div>
  );

  if (status === 'not_found') return (
    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)' }}>
      📋 File Not on Blockchain
    </div>
  );

  return (
    <div title={message} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: 10, background: 'rgba(249,115,22,0.09)', border: '1px solid rgba(249,115,22,0.25)', fontSize: '0.85rem', fontWeight: 700, color: 'rgba(253,186,116,1)' }}>
      <XCircle size={18} /> File Verification Failed
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
export default function ResultsPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const submissionIdParam = searchParams.get('submissionId');

  const [submissions, setSubmissions]               = useState<Submission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [evaluation, setEvaluation]                 = useState<Evaluation | null>(null);
  const [grievance, setGrievance]                   = useState<Grievance | null>(null);
  const [reevaluation, setReEvaluation]             = useState<ReEvaluation | null>(null);
  const [loading, setLoading]                       = useState(true);
  const [loadingEvaluation, setLoadingEvaluation]   = useState(false);
  const [error, setError]                           = useState('');
  const [blockchainVerification, setBlockchainVerification] = useState<BlockchainVerification>({ status: 'idle' });
  const [fileHashVerification, setFileHashVerification]     = useState<FileHashVerification>({ status: 'idle' });

  useEffect(() => { fetchSubmissions(); }, []);

  useEffect(() => {
    if (submissionIdParam && submissions.length > 0) {
      const sub = submissions.find(s => s.submissionId === submissionIdParam);
      if (sub && (sub.status === 'evaluated' || sub.status === 'published')) handleViewResult(sub);
    }
  }, [submissionIdParam, submissions]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/student/submissions');
      if (!res.ok) { if (res.status === 401) { router.push('/login'); return; } throw new Error('Failed to fetch submissions'); }
      const data = await res.json();
      setSubmissions(data.data.submissions.filter((s: Submission) => s.status === 'evaluated' || s.status === 'published'));
    } catch (err: any) { setError(err.message || 'Failed to load results'); }
    finally { setLoading(false); }
  };

  const handleViewResult = async (submission: Submission) => {
    try {
      setLoadingEvaluation(true);
      setSelectedSubmission(submission);
      setError(''); setGrievance(null); setReEvaluation(null);
      setBlockchainVerification({ status: 'idle' });
      setFileHashVerification({ status: 'idle' });

      const res = await fetch(`/api/student/results?submissionId=${submission.submissionId}`);
      if (!res.ok) throw new Error('Failed to fetch evaluation');
      const data = await res.json();
      setEvaluation(data.data.evaluation);

      const gRes = await fetch(`/api/student/grievance?submissionId=${submission.submissionId}`);
      if (gRes.ok) {
        const gData = await gRes.json();
        if (gData.data.grievance) {
          setGrievance(gData.data.grievance);
          if (gData.data.grievance.status === 'completed' && gData.data.grievance.reevaluationId) {
            const rRes = await fetch(`/api/student/reevaluation?submissionId=${submission.submissionId}`);
            if (rRes.ok) { const rData = await rRes.json(); setReEvaluation(rData.data.reevaluation); }
          }
        }
      }
    } catch (err: any) { setError(err.message || 'Failed to load evaluation details'); setEvaluation(null); }
    finally { setLoadingEvaluation(false); }
  };

  const handleVerifyBlockchain = async () => {
    if (!selectedSubmission) return;
    setBlockchainVerification({ status: 'loading' });
    try {
      const res  = await fetch(`/api/student/verify-blockchain?submissionId=${selectedSubmission.submissionId}`);
      const data = await res.json();
      setBlockchainVerification({
        status:                data.status,
        recomputedHash:        data.recomputedHash,
        onChainEvaluationHash: data.onChainEvaluationHash,
        message:               data.message,
      });
    } catch (err: any) { setBlockchainVerification({ status: 'error', message: err.message || 'Verification failed' }); }
  };

  const handleVerifyFileHash = async () => {
    if (!selectedSubmission) return;
    setFileHashVerification({ status: 'loading' });
    try {
      const fileRes = await fetch(selectedSubmission.answerSheetUrl);
      if (!fileRes.ok) throw new Error('Could not fetch answer sheet file');
      const blob = await fileRes.blob();
      const formData = new FormData();
      formData.append('submissionId', selectedSubmission.submissionId);
      formData.append('file', blob, 'answersheet');
      const res  = await fetch('/api/student/verify-file', { method: 'POST', body: formData });
      const data = await res.json();
      setFileHashVerification({
        status:          data.status,
        recomputedHash:  data.recomputedHash,
        onChainFileHash: data.onChainFileHash,
        message:         data.message,
      });
    } catch (err: any) { setFileHashVerification({ status: 'error', message: err.message || 'File verification failed' }); }
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
          <p style={{ marginTop: '1rem', fontSize: '0.88rem', fontWeight: 500, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>Loading results…</p>
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
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px);} to{opacity:1;transform:translateY(0);} }
        @keyframes pulse  { 0%,100%{opacity:1;} 50%{opacity:0.5;} }

        .fade-up { animation: fadeUp 0.45s ease both; }

        .sub-btn {
          width:100%; text-align:left; position:relative;
          background:rgba(255,255,255,0.025);
          border:1px solid rgba(255,255,255,0.08);
          border-radius:12px; padding:1rem 1.1rem 1rem 1.3rem;
          cursor:none; display:block;
          transition:background 0.2s, border-color 0.2s, transform 0.15s;
          font-family:inherit;
        }
        .sub-btn:hover  { background:rgba(255,255,255,0.04); border-color:rgba(255,255,255,0.15); transform:translateY(-1px); }
        .sub-btn.active { background:rgba(255,255,255,0.06); border-color:rgba(255,255,255,0.28); box-shadow:0 0 0 1px rgba(255,255,255,0.08); }

        .results-scroll::-webkit-scrollbar { width:3px; }
        .results-scroll::-webkit-scrollbar-track { background:transparent; }
        .results-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:10px; }

        .q-bar-bg   { height:5px; border-radius:100px; background:rgba(255,255,255,0.07); overflow:hidden; margin-top:0.5rem; }
        .q-bar-fill { height:100%; border-radius:100px; transition:width 0.7s ease; }
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
          <Link href="/student-dashboard" style={{
            display: 'flex', alignItems: 'center', gap: '0.45rem',
            fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.45)',
            textDecoration: 'none', transition: 'color 0.2s',
          }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Dashboard
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.28)', fontWeight: 500 }}>
            GRADEX <span style={{ color: 'rgba(255,255,255,0.18)' }}>/</span>
            <span style={{ color: 'rgba(255,255,255,0.55)' }}>Results</span>
          </div>
          <div style={{ width: 80 }} />
        </nav>

        {/* ── Body ── */}
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '2rem 1.25rem 4rem',
          display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.25rem', alignItems: 'start',
        }}>

          {/* ── LEFT: submissions list ── */}
          <div className="fade-up" style={{
            background: '#090909', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16, overflow: 'hidden', position: 'sticky', top: 68,
          }}>
            <div style={{ padding: '1.25rem 1.4rem', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)', marginBottom: '0.3rem' }}>
                Evaluated
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>Submissions</div>
            </div>

            <div style={{ padding: '0.85rem', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }} className="results-scroll">
              {submissions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.65rem' }}>📭</div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)' }}>No results yet</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                  {submissions.map(sub => {
                    const isActive = selectedSubmission?._id === sub._id;
                    return (
                      <button
                        key={sub._id}
                        onClick={() => handleViewResult(sub)}
                        className={`sub-btn${isActive ? ' active' : ''}`}
                      >
                        {/* Left accent stripe */}
                        <div style={{
                          position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                          background: isActive ? 'rgba(74,222,128,0.8)' : 'transparent',
                          borderRadius: '12px 0 0 12px', transition: 'background 0.2s',
                        }} />
                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.25rem' }}>
                          {sub.subject || sub.testId}
                        </div>
                        <div style={{ fontSize: '0.74rem', fontWeight: 500, color: 'rgba(255,255,255,0.38)' }}>
                          {new Date(sub.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        <div style={{
                          display: 'inline-block', marginTop: '0.45rem',
                          padding: '0.18rem 0.6rem', borderRadius: 100,
                          background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
                          fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.07em',
                          textTransform: 'uppercase' as const, color: 'rgba(74,222,128,1)',
                        }}>
                          {sub.status === 'published' ? 'Published' : 'Evaluated'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: detail panel ── */}
          <div>
            {!selectedSubmission ? (
              <div className="fade-up" style={{ background: '#090909', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '5rem 2rem', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}><BarChart2 size={18} /></div>
                <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>Select a submission to view results</p>
              </div>

            ) : loadingEvaluation ? (
              <div className="fade-up" style={{ background: '#090909', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '5rem 2rem', textAlign: 'center' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.07)', borderTop: '2px solid rgba(255,255,255,0.5)', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
                <p style={{ marginTop: '1rem', fontSize: '0.88rem', fontWeight: 500, color: 'rgba(255,255,255,0.4)' }}>Loading evaluation…</p>
              </div>

            ) : evaluation ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* Grievance notice */}
                {grievance && (() => {
                  const gb = grievanceBadge(grievance.status);
                  return (
                    <div className="fade-up" style={{ background: '#090909', border: `1px solid ${gb.border}`, borderRadius: 14, padding: '1.25rem 1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                          <FileText size={18} />
                          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff' }}>Grievance Filed</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'rgba(255,255,255,0.45)' }}>
                          {grievance.grievanceType === 'calculation_error' ? 'Calculation Error' : 'Re-evaluation'}
                        </div>
                        <div style={{ fontSize: '0.74rem', fontWeight: 500, color: 'rgba(255,255,255,0.28)', marginTop: '0.2rem' }}>
                          Filed {new Date(grievance.filedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      <div style={{ padding: '0.35rem 0.9rem', borderRadius: 100, background: gb.bg, border: `1px solid ${gb.border}`, fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: gb.color, flexShrink: 0 }}>
                        {gb.text}
                      </div>
                    </div>
                  );
                })()}

                {/* Re-evaluation */}
                {reevaluation && (
                  <div className="fade-up" style={{ background: '#090909', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 14, padding: '1.4rem', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(167,139,250,0.1)', filter: 'blur(30px)', pointerEvents: 'none' }} />
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: 'rgba(216,180,254,0.85)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <RefreshCw size={18} /> Re-evaluation Results
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem', marginBottom: '1.1rem' }}>
                      {[
                        { label: 'Original',   val: reevaluation.originalTotalMarksObtained, pct: reevaluation.originalPercentage,  color: 'rgba(255,255,255,0.5)', prefix: '' },
                        { label: 'New',        val: reevaluation.newTotalMarksObtained,      pct: reevaluation.newPercentage,        color: 'rgba(216,180,254,1)',   prefix: '' },
                        { label: 'Difference', val: reevaluation.totalDifference,            pct: reevaluation.percentageDifference,
                          color: reevaluation.totalDifference > 0 ? 'rgba(74,222,128,1)' : reevaluation.totalDifference < 0 ? 'rgba(252,165,165,1)' : 'rgba(255,255,255,0.4)',
                          prefix: reevaluation.totalDifference > 0 ? '+' : '',
                        },
                      ].map(col => (
                        <div key={col.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '0.85rem', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', marginBottom: '0.45rem' }}>{col.label}</div>
                          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2rem', lineHeight: 1, color: col.color }}>{col.prefix}{col.val}</div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 500, color: col.color, opacity: 0.8, marginTop: '0.2rem' }}>{col.prefix}{col.pct.toFixed(1)}%</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', marginBottom: '0.65rem' }}>
                      Question-wise Changes
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      {reevaluation.comparisonData.filter(c => c.difference !== 0).map(comp => (
                        <div key={comp.questionNumber} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 9, padding: '0.65rem 0.85rem' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>Q{comp.questionNumber}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'rgba(255,255,255,0.4)' }}>{comp.oldMarksObtained} → {comp.newMarksObtained}</span>
                            <span style={{ padding: '0.15rem 0.55rem', borderRadius: 100, background: comp.difference > 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${comp.difference > 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, fontSize: '0.75rem', fontWeight: 800, color: comp.difference > 0 ? 'rgba(74,222,128,1)' : 'rgba(252,165,165,1)' }}>
                              {comp.difference > 0 ? '+' : ''}{comp.difference}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Score card */}
                {(() => {
                  const displayPct   = reevaluation ? reevaluation.newPercentage        : evaluation.percentage;
                  const displayMarks = reevaluation ? reevaluation.newTotalMarksObtained : evaluation.totalMarksObtained;
                  const grade = getGrade(displayPct);
                  return (
                    <div className="fade-up" style={{ background: '#090909', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: -40, right: -40, width: 130, height: 130, borderRadius: '50%', background: grade.bg, filter: 'blur(40px)', pointerEvents: 'none' }} />

                      {/* Header row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.4rem', flexWrap: 'wrap' as const, gap: '0.75rem' }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)' }}>
                          {reevaluation ? 'Score After Re-evaluation' : 'Your Score'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' as const }}>
                          <BlockchainVerifyButton verification={blockchainVerification} onVerify={handleVerifyBlockchain} />
                          {!grievance && !reevaluation && (
                            <Link href={`/grievance/${selectedSubmission.submissionId}`} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', borderRadius: 9, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.65)', textDecoration: 'none', transition: 'background 0.2s' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                            >
                              <FileText size={18} /> File Grievance
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Stats grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', textAlign: 'center', marginBottom: '1.4rem' }}>
                        {[
                          { label: 'Marks Obtained', val: `${displayMarks}/${evaluation.totalMarks}`, color: '#ffffff' },
                          { label: 'Percentage',     val: `${displayPct.toFixed(1)}%`,                color: '#ffffff' },
                          { label: 'Grade',          val: grade.label,                                color: grade.color },
                        ].map(stat => (
                          <div key={stat.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 11, padding: '1rem 0.75rem' }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', marginBottom: '0.5rem' }}>{stat.label}</div>
                            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.2rem', lineHeight: 1, color: stat.color }}>{stat.val}</div>
                          </div>
                        ))}
                      </div>

                      {/* Score bar */}
                      <div style={{ height: 5, borderRadius: 100, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 100, width: `${displayPct}%`, background: grade.color, boxShadow: `0 0 8px ${grade.color}`, transition: 'width 1s ease' }} />
                      </div>
                    </div>
                  );
                })()}

                {/* Question breakdown */}
                <div className="fade-up" style={{ background: '#090909', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '1.4rem' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)', marginBottom: '1rem' }}>
                    Question-wise Breakdown
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {evaluation.questionMarks.map(qm => {
                      const reevalQ  = reevaluation?.comparisonData.find(c => c.questionNumber === qm.questionNumber);
                      const current  = reevalQ ? reevalQ.newMarksObtained : qm.marksObtained;
                      const ratio    = current / qm.maxMarks;
                      const barColor = ratio >= 0.7 ? 'rgba(34,197,94,0.8)' : ratio >= 0.4 ? 'rgba(251,191,36,0.8)' : 'rgba(239,68,68,0.8)';
                      return (
                        <div key={qm.questionNumber} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 11, padding: '0.9rem 1.1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, color: 'rgba(255,255,255,0.5)' }}>
                                Q{qm.questionNumber}
                              </div>
                              {qm.comment && (
                                <span style={{ fontSize: '0.78rem', fontWeight: 400, color: 'rgba(255,255,255,0.38)', fontStyle: 'italic' }}>
                                  💬 {qm.comment}
                                </span>
                              )}
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff' }}>{current}/{qm.maxMarks}</div>
                              {reevalQ && reevalQ.difference !== 0 && (
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: reevalQ.difference > 0 ? 'rgba(74,222,128,1)' : 'rgba(252,165,165,1)' }}>
                                  {reevalQ.difference > 0 ? '+' : ''}{reevalQ.difference}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="q-bar-bg">
                            <div className="q-bar-fill" style={{ width: `${ratio * 100}%`, background: barColor, boxShadow: `0 0 6px ${barColor}` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Remarks */}
                {(evaluation.remarks || reevaluation?.newRemarks) && (
                  <div className="fade-up" style={{ background: '#090909', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '1.4rem' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.35)', marginBottom: '1rem' }}>
                      Teacher's Remarks
                    </div>
                    {reevaluation?.newRemarks && (
                      <div style={{ background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 10, padding: '0.85rem', marginBottom: '0.75rem' }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'rgba(216,180,254,0.7)', marginBottom: '0.35rem' }}>Re-evaluation</div>
                        <p style={{ fontSize: '0.88rem', fontWeight: 500, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>{reevaluation.newRemarks}</p>
                      </div>
                    )}
                    {evaluation.remarks && (
                      <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '0.85rem' }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.28)', marginBottom: '0.35rem' }}>Original</div>
                        <p style={{ fontSize: '0.88rem', fontWeight: 500, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>{evaluation.remarks}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Evaluation meta */}
                <div className="fade-up" style={{ background: '#090909', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '1.25rem 1.4rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    {[
                      { label: 'Evaluated By', val: evaluation.teacherName },
                      { label: 'Evaluated On', val: new Date(evaluation.evaluatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
                    ].map(f => (
                      <div key={f.label}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.28)', marginBottom: '0.3rem' }}>{f.label}</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff' }}>{f.val}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Answer sheet + file verify */}
                <div className="fade-up" style={{ background: '#090909', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '1.25rem 1.4rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' as const }}>
                    <a href={selectedSubmission.answerSheetUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, minWidth: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', padding: '0.75rem', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', textDecoration: 'none', transition: 'background 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.09)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                    >
                      <FileText size={18} /> View Answer Sheet
                    </a>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <FileHashVerifyButton verification={fileHashVerification} onVerify={handleVerifyFileHash} />
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="fade-up" style={{ background: '#090909', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 14, padding: '5rem 2rem', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}><XCircle size={18} /></div>
                <p style={{ fontSize: '0.92rem', fontWeight: 600, color: 'rgba(252,165,165,0.9)' }}>
                  {error || 'Failed to load evaluation'}
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
