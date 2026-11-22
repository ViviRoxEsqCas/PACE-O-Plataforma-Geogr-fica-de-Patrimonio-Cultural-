import { Link } from "react-router-dom";
import { urlRecurso } from "../lib/api";

/** Avatar (foto o inicial) + nombre visible. Solo usa los datos públicos de una persona. */
export function Avatar({ persona, tamano = 36 }) {
  const inicial = (persona?.nombre_visible || persona?.username || "?").trim().charAt(0).toUpperCase();
  return persona?.foto ? (
    <img className="avatar" src={urlRecurso(persona.foto)} alt="" width={tamano} height={tamano} style={{ width: tamano, height: tamano }} />
  ) : (
    <span className="avatar avatar--inicial" aria-hidden="true" style={{ width: tamano, height: tamano, fontSize: tamano * 0.42 }}>
      {inicial}
    </span>
  );
}

export default function Persona({ persona, enlace = true, tamano = 36, children }) {
  const cuerpo = (
    <>
      <Avatar persona={persona} tamano={tamano} />
      <span className="persona__texto">
        <span className="persona__nombre">{persona.nombre_visible}</span>
        <span className="persona__usuario">@{persona.username}</span>
      </span>
    </>
  );
  return (
    <div className="persona">
      {enlace ? (
        <Link to={`/perfiles/${encodeURIComponent(persona.username)}`} className="persona__enlace">
          {cuerpo}
        </Link>
      ) : (
        <span className="persona__enlace">{cuerpo}</span>
      )}
      {children}
    </div>
  );
}
