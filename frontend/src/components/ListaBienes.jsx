import { Link, useNavigate } from "react-router-dom";
import { useUbicacion } from "../hooks/Ubicacion";
import { codigoBien, nombreTipo, resumenBien } from "../lib/bienes";
import { distanciaA, formatearDistancia } from "../lib/distancia";
import Foto from "./Foto";

/**
 * Tarjeta patrimonial del diseño. Toda la tarjeta abre la ficha; el título es el enlace accesible.
 * `acciones` reemplaza el pie (p. ej. «Quitar» en el itinerario); `enlace` es el texto de «ver más».
 */
export function TarjetaBien({ bien, destacada = false, enlace = "Ver detalle →", etiquetaFoto = "FOTO PATRIMONIAL", acciones, as: Etiqueta = "li" }) {
  const navegar = useNavigate();
  const { posicion } = useUbicacion();
  const distancia = formatearDistancia(distanciaA(bien, posicion));
  const alPulsar = (evento) => {
    if (evento.target.closest("a, button")) return;
    navegar(`/bienes/${bien.id}`);
  };

  return (
    <Etiqueta className={`heritage-card tarjeta${destacada ? " is-highlighted tarjeta--activa" : ""}`} data-bien={bien.id} onClick={alPulsar}>
      <Foto as="div" className="heritage-card__media" src={bien.portada?.url} alt={bien.portada?.texto_alternativo || bien.nombre} etiqueta={etiquetaFoto} pista={bien.nombre}>
        <span className="heritage-card__badge">{codigoBien(bien.id)}</span>
      </Foto>
      <div className="heritage-card__body">
        <div>
          <p className="heritage-card__meta">
            {nombreTipo(bien.tipo)} · {bien.categoria.nombre}
          </p>
          <h3 className="heritage-card__title tarjeta__titulo">
            <Link to={`/bienes/${bien.id}`}>{bien.nombre}</Link>
          </h3>
          <p className="heritage-card__desc">{resumenBien(bien)}</p>
          {bien.tiene_ubicacion ? (
            distancia && <p className="heritage-card__distance">{distancia}</p>
          ) : (
            <p className="heritage-card__nolocation">Sin ubicación puntual: solo aparece en la lista.</p>
          )}
        </div>
        <div className="heritage-card__footer">
          {acciones ?? (
            <>
              <span className="heritage-card__zone">{bien.categoria.nombre}</span>
              <span className="heritage-card__link" aria-hidden="true">
                {enlace}
              </span>
            </>
          )}
        </div>
      </div>
    </Etiqueta>
  );
}

/** Cuadrícula de resultados (tira inferior del mapa). */
export default function ListaBienes({ bienes, seleccionado }) {
  return (
    <ul className="results-cards-grid lista">
      {bienes.map((bien) => (
        <TarjetaBien key={bien.id} bien={bien} destacada={seleccionado === bien.id} />
      ))}
    </ul>
  );
}
