import { ArrowUpRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useUbicacion } from "../hooks/Ubicacion";
import { codigoBien, nombreTipo, resumenBien } from "../lib/bienes";
import { distanciaA, formatearDistancia } from "../lib/distancia";
import Foto from "./Foto";

const TONOS = ["warm", "sage", "neutral"];

/**
 * Tarjeta patrimonial del diseño. Toda la tarjeta abre la ficha; el título es el enlace accesible.
 * `acciones` reemplaza el pie (p. ej. «Quitar» en el itinerario); `enlace` es el texto de «ver más».
 * `indice` alterna tono y proporción de la fotografía (galería editorial); sin él la foto es 4:3.
 */
export function TarjetaBien({ bien, destacada = false, enlace = "ver ficha →", etiquetaFoto = "Fotografía patrimonial", acciones, indice, as: Etiqueta = "li" }) {
  const navegar = useNavigate();
  const { posicion } = useUbicacion();
  const distancia = formatearDistancia(distanciaA(bien, posicion));
  const alPulsar = (evento) => {
    if (evento.target.closest("a, button")) return;
    navegar(`/bienes/${bien.id}`);
  };
  const conIndice = Number.isInteger(indice);

  return (
    <Etiqueta
      className={`heritage-card tarjeta editorial-card${destacada ? " is-highlighted tarjeta--activa" : ""}${conIndice ? " masonry-item animate-slide-up" : ""}`}
      style={conIndice ? { animationDelay: `${(indice % 10) * 50}ms` } : undefined}
      data-bien={bien.id}
      onClick={alPulsar}
    >
      <Foto
        as="div"
        className="heritage-card__media slot--lg"
        tono={TONOS[(indice ?? 0) % TONOS.length]}
        src={bien.portada?.url}
        alt={bien.portada?.texto_alternativo || bien.nombre}
        etiqueta={etiquetaFoto}
        pista={bien.nombre}
      >
        <span className="heritage-card__badge">{codigoBien(bien.id)}</span>
        <span className="heritage-card__open" aria-hidden="true">
          <ArrowUpRight />
        </span>
      </Foto>
      <div className="heritage-card__body">
        <p className="heritage-card__meta">{bien.categoria.nombre}</p>
        <h3 className="heritage-card__title tarjeta__titulo">
          <Link to={`/bienes/${bien.id}`}>{bien.nombre}</Link>
        </h3>
        <p className="heritage-card__desc">{resumenBien(bien)}</p>
        {!bien.tiene_ubicacion && <p className="heritage-card__nolocation">Sin ubicación puntual: solo aparece en la lista.</p>}
        <div className="heritage-card__footer">
          {acciones ?? (
            <>
              {distancia ? <span className="heritage-card__distance">{distancia}</span> : <span className="heritage-card__zone">Patrimonio {nombreTipo(bien.tipo).toLowerCase()}</span>}
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

/** Galería editorial de resultados (índice visual bajo el mapa). */
export default function ListaBienes({ bienes, seleccionado }) {
  return (
    <ul className="results-cards-grid masonry-grid lista">
      {bienes.map((bien, i) => (
        <TarjetaBien key={bien.id} bien={bien} indice={i} destacada={seleccionado === bien.id} />
      ))}
    </ul>
  );
}
