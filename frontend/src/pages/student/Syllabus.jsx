import { useNavigate } from 'react-router-dom';
import { Lock, LockOpen, BookText, Trophy } from 'lucide-react';
import { api, fmtDateTime } from '../../api.js';
import { Alert, Badge, Card, Loading, PageHead, Progress, useLoad, useToast } from '../../components/ui.jsx';
import { useStudent } from './context.jsx';

const TIER_NAME = { 1: 'Tier 1 · Foundation', 2: 'Tier 2 · Expansion', 3: 'Tier 3 · Mastery' };

export default function Syllabus() {
  const { examId, examName } = useStudent();
  const nav = useNavigate();
  const toast = useToast();
  const data = useLoad(async () => ({
    syllabus: await api(`/api/exams/${examId}/syllabus`),
    tiers: await api(`/api/tiers/me?examId=${examId}`),
  }), [examId]);

  const qualify = async (tier) => {
    try {
      const paper = await api('/api/tests', { method: 'POST', body: { mode: 'QUALIFYING', examId, tier } });
      sessionStorage.setItem(`paper:${paper.attemptId}`, JSON.stringify(paper));
      nav(`/app/test/${paper.attemptId}`);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <div className="page">
      <PageHead title="Syllabus" subtitle={`${examName(examId)} · papers, topics and preparation tiers`} />
      <Loading state={data}>
        {({ syllabus, tiers }) => (
          <div className="stack" style={{ gap: 22 }}>
            {syllabus.papers.length === 0 && <Alert kind="info">The syllabus has not been published yet.</Alert>}
            {syllabus.papers.map((paper) => (
              <Card key={paper.id} title={paper.name} flush>
                {[1, 2, 3].map((tier) => {
                  const topics = paper.topics.filter((t) => t.tier === tier);
                  if (!topics.length) return null;
                  const st = tiers.find((t) => t.tier === tier);
                  return (
                    <div key={tier}>
                      <div className="tier-head" style={{ margin: 0, padding: '14px 20px', background: '#fafbfe', borderTop: '1px solid var(--line)' }}>
                        <span className={`tag tier-${tier}`}>{TIER_NAME[tier]}</span>
                        {st.unlocked ? <Badge tone="green"><LockOpen size={12} />Open</Badge> : <Badge tone="gray"><Lock size={12} />Locked</Badge>}
                      </div>
                      {topics.map((t) => (
                        <div key={t.id} className={`topic ${st.unlocked ? '' : 'locked'}`} onClick={() => st.unlocked && nav(`/app/study/${t.id}`)}>
                          {st.unlocked ? <BookText size={18} color="var(--brand)" /> : <Lock size={18} />}
                          <div className="grow"><div style={{ fontWeight: 600 }}>{t.title}</div>
                            <div className="small muted">{t.mcqCount} questions · weightage {t.weightage}%</div></div>
                          {!t.hasBook && <Badge tone="amber">Book coming soon</Badge>}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </Card>
            ))}

            {tiers.filter((t) => !t.unlocked).map((t) => (
              <Card key={t.tier} title={`Unlock Tier ${t.tier}`}>
                <div className="grid c2">
                  <div>
                    <div className="row between small"><span>Tier {t.tier - 1} practice coverage</span><b>{t.previousTierCoveragePct}% / {t.coverageRequiredPct}% needed</b></div>
                    <Progress value={t.previousTierCoveragePct} tone={t.previousTierCoveragePct >= t.coverageRequiredPct ? 'green' : ''} />
                    <p className="small muted">Then score at least {t.qualifyingScorePct}% in the qualifying exam (50 questions, 60 minutes).</p>
                    {t.retryAvailableAt && <Alert kind="warn">Retry available after {fmtDateTime(t.retryAvailableAt)}.</Alert>}
                  </div>
                  <div className="row" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn primary lg" disabled={!t.canAttemptQualifier} onClick={() => qualify(t.tier)}><Trophy size={16} />Take qualifying exam</button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Loading>
    </div>
  );
}
