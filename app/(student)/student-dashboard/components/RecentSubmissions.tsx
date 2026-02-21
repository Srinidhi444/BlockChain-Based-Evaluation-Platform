'use client';

import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import EvaluationProgressModal from './EvaluationProgressModal';

interface Submission {
  submissionId:    string;
  testId:          string;
  testTitle:       string;
  subject:         string;
  submittedAt:     string;
  status:          string;
  overallProgress: number;
  currentStage:    string;
  questionsMarked: number;
  totalQuestions:  number;
  teacherName:     string | null;
  resultAvailable: boolean;
}

const STAGE_CONFIG: Record<string, {
  label: string; accent: string; accentBg: string;
  accentText: string; barColor: string;
}> = {
  submitted: {
    label: 'Submitted', accent: 'rgba(148,163,184,0.7)',
    accentBg: 'rgba(148,163,184,0.1)', accentText: 'rgba(203,213,225,1)',
    barColor: 'rgba(148,163,184,0.8)',
  },
  assigned: {
    label: 'Assigned', accent: 'rgba(167,139,250,0.8)',
    accentBg: 'rgba(167,139,250,0.1)', accentText: 'rgba(216,180,254,1)',
    barColor: 'rgba(167,139,250,0.85)',
  },
  evaluating: {
    label: 'Evaluating', accent: 'rgba(251,191,36,0.85)',
    accentBg: 'rgba(251,191,36,0.1)', accentText: 'rgba(253,224,71,1)',
    barColor: 'rgba(251,191,36,0.9)',
  },
  completed: {
    label: 'Completed', accent: 'rgba(34,197,94,0.85)',
    accentBg: 'rgba(34,197,94,0.1)', accentText: 'rgba(74,222,128,1)',
    barColor: 'rgba(34,197,94,0.9)',
  },
};

/* ─── Progress Bar ─── */
function ProgressBar({ progress, stage }: { progress: number; stage: string }) {
  const cfg = STAGE_CONFIG[stage] || STAGE_CONFIG.submitted;
  return (
    <div style={{
      width: '100%', height: 4, borderRadius: 100,
      background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
    }}>
      <div style={{
        height: '100%', borderRadius: 100, width: `${progress}%`,
        background: cfg.barColor, transition: 'width 0.7s ease',
        boxShadow: `0 0 8px ${cfg.barColor}`,
        animation: stage === 'evaluating' ? 'pulseBar 1.8s ease infinite' : 'none',
      }} />
    </div>
  );
}

/* ─── Submission Card ─── */
function SubmissionCard({
  submission, onClick, index,
}: {
  submission: Submission; onClick: () => void; index: number;
}) {
  const cfg = STAGE_CONFIG[submission.currentStage] || STAGE_CONFIG.submitted;
  const [hovered, setHovered] = useState(false);

  const date    = new Date(submission.submittedAt);
  const isToday = new Date().toDateString() === date.toDateString();
  const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateStr = isToday
    ? `Today, ${timeStr}`
    : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + `, ${timeStr}`;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', textAlign: 'left',
        background: hovered ? cfg.accentBg : 'rgba(255,255,255,0.025)',
        border: `1px solid ${hovered ? cfg.accent : 'rgba(255,255,255,0.09)'}`,
        borderRadius: 12, padding: '1.2rem 1.4rem',
        cursor: 'pointer', display: 'block',
        transition: 'background 0.2s ease, border-color 0.2s ease, transform 0.2s ease',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        position: 'relative', overflow: 'hidden',
        boxShadow: hovered ? `0 6px 24px rgba(0,0,0,0.35), 0 0 0 1px ${cfg.accent}33` : 'none',
      }}
    >
      {/* Left accent stripe */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        background: cfg.accent, boxShadow: `0 0 10px ${cfg.accent}`,
        opacity: hovered ? 1 : 0.55, transition: 'opacity 0.2s',
      }} />

      {/* Row 1: title + badge */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: '0.85rem', marginBottom: '1rem', paddingLeft: '0.65rem',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '1rem', fontWeight: 700, color: '#ffffff',
            letterSpacing: '-0.01em', whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {submission.testTitle}
          </div>
          {submission.subject && (
            <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginTop: '0.2rem' }}>
              {submission.subject}
            </div>
          )}
        </div>

        {/* Stage badge */}
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.45rem',
          padding: '0.35rem 0.85rem', borderRadius: 100,
          background: cfg.accentBg, border: `1px solid ${cfg.accent}`,
          fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.07em',
          textTransform: 'uppercase' as const, color: cfg.accentText,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: cfg.accentText, boxShadow: `0 0 6px ${cfg.accentText}`,
            animation: submission.currentStage === 'evaluating' ? 'blink 1.4s ease infinite' : 'none',
            display: 'inline-block', flexShrink: 0,
          }} />
          {cfg.label}
        </div>
      </div>

      {/* Progress */}
      <div style={{ paddingLeft: '0.65rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.38)', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
            Progress
          </span>
          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: cfg.accentText }}>
            {submission.overallProgress}%
          </span>
        </div>
        <ProgressBar progress={submission.overallProgress} stage={submission.currentStage} />
      </div>

      {/* Row 2: meta */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '0.65rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.1rem' }}>
          {submission.totalQuestions > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
              {submission.questionsMarked}/{submission.totalQuestions} Qs
            </span>
          )}
          {submission.teacherName && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/>
              </svg>
              {submission.teacherName}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'rgba(255,255,255,0.38)' }}>
            {dateStr}
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={cfg.accentText}
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ opacity: hovered ? 1 : 0.5, transition: 'opacity 0.2s, transform 0.2s', transform: hovered ? 'translateX(3px)' : 'translateX(0)' }}>
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>
      </div>

      {/* Result banner */}
      {submission.resultAvailable && (
        <div style={{
          marginTop: '1rem', paddingTop: '1rem', paddingLeft: '0.65rem',
          borderTop: '1px solid rgba(34,197,94,0.2)',
          display: 'flex', alignItems: 'center', gap: '0.55rem',
        }}>
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            background: 'rgba(34,197,94,0.18)', border: '1px solid rgba(34,197,94,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="10" height="10" viewBox="0 0 20 20" fill="rgba(74,222,128,1)">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
            </svg>
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(74,222,128,1)' }}>
            Result available — click to view
          </span>
        </div>
      )}
    </button>
  );
}

