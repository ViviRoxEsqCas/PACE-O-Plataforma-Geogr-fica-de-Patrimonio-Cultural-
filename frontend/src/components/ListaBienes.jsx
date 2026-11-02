import { Link } from "react-router-dom";
import { distanciaA, formatearDistancia } from "../lib/distancia";
import { useUbicacion } from "../hooks/Ubicacion";

export function EtiquetaTipo({ bien }) {
  return (
    <span className={`etiqueta etiqueta--${bien.tipo}`}>
      <span aria-hidden="true">{bien.tipo === "material" ? "▣" : "◌"}</span> {bien.tipo === "material" ? "Material" : "Inmaterial"}
    </span>
  );
}

export default function ListaBienes({ bienes, seleccionado, onVerEnMapa }) {
  const { posicion } = useUbicacion();
  return (
    <ul className="lista">
      {bienes.map((bien) => {
        const distancia = formatearDistancia(distanciaA(bien, posicion));
        return (
          <li key={bien.id} className={`tarjeta${seleccionado === bien.id ? " tarjeta--activa" : ""}`}>
            <h3 className="tarjeta__titulo">
              <Link to={`/bienes/${bien.id}`}>{bien.nombre}</Link>
            </h3>
            <p className="tarjeta__meta">
              <EtiquetaTipo bien={bien} /> <span>{bien.categoria.nombre}</span>
            </p>
            {bien.tiene_ubicacion ? (
              <p className="tarjeta__ubicacion">
                {distancia && <strong>{distancia}</strong>}
                {onVerEnMapa && (
                  <button type="button" className="boton boton--texto" onClick={() => onVerEnMapa(bien.id)}>
                    Ver en el mapa
                  </button>
                )}
              </p>
            ) : (
              <p className="tarjeta__ubicacion tarjeta__ubicacion--nula">Sin ubicación puntual: solo aparece en la lista.</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
