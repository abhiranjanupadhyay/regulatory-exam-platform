import { fmtDate } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Badge, Card, PageHead, statusTone } from '../../components/ui.jsx';
import { useStudent } from './context.jsx';

export default function Profile() {
  const { user } = useAuth();
  const { subs, examName } = useStudent();
  const rows = [['Full name', user.name], ['Email', user.email], ['Age', user.age], ['Mobile / WhatsApp', user.mobile], ['Designation', user.designation], ['Station', user.station], ['Office / controller', user.office]];
  return (
    <div className="page">
      <PageHead title="Profile" subtitle="Your registered details" />
      <div className="grid c2">
        <Card title="Personal & departmental details">
          <dl className="kv">{rows.map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        </Card>
        <Card title="Subscriptions" flush>
          <table className="table">
            <thead><tr><th>Plan</th><th>Status</th><th>Valid until</th></tr></thead>
            <tbody>
              {subs.subscriptions.map((s) => (
                <tr key={s.id}><td><b>{s.planName}</b><div className="small muted">{examName(s.examId)}</div></td>
                  <td><Badge tone={statusTone(s.status)}>{s.status}</Badge></td><td>{fmtDate(s.expiresAt)}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
