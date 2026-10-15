import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { useAuth } from '../../auth.jsx';
import GoogleSignIn from './GoogleSignIn.jsx';
import { Alert } from '../../components/ui.jsx';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [error, setError] = useState(null);

  const onToken = async (idToken) => {
    setError(null);
    try {
      const u = await login(idToken);
      nav(u.role === 'ADMIN' ? '/admin' : '/app', { replace: true });
    } catch (e) {
      setError(e);
    }
  };

  return (
    <div className="page-center">
      <div className="auth-card" style={{ maxWidth: 440 }}>
        <div className="brand" style={{ color: 'var(--ink)', padding: 0, marginBottom: 18 }}>
          <div className="logo"><GraduationCap size={20} color="#fff" /></div>RegExam
        </div>
        <h2>Log in</h2>
        <p className="muted" style={{ marginTop: 0 }}>Use the Google account you registered with.</p>
        {error && (
          <div style={{ margin: '14px 0' }}>
            <Alert kind="error">
              {error.message}{' '}
              {error.code === 'NOT_REGISTERED' && <Link to="/register"><b>Register now</b></Link>}
            </Alert>
          </div>
        )}
        <GoogleSignIn onToken={onToken} label="Log in" />
        <p className="small muted" style={{ textAlign: 'center', marginTop: 18 }}>
          New here? <Link to="/register">Register with an invite code</Link>
        </p>
      </div>
    </div>
  );
}
