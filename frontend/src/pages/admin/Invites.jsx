import { Copy, KeyRound, Plus } from 'lucide-react';
import { api, fmtDateTime } from '../../api.js';
import { Badge, Card, Empty, Loading, PageHead, Stat, statusTone, useLoad, useToast } from '../../components/ui.jsx';

export default function Invites() {
  const toast = useToast();
  const list = useLoad(() => api('/api/admin/invites'));
  const generate = async () => {
    try { const c = await api('/api/admin/invites', { method: 'POST' }); toast(`Code ${c.code} created`, 'success'); list.reload(); }
    catch (e) { toast(e.message, 'error'); }
  };
  const share = async (c) => { await navigator.clipboard.writeText(c.shareMessage); toast('Invitation message copied', 'success'); };
  return (
    <div className="page">
      <PageHead title="Invite Codes" subtitle="Single-use codes that gate registration">
        <button className="btn primary" onClick={generate}><Plus size={16} />Generate code</button>
      </PageHead>
      <Loading state={list}>
        {(codes) => (
          <div className="stack" style={{ gap: 16 }}>
            <div className="grid c3">
              <Stat icon={KeyRound} tone="brand" value={codes.length} label="Total codes" />
              <Stat icon={KeyRound} tone="green" value={codes.filter((c) => c.status === 'ACTIVE').length} label="Active" />
              <Stat icon={KeyRound} tone="amber" value={codes.filter((c) => c.status === 'USED').length} label="Redeemed" />
            </div>
            <Card flush>
              {codes.length === 0 ? <Empty icon={KeyRound} title="No invite codes yet" hint="Generate one to invite a candidate." /> : (
                <div className="table-wrap"><table className="table">
                  <thead><tr><th>Code</th><th>Created by</th><th>Redeemed by</th><th>When</th><th>Status</th><th /></tr></thead>
                  <tbody>{codes.map((c) => (
                    <tr key={c.code}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: 1 }}>{c.code}</td><td>{c.createdBy}</td>
                      <td>{c.redeemedBy || '-'}</td><td>{fmtDateTime(c.redeemedAt || c.createdAt)}</td>
                      <td><Badge tone={statusTone(c.status)}>{c.status}</Badge></td>
                      <td style={{ textAlign: 'right' }}>{c.status === 'ACTIVE' && <button className="btn sm" onClick={() => share(c)}><Copy size={14} />Share</button>}</td>
                    </tr>))}</tbody>
                </table></div>
              )}
            </Card>
          </div>
        )}
      </Loading>
    </div>
  );
}
