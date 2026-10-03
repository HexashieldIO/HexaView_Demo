import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CloseX } from './ui';

function useEscape(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
}

/** Right-hand detail panel. Render conditionally: {item && <Drawer …/>}. */
export function Drawer({
  title, sub, icon, onClose, children, footer, wide,
}: {
  title: ReactNode; sub?: ReactNode; icon?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  useEscape(onClose);
  return createPortal(
    <>
      <div className="overlay" onClick={onClose} />
      <aside className={`drawer ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="drawer-head">
          {icon}
          <div style={{ minWidth: 0 }}>
            <h3>{title}</h3>
            {sub && <div className="card-sub">{sub}</div>}
          </div>
          <CloseX onClick={onClose} />
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </aside>
    </>,
    document.body,
  );
}

/** Centred dialog for confirmations and short forms. */
export function Modal({ title, sub, onClose, children, footer }: { title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEscape(onClose);
  return createPortal(
    <>
      <div className="overlay" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true">
        <div className="drawer-head">
          <div>
            <h3>{title}</h3>
            {sub && <div className="card-sub">{sub}</div>}
          </div>
          <CloseX onClick={onClose} />
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </div>
    </>,
    document.body,
  );
}
