import { useState } from 'react';
import { Ban, CalendarPlus, CheckCircle2, Pause, Play, Search, Send } from 'lucide-react';
import { api, fmtDate, fmtDateTime } from '../../api.js';
import { Alert, Badge, Card, Drawer, Empty, Field, Loading, PageHead, Pills, statusTone, useLoad, useToast } from '../../components/ui.jsx';

function Roster() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(null);
  const [until, setUntil] = useState('');
  const all = useLoad(() => api('/api/admin/subscriptions'));
  const rows = useLoad(() => api(`/api/admin/subscriptions?status=${status}&q=${encodeURIComponent(q)}`), [status, q]);

  const act = async (id, action, body) => {
    try {
      const r = await api(`/api/admin/subscriptions/${id}/${action}`, { method: 'POST', body });
      setOpen(r); toast('Updated', 'success'); rows.reload(); all.reload();
    } catch (e) { toast(e.message, 'error'); }
  };
  const count = (f) => (all.data || []).filter(f).length;

  return (
    <>
      <div className="row between wrap" style={{ marginBottom: 14 }}>
        <Pills value={status} onChange={setStatus} options={[
          { value: '', label: 'All', count: all.data?.length ?? 0 },
          { value: 'ACTIVE', label: 'Active', count: count((s) => s.status === 'ACTIVE') },
          { value: 'PENDING', label: 'Pending approval', count: count((s) => s.status === 'PENDING') },
          { value: 'INACTIVE', label: 'Inactive', count: count((s) => !['ACTIVE', 'PENDING'].includes(s.status)) }]} />
        <div className="search" style={{ width: 320 }}><Search size={15} /><input className="input" placeholder="Search name, email, office or UTR" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      <Card flush>
        <Loading state={rows}>
          {(list) => list.length === 0 ? <Empty title="No candidates match" /> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Candidate</th><th>Plan</th><th>Expires</th><th>UTR</th><th>Status</th></tr></thead>
              <tbody>{list.map((s) => (
                <tr key={s.id} className="click" onClick={() => setOpen(s)}>
                  <td><b>{s.userName}</b><div className="small muted">{s.userOffice}</div></td><td>{s.planName}</td>
                  <td>{s.expiresAt ? <>{fmtDate(s.expiresAt)}<div className="small muted">{s.daysRemaining} days</div></> : '-'}</td>
                  <td>{s.utr}</td><td><Badge tone={statusTone(s.status)}>{s.status}</Badge></td>
                </tr>))}</tbody>
            </table></div>
          )}
        </Loading>
      </Card>
      {open && (
        <Drawer title="Candidate" onClose={() => setOpen(null)}>
          <h3 style={{ margin: 0 }}>{open.userName}</h3>
          <div className="muted" style={{ marginBottom: 14 }}>{open.userEmail}</div>
          <dl className="kv" style={{ marginBottom: 18 }}>
            <dt>Office</dt><dd>{open.userOffice}</dd><dt>Plan</dt><dd>{open.planName}</dd>
            <dt>UTR</dt><dd>{open.utr}</dd><dt>Submitted</dt><dd>{fmtDateTime(open.submittedAt)}</dd>
            <dt>Status</dt><dd><Badge tone={statusTone(open.status)}>{open.status}</Badge></dd>
            <dt>Valid until</dt><dd>{fmtDate(open.expiresAt)} {open.expiresAt && `(${open.daysRemaining} days)`}</dd>
          </dl>
          <div className="stack">
            {open.status === 'PENDING' && (
              <div className="row"><button className="btn success grow" onClick={() => act(open.id, 'approve')}><CheckCircle2 size={16} />Approve</button>
                <button className="btn danger grow" onClick={() => act(open.id, 'reject', {})}><Ban size={16} />Reject</button></div>
            )}
            {open.status === 'ACTIVE' && <button className="btn" onClick={() => act(open.id, 'freeze')}><Pause size={16} />Freeze plan</button>}
            {open.status === 'FROZEN' && <button className="btn primary" onClick={() => act(open.id, 'unfreeze')}><Play size={16} />Unfreeze plan</button>}
            {['ACTIVE', 'FROZEN', 'EXPIRED'].includes(open.status) && (
              <Card title="Extend validity">
                <div className="row wrap">{[30, 60, 90].map((d) => <button key={d} className="btn sm" onClick={() => act(open.id, 'extend', { days: d })}><CalendarPlus size={14} />+{d} days</button>)}</div>
                <div className="row" style={{ marginTop: 12 }}><input type="date" className="input" value={until} onChange={(e) => setUntil(e.target.value)} />
                  <button className="btn sm primary" disabled={!until} onClick={() => act(open.id, 'extend', { until })}>Set date</button></div>
              </Card>
            )}
          </div>
        </Drawer>
      )}
    </>
  );
}

