import { useEffect, useRef, useState } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const DEV_LOGIN = import.meta.env.VITE_DEV_LOGIN === 'true';

/** Decode who a token belongs to, only for pre-filling the locked name/email fields. */
export function identityOf(idToken) {
  if (idToken.startsWith('dev:')) {
    const [email, name] = idToken.slice(4).split('|');
    return { email, name: name || email };
  }
  try {
    const p = JSON.parse(atob(idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return { email: p.email, name: p.name };
  } catch {
    return { email: '', name: '' };
  }
}

/** Google button; falls back to a development form when VITE_DEV_LOGIN=true. */
export default function GoogleSignIn({ onToken, label = 'Continue with Google' }) {
  const box = useRef(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    if (!CLIENT_ID) return undefined;
    const init = () => {
      window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: (r) => onToken(r.credential) });
      window.google.accounts.id.renderButton(box.current, { theme: 'outline', size: 'large', width: 320, text: 'continue_with' });
    };
    if (window.google?.accounts) {
      init();
      return undefined;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = init;
    document.body.appendChild(s);
    return () => s.remove();
  }, [onToken]);

  return (
    <div className="stack">
      {CLIENT_ID && <div ref={box} style={{ display: 'flex', justifyContent: 'center' }} />}
      {DEV_LOGIN && (
        <div style={{ background: '#fff8e6', border: '1px dashed #e0b34d', borderRadius: 12, padding: 14 }}>
          <div className="small" style={{ fontWeight: 600, marginBottom: 8 }}>Development sign-in (no Google)</div>
          <input className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginBottom: 8 }} />
          <input className="input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 10 }} />
          <button className="btn primary block" disabled={!email.includes('@')} onClick={() => onToken(`dev:${email}|${name || email}`)}>
            {label}
          </button>
        </div>
      )}
      {!CLIENT_ID && !DEV_LOGIN && (
        <div className="alert warn">Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID.</div>
      )}
    </div>
  );
}
