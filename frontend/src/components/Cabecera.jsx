import { Compass, Home, Landmark, Map, User, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useCatalogo } from "../hooks/Catalogo";

/** Enlace a una ficha de muestra: la primera del catálogo (o el mapa si aún no hay datos). */
export function useRutaPatrimonio() {
  const { bienes } = useCatalogo();
  return bienes[0] ? `/bienes/${bienes[0].id}` : "/explorar";
}

/**
 * Secciones de la navegación (barra superior, barra lateral y dock móvil).
 * [clave, etiqueta, título, destino (null = primera ficha del catálogo), icono, índice, etiqueta corta del dock]
 */
export const ENLACES = [
  ["inicio", "inicio", "Inicio", "/", Home, "01", "Inicio"],
  ["explorar", "explorar", "Explorar mapa", "/explorar", Compass, "02", "Mapa"],
  ["patrimonio", "patrimonio", "Patrimonio", null, Landmark, "03", "Fichas"],
  ["rutas", "rutas", "Rutas", "/rutas", Map, "04", "Rutas"],
  ["comunidad", "comunidad", "Comunidad", "/ranking", Users, "05", "Social"],
  ["cuenta", "cuenta", "Mi cuenta", "/cuenta", User, "06", "Cuenta"],
];

/** Barra superior editorial: marca y enlaces de texto (la navegación principal con iconos vive en la barra lateral). */
export default function Cabecera({ activa }) {
  const rutaPatrimonio = useRutaPatrimonio();
  return (
    <header className="top-bar">
      <Link to="/" className="brand-logo" aria-label="Inicio PACEÑO">
        paceño<span className="brand-logo__faint">archivo</span>
      </Link>

      <nav className="top-bar__nav" aria-label="Navegación principal">
        {ENLACES.map(([clave, etiqueta, , destino]) => (
          <Link key={clave} to={destino ?? rutaPatrimonio} className={`nav-link${activa === clave ? " is-active" : ""}`} aria-current={activa === clave ? "page" : undefined}>
            {etiqueta}
          </Link>
        ))}
      </nav>
    </header>
  );
}
