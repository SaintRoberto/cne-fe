import { NavLink } from 'react-router-dom';
import { LogOut, X } from 'lucide-react';
import { CneMark } from '../brand/CneMark';
import { useAuth } from '../../context/AuthContext';
import { dashboardItem, menuItems } from './menuConfig';

type SidebarProps = { collapsed: boolean; mobileOpen: boolean; onClose: () => void };

export function Sidebar({ collapsed, mobileOpen, onClose }: SidebarProps) {
  const { logout } = useAuth();

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''} ${mobileOpen ? 'sidebar--mobile-open' : ''}`}>
      <div className="sidebar__header">
        <CneMark compact={collapsed} light />
        <button className="icon-button sidebar__close" onClick={onClose} aria-label="Cerrar menu"><X size={20} /></button>
      </div>

      <nav className="sidebar__nav" aria-label="Navegacion principal">
        <span className="nav-label nav-label--group">Monitoreo Eventos</span>
        {menuItems.map((item) => <SidebarLink key={item.path} item={item} collapsed={collapsed} onNavigate={onClose} />)}
        <span className="nav-label nav-label--group">Resultados</span>
        <SidebarLink item={dashboardItem} collapsed={collapsed} onNavigate={onClose} />
      </nav>

      <div className="sidebar__footer">
        <button className="sidebar__logout" onClick={logout}><LogOut size={17} /><span>Cerrar sesion</span></button>
      </div>
    </aside>
  );
}

function SidebarLink({ item, collapsed, onNavigate }: { item: (typeof menuItems)[number]; collapsed: boolean; onNavigate: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink to={item.path} onClick={onNavigate} title={collapsed ? item.label : undefined} className={({ isActive }) => `sidebar__link ${isActive ? 'is-active' : ''}`}>
      <Icon size={17} strokeWidth={1.8} />
      <span>{item.label}</span>
    </NavLink>
  );
}
