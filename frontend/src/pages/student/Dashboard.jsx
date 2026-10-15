import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Flame, Gauge, ListChecks, Target } from 'lucide-react';
import { api } from '../../api.js';
import { Card, Empty, Loading, PageHead, Stat, useLoad } from '../../components/ui.jsx';
import { useStudent } from './context.jsx';
import { useAuth } from '../../auth.jsx';

function Ring({ value }) {
  const r = 62;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring">
      <svg width="150" height="150" viewBox="0 0 150 150">
        <circle cx="75" cy="75" r={r} fill="none" stroke="#e8ebf5" strokeWidth="14" />
        <circle cx="75" cy="75" r={r} fill="none" stroke="var(--brand)" strokeWidth="14" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} transform="rotate(-90 75 75)" />
      </svg>
      <div className="num">{value}%</div>
    </div>
  );
}

export default function Dashboard() {
  const { examId, examName } = useStudent();
  const { user } = useAuth();
  const nav = useNavigate();
  const d = useLoad(() => api(`/api/dashboard?examId=${examId}`), [examId]);

  return (
    <div className="page">
      <PageHead title={`Welcome back, ${user.name.split(' ')[0]}`} subtitle={`${examName(examId)} preparation overview`} />
      <Loading state={d}>
        {(x) => (
          <div className="stack" style={{ gap: 18 }}>
            <div className="grid c2">
              <Card title="Readiness meter">
                <div className="row" style={{ gap: 28 }}>
                  <Ring value={x.readinessPct} />
                  <div className="grow stack" style={{ gap: 12 }}>
                    <div><div className="row between small"><span>Syllabus completion</span><b>{x.syllabusCompletionPct}%</b></div>
                      <div className="progress"><span style={{ width: `${x.syllabusCompletionPct}%` }} /></div></div>
                    <div><div className="row between small"><span>Accuracy</span><b>{x.accuracyPct}%</b></div>
                      <div className="progress green"><span style={{ width: `${x.accuracyPct}%` }} /></div></div>
                  </div>
                </div>
              </Card>
              <Card title="Pick up where you left off">
                {x.resume ? (
                  <div className="stack">
                    <div><div className="muted small">Last studied</div><div style={{ fontWeight: 700, fontSize: 17 }}>{x.resume.topic}</div></div>
                    <button className="btn primary lg" onClick={() => nav(`/app/study/${x.resume.topicId}`)}>Resume <ArrowRight size={16} /></button>
                  </div>
                ) : (
                  <Empty icon={ListChecks} title="No activity yet" hint="Open the Study Table and answer your first question." />
                )}
              </Card>
            </div>

            <div className="grid c3">
              <Stat icon={Target} tone="brand" value={x.questionsPracticed} label="Questions practised" />
              <Stat icon={Gauge} tone="green" value={`${x.averageMockScore}%`} label="Average mock score" />
              <Stat icon={Flame} tone="amber" value={`${x.streakDays} day${x.streakDays === 1 ? '' : 's'}`} label="Current streak" />
            </div>

            <Card title="Weak-area remediation" actions={x.weakAreas.length > 0 && <Link className="btn primary sm" to="/app/practice/weak">Practice weak MCQs</Link>}>
              {x.weakAreas.length === 0 ? (
                <div className="muted">No weak areas detected. Mistakes in practice or mocks will show up here.</div>
              ) : x.weakAreas.map((w) => (
                <div key={w.topicId} className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                  <div className="row"><AlertTriangle size={16} color="var(--amber)" /><Link to={`/app/study/${w.topicId}`}>{w.topic}</Link></div>
                  <span className="badge amber">{w.weakQuestions} to revisit</span>
                </div>
              ))}
            </Card>
          </div>
        )}
      </Loading>
    </div>
  );
}
