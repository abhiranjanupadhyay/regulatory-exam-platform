import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { Spinner } from './components/ui.jsx';
import Landing from './pages/public/Landing.jsx';
import Login from './pages/public/Login.jsx';
import Register from './pages/public/Register.jsx';
import StudentLayout from './pages/student/StudentLayout.jsx';
import Dashboard from './pages/student/Dashboard.jsx';
import Syllabus from './pages/student/Syllabus.jsx';
import Study from './pages/student/Study.jsx';
import WeakPractice from './pages/student/WeakPractice.jsx';
import MockArena from './pages/student/MockArena.jsx';
import TestRunner from './pages/student/TestRunner.jsx';
import Result from './pages/student/Result.jsx';
import Profile from './pages/student/Profile.jsx';
import Payment from './pages/student/Payment.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import Overview from './pages/admin/Overview.jsx';
import ContentMatrix from './pages/admin/ContentMatrix.jsx';
import Candidates from './pages/admin/Candidates.jsx';
import McqEditor from './pages/admin/McqEditor.jsx';
import ExamsPlans from './pages/admin/ExamsPlans.jsx';
import Invites from './pages/admin/Invites.jsx';
import TierControl from './pages/admin/TierControl.jsx';
import Vault from './pages/admin/Vault.jsx';

function Guard({ role, children }) {
  const { user, loading, displaced } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/" replace />;
  if ((role === 'ADMIN') !== (user.role === 'ADMIN')) return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/app'} replace />;
  return (
    <>
      {displaced && (
        <div className="displaced">
          <div className="box">
            <h1 style={{ marginBottom: 12 }}>Session Displaced</h1>
            <p style={{ color: '#c7d0f5', fontSize: 16 }}>
              This account has been logged in on another device. Your session here has been deactivated.
            </p>
          </div>
        </div>
      )}
      {children}
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/app" element={<Guard><StudentLayout /></Guard>}>
        <Route index element={<Dashboard />} />
        <Route path="syllabus" element={<Syllabus />} />
        <Route path="study" element={<Study />} />
        <Route path="study/:topicId" element={<Study />} />
        <Route path="practice/weak" element={<WeakPractice />} />
        <Route path="mocks" element={<MockArena />} />
        <Route path="test/:id" element={<TestRunner />} />
        <Route path="results/:id" element={<Result />} />
        <Route path="plans" element={<Payment />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route path="/admin" element={<Guard role="ADMIN"><AdminLayout /></Guard>}>
        <Route index element={<Overview />} />
        <Route path="content" element={<ContentMatrix />} />
        <Route path="candidates" element={<Candidates />} />
        <Route path="mcqs" element={<McqEditor />} />
        <Route path="exams-plans" element={<ExamsPlans />} />
        <Route path="invites" element={<Invites />} />
        <Route path="tiers" element={<TierControl />} />
        <Route path="vault" element={<Vault />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