function Tickets() {
  const toast = useToast();
  const [status, setStatus] = useState('OPEN');
  const [sel, setSel] = useState(null);
  const [reply, setReply] = useState('');
  const list = useLoad(() => api(`/api/admin/tickets?status=${status}`), [status]);
  const respond = async (decision) => {
    try { await api(`/api/admin/tickets/${sel.id}`, { method: 'PUT', body: { reply, status: decision } }); toast('Reply sent', 'success'); setSel(null); setReply(''); list.reload(); }
    catch (e) { toast(e.message, 'error'); }
  };
  return (
    <>
      <div style={{ marginBottom: 14 }}><Pills value={status} onChange={setStatus} options={[{ value: 'OPEN', label: 'Open' }, { value: 'RESOLVED', label: 'Resolved' }, { value: 'REJECTED', label: 'Rejected' }]} /></div>
      <div className="grid c2">
        <Card flush>
          <Loading state={list}>{(t) => t.length === 0 ? <Empty title="Nothing here" /> : t.map((x) => (
            <div key={x.id} className="topic" style={{ background: sel?.id === x.id ? 'var(--brand-soft)' : '' }} onClick={() => { setSel(x); setReply(x.adminReply || ''); }}>
              <div className="grow"><div style={{ fontWeight: 600 }}>{x.question?.slice(0, 90)}</div><div className="small muted">{x.userEmail} · {fmtDateTime(x.createdAt)}</div></div>
              <Badge tone={statusTone(x.status)}>{x.status}</Badge>
            </div>))}</Loading>
        </Card>
        <Card title="Ticket details">
          {!sel ? <Empty title="Select a ticket" /> : (
            <>
              <div className="explain" style={{ marginTop: 0 }}><b>Disputed question</b><br />{sel.question}{sel.citation && <div className="small muted">Citation: {sel.citation}</div>}</div>
              <div style={{ margin: '14px 0' }}><b>Student remarks</b><div>{sel.remarks}</div></div>
              {sel.status !== 'OPEN' && <Alert kind="info">Already {sel.status.toLowerCase()}.</Alert>}
              <Field label="Official reply"><textarea className="input" value={reply} onChange={(e) => setReply(e.target.value)} /></Field>
              <div className="row"><button className="btn success" disabled={!reply.trim()} onClick={() => respond('RESOLVED')}><Send size={15} />Reply &amp; resolve</button>
                <button className="btn danger" disabled={!reply.trim()} onClick={() => respond('REJECTED')}>Reject dispute</button></div>
            </>
          )}
        </Card>
      </div>
    </>
  );
}

export default function Candidates() {
  const [tab, setTab] = useState('roster');
  return (
    <div className="page">
      <PageHead title="Candidates & Support" subtitle="Approve payments, manage plans and answer discrepancy reports">
        <Pills value={tab} onChange={setTab} options={[{ value: 'roster', label: 'Candidate roster' }, { value: 'tickets', label: 'Support desk' }]} />
      </PageHead>
      {tab === 'roster' ? <Roster /> : <Tickets />}
    </div>
  );
}
