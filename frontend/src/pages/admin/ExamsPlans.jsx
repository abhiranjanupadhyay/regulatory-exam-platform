import { useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { api } from '../../api.js';
import { Badge, Card, Empty, Field, Loading, Modal, PageHead, Pills, useLoad, useToast } from '../../components/ui.jsx';
import { useCurriculum } from './useCurriculum.js';

function Curriculum() {
  const toast = useToast();
  const cur = useCurriculum();
  const [examName, setExamName] = useState('');
  const [paper, setPaper] = useState({ examId: '', name: '' });
  const run = async (fn, msg) => { try { await fn(); toast(msg, 'success'); cur.reload(); } catch (e) { toast(e.message, 'error'); } };
  return (
    <Loading state={cur}>
      {(exams) => (
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Add exam">
            <div className="row"><input className="input" placeholder="e.g. SAS, Departmental Clerk Exam" value={examName} onChange={(e) => setExamName(e.target.value)} />
              <button className="btn primary" disabled={!examName.trim()} onClick={() => run(async () => { await api('/api/admin/exams', { method: 'POST', body: { name: examName } }); setExamName(''); }, 'Exam added')}><Plus size={16} />Add</button></div>
          </Card>
          {exams.length === 0 && <Card><Empty title="No exams yet" hint="Add your first exam above." /></Card>}
          {exams.map((e) => (
            <Card key={e.id} title={e.name} actions={<button className="btn sm" onClick={() => run(() => api(`/api/admin/exams/${e.id}`, { method: 'DELETE' }), 'Exam deleted')}><Trash2 size={14} />Delete</button>}>
              {e.papers.map((p) => (
                <div key={p.id} className="row between" style={{ padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
                  <span><b>{p.name}</b> <span className="small muted">· {p.topics.length} topics</span></span>
                  <button className="btn ghost sm" onClick={() => run(() => api(`/api/admin/papers/${p.id}`, { method: 'DELETE' }), 'Paper deleted')}><Trash2 size={14} /></button>
                </div>))}
              <div className="row" style={{ marginTop: 12 }}>
                <input className="input" placeholder="Add paper, e.g. Paper I: Financial Rules" value={paper.examId === e.id ? paper.name : ''} onChange={(ev) => setPaper({ examId: e.id, name: ev.target.value })} />
                <button className="btn" disabled={paper.examId !== e.id || !paper.name.trim()}
                  onClick={() => run(async () => { await api('/api/admin/papers', { method: 'POST', body: { examId: e.id, name: paper.name, sortOrder: e.papers.length + 1 } }); setPaper({ examId: '', name: '' }); }, 'Paper added')}><Plus size={16} />Add paper</button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Loading>
  );
}

function Payment() {
  const toast = useToast();
  const cfg = useLoad(() => api('/api/admin/payment-config'));
  const [f, setF] = useState(null);
  const form = f || cfg.data;
  const save = async () => { try { await api('/api/admin/payment-config', { method: 'PUT', body: form }); toast('Payment settings saved', 'success'); setF(null); cfg.reload(); } catch (e) { toast(e.message, 'error'); } };
  return (
    <Loading state={cfg}>
      {() => (
        <Card title="Payment gateway setup" className="" >
          <div className="grid c2">
            <Field label="Receiving UPI ID"><input className="input" value={form.upiId} onChange={(e) => setF({ ...form, upiId: e.target.value })} /></Field>
            <Field label="Account / business name"><input className="input" value={form.accountName} onChange={(e) => setF({ ...form, accountName: e.target.value })} /></Field>
            <Field label="Admin support email"><input className="input" value={form.supportEmail} onChange={(e) => setF({ ...form, supportEmail: e.target.value })} /></Field>
            <Field label="WhatsApp number for payment alerts" hint="With country code, digits only, e.g. 919876543210"><input className="input" value={form.whatsappNumber} onChange={(e) => setF({ ...form, whatsappNumber: e.target.value })} /></Field>
          </div>
          <button className="btn primary" disabled={!f} onClick={save}><Save size={16} />Save settings</button>
        </Card>
      )}
    </Loading>
  );
}

const EMPTY = { name: '', examId: '', priceInr: 0, durationDays: 90, features: '' };

function Plans() {
  const toast = useToast();
  const plans = useLoad(() => api('/api/plans'));
  const cur = useCurriculum();
  const [edit, setEdit] = useState(null);
  const save = async () => {
    const body = { ...edit, priceInr: Number(edit.priceInr), durationDays: Number(edit.durationDays), active: true,
      features: String(edit.features).split('\n').map((s) => s.trim()).filter(Boolean) };
    try {
      await api(edit.id ? `/api/admin/plans/${edit.id}` : '/api/admin/plans', { method: edit.id ? 'PUT' : 'POST', body });
      toast('Plan saved', 'success'); setEdit(null); plans.reload();
    } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <>
      <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 12 }}><button className="btn primary" onClick={() => setEdit(EMPTY)}><Plus size={16} />Design a plan</button></div>
      <Loading state={plans}>
        {(list) => (
          <div className="grid c3">
            {list.map((p) => (
              <Card key={p.id}>
                <Badge tone="brand">{cur.data?.find((e) => e.id === p.examId)?.name || 'Exam'}</Badge>
                <h3 style={{ marginTop: 10 }}>{p.name}</h3>
                <div style={{ fontSize: 26, fontWeight: 700 }}>₹{p.priceInr}</div><div className="muted">{p.durationDays} days</div>
                <ul className="muted">{p.features.map((x) => <li key={x}>{x}</li>)}</ul>
                <div className="row"><button className="btn sm" onClick={() => setEdit({ ...p, features: p.features.join('\n') })}>Edit</button>
                  <button className="btn sm" onClick={async () => { await api(`/api/admin/plans/${p.id}`, { method: 'DELETE' }); toast('Plan removed'); plans.reload(); }}><Trash2 size={14} /></button></div>
              </Card>))}
            {list.length === 0 && <Card><Empty title="No plans yet" /></Card>}
          </div>
        )}
      </Loading>
      {edit && (
        <Modal title={edit.id ? 'Edit plan' : 'Custom plan designer'} onClose={() => setEdit(null)}
          footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn primary" disabled={!edit.name || !edit.examId} onClick={save}>Save plan</button></>}>
          <Field label="Plan name"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Part I Access - 90 Days" /></Field>
          <Field label="Target exam"><select className="input" value={edit.examId} onChange={(e) => setEdit({ ...edit, examId: e.target.value })}>
            <option value="">Select exam</option>{cur.data?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <div className="grid c2">
            <Field label="Price (₹)"><input className="input" type="number" value={edit.priceInr} onChange={(e) => setEdit({ ...edit, priceInr: e.target.value })} /></Field>
            <Field label="Duration (days)"><input className="input" type="number" value={edit.durationDays} onChange={(e) => setEdit({ ...edit, durationDays: e.target.value })} /></Field>
          </div>
          <Field label="Marketing bullet points (one per line)"><textarea className="input" value={edit.features} onChange={(e) => setEdit({ ...edit, features: e.target.value })} /></Field>
        </Modal>
      )}
    </>
  );
}

export default function ExamsPlans() {
  const [tab, setTab] = useState('curriculum');
  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <PageHead title="Exams & Plans" subtitle="Curriculum, payment details and subscription packages">
        <Pills value={tab} onChange={setTab} options={[{ value: 'curriculum', label: 'Curriculum & papers' }, { value: 'payment', label: 'Payment gateway' }, { value: 'plans', label: 'Plans' }]} />
      </PageHead>
      {tab === 'curriculum' && <Curriculum />}
      {tab === 'payment' && <Payment />}
      {tab === 'plans' && <Plans />}
    </div>
  );
}
