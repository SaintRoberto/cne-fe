import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { API_BASE_URL } from '../config/env';
import type { User } from '../types';

export type LoginResponse = {
  token?: string;
  userId?: number;
  usuario_id?: number;
  id?: number;
  usuario?: Record<string, unknown> & { debe_cambiar_clave?: boolean };
  [key: string]: unknown;
};

export type DatosLogin = {
  usuario_id?: number;
  institucion_id?: number;
  usuario_institucion_id?: number;
  usuario_descripcion?: string;
  usuario_login?: string;
  perfil_id?: number;
  perfil_nombre?: string;
  coe_id?: number;
  coe_nombre?: string;
  coe_abreviatura?: string;
  mesa_id?: number;
  mesa_grupo_id?: number;
  mesa_grupo_nombre?: string;
  mesa_nombre?: string;
  mesa_siglas?: string;
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

export type EmergencyItem = {
  emergencia_id: number;
  emergencia: string;
  ambito?: string;
  descripcion?: string;
  identificador?: string | null;
  usuario?: string;
  dashboard?: string | null;
  dasbhoard?: string | null;
  logo?: string | null;
  [key: string]: unknown;
};

type AuthContextValue = {
  user: User | null;
  loginResponse: LoginResponse | null;
  datosLogin: DatosLogin | null;
  emergencias: EmergencyItem[];
  selectedEmergencia: EmergencyItem | null;
  selectedEmergenciaId: number | null;
  mustChangePassword: boolean;
  selectEmergencia: (emergencia: EmergencyItem) => void;
  setSelectedEmergenciaId: (id: number | null) => void;
  refreshEmergencias: () => Promise<EmergencyItem[]>;
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  login: (username: string, password: string) => Promise<{ mustChangePassword: boolean } | null>;
  changePassword: (newPassword: string) => Promise<void>;
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
const SELECTED_EMERGENCY_KEY = 'selectedEmergencia';

const demoDatosLogin: DatosLogin = {
  usuario_id: 1,
  institucion_id: 1,
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
  const cleanText = (value: unknown) => String(value || '').trim();
  const meaningfulText = (value: unknown) => {
    const text = cleanText(value);
    return text && text !== '--' ? text : '';
  };
  const fullName = `${meaningfulText(datos.nombres)} ${meaningfulText(datos.apellidos)}`.trim()
    || meaningfulText(datos.usuario_descripcion)
    || meaningfulText(datos.usuario_login);
  const coe = meaningfulText(datos.coe_abreviatura) || meaningfulText(datos.coe_nombre) || 'COE';
  const provinceOrCanton = meaningfulText(datos.canton_nombre) || meaningfulText(datos.provincia_nombre);
  const mesa = meaningfulText(datos.mesa_nombre) || meaningfulText(datos.mesa_grupo_nombre);
  const label = [coe, provinceOrCanton, mesa].filter(Boolean).join(' ');
  return {
    name: fullName || label,
    role: meaningfulText(datos.perfil_nombre) || label,
    email: String(datos.correo || datos.email || ''),
    initials: (fullName || label).split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(),
  };
}

function readStoredAuth() {
  try {
    const stored = localStorage.getItem(AUTH_KEY);
    if (!stored) return { loginResponse: null, datosLogin: null, user: null, emergencias: [], selectedEmergencia: null, selectedEmergenciaId: null };
    const parsed = JSON.parse(stored) as {
      loginResponse: LoginResponse | null;
      datosLogin: DatosLogin | null;
      user: User | null;
      emergencias?: EmergencyItem[];
      selectedEmergencia?: EmergencyItem | null;
      selectedEmergenciaId: number | null;
    };
    const selected = Number(localStorage.getItem(EMERGENCY_KEY) || parsed.selectedEmergenciaId || parsed.selectedEmergencia?.emergencia_id || 0);
    const emergencias = Array.isArray(parsed.emergencias) ? parsed.emergencias : [];
    const storedEmergency = localStorage.getItem(SELECTED_EMERGENCY_KEY);
    const selectedEmergencia = (storedEmergency ? JSON.parse(storedEmergency) as EmergencyItem : parsed.selectedEmergencia)
      || emergencias.find((item) => item.emergencia_id === selected)
      || null;
    return { ...parsed, emergencias, selectedEmergencia, selectedEmergenciaId: selected || null };
  } catch {
    return { loginResponse: null, datosLogin: null, user: null, emergencias: [], selectedEmergencia: null, selectedEmergenciaId: null };
  }
}

async function parseJsonSafe<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? JSON.parse(text) as T : ({} as T);
}

function datosLoginRows(payload: unknown): DatosLogin[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is DatosLogin => Boolean(item) && typeof item === 'object');
  }
  if (!payload || typeof payload !== 'object') return [];

  const record = payload as Record<string, unknown>;
  const collectionKeys = ['emergencias', 'datos_login', 'datosLogin', 'data', 'resultados', 'items'];
  for (const key of collectionKeys) {
    const collection = record[key];
    if (!Array.isArray(collection)) continue;
    const base = Object.fromEntries(Object.entries(record).filter(([entryKey]) => entryKey !== key));
    return collection
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item) => ({ ...base, ...item } as DatosLogin));
  }

  return [record as DatosLogin];
}

