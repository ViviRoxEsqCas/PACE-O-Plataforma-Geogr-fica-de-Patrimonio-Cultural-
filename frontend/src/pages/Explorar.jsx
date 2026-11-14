import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Cargando, ErrorCarga, Vacio } from "../components/Estados";
import Filtros from "../components/Filtros";
import Foto from "../components/Foto";
import ListaBienes from "../components/ListaBienes";
import Marco from "../components/Marco";
import MapaBienes from "../components/MapaBienes";
import Paginacion from "../components/Paginacion";
import { useCatalogo } from "../hooks/Catalogo";
import { useUbicacion } from "../hooks/Ubicacion";
import { useDatos, useRetardo } from "../hooks/useDatos";
import { listarBienes, listarCategorias, listarMarcadores } from "../lib/api";
import { conPortadaPrimero, nombreCorto } from "../lib/bienes";

const TAMANO_PAGINA = 10;

/** Sección 03 del panel lateral: distancia aproximada, solo si la persona la pide (RF-11). */
function BarraUbicacion() {
  const { fase, mensaje, solicitar, quitar } = useUbicacion();
  return (
    <div className="sidebar-section">
      <span className="sidebar-label">03. DISTANCIA A TU POSICIÓN</span>
      <div className="ubicacion">
        {fase === "activa" ? (
          <>
            <p className="ubicacion__texto">Mostrando distancias aproximadas desde tu ubicación. No se envía ni se guarda.</p>
            <button type="button" className="btn-outline-pill" onClick={quitar}>
              Dejar de usar mi ubicación
            </button>
          </>
        ) : (
          <button type="button" className="btn-outline-pill" onClick={solicitar} disabled={fase === "pidiendo"}>
            {fase === "pidiendo" ? "Obteniendo ubicación…" : "Ver distancia a cada bien"}
          </button>
        )}
        {fase === "error" && (
          <p className="ubicacion__aviso" role="status">
            {mensaje}
          </p>
        )}
      </div>
    </div>
  );
}

