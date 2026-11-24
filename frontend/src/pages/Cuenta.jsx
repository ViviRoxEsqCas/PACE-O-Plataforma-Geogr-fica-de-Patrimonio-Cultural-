import { Camera, Edit3, ImageOff, Lock, LogIn, LogOut, Smile, User, Users } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../components/Persona";
import { ErrorCarga } from "../components/Estados";
import Foto from "../components/Foto";
import ImagenLogro from "../components/ImagenLogro";
import SelectorArchivo from "../components/SelectorArchivo";
import Marco from "../components/Marco";
import { PatitoDoodle, TotemVoxel } from "../components/Stickers";
import { useAviso } from "../components/Aviso";
import { useSesion } from "../hooks/Sesion";
import { actualizarMiPerfil, iniciarSesion, obtenerMiPerfil, registrarCuenta, urlRecurso } from "../lib/api";

const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp"];
const ACEPTAR_IMAGEN = TIPOS_IMAGEN.join(",");
const FOTO_MAX = 2 * 1024 * 1024;
const BANNER_MAX = 3 * 1024 * 1024;
const BANNER_ANCHO_MIN = 600;

/** Revisa en el navegador lo mismo que valida el servidor, para avisar antes de subir. Devuelve un mensaje o null. */
async function revisarImagen(archivo, { maxBytes, etiqueta, anchoMinimo }) {
  if (!TIPOS_IMAGEN.includes(archivo.type)) return "Use una imagen JPG, PNG o WEBP.";
  if (archivo.size > maxBytes) return `${etiqueta} no puede superar los ${maxBytes / 1024 / 1024} MB.`;
  if (!anchoMinimo) return null;
  const url = URL.createObjectURL(archivo);
  try {
    const ancho = await new Promise((resolver, rechazar) => {
      const img = new Image();
      img.onload = () => resolver(img.naturalWidth);
      img.onerror = () => rechazar(new Error("no es imagen"));
      img.src = url;
    });
    return ancho < anchoMinimo ? `${etiqueta} debe tener al menos ${anchoMinimo} px de ancho.` : null;
  } catch {
    return "El archivo no es una imagen válida.";
  } finally {
    URL.revokeObjectURL(url);
  }
}

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

