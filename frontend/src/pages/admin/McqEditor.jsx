import { useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { api } from '../../api.js';
import { Alert, Card, Empty, Field, Loading, PageHead, useLoad, useToast } from '../../components/ui.jsx';
import { useCurriculum } from './useCurriculum.js';
import CurriculumPicker from './CurriculumPicker.jsx';

function Row({ original, onSaved }) {
  const toast = useToast();
  const [m, setM] = useState(original);
  const [saved, setSaved] = useState(original);
  const dirty = JSON.stringify(m) !== JSON.stringify(saved);
  const set = (k) => (e) => setM({ ...m, [k]: e.target.value });
  const save = async () => {
    try { const r = await api(`/api/admin/mcqs/${m.id}`, { method: 'PUT', body: m }); setSaved(r); setM(r); toast('Saved', 'success'); onSaved?.(); }
    catch (e) { toast(e.message, 'error'); }
  };
  return (
    <div className="mcq" style={dirty ? { borderColor: 'var(--amber)' } : undefined}>
      <Field label="Question"><textarea className="input" style={{ minHeight: 70 }} value={m.question} onChange={set('question')} /></Field>
      <div className="grid c2">
        {['A', 'B', 'C', 'D'].map((k) => <Field key={k} label={`Option ${k}`}><input className="input" value={m[`option${k}`]} onChange={set(`option${k}`)} /></Field>)}
      </div>
      <div className="grid c3">
        <Field label="Correct answer"><select className="input" value={m.correct} onChange={set('correct')}>{['A', 'B', 'C', 'D'].map((k) => <option key={k}>{k}</option>)}</select></Field>
        <Field label="Explanation"><input className="input" value={m.explanation || ''} onChange={set('explanation')} /></Field>
        <Field label="Paragraph citation"><input className="input" value={m.citation || ''} onChange={set('citation')} /></Field>
      </div>
      <div className="row"><button className="btn primary sm" disabled={!dirty} onClick={save}><Save size={14} />Save</button>
        <button className="btn sm" disabled={!dirty} onClick={() => setM(saved)}><RotateCcw size={14} />Undo</button>
        {dirty && <span className="small" style={{ color: 'var(--amber)' }}>Unsaved changes</span>}</div>
    </div>
  );
}

export default function McqEditor() {
  const cur = useCurriculum();
  const [sel, setSel] = useState({});
  const mcqs = useLoad(() => (sel.topic ? api(`/api/admin/mcqs?topicId=${sel.topic.id}`) : Promise.resolve([])), [sel.topic?.id]);
  return (
    <div className="page" style={{ maxWidth: 1000 }}>
      <PageHead title="MCQ Database Editor" subtitle="Browse questions by paper and topic, fix typos and answers in place" />
      <Card>
        <Loading state={cur}>{(c) => <CurriculumPicker curriculum={c} onChange={setSel} />}</Loading>
      </Card>
      <div style={{ marginTop: 18 }}>
        {!sel.topic ? <Alert kind="info">Choose an exam, paper and topic to load its questions.</Alert> : (
          <Loading state={mcqs}>{(list) => list.length === 0 ? <Card><Empty title="No questions for this topic" /></Card> : list.map((m) => <Row key={m.id} original={m} />)}</Loading>
        )}
      </div>
    </div>
  );
}
