import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../components/Persona";
import { ErrorCarga } from "../components/Estados";
import MarcoSocial from "../components/MarcoSocial";
import { useAviso } from "../components/Aviso";
import { useSesion } from "../hooks/Sesion";
import { actualizarMiPerfil, iniciarSesion, obtenerMiPerfil, registrarCuenta } from "../lib/api";

const NIVELES = [
  ["publico", "Público"],
  ["amigos", "Solo mis amistades"],
  ["privado", "Privado (solo yo)"],
];

function Acceso() {
  const { entrar } = useSesion();
  const id = useId();
  const [modo, setModo] = useState("ingresar");
  const [datos, setDatos] = useState({ username: "", password: "", nombre_visible: "" });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const poner = (k) => (e) => setDatos((d) => ({ ...d, [k]: e.target.value }));
  const registro = modo === "registrar";

  const enviar = async (evento) => {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const cuerpo = registro ? datos : { username: datos.username, password: datos.password };
      if (registro && !datos.nombre_visible.trim()) delete cuerpo.nombre_visible;
      entrar(await (registro ? registrarCuenta(cuerpo) : iniciarSesion(cuerpo)));
    } catch (e) {
      setError(e);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="detail-panel social-tarjeta">
      <h2 className="detail-panel__title">{registro ? "Crear cuenta de visitante" : "Ingresar"}</h2>
      <form className="formulario" onSubmit={enviar} noValidate>
        <div className="campo">
          <label htmlFor={`${id}-u`}>Usuario</label>
          <input id={`${id}-u`} type="text" autoComplete="username" value={datos.username} onChange={poner("username")} maxLength={30} required />
          {registro && <span className="formulario__nota">3 a 30 letras, números o guion bajo.</span>}
        </div>
        {registro && (
          <div className="campo">
            <label htmlFor={`${id}-n`}>Nombre visible (opcional)</label>
            <input id={`${id}-n`} type="text" value={datos.nombre_visible} onChange={poner("nombre_visible")} maxLength={40} />
          </div>
        )}
        <div className="campo">
          <label htmlFor={`${id}-p`}>Contraseña</label>
          <input id={`${id}-p`} type="password" autoComplete={registro ? "new-password" : "current-password"} value={datos.password} onChange={poner("password")} required />
          {registro && <span className="formulario__nota">Mínimo 8 caracteres, no demasiado común ni solo números. No pedimos correo.</span>}
        </div>
        {error && <ErrorCarga error={error} />}
        <div className="formulario__acciones">
          <button type="submit" className="cta-pill-btn" disabled={enviando || !datos.username || !datos.password}>
            {enviando ? "Enviando…" : registro ? "Crear cuenta" : "Ingresar"}
          </button>
          <button type="button" className="btn-text" onClick={() => { setModo(registro ? "ingresar" : "registrar"); setError(null); }}>
            {registro ? "Ya tengo cuenta" : "Crear una cuenta"}
          </button>
        </div>
      </form>
    </div>
  );
}

