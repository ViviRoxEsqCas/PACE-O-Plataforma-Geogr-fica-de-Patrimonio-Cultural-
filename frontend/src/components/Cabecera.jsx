import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useCatalogo } from "../hooks/Catalogo";

/** Enlace a una ficha de muestra: la primera del catálogo (o el mapa si aún no hay datos). */
export function useRutaPatrimonio() {
  const { bienes } = useCatalogo();
  return bienes[0] ? `/bienes/${bienes[0].id}` : "/explorar";
}

const ENLACES = [
  ["inicio", "INICIO", "01. INICIO", "/"],
  ["explorar", "EXPLORAR MAPA", "02. EXPLORACIÓN GEOGRÁFICA", "/explorar"],
  ["patrimonio", "PATRIMONIO", "03. FICHA PATRIMONIAL", null],
  ["rutas", "RUTAS", "04. RUTAS E ITINERARIOS", "/rutas"],
];

/**
 * Barra superior del diseño (marca, insignia, navegación y botón de menú) con el menú superpuesto.
 * `activa`: inicio | explorar | patrimonio | rutas. `bordeada`: variante de las pantallas interiores.
 */
export default function Cabecera({ activa, insignia, notaMenu, bordeada = false, animada = false }) {
  const [abierto, setAbierto] = useState(false);
  const rutaPatrimonio = useRutaPatrimonio();
  const cerrar = useRef(null);
  const aPatrimonio = (a) => a ?? rutaPatrimonio;

  useEffect(() => {
    if (!abierto) return undefined;
    cerrar.current?.focus();
    const alTeclear = (e) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  return (
    <>
      <header className={`top-bar${bordeada ? " top-bar--bordered" : ""}${animada ? " reveal-up" : ""}`}>
        <div className="top-bar__left">
          <Link to="/" className="brand-logo" aria-label="Inicio PACEÑO">
            行旅 <span className="brand-logo__sub">PACEÑO</span>
          </Link>
          <div className="copyright-badge">
            <span className="copyright-pill" aria-hidden="true" />
            <span className="copyright-text">{insignia}</span>
          </div>
        </div>

        <nav className="top-bar__nav" aria-label="Navegación principal">
          <ul className="nav-list">
            {ENLACES.map(([clave, etiqueta, , destino]) => (
              <li key={clave}>
                <Link to={aPatrimonio(destino)} className={`nav-link${activa === clave ? " is-active" : ""}`} aria-current={activa === clave ? "page" : undefined}>
                  {etiqueta}
                </Link>
              </li>
            ))}
          </ul>
          <button
            className="menu-pill-btn"
            type="button"
            aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={abierto}
            aria-controls="drawerOverlay"
            onClick={() => setAbierto((v) => !v)}
          >
            <span className="menu-line" />
            <span className="menu-line" />
          </button>
        </nav>
      </header>

      <aside
        className={`drawer-overlay${abierto ? " is-open" : ""}`}
        id="drawerOverlay"
        aria-hidden={!abierto}
        onClick={(e) => e.target === e.currentTarget && setAbierto(false)}
      >
        <button type="button" className="drawer-close-btn" aria-label="Cerrar menú" ref={cerrar} onClick={() => setAbierto(false)} tabIndex={abierto ? 0 : -1}>
          ✕
        </button>
        <div className="drawer-content">
          <p className="drawer-label">NAVEGACIÓN / PACEÑO · LA PAZ</p>
          <ul className="drawer-links">
            {ENLACES.map(([clave, , etiqueta, destino]) => (
              <li key={clave}>
                <Link to={aPatrimonio(destino)} className={activa === clave ? "is-active" : undefined} tabIndex={abierto ? 0 : -1} onClick={() => setAbierto(false)}>
                  {etiqueta}
                </Link>
              </li>
            ))}
          </ul>
          <p className="drawer-meta">{notaMenu}</p>
        </div>
      </aside>
    </>
  );
}
