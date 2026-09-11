import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type AppNotification = {
  id: string | number;
  title: string;
  message: string;
  time?: string;
  read?: boolean;
  href?: string;
  raw?: unknown;
};

type NotificationsContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  setNotifications: (items: AppNotification[]) => void;
  addNotification: (item: AppNotification) => void;
  markAsRead: (id: string | number) => void;
  clearNotifications: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotificationsState] = useState<AppNotification[]>([]);

  const setNotifications = useCallback((items: AppNotification[]) => {
    setNotificationsState(items);
  }, []);

  const addNotification = useCallback((item: AppNotification) => {
    setNotificationsState((current) => {
      if (current.some((notification) => String(notification.id) === String(item.id))) return current;
      return [item, ...current];
    });
  }, []);

  const markAsRead = useCallback((id: string | number) => {
    setNotificationsState((current) => current.map((item) => (
      String(item.id) === String(id) ? { ...item, read: true } : item
    )));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotificationsState([]);
  }, []);

  const unreadCount = notifications.filter((item) => !item.read).length;
  const value = useMemo(() => ({
    notifications,
    unreadCount,
    setNotifications,
    addNotification,
    markAsRead,
    clearNotifications,
  }), [notifications, unreadCount, setNotifications, addNotification, markAsRead, clearNotifications]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error('useNotifications debe utilizarse dentro de NotificationsProvider');
  return value;
}