function MiPerfil() {
  const { perfil, actualizar, salir } = useSesion();
  const aviso = useAviso();
  const id = useId();
  const [form, setForm] = useState({
    nombre_visible: perfil.nombre_visible, biografia: perfil.biografia ?? "",
    privacidad_perfil: perfil.privacidad_perfil, privacidad_actividad: perfil.privacidad_actividad,
  });
  const [foto, setFoto] = useState(null);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const poner = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const guardar = async (evento) => {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      let cuerpo = form;
      if (foto) {
        cuerpo = new FormData();
        Object.entries(form).forEach(([k, v]) => cuerpo.append(k, v));
        cuerpo.append("foto", foto);
      }
      await actualizarMiPerfil(cuerpo);
      actualizar(await obtenerMiPerfil());
      setFoto(null);
      aviso("Perfil actualizado.");
    } catch (e) {
      setError(e);
    } finally {
      setEnviando(false);
    }
  };
  const quitarFoto = async () => {
    try {
      await actualizarMiPerfil({ foto: null });
      actualizar(await obtenerMiPerfil());
      aviso("Fotografía eliminada.");
    } catch (e) {
      setError(e);
    }
  };

  return (
    <div className="social-grid">
      <div className="detail-panel social-tarjeta">
        <h2 className="detail-panel__title">Mi perfil</h2>
        <div className="persona persona--grande">
          <Avatar persona={perfil} tamano={64} />
          <span className="persona__texto">
            <span className="persona__nombre">{perfil.nombre_visible}</span>
            <span className="persona__usuario">@{perfil.username}</span>
          </span>
        </div>
        <ul className="social__cifras" aria-label="Mi actividad">
          <li><strong>{perfil.puntos ?? 0}</strong> puntos</li>
          <li><strong>{perfil.visitas ?? 0}</strong> visitas declaradas</li>
          <li><strong>{perfil.valoraciones ?? 0}</strong> valoraciones</li>
          <li><strong>{perfil.amigos ?? 0}</strong> amistades</li>
        </ul>
        <h3 className="social__subtitulo">Mis logros</h3>
        {perfil.logros?.length ? (
          <ul className="logros">
            {perfil.logros.map((l) => (
              <li key={l.codigo} className="logro" title={l.condicion}><strong>{l.nombre}</strong><span>{l.condicion}</span></li>
            ))}
          </ul>
        ) : (
          <p className="formulario__nota">Aún no tienes logros. Se obtienen con acciones reales: <Link to="/ranking">ver condiciones</Link>.</p>
        )}
        <div className="formulario__acciones">
          <Link to="/amistades" className="btn-outline-pill">Mis amistades</Link>
          <Link to={`/perfiles/${perfil.username}`} className="btn-outline-pill">Ver mi perfil público</Link>
          <button type="button" className="btn-text" onClick={salir}>Cerrar sesión</button>
        </div>
      </div>

      <div className="detail-panel social-tarjeta">
        <h2 className="detail-panel__title">Editar perfil y privacidad</h2>
        <form className="formulario" onSubmit={guardar} noValidate>
          <div className="campo">
            <label htmlFor={`${id}-n`}>Nombre visible</label>
            <input id={`${id}-n`} type="text" maxLength={40} value={form.nombre_visible} onChange={poner("nombre_visible")} />
          </div>
          <div className="campo">
            <label htmlFor={`${id}-b`}>Biografía breve</label>
            <textarea id={`${id}-b`} rows={3} maxLength={280} value={form.biografia} onChange={poner("biografia")} />
            <span className="formulario__contador">{form.biografia.length} / 280</span>
          </div>
          <div className="campo">
            <label htmlFor={`${id}-f`}>Fotografía (JPG, PNG o WEBP, hasta 2 MB)</label>
            <input id={`${id}-f`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
            {perfil.foto && <button type="button" className="btn-text" onClick={quitarFoto}>Quitar mi fotografía</button>}
          </div>
          <div className="campo">
            <label htmlFor={`${id}-pp`}>¿Quién puede ver mi perfil?</label>
            <select id={`${id}-pp`} value={form.privacidad_perfil} onChange={poner("privacidad_perfil")}>
              {NIVELES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor={`${id}-pa`}>¿Quién puede ver mi actividad?</label>
            <select id={`${id}-pa`} value={form.privacidad_actividad} onChange={poner("privacidad_actividad")}>
              {NIVELES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </div>
          <p className="formulario__nota">Solo los perfiles públicos aparecen en la búsqueda y en el ranking. Tus comentarios en una ficha muestran tu nombre únicamente si tu perfil es público (o si eres amistad de quien los lee y tu perfil es «solo amistades»).</p>
          {error && <ErrorCarga error={error} />}
          <button type="submit" className="cta-pill-btn" disabled={enviando}>{enviando ? "Guardando…" : "Guardar cambios"}</button>
        </form>
      </div>
    </div>
  );
}

export default function Cuenta() {
  const { perfil, listo } = useSesion();
  return (
    <MarcoSocial
      activa="cuenta" kicker="TU ESPACIO · COMUNIDAD PACEÑO" titulo={perfil ? "Mi cuenta" : "Ingresa a Paceño"}
      descripcion="Con una cuenta puedes valorar y comentar bienes, marcar los que visitaste, sumar logros y conectar con otras personas. Explorar el catálogo no requiere cuenta."
    >
      {!listo ? <p className="estado estado--cargando" role="status">Cargando…</p> : perfil ? <MiPerfil /> : <Acceso />}
    </MarcoSocial>
  );
}
