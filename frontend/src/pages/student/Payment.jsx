import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Clock, MessageCircle, ShieldCheck } from 'lucide-react';
import { api } from '../../api.js';
import { Alert, Badge, Card, Field, Loading, PageHead, useLoad, useToast } from '../../components/ui.jsx';
import { useStudent } from './context.jsx';

export default function Payment() {
  const { subs, exams, refresh, examName } = useStudent();
  const toast = useToast();
  const plans = useLoad(() => api('/api/plans'));
  const [planId, setPlanId] = useState(null);
  const [utr, setUtr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);
  const pay = useLoad(() => api(`/api/payment-config${planId ? `?planId=${planId}` : ''}`), [planId]);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await api('/api/subscriptions', { method: 'POST', body: { planId, utr } });
      setSent(r);
      setUtr('');
      refresh();
      toast('Payment submitted for approval', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const pending = subs.subscriptions.filter((s) => s.status === 'PENDING');
  return (
    <div className="page">
      <PageHead title="Plans & Renewal" subtitle="Choose a plan, pay by UPI and submit your transaction reference for approval." />
      {pending.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <Alert kind="warn" icon={Clock}>
            <b>Pending Admin Approval.</b> {pending.map((p) => `${p.planName} (UTR ${p.utr})`).join(', ')}. You will get access as soon as your payment is confirmed.
          </Alert>
        </div>
      )}
      {subs.subscriptions.some((s) => s.status === 'REJECTED') && (
        <div style={{ marginBottom: 18 }}><Alert kind="error">A previous payment was rejected. Check the UTR and submit again, or contact support.</Alert></div>
      )}
      <Loading state={plans}>
        {(list) => (
          <div className="grid c3" style={{ marginBottom: 22 }}>
            {list.map((p) => (
              <div key={p.id} className={`plan ${planId === p.id ? 'selected' : ''}`} onClick={() => { setPlanId(p.id); setSent(null); }}>
                <Badge tone="brand">{examName(p.examId)}</Badge>
                <h3 style={{ marginTop: 10 }}>{p.name}</h3>
                <div className="price">₹{p.priceInr}</div>
                <div className="muted">{p.durationDays} days access</div>
                <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
              </div>
            ))}
            {list.length === 0 && <Alert kind="info">No plans are available yet. Please contact the administrator.</Alert>}
          </div>
        )}
      </Loading>

      {planId && (
        <Loading state={pay}>
          {(info) => (
            <div className="grid c2">
              <Card title="1. Pay via UPI">
                {info.upiUri ? (
                  <div className="row" style={{ gap: 24, alignItems: 'flex-start' }}>
                    <div style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 14 }}><QRCodeSVG value={info.upiUri} size={170} /></div>
                    <div>
                      <div className="muted small">UPI ID</div><div style={{ fontWeight: 700, fontSize: 16 }}>{info.config.upiId}</div>
                      <div className="muted small" style={{ marginTop: 10 }}>Account name</div><div style={{ fontWeight: 600 }}>{info.config.accountName}</div>
                      <div className="small muted" style={{ marginTop: 12 }}>Scan with any UPI app. The amount is pre-filled.</div>
                    </div>
                  </div>
                ) : <Alert kind="warn">The administrator has not set up UPI details yet.</Alert>}
              </Card>
              <Card title="2. Submit your transaction reference">
                <Field label="12-digit UTR / bank reference number">
                  <input className="input" inputMode="numeric" maxLength={12} value={utr} onChange={(e) => setUtr(e.target.value.replace(/\D/g, ''))} placeholder="123456789012" />
                </Field>
                <button className="btn primary block" disabled={utr.length !== 12 || busy} onClick={submit}><ShieldCheck size={16} />Submit for approval</button>
                {sent && (
                  <div style={{ marginTop: 14 }}>
                    <Alert kind="success">Submitted. Send the proof to the admin on WhatsApp to speed things up.</Alert>
                    <a className="btn success block" style={{ marginTop: 10 }} href={sent.whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={16} />Submit via WhatsApp</a>
                  </div>
                )}
              </Card>
            </div>
          )}
        </Loading>
      )}
    </div>
  );
}
