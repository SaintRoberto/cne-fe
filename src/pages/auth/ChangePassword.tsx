import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CneMark } from '../../components/brand/CneMark';
import { useAuth } from '../../context/AuthContext';

export function ChangePassword() {
  const { changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (new TextEncoder().encode(password).length > 72) {
      setError('La nueva contraseña no puede superar 72 bytes.');
      return;
    }
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      await changePassword(password);
      navigate('/seleccionar-emergencia', { replace: true });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'No se pudo actualizar la contraseña.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-visual">
        <div className="login-visual__glow login-visual__glow--one" />
        <div className="login-visual__glow login-visual__glow--two" />
        <div className="login-visual__content">
          <img className="login-visual__campaign-logo" src="/LOGOECUADOR.png" alt="Gobierno del Ecuador y Secretaría Nacional de Gestión de Riesgos" />
          <img className="login-visual__cne-logo" src="/cne-2.png" alt="Consejo Nacional Electoral" />
        </div>
        <div className="login-visual__footer"><ShieldCheck size={16} /><span>Acceso seguro para personal autorizado</span><span className="login-visual__version">v1.0.0</span></div>
      </section>
      <section className="login-panel">
        <div className="login-card change-password-card">
          <div className="login-card__mobile-brand"><CneMark /></div>
          <div className="login-card__system-heading">
            <p>Sistema de Monitoreo de Incidentes y Eventos Adversos en Procesos Electorales</p>
          </div>
          <div className="login-card__heading">
            <span className="section-kicker">Primer acceso</span>
            <h2>Crea tu contraseña</h2>
            <p>Reemplaza la contraseña temporal antes de continuar.</p>
          </div>
          {error ? <div className="form-error" role="alert">{error}</div> : null}
          <form onSubmit={submit} className="login-form">
            <label htmlFor="new-password">Nueva contraseña<span>*</span></label>
            <div className="input-wrap">
              <KeyRound size={17} className="input-icon" />
              <input id="new-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" minLength={8} required />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </div>
            <div className="label-row"><label htmlFor="confirm-password">Confirma la contraseña<span>*</span></label></div>
            <div className="input-wrap">
              <KeyRound size={17} className="input-icon" />
              <input id="confirm-password" type={showConfirmation ? 'text' : 'password'} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Repite la nueva contraseña" autoComplete="new-password" minLength={8} required />
              <button type="button" className="password-toggle" onClick={() => setShowConfirmation((value) => !value)} aria-label={showConfirmation ? 'Ocultar confirmación' : 'Mostrar confirmación'}>{showConfirmation ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </div>
            <button className="primary-button login-button" type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar y continuar'}{!loading ? <ArrowRight size={18} /> : null}</button>
            <button className="change-password-card__logout" type="button" onClick={logout} disabled={loading}>Cerrar sesión</button>
          </form>
          <div className="login-card__note"><span className="note-mark">i</span><p>El cambio se guarda directamente y no requiere correo ni código de verificación.</p></div>
        </div>
        <div className="login-panel__footer"><span>Consejo Nacional Electoral</span><span>Privacidad · Términos de uso</span></div>
      </section>
    </div>
  );
}
