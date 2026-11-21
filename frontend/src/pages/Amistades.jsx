import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Cargando, ErrorCarga } from "../components/Estados";
import MarcoSocial from "../components/MarcoSocial";
import Persona from "../components/Persona";
import { useAviso } from "../components/Aviso";
import { useSesion } from "../hooks/Sesion";
import { useDatos } from "../hooks/useDatos";
import { actividadDeAmistades, buscarPerfiles, listarAmistades, quitarAmistad, responderAmistad, solicitarAmistad } from "../lib/api";
import { EstrellasLectura } from "../components/Estrellas";

const cuando = (iso) => new Date(iso).toLocaleDateString("es-BO", { day: "numeric", month: "short" });

/** Lista de eventos: «visitó (declarado)», «valoró» o «comentó». */
export function Actividad({ eventos, sinPersona = false }) {
  if (!eventos.length) return <p className="formulario__nota">Sin actividad para mostrar.</p>;
  return (
    <ul className="actividad">
      {eventos.map((e, i) => (
        <li key={`${e.tipo}-${e.bien.id}-${e.fecha}-${i}`}>
          {!sinPersona && <Link to={`/perfiles/${encodeURIComponent(e.usuario.username)}`} className="persona__nombre">{e.usuario.nombre_visible}</Link>}{" "}
          {e.tipo === "visita" && <>marcó como visitado <small>(declarado)</small></>}
          {e.tipo === "valoracion" && <>valoró <EstrellasLectura valor={e.estrellas} /></>}
          {e.tipo === "comentario" && <>comentó</>}{" "}
          <Link to={`/bienes/${e.bien.id}`}>{e.bien.nombre}</Link>
          {e.tipo === "comentario" && <blockquote className="actividad__cita">{e.comentario}</blockquote>}
          <time dateTime={e.fecha} className="comentario__fecha"> · {cuando(e.fecha)}</time>
        </li>
      ))}
    </ul>
  );
}

function Buscar({ onCambio }) {
  const aviso = useAviso();
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);
  const [error, setError] = useState(null);
  const buscar = async (evento) => {
    evento.preventDefault();
    setError(null);
    try {
      setRes((await buscarPerfiles(q)).results);
    } catch (e) {
      setError(e);
    }
  };
  const pedir = async (username) => {
    setError(null);
    try {
      await solicitarAmistad(username);
      aviso("Solicitud enviada.");
      onCambio();
    } catch (e) {
      setError(e);
    }
  };
  return (
    <>
      <form className="formulario" onSubmit={buscar} noValidate>
        <div className="campo">
          <label htmlFor="buscar-persona">Buscar personas (perfiles públicos)</label>
          <input id="buscar-persona" type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Usuario o nombre visible" />
        </div>
        <button type="submit" className="btn-outline-pill" disabled={q.trim().length < 2}>Buscar</button>
      </form>
      {error && <ErrorCarga error={error} />}
      {res && (res.length === 0 ? <p className="formulario__nota">Sin resultados.</p> : (
        <ul className="lista-personas">
          {res.map((p) => (
            <li key={p.username}><Persona persona={p}><button type="button" className="btn-outline-pill" onClick={() => pedir(p.username)}>Solicitar amistad</button></Persona></li>
          ))}
        </ul>
      ))}
    </>
  );
}

export default function Amistades() {
  const { perfil, listo } = useSesion();
  const aviso = useAviso();
  const [error, setError] = useState(null);
  const cargar = useCallback(async (signal) => {
    if (!perfil) return null;
    const [amistades, actividad] = await Promise.all([listarAmistades(signal), actividadDeAmistades(signal)]);
    return { ...amistades, actividad: actividad.results };
  }, [perfil]);
  const { datos, error: errorCarga, cargando, reintentar } = useDatos(cargar);

  const accion = (fn, texto) => async () => {
    setError(null);
    try {
      await fn();
      aviso(texto);
      reintentar();
    } catch (e) {
      setError(e);
    }
  };

  return (
    <MarcoSocial activa="comunidad" kicker="AMISTADES" titulo="Mis amistades" descripcion="Solicitudes, lista de amistades y lo que han visitado, valorado o comentado. Sin chat ni mensajes privados.">
      {!listo ? <Cargando /> : !perfil ? (
        <div className="estado estado--vacio"><p className="estado__titulo">Ingresa para ver tus amistades.</p><Link to="/cuenta" className="cta-pill-btn">Ingresar o crear cuenta</Link></div>
      ) : (
        <>
          {cargando && !datos && <Cargando />}
          {errorCarga && <ErrorCarga error={errorCarga} onReintentar={reintentar} />}
          {error && <ErrorCarga error={error} />}
          {datos && (
            <div className="social-grid">
              <div className="detail-panel social-tarjeta">
                <h2 className="detail-panel__title">Solicitudes recibidas ({datos.recibidas.length})</h2>
                {datos.recibidas.length === 0 ? <p className="formulario__nota">No tienes solicitudes pendientes.</p> : (
                  <ul className="lista-personas">
                    {datos.recibidas.map((s) => (
                      <li key={s.id}>
                        <Persona persona={s.persona}>
                          <span className="formulario__acciones">
                            <button type="button" className="cta-pill-btn" onClick={accion(() => responderAmistad(s.id, "aceptar"), "Amistad aceptada.")}>Aceptar</button>
                            <button type="button" className="btn-outline-pill" onClick={accion(() => responderAmistad(s.id, "rechazar"), "Solicitud rechazada.")}>Rechazar</button>
                          </span>
                        </Persona>
                      </li>
                    ))}
                  </ul>
                )}
                <h2 className="detail-panel__title">Enviadas ({datos.enviadas.length})</h2>
                {datos.enviadas.length === 0 ? <p className="formulario__nota">No hay solicitudes enviadas pendientes.</p> : (
                  <ul className="lista-personas">
                    {datos.enviadas.map((s) => (
                      <li key={s.id}><Persona persona={s.persona}><button type="button" className="btn-text" onClick={accion(() => quitarAmistad(s.id), "Solicitud cancelada.")}>Cancelar</button></Persona></li>
                    ))}
                  </ul>
                )}
                <h2 className="detail-panel__title">Buscar personas</h2>
                <Buscar onCambio={reintentar} />
              </div>
              <div className="detail-panel social-tarjeta">
                <h2 className="detail-panel__title">Amistades ({datos.amigos.length})</h2>
                {datos.amigos.length === 0 ? <p className="formulario__nota">Aún no tienes amistades.</p> : (
                  <ul className="lista-personas">
                    {datos.amigos.map((s) => (
                      <li key={s.id}><Persona persona={s.persona}><button type="button" className="btn-text" onClick={accion(() => quitarAmistad(s.id), "Amistad retirada.")} aria-label={`Quitar a ${s.persona.nombre_visible}`}>Quitar</button></Persona></li>
                    ))}
                  </ul>
                )}
                <h2 className="detail-panel__title">Actividad de mis amistades</h2>
                <Actividad eventos={datos.actividad} />
              </div>
            </div>
          )}
        </>
      )}
    </MarcoSocial>
  );
}
