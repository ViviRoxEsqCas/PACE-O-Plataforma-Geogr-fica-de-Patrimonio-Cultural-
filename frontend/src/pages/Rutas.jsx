import { useCallback, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAviso } from "../components/Aviso";
import { Cargando, ErrorCarga } from "../components/Estados";
import { TarjetaBien } from "../components/ListaBienes";
import Marco from "../components/Marco";
import { useCatalogo } from "../hooks/Catalogo";
import { useItinerario } from "../hooks/Itinerario";
import { useDatos } from "../hooks/useDatos";
import { listarCategorias } from "../lib/api";
import { distanciaMetros, formatearDistancia } from "../lib/distancia";

const dos = (n) => String(n).padStart(2, "0");

/** Longitud aproximada en línea recta uniendo las paradas con ubicación, en el orden del catálogo. */
function recorrido(paradas) {
  const puestos = paradas.filter((b) => b.tiene_ubicacion);
  if (puestos.length < 2) return null;
  let metros = 0;
  for (let i = 1; i < puestos.length; i += 1) {
    metros += distanciaMetros({ lat: puestos[i - 1].latitud, lon: puestos[i - 1].longitud }, { lat: puestos[i].latitud, lon: puestos[i].longitud });
  }
  return formatearDistancia(metros).replace(/^a /, "");
}

export default function Rutas() {
  const aviso = useAviso();
  const itinerario = useItinerario();
  const { bienes, cargando, error, reintentar } = useCatalogo();
  const categorias = useDatos(useCallback((signal) => listarCategorias(signal), []));

  useEffect(() => {
    document.title = "Rutas culturales · Paceño";
  }, []);

  // Rutas temáticas: una por categoría del catálogo, con sus bienes publicados como paradas.
  const rutas = useMemo(() => {
    const descripciones = new Map((categorias.datos ?? []).map((c) => [c.id, c.descripcion]));
    const porCategoria = new Map();
    for (const bien of bienes) {
      if (!porCategoria.has(bien.categoria.id)) porCategoria.set(bien.categoria.id, { id: bien.categoria.id, nombre: bien.categoria.nombre, descripcion: descripciones.get(bien.categoria.id), paradas: [] });
      porCategoria.get(bien.categoria.id).paradas.push(bien);
    }
    return [...porCategoria.values()];
  }, [bienes, categorias.datos]);

  const guardados = bienes.filter((b) => itinerario.ids.includes(b.id));
  const quitar = (bien) => {
    itinerario.alternar(bien.id);
    aviso("Parada eliminada de tu itinerario.");
  };

  return (
    <Marco
      activa="rutas"
      insignia="RUTAS CULTURALES · LA PAZ"
      notaMenu="Circuitos temáticos e itinerario personal"
      cta={{ descripcion: "Cada ruta reúne los bienes de una misma categoría. Guarda tus favoritos desde su ficha para armar tu recorrido.", texto: "+ Abrir mapa", a: "/explorar" }}
    >
      <section className="routes-hero-band">
        <div>
          <span className="explore-kicker">RECORRIDOS TEMÁTICOS · LA PAZ</span>
          <h1 className="explore-heading" style={{ marginTop: 8 }}>
            Rutas Culturales e Itinerarios
          </h1>
          <p style={{ fontSize: "0.9rem", lineHeight: 1.65, color: "var(--ink-muted)", marginTop: 12, maxWidth: 620 }}>
            Selecciona cualquiera de los recorridos temáticos para visitar sus fichas patrimoniales o visualizar sus paradas directamente en el mapa interactivo de PACEÑO.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Link to="/explorar" className="cta-pill-btn">
            <span className="cta-plus" aria-hidden="true">+</span>
            <span>Abrir mapa completo</span>
          </Link>
        </div>
      </section>

      {cargando && bienes.length === 0 && (
        <div className="pagina-estado">
          <Cargando texto="Cargando rutas…" />
        </div>
      )}
      {error && bienes.length === 0 && (
        <div className="pagina-estado">
          <ErrorCarga error={error} onReintentar={reintentar} />
        </div>
      )}

      {rutas.length > 0 && (
        <section className="routes-grid" aria-label="Rutas patrimoniales sugeridas">
          {rutas.map((ruta, i) => {
            const distancia = recorrido(ruta.paradas);
            const primera = ruta.paradas[0];
            return (
              <article className="route-card" key={ruta.id}>
                <div>
                  <div className="route-card__top">
                    <span className="route-card__num">
                      RUTA {dos(i + 1)} · {ruta.paradas.length} {ruta.paradas.length === 1 ? "PARADA" : "PARADAS"}
                    </span>
                    <h2 className="route-card__title">{ruta.nombre}</h2>
                    <p className="route-card__meta">{distancia ? `Recorrido aproximado: ${distancia} en línea recta` : "Sin recorrido físico entre paradas"}</p>
                    {ruta.descripcion && <p className="route-card__desc">{ruta.descripcion}</p>}
                  </div>
                  <ul className="route-card__stops">
                    {ruta.paradas.map((parada, j) => (
                      <li key={parada.id}>
                        <Link to={`/bienes/${parada.id}`}>
                          {dos(j + 1)}. {parada.nombre}
                        </Link>
                        <span aria-hidden="true">→</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="route-card__footer">
                  <Link to={`/explorar?categoria=${ruta.id}`} className="btn-outline-pill">
                    Ver en mapa
                  </Link>
                  <Link to={`/bienes/${primera.id}`} className="heritage-card__link">
                    Iniciar ruta →
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <section className="saved-itinerary-box" aria-label="Bienes guardados por la persona">
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <span className="explore-kicker">COLECCIÓN PERSONAL</span>
            <h2 className="chronicles-title" style={{ marginTop: 6 }}>
              Mi Itinerario Guardado
            </h2>
          </div>
          <Link to="/explorar" className="btn-outline-pill">
            + Añadir más sitios desde el mapa
          </Link>
        </div>
        <ul className="saved-list-grid">
          {guardados.length === 0 ? (
            <li className="estado" style={{ listStyle: "none" }}>
              <p className="estado__titulo">Aún no tienes sitios guardados en tu ruta personal.</p>
              <p>Explora el mapa o abre cualquier ficha patrimonial para añadir paradas. Se guardan solo en este navegador.</p>
              <Link to="/explorar" className="cta-pill-btn">
                + Ir al mapa patrimonial
              </Link>
            </li>
          ) : (
            guardados.map((bien) => (
              <TarjetaBien
                key={bien.id}
                bien={bien}
                etiquetaFoto="PARADA GUARDADA"
                acciones={
                  <>
                    <button type="button" className="btn-text" onClick={() => quitar(bien)} aria-label={`Quitar ${bien.nombre} del itinerario`}>
                      Quitar
                    </button>
                    <Link to={`/bienes/${bien.id}`} className="heritage-card__link">
                      Abrir detalle →
                    </Link>
                  </>
                }
              />
            ))
          )}
        </ul>
      </section>
    </Marco>
  );
}
