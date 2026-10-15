import { useState } from 'react';
import { Save, UserCog } from 'lucide-react';
import { api } from '../../api.js';
import { Alert, Card, Field, Loading, PageHead, Toggle, useLoad, useToast } from '../../components/ui.jsx';

const toLocal = (iso) => (iso ? iso.slice(0, 10) : '');

export default function TierControl() {
  const toast = useToast();
  const policy = useLoad(() => api('/api/admin/tier-policy'));
  const [f, setF] = useState(null);
  const [who, setWho] = useState({ identifier: '', tier: 2 });
  const form = f || policy.data;

  const save = async (next = form) => {
    try {
      const body = { ...next, coverageRequiredPct: Number(next.coverageRequiredPct), qualifyingScorePct: Number(next.qualifyingScorePct), cooldownHours: Number(next.cooldownHours),
        tier2UnlockDate: next.tier2UnlockDate ? `${toLocal(next.tier2UnlockDate)}T00:00:00Z` : null, tier3UnlockDate: next.tier3UnlockDate ? `${toLocal(next.tier3UnlockDate)}T00:00:00Z` : null };
      await api('/api/admin/tier-policy', { method: 'PUT', body });
      toast('Tier policy saved', 'success'); setF(null); policy.reload();
    } catch (e) { toast(e.message, 'error'); }
  };
  const unlock = async () => {
    try { const r = await api('/api/admin/tier-unlocks', { method: 'POST', body: { identifier: who.identifier, tier: Number(who.tier) } }); toast(`Tier ${who.tier} unlocked for ${r.email}`, 'success'); setWho({ ...who, identifier: '' }); }
    catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="page" style={{ maxWidth: 1000 }}>
      <PageHead title="Tier Control" subtitle="Decide how and when candidates move from Foundation to Mastery" />
      <Loading state={policy}>
        {() => (
          <div className="stack" style={{ gap: 18 }}>
            <Card title="Universal institutional override">
              <div className="row between">
                <div><b>Unlock all three tiers for every student</b><div className="muted small">Useful during intensive exam weeks. Takes effect immediately.</div></div>
                <Toggle on={form.universalOverride} onChange={(v) => save({ ...form, universalOverride: v })} />
              </div>
              {form.universalOverride && <div style={{ marginTop: 12 }}><Alert kind="warn">Override is ON: every tier is open for everyone.</Alert></div>}
            </Card>
            <Card title="Twin unlock criteria">
              <div className="grid c3">
                <Field label="Practice MCQ coverage required (%)" hint="Share of the previous tier's questions to answer"><input className="input" type="number" min="0" max="100" value={form.coverageRequiredPct} onChange={(e) => setF({ ...form, coverageRequiredPct: e.target.value })} /></Field>
                <Field label="Qualifying exam score (%)" hint="Minimum on the 50-question mock"><input className="input" type="number" min="0" max="100" value={form.qualifyingScorePct} onChange={(e) => setF({ ...form, qualifyingScorePct: e.target.value })} /></Field>
                <Field label="Retry cooldown (hours)" hint="Wait after a failed qualifying exam"><input className="input" type="number" min="0" value={form.cooldownHours} onChange={(e) => setF({ ...form, cooldownHours: e.target.value })} /></Field>
              </div>
              <div className="grid c2">
                <Field label="Scheduled unlock: Tier 2" hint="Opens for all students on this date"><input className="input" type="date" value={toLocal(form.tier2UnlockDate)} onChange={(e) => setF({ ...form, tier2UnlockDate: e.target.value })} /></Field>
                <Field label="Scheduled unlock: Tier 3"><input className="input" type="date" value={toLocal(form.tier3UnlockDate)} onChange={(e) => setF({ ...form, tier3UnlockDate: e.target.value })} /></Field>
              </div>
              <button className="btn primary" disabled={!f} onClick={() => save()}><Save size={16} />Save criteria</button>
            </Card>
            <Card title="Manual student override">
              <div className="row wrap">
                <input className="input grow" placeholder="Student email or 10-digit mobile" value={who.identifier} onChange={(e) => setWho({ ...who, identifier: e.target.value })} />
                <select className="input" style={{ width: 130 }} value={who.tier} onChange={(e) => setWho({ ...who, tier: e.target.value })}><option value={2}>Tier 2</option><option value={3}>Tier 3</option></select>
                <button className="btn primary" disabled={!who.identifier.trim()} onClick={unlock}><UserCog size={16} />Unlock</button>
              </div>
            </Card>
          </div>
        )}
      </Loading>
    </div>
  );
}
