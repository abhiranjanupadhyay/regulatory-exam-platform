import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Inbox, X } from 'lucide-react';

// ---- toasts ----
const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, kind = '') => {
    const id = Math.random();
    setItems((l) => [...l, { id, message, kind }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ---- small building blocks ----
export const Spinner = () => <div className="spinner" />;

export function PageHead({ title, subtitle, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="row wrap">{children}</div>
    </div>
  );
}

export function Card({ title, actions, flush, children, className = '' }) {
  return (
    <div className={`card ${flush ? 'flush' : ''} ${className}`}>
      {title && (flush ? (
        <div className="card-head"><h3>{title}</h3><div className="row">{actions}</div></div>
      ) : (
        <div className="row between" style={{ marginBottom: 12 }}><h3 style={{ margin: 0 }}>{title}</h3><div className="row">{actions}</div></div>
      ))}
      {children}
    </div>
  );
}

export function Stat({ icon: Icon, tone = 'brand', value, label }) {
  return (
    <div className="card stat">
      <div className={`ico tone-${tone}`}><Icon size={22} /></div>
      <div><div className="val">{value}</div><div className="lbl">{label}</div></div>
    </div>
  );
}

export const Badge = ({ tone = 'gray', children }) => <span className={`badge ${tone}`}>{children}</span>;

export function Empty({ icon: Icon = Inbox, title, hint }) {
  return (
    <div className="empty">
      <Icon size={36} />
      <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
      {hint && <div className="small">{hint}</div>}
    </div>
  );
}

export function Alert({ kind = 'info', icon: Icon, children }) {
  return <div className={`alert ${kind}`}>{Icon && <Icon size={18} style={{ flexShrink: 0, marginTop: 2 }} />}<div>{children}</div></div>;
}

export function Progress({ value, tone = '' }) {
  return <div className={`progress ${tone}`}><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

export function Pills({ options, value, onChange }) {
  return (
    <div className="pills">
      {options.map((o) => (
        <button key={o.value} className={`pill ${value === o.value ? 'active' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}{o.count != null && <span className="n">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange }) {
  return <button type="button" className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} aria-pressed={on} />;
}

export function Field({ label, children, hint }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {hint && <span className="small muted">{hint}</span>}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`}>
        <div className="modal-head"><h3>{title}</h3><button className="btn ghost sm" onClick={onClose}><X size={18} /></button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ title, onClose, children }) {
  return (
    <div className="drawer-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer">
        <div className="modal-head"><h3>{title}</h3><button className="btn ghost sm" onClick={onClose}><X size={18} /></button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ---- data loading ----
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    fn().then((data) => live && setState({ data, error: null, loading: false }))
      .catch((error) => live && setState({ data: null, error, loading: false }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

export function Loading({ state, children }) {
  if (state.loading && !state.data) return <Spinner />;
  if (state.error) return <Alert kind="error">{state.error.message}</Alert>;
  return children(state.data);
}

export const statusTone = (s) =>
  ({ ACTIVE: 'green', PENDING: 'amber', REJECTED: 'red', FROZEN: 'blue', EXPIRED: 'gray', OPEN: 'amber',
     RESOLVED: 'green', COMPLETE: 'green', EMPTY: 'red', MISSING_BOOK: 'amber', MISSING_MCQS: 'amber', USED: 'gray' }[s] || 'gray');
