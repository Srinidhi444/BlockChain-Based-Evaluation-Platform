'use client';

import { useEffect, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────
interface TimelineEvent {
    id: string;
    event: string;
    timestamp: string | null;
    label: string;
    detail: string;
    status: 'done' | 'in_progress' | 'pending';
    questionNumber?: number;
    timeSpent?: number;
    marksAwarded?: number;
    maxMarks?: number;
}

interface ProgressData {
    submissionId: string;
    currentStage: string;
    overallProgress: number;
    submittedAt: string;
    test: {
        title: string;
        subject: string;
        totalQuestions: number;
        maxMarks: number;
    };
    teacher: { name: string; department: string } | null;
    progress: {
        questionsMarked: number;
        totalQuestions: number;
        percentage: number;
    };
    timeline: TimelineEvent[];
    result: {
        available: boolean;
        totalMarks?: number;
        maxMarks?: number;
    };
    grievance: { filed: boolean; status?: string; reason?: string };
    lastUpdated: string;
}

interface Props { submissionId: string; onClose: () => void; }

// ── Helpers ───────────────────────────────────────────────
function formatTime(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    });
}
function formatDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        + ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function secondsToReadable(s: number): string {
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

// ── Stage config ──────────────────────────────────────────
const STAGE_CFG: Record<string, {
    accent: string; accentBg: string; accentText: string;
    barColor: string; label: string; sublabel: string;
}> = {
    submitted: {
        accent: 'rgba(148,163,184,0.75)',
        accentBg: 'rgba(148,163,184,0.1)',
        accentText: 'rgba(226,232,240,1)',
        barColor: 'rgba(148,163,184,0.9)',
        label: 'Answer Sheet Submitted',
        sublabel: 'Waiting to be assigned to an evaluator',
    },
    assigned: {
        accent: 'rgba(167,139,250,0.85)',
        accentBg: 'rgba(167,139,250,0.1)',
        accentText: 'rgba(216,180,254,1)',
        barColor: 'rgba(167,139,250,0.9)',
        label: 'Evaluator Assigned',
        sublabel: 'Your answer sheet has been assigned',
    },
    evaluating: {
        accent: 'rgba(251,191,36,0.9)',
        accentBg: 'rgba(251,191,36,0.1)',
        accentText: 'rgba(253,224,71,1)',
        barColor: 'rgba(251,191,36,0.95)',
        label: 'Evaluation In Progress',
        sublabel: 'Your answer sheet is being evaluated right now',
    },
    completed: {
        accent: 'rgba(34,197,94,0.9)',
        accentBg: 'rgba(34,197,94,0.1)',
        accentText: 'rgba(74,222,128,1)',
        barColor: 'rgba(34,197,94,0.95)',
        label: 'Evaluation Complete',
        sublabel: 'Your result is now available',
    },
};

// ── Stage Banner ──────────────────────────────────────────
function StageBanner({ stage, progress, test }: {
    stage: string; progress: number; test: ProgressData['test'];
}) {
    const c = STAGE_CFG[stage] || STAGE_CFG.submitted;

    const stageIcons: Record<string, React.ReactNode> = {
        submitted: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
        assigned: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
            </svg>
        ),
        evaluating: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: 'spinAnim 1.2s linear infinite' }}>
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
        ),
        completed: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    };

    return (
        <div style={{
            padding: '1.5rem',
            background: `linear-gradient(135deg, ${c.accentBg} 0%, rgba(9,9,9,0) 100%)`,
            borderBottom: `1px solid ${c.accent}`,
            position: 'relative', overflow: 'hidden',
        }}>
            {/* Glow top-left */}
            <div style={{
                position: 'absolute', top: -40, left: -40, width: 120, height: 120,
                borderRadius: '50%',
                background: c.accent,
                opacity: 0.12, filter: 'blur(40px)', pointerEvents: 'none',
            }} />

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                {/* Icon */}
                <div style={{
                    width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                    background: c.accentBg,
                    border: `1px solid ${c.accent}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: c.accentText,
                    boxShadow: `0 0 16px ${c.accent}33`,
                }}>
                    {stageIcons[stage] || stageIcons.submitted}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    {/* ↑↑ Boosted label */}
                    <div style={{
                        fontSize: '1.05rem', fontWeight: 800,
                        color: '#ffffff', letterSpacing: '-0.01em', marginBottom: '0.2rem',
                    }}>
                        {c.label}
                    </div>
                    {/* ↑↑ Boosted sublabel */}
                    <div style={{ fontSize: '0.85rem', fontWeight: 500, color: c.accentText }}>
                        {c.sublabel}
                    </div>
                </div>
            </div>

            {/* Test title */}
            <div style={{
                fontSize: '0.82rem', fontWeight: 600,
                color: 'rgba(255,255,255,0.55)',
                marginBottom: '1rem',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
                📄 {test.title}{test.subject ? ` · ${test.subject}` : ''}
            </div>

            {/* Progress bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                    flex: 1, height: 5, borderRadius: 100,
                    background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
                }}>
                    <div style={{
                        height: '100%', borderRadius: 100,
                        width: `${progress}%`,
                        background: c.barColor,
                        boxShadow: `0 0 8px ${c.barColor}`,
                        transition: 'width 1s ease',
                    }} />
                </div>
                {/* ↑↑ Boosted percentage */}
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: c.accentText, flexShrink: 0 }}>
                    {progress}%
                </span>
            </div>
        </div>
    );
}

// ── Stats Row ─────────────────────────────────────────────
function StatsRow({ data }: { data: ProgressData }) {
    const stats = [
        {
            label: 'Questions', value: data.progress.totalQuestions > 0
                ? `${data.progress.questionsMarked}/${data.progress.totalQuestions}` : '—', icon: '📝'
        },
        { label: 'Evaluator', value: data.teacher?.name || 'Pending', icon: '👤' },
        { label: 'Submitted', value: formatTime(data.submittedAt), icon: '🕐' },
        {
            label: 'Result', value: data.result.available
                ? `${data.result.totalMarks}/${data.result.maxMarks}` : 'Pending', icon: '🎯'
        },
    ];

    return (
        <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
            {stats.map((s, i) => (
                <div key={s.label} style={{
                    padding: '1rem 0.75rem', textAlign: 'center',
                    borderRight: i < 3 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                }}>
                    <div style={{ fontSize: '1.1rem', marginBottom: '0.35rem' }}>{s.icon}</div>
                    {/* ↑↑ Boosted stat value */}
                    <div style={{
                        fontSize: '0.88rem', fontWeight: 700,
                        color: '#ffffff',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                        {s.value}
                    </div>
                    {/* ↑↑ Boosted stat label */}
                    <div style={{ fontSize: '0.72rem', fontWeight: 500, color: 'rgba(255,255,255,0.4)', marginTop: '0.2rem' }}>
                        {s.label}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Timeline Item ─────────────────────────────────────────
function TimelineItem({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
    const isQuestion = ['question_marked', 'question_in_progress', 'question_pending'].includes(event.event);

    const iconCfg = {
        done: {
            bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.4)',
            dot: null,
            check: true,
        },
        in_progress: {
            bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.45)',
            dot: 'rgba(251,191,36,1)',
            check: false,
        },
        pending: {
            bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)',
            dot: 'rgba(255,255,255,0.2)',
            check: false,
        },
    }[event.status];

    const cardBg = {
        done: 'rgba(34,197,94,0.06)',
        in_progress: 'rgba(251,191,36,0.07)',
        pending: 'rgba(255,255,255,0.02)',
    }[event.status];

    const cardBorder = {
        done: 'rgba(34,197,94,0.2)',
        in_progress: 'rgba(251,191,36,0.25)',
        pending: 'rgba(255,255,255,0.07)',
    }[event.status];

    return (
        <div style={{ display: 'flex', gap: '0.85rem', marginBottom: isLast ? 0 : '0.1rem' }}>
            {/* Icon column */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: iconCfg.bg,
                    border: `1.5px solid ${iconCfg.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, zIndex: 1,
                }}>
                    {iconCfg.check ? (
                        <svg width="13" height="13" viewBox="0 0 20 20" fill="rgba(74,222,128,1)">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    ) : (
                        <span style={{
                            width: 9, height: 9, borderRadius: '50%',
                            background: iconCfg.dot ?? 'transparent', display: 'block',
                            animation: event.status === 'in_progress' ? 'blink 1.4s ease infinite' : 'none',
                        }} />
                    )}
                </div>
                {!isLast && (
                    <div style={{
                        width: 1, flex: 1, marginTop: 3,
                        background: event.status === 'done'
                            ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.07)',
                    }} />
                )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, paddingBottom: isLast ? 0 : '0.85rem' }}>

                {/* Non-question */}
                {!isQuestion && (
                    <div style={{
                        borderRadius: 10, padding: '0.85rem 1rem',
                        background: cardBg, border: `1px solid ${cardBorder}`,
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
                            {/* ↑↑ Boosted event label */}
                            <span style={{
                                fontSize: '0.88rem', fontWeight: 700,
                                color: event.status === 'pending' ? 'rgba(255,255,255,0.3)' : '#ffffff',
                            }}>
                                {event.label}
                            </span>
                            {event.timestamp && (
                                <span style={{
                                    fontSize: '0.75rem', fontWeight: 500,
                                    color: 'rgba(255,255,255,0.35)',
                                    flexShrink: 0, fontVariantNumeric: 'tabular-nums',
                                }}>
                                    {formatTime(event.timestamp)}
                                </span>
                            )}
                        </div>
                        {event.detail && (
                            <div style={{
                                fontSize: '0.8rem', fontWeight: 400,
                                color: event.status === 'pending' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.48)',
                                marginTop: '0.3rem', lineHeight: 1.5,
                            }}>
                                {event.detail}
                            </div>
                        )}

                    </div>
                )}

                {/* Question event */}
                {isQuestion && (
                    <div style={{
                        borderRadius: 10, padding: '0.85rem 1rem',
                        background: cardBg, border: `1px solid ${cardBorder}`,
                        opacity: event.status === 'pending' ? 0.55 : 1,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: 0 }}>
                                {/* Q-number chip */}
                                <div style={{
                                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: event.status === 'done' ? 'rgba(34,197,94,0.18)' :
                                        event.status === 'in_progress' ? 'rgba(251,191,36,0.18)' :
                                            'rgba(255,255,255,0.06)',
                                    border: `1px solid ${event.status === 'done' ? 'rgba(34,197,94,0.35)' :
                                            event.status === 'in_progress' ? 'rgba(251,191,36,0.4)' :
                                                'rgba(255,255,255,0.1)'
                                        }`,
                                    /* ↑↑ Boosted Q number */
                                    fontSize: '0.78rem', fontWeight: 800,
                                    color: event.status === 'done' ? 'rgba(74,222,128,1)' :
                                        event.status === 'in_progress' ? 'rgba(253,224,71,1)' :
                                            'rgba(255,255,255,0.3)',
                                }}>
                                    Q{event.questionNumber}
                                </div>

                                <div>
                                    {/* ↑↑ Boosted question label */}
                                    <div style={{
                                        fontSize: '0.88rem', fontWeight: 700,
                                        color: event.status === 'pending' ? 'rgba(255,255,255,0.3)' : '#ffffff',
                                    }}>
                                        {event.label}
                                    </div>
                                    {event.status === 'in_progress' && (
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: '0.35rem',
                                            fontSize: '0.78rem', fontWeight: 600,
                                            color: 'rgba(253,224,71,0.9)', marginTop: '0.2rem',
                                        }}>
                                            <span style={{
                                                width: 6, height: 6, borderRadius: '50%',
                                                background: 'rgba(251,191,36,1)', display: 'inline-block',
                                                animation: 'blink 1.2s ease infinite',
                                            }} />
                                            Evaluating now…
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Marks + time */}
                            {event.status === 'done' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                                    {event.marksAwarded !== undefined && event.maxMarks !== undefined && (() => {
                                        const ratio = event.marksAwarded / event.maxMarks;
                                        const mc = ratio >= 0.6
                                            ? { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.35)', text: 'rgba(74,222,128,1)' }
                                            : ratio >= 0.35
                                                ? { bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.4)', text: 'rgba(253,224,71,1)' }
                                                : { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.35)', text: 'rgba(252,165,165,1)' };
                                        return (
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{
                                                    padding: '0.22rem 0.6rem', borderRadius: 100,
                                                    background: mc.bg, border: `1px solid ${mc.border}`,
                                                    /* ↑↑ Boosted marks text */
                                                    fontSize: '0.82rem', fontWeight: 800, color: mc.text,
                                                }}>
                                                    {event.marksAwarded}/{event.maxMarks}
                                                </div>
                                                <div style={{ fontSize: '0.72rem', fontWeight: 500, color: 'rgba(255,255,255,0.35)', marginTop: '0.25rem', textAlign: 'right' }}>
                                                    {Math.round(ratio * 100)}%
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {event.timeSpent !== undefined && (() => {
                                        const tc = event.timeSpent < 5
                                            ? { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', text: 'rgba(252,165,165,1)' }
                                            : event.timeSpent < 15
                                                ? { bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.3)', text: 'rgba(165,180,252,1)' }
                                                : { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', text: 'rgba(255,255,255,0.6)' };
                                        return (
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{
                                                    padding: '0.22rem 0.6rem', borderRadius: 100,
                                                    background: tc.bg, border: `1px solid ${tc.border}`,
                                                    /* ↑↑ Boosted time text */
                                                    fontSize: '0.78rem', fontWeight: 700, color: tc.text,
                                                }}>
                                                    ⏱ {secondsToReadable(event.timeSpent)}
                                                </div>
                                                {event.timestamp && (
                                                    <div style={{
                                                        fontSize: '0.7rem', fontWeight: 500,
                                                        color: 'rgba(255,255,255,0.3)',
                                                        marginTop: '0.25rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                                                    }}>
                                                        {formatTime(event.timestamp)}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Result Card ───────────────────────────────────────────
function ResultCard({ result, maxMarks }: { result: ProgressData['result']; maxMarks: number }) {
    if (!result.available) return null;
    const total = result.totalMarks ?? 0;
    const max = result.maxMarks ?? maxMarks;
    const pct = max > 0 ? Math.round((total / max) * 100) : 0;

    const grade =
        pct >= 90 ? { label: 'A+', color: 'rgba(74,222,128,1)', bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.3)' } :
            pct >= 80 ? { label: 'A', color: 'rgba(74,222,128,1)', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.25)' } :
                pct >= 70 ? { label: 'B+', color: 'rgba(147,197,253,1)', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)' } :
                    pct >= 60 ? { label: 'B', color: 'rgba(147,197,253,1)', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)' } :
                        pct >= 50 ? { label: 'C', color: 'rgba(253,224,71,1)', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.25)' } :
                            pct >= 40 ? { label: 'D', color: 'rgba(253,186,116,1)', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.25)' } :
                                { label: 'F', color: 'rgba(252,165,165,1)', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)' };

    return (
        <div style={{
            margin: '1rem 1.25rem',
            borderRadius: 12, padding: '1.25rem',
            background: 'rgba(34,197,94,0.07)',
            border: '1px solid rgba(34,197,94,0.25)',
            position: 'relative', overflow: 'hidden',
        }}>
            {/* Glow */}
            <div style={{
                position: 'absolute', top: -30, right: -30,
                width: 100, height: 100, borderRadius: '50%',
                background: 'rgba(34,197,94,0.15)', filter: 'blur(30px)',
                pointerEvents: 'none',
            }} />

            {/* ↑↑ Boosted header */}
            <div style={{
                fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.14em',
                textTransform: 'uppercase' as const,
                color: 'rgba(74,222,128,0.85)', marginBottom: '0.85rem',
                display: 'flex', alignItems: 'center', gap: '0.4rem',
            }}>
                🎉 Final Result
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    {/* ↑↑ Boosted score */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.2rem' }}>
                        <span style={{ fontSize: '2.8rem', fontWeight: 900, color: '#ffffff', lineHeight: 1, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '-0.01em' }}>
                            {total}
                        </span>
                        <span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>
                            /{max}
                        </span>
                    </div>
                    {/* ↑↑ Boosted pct label */}
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginTop: '0.25rem' }}>
                        {pct}% scored
                    </div>
                </div>

                {/* Grade badge */}
                <div style={{
                    width: 60, height: 60, borderRadius: 14, flexShrink: 0,
                    background: grade.bg, border: `1.5px solid ${grade.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 0 20px ${grade.border}`,
                }}>
                    <span style={{
                        fontSize: '1.8rem', fontWeight: 900,
                        color: grade.color, fontFamily: "'Bebas Neue', sans-serif",
                    }}>
                        {grade.label}
                    </span>
                </div>
            </div>

            {/* Score bar */}
            <div style={{
                marginTop: '1rem', height: 5, borderRadius: 100,
                background: 'rgba(255,255,255,0.07)', overflow: 'hidden',
            }}>
                <div style={{
                    height: '100%', borderRadius: 100, width: `${pct}%`,
                    background: 'rgba(34,197,94,0.85)',
                    boxShadow: '0 0 8px rgba(34,197,94,0.6)',
                    transition: 'width 1s ease',
                }} />
            </div>
        </div>
    );
}

// ── Animated Modal Wrapper ────────────────────────────────
function ModalAnimator({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // tiny delay so the CSS transition fires after mount
        const t = requestAnimationFrame(() => setVisible(true));
        return () => cancelAnimationFrame(t);
    }, []);

    const handleClose = () => {
        setVisible(false);
        setTimeout(onClose, 300);
    };

    return (
        <div
            onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '1rem',
                background: visible ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0)',
                backdropFilter: visible ? 'blur(8px)' : 'blur(0px)',
                transition: 'background 0.3s ease, backdrop-filter 0.3s ease',
            }}
        >
            <div style={{
                width: '100%', maxWidth: 480,
                transform: visible ? 'translateY(0) scale(1)' : 'translateY(32px) scale(0.96)',
                opacity: visible ? 1 : 0,
                transition: 'transform 0.35s cubic-bezier(0.34,1.4,0.64,1), opacity 0.3s ease',
            }}>
                {/* Pass handleClose via context trick — wrap with close button */}
                {typeof children === 'function'
                    ? (children as any)(handleClose)
                    : children}
            </div>
        </div>
    );
}

// ── Main Modal ────────────────────────────────────────────
export default function EvaluationProgressModal({ submissionId, onClose }: Props) {
    const [data, setData] = useState<ProgressData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
    const [visible, setVisible] = useState(false);

    const fetchProgress = useCallback(async (isRefresh = false) => {
        try {
            isRefresh ? setRefreshing(true) : setLoading(true);
            setError('');
            const res = await fetch(`/api/student/evaluation-progress/${submissionId}`, { cache: 'no-store' });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
            setData(await res.json());
            setLastRefresh(new Date());
        } catch (e: any) {
            setError(e.message || 'Could not load progress');
        } finally {
            setLoading(false); setRefreshing(false);
        }
    }, [submissionId]);

    useEffect(() => { fetchProgress(); }, [fetchProgress]);

    // Entrance animation trigger
    useEffect(() => {
        const t = requestAnimationFrame(() => setVisible(true));
        return () => cancelAnimationFrame(t);
    }, []);

    // Escape key
    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, []);

    const handleClose = () => {
        setVisible(false);
        setTimeout(onClose, 320);
    };

    // ── Backdrop ──────────────────────────────────────────
    return (
        <>
            <style>{`
        @keyframes spinAnim { to { transform: rotate(360deg); } }
        @keyframes blink    { 0%,100%{opacity:1;} 50%{opacity:0.15;} }
        @keyframes shimmer  {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        .modal-scroll::-webkit-scrollbar { width: 3px; }
        .modal-scroll::-webkit-scrollbar-track { background: transparent; }
        .modal-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>

            {/* Backdrop */}
            <div
                onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
                style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '1.25rem',
                    background: visible ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0)',
                    backdropFilter: visible ? 'blur(10px)' : 'blur(0px)',
                    transition: 'background 0.3s ease, backdrop-filter 0.3s ease',
                }}
            >
                {/* Modal panel */}
                <div style={{
                    width: '100%', maxWidth: 500,
                    maxHeight: 'calc(100vh - 2.5rem)',
                    display: 'flex', flexDirection: 'column',
                    background: '#0c0c0c',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 18,
                    overflow: 'hidden',
                    boxShadow: '0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)',
                    transform: visible ? 'translateY(0) scale(1)' : 'translateY(40px) scale(0.95)',
                    opacity: visible ? 1 : 0,
                    transition: 'transform 0.38s cubic-bezier(0.34,1.35,0.64,1), opacity 0.3s ease',
                    fontFamily: "'Inter', system-ui, sans-serif",
                }}>

                    {/* ── Modal Header ── */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '1.1rem 1.4rem',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        flexShrink: 0,
                    }}>
                        <div>
                            {/* ↑↑ Boosted header eyebrow */}
                            <div style={{
                                fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.16em',
                                textTransform: 'uppercase' as const,
                                color: 'rgba(255,255,255,0.35)', marginBottom: '0.3rem',
                            }}>
                                Evaluation Progress
                            </div>
                            {/* ↑↑ Boosted sub-ID */}
                            <div style={{
                                fontSize: '0.78rem', fontWeight: 500,
                                color: 'rgba(255,255,255,0.3)',
                                fontVariantNumeric: 'tabular-nums',
                            }}>
                                {submissionId.slice(0, 22)}…
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            {lastRefresh && (
                                <span style={{
                                    fontSize: '0.72rem', fontWeight: 500,
                                    color: 'rgba(255,255,255,0.28)',
                                }}>
                                    {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                                </span>
                            )}

                            {/* Refresh btn */}
                            <button
                                onClick={() => fetchProgress(true)}
                                disabled={refreshing}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                                    padding: '0.45rem 0.9rem',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: 8, cursor: refreshing ? 'not-allowed' : 'pointer',
                                    opacity: refreshing ? 0.5 : 1,
                                    /* ↑↑ Boosted btn text */
                                    fontSize: '0.8rem', fontWeight: 700,
                                    color: 'rgba(255,255,255,0.7)',
                                    fontFamily: 'inherit',
                                    transition: 'background 0.2s, border-color 0.2s',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; }}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                    style={{ animation: refreshing ? 'spinAnim 0.7s linear infinite' : 'none' }}>
                                    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                {refreshing ? 'Refreshing…' : 'Refresh'}
                            </button>

                            {/* Close btn */}
                            <button
                                onClick={handleClose}
                                style={{
                                    width: 34, height: 34,
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 9, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'rgba(255,255,255,0.55)',
                                    transition: 'background 0.2s, color 0.2s',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.15)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(252,165,165,1)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.55)'; }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* ── Scrollable Content ── */}
                    <div className="modal-scroll" style={{ overflowY: 'auto', flex: 1 }}>

                        {/* Loading */}
                        {loading && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', gap: '1rem' }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: '50%',
                                    border: '2px solid rgba(255,255,255,0.08)',
                                    borderTop: '2px solid rgba(255,255,255,0.6)',
                                    animation: 'spinAnim 0.7s linear infinite',
                                }} />
                                {/* ↑↑ Boosted loading text */}
                                <span style={{ fontSize: '0.88rem', fontWeight: 500, color: 'rgba(255,255,255,0.4)' }}>
                                    Loading evaluation progress…
                                </span>
                            </div>
                        )}

                        {/* Error */}
                        {!loading && error && (
                            <div style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                                <div style={{
                                    width: 48, height: 48, borderRadius: 12,
                                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    margin: '0 auto 1rem',
                                }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                                        stroke="rgba(252,165,165,1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 6L6 18M6 6l12 12" />
                                    </svg>
                                </div>
                                {/* ↑↑ Boosted error text */}
                                <p style={{ fontSize: '0.92rem', fontWeight: 600, color: 'rgba(252,165,165,0.9)', marginBottom: '0.75rem' }}>{error}</p>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.65rem' }}>
                                    <button onClick={() => fetchProgress()} style={{
                                        padding: '0.55rem 1.2rem',
                                        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                                        borderRadius: 9, cursor: 'pointer',
                                        fontSize: '0.85rem', fontWeight: 700,
                                        color: '#ffffff', fontFamily: 'inherit',
                                    }}>Retry</button>
                                    <button onClick={handleClose} style={{
                                        padding: '0.55rem 1.2rem',
                                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: 9, cursor: 'pointer',
                                        fontSize: '0.85rem', fontWeight: 600,
                                        color: 'rgba(255,255,255,0.55)', fontFamily: 'inherit',
                                    }}>Close</button>
                                </div>
                            </div>
                        )}

                        {/* Main content */}
                        {!loading && !error && data && (
                            <>
                                <StageBanner stage={data.currentStage} progress={data.overallProgress} test={data.test} />
                                <StatsRow data={data} />

                                {data.result.available && (
                                    <ResultCard result={data.result} maxMarks={data.test.maxMarks} />
                                )}

                                {/* Timeline */}
                                <div style={{ padding: '1.25rem 1.25rem 0.5rem' }}>
                                    {/* ↑↑ Boosted timeline header */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                                        marginBottom: '1.1rem',
                                    }}>
                                        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                                        <span style={{
                                            fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.14em',
                                            textTransform: 'uppercase' as const,
                                            color: 'rgba(255,255,255,0.4)',
                                        }}>
                                            Evaluation Timeline
                                        </span>
                                        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                                    </div>

                                    {data.timeline.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                                            {/* ↑↑ Boosted empty */}
                                            <p style={{ fontSize: '0.88rem', fontWeight: 500, color: 'rgba(255,255,255,0.35)' }}>
                                                No activity recorded yet
                                            </p>
                                        </div>
                                    ) : (
                                        data.timeline.map((event, idx) => (
                                            <TimelineItem key={event.id} event={event} isLast={idx === data.timeline.length - 1} />
                                        ))
                                    )}
                                </div>

                                {/* Teacher card */}
                                {data.teacher && (
                                    <div style={{
                                        margin: '0.75rem 1.25rem',
                                        padding: '1rem',
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: 12,
                                        display: 'flex', alignItems: 'center', gap: '0.85rem',
                                    }}>
                                        <div style={{
                                            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                                            background: 'linear-gradient(135deg, rgba(99,102,241,0.5), rgba(167,139,250,0.6))',
                                            border: '1px solid rgba(167,139,250,0.4)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1rem', fontWeight: 800, color: '#fff',
                                        }}>
                                            {data.teacher.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            {/* ↑↑ Boosted teacher name */}
                                            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff' }}>
                                                {data.teacher.name}
                                            </div>
                                            {/* ↑↑ Boosted dept */}
                                            <div style={{ fontSize: '0.78rem', fontWeight: 500, color: 'rgba(255,255,255,0.4)', marginTop: '0.1rem' }}>
                                                {data.teacher.department || 'Evaluator'}
                                            </div>
                                        </div>
                                        <div style={{
                                            padding: '0.3rem 0.75rem', borderRadius: 100,
                                            background: 'rgba(167,139,250,0.12)',
                                            border: '1px solid rgba(167,139,250,0.3)',
                                            /* ↑↑ Boosted badge */
                                            fontSize: '0.75rem', fontWeight: 700,
                                            color: 'rgba(216,180,254,1)',
                                        }}>
                                            Your Evaluator
                                        </div>
                                    </div>
                                )}

                                {/* Grievance notice */}
                                {data.grievance.filed && (
                                    <div style={{
                                        margin: '0.75rem 1.25rem',
                                        padding: '1rem',
                                        background: 'rgba(249,115,22,0.08)',
                                        border: '1px solid rgba(249,115,22,0.25)',
                                        borderRadius: 12,
                                        display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                                    }}>
                                        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>⚠️</span>
                                        <div>
                                            {/* ↑↑ Boosted grievance title */}
                                            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'rgba(253,186,116,1)', marginBottom: '0.25rem' }}>
                                                Grievance Filed
                                            </div>
                                            {/* ↑↑ Boosted grievance detail */}
                                            <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'rgba(253,186,116,0.75)' }}>
                                                Status: {data.grievance.status || 'Pending'}
                                                {data.grievance.reason ? ` · ${data.grievance.reason}` : ''}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Footer */}
                                <div style={{ textAlign: 'center', padding: '1rem 1.25rem 1.5rem' }}>
                                    {/* ↑↑ Boosted footer date */}
                                    <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'rgba(255,255,255,0.28)' }}>
                                        Submitted on {formatDate(data.submittedAt)}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
