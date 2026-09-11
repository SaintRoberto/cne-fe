import { Building2, ClipboardList, LayoutDashboard, MapPinned, ShieldAlert } from 'lucide-react';
import type { MenuItem } from '../../types';

export const dashboardItem: MenuItem = { label: 'Dashboard CNE', path: '/', icon: LayoutDashboard };

export const menuItems: MenuItem[] = [
  { label: 'Eventos Adversos', path: '/eventos-adversos', icon: ShieldAlert },
  { label: 'Afectaciones', path: '/afectaciones', icon: ClipboardList },
  { label: 'Infraestructuras', path: '/infraestructuras', icon: Building2 },
  { label: 'Maestro DPA', path: '/maestro-dpa', icon: MapPinned },
];
