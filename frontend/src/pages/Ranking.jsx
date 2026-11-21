import { useCallback } from "react";
import { Link } from "react-router-dom";
import { Cargando, ErrorCarga } from "../components/Estados";
import MarcoSocial from "../components/MarcoSocial";
import Persona from "../components/Persona";
import { useSesion } from "../hooks/Sesion";
import { useDatos } from "../hooks/useDatos";
import { obtenerRanking } from "../lib/api";

export default function Ranking() {
  const { perfil, listo } = useSesion();
  const usuario = perfil?.username ?? null;
  const cargar = useCallback((signal) => (listo ? obtenerRanking(signal) : new Promise(() => {})), [listo, usuario]); // eslint-disable-line react-hooks/exhaustive-deps
  const { datos, error, cargando, reintentar } = useDatos(cargar);
  const f = datos?.formula;

  return (
    <MarcoSocial
      activa="comunidad" kicker="RANKING Y LOGROS" titulo="Comunidad Paceño"
      descripcion="Puntos por acciones medibles dentro de la plataforma. Las visitas son declaradas por cada persona; no se verifican con GPS."
    >
      {cargando && !datos && <Cargando texto="Cargando ranking…" />}
      {error && <ErrorCarga error={error} onReintentar={reintentar} />}
      {datos && (
        <div className="social-grid">
          <div className="detail-panel social-tarjeta">
            <h2 className="detail-panel__title">Ranking</h2>
            {perfil && (
              <p className="formulario__nota" role="status">
                {datos.mi_posicion ? <>Tu posición: <strong>#{datos.mi_posicion}</strong> con {datos.mis_puntos} puntos.</> : "No apareces en el ranking: necesitas un perfil público y al menos 1 punto."}
              </p>
            )}
            {datos.results.length === 0 ? (
              <p className="formulario__nota">Todavía nadie suma puntos. {perfil ? "Marca un bien como visitado o valóralo." : <Link to="/cuenta">Crea tu cuenta</Link>}</p>
            ) : (
              <ol className="ranking">
                {datos.results.map((r) => (
                  <li key={r.persona.username} className={r.persona.username === usuario ? "ranking__fila is-propia" : "ranking__fila"}>
                    <span className="ranking__pos">{r.posicion}</span>
                    <Persona persona={r.persona} tamano={32} />
                    <span className="ranking__puntos"><strong>{r.puntos}</strong> pts</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="detail-panel social-tarjeta">
            <h2 className="detail-panel__title">Cómo se calcula</h2>
            <ul className="highlights-list">
              <li>{f.visita_declarada} puntos por cada bien distinto marcado como visitado.</li>
              <li>{f.valoracion} puntos por cada bien distinto valorado con estrellas.</li>
              <li>{f.comentario} puntos más por un comentario visible de al menos {f.min_caracteres_comentario} caracteres (uno por bien).</li>
            </ul>
            <p className="formulario__nota">Repetir, editar o borrar y volver a crear no suma otra vez: cada acción cuenta una sola vez por bien. Los comentarios ocultos por moderación no puntúan. Solo cuentan bienes publicados y perfiles públicos.</p>
            <p className="formulario__nota"><strong>Desempate:</strong> {f.desempate.map((d, i) => `${i + 1}.º ${d}`).join(" · ")}.</p>
            <h3 className="social__subtitulo">Logros</h3>
            <ul className="logros">
              {datos.logros.map((l) => (
                <li key={l.codigo} className="logro"><strong>{l.nombre}</strong><span>{l.condicion}</span></li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </MarcoSocial>
  );
}
