import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function ProtectedRoute() {
  const { user, selectedEmergencia } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!selectedEmergencia && location.pathname !== '/seleccionar-emergencia') {
    return <Navigate to="/seleccionar-emergencia" replace />;
  }
  return <Outlet />;
}
