import { useEffect } from 'react';
import { NOTIFICATIONS_POLL_INTERVAL_MS } from '../../config/env';
import { useAuth } from '../../context/AuthContext';
import { useNotifications, type AppNotification } from '../../context/NotificationsContext';

function toNotification(item: unknown, fallbackPrefix: string): AppNotification {
  const record = item as Record<string, unknown>;
  const id = record.id || record.notificacion_id || record.accion_respuesta_id || `${fallbackPrefix}-${Date.now()}-${Math.random()}`;
  return {
    id: String(id),
    title: String(record.titulo || record.title || 'Nueva accion de respuesta asignada'),
    message: String(record.mensaje || record.descripcion || record.detalle || 'Tiene una notificacion pendiente.'),
    time: String(record.fecha || record.created_at || record.fecha_creacion || new Date().toLocaleString()),
    read: Boolean(record.leido || record.read),
    raw: item,
  };
}

export function NotificationWatcher() {
  const { user, getUnreadNotifications, getAccionesRespuestasPendientes } = useAuth();
  const { setNotifications } = useNotifications();

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;

    async function poll() {
      try {
        const [unread, acciones] = await Promise.all([
          getUnreadNotifications(),
          getAccionesRespuestasPendientes(),
        ]);
        if (cancelled) return;
        const mapped = [
          ...unread.map((item) => toNotification(item, 'notif')),
          ...acciones.map((item) => toNotification(item, 'accion')),
        ];
        setNotifications(mapped);
      } catch {
        if (!cancelled) setNotifications([]);
      }
    }

    void poll();
    const timer = window.setInterval(poll, NOTIFICATIONS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [getAccionesRespuestasPendientes, getUnreadNotifications, setNotifications, user]);

  return null;
}
