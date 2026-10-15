import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Eraser, Flag, Send } from 'lucide-react';
import { api } from '../../api.js';
import { Alert, Modal, useToast } from '../../components/ui.jsx';
import Protected from '../../components/Protected.jsx';

const fmt = (s) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function TestRunner() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const paper = useMemo(() => JSON.parse(sessionStorage.getItem(`paper:${id}`) || 'null'), [id]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState(() => JSON.parse(sessionStorage.getItem(`answers:${id}`) || '{}'));
  const [marked, setMarked] = useState(new Set());
  const [visited, setVisited] = useState(new Set([0]));
  const [left, setLeft] = useState(() => (paper ? Math.max(0, Math.floor((new Date(paper.endsAt) - Date.now()) / 1000)) : 0));
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const submit = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api(`/api/tests/${id}/submit`, { method: 'POST', body: { answers: answersRef.current } });
      sessionStorage.removeItem(`paper:${id}`);
      sessionStorage.removeItem(`answers:${id}`);
      nav(`/app/results/${id}`, { replace: true });
    } catch (e) {
      toast(e.message, 'error');
      setBusy(false);
    }
  }, [busy, id, nav, toast]);

  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, Math.floor((new Date(paper.endsAt) - Date.now()) / 1000))), 1000);
    return () => clearInterval(t);
  }, [paper]);
  useEffect(() => { if (paper && left === 0) submit(); }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  // Answers survive a refresh locally and are synced to the server every few seconds.
  useEffect(() => {
    sessionStorage.setItem(`answers:${id}`, JSON.stringify(answers));
    const t = setTimeout(() => api(`/api/tests/${id}/responses`, { method: 'PUT', body: { answers } }).catch(() => {}), 4000);
    return () => clearTimeout(t);
  }, [answers, id]);

  if (!paper) return <div className="page"><Alert kind="warn">This test is no longer open in this browser. Check your scorecards in the Mock Arena.</Alert></div>;

  const q = paper.questions[idx];
  const go = (i) => { setIdx(i); setVisited((v) => new Set(v).add(i)); };
  const choose = (k) => setAnswers((a) => ({ ...a, [idx]: k }));
  const clear = () => setAnswers((a) => { const n = { ...a }; delete n[idx]; return n; });
  const toggleMark = () => setMarked((m) => { const n = new Set(m); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });
  const answered = Object.keys(answers).length;
  const total = paper.questions.length;

  return (
    <Protected>
      <div className="page">
        <div className="card row between" style={{ marginBottom: 16 }}>
          <div><h3 style={{ margin: 0 }}>{paper.scopeLabel}</h3><div className="small muted">Question {idx + 1} of {total}</div></div>
          <div className={`timer ${left < 300 ? 'low' : ''}`}>{fmt(left)}</div>
        </div>
        <div className="exam-layout">
          <div className="card">
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{idx + 1}. {q.question}</div>
            {['A', 'B', 'C', 'D'].map((k) => (
              <button key={k} className={`opt ${answers[idx] === k ? 'selected' : ''}`} onClick={() => choose(k)}>
                <span className="key">{k}</span><span>{q[`option${k}`]}</span>
              </button>
            ))}
            <div className="row between wrap" style={{ marginTop: 22 }}>
              <div className="row">
                <button className="btn" disabled={idx === 0} onClick={() => go(idx - 1)}><ChevronLeft size={16} />Previous</button>
                <button className="btn" disabled={idx === total - 1} onClick={() => go(idx + 1)}>Next<ChevronRight size={16} /></button>
              </div>
              <div className="row">
                <button className="btn" onClick={clear} disabled={!answers[idx]}><Eraser size={15} />Clear</button>
                <button className="btn" onClick={toggleMark}><Flag size={15} />{marked.has(idx) ? 'Unmark' : 'Mark for review'}</button>
              </div>
            </div>
          </div>

          <div className="card" style={{ alignSelf: 'start' }}>
            <h3>Question palette</h3>
            <div className="palette">
              {paper.questions.map((_, i) => {
                const cls = marked.has(i) ? 'marked' : answers[i] ? 'answered' : visited.has(i) ? 'visited' : '';
                return <button key={i} className={`pal ${cls} ${i === idx ? 'current' : ''}`} onClick={() => go(i)}>{i + 1}</button>;
              })}
            </div>
            <div className="legend">
              <span><i style={{ background: 'var(--green)' }} />Answered</span>
              <span><i style={{ background: '#f9d5d5' }} />Unanswered</span>
              <span><i style={{ background: '#7c3aed' }} />Marked</span>
              <span><i style={{ background: '#fff', border: '1px solid var(--line)' }} />Not visited</span>
            </div>
            <button className="btn primary block" style={{ marginTop: 18 }} onClick={() => setConfirm(true)}><Send size={15} />Submit test</button>
          </div>
        </div>
        {confirm && (
          <Modal title="Submit this test?" onClose={() => setConfirm(false)}
            footer={<><button className="btn" onClick={() => setConfirm(false)}>Keep working</button><button className="btn primary" disabled={busy} onClick={submit}>Submit now</button></>}>
            <p style={{ marginTop: 0 }}>You have answered <b>{answered}</b> of <b>{total}</b> questions{marked.size ? ` and marked ${marked.size} for review` : ''}. You cannot change answers after submitting.</p>
          </Modal>
        )}
      </div>
    </Protected>
  );
}
