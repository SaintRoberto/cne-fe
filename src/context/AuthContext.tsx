import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { API_BASE_URL } from '../config/env';
import type { User } from '../types';

export type LoginResponse = {
  token?: string;
  userId?: number;
  usuario_id?: number;
  id?: number;
  [key: string]: unknown;
};

export type DatosLogin = {
  usuario_id?: number;
  perfil_id?: number;
  coe_id?: number;
  coe_nombre?: string;
  mesa_id?: number;
  mesa_grupo_id?: number;
  mesa_nombre?: string;
  emergencia_id?: number;
  provincia_id?: number;
  provincia_nombre?: string;
  canton_id?: number;
  canton_nombre?: string;
  parroquia_id?: number;
  nombres?: string;
  apellidos?: string;
  correo?: string;
  email?: string;
  [key: string]: unknown;
};

type AuthContextValue = {
  user: User | null;
  loginResponse: LoginResponse | null;
  datosLogin: DatosLogin | null;
  selectedEmergenciaId: number | null;
  setSelectedEmergenciaId: (id: number | null) => void;
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  getAccionesRespuestasPendientes: () => Promise<unknown[]>;
  getUnreadNotifications: () => Promise<unknown[]>;
  markNotificationAsRead: (id: number) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AUTH_KEY = 'cne-auth';
const TOKEN_KEY = 'token';
const USER_ID_KEY = 'userId';
const EMERGENCY_KEY = 'selectedEmergenciaId';

const demoDatosLogin: DatosLogin = {
  usuario_id: 1,
  perfil_id: 1,
  coe_id: 2,
  coe_nombre: 'COE Cantonal',
  mesa_id: 1,
  mesa_grupo_id: 1,
  mesa_nombre: 'Agua Segura, Saneamiento',
  emergencia_id: 1,
  provincia_id: 13,
  provincia_nombre: 'Manabí',
  canton_id: 901,
  canton_nombre: 'MANTA',
  nombres: 'COE Cantonal',
  apellidos: 'MANTA',
  correo: 'coe.manta@cne.gob.ec',
};

const demoUser: User = {
  name: 'COE Cantonal Manta',
  role: 'COE Cantonal MANTA Agua Segura, Saneamiento',
  email: 'coe.manta@cne.gob.ec',
  initials: 'CM',
};

function buildUser(datos: DatosLogin | null): User | null {
  if (!datos) return null;
  const fullName = `${datos.nombres || ''} ${datos.apellidos || ''}`.trim();
  const coe = datos.coe_nombre || 'COE';
  const canton = datos.canton_nombre ? ` ${datos.canton_nombre}` : '';
  const mesa = datos.mesa_nombre ? ` ${datos.mesa_nombre}` : '';
  const label = `${coe}${canton}${mesa}`.trim();
  return {
    name: fullName || label,
    role: label,
    email: String(datos.correo || datos.email || ''),
    initials: (fullName || label).split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(),
  };
}

function readStoredAuth() {
  try {
    const stored = localStorage.getItem(AUTH_KEY);
    if (!stored) return { loginResponse: null, datosLogin: null, user: null, selectedEmergenciaId: null };
    const parsed = JSON.parse(stored) as {
      loginResponse: LoginResponse | null;
      datosLogin: DatosLogin | null;
      user: User | null;
      selectedEmergenciaId: number | null;
    };
    const selected = Number(localStorage.getItem(EMERGENCY_KEY) || parsed.selectedEmergenciaId || parsed.datosLogin?.emergencia_id || 0);
    return { ...parsed, selectedEmergenciaId: selected || null };
  } catch {
    return { loginResponse: null, datosLogin: null, user: null, selectedEmergenciaId: null };
  }
}

async function parseJsonSafe<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? JSON.parse(text) as T : ({} as T);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = readStoredAuth();
  const [loginResponse, setLoginResponse] = useState<LoginResponse | null>(stored.loginResponse);
  const [datosLogin, setDatosLogin] = useState<DatosLogin | null>(stored.datosLogin);
  const [user, setUser] = useState<User | null>(stored.user || buildUser(stored.datosLogin));
  const [selectedEmergenciaIdState, setSelectedEmergenciaIdState] = useState<number | null>(stored.selectedEmergenciaId);

  const persist = useCallback((nextLogin: LoginResponse | null, nextDatos: DatosLogin | null, nextUser: User | null, emergencyId: number | null) => {
    if (nextLogin?.token) localStorage.setItem(TOKEN_KEY, String(nextLogin.token));
    const userId = nextLogin?.userId || nextLogin?.usuario_id || nextLogin?.id || nextDatos?.usuario_id;
    if (userId) localStorage.setItem(USER_ID_KEY, String(userId));
    if (emergencyId) localStorage.setItem(EMERGENCY_KEY, String(emergencyId));
    localStorage.setItem(AUTH_KEY, JSON.stringify({
      loginResponse: nextLogin,
      datosLogin: nextDatos,
      user: nextUser,
      selectedEmergenciaId: emergencyId,
    }));
  }, []);

  const authFetch = useCallback(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const token = loginResponse?.token || localStorage.getItem(TOKEN_KEY);
    const headers = new Headers(init.headers);
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
    // El navegador debe generar el boundary cuando el cuerpo es multipart/form-data.
    // Forzar application/json impide que Flask pueda leer request.files.
    if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    return fetch(input, { ...init, headers });
  }, [loginResponse?.token]);

  const setSelectedEmergenciaId = useCallback((id: number | null) => {
    setSelectedEmergenciaIdState(id);
    if (id) localStorage.setItem(EMERGENCY_KEY, String(id));
    else localStorage.removeItem(EMERGENCY_KEY);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const loginRes = await fetch(`${API_BASE_URL}/usuarios/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: username, clave: password }),
      });
      if (!loginRes.ok) throw new Error('Credenciales inválidas');

      const nextLogin = await parseJsonSafe<LoginResponse>(loginRes);
      if (!nextLogin.token) throw new Error('El servidor no devolvio un token de autenticacion valido.');
      const userId = nextLogin.userId || nextLogin.usuario_id || nextLogin.id;
      const datosRes = userId
        ? await fetch(`${API_BASE_URL}/usuarios/${userId}/datos-login`, {
            headers: nextLogin.token ? { Authorization: `Bearer ${nextLogin.token}` } : undefined,
          })
        : null;
      const nextDatos = datosRes?.ok ? await parseJsonSafe<DatosLogin>(datosRes) : {};
      const mergedDatos = { ...nextDatos, correo: nextDatos.correo || nextDatos.email || username };
      const nextUser = buildUser(mergedDatos) || demoUser;
      const emergencyId = Number(mergedDatos.emergencia_id || localStorage.getItem(EMERGENCY_KEY) || 0) || null;

      setLoginResponse(nextLogin);
      setDatosLogin(mergedDatos);
      setUser(nextUser);
      setSelectedEmergenciaIdState(emergencyId);
      persist(nextLogin, mergedDatos, nextUser, emergencyId);
      return true;
    } catch {
      return false;
    }
  }, [persist]);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem(EMERGENCY_KEY);
    setLoginResponse(null);
    setDatosLogin(null);
    setUser(null);
    setSelectedEmergenciaIdState(null);
  }, []);

  const getUnreadNotifications = useCallback(async () => {
    const response = await authFetch(`${API_BASE_URL}/notificaciones/no-leidas`);
    if (!response.ok) return [];
    return parseJsonSafe<unknown[]>(response);
  }, [authFetch]);

  const getAccionesRespuestasPendientes = useCallback(async () => {
    const coeId = datosLogin?.coe_id || 0;
    const mesaId = datosLogin?.mesa_id || datosLogin?.mesa_grupo_id || 0;
    const emergencyId = selectedEmergenciaIdState || datosLogin?.emergencia_id || 0;
    const response = await authFetch(`${API_BASE_URL}/acciones_respuesta/pendientes/coe/${coeId}/mesa/${mesaId}/emergencia/${emergencyId}`);
    if (!response.ok) return [];
    return parseJsonSafe<unknown[]>(response);
  }, [authFetch, datosLogin?.coe_id, datosLogin?.emergencia_id, datosLogin?.mesa_grupo_id, datosLogin?.mesa_id, selectedEmergenciaIdState]);

  const markNotificationAsRead = useCallback(async (id: number) => {
    await authFetch(`${API_BASE_URL}/notificaciones/${id}/leer`, { method: 'PUT' });
  }, [authFetch]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loginResponse,
    datosLogin,
    selectedEmergenciaId: selectedEmergenciaIdState,
    setSelectedEmergenciaId,
    authFetch,
    login,
    logout,
    getUnreadNotifications,
    getAccionesRespuestasPendientes,
    markNotificationAsRead,
  }), [
    user,
    loginResponse,
    datosLogin,
    selectedEmergenciaIdState,
    setSelectedEmergenciaId,
    authFetch,
    login,
    logout,
    getUnreadNotifications,
    getAccionesRespuestasPendientes,
    markNotificationAsRead,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe utilizarse dentro de AuthProvider');
  return value;
}
