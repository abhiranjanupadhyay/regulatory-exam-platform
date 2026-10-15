import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import { api, fmtDateTime } from '../../api.js';
import { Alert, Badge, Card, Loading, PageHead, Stat, useLoad } from '../../components/ui.jsx';
import Protected from '../../components/Protected.jsx';

export default function Result() {
  const { id } = useParams();
  const nav = useNavigate();
  const r = useLoad(() => api(`/api/tests/${id}/result`), [id]);
  return (
    <Protected>
      <div className="page">
        <Loading state={r}>
          {(x) => (
            <>
              <PageHead title="Scorecard" subtitle={`${x.scopeLabel} · submitted ${fmtDateTime(x.submittedAt)}`}>
                <button className="btn" onClick={() => nav('/app/mocks')}>Back to Mock Arena</button>
              </PageHead>
              <Alert kind={x.passed ? 'success' : 'error'}>
                <b>{x.passed ? 'Passed' : 'Not passed'}</b> · {x.percentage}% {x.mode === 'QUALIFYING' && (x.passed ? '· the next tier is now unlocked.' : '· retry after the cooldown period.')}
              </Alert>
              <div className="grid c4" style={{ margin: '18px 0' }}>
                <Stat icon={CheckCircle2} tone="green" value={x.correct} label="Correct" />
                <Stat icon={XCircle} tone="red" value={x.wrong} label="Wrong" />
                <Stat icon={MinusCircle} tone="amber" value={x.unanswered} label="Unanswered" />
                <Stat icon={CheckCircle2} tone="brand" value={x.score} label={`Total score (−${x.negativeMarksDeducted} negative)`} />
              </div>
              <Card title="Detailed review">
                {x.review.map((q) => (
                  <div className="mcq" key={q.number}>
                    <div className="row between"><b>{q.number}. {q.question}</b>
                      {!q.selected ? <Badge tone="gray">Unanswered</Badge> : q.selected === q.correct ? <Badge tone="green">Correct</Badge> : <Badge tone="red">Wrong</Badge>}</div>
                    {['A', 'B', 'C', 'D'].map((k) => (
                      <div key={k} className={`opt ${k === q.correct ? 'correct' : k === q.selected ? 'wrong' : ''}`} style={{ cursor: 'default' }}>
                        <span className="key">{k}</span><span>{q[`option${k}`]}{k === q.selected ? '  (your answer)' : ''}</span>
                      </div>
                    ))}
                    {(q.explanation || q.citation) && <div className="explain">{q.explanation}{q.citation && <div className="small muted" style={{ marginTop: 6 }}>Reference: {q.citation}</div>}</div>}
                  </div>
                ))}
              </Card>
            </>
          )}
        </Loading>
      </div>
    </Protected>
  );
}
