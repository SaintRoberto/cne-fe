import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { MenuProvider } from './context/MenuContext';
import { NotificationsProvider } from './context/NotificationsContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { Login } from './pages/auth/Login';
import { HomeDashboard } from './pages/home/HomeDashboard';
import { EventosAdversos } from './pages/eventos/EventosAdversos';
import { EventoAfectaciones } from './pages/eventos/EventoAfectaciones';
import { Afectaciones } from './pages/afectaciones/Afectaciones';
import { ImportarInfraestructuras } from './pages/infraestructuras/ImportarInfraestructuras';
import { MaestroDpa } from './pages/ubicaciones/MaestroDpa';

export default function App() {
  return (
    <AuthProvider>
      <MenuProvider>
        <NotificationsProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<HomeDashboard />} />
                <Route path="eventos-adversos" element={<EventosAdversos />} />
                <Route path="eventos-adversos/:eventoId/afectaciones" element={<EventoAfectaciones />} />
                <Route path="afectaciones" element={<Afectaciones />} />
                <Route path="infraestructuras" element={<ImportarInfraestructuras />} />
                <Route path="infraestructuras/importar" element={<Navigate to="/infraestructuras" replace />} />
                <Route path="maestro-dpa" element={<MaestroDpa />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </NotificationsProvider>
      </MenuProvider>
    </AuthProvider>
  );
}
