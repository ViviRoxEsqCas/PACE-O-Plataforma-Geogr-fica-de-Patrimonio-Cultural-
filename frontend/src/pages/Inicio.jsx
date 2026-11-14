import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Cabecera from "../components/Cabecera";
import Foto from "../components/Foto";
import { useCatalogo } from "../hooks/Catalogo";
import { conPortadaPrimero, enlaceMapa, nombreCorto } from "../lib/bienes";

const FLECHA = {
  prev: "M6.5 1.5L2 6L6.5 10.5",
  next: "M1.5 1.5L6 6L1.5 10.5",
};

function Flecha({ lado, activa, onClick }) {
  return (
    <button type="button" className={`arrow-btn arrow-btn--${lado}${activa ? " is-crimson" : ""}`} aria-label={lado === "prev" ? "Anterior" : "Siguiente"} onClick={onClick}>
      <svg width="8" height="12" viewBox="0 0 8 12" fill="none" aria-hidden="true">
        <path d={FLECHA[lado]} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

const dos = (n) => String(n).padStart(2, "0");

/** Diapositivas de la portada: la presentación del diseño, la ruta temática y bienes reales del catálogo. */
function useDiapositivas(bienes) {
  return useMemo(() => {
    const destacados = conPortadaPrimero(bienes);
    const bien = (i) => (destacados.length ? destacados[i % destacados.length] : null);
    const ficha = (b) => (b ? { a: `/bienes/${b.id}`, texto: `Ver ficha: ${nombreCorto(b.nombre, 30)} →` } : null);

    const intro = {
      kicker: "01 / PATRIMONIO VIVO · LA PAZ",
      caption: "DESCUBRE EL ALMA\nHISTÓRICA Y CULTURAL\nDE LA PAZ",
      cta: { texto: "Explorar mapa patrimonial", a: "/explorar" },
      bien: bien(0),
    };
    const dePatrimonio = [1, 2, 3].filter((i) => destacados.length > i).map((i, n) => {
      const b = bien(i);
      return {
        kicker: `${dos(n + 2)} / ${b.categoria.nombre.toUpperCase()} · LA PAZ`,
        caption: `${b.tipo === "material" ? "VISITA" : "VIVE"}\n${b.nombre}`,
        cta: { texto: "Explorar en el mapa", a: enlaceMapa(b) },
        bien: b,
      };
    });
    const rutas = {
      kicker: `${dos(dePatrimonio.length + 2)} / RUTAS TEMÁTICAS · PACEÑO`,
      caption: "DISEÑA TU PROPIO\nRECORRIDO CULTURAL\nPOR NUESTRA CIUDAD",
      cta: { texto: "Ver rutas temáticas", a: "/rutas" },
      bien: bien(dePatrimonio.length + 1),
    };
    return [intro, ...dePatrimonio, rutas].map((d) => ({ ...d, detalle: ficha(d.bien) }));
  }, [bienes]);
}

export default function Inicio() {
  const { bienes } = useCatalogo();
  const diapositivas = useDiapositivas(bienes);
  const [actual, setActual] = useState(0);
  const [atenuada, setAtenuada] = useState(false);
  const [flechaActiva, setFlechaActiva] = useState("prev");
  const marco = useRef(null);
  const temporizador = useRef(null);

  useEffect(() => {
    document.title = "PACEÑO · Patrimonio vivo de La Paz";
    return () => clearTimeout(temporizador.current);
  }, []);

  // Cambio con el mismo fundido breve del diseño (el texto se atenúa, cambia y reaparece).
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

  // Paralaje suave de las composiciones al mover el cursor (solo con puntero fino).
  const mover = (evento) => {
    if (!window.matchMedia("(pointer: fine)").matches || !marco.current) return;
    const caja = marco.current.getBoundingClientRect();
    const relX = (evento.clientX - caja.left) / caja.width - 0.5;
    const relY = (evento.clientY - caja.top) / caja.height - 0.5;
    marco.current.querySelectorAll("[data-parallax]").forEach((el) => {
      const profundidad = Number(el.dataset.parallax) || 10;
      const x = (relX * profundidad).toFixed(2);
      const y = (relY * profundidad).toFixed(2);
      el.style.transform = el.dataset.centrado ? `translate(calc(-50% + ${x}px), ${y}px)` : `translate(${x}px, ${y}px)`;
    });
  };
  const soltar = () => {
    marco.current?.querySelectorAll("[data-parallax]").forEach((el) => {
      el.style.transform = el.dataset.centrado ? "translate(-50%, 0px)" : "translate(0px, 0px)";
    });
  };

  return (
    <main className="viewport-shell viewport-shell--centered" id="contenido">
      <div className="hero-frame" ref={marco} onMouseMove={mover} onMouseLeave={soltar}>
        <Cabecera activa="inicio" insignia="LA PAZ · BOLIVIA (2026) ©" notaMenu="Archivo Digital del Patrimonio Cultural Paceño" animada />

        <section className="hero-stage" aria-label="Presentación PACEÑO">
          <div className="stage-left reveal-up reveal-delay-1">
            <div className="vertical-headline-group">
              <h1 className="vertical-title" aria-label="PACEÑO LA PAZ">
                <span className="vertical-col vertical-col--primary" aria-hidden="true">PACEÑO</span>
                <span className="vertical-col vertical-col--secondary" aria-hidden="true">LA PAZ</span>
              </h1>
            </div>

            <div className="slider-arrows" role="group" aria-label="Controles de diapositiva">
              <Flecha lado="prev" activa={flechaActiva === "prev"} onClick={() => { setFlechaActiva("prev"); ir(indice - 1); }} />
              <Flecha lado="next" activa={flechaActiva === "next"} onClick={() => { setFlechaActiva("next"); ir(indice + 1); }} />
            </div>
          </div>

          <div className="stage-center reveal-up reveal-delay-2">
            <div className="geo-sun-circle" data-parallax="14" data-centrado="1" aria-hidden="true" />
            <div className="geo-ground-arch" data-parallax="8" data-centrado="1" aria-hidden="true" />
            <Foto className="asset-slot--hero-frog" cover={false} transparente data-parallax="24" src="/assets/images/illustrations/hero-main.png" alt="Ilustración principal PACEÑO" etiqueta="HERO ASSET" pista="assets/images/illustrations/hero-main.png" />
          </div>

          <div className="stage-right reveal-up reveal-delay-3">
            <div className="right-upper-row">
              <Foto
                as={dia.detalle ? Link : "div"}
                {...(dia.detalle ? { to: dia.detalle.a } : {})}
                className="asset-slot--geisha-circle"
                data-parallax="16"
                aria-label="Explorar patrimonio destacado"
                src={dia.bien?.portada?.url}
                alt={dia.bien?.portada?.texto_alternativo || dia.bien?.nombre || ""}
                etiqueta="DESTACADO"
              />

              <div className="vertical-pagination" role="tablist" aria-label="Indicadores de sección">
                {diapositivas.map((_, i) => (
                  <button key={i} type="button" role="tab" className={`page-marker${i === indice ? " is-active" : ""}`} aria-selected={i === indice} aria-label={`Diapositiva ${i + 1}`} onClick={() => ir(i)} />
                ))}
              </div>
            </div>

            <div className="cta-block">
              <span className="hero-kicker">{dia.kicker}</span>
              <p className="hero-description" aria-live="polite" style={{ opacity: atenuada ? 0 : 1, transform: atenuada ? "translateY(6px)" : "translateY(0)" }}>
                {dia.caption}
              </p>

              <div className="cta-actions-stack">
                <Link to={dia.cta.a} className="cta-pill-btn">
                  <span className="cta-plus" aria-hidden="true">+</span>
                  <span className="cta-label">{dia.cta.texto}</span>
                </Link>
                {dia.detalle && (
                  <Link to={dia.detalle.a} className="hero-secondary-link">
                    {dia.detalle.texto}
                  </Link>
                )}
              </div>
            </div>

            <Foto className="asset-slot--corner-frog" cover={false} transparente data-parallax="12" src="/assets/images/floating/corner-character.png" alt="Ilustración flotante PACEÑO" etiqueta="FLOTANTE" />
          </div>
        </section>
      </div>
    </main>
  );
}
