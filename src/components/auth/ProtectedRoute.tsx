import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function ProtectedRoute() {
  const { user, selectedEmergencia, mustChangePassword } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (mustChangePassword) {
    return location.pathname === '/cambiar-clave'
      ? <Outlet />
      : <Navigate to="/cambiar-clave" replace />;
  }
  if (!mustChangePassword && location.pathname === '/cambiar-clave') {
    return <Navigate to={selectedEmergencia ? '/' : '/seleccionar-emergencia'} replace />;
  }
  if (!selectedEmergencia && location.pathname !== '/seleccionar-emergencia') {
    return <Navigate to="/seleccionar-emergencia" replace />;
  }
  return <Outlet />;
}
