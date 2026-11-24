import { Camera, Edit3, Lock, LogIn, LogOut, Smile, User, Users } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../components/Persona";
import { ErrorCarga } from "../components/Estados";
import Foto from "../components/Foto";
import Marco from "../components/Marco";
import { PatitoDoodle, TotemVoxel } from "../components/Stickers";
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
    <div className="account-login editorial-card animate-scale-in">
      <span className="account-label">Acceso Editorial</span>
      <h2 className="account-login__title">{registro ? "Crear cuenta de visitante" : "Bienvenido de vuelta"}</h2>
      <p className="account-login__texto">{registro ? "Sin correo: solo un usuario y una contraseña." : "Ingresa para valorar, comentar y sumar logros."}</p>
      <form className="formulario account-form" onSubmit={enviar} noValidate>
        <div className="campo">
          <label htmlFor={`${id}-u`}>Usuario</label>
          <span className="account-input">
            <User aria-hidden="true" />
            <input id={`${id}-u`} type="text" autoComplete="username" value={datos.username} onChange={poner("username")} maxLength={30} required />
          </span>
          {registro && <span className="formulario__nota">3 a 30 letras, números o guion bajo.</span>}
        </div>
        {registro && (
          <div className="campo">
            <label htmlFor={`${id}-n`}>Nombre visible (opcional)</label>
            <span className="account-input">
              <Smile aria-hidden="true" />
              <input id={`${id}-n`} type="text" value={datos.nombre_visible} onChange={poner("nombre_visible")} maxLength={40} />
            </span>
          </div>
        )}
        <div className="campo">
          <label htmlFor={`${id}-p`}>Contraseña</label>
          <span className="account-input">
            <Lock aria-hidden="true" />
            <input id={`${id}-p`} type="password" autoComplete={registro ? "new-password" : "current-password"} value={datos.password} onChange={poner("password")} required />
          </span>
          {registro && <span className="formulario__nota">Mínimo 8 caracteres, no demasiado común ni solo números. No pedimos correo.</span>}
        </div>
        {error && <ErrorCarga error={error} />}
        <div className="formulario__acciones account-login__acciones">
          <button type="submit" className="cta-pill-btn" disabled={enviando || !datos.username || !datos.password}>
            <LogIn aria-hidden="true" />
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

  const refFormulario = useRef(null);
  const refFoto = useRef(null);
  const irAlFormulario = (enfocar) => {
    refFormulario.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => enfocar?.current?.focus({ preventScroll: true }), 350);
  };
  const logros = perfil.logros ?? [];

  return (
    <>
      <section className="account-profile editorial-card" aria-label="Mi perfil">
        <div className="account-profile__cover">
          <Foto as="div" tono="neutral" className="account-cover slot--none" etiqueta="Portada personal" pista="Espacio reservado para imagen de cabecera" />
          <button type="button" className="account-pill account-pill--glass" onClick={() => irAlFormulario(refFoto)}>
            <Camera aria-hidden="true" />
            Cambiar fotografía
          </button>
        </div>

        <div className="account-profile__body">
          <div className="account-profile__id">
            <div className="account-profile__who">
              <div className="account-avatar">
                <Avatar persona={perfil} tamano={112} />
              </div>
              <div className="account-profile__name">
                <div className="account-profile__name-row">
                  <span className="account-dot" aria-hidden="true" />
                  <h2>{perfil.nombre_visible}</h2>
                </div>
                <p>@{perfil.username} · Visitante · La Paz</p>
              </div>
            </div>
            <div className="account-profile__actions">
              <button type="button" className="cta-pill-btn" onClick={() => irAlFormulario()}>
                <Edit3 aria-hidden="true" />
                Editar información
              </button>
              <Link to="/amistades" className="btn-outline-pill">
                <Users aria-hidden="true" />
                Mis amistades
              </Link>
              <Link to={`/perfiles/${perfil.username}`} className="btn-outline-pill">Ver mi perfil público</Link>
            </div>
          </div>

          <div className="account-profile__grid">
            <div className="account-bio">
              <span className="account-label">Nota biográfica</span>
              <p>{perfil.biografia?.trim() || "Aún no has escrito tu nota biográfica. Cuéntanos qué patrimonio te interesa."}</p>
              {logros.length > 0 && (
                <div className="account-chips">
                  {logros.map((l) => <span key={l.codigo} className="account-chip" title={l.condicion}>{l.nombre}</span>)}
                </div>
              )}
            </div>
            <div className="account-metrics-wrap">
              <ul className="account-metrics" aria-label="Mi actividad">
                <li><strong>{perfil.puntos ?? 0}</strong><span>puntos</span></li>
                <li><strong>{perfil.visitas ?? 0}</strong><span>visitas declaradas</span></li>
                <li><strong>{perfil.valoraciones ?? 0}</strong><span>valoraciones</span></li>
              </ul>
              <TotemVoxel className="account-totem" />
            </div>
          </div>
        </div>
      </section>

      <section className="account-board" aria-label="Mis logros">
        <div className="account-board__head">
          <div>
            <span className="account-label">Archivo privado</span>
            <h3>Mis logros</h3>
          </div>
          <Link to="/ranking" className="account-board__link">Ver condiciones</Link>
        </div>
        {logros.length ? (
          <ul className="logros account-board__grid">
            {logros.map((l, i) => (
              <li key={l.codigo} className="logro editorial-card" title={l.condicion}>
                <Foto as="div" tono={i % 2 === 0 ? "warm" : "sage"} className="account-logro__slot slot--lg" etiqueta={l.nombre} pista={l.condicion} />
                <div className="account-logro__pie"><span>/ {String(i + 1).padStart(2, "0")}</span><span>logro</span></div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="formulario__nota">Aún no tienes logros. Se obtienen con acciones reales: <Link to="/ranking">ver condiciones</Link>.</p>
        )}
        <div className="account-board__duck"><PatitoDoodle /></div>
      </section>

      <section className="account-edit editorial-card" ref={refFormulario} aria-label="Editar perfil y privacidad">
        <span className="account-label">Estudio personal</span>
        <h3 className="account-edit__title">Editar perfil y privacidad</h3>
        <form className="formulario account-form" onSubmit={guardar} noValidate>
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
            <input id={`${id}-f`} ref={refFoto} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
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
      </section>
    </>
  );
}

export default function Cuenta() {
  const { perfil, listo, salir } = useSesion();
  return (
    <Marco
      activa="cuenta"
      insignia="ESTUDIO PERSONAL · LA PAZ"
      notaMenu="Tu perfil, logros y privacidad"
      cta={{ descripcion: "Descubre el patrimonio del eje central y comparte tu experiencia.", texto: "+ Abrir mapa", a: "/explorar" }}
    >
      <div className="account-page animate-fade-in">
        <header className="account-head">
          <div>
            <span className="account-kicker">estudio personal</span>
            <h1>{perfil ? "Mi cuenta" : "Ingresa a Paceño"}</h1>
          </div>
          {perfil && (
            <button type="button" className="btn-outline-pill" onClick={salir}>
              <LogOut aria-hidden="true" />
              Cerrar sesión
            </button>
          )}
        </header>
        {!listo ? <p className="estado estado--cargando" role="status">Cargando…</p> : perfil ? <MiPerfil /> : <Acceso />}
      </div>
    </Marco>
  );
}
