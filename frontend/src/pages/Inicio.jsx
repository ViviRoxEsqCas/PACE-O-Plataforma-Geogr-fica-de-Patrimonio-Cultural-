import { ArrowUpRight, ChevronLeft, ChevronRight, Compass, MapPin } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Foto from "../components/Foto";
import Marco from "../components/Marco";
import { AbejaVoxel, ExploradoresVoxel, PatitoDoodle, SelloCircular } from "../components/Stickers";
import { useCatalogo } from "../hooks/Catalogo";
import { useSesion } from "../hooks/Sesion";
import { conPortadaPrimero, enlaceMapa, nombreCorto } from "../lib/bienes";

const dos = (n) => String(n).padStart(2, "0");

/** Diapositivas de la portada: la presentación del diseño, la ruta temática y bienes reales del catálogo. */
function useDiapositivas(bienes) {
  return useMemo(() => {
    const destacados = conPortadaPrimero(bienes);
    const bien = (i) => (destacados.length ? destacados[i % destacados.length] : null);
    const ficha = (b) => (b ? { a: `/bienes/${b.id}`, texto: `Ver ficha: ${nombreCorto(b.nombre, 30)} →` } : null);

    const intro = {
      kicker: "01 / PATRIMONIO VIVO · LA PAZ",
      caption: "Descubre el alma histórica y cultural de La Paz",
      cta: { texto: "Explorar mapa patrimonial", a: "/explorar" },
      bien: bien(0),
    };
    const dePatrimonio = [1, 2, 3].filter((i) => destacados.length > i).map((i, n) => {
      const b = bien(i);
      return {
        kicker: `${dos(n + 2)} / ${b.categoria.nombre.toUpperCase()} · LA PAZ`,
        caption: `${b.tipo === "material" ? "Visita" : "Vive"} ${b.nombre}`,
        cta: { texto: "Explorar en el mapa", a: enlaceMapa(b) },
        bien: b,
      };
    });
    const rutas = {
      kicker: `${dos(dePatrimonio.length + 2)} / RUTAS TEMÁTICAS · PACEÑO`,
      caption: "Diseña tu propio recorrido cultural por nuestra ciudad",
      cta: { texto: "Ver rutas temáticas", a: "/rutas" },
      bien: bien(dePatrimonio.length + 1),
    };
    return [intro, ...dePatrimonio, rutas].map((d) => ({ ...d, detalle: ficha(d.bien) }));
  }, [bienes]);
}