/** Banner del perfil: subir, reemplazar y eliminar. La elección se previsualiza y solo se guarda al confirmar. */
function EditorBanner({ perfil, referencia }) {
  const { actualizar } = useSesion();
  const aviso = useAviso();
  const id = useId();
  const [archivo, setArchivo] = useState(null);
  const [aviso_error, setAvisoError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const elegir = async (nuevo) => {
    setAvisoError(null);
    if (!nuevo) return setArchivo(null);
    const problema = await revisarImagen(nuevo, { maxBytes: BANNER_MAX, etiqueta: "El banner", anchoMinimo: BANNER_ANCHO_MIN });
    if (problema) return setAvisoError(problema);
    return setArchivo(nuevo);
  };
  const guardar = async () => {
    setOcupado(true);
    setAvisoError(null);
    try {
      const cuerpo = new FormData();
      cuerpo.append("banner", archivo);
      await actualizarMiPerfil(cuerpo);
      actualizar(await obtenerMiPerfil());
      setArchivo(null);
      aviso(perfil.banner ? "Banner actualizado." : "Banner guardado.");
    } catch (e) {
      setAvisoError(e?.message ?? "No se pudo guardar el banner.");
    } finally {
      setOcupado(false);
    }
  };
  const quitar = async () => {
    setOcupado(true);
    setAvisoError(null);
    try {
      await actualizarMiPerfil({ banner: null });
      actualizar(await obtenerMiPerfil());
      setArchivo(null);
      aviso("Banner eliminado.");
    } catch (e) {
      setAvisoError(e?.message ?? "No se pudo eliminar el banner.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <section className="account-edit account-banner editorial-card" ref={referencia} aria-label="Banner del perfil">
      <span className="account-label">Portada personal</span>
      <h3 className="account-edit__title">Banner del perfil</h3>
      <p className="formulario__nota">Es la imagen ancha que se ve arriba en tu perfil y en tu perfil público. Mínimo {BANNER_ANCHO_MIN} px de ancho; se recorta en proporción 21:6.</p>
      <label htmlFor={id} className="account-banner__label">Imagen del banner (JPG, PNG o WEBP, hasta 3 MB)</label>
      <SelectorArchivo id={id} forma="banner" accept={ACEPTAR_IMAGEN} archivo={archivo} actual={perfil.banner ? urlRecurso(perfil.banner) : null} onChange={elegir} titulo={perfil.banner ? "Cambiar banner" : "Subir banner"} deshabilitado={ocupado} />
      {aviso_error && <p className="estado estado--error" role="alert">{aviso_error}</p>}
      <div className="formulario__acciones">
        {archivo && (
          <>
            <button type="button" className="cta-pill-btn" onClick={guardar} disabled={ocupado}>{ocupado ? "Guardando…" : perfil.banner ? "Guardar cambio de banner" : "Guardar banner"}</button>
            <button type="button" className="btn-text" onClick={() => elegir(null)} disabled={ocupado}>Descartar</button>
          </>
        )}
        {!archivo && perfil.banner && (
          <button type="button" className="btn-outline-pill" onClick={quitar} disabled={ocupado}>
            <ImageOff aria-hidden="true" />
            Eliminar banner
          </button>
        )}
      </div>
    </section>
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
  const refBanner = useRef(null);
  const [errorFoto, setErrorFoto] = useState(null);
  const irAlFormulario = (idCampo) => {
    refFormulario.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (idCampo) window.setTimeout(() => document.getElementById(idCampo)?.focus({ preventScroll: true }), 350);
  };
  const irAlBanner = () => refBanner.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const logros = perfil.logros ?? [];
  const pendientes = perfil.logros_pendientes ?? [];
  const elegirFoto = async (nueva) => {
    setErrorFoto(null);
    if (!nueva) return setFoto(null);
    const problema = await revisarImagen(nueva, { maxBytes: FOTO_MAX, etiqueta: "La fotografía" });
    if (problema) return setErrorFoto(problema);
    return setFoto(nueva);
  };

  return (
    <>
      <section className="account-profile editorial-card" aria-label="Mi perfil">
        <div className="account-profile__cover">
          <Foto as="div" tono="neutral" className="account-cover slot--none" src={perfil.banner} alt="" etiqueta="Portada personal" pista="Sube tu banner desde «Banner del perfil»" />
          <div className="account-pill-row">
            <button type="button" className="account-pill account-pill--glass" onClick={irAlBanner}>
              <Camera aria-hidden="true" />
              {perfil.banner ? "Editar banner" : "Subir banner"}
            </button>
            <button type="button" className="account-pill account-pill--glass" onClick={() => irAlFormulario(`${id}-f`)}>
              <Camera aria-hidden="true" />
              Cambiar fotografía
            </button>
          </div>
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
        {logros.length === 0 && <p className="formulario__nota">Aún no tienes logros. Se obtienen con acciones reales: <Link to="/ranking">ver condiciones</Link>.</p>}
        <ul className="logros account-board__grid">
          {logros.map((l, i) => (
            <li key={l.codigo} className="logro editorial-card" title={l.condicion}>
              <ImagenLogro logro={l} tono={i % 2 === 0 ? "warm" : "sage"} className="account-logro__slot slot--lg" mostrarNombre={false} />
              <div className="account-logro__texto"><strong>{l.nombre}</strong><span>{l.condicion}</span></div>
              <div className="account-logro__pie"><span>/ {String(i + 1).padStart(2, "0")}</span><span>obtenido</span></div>
            </li>
          ))}
          {pendientes.map((l, i) => (
            <li key={l.codigo} className="logro logro--pendiente editorial-card" title={l.condicion}>
              <ImagenLogro logro={l} tono="neutral" bloqueado className="account-logro__slot slot--lg" mostrarNombre={false} />
              <div className="account-logro__texto"><strong>{l.nombre}</strong><span>{l.condicion}</span></div>
              <div className="account-logro__pie"><span>/ {String(logros.length + i + 1).padStart(2, "0")}</span><span>por lograr</span></div>
            </li>
          ))}
        </ul>
        <div className="account-board__duck"><PatitoDoodle /></div>
      </section>

      <EditorBanner perfil={perfil} referencia={refBanner} />

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
            <SelectorArchivo id={`${id}-f`} forma="circulo" accept={ACEPTAR_IMAGEN} archivo={foto} actual={perfil.foto ? urlRecurso(perfil.foto) : null} onChange={elegirFoto} titulo={perfil.foto ? "Cambiar fotografía" : "Elegir fotografía"} deshabilitado={enviando} />
            {errorFoto && <p className="estado estado--error" role="alert">{errorFoto}</p>}
            {foto && <span className="formulario__nota">Se guardará al pulsar «Guardar cambios».</span>}
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
