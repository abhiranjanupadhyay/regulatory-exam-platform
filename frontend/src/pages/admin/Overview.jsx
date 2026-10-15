import { Link } from 'react-router-dom';
import { AlertCircle, BookOpen, CreditCard, KeyRound, LifeBuoy, UserCheck, Users } from 'lucide-react';
import { api, fmtDateTime } from '../../api.js';
import { Badge, Card, Empty, Loading, PageHead, Progress, Stat, useLoad, useToast } from '../../components/ui.jsx';

export default function Overview() {
  const toast = useToast();
  const d = useLoad(async () => {
    const [subs, tickets, matrix, invites, users] = await Promise.all([
      api('/api/admin/subscriptions'), api('/api/admin/tickets'), api('/api/admin/matrix'),
      api('/api/admin/invites'), api('/api/admin/users'),
    ]);
    return { subs, tickets, matrix, invites, users };
  });

  const approve = async (id) => {
    try { await api(`/api/admin/subscriptions/${id}/approve`, { method: 'POST' }); toast('Payment approved', 'success'); d.reload(); }
    catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="page">
      <PageHead title="Overview" subtitle="Everything that needs your attention, at a glance" />
      <Loading state={d}>
        {({ subs, tickets, matrix, invites, users }) => {
          const pending = subs.filter((s) => s.status === 'PENDING');
          const active = subs.filter((s) => s.status === 'ACTIVE');
          const expiring = active.filter((s) => s.expiringSoon);
          const openTickets = tickets.filter((t) => t.status === 'OPEN');
          const complete = matrix.filter((m) => m.status === 'COMPLETE').length;
          const gaps = matrix.filter((m) => m.status !== 'COMPLETE');
          const students = users.filter((u) => u.role === 'STUDENT').length;
          return (
            <div className="stack" style={{ gap: 18 }}>
              <div className="grid c4">
                <Stat icon={Users} tone="brand" value={students} label="Registered candidates" />
                <Stat icon={UserCheck} tone="green" value={active.length} label="Active subscriptions" />
                <Stat icon={CreditCard} tone="amber" value={pending.length} label="Payments awaiting approval" />
                <Stat icon={LifeBuoy} tone="red" value={openTickets.length} label="Open support tickets" />
              </div>
              <div className="grid c2">
                <Card title="Payments awaiting approval" flush actions={<Link to="/admin/candidates" className="btn sm">View all</Link>}>
                  {pending.length === 0 ? <Empty icon={CreditCard} title="All caught up" hint="No payments are waiting." /> : (
                    <table className="table"><tbody>
                      {pending.slice(0, 6).map((s) => (
                        <tr key={s.id}>
                          <td><b>{s.userName}</b><div className="small muted">{s.userOffice} · {s.planName}</div></td>
                          <td className="small">UTR {s.utr}<div className="muted">{fmtDateTime(s.submittedAt)}</div></td>
                          <td style={{ textAlign: 'right' }}><button className="btn success sm" onClick={() => approve(s.id)}>Approve</button></td>
                        </tr>))}
                    </tbody></table>
                  )}
                </Card>
                <Card title="Open discrepancy reports" flush actions={<Link to="/admin/candidates" className="btn sm">Open desk</Link>}>
                  {openTickets.length === 0 ? <Empty icon={LifeBuoy} title="No open reports" /> : (
                    <table className="table"><tbody>
                      {openTickets.slice(0, 6).map((t) => (
                        <tr key={t.id}><td><div style={{ fontWeight: 600 }}>{t.question?.slice(0, 80)}</div><div className="small muted">{t.userEmail} · {t.remarks?.slice(0, 60)}</div></td></tr>))}
                    </tbody></table>
                  )}
                </Card>
              </div>
              <div className="grid c2">
                <Card title="Content readiness" actions={<Link to="/admin/content" className="btn sm">Content matrix</Link>}>
                  <div className="row between small" style={{ marginBottom: 6 }}><span>{complete} of {matrix.length} topics fully populated</span><b>{matrix.length ? Math.round(complete * 100 / matrix.length) : 0}%</b></div>
                  <Progress value={matrix.length ? complete * 100 / matrix.length : 0} tone="green" />
                  <div style={{ marginTop: 14 }}>
                    {gaps.slice(0, 6).map((g) => (
                      <div key={g.topicId} className="row between" style={{ padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
                        <span><AlertCircle size={14} color="var(--amber)" style={{ verticalAlign: -2 }} /> {g.topic} <span className="small muted">({g.paperName})</span></span>
                        <Badge tone="amber">{g.status.replace('_', ' ').toLowerCase()}</Badge>
                      </div>))}
                    {gaps.length === 0 && matrix.length > 0 && <div className="muted">Every topic has a book and questions.</div>}
                  </div>
                </Card>
                <Card title="Needs follow-up">
                  <div className="row between" style={{ padding: '8px 0' }}><span><BookOpen size={14} style={{ verticalAlign: -2 }} /> Plans expiring within 5 days</span><Badge tone={expiring.length ? 'amber' : 'gray'}>{expiring.length}</Badge></div>
                  {expiring.slice(0, 5).map((s) => <div key={s.id} className="small muted" style={{ padding: '2px 0 2px 20px' }}>{s.userName} · {s.daysRemaining} day(s) left</div>)}
                  <div className="row between" style={{ padding: '8px 0', borderTop: '1px solid var(--line)', marginTop: 8 }}><span><KeyRound size={14} style={{ verticalAlign: -2 }} /> Unused invite codes</span><Badge tone="brand">{invites.filter((i) => i.status === 'ACTIVE').length}</Badge></div>
                </Card>
              </div>
            </div>
          );
        }}
      </Loading>
    </div>
  );
}
