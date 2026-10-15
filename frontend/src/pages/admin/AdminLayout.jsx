import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Archive, BookCopy, GraduationCap, KeyRound, LayoutDashboard, Layers, LogOut, Menu, Pencil, ShieldCheck, Users, Wallet } from 'lucide-react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';

const NAV = [
  ['Overview', [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  ]],
  ['People', [
    { to: '/admin/candidates', label: 'Candidates & Support', icon: Users, badge: 'attention' },
    { to: '/admin/invites', label: 'Invite Codes', icon: KeyRound },
  ]],
  ['Content', [
    { to: '/admin/content', label: 'Content Matrix', icon: Layers },
    { to: '/admin/mcqs', label: 'MCQ Editor', icon: Pencil },
    { to: '/admin/vault', label: 'Snapshot Vault', icon: Archive },
  ]],
  ['Configuration', [
    { to: '/admin/exams-plans', label: 'Exams & Plans', icon: Wallet },
    { to: '/admin/tiers', label: 'Tier Control', icon: ShieldCheck },
  ]],
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [attention, setAttention] = useState(0);
  const flat = NAV.flatMap(([, items]) => items);
  const title = flat.find((i) => (i.end ? loc.pathname === i.to : loc.pathname.startsWith(i.to)))?.label || 'Admin';
  const first = useRef(true);

  // Pending payments + open tickets, refreshed on navigation, shown as a badge in the sidebar.
  useEffect(() => {
    Promise.all([api('/api/admin/subscriptions?status=PENDING'), api('/api/admin/tickets?status=OPEN')])
      .then(([s, t]) => setAttention(s.length + t.length)).catch(() => {});
    if (first.current) first.current = false;
    setOpen(false);
  }, [loc.pathname]);

  return (
    <div className="shell">
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand"><div className="logo"><GraduationCap size={20} color="#fff" /></div><div>RegExam<small>Admin Console</small></div></div>
        {NAV.map(([section, items]) => (
          <div key={section}>
            <div className="nav-section">{section}</div>
            {items.map(({ to, label, icon: Icon, end, badge }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <Icon size={18} />{label}{badge && attention > 0 && <span className="count">{attention}</span>}
              </NavLink>
            ))}
          </div>
        ))}
        <div className="sidebar-foot">
          <div style={{ color: '#fff', fontWeight: 600 }}>{user.name}</div>
          <div style={{ marginBottom: 10 }}>{user.email}</div>
          <button className="btn sm block" onClick={() => { logout(); nav('/'); }}><LogOut size={14} />Log out</button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="btn ghost menu-btn" onClick={() => setOpen(true)}><Menu size={20} /></button>
          <h2 className="grow">{title}</h2>
          <span className="badge brand"><BookCopy size={12} />Administrator</span>
        </header>
        <div className="content"><Outlet /></div>
      </div>
    </div>
  );
}
