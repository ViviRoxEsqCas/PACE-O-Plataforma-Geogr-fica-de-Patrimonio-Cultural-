import { LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import { useCatalogo } from "../hooks/Catalogo";
import { useSesion } from "../hooks/Sesion";
import { urlRecurso } from "../lib/api";
import { conPortadaPrimero } from "../lib/bienes";
import { ENLACES, useRutaPatrimonio } from "./Cabecera";
import Foto from "./Foto";

/**
 * Barra lateral flotante (escritorio y tablet) y dock inferior (móvil), como el «Sidebar» de la referencia.
 * Se expande al pasar el puntero o al enfocar con el teclado. `insignia` es la etiqueta de la pantalla actual.
 */
export default function BarraLateral({ activa, insignia, notaMenu }) {
  const rutaPatrimonio = useRutaPatrimonio();
  const { bienes } = useCatalogo();
  const { perfil } = useSesion();
  const portada = conPortadaPrimero(bienes)[0]?.portada;
  const inicial = (perfil?.nombre_visible || perfil?.username || "?").trim().charAt(0).toUpperCase();

  return (
    <>
      <aside className="sidebar editorial-glass" aria-label="Barra lateral">
        <div>
          <div className="sidebar__photo">
            <Foto as="div" src={portada?.url} alt="" etiqueta="Paisaje" tono="neutral" />
            <div className="sidebar__dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="sidebar__brand">
            <Link to="/" className="sidebar__brand-mark" aria-label="Inicio PACEÑO" tabIndex={-1}>
              P
            </Link>
            <div className="sidebar__reveal" aria-hidden="true">
              <span className="sidebar__title">
                paceño<span className="brand-logo__faint">archivo</span>
              </span>
              <span className="sidebar__sub">{insignia || "patrimonio · 2026"}</span>
            </div>
          </div>
        </div>

        <nav className="sidebar__nav" aria-label="Secciones" aria-description={notaMenu || undefined}>
          {ENLACES.map(([clave, , titulo, destino, Icono, indice]) => (
            <Link key={clave} to={destino ?? rutaPatrimonio} className={`sidebar__link${activa === clave ? " is-active" : ""}`} aria-current={activa === clave ? "page" : undefined} aria-label={titulo}>
              <span className="sidebar__icon">
                <Icono aria-hidden="true" />
              </span>
              <span className="sidebar__label sidebar__reveal" aria-hidden="true">
                <span>{titulo}</span>
                <span className="sidebar__index">/ {indice}</span>
              </span>
            </Link>
          ))}
        </nav>

        <div className="sidebar__user">
          {perfil ? (
            <Link to="/cuenta" className="sidebar__user-link" aria-label={`Mi cuenta: ${perfil.nombre_visible}`}>
              <span className="sidebar__avatar">{perfil.foto ? <img src={urlRecurso(perfil.foto)} alt="" /> : inicial}</span>
              <span className="sidebar__reveal" aria-hidden="true">
                <span className="sidebar__user-name">{perfil.nombre_visible}</span>
                <span className="sidebar__user-handle">@{perfil.username}</span>
              </span>
            </Link>
          ) : (
            <Link to="/cuenta" className="sidebar__user-link sidebar__user-link--login" aria-label="Iniciar sesión">
              <span className="sidebar__avatar" style={{ background: "transparent", border: 0 }}>
                <LogIn aria-hidden="true" />
              </span>
              <span className="sidebar__reveal sidebar__user-name" aria-hidden="true">
                Iniciar sesión
              </span>
            </Link>
          )}
        </div>
      </aside>

      <nav className="dock editorial-glass" aria-label="Navegación móvil">
        {ENLACES.map(([clave, , titulo, destino, Icono, , corta]) => (
          <Link key={clave} to={destino ?? rutaPatrimonio} className={`dock__link${activa === clave ? " is-active" : ""}`} aria-current={activa === clave ? "page" : undefined} aria-label={titulo}>
            <Icono aria-hidden="true" />
            <span className="dock__label" aria-hidden="true">
              {corta}
            </span>
          </Link>
        ))}
      </nav>
    </>
  );
}