function emergencyFromRow(row: DatosLogin): EmergencyItem | null {
  const id = Number(row.emergencia_id || row.id || 0);
  if (!id) return null;
  return {
    ...row,
    emergencia_id: id,
    emergencia: String(row.emergencia || row.descripcion || row.nombre || `Emergencia ${id}`),
  } as EmergencyItem;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = readStoredAuth();
  const [loginResponse, setLoginResponse] = useState<LoginResponse | null>(stored.loginResponse);
  const [datosLogin, setDatosLogin] = useState<DatosLogin | null>(stored.datosLogin);
  const [user, setUser] = useState<User | null>(stored.user || buildUser(stored.datosLogin));
  const [emergencias, setEmergencias] = useState<EmergencyItem[]>(stored.emergencias);
  const [selectedEmergencia, setSelectedEmergencia] = useState<EmergencyItem | null>(stored.selectedEmergencia);
  const [selectedEmergenciaIdState, setSelectedEmergenciaIdState] = useState<number | null>(stored.selectedEmergenciaId);
  const mustChangePassword = Boolean(loginResponse?.usuario?.debe_cambiar_clave);

  const persist = useCallback((nextLogin: LoginResponse | null, nextDatos: DatosLogin | null, nextUser: User | null, availableEmergencies: EmergencyItem[], emergency: EmergencyItem | null) => {
    if (nextLogin?.token) localStorage.setItem(TOKEN_KEY, String(nextLogin.token));
    const userId = nextLogin?.userId || nextLogin?.usuario_id || nextLogin?.id || nextDatos?.usuario_id;
    if (userId) localStorage.setItem(USER_ID_KEY, String(userId));
    if (emergency) {
      localStorage.setItem(EMERGENCY_KEY, String(emergency.emergencia_id));
      localStorage.setItem(SELECTED_EMERGENCY_KEY, JSON.stringify(emergency));
    } else {
      localStorage.removeItem(EMERGENCY_KEY);
      localStorage.removeItem(SELECTED_EMERGENCY_KEY);
    }
    localStorage.setItem(AUTH_KEY, JSON.stringify({
      loginResponse: nextLogin,
      datosLogin: nextDatos,
      user: nextUser,
      emergencias: availableEmergencies,
      selectedEmergencia: emergency,
      selectedEmergenciaId: emergency?.emergencia_id || null,
    }));
  }, []);

  const authFetch = useCallback(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const token = loginResponse?.token || localStorage.getItem(TOKEN_KEY);
    const method = String(init.method || 'GET').toUpperCase();
    const isBodylessMethod = method === 'GET' || method === 'HEAD';
    const headers = new Headers(init.headers);
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
    // El navegador debe generar el boundary cuando el cuerpo es multipart/form-data.
    // Forzar application/json impide que Flask pueda leer request.files.
    if (isBodylessMethod) headers.delete('Content-Type');
    if (!isBodylessMethod && !headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    const requestInit = isBodylessMethod ? { ...init, method, body: undefined } : { ...init, method };
    return fetch(input, { ...requestInit, headers });
  }, [loginResponse?.token]);

  const refreshEmergencias = useCallback(async () => {
    const response = await authFetch(`${API_BASE_URL}/emergencias`);
    if (!response.ok) throw new Error('No se pudieron cargar las emergencias activas.');
    const payload = await parseJsonSafe<unknown>(response);
    const availableEmergencies = datosLoginRows(payload)
      .map(emergencyFromRow)
      .filter((item): item is EmergencyItem => item !== null)
      .filter((item) => ![false, 0, '0', 'false'].includes(item.activo as false | 0 | '0' | 'false'))
      .filter((item, index, items) => items.findIndex((candidate) => candidate.emergencia_id === item.emergencia_id) === index);
    setEmergencias(availableEmergencies);
    persist(loginResponse, datosLogin, user, availableEmergencies, selectedEmergencia);
    return availableEmergencies;
  }, [authFetch, datosLogin, loginResponse, persist, selectedEmergencia, user]);

  const selectEmergencia = useCallback((emergency: EmergencyItem) => {
    const nextDatos = { ...datosLogin, ...emergency, emergencia_id: emergency.emergencia_id } as DatosLogin;
    setDatosLogin(nextDatos);
    setSelectedEmergencia(emergency);
    setSelectedEmergenciaIdState(emergency.emergencia_id);
    persist(loginResponse, nextDatos, user, emergencias, emergency);
  }, [datosLogin, emergencias, loginResponse, persist, user]);

  const setSelectedEmergenciaId = useCallback((id: number | null) => {
    if (!id) {
      setSelectedEmergencia(null);
      setSelectedEmergenciaIdState(null);
      persist(loginResponse, datosLogin, user, emergencias, null);
      return;
    }
    const emergency = emergencias.find((item) => item.emergencia_id === id);
    if (emergency) selectEmergencia(emergency);
  }, [datosLogin, emergencias, loginResponse, persist, selectEmergencia, user]);

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
      const loginUsuario = nextLogin.usuario as DatosLogin | undefined;
      const { token: _token, usuario: _usuario, ...loginDatos } = nextLogin;
      const userId = loginUsuario?.usuario_id
        || loginUsuario?.id
        || nextLogin.usuario_id
        || nextLogin.userId
        || nextLogin.id;
      const datosRes = userId
        ? await fetch(`${API_BASE_URL}/usuarios/${userId}/datos-login`, {
            headers: nextLogin.token ? { Authorization: `Bearer ${nextLogin.token}` } : undefined,
          })
        : null;
      if (!datosRes) throw new Error('No se pudo identificar al usuario autenticado.');
      if (!datosRes.ok) throw new Error('No se pudieron cargar los datos del usuario.');
      const datosPayload = datosRes?.ok ? await parseJsonSafe<unknown>(datosRes) : {};
      const loginRows = datosLoginRows(datosPayload);
      const emergenciesRes = await fetch(`${API_BASE_URL}/emergencias`, {
        headers: { Authorization: `Bearer ${nextLogin.token}` },
      });
      if (!emergenciesRes.ok) throw new Error('No se pudieron cargar las emergencias activas.');
      const emergenciesPayload = await parseJsonSafe<unknown>(emergenciesRes);
      const availableEmergencies = datosLoginRows(emergenciesPayload)
        .map(emergencyFromRow)
        .filter((item): item is EmergencyItem => item !== null)
        .filter((item) => ![false, 0, '0', 'false'].includes(item.activo as false | 0 | '0' | 'false'))
        .filter((item, index, items) => items.findIndex((candidate) => candidate.emergencia_id === item.emergencia_id) === index);
      const nextDatos = { ...loginDatos, ...loginUsuario, ...(loginRows[0] || {}) } as DatosLogin;
      const mergedDatos = { ...loginUsuario, ...nextDatos, correo: nextDatos.correo || loginUsuario?.correo || nextDatos.email || loginUsuario?.email || username };
      const nextUser = buildUser(mergedDatos) || demoUser;

      setLoginResponse(nextLogin);
      setDatosLogin(mergedDatos);
      setUser(nextUser);
      setEmergencias(availableEmergencies);
      setSelectedEmergencia(null);
      setSelectedEmergenciaIdState(null);
      persist(nextLogin, mergedDatos, nextUser, availableEmergencies, null);
      return { mustChangePassword: Boolean(loginUsuario?.debe_cambiar_clave) };
    } catch {
      return null;
    }
  }, [persist]);

  const changePassword = useCallback(async (newPassword: string) => {
    const response = await authFetch(`${API_BASE_URL}/usuarios/cambiar-clave`, {
      method: 'POST',
      body: JSON.stringify({ nueva_clave: newPassword }),
    });
    const payload = await parseJsonSafe<{ error?: string }>(response);
    if (!response.ok) throw new Error(payload.error || 'No se pudo actualizar la contraseña.');

    const nextLogin = loginResponse
      ? { ...loginResponse, usuario: { ...(loginResponse.usuario || {}), debe_cambiar_clave: false } }
      : null;
    const nextDatos = datosLogin ? { ...datosLogin, debe_cambiar_clave: false } : null;
    setLoginResponse(nextLogin);
    setDatosLogin(nextDatos);
    persist(nextLogin, nextDatos, user, emergencias, selectedEmergencia);
  }, [authFetch, datosLogin, emergencias, loginResponse, persist, selectedEmergencia, user]);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem(EMERGENCY_KEY);
    localStorage.removeItem(SELECTED_EMERGENCY_KEY);
    localStorage.removeItem('selectedEmergenciaName');
    localStorage.removeItem('selectedDashboardUrl');
    localStorage.removeItem('selectedDashboardEmergenciaId');
    setLoginResponse(null);
    setDatosLogin(null);
    setUser(null);
    setEmergencias([]);
    setSelectedEmergencia(null);
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
    emergencias,
    selectedEmergencia,
    selectedEmergenciaId: selectedEmergenciaIdState,
    mustChangePassword,
    selectEmergencia,
    setSelectedEmergenciaId,
    refreshEmergencias,
    authFetch,
    login,
    changePassword,
    logout,
    getUnreadNotifications,
    getAccionesRespuestasPendientes,
    markNotificationAsRead,
  }), [
    user,
    loginResponse,
    datosLogin,
    emergencias,
    selectedEmergencia,
    selectedEmergenciaIdState,
    mustChangePassword,
    selectEmergencia,
    setSelectedEmergenciaId,
    refreshEmergencias,
    authFetch,
    login,
    changePassword,
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
