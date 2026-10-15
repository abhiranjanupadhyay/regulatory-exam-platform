import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, CalendarClock, ChevronDown, CreditCard, FileText, GraduationCap, LayoutDashboard, ListChecks, LogOut, Menu, Timer, User } from 'lucide-react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Spinner } from '../../components/ui.jsx';
import { StudentContext } from './context.jsx';
import Payment from './Payment.jsx';

const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/syllabus', label: 'Syllabus', icon: ListChecks },
  { to: '/app/study', label: 'Study Table', icon: BookOpen },
  { to: '/app/mocks', label: 'Mock Arena', icon: Timer },
  { to: '/app/profile', label: 'Profile', icon: User },
];
const TITLES = { '/app': 'Dashboard', '/app/syllabus': 'Syllabus', '/app/study': 'Study Table', '/app/mocks': 'Mock Arena', '/app/profile': 'Profile', '/app/plans': 'Plans & Renewal' };

export default function StudentLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [exams, setExams] = useState(null);
  const [subs, setSubs] = useState(null);
  const [examId, setExamId] = useState(localStorage.getItem('examId'));
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);

  const refresh = () => api('/api/subscriptions/me').then(setSubs);
  useEffect(() => { api('/api/exams').then(setExams); refresh(); }, []);
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => {
    const h = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenu(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const active = useMemo(() => (subs?.subscriptions || []).filter((s) => s.status === 'ACTIVE'), [subs]);
  const examIds = useMemo(() => [...new Set(active.map((s) => s.examId))], [active]);
  const currentExam = examIds.includes(examId) ? examId : examIds[0];
  useEffect(() => { if (currentExam) localStorage.setItem('examId', currentExam); }, [currentExam]);

  if (!exams || !subs) return <Spinner />;
  const examName = (id) => exams.find((e) => e.id === id)?.name || 'Exam';
  const best = active.filter((s) => s.examId === currentExam).sort((a, b) => b.daysRemaining - a.daysRemaining)[0];
  const locked = !subs.hasActivePlan;
  const inPlans = loc.pathname === '/app/plans';

  const ctx = { exams, subs, examId: currentExam, examName, refresh };
  const title = Object.entries(TITLES).find(([p]) => loc.pathname === p)?.[1]
    || (loc.pathname.startsWith('/app/study') ? 'Study Table' : loc.pathname.startsWith('/app/test') ? 'Mock Test' : loc.pathname.startsWith('/app/results') ? 'Scorecard' : loc.pathname.startsWith('/app/practice') ? 'Weak Area Practice' : '');

  return (
    <StudentContext.Provider value={ctx}>
      <div className="shell">
        {open && <div className="scrim" onClick={() => setOpen(false)} />}
        <aside className={`sidebar ${open ? 'open' : ''}`}>
          <div className="brand"><div className="logo"><GraduationCap size={20} color="#fff" /></div><div>RegExam<small>Student Portal</small></div></div>
          <div className="nav-section">Learn</div>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            locked
              ? <span key={to} className="nav-link" style={{ opacity: .4, cursor: 'not-allowed' }}><Icon size={18} />{label}</span>
              : <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Icon size={18} />{label}</NavLink>
          ))}
          <div className="nav-section">Account</div>
          <NavLink to="/app/plans" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><CreditCard size={18} />Plans &amp; Renewal</NavLink>
          <div className="sidebar-foot">
            <div style={{ color: '#fff', fontWeight: 600 }}>{user.name}</div>
            <div>{user.office}</div>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <button className="btn ghost menu-btn" onClick={() => setOpen(true)}><Menu size={20} /></button>
            <h2 className="grow">{title}</h2>
            {examIds.length > 0 && (
              <select className="input" style={{ width: 'auto' }} value={currentExam} onChange={(e) => setExamId(e.target.value)} title="Exam stage">
                {examIds.map((id) => <option key={id} value={id}>{examName(id)}</option>)}
              </select>
            )}
            <button
              className={`validity ${!best ? 'none' : best.expiringSoon ? 'warn' : ''}`}
              onClick={() => nav('/app/plans')}
              title="Renew or change plan"
            >
              <CalendarClock size={16} />
              {best ? `${best.daysRemaining} days remaining` : 'No active plan'}
            </button>
            <div style={{ position: 'relative' }} ref={menuRef}>
              <button className="avatar" onClick={() => setMenu(!menu)}>{user.name?.[0]?.toUpperCase()}</button>
              {menu && (
                <div className="dropdown">
                  <div style={{ padding: '8px 12px' }}><b>{user.name}</b><div className="small muted">{user.email}</div></div>
                  <button className="item" onClick={() => { setMenu(false); nav('/app/profile'); }}><User size={16} />View profile</button>
                  <button className="item" onClick={() => { logout(); nav('/'); }}><LogOut size={16} />Log out</button>
                </div>
              )}
            </div>
          </header>
          <div className="content">
            {locked || inPlans ? <Payment /> : <Outlet />}
          </div>
        </div>
      </div>
    </StudentContext.Provider>
  );
}
