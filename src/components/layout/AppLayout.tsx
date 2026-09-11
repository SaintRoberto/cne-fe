import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { NotificationWatcher } from './NotificationWatcher';

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-shell">
      <NotificationWatcher />
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      {mobileOpen ? <button className="sidebar-scrim" aria-label="Cerrar menu" onClick={() => setMobileOpen(false)} /> : null}
      <main className={`app-main ${collapsed ? 'app-main--wide' : ''}`}>
        <Topbar onMenu={() => {
          if (window.innerWidth < 900) setMobileOpen(true);
          else setCollapsed((value) => !value);
        }} />
        <div className="page-content"><Outlet /></div>
        <footer className="app-footer"><span>Consejo Nacional Electoral</span><span>Ambiente de demostracion <i className="status-dot" /></span></footer>
      </main>
    </div>
  );
}
