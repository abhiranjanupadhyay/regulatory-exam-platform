import { useState } from 'react';
import { BookUp, FilePlus2, Plus, Upload } from 'lucide-react';
import { api, readFile } from '../../api.js';
import { Alert, Badge, Card, Field, Loading, Modal, PageHead, Pills, statusTone, useLoad, useToast } from '../../components/ui.jsx';
import { useCurriculum } from './useCurriculum.js';
import CurriculumPicker from './CurriculumPicker.jsx';

const SAMPLE = 'Question,Option A,Option B,Option C,Option D,Correct Answer,Explanation,Paragraph Citation';

function Ingest({ curriculum, onDone }) {
  const toast = useToast();
  const [sel, setSel] = useState({});
  const [bookText, setBookText] = useState('');
  const [mcqText, setMcqText] = useState('');
  const [report, setReport] = useState(null);
  const [dict, setDict] = useState({ word: '', definition: '', translation: '', legalContext: '' });
  const [dictReport, setDictReport] = useState(null);
  const topic = sel.topic;

  const run = async (fn) => { try { await fn(); } catch (e) { toast(e.message, 'error'); } };
  const fromFile = (setter) => (e) => run(async () => { const f = e.target.files[0]; if (f) setter(await readFile(f)); });

  return (
    <div className="stack" style={{ gap: 18 }}>
      <Card title="Unified ingestion engine">
        <p className="muted" style={{ marginTop: 0 }}>Select the exam, paper and topic once, then publish the book and its questions.</p>
        <CurriculumPicker curriculum={curriculum} onChange={setSel} />
      </Card>
      <div className="grid c2">
        <Card title="Upload book" actions={<Badge tone="brand">.md / .txt</Badge>}>
          <input type="file" accept=".md,.txt" onChange={fromFile(setBookText)} style={{ marginBottom: 10 }} />
          <textarea className="input" placeholder="…or paste the statutory handbook text (Markdown)" value={bookText} onChange={(e) => setBookText(e.target.value)} />
          <button className="btn primary" style={{ marginTop: 12 }} disabled={!topic || !bookText.trim()}
            onClick={() => run(async () => { await api(`/api/admin/topics/${topic.id}/book`, { method: 'PUT', body: { text: bookText } }); toast('Book published', 'success'); setBookText(''); onDone(); })}>
            <BookUp size={16} />Publish book
          </button>
        </Card>
        <Card title="Upload MCQs" actions={<Badge tone="brand">.csv or pasted rows</Badge>}>
          <input type="file" accept=".csv,.txt" onChange={fromFile(setMcqText)} style={{ marginBottom: 10 }} />
          <textarea className="input" placeholder={SAMPLE} value={mcqText} onChange={(e) => setMcqText(e.target.value)} />
          <div className="row" style={{ marginTop: 12 }}>
            {['ADD', 'REPLACE'].map((mode) => (
              <button key={mode} className={`btn ${mode === 'ADD' ? 'primary' : ''}`} disabled={!topic || !mcqText.trim()}
                onClick={() => run(async () => {
                  const r = await api(`/api/admin/topics/${topic.id}/mcqs?mode=${mode}`, { method: 'POST', body: { text: mcqText } });
                  setReport(r); toast(`${r.added} question(s) saved`, r.added ? 'success' : 'error'); if (r.added) { setMcqText(''); onDone(); }
                })}>
                <Upload size={16} />{mode === 'ADD' ? 'Add questions' : 'Replace all'}
              </button>
            ))}
          </div>
          {report?.errors.length > 0 && <div style={{ marginTop: 12 }}><Alert kind="warn"><b>{report.skipped} row(s) skipped</b><ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{report.errors.slice(0, 8).map((e) => <li key={e}>{e}</li>)}</ul></Alert></div>}
        </Card>
      </div>
      <Card title="Bilingual dictionary">
        <div className="grid c2">
          <div>
            <Field label="Bulk upload (.json: [{word, definition, translation, legalContext}])">
              <input type="file" accept=".json" onChange={(e) => run(async () => {
                const text = await readFile(e.target.files[0]);
                const r = await api('/api/admin/dictionary', { method: 'POST', body: JSON.parse(text) });
                setDictReport(r); toast(`${r.added} added, ${r.skipped} duplicates skipped`, 'success');
              })} />
            </Field>
            {dictReport && <Alert kind="info">{dictReport.added} added · {dictReport.skipped} duplicates skipped</Alert>}
          </div>
          <div>
            {['word', 'definition', 'translation', 'legalContext'].map((k) => (
              <input key={k} className="input" style={{ marginBottom: 8 }} placeholder={{ word: 'Word', definition: 'Definition', translation: 'Hindi / vernacular translation', legalContext: 'Legal context' }[k]} value={dict[k]} onChange={(e) => setDict({ ...dict, [k]: e.target.value })} />
            ))}
            <button className="btn" disabled={!dict.word || !dict.definition} onClick={() => run(async () => {
              const r = await api('/api/admin/dictionary', { method: 'POST', body: [dict] });
              toast(r.added ? 'Word added' : 'Word already exists, skipped', r.added ? 'success' : 'error'); setDict({ word: '', definition: '', translation: '', legalContext: '' });
            })}><Plus size={16} />Add word</button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function ContentMatrix() {
  const toast = useToast();
  const matrix = useLoad(() => api('/api/admin/matrix'));
  const cur = useCurriculum();
  const [tab, setTab] = useState('matrix');
  const [filter, setFilter] = useState('ALL');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ paperId: '', title: '', tier: 1, weightage: 10, chapterTitles: '' });

  const save = async () => {
    try {
      await api('/api/admin/topics', { method: 'POST', body: { ...form, tier: Number(form.tier), weightage: Number(form.weightage), chapterTitles: form.chapterTitles.split('\n').map((s) => s.trim()).filter(Boolean) } });
      toast('Topic created', 'success'); setAdding(false); matrix.reload(); cur.reload();
    } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="page">
      <PageHead title="Content Matrix" subtitle="Syllabus coverage, and the place to publish books, questions and dictionary terms">
        <Pills value={tab} onChange={setTab} options={[{ value: 'matrix', label: 'Master grid' }, { value: 'ingest', label: 'Ingest content' }]} />
        <button className="btn primary" onClick={() => setAdding(true)}><FilePlus2 size={16} />Add topic</button>
      </PageHead>
      {tab === 'matrix' && (
        <Loading state={matrix}>
          {(rows) => {
            const shown = filter === 'ALL' ? rows : rows.filter((r) => (filter === 'COMPLETE' ? r.status === 'COMPLETE' : r.status !== 'COMPLETE'));
            return (
              <Card flush title="Master linkage grid" actions={<Pills value={filter} onChange={setFilter} options={[
                { value: 'ALL', label: 'All', count: rows.length }, { value: 'COMPLETE', label: 'Complete', count: rows.filter((r) => r.status === 'COMPLETE').length },
                { value: 'GAPS', label: 'Needs content', count: rows.filter((r) => r.status !== 'COMPLETE').length }]} />}>
                <div className="table-wrap"><table className="table">
                  <thead><tr><th>Exam / Paper</th><th>Topic</th><th>Tier</th><th>Weight</th><th>Book</th><th>MCQs</th><th>Status</th></tr></thead>
                  <tbody>{shown.map((r) => (
                    <tr key={r.topicId}>
                      <td><b>{r.examName}</b><div className="small muted">{r.paperName}</div></td><td>{r.topic}</td>
                      <td><span className={`badge tier-${r.tier}`}>Tier {r.tier}</span></td><td>{r.weightage}%</td>
                      <td>{r.hasBook ? <Badge tone="green">Uploaded</Badge> : <Badge tone="red">Missing</Badge>}</td><td>{r.mcqCount}</td>
                      <td><Badge tone={statusTone(r.status)}>{r.status.replace('_', ' ').toLowerCase()}</Badge></td>
                    </tr>))}
                    {shown.length === 0 && <tr><td colSpan={7} className="empty">No topics yet. Create exams and papers under Exams & Plans, then add topics.</td></tr>}
                  </tbody>
                </table></div>
              </Card>
            );
          }}
        </Loading>
      )}
      {tab === 'ingest' && <Loading state={cur}>{(c) => <Ingest curriculum={c} onDone={matrix.reload} />}</Loading>}

      {adding && (
        <Modal title="Add syllabus topic" onClose={() => setAdding(false)}
          footer={<><button className="btn" onClick={() => setAdding(false)}>Cancel</button><button className="btn primary" disabled={!form.paperId || !form.title} onClick={save}>Create topic</button></>}>
          <Loading state={cur}>{(c) => (
            <>
              <Field label="Paper"><select className="input" value={form.paperId} onChange={(e) => setForm({ ...form, paperId: e.target.value })}>
                <option value="">Select paper</option>{c.flatMap((e) => e.papers.map((p) => <option key={p.id} value={p.id}>{e.name} · {p.name}</option>))}</select></Field>
              <Field label="Topic title"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
              <div className="grid c2">
                <Field label="Preparation tier"><select className="input" value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })}><option value={1}>Tier 1 · Foundation</option><option value={2}>Tier 2 · Expansion</option><option value={3}>Tier 3 · Mastery</option></select></Field>
                <Field label="Weightage %"><input className="input" type="number" value={form.weightage} onChange={(e) => setForm({ ...form, weightage: e.target.value })} /></Field>
              </div>
              <Field label="Chapter titles (one per line)"><textarea className="input" value={form.chapterTitles} onChange={(e) => setForm({ ...form, chapterTitles: e.target.value })} /></Field>
            </>)}</Loading>
        </Modal>
      )}
    </div>
  );
}
