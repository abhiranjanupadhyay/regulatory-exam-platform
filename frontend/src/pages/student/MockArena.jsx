import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, ListChecks, Play, Trophy } from 'lucide-react';
import { api, fmtDateTime } from '../../api.js';
import { Badge, Card, Empty, Loading, PageHead, useLoad, useToast } from '../../components/ui.jsx';
import { useStudent } from './context.jsx';

export default function MockArena() {
  const { examId, examName } = useStudent();
  const nav = useNavigate();
  const toast = useToast();
  const [topicId, setTopicId] = useState('');
  const data = useLoad(async () => ({
    syllabus: await api(`/api/exams/${examId}/syllabus`),
    tiers: await api(`/api/tiers/me?examId=${examId}`),
    history: await api('/api/tests'),
  }), [examId]);

  const start = async (body) => {
    try {
      const paper = await api('/api/tests', { method: 'POST', body: { examId, ...body } });
      sessionStorage.setItem(`paper:${paper.attemptId}`, JSON.stringify(paper));
      nav(`/app/test/${paper.attemptId}`);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <div className="page">
      <PageHead title="Mock Arena" subtitle={`${examName(examId)} · timed tests that mirror the computer-based exam`} />
      <Loading state={data}>
        {({ syllabus, tiers, history }) => {
          const topics = syllabus.papers.flatMap((p) => p.topics.filter((t) => tiers.find((x) => x.tier === t.tier)?.unlocked).map((t) => ({ ...t, paper: p.name })));
          const next = tiers.find((t) => !t.unlocked);
          return (
            <div className="stack" style={{ gap: 20 }}>
              <div className="grid c3">
                <Card className="mode-card">
                  <div className="ico tone-brand"><Layers size={24} /></div>
                  <h3 style={{ margin: 0 }}>Full syllabus mock</h3>
                  <p className="muted" style={{ margin: 0 }}>100 questions · 120 minutes. Negative marking of 0.25 per wrong answer.</p>
                  <button className="btn primary" onClick={() => start({ mode: 'FULL' })}><Play size={15} />Start mock</button>
                </Card>
                <Card className="mode-card">
                  <div className="ico tone-green"><ListChecks size={24} /></div>
                  <h3 style={{ margin: 0 }}>Topic / chapter test</h3>
                  <p className="muted" style={{ margin: 0 }}>20 questions · 30 minutes on a chapter of your choice.</p>
                  <select className="input" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                    <option value="">Select a chapter</option>
                    {topics.map((t) => <option key={t.id} value={t.id}>{t.paper}: {t.title}</option>)}
                  </select>
                  <button className="btn primary" disabled={!topicId} onClick={() => start({ mode: 'TOPIC', topicId })}><Play size={15} />Start test</button>
                </Card>
                <Card className="mode-card">
                  <div className="ico tone-amber"><Trophy size={24} /></div>
                  <h3 style={{ margin: 0 }}>Tier qualifying exam</h3>
                  {next ? (
                    <>
                      <p className="muted" style={{ margin: 0 }}>50 questions · 60 minutes. Unlocks Tier {next.tier}; needs {next.coverageRequiredPct}% Tier {next.tier - 1} practice ({next.previousTierCoveragePct}% done).</p>
                      <button className="btn primary" disabled={!next.canAttemptQualifier} onClick={() => start({ mode: 'QUALIFYING', tier: next.tier })}><Play size={15} />Attempt for Tier {next.tier}</button>
                      {next.retryAvailableAt && <span className="small muted">Retry after {fmtDateTime(next.retryAvailableAt)}</span>}
                    </>
                  ) : <p className="muted" style={{ margin: 0 }}>All tiers are unlocked.</p>}
                </Card>
              </div>

              <Card title="Your attempts" flush>
                {history.length === 0 ? <Empty title="No attempts yet" hint="Your scorecards will appear here." /> : (
                  <div className="table-wrap"><table className="table">
                    <thead><tr><th>Test</th><th>Started</th><th>Score</th><th>Result</th><th /></tr></thead>
                    <tbody>{history.map((h) => (
                      <tr key={h.attemptId}>
                        <td><b>{h.scopeLabel}</b></td>
                        <td>{fmtDateTime(h.startedAt)}</td>
                        <td>{h.percentage != null ? `${h.percentage}%` : '-'}</td>
                        <td>{h.status !== 'SUBMITTED' ? <Badge tone="amber">In progress</Badge> : h.passed ? <Badge tone="green">Pass</Badge> : <Badge tone="red">Fail</Badge>}</td>
                        <td style={{ textAlign: 'right' }}>
                          {h.status === 'SUBMITTED'
                            ? <button className="btn sm" onClick={() => nav(`/app/results/${h.attemptId}`)}>Scorecard</button>
                            : sessionStorage.getItem(`paper:${h.attemptId}`) && <button className="btn sm primary" onClick={() => nav(`/app/test/${h.attemptId}`)}>Resume</button>}
                        </td>
                      </tr>))}
                    </tbody>
                  </table></div>
                )}
              </Card>
            </div>
          );
        }}
      </Loading>
    </div>
  );
}
