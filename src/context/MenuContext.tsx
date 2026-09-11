import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

type MenuContextValue = {
  getMenuIdByRoute: (route: string) => number | null;
};

const MenuContext = createContext<MenuContextValue | undefined>(undefined);

const routeMenuIds: Record<string, number> = {
  '/': 1,
  '/eventos-adversos': 2,
  '/afectaciones': 3,
  '/infraestructuras': 4,
  '/maestro-dpa': 5,
};

export function MenuProvider({ children }: { children: ReactNode }) {
  const getMenuIdByRoute = useCallback((route: string) => routeMenuIds[route] || null, []);
  const value = useMemo(() => ({ getMenuIdByRoute }), [getMenuIdByRoute]);
  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

export function useMenu() {
  const value = useContext(MenuContext);
  if (!value) throw new Error('useMenu debe utilizarse dentro de MenuProvider');
  return value;
}
