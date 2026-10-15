import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, GraduationCap } from 'lucide-react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import GoogleSignIn, { identityOf } from './GoogleSignIn.jsx';
import { Alert, Field } from '../../components/ui.jsx';

const DESIGNATIONS = ['Clerk', 'Auditor', 'Senior Auditor', 'Assistant Accounts Officer', 'Other'];

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [invite, setInvite] = useState('');
  const [idToken, setIdToken] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ age: '', mobile: '', designation: 'Clerk', designationOther: '', station: '', office: '', detailsGenuine: false, authorizedEmployee: false });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const who = idToken ? identityOf(idToken) : { email: '', name: '' };

  const checkInvite = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { valid } = await api('/api/auth/invite/validate', { method: 'POST', body: { code: invite } });
      if (valid) setStep(2);
      else setError(new Error('Invalid or already used invite code.'));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register({ idToken, inviteCode: invite, ...f, age: Number(f.age) });
      nav('/app', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-center">
      <div className="auth-card">
        <div className="brand" style={{ color: 'var(--ink)', padding: 0, marginBottom: 18 }}>
          <div className="logo"><GraduationCap size={20} color="#fff" /></div>RegExam
        </div>
        <div className="steps">{[1, 2, 3].map((n) => <div key={n} className={`s ${step >= n ? 'done' : ''}`} />)}</div>
        {error && (
          <div style={{ marginBottom: 16 }}>
            <Alert kind="error">{error.message} {error.code === 'ALREADY_REGISTERED' && <Link to="/login"><b>Log in</b></Link>}</Alert>
          </div>
        )}

        {step === 1 && (
          <form onSubmit={checkInvite}>
            <h2>Enter your invite code</h2>
            <p className="muted" style={{ marginTop: 0 }}>Registration is by invitation only. Each code works once.</p>
            <Field label="Invite code">
              <input className="input" value={invite} onChange={(e) => setInvite(e.target.value.toUpperCase())} placeholder="e.g. K7PQ2MXA" autoFocus />
            </Field>
            <button className="btn primary lg block" disabled={!invite || busy}>Continue</button>
            <p className="small muted" style={{ textAlign: 'center', marginTop: 16 }}>Already registered? <Link to="/login">Log in</Link></p>
          </form>
        )}

        {step === 2 && (
          <div>
            <h2>Verify your identity</h2>
            <p className="muted" style={{ marginTop: 0, marginBottom: 18 }}>Sign in with Google. Your name and email are taken from your Google account.</p>
            <GoogleSignIn label="Continue" onToken={(t) => { setIdToken(t); setStep(3); }} />
            <button className="btn ghost" style={{ marginTop: 14 }} onClick={() => setStep(1)}>Back</button>
          </div>
        )}

        {step === 3 && (
          <form onSubmit={submit}>
            <h2>Your departmental profile</h2>
            <p className="muted" style={{ marginTop: 0 }}><CheckCircle2 size={14} style={{ verticalAlign: -2, color: 'var(--green)' }} /> Invite code accepted</p>
            <div className="grid c2">
              <Field label="Full name"><input className="input" value={who.name} readOnly /></Field>
              <Field label="Email"><input className="input" value={who.email} readOnly /></Field>
              <Field label="Age"><input className="input" type="number" min="18" max="70" required value={f.age} onChange={set('age')} /></Field>
              <Field label="Mobile / WhatsApp (10 digits)"><input className="input" required pattern="\d{10}" maxLength={10} value={f.mobile} onChange={set('mobile')} /></Field>
              <Field label="Designation">
                <select className="input" value={f.designation} onChange={set('designation')}>{DESIGNATIONS.map((d) => <option key={d}>{d}</option>)}</select>
              </Field>
              {f.designation === 'Other'
                ? <Field label="Please specify"><input className="input" required value={f.designationOther} onChange={set('designationOther')} /></Field>
                : <div />}
              <Field label="Station / place of posting"><input className="input" required placeholder="Delhi, Pune, Kolkata..." value={f.station} onChange={set('station')} /></Field>
              <Field label="Office / controller"><input className="input" required placeholder="PCDA Western Command" value={f.office} onChange={set('office')} /></Field>
            </div>
            <label className="check"><input type="checkbox" required checked={f.detailsGenuine} onChange={set('detailsGenuine')} />I affirm that the details provided are genuine.</label>
            <label className="check"><input type="checkbox" required checked={f.authorizedEmployee} onChange={set('authorizedEmployee')} />I affirm that I am an authorized employee of the department.</label>
            <button className="btn primary lg block" disabled={busy} style={{ marginTop: 8 }}>Create my account</button>
          </form>
        )}
      </div>
    </div>
  );
}
