import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, CircleAlert, CloudRain, Mountain, Sun, Waves, type LucideIcon } from 'lucide-react';
import { useAuth, type EmergencyItem } from '../context/AuthContext';

const normalizeIdentifier = (identificador: unknown) =>
  String(identificador || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const isEnosIcon = (identificador: unknown) => {
  const key = normalizeIdentifier(identificador);
  return key.includes('enos') || key.includes('nino') || key.includes('nina');
};

const isElNino2026Icon = (identificador: unknown) => {
  const key = normalizeIdentifier(identificador);
  return key.includes('nino') && key.includes('2026');
};

const iconFor = (identificador: unknown): LucideIcon => {
  const key = normalizeIdentifier(identificador);
  if (key.includes('sismo') || key.includes('terrem')) return Activity;
  if (key.includes('erup') || key.includes('volcan')) return Mountain;
  if (isElNino2026Icon(identificador) || isEnosIcon(identificador)) return Sun;
  if (key.includes('lluv') || key.includes('invern') || key.includes('inun')) return CloudRain;
  if (key.includes('tsuna') || key.includes('tsunami')) return Waves;
  return CircleAlert;
};

const iconForbk = (identificador: unknown) => {
  const key = normalizeIdentifier(identificador);
  if (key.includes('sismo') || key.includes('terrem')) return 'linear-gradient(to top, #f0f0f0, #ff7d7d)';
  if (key.includes('erup') || key.includes('volcan')) return 'linear-gradient(to top, #f0f0f0, #735fc1)';
  if (isElNino2026Icon(identificador)) return 'linear-gradient(to top, #f0f0f0, #39c5bb)';
  if (isEnosIcon(identificador)) return 'linear-gradient(to top, #f0f0f0, #39c5bb)';
  if (key.includes('lluv') || key.includes('invern') || key.includes('inun')) return 'linear-gradient(to top, #f0f0f0, #7db1ff)';
  if (key.includes('tsuna') || key.includes('tsunami')) return 'linear-gradient(to top, #f0f0f0, #42c6ff)';
  return 'linear-gradient(to top, #f0f0f0, #cccccc)';
};

const logoSource = (logo: string) => {
  const value = logo.trim();
  if (/^(https?:|data:|blob:)/i.test(value) || value.startsWith('/')) return value;
  return encodeURI(`/${value.replace(/^\.?\//, '').replace(/^public\//i, '')}`);
};

const EmergencySelection: React.FC = () => {
  const navigate = useNavigate();
  const { emergencias: items, selectEmergencia, refreshEmergencias, logout } = useAuth();
  const [failedLogos, setFailedLogos] = useState<Set<number>>(() => new Set());
  const [loading, setLoading] = useState(items.length === 0);
  const [error, setError] = useState('');

  const loadEmergencias = async () => {
    setLoading(true);
    setError('');
    try {
      await refreshEmergencias();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las emergencias activas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (items.length > 0) {
      setLoading(false);
      return;
    }
    void loadEmergencias();
    // La recarga solo se necesita al entrar sin un catalogo persistido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, refreshEmergencias]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleSelect = (item: EmergencyItem) => {
    const dashboardUrl = item.dashboard || item.dasbhoard || '';

    selectEmergencia(item);
    try {
      localStorage.setItem('selectedEmergenciaName', item.emergencia || '');
      if (dashboardUrl) {
        localStorage.setItem('selectedDashboardUrl', dashboardUrl);
        localStorage.setItem('selectedDashboardEmergenciaId', String(item.emergencia_id));
      } else {
        localStorage.removeItem('selectedDashboardUrl');
        localStorage.removeItem('selectedDashboardEmergenciaId');
      }
    } catch {}
    navigate('/');
  };

  return (
    <div className="emergency-selection">
      <div className="emergency-selection__heading">
        <span>Acceso al sistema</span>
        <h1>Selecciona una Proceso Electoral</h1>
      </div>

      {loading && <div className="emergency-selection__empty">Cargando procesos electorales...</div>}

      {!loading && !error && items.length > 0 && (
        <div className="emergency-selection__grid">
          {items.map((it) => (
            <button
              key={it.emergencia_id}
              onClick={() => handleSelect(it)}
              className="emergency-selection__card"
            >
              <div
                className="emergency-selection__visual"
                style={{
                  background: (iconForbk(it.identificador || it.emergencia || it.descripcion)),
                }}
              >
              {(() => {
                const identifier = it.identificador || it.emergencia || it.descripcion;
                if (it.logo && !failedLogos.has(it.emergencia_id)) {
                  return (
                    <img
                      src={logoSource(it.logo)}
                      alt={`Logo de ${it.emergencia}`}
                      className="emergency-selection__logo"
                      onError={() => setFailedLogos((current) => new Set(current).add(it.emergencia_id))}
                    />
                  );
                }
                const EmergencyIcon = iconFor(identifier);
                return <EmergencyIcon size={70} strokeWidth={1.6} aria-hidden="true" />;
              })()}
              </div>
              <strong className="emergency-selection__name">{it.emergencia}</strong>
            </button>
          ))}
        </div>
      )}

      {!loading && (error || items.length === 0) && (
        <div className="emergency-selection__empty">
          <strong>{error || 'No hay procesos electorales activos disponibles.'}</strong>
          <div className="emergency-selection__empty-actions">
            <button type="button" onClick={() => void loadEmergencias()}>Reintentar</button>
            <button type="button" className="emergency-selection__logout" onClick={handleLogout}>Cerrar sesión</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergencySelection;