/* ─── Skeleton ─── */
function SkeletonCard() {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12, padding: '1.2rem 1.4rem',
      animation: 'skeletonPulse 1.5s ease infinite',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <div style={{ height: 16, width: 180, borderRadius: 6, background: 'rgba(255,255,255,0.08)', marginBottom: '0.45rem' }} />
          <div style={{ height: 12, width: 100, borderRadius: 5, background: 'rgba(255,255,255,0.05)' }} />
        </div>
        <div style={{ height: 26, width: 90, borderRadius: 100, background: 'rgba(255,255,255,0.06)' }} />
      </div>
      <div style={{ height: 4, borderRadius: 100, background: 'rgba(255,255,255,0.06)', marginBottom: '1rem' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ height: 12, width: 130, borderRadius: 5, background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ height: 12, width: 85, borderRadius: 5, background: 'rgba(255,255,255,0.05)' }} />
      </div>
    </div>
  );
}

/* ─── Portal wrapper — renders children at document.body level ─── */
function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

/* ─── Main Component ─── */
export default function RecentSubmissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [modalOpen, setModalOpen]     = useState(false);
  const [spinning, setSpinning]       = useState(false);

  const fetchSubmissions = async () => {
    try {
      setLoading(true); setError('');
      const res = await fetch('/api/student/submissions', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch submissions');
      const data = await res.json();
      const submissionList: any[] = data.data?.submissions || [];
      if (submissionList.length === 0) { setSubmissions([]); return; }

      const enriched = await Promise.all(
        submissionList.slice(0, 5).map(async (sub: any) => {
          try {
            const progRes = await fetch(`/api/student/evaluation-progress/${sub.submissionId}`, { credentials: 'include' });
            if (!progRes.ok) throw new Error();
            const prog = await progRes.json();
            return {
              submissionId:    sub.submissionId,
              testId:          sub.testId,
              testTitle:       prog.test?.title   || sub.testId || 'Unknown Test',
              subject:         prog.test?.subject || '',
              submittedAt:     sub.uploadedAt     || sub.submittedAt || sub.createdAt,
              status:          sub.status         || 'submitted',
              overallProgress: prog.overallProgress ?? 5,
              currentStage:    prog.currentStage   || 'submitted',
              questionsMarked: prog.progress?.questionsMarked ?? 0,
              totalQuestions:  prog.progress?.totalQuestions  ?? 0,
              teacherName:     prog.teacher?.name             ?? null,
              resultAvailable: prog.result?.available         ?? false,
            } as Submission;
          } catch {
            return {
              submissionId:    sub.submissionId,
              testId:          sub.testId,
              testTitle:       sub.testTitle || sub.testId || 'Unknown Test',
              subject:         sub.subject   || '',
              submittedAt:     sub.uploadedAt || sub.submittedAt || sub.createdAt,
              status:          sub.status    || 'submitted',
              overallProgress: 5, currentStage: 'submitted',
              questionsMarked: 0, totalQuestions: 0,
              teacherName: null, resultAvailable: false,
            } as Submission;
          }
        })
      );
      setSubmissions(enriched);
    } catch {
      setError('Could not load recent submissions.');
    } finally {
      setLoading(false); setSpinning(false);
    }
  };

  useEffect(() => { fetchSubmissions(); }, []);

  const handleRefresh = () => { setSpinning(true); fetchSubmissions(); };

  const handleOpenModal  = (id: string) => { setSelectedId(id); setModalOpen(true); };
  const handleCloseModal = ()           => { setModalOpen(false); setSelectedId(null); };

  return (
    <>
      <style>{`
        @keyframes pulseBar      { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
        @keyframes blink         { 0%,100%{opacity:1;} 50%{opacity:0.15;} }
        @keyframes skeletonPulse { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
        @keyframes spinAnim      { to{transform:rotate(360deg);} }
        @keyframes fadeSlideIn   { from{opacity:0;transform:translateY(14px);} to{opacity:1;transform:translateY(0);} }
        .sub-card-enter { animation: fadeSlideIn 0.4s ease both; }
      `}</style>

      <div style={{
        background: '#090909', border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 14, overflow: 'hidden',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: '1.4rem 1.6rem',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.4)', marginBottom: '0.4rem' }}>
              Recent Activity
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
              Submissions
            </div>
            <div style={{ fontSize: '0.82rem', fontWeight: 400, color: 'rgba(255,255,255,0.42)', marginTop: '0.2rem' }}>
              Click any row to view live evaluation progress
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            {submissions.length > 0 && !loading && (
              <div style={{
                padding: '0.3rem 0.8rem', background: 'rgba(255,255,255,0.055)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 100,
                fontSize: '0.78rem', fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em',
              }}>
                {submissions.length} shown
              </div>
            )}
            <button
              onClick={handleRefresh} disabled={loading}
              style={{
                width: 36, height: 36, background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: loading ? 0.4 : 1, transition: 'background 0.2s, border-color 0.2s',
              }}
              onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.09)'; } }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
              title="Refresh"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="rgba(255,255,255,0.65)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: spinning ? 'spinAnim 0.7s linear infinite' : 'none' }}>
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '1.2rem 1.35rem' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '2.75rem 1rem' }}>
              <div style={{
                width: 44, height: 44, borderRadius: 11,
                background: 'rgba(255,80,80,0.09)', border: '1px solid rgba(255,80,80,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1rem', fontSize: '1.2rem',
              }}>⚠</div>
              <p style={{ fontSize: '0.92rem', fontWeight: 600, color: 'rgba(255,110,110,0.95)', marginBottom: '0.65rem' }}>
                {error}
              </p>
              <button onClick={fetchSubmissions} style={{
                fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.45)',
                background: 'none', border: 'none', cursor: 'pointer',
                textDecoration: 'underline', fontFamily: 'inherit',
              }}>
                Try again
              </button>
            </div>
          ) : submissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.25rem 1rem' }}>
              <div style={{
                width: 52, height: 52, borderRadius: 13,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.1rem',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                  stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'rgba(255,255,255,0.55)', marginBottom: '0.4rem' }}>
                No submissions yet
              </p>
              <p style={{ fontSize: '0.82rem', fontWeight: 400, color: 'rgba(255,255,255,0.32)', lineHeight: 1.65 }}>
                Upload your answer sheet to track<br/>evaluation progress here
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {submissions.map((sub, i) => (
                <div key={sub.submissionId} className="sub-card-enter" style={{ animationDelay: `${i * 0.07}s` }}>
                  <SubmissionCard
                    submission={sub} index={i}
                    onClick={() => handleOpenModal(sub.submissionId)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {submissions.length > 0 && !loading && (
          <div style={{
            padding: '1rem 1.6rem', borderTop: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.07em', textTransform: 'uppercase' as const }}>
              Last {submissions.length} submissions
            </span>
            <a href="/results" style={{
              fontSize: '0.82rem', fontWeight: 700, color: 'rgba(255,255,255,0.45)',
              textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.35rem',
              transition: 'color 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
            >
              View all results
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </a>
          </div>
        )}
      </div>

      {/* ── Modal rendered at document.body via Portal ── */}
      {modalOpen && selectedId && (
        <ModalPortal>
          <EvaluationProgressModal
            submissionId={selectedId}
            onClose={handleCloseModal}
          />
        </ModalPortal>
      )}
    </>
  );
}