/** Narrativa editorial bajo el mapa (composición del diseño) alimentada con fotografías y fichas reales. */
function Narrativa() {
  const { bienes } = useCatalogo();
  const fotos = conPortadaPrimero(bienes);
  const destacado = fotos[0];
  const inmaterial = bienes.find((b) => b.tipo === "inmaterial");
  const foto = (i) => fotos[i]?.portada;
  const capsulas = [
    ["一 · 石の記憶", "Barroco Mestizo y Piedra Labrada", "Las portadas del siglo XVIII integran símbolos andinos, flora de los yungas y traza europea en una estética única del altiplano."],
    ["二 · 高地の都市", "Topografía de Laderas y Miradores", "Desde los 3.560 hasta los 3.740 metros de altitud, cada barrio construye balcones naturales hacia la cordillera Real."],
    ["三 · 生きた文化", "Saberes Vivos y Memoria Colectiva", "Más allá de los monumentos, el patrimonio paceño late en sus festividades, textilería tradicional y espacios de encuentro ciudadano."],
  ];

  return (
    <section className="editorial-showcase" aria-label="Narrativa urbana y cultural de La Paz">
      <div className="showcase-geo-sun" aria-hidden="true" />
      <div className="showcase-geo-ring" aria-hidden="true" />

      <div className="showcase-intro-grid">
        <div>
          <span className="explore-kicker">CUADERNO URBANO · MIRADA PACEÑA</span>
          <h2 className="showcase-headline">Arquitectura en pendiente, memoria viva y capas culturales de la hoyada.</h2>
          <p className="showcase-lead">
            PACEÑO articula la cartografía digital con el registro visual de plazas, templos barrocos, calles coloniales y miradores de altura. Cada punto del mapa conecta la historia urbana de La Paz con recorridos accesibles para residentes y visitantes.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {destacado && (
              <Link to={`/bienes/${destacado.id}`} className="cta-pill-btn">
                <span className="cta-plus" aria-hidden="true">+</span>
                <span>Descubrir {nombreCorto(destacado.nombre, 28)}</span>
              </Link>
            )}
            <Link to="/rutas" className="btn-outline-pill">
              Explorar rutas temáticas
            </Link>
          </div>
        </div>

        <div className="showcase-collage">
          <Foto className="collage-photo-main" src={foto(0)?.url} alt={foto(0)?.texto_alternativo || "Composición urbana patrimonial de La Paz"} etiqueta="FOTOGRAFÍA EDITORIAL 01" pista="Se completa con la portada de las fichas" />
          <Foto className="collage-photo-secondary" src={foto(1)?.url} alt={foto(1)?.texto_alternativo || "Detalle arquitectónico paceño"} etiqueta="CÁPSULA VISUAL 02" />
          <Foto className="floating-sticker-slot" transparente cover={false} src="/assets/images/floating/editorial-sticker.png" alt="" etiqueta="STICKER FLOTANTE" />
        </div>
      </div>

      <div className="chronicles-header">
        <div>
          <span className="explore-kicker">CÁPSULAS DEL ARCHIVO</span>
          <h3 className="chronicles-title">Claves para leer el patrimonio paceño</h3>
        </div>
        <Link to={inmaterial ? `/bienes/${inmaterial.id}` : "/explorar"} className="hero-secondary-link">
          Ir al patrimonio inmaterial →
        </Link>
      </div>

      <div className="chronicles-grid">
        {capsulas.map(([jp, titulo, texto], i) => (
          <article className="chronicle-item" key={titulo}>
            <Foto className="chronicle-item__pill-media" src={foto(i + 2)?.url ?? foto(i)?.url} alt={foto(i + 2)?.texto_alternativo || foto(i)?.texto_alternativo || titulo} etiqueta={`ESPACIO FOTO 0${i + 1}`} />
            <span className="chronicle-item__jp" lang="ja">{jp}</span>
            <h4 className="chronicle-item__title">{titulo}</h4>
            <p className="chronicle-item__text">{texto}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function Explorar() {
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const { posicion } = useUbicacion();

  const q = params.get("q") ?? "";
  const categoria = params.get("categoria") ?? "";
  const pagina = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const bienUrl = Number.parseInt(params.get("bien") ?? "", 10);

  const [texto, setTexto] = useState(q);
  const textoRetardado = useRetardo(texto, 300);
  // foco: bien destacado en mapa, tarjetas y lista lateral. Un objeto nuevo en cada petición, aunque sea el mismo bien.
  const [foco, setFoco] = useState(() => (Number.isInteger(bienUrl) ? { id: bienUrl, volar: true } : null));
  const [reinicio, setReinicio] = useState(0);

  const actualizar = useCallback(
    (cambios, reiniciarPagina = false) =>
      setParams(
        (previos) => {
          const siguientes = new URLSearchParams(previos);
          for (const [clave, valor] of Object.entries(cambios)) {
            if (valor === "" || valor == null) siguientes.delete(clave);
            else siguientes.set(clave, String(valor));
          }
          if (reiniciarPagina) siguientes.delete("page");
          return siguientes;
        },
        { replace: true },
      ),
    [setParams],
  );

  // La búsqueda escrita pasa a la URL tras la pausa (se puede compartir y sobrevive a «atrás»).
  useEffect(() => {
    if (textoRetardado.trim() !== q.trim()) actualizar({ q: textoRetardado.trim() }, true);
  }, [textoRetardado]); // eslint-disable-line react-hooks/exhaustive-deps

  const categorias = useDatos(useCallback((signal) => listarCategorias(signal), []));
  const lista = useDatos(useCallback((signal) => listarBienes({ q, categoria, page: pagina, pageSize: TAMANO_PAGINA }, signal), [q, categoria, pagina]));
  const mapa = useDatos(useCallback((signal) => listarMarcadores({ q, categoria }, signal), [q, categoria]));

  // Si la página pedida ya no existe (p. ej. tras filtrar), vuelve a la primera.
  useEffect(() => {
    if (lista.error?.estado === 404 && pagina > 1) actualizar({}, true);
  }, [lista.error, pagina, actualizar]);

  useEffect(() => {
    document.title = "Explorar el patrimonio · Paceño";
  }, []);

  const hayFiltros = Boolean(q || categoria);
  const limpiar = () => {
    setTexto("");
    actualizar({ q: "", categoria: "" }, true);
  };
  const restablecer = () => {
    limpiar();
    setFoco(null);
    setReinicio((n) => n + 1);
  };
  const enfocar = (id) => setFoco({ id, volar: true });

  // Al abrir con ?bien=… el parámetro ya cumplió su función: se quita para que «atrás» y los filtros no lo arrastren.
  const bienInicial = useRef(bienUrl);
  useEffect(() => {
    if (Number.isInteger(bienInicial.current)) actualizar({ bien: "" });
  }, [actualizar]);

  const total = lista.datos?.count;
  const marcadores = mapa.datos?.marcadores ?? [];
  const sinUbicacion = mapa.datos ? mapa.datos.total - marcadores.length : 0;
  const textoContador = total == null ? "" : total === 0 ? "Ningún bien coincide con tu búsqueda." : total === 1 ? "1 bien encontrado" : `${total} bienes encontrados`;

  return (
    <Marco
      activa="explorar"
      insignia="CARTOGRAFÍA PATRIMONIAL · LA PAZ"
      notaMenu="Mapa interactivo y catálogo patrimonial de La Paz"
      cta={{ descripcion: "Explora los circuitos patrimoniales y guarda tus paradas favoritas para armar tu recorrido cultural por la ciudad.", texto: "+ Armar ruta", a: "/rutas" }}
    >
      <section className="explore-header-strip">
        <div className="explore-title-group">
          <span className="explore-kicker">CARTOGRAFÍA INTERACTIVA · CHUKIAGO MARKA</span>
          <h1 className="explore-heading">Exploración Geográfica del Patrimonio</h1>
        </div>
        <div className="explore-stats-bar">
          <span className="stat-pill" role="status" aria-live="polite">
            <span className="stat-pill__dot" aria-hidden="true" />
            <span>{textoContador || "Cargando bienes…"}</span>
          </span>
          <Link to="/rutas" className="btn-outline-pill">
            Ver mi ruta guardada →
          </Link>
        </div>
      </section>

      <section className="geo-workspace" aria-label="Mapa interactivo y filtros patrimoniales">
        <div className="map-viewport-col explorar__mapa">
          <div className="map-floating-legend">
            <p className="map-floating-legend__title">
              <span className="stat-pill__dot" aria-hidden="true" />
              MAPA DE BIENES PACEÑOS
            </p>
            <p className="map-floating-legend__desc">Haz clic en cualquier marcador numerado o tarjeta para inspeccionar su ubicación y abrir la ficha completa.</p>
          </div>

          <button type="button" className="btn-outline-pill map-reset-btn" onClick={restablecer}>
            Restablecer vista
          </button>

          <MapaBienes
            className="interactive-map-canvas"
            bienes={marcadores}
            foco={foco}
            posicion={posicion}
            reinicio={reinicio}
            onSeleccionar={(id) => setFoco({ id, volar: false })}
            onAbrir={(id) => navegar(`/bienes/${id}`)}
          />
          {mapa.error && (
            <div className="mapa__aviso">
              <ErrorCarga error={mapa.error} onReintentar={mapa.reintentar} />
              <p>La lista sigue disponible.</p>
            </div>
          )}
          {mapa.datos && sinUbicacion > 0 && (
            <p className="mapa__nota">
              {sinUbicacion === 1 ? "1 bien no tiene" : `${sinUbicacion} bienes no tienen`} ubicación puntual y solo {sinUbicacion === 1 ? "aparece" : "aparecen"} en la lista.
            </p>
          )}

          <section className="map-results-strip explorar__lista" aria-label="Lista de bienes">
            <div className="map-results-strip__header">
              <span className="map-results-strip__label">RESULTADOS PATRIMONIALES SELECCIONABLES</span>
              <span className="map-results-strip__hint">Selecciona una tarjeta para abrir su vista de detalle</span>
            </div>
            {lista.cargando && !lista.datos && <Cargando texto="Cargando bienes…" />}
            {lista.error && lista.error.estado !== 404 && <ErrorCarga error={lista.error} onReintentar={lista.reintentar} />}
            {lista.datos && lista.datos.results.length === 0 && (
              <Vacio titulo="No encontramos bienes con esos criterios.">
                <p>Prueba con otra palabra o quita los filtros.</p>
                {hayFiltros && (
                  <button type="button" className="btn-outline-pill" onClick={limpiar}>
                    Quitar filtros
                  </button>
                )}
              </Vacio>
            )}
            {lista.datos && lista.datos.results.length > 0 && (
              <>
                <ListaBienes bienes={lista.datos.results} seleccionado={foco?.id} />
                <Paginacion pagina={pagina} total={lista.datos.count} tamano={TAMANO_PAGINA} onCambiar={(n) => actualizar({ page: n === 1 ? "" : n })} />
              </>
            )}
          </section>
        </div>

        <aside className="filter-sidebar-col" aria-label="Panel lateral de búsqueda y filtros">
          <Filtros
            texto={texto}
            onTexto={setTexto}
            categoria={categoria}
            onCategoria={(valor) => actualizar({ categoria: valor }, true)}
            categorias={categorias.datos ?? []}
            hayFiltros={hayFiltros}
            onLimpiar={limpiar}
          />
          <BarraUbicacion />
          <div className="sidebar-section">
            <span className="sidebar-label">04. ACCESO RÁPIDO A MARCADORES</span>
            <ul className="sidebar-mini-list" aria-label="Bienes con ubicación en el mapa">
              {marcadores.map((bien) => (
                <li key={bien.id} className={`sidebar-site-item${foco?.id === bien.id ? " is-selected" : ""}`}>
                  <button type="button" className="sidebar-site-item__name" onClick={() => enfocar(bien.id)}>
                    {bien.nombre}
                  </button>
                  <Link to={`/bienes/${bien.id}`} className="sidebar-site-item__go" aria-label={`Abrir ficha de ${bien.nombre}`}>
                    Ficha →
                  </Link>
                </li>
              ))}
            </ul>
            {mapa.datos && marcadores.length === 0 && <p className="ubicacion__texto">Ningún marcador coincide con los filtros.</p>}
          </div>
        </aside>
      </section>

      <Narrativa />
    </Marco>
  );
}