export default function Inicio() {
  const { bienes } = useCatalogo();
  const { perfil } = useSesion();
  const diapositivas = useDiapositivas(bienes);
  const [actual, setActual] = useState(0);
  const [atenuada, setAtenuada] = useState(false);
  const temporizador = useRef(null);

  useEffect(() => {
    document.title = "PACEÑO · Patrimonio vivo de La Paz";
    return () => clearTimeout(temporizador.current);
  }, []);

  // Cambio con un fundido breve (el texto se atenúa, cambia y reaparece).
  const ir = (indice) => {
    const siguiente = (indice + diapositivas.length) % diapositivas.length;
    clearTimeout(temporizador.current);
    setAtenuada(true);
    temporizador.current = setTimeout(() => {
      setActual(siguiente);
      setAtenuada(false);
    }, 180);
  };
  const indice = Math.min(actual, diapositivas.length - 1);
  const dia = diapositivas[indice];
  const lateral = diapositivas[(indice + 1) % diapositivas.length].bien;
  const fotos = conPortadaPrimero(bienes);
  const foto = (i) => fotos[i]?.portada;

  const capitulos = [
    { indice: "01", titulo: "Explorar fichas", texto: `Un catálogo documentado${bienes.length ? ` de ${bienes.length} bienes` : ""} con mapa interactivo, búsqueda sin tildes y fuentes verificables.`, etiqueta: "Mapa & catálogo", a: "/explorar" },
    { indice: "02", titulo: "Rutas curadas", texto: "Recorridos temáticos por categoría y un itinerario personal que se guarda solo en tu navegador.", etiqueta: "Itinerarios", a: "/rutas" },
    { indice: "03", titulo: "Comunidad visual", texto: "Valora, comenta y marca los bienes que visitaste; suma logros y conecta con otras personas.", etiqueta: "Bitácora social", a: "/ranking" },
  ];

  return (
    <Marco activa="inicio" insignia="LA PAZ · BOLIVIA (2026)" notaMenu="Archivo Digital del Patrimonio Cultural Paceño">
      <div className="home">
        {/* Portada: tríptico asimétrico (vertical · protagonista · vertical) */}
        <section className="home-hero" aria-label="Presentación PACEÑO">
          <div className="page-head">
            <div>
              <p className="kicker">{dia.kicker}</p>
              <h1 className="page-title">Patrimonio vivo de La Paz</h1>
            </div>

            <div className="page-head__actions">
              {!perfil && (
                <Link to="/cuenta" className="btn-outline-pill">
                  acceder
                </Link>
              )}
              {dia.detalle && (
                <Link to={dia.detalle.a} className="btn-outline-pill">
                  {dia.detalle.texto}
                </Link>
              )}
              <Link to={dia.cta.a} className="btn-paper-pill">
                {dia.cta.texto}
                <ArrowUpRight aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="triptych">
            <AbejaVoxel className="triptych__bee" />

            <figure className="triptych__col triptych__col--side">
              <Foto as="div" className="triptych__photo slot--sm" tono="warm" src="/assets/images/illustrations/foto_1.jpeg" alt={lateral?.portada?.texto_alternativo || lateral?.nombre || ""} etiqueta="Portada lateral" pista="Fotografía de una ficha del catálogo" />
              <figcaption className="folio">
                <span>/ 01</span>
                <span className="folio__faint">{lateral ? nombreCorto(lateral.nombre, 22) : "folio norte"}</span>
              </figcaption>
            </figure>

            <figure className="triptych__col triptych__col--main">
              <div className="triptych__stage">
                <Foto
                  as={dia.detalle ? Link : "div"}
                  {...(dia.detalle ? { to: dia.detalle.a } : {})}
                  className="triptych__photo slot--sm"
                  tono="sage"
                  aria-label="Explorar patrimonio destacado"
                  src="/assets/images/illustrations/foto_6.jpeg"
                  alt={dia.bien?.portada?.texto_alternativo || dia.bien?.nombre || ""}
                  etiqueta="Fotografía protagonista"
                  pista="Fotografía destacada del catálogo"
                />
                <SelloCircular className="triptych__seal" />
              </div>
              <figcaption className="folio">
                <span className="folio__strong hero-description" aria-live="polite" style={{ opacity: atenuada ? 0 : 1 }}>
                  {dia.caption}
                </span>
                <span>/ 02</span>
              </figcaption>
            </figure>

            <figure className="triptych__col triptych__col--side">
              <Foto as="div" className="triptych__photo triptych__photo--art slot--sm" tono="slate" cover={false} imgClassName="diecut" src="/assets/images/illustrations/foto_2.jpeg" alt="Ilustración principal PACEÑO" etiqueta="Detalle lateral" pista="assets/images/illustrations/hero-main.png" />
              <figcaption className="folio">
                <span className="folio__faint">paceño.archivo</span>
                <span>/ 03</span>
              </figcaption>
            </figure>
          </div>

          <div className="home-hero__foot">
            <div className="slider-controls" role="group" aria-label="Controles de diapositiva">
              <button type="button" className="arrow-btn" aria-label="Anterior" onClick={() => ir(indice - 1)}>
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <button type="button" className="arrow-btn is-sage" aria-label="Siguiente" onClick={() => ir(indice + 1)}>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
              <div className="page-dots" role="tablist" aria-label="Indicadores de sección">
                {diapositivas.map((_, i) => (
                  <button key={i} type="button" role="tab" className={`page-dot${i === indice ? " is-active" : ""}`} aria-selected={i === indice} aria-label={`Diapositiva ${i + 1}`} onClick={() => ir(i)} />
                ))}
              </div>
            </div>
            <div className="home-hero__credit">
              <span>curaduría paceño archivo · 2026</span>
              <PatitoDoodle />
            </div>
          </div>
        </section>

        {/* Manifiesto editorial con tarjetas redondeadas y sticker troquelado */}
        <section className="manifesto">
          <div className="manifesto__copy">
            <span className="script-note">archivo & memoria viva!</span>
            <h2 className="section-title">Memoria, territorio y patrimonio en una misma hoyada.</h2>
            <p className="manifesto__lead">
              PACEÑO articula la cartografía digital con el registro visual de plazas, templos barrocos, calles coloniales y miradores de altura. Cada punto del mapa conecta la historia urbana de La Paz con recorridos accesibles para residentes y visitantes.
            </p>
            <p className="manifesto__small">Cada ficha cita sus fuentes documentales y se conecta con el catálogo patrimonial de la ciudad.</p>
            <div className="manifesto__actions">
              <Link to="/explorar" className="cta-pill-btn">
                <Compass aria-hidden="true" />
                Abrir mapa
              </Link>
              <Link to="/rutas" className="btn-outline-pill">
                <MapPin aria-hidden="true" className="icon-terracotta" />
                Explorar rutas
              </Link>
            </div>
          </div>

          <div className="manifesto__cards">
            <div className="manifesto__grid">
              <Foto as="div" className="slot--xl manifesto__photo" tono="neutral" src={foto(0)?.url} alt={foto(0)?.texto_alternativo || ""} etiqueta="Estudio visual A" pista="Se completa con la portada de las fichas" />
              <Foto as="div" className="slot--xl manifesto__photo" tono="warm" src={foto(1)?.url} alt={foto(1)?.texto_alternativo || ""} etiqueta="Estudio visual B" pista="Se completa con la portada de las fichas" />
            </div>
            <ExploradoresVoxel className="manifesto__sticker" />
            <img className="diecut manifesto__character" src="/assets/images/floating/corner-character.png" alt="" aria-hidden="true" loading="lazy" />
          </div>
        </section>

        {/* Capítulos de navegación */}
        <section className="chapters" aria-label="Capítulos de la plataforma">
          {capitulos.map((c) => (
            <Link key={c.indice} to={c.a} className="chapter-card editorial-card">
              <span className="chapter-card__top">
                <span>
                  / {c.indice} · {c.etiqueta}
                </span>
                <ArrowUpRight aria-hidden="true" />
              </span>
              <span>
                <span className="chapter-card__title">{c.titulo}</span>
                <span className="chapter-card__text">{c.texto}</span>
              </span>
            </Link>
          ))}
        </section>
      </div>
    </Marco>
  );
}
