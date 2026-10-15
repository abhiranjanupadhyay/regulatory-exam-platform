import { useState } from 'react';
import { Flag } from 'lucide-react';
import { api } from '../../api.js';
import { Empty, Field, Modal, useToast } from '../../components/ui.jsx';

/** Interactive practice questions: pick an option to get instant feedback, explanation and citation. */
export default function PracticeDeck({ questions }) {
  const toast = useToast();
  const [done, setDone] = useState({});
  const [report, setReport] = useState(null);
  const [remarks, setRemarks] = useState('');

  const choose = async (q, choice) => {
    if (done[q.id]) return;
    try {
      const fb = await api('/api/practice/answer', { method: 'POST', body: { mcqId: q.id, choice } });
      setDone((d) => ({ ...d, [q.id]: { ...fb, choice } }));
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const send = async () => {
    try {
      await api('/api/tickets', { method: 'POST', body: { mcqId: report.id, remarks } });
      toast('Reported to the administrator', 'success');
      setReport(null);
      setRemarks('');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  if (!questions.length) return <Empty title="No practice questions yet" hint="Questions for this chapter have not been uploaded." />;
  return (
    <>
      {questions.map((q, i) => {
        const r = done[q.id];
        return (
          <div className="mcq" key={q.id}>
            <div className="row between" style={{ alignItems: 'flex-start' }}>
              <div style={{ fontWeight: 600 }}>{i + 1}. {q.question}</div>
              <button className="btn ghost sm" title="Report discrepancy" onClick={() => setReport(q)}><Flag size={14} />Report</button>
            </div>
            {['A', 'B', 'C', 'D'].map((k) => {
              let cls = '';
              if (r) cls = k === r.correctOption ? 'correct' : k === r.choice ? 'wrong' : '';
              return (
                <button key={k} className={`opt ${cls}`} disabled={!!r} onClick={() => choose(q, k)}>
                  <span className="key">{k}</span><span>{q[`option${k}`]}</span>
                </button>
              );
            })}
            {r && (
              <div className="explain">
                <b>{r.correct ? 'Correct.' : `Incorrect. Answer: ${r.correctOption}.`}</b> {r.explanation}
                {r.citation && <div className="small muted" style={{ marginTop: 6 }}>Reference: {r.citation}</div>}
              </div>
            )}
          </div>
        );
      })}
      {report && (
        <Modal title="Report a discrepancy" onClose={() => setReport(null)}
          footer={<><button className="btn" onClick={() => setReport(null)}>Cancel</button><button className="btn primary" disabled={!remarks.trim()} onClick={send}>Send to admin</button></>}>
          <p className="muted" style={{ marginTop: 0 }}>{report.question}</p>
          <Field label="What looks wrong?"><textarea className="input" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Confusing stem, disputed answer, wrong citation..." /></Field>
        </Modal>
      )}
    </>
  );
}
