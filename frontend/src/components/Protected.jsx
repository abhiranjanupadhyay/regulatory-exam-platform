import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth.jsx';

/**
 * Study/test area guard: forensic watermark (email, mobile, live timestamp), no right-click, copy or
 * common inspect shortcuts, and the content blurs when the window loses focus or dev tools look open.
 * This deters casual capture; it cannot stop a determined one.
 */
export default function Protected({ children }) {
  const { user } = useAuth();
  const [shield, setShield] = useState(false);
  const [stamp, setStamp] = useState(() => new Date().toLocaleString('en-IN'));

  useEffect(() => {
    const block = (e) => e.preventDefault();
    const keys = (e) => {
      const k = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.key === 'F12' || (ctrl && ['c', 'x', 'u', 's', 'p', 'a'].includes(k)) || (ctrl && e.shiftKey && ['i', 'j', 'c'].includes(k))) {
        if (!['INPUT', 'TEXTAREA'].includes(e.target.tagName)) e.preventDefault();
      }
    };
    const blur = () => setShield(true);
    const focus = () => setShield(false);
    const vis = () => setShield(document.hidden);
    const devtools = () => setShield(window.outerWidth - window.innerWidth > 200 || window.outerHeight - window.innerHeight > 260);

    ['contextmenu', 'copy', 'cut', 'dragstart'].forEach((ev) => document.addEventListener(ev, block));
    document.addEventListener('keydown', keys);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', vis);
    const t1 = setInterval(devtools, 1500);
    const t2 = setInterval(() => setStamp(new Date().toLocaleString('en-IN')), 15000);
    return () => {
      ['contextmenu', 'copy', 'cut', 'dragstart'].forEach((ev) => document.removeEventListener(ev, block));
      document.removeEventListener('keydown', keys);
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', vis);
      clearInterval(t1);
      clearInterval(t2);
    };
  }, []);

  const bg = useMemo(() => {
    const text = `${user?.email || ''}  ${user?.mobile || ''}  ${stamp}`.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='220'><text x='10' y='140' transform='rotate(-22 210 110)' font-family='Inter,Arial' font-size='13' fill='rgba(23,32,58,0.09)'>${text}</text></svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  }, [user, stamp]);

  return (
    <div className={`protected ${shield ? 'shielded' : ''}`}>
      {children}
      <div className="watermark" style={{ backgroundImage: bg }} />
    </div>
  );
}
