import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { CneMark } from '../../components/brand/CneMark';
import { useAuth } from '../../context/AuthContext';

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const ok = await login(username, password);
    if (ok) navigate('/');
    else setError('No fue posible autenticarte. Verifica tu usuario y contrasena e intenta nuevamente.');
    setLoading(false);
  }

  return (
    <div className="login-page">
      <section className="login-visual">
        <div className="login-visual__glow login-visual__glow--one" />
        <div className="login-visual__glow login-visual__glow--two" />
        <div className="login-visual__content">
          <img className="login-visual__campaign-logo" src="/elecciones-seccionales-2027.png" alt="Elecciones Seccionales y CPCCS 2027: Tu voto, tu decisión" />
        </div>
        <div className="login-visual__footer"><ShieldCheck size={16} /><span>Acceso seguro para personal autorizado</span><span className="login-visual__version">v1.0.0</span></div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="login-card__mobile-brand"><CneMark /></div>
          <div className="login-card__heading"><span className="section-kicker">Bienvenido/a</span><h2>Ingresa a tu cuenta</h2><p>Usa tus credenciales institucionales para continuar.</p></div>
          {error ? <div className="form-error" role="alert">{error}</div> : null}
          <form onSubmit={submit} className="login-form">
            <label htmlFor="username">Nombre de usuario<span>*</span></label>
            <div className="input-wrap"><span className="input-prefix">@</span><input id="username" type="text" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Ingresa tu usuario" autoComplete="username" required /></div>
            <div className="label-row"><label htmlFor="password">Contrasena<span>*</span></label><a href="#recuperar">Olvidaste tu contrasena?</a></div>
            <div className="input-wrap"><LockKeyhole size={17} className="input-icon" /><input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Ingresa tu contrasena" autoComplete="current-password" required /><button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
            <button className="primary-button login-button" type="submit" disabled={loading}>{loading ? 'Validando acceso...' : 'Iniciar sesion'}{!loading ? <ArrowRight size={18} /> : null}</button>
          </form>
          <div className="login-card__note"><span className="note-mark">i</span><p>Si tienes problemas para ingresar, contacta a la mesa de ayuda institucional.</p></div>
        </div>
        <div className="login-panel__footer"><span>Consejo Nacional Electoral</span><span>Privacidad · Terminos de uso</span></div>
      </section>
    </div>
  );
}
