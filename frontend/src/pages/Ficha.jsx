import { useCallback, useEffect } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { EtiquetaTipo } from "../components/ListaBienes";
import { Cargando, ErrorCarga } from "../components/Estados";
import MapaBienes from "../components/MapaBienes";
import { useUbicacion } from "../hooks/Ubicacion";
import { useDatos } from "../hooks/useDatos";
import { obtenerBien } from "../lib/api";
import { distanciaA, formatearDistancia } from "../lib/distancia";

const fecha = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("es-BO", { day: "numeric", month: "long", year: "numeric" });

function Imagenes({ imagenes, nombre }) {
  if (imagenes.length === 0) {
    return <p className="sin-imagenes">Esta ficha todavía no tiene imágenes con autor y licencia verificados.</p>;
  }
  return (
    <div className="galeria">
      {imagenes.map((imagen) => (
        <figure key={imagen.id}>
          <img src={imagen.url} alt={imagen.texto_alternativo || nombre} loading="lazy" />
          <figcaption>
            Imagen de {imagen.autor}.{" "}
            {imagen.licencia_url ? (
              <a href={imagen.licencia_url} target="_blank" rel="noopener noreferrer">
                {imagen.licencia}
              </a>
            ) : (
              imagen.licencia
            )}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export default function Ficha() {
  const { id } = useParams();
  const ubicacion = useLocation();
  const navegar = useNavigate();
  const { posicion, fase, solicitar } = useUbicacion();
  const { datos: bien, error, cargando, reintentar } = useDatos(useCallback((signal) => obtenerBien(id, signal), [id]));

  useEffect(() => {
    document.title = bien ? `${bien.nombre} · Paceño` : "Ficha · Paceño";
    window.scrollTo(0, 0);
  }, [bien]);

  const volver = () => (ubicacion.key !== "default" ? navegar(-1) : navegar("/"));

  return (
    <main className="ficha" id="contenido">
      <button type="button" className="boton boton--texto ficha__volver" onClick={volver}>
        ‹ Volver a explorar
      </button>
      {cargando && !bien && <Cargando texto="Cargando ficha…" />}
      {error?.estado === 404 && (
        <div className="estado estado--vacio">
          <p className="estado__titulo">Esta ficha no existe o ya no está publicada.</p>
          <Link to="/" className="boton boton--secundario">
            Ir a explorar
          </Link>
        </div>
      )}
      {error && error.estado !== 404 && <ErrorCarga error={error} onReintentar={reintentar} />}
      {bien && (
        <article>
          <header className="ficha__encabezado">
            <h1>{bien.nombre}</h1>
            <p className="tarjeta__meta">
              <EtiquetaTipo bien={bien} /> <span>{bien.categoria.nombre}</span>
            </p>
          </header>

          <Imagenes imagenes={bien.imagenes} nombre={bien.nombre} />

          <section aria-labelledby="t-desc">
            <h2 id="t-desc">Descripción</h2>
            <p className="ficha__texto">{bien.descripcion}</p>
          </section>

          <section aria-labelledby="t-ubic">
            <h2 id="t-ubic">Ubicación</h2>
            {bien.tiene_ubicacion ? (
              <>
                {bien.direccion_referencia && <p className="ficha__texto">{bien.direccion_referencia}</p>}
                <div className="ficha__mapa">
                  <MapaBienes bienes={[bien]} posicion={posicion} etiqueta={`Mapa con la ubicación de ${bien.nombre}`} />
                </div>
                <p className="ficha__distancia">
                  {posicion ? (
                    <strong>{formatearDistancia(distanciaA(bien, posicion))}</strong>
                  ) : (
                    <button type="button" className="boton boton--secundario" onClick={solicitar} disabled={fase === "pidiendo"}>
                      {fase === "pidiendo" ? "Obteniendo ubicación…" : "Ver distancia"}
                    </button>
                  )}
                  {fase === "error" && <span role="status"> No se pudo obtener tu ubicación; el resto de la ficha sigue disponible.</span>}
                </p>
              </>
            ) : (
              <p className="ficha__texto">
                Esta manifestación no tiene una ubicación puntual, por eso no aparece en el mapa.
                {bien.direccion_referencia && ` ${bien.direccion_referencia}`}
              </p>
            )}
          </section>

          <section aria-labelledby="t-fuentes">
            <h2 id="t-fuentes">Fuentes</h2>
            <ol className="fuentes">
              {bien.fuentes.map((fuente) => (
                <li key={fuente.id}>
                  {fuente.url_referencia ? (
                    <a href={fuente.url_referencia} target="_blank" rel="noopener noreferrer">
                      {fuente.titulo}
                    </a>
                  ) : (
                    fuente.titulo
                  )}
                  <span className="fuentes__meta">
                    {[fuente.autor_institucion, fuente.tipo].filter(Boolean).join(" · ")}. Consultada el {fecha(fuente.fecha_consulta)}.
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </article>
      )}
    </main>
  );
}
