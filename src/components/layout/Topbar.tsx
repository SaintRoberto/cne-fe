import { useEffect, useRef, useState } from 'react';
import { Bell, LogOut, Menu, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationsContext';

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!notificationRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  return (
    <header className="topbar">
      <div className="topbar__leading">
        <button className="icon-button topbar__menu" onClick={onMenu} aria-label="Abrir menu"><Menu size={21} /></button>
        <h1>Sistemas COE - CNE</h1>
      </div>
      <div className="topbar__actions">
        <div className="context-chips" aria-label="Contexto DPA">
          <span className="chip chip--green">COE-M</span>
          <span className="chip chip--purple">Manabi</span>
          <span className="chip chip--red">Manta</span>
          <span className="chip chip--blue">Agua Y Ambiente</span>
        </div>
        <div className="notification-menu" ref={notificationRef}>
          <button
            className="icon-button notification-button"
            aria-label="Notificaciones"
            aria-expanded={notificationsOpen}
            aria-haspopup="dialog"
            onClick={() => setNotificationsOpen((open) => !open)}
          >
            <Bell size={18} />
            {unreadCount > 0 ? <i>{unreadCount}</i> : null}
          </button>
          {notificationsOpen ? (
            <section className="notification-popover" aria-label="Panel de notificaciones">
              <h2>Notificaciones</h2>
              {notifications.length ? notifications.map((notification) => (
                <button
                  key={notification.id}
                  className={`notification-item ${notification.read ? 'notification-item--read' : ''}`}
                  onClick={() => markAsRead(notification.id)}
                  type="button"
                >
                  <strong>{notification.title}</strong>
                  <p>{notification.message}</p>
                  {notification.time ? <time>{notification.time}</time> : null}
                </button>
              )) : (
                <p className="notification-empty">No hay notificaciones pendientes.</p>
              )}
            </section>
          ) : null}
        </div>
        <button className="icon-button topbar__user" aria-label="Abrir perfil"><UserRound size={18} /></button>
        <div className="topbar__profile"><span>{user?.role}</span></div>
        <button className="icon-button topbar__logout" onClick={logout} aria-label="Cerrar sesion"><LogOut size={19} /></button>
      </div>
    </header>
  );
}
