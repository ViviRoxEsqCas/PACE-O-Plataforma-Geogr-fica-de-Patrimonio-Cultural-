import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Cargando, ErrorCarga } from "../components/Estados";
import Foto from "../components/Foto";
import { TarjetaBien } from "../components/ListaBienes";
import Marco from "../components/Marco";
import MapaBienes from "../components/MapaBienes";
import Practicar from "../components/Practicar";
import Reportar from "../components/Reportar";
import { useAviso } from "../components/Aviso";
import { useCatalogo } from "../hooks/Catalogo";
import { useItinerario } from "../hooks/Itinerario";
import { useUbicacion } from "../hooks/Ubicacion";
import { useDatos } from "../hooks/useDatos";
import { obtenerBien } from "../lib/api";
import { codigoBien, enlaceMapa, nombreTipo } from "../lib/bienes";
import { distanciaA, formatearDistancia } from "../lib/distancia";

const fecha = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("es-BO", { day: "numeric", month: "long", year: "numeric" });

/** Fotografía principal con su atribución obligatoria (autor y licencia) y galería de miniaturas. */
function Imagenes({ imagenes, nombre }) {
  const [activa, setActiva] = useState(0);
  useEffect(() => setActiva(0), [imagenes]);
  const imagen = imagenes[activa];

  return (
    <div className="detail-main-media-col galeria">
      <figure className="detail-photo">
        <Foto
          as="div"
          className="detail-hero-photo"
          src={imagen?.url}
          alt={imagen?.texto_alternativo || nombre}
          etiqueta="FOTOGRAFÍA PRINCIPAL"
          pista={imagen ? undefined : "Esta ficha todavía no tiene imágenes con autor y licencia verificados."}
        />
        {imagen && (
          <figcaption className="detail-photo-credit">
            Imagen de {imagen.autor}.{" "}
            {imagen.licencia_url ? (
              <a href={imagen.licencia_url} target="_blank" rel="noopener noreferrer">
                {imagen.licencia}
              </a>
            ) : (
              imagen.licencia
            )}
          </figcaption>
        )}
      </figure>

      {imagenes.length > 1 && (
        <div>
          <p className="spec-box__label detail-gallery-label">GALERÍA VISUAL (SELECCIONA UNA VISTA)</p>
          <div className="detail-gallery-thumbs">
            {imagenes.map((miniatura, i) => (
              <button key={miniatura.id} type="button" className={`gallery-thumb-btn${i === activa ? " is-active" : ""}`} aria-label={`Ver fotografía ${i + 1} de ${imagenes.length}`} aria-pressed={i === activa} onClick={() => setActiva(i)}>
                <Foto as="span" src={miniatura.url} alt="" etiqueta={`0${i + 1}`} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Ficha() {
  const { id } = useParams();
  const ubicacion = useLocation();
  const navegar = useNavigate();
  const aviso = useAviso();
  const itinerario = useItinerario();
  const { posicion, fase, solicitar } = useUbicacion();
  const { bienes: catalogo } = useCatalogo();
  const { datos: bien, error, cargando, reintentar } = useDatos(useCallback((signal) => obtenerBien(id, signal), [id]));

  useEffect(() => {
    document.title = bien ? `${bien.nombre} · Paceño` : "Ficha · Paceño";
    window.scrollTo(0, 0);
  }, [bien]);

  const volver = () => (ubicacion.key !== "default" ? navegar(-1) : navegar("/explorar"));

  // Navegación entre fichas y «otros hitos»: del catálogo real, priorizando la misma categoría.
  const { anterior, siguiente, relacionados } = useMemo(() => {
    const actual = catalogo.findIndex((b) => String(b.id) === String(id));
    if (actual < 0 || catalogo.length < 2) return { anterior: null, siguiente: null, relacionados: [] };
    const otros = catalogo.filter((b) => b.id !== catalogo[actual].id);
    const misma = otros.filter((b) => b.categoria.id === catalogo[actual].categoria.id);
    return {
      anterior: catalogo[(actual - 1 + catalogo.length) % catalogo.length],
      siguiente: catalogo[(actual + 1) % catalogo.length],
      relacionados: [...misma, ...otros.filter((b) => !misma.includes(b))].slice(0, 3),
    };
  }, [catalogo, id]);

  const alternarRuta = () => {
    const { agregado, total } = itinerario.alternar(bien.id);
    aviso(agregado ? `«${bien.nombre}» se añadió a tu itinerario (${total} ${total === 1 ? "bien" : "bienes"}).` : `«${bien.nombre}» se retiró de tu itinerario.`);
  };

  const guardado = bien ? itinerario.guardado(bien.id) : false;

  return (
    <Marco
      activa="patrimonio"
      insignia="FICHA PATRIMONIAL · LA PAZ"
      notaMenu="Detalle histórico y ubicación geográfica"
      cta={{ descripcion: "Cada ficha cita sus fuentes documentales y se conecta con el catálogo patrimonial de PACEÑO.", texto: "+ Volver al mapa", a: "/explorar" }}
    >
      <div className="detail-nav-strip">
        <nav className="breadcrumb-trail" aria-label="Ruta de navegación">
          <Link to="/">Inicio</Link>
          <span>/</span>
          <Link to="/explorar">Exploración Geográfica</Link>
          <span>/</span>
          <span>{bien?.nombre ?? "Ficha Patrimonial"}</span>
        </nav>

        <div className="detail-actions-bar">
          <button type="button" className="btn-outline-pill" onClick={volver}>
            ← Volver a explorar
          </button>
          {anterior && (
            <Link to={`/bienes/${anterior.id}`} className="arrow-btn" aria-label={`Patrimonio anterior: ${anterior.nombre}`} title="Anterior">
              ‹
            </Link>
          )}
          {siguiente && (
            <Link to={`/bienes/${siguiente.id}`} className="arrow-btn is-crimson" aria-label={`Patrimonio siguiente: ${siguiente.nombre}`} title="Siguiente">
              ›
            </Link>
          )}
        </div>
      </div>

      {cargando && !bien && (
        <div className="ficha-vacia">
          <Cargando texto="Cargando ficha…" />
        </div>
      )}
      {error?.estado === 404 && (
        <div className="ficha-vacia">
          <div className="estado estado--vacio">
            <p className="estado__titulo">Esta ficha no existe o ya no está publicada.</p>
            <Link to="/explorar" className="btn-outline-pill">
              Ir a explorar
            </Link>
          </div>
        </div>
      )}
      {error && error.estado !== 404 && (
        <div className="ficha-vacia">
          <ErrorCarga error={error} onReintentar={reintentar} />
        </div>
      )}

      {bien && (
        <article>
          <section className="detail-hero-grid" aria-label="Detalle del bien patrimonial">
            <Imagenes imagenes={bien.imagenes} nombre={bien.nombre} />

            <div className="detail-summary-col">
              <header>
                <div className="detail-meta-row">
                  <span className="detail-category-tag">{bien.categoria.nombre}</span>
                  <span className="detail-code-badge">{codigoBien(bien.id)}</span>
                </div>
                <h1 className="detail-title">{bien.nombre}</h1>
                <p className="detail-subtitle">Patrimonio cultural {bien.tipo === "material" ? "material" : "inmaterial"}</p>
                <h2 id="t-desc" className="sr-only">
                  Descripción
                </h2>
                <p className="detail-description">{bien.descripcion}</p>
              </header>

              <div className="detail-specs-grid">
                <div className="spec-box">
                  <p className="spec-box__label">Tipo de patrimonio</p>
                  <p className="spec-box__value">{nombreTipo(bien.tipo)}</p>
                </div>
                <div className="spec-box">
                  <p className="spec-box__label">Categoría</p>
                  <p className="spec-box__value">{bien.categoria.nombre}</p>
                </div>
                <div className="spec-box">
                  <p className="spec-box__label">Dirección de referencia</p>
                  <p className="spec-box__value">{bien.direccion_referencia?.trim() || "Sin dirección de referencia"}</p>
                </div>
                <div className="spec-box">
                  <p className="spec-box__label">Coordenadas</p>
                  <p className="spec-box__value">{bien.tiene_ubicacion ? `Lat ${bien.latitud.toFixed(4)} · Lon ${bien.longitud.toFixed(4)}` : "Sin ubicación puntual"}</p>
                </div>
              </div>

              <div className="detail-cta-group">
                <button type="button" className={`cta-pill-btn${guardado ? " is-saved" : ""}`} aria-pressed={guardado} onClick={alternarRuta}>
                  {guardado ? "✓ Guardado en mi ruta" : "+ Guardar en mi ruta"}
                </button>
                <Link to={enlaceMapa(bien)} className="btn-crimson-pill">
                  {bien.tiene_ubicacion ? "Ubicar en mapa interactivo" : "Buscar en el catálogo"}
                </Link>
              </div>
            </div>
          </section>

          <section className="detail-lower-grid" aria-label="Información complementaria y ubicación">
            <div className="detail-panel">
              <h2 className="detail-panel__title" id="t-fuentes">
                Fuentes Documentales
              </h2>
              <ol className="fuentes highlights-list">
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
            </div>

            <div className="detail-panel">
              <h2 className="detail-panel__title">Guía de Visita y Contexto</h2>
              <p className="detail-text">
                {bien.tiene_ubicacion
                  ? bien.direccion_referencia?.trim() || "Consulta las fuentes documentales para ampliar el contexto de este bien."
                  : bien.direccion_referencia?.trim() || "Manifestación cultural sin lugar fijo: se vive en las celebraciones y prácticas de la comunidad."}
              </p>
              <div className="detail-routes-box">
                <p className="spec-box__label">CONEXIÓN CON RUTAS PACEÑO</p>
                <p>Integra este bien en un itinerario junto a otros hitos del catálogo y consulta tu colección personal.</p>
                <Link to="/rutas" className="hero-secondary-link">
                  Administrar mi itinerario →
                </Link>
              </div>
            </div>

            <div className="detail-panel">
              <h2 className="detail-panel__title" id="t-ubic">
                Ubicación Geográfica
              </h2>
              {bien.tiene_ubicacion ? (
                <>
                  <p className="detail-text detail-text--meta">
                    Lat {bien.latitud.toFixed(4)} · Lon {bien.longitud.toFixed(4)}
                  </p>
                  <div className="ficha__mapa">
                    <MapaBienes ficha className="detail-mini-map" bienes={[bien]} posicion={posicion} etiqueta={`Mapa con la ubicación de ${bien.nombre}`} />
                  </div>
                  <p className="detail-distance">
                    {posicion ? (
                      <strong>{formatearDistancia(distanciaA(bien, posicion))}</strong>
                    ) : (
                      <button type="button" className="btn-outline-pill" onClick={solicitar} disabled={fase === "pidiendo"}>
                        {fase === "pidiendo" ? "Obteniendo ubicación…" : "Ver distancia"}
                      </button>
                    )}
                    {fase === "error" && <span role="status">No se pudo obtener tu ubicación; el resto de la ficha sigue disponible.</span>}
                  </p>
                </>
              ) : (
                <p className="detail-text">
                  Esta manifestación no tiene una ubicación puntual, por eso no aparece en el mapa.
                  {bien.direccion_referencia && ` ${bien.direccion_referencia}`}
                </p>
              )}
            </div>
          </section>

          <section className="detail-interact-grid" aria-label="Practicar y reportar">
            <div className="detail-panel">
              <Practicar bienId={bien.id} />
            </div>
            <div className="detail-panel">
              <Reportar bienId={bien.id} />
            </div>
          </section>

          {relacionados.length > 0 && (
            <section className="detail-related-strip" aria-label="Otros patrimonios recomendados">
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <span className="explore-kicker">CONTINÚA EL RECORRIDO</span>
                  <h2 className="chronicles-title" style={{ marginTop: 6 }}>
                    Otros Hitos Patrimoniales
                  </h2>
                </div>
                <Link to="/explorar" className="btn-outline-pill">
                  Ver catálogo completo en mapa
                </Link>
              </div>
              <ul className="related-cards-row" style={{ listStyle: "none" }}>
                {relacionados.map((rel) => (
                  <TarjetaBien key={rel.id} bien={rel} enlace="Explorar ficha →" etiquetaFoto="PATRIMONIO" />
                ))}
              </ul>
            </section>
          )}
        </article>
      )}
    </Marco>
  );
}
