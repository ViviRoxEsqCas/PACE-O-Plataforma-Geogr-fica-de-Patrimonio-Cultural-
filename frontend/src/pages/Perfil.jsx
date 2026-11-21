import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Cargando, ErrorCarga } from "../components/Estados";
import MarcoSocial from "../components/MarcoSocial";
import { Avatar } from "../components/Persona";
import { useAviso } from "../components/Aviso";
import { Actividad } from "./Amistades";
import { useSesion } from "../hooks/Sesion";
import { useDatos } from "../hooks/useDatos";
import { obtenerPerfil, solicitarAmistad } from "../lib/api";

export default function Perfil() {
  const { username } = useParams();
  const { perfil: yo, listo } = useSesion();
  const aviso = useAviso();
  const [error, setError] = useState(null);
  const cargar = useCallback((signal) => (listo ? obtenerPerfil(username, signal) : new Promise(() => {})), [username, listo, yo?.username]); // eslint-disable-line react-hooks/exhaustive-deps
  const { datos, error: errorCarga, cargando, reintentar } = useDatos(cargar);

  const pedir = async () => {
    setError(null);
    try {
      await solicitarAmistad(username);
      aviso("Solicitud enviada.");
      reintentar();
    } catch (e) {
      setError(e);
    }
  };
  const rel = datos?.relacion?.estado;

  return (
    <MarcoSocial activa="comunidad" kicker="PERFIL PÚBLICO" titulo={datos ? datos.nombre_visible : "Perfil"}>
      {cargando && !datos && <Cargando texto="Cargando perfil…" />}
      {errorCarga?.estado === 404 && (
        <div className="estado estado--vacio">
          <p className="estado__titulo">Este perfil no existe o no es visible para ti.</p>
          <Link to="/ranking" className="btn-outline-pill">Ver el ranking</Link>
        </div>
      )}
      {errorCarga && errorCarga.estado !== 404 && <ErrorCarga error={errorCarga} onReintentar={reintentar} />}
      {datos && (
        <div className="social-grid">
          <div className="detail-panel social-tarjeta">
            <div className="persona persona--grande">
              <Avatar persona={datos} tamano={72} />
              <span className="persona__texto"><span className="persona__nombre">{datos.nombre_visible}</span><span className="persona__usuario">@{datos.username}</span></span>
            </div>
            {datos.biografia && <p className="detail-text">{datos.biografia}</p>}
            <p className="formulario__nota">Miembro desde {new Date(datos.miembro_desde).toLocaleDateString("es-BO", { month: "long", year: "numeric" })}</p>
            <ul className="social__cifras" aria-label="Actividad pública">
              <li><strong>{datos.puntos}</strong> puntos</li>
              <li><strong>{datos.posicion_ranking ? `#${datos.posicion_ranking}` : "—"}</strong> ranking</li>
              <li><strong>{datos.contadores.visitas}</strong> visitas declaradas</li>
              <li><strong>{datos.contadores.valoraciones}</strong> valoraciones</li>
            </ul>
            {yo && rel === "ninguna" && <button type="button" className="cta-pill-btn" onClick={pedir}>Enviar solicitud de amistad</button>}
            {rel === "enviada" && <p className="formulario__nota" role="status">Solicitud enviada, pendiente de respuesta.</p>}
            {rel === "recibida" && <Link to="/amistades" className="cta-pill-btn">Responder su solicitud</Link>}
            {rel === "amigos" && <p className="formulario__nota" role="status">✓ Son amistades.</p>}
            {rel === "propio" && <Link to="/cuenta" className="btn-outline-pill">Editar mi perfil</Link>}
            {!yo && <p className="formulario__nota"><Link to="/cuenta">Ingresa</Link> para enviar una solicitud de amistad.</p>}
            {error && <ErrorCarga error={error} />}
          </div>
          <div className="detail-panel social-tarjeta">
            <h2 className="detail-panel__title">Logros</h2>
            {datos.logros.length ? (
              <ul className="logros">{datos.logros.map((l) => <li key={l.codigo} className="logro"><strong>{l.nombre}</strong><span>{l.condicion}</span></li>)}</ul>
            ) : <p className="formulario__nota">Sin logros todavía.</p>}
            <h2 className="detail-panel__title">Actividad patrimonial</h2>
            {datos.actividad === null ? <p className="formulario__nota">La actividad de esta persona no es visible para ti.</p> : <Actividad eventos={datos.actividad} sinPersona />}
          </div>
        </div>
      )}
    </MarcoSocial>
  );
}
