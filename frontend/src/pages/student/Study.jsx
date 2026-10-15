import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { BookText, Search } from 'lucide-react';
import { api } from '../../api.js';
import { Card, Empty, Loading, PageHead, Spinner, useLoad } from '../../components/ui.jsx';
import Protected from '../../components/Protected.jsx';
import PracticeDeck from './PracticeDeck.jsx';
import { useStudent } from './context.jsx';

function highlight(children, term) {
  if (!term) return children;
  const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const walk = (node) => (typeof node === 'string'
    ? node.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))
    : node);
  return Array.isArray(children) ? children.map((c, i) => <span key={i}>{walk(c)}</span>) : walk(children);
}

function TopicPicker() {
  const { examId, examName } = useStudent();
  const nav = useNavigate();
  const s = useLoad(() => api(`/api/exams/${examId}/syllabus`), [examId]);
  return (
    <div className="page">
      <PageHead title="Study Table" subtitle={`${examName(examId)} · choose a chapter to open the rulebook and its practice deck`} />
      <Loading state={s}>
        {(syl) => syl.papers.map((p) => (
          <Card key={p.id} title={p.name} flush className="" >
            {p.topics.length === 0 && <Empty title="No topics yet" />}
            {p.topics.map((t) => (
              <div className="topic" key={t.id} onClick={() => nav(`/app/study/${t.id}`)}>
                <BookText size={18} color="var(--brand)" />
                <div className="grow"><b>{t.title}</b><div className="small muted">Tier {t.tier} · {t.mcqCount} questions</div></div>
              </div>
            ))}
          </Card>
        ))}
      </Loading>
    </div>
  );
}

export default function Study() {
  const { topicId } = useParams();
  if (!topicId) return <TopicPicker />;
  return <StudyTopic key={topicId} topicId={topicId} />;
}

function StudyTopic({ topicId }) {
  const nav = useNavigate();
  const data = useLoad(async () => ({
    book: await api(`/api/topics/${topicId}/book`),
    mcqs: await api(`/api/topics/${topicId}/mcqs`),
  }), [topicId]);
  const [term, setTerm] = useState('');
  const [pop, setPop] = useState(null);
  const paneRef = useRef(null);

  // Double-click or select a word in the rulebook to see its definition and translation.
  const lookup = async () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || text.split(/\s+/).length > 3 || !paneRef.current?.contains(sel.anchorNode)) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const at = { x: Math.min(rect.left, window.innerWidth - 320), y: rect.bottom + 8 };
    try {
      setPop({ ...at, word: text, entry: await api(`/api/dictionary/${encodeURIComponent(text)}`) });
    } catch {
      setPop({ ...at, word: text, entry: null });
    }
  };
  useEffect(() => {
    const close = (e) => !e.target.closest?.('.dict-pop') && setPop(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <Protected>
      <div className="page">
        <Loading state={data}>
          {({ book, mcqs }) => (
            <>
              <PageHead title={book.title} subtitle="Rulebook on the left, practice deck on the right">
                <button className="btn" onClick={() => nav('/app/study')}>All chapters</button>
              </PageHead>
              <div className="split">
                <div className="card flush pane">
                  <div className="card-head">
                    <h3>Statutory rulebook</h3>
                    <div className="search" style={{ width: 240 }}><Search size={15} /><input className="input" placeholder="Search in chapter" value={term} onChange={(e) => setTerm(e.target.value)} /></div>
                  </div>
                  <div className="pane-body selectable book" ref={paneRef} onDoubleClick={lookup} onMouseUp={lookup}>
                    {book.markdown
                      ? <ReactMarkdown components={{ p: (p) => <p>{highlight(p.children, term)}</p>, li: (p) => <li>{highlight(p.children, term)}</li>, h1: (p) => <h1>{highlight(p.children, term)}</h1>, h2: (p) => <h2>{highlight(p.children, term)}</h2>, h3: (p) => <h3>{highlight(p.children, term)}</h3> }}>{book.markdown}</ReactMarkdown>
                      : <Empty icon={BookText} title="The rulebook for this chapter is not published yet" />}
                  </div>
                </div>
                <div className="card flush pane">
                  <div className="card-head"><h3>Practice deck</h3><span className="badge brand">{mcqs.length} questions</span></div>
                  <div className="pane-body"><PracticeDeck questions={mcqs} /></div>
                </div>
              </div>
            </>
          )}
        </Loading>
        {pop && (
          <div className="dict-pop" style={{ left: pop.x, top: pop.y }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{pop.word}</div>
            {pop.entry ? (
              <>
                <p style={{ margin: '8px 0' }}>{pop.entry.definition}</p>
                {pop.entry.translation && <div><span className="badge brand">Hindi</span> {pop.entry.translation}</div>}
                {pop.entry.legalContext && <div className="small muted" style={{ marginTop: 8 }}>{pop.entry.legalContext}</div>}
              </>
            ) : <div className="muted small" style={{ marginTop: 6 }}>No dictionary entry for this term yet.</div>}
          </div>
        )}
      </div>
    </Protected>
  );
}
