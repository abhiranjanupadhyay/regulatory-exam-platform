import { Link, Navigate } from 'react-router-dom';
import { BookOpenCheck, ShieldCheck, Timer, TrendingUp, GraduationCap } from 'lucide-react';
import { useAuth } from '../../auth.jsx';

export default function Landing() {
  const { user } = useAuth();
  if (user) return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/app'} replace />;
  return (
    <div className="hero">
      <div className="hero-nav">
        <div className="brand" style={{ padding: 0 }}>
          <div className="logo"><GraduationCap size={20} color="#fff" /></div>
          <div>RegExam<small>Regulatory Exam Platform</small></div>
        </div>
      </div>
      <div className="hero-body">
        <div>
          <span className="badge brand" style={{ background: 'rgba(255,255,255,.12)', color: '#c7d0f5', marginBottom: 18 }}>Invite-only for department personnel</span>
          <h1>Prepare for your departmental examinations with confidence.</h1>
          <p className="lead">Read the statutory rulebooks, practise chapter-wise MCQs, and sit timed mock tests that mirror the real computer-based exam.</p>
          {[
            [BookOpenCheck, 'Rulebook and practice deck side by side'],
            [Timer, 'Timed mocks with question palette and full scorecards'],
            [TrendingUp, 'Readiness meter and weak-area remediation'],
            [ShieldCheck, 'Secure, single-device access'],
          ].map(([Icon, text]) => (
            <div className="feature" key={text}><span className="ic"><Icon size={18} /></span>{text}</div>
          ))}
        </div>
        <div className="auth-card">
          <h2>Welcome</h2>
          <p className="muted" style={{ marginTop: 0, marginBottom: 22 }}>Log in to continue, or register with your invite code.</p>
          <Link to="/login" className="btn primary lg block" style={{ marginBottom: 12 }}>Log In</Link>
          <Link to="/register" className="btn lg block">Register</Link>
          <p className="small muted" style={{ marginTop: 18, textAlign: 'center' }}>You need a single-use invite code from your administrator to register.</p>
        </div>
      </div>
    </div>
  );
}
