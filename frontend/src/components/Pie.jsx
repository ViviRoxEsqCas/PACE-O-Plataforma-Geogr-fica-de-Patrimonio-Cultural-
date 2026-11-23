import { Link } from "react-router-dom";
import { useCatalogo } from "../hooks/Catalogo";
import { useRutaPatrimonio } from "./Cabecera";
import { PatitoDoodle } from "./Stickers";

/** Pie global del diseño. `cta`: { texto, descripcion, etiqueta, a } cambia el recuadro de la derecha según la pantalla. */
export default function Pie({ cta }) {
  const { bienes } = useCatalogo();
  const rutaPatrimonio = useRutaPatrimonio();
  const destacados = bienes.slice(0, 4);
  const { etiqueta = "ARCHIVO ABIERTO · LA PAZ", descripcion, texto = "+ Armar ruta", a = "/rutas" } = cta ?? {};

  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <Link to="/" className="footer-brand__mark" aria-label="Inicio PACEÑO">
            paceño<span className="brand-logo__faint">archivo</span>
          </Link>
          <p className="footer-brand__desc">
            Plataforma interactiva de documentación, cartografía y puesta en valor del patrimonio cultural, arquitectónico e inmaterial de La Paz, Bolivia.
          </p>
        </div>

        <div>
          <h4 className="footer-col__title">Navegación</h4>
          <ul className="footer-links">
            <li><Link to="/">Inicio · Portada Editorial</Link></li>
            <li><Link to="/explorar">Exploración Geográfica</Link></li>
            <li><Link to={rutaPatrimonio}>Fichas Patrimoniales</Link></li>
            <li><Link to="/rutas">Rutas Culturales</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="footer-col__title">Sitios Destacados</h4>
          <ul className="footer-links">
            {destacados.length === 0 && (
              <li><Link to="/explorar">Ver el catálogo completo</Link></li>
            )}
            {destacados.map((bien) => (
              <li key={bien.id}>
                <Link to={`/bienes/${bien.id}`}>{bien.nombre}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="footer-badge-box">
          <span className="footer-badge-box__label">{etiqueta}</span>
          <p className="footer-badge-box__text">
            {descripcion ?? "Explora los circuitos patrimoniales y guarda tus paradas favoritas para armar tu recorrido cultural por la ciudad."}
          </p>
          <Link to={a} className="cta-pill-btn footer-badge-box__cta">
            {texto}
          </Link>
        </div>
      </div>

      <div className="footer-bottom">
        <span>
          <span className="footer-bottom__dot" aria-hidden="true" />
          PACEÑO · PROYECTO PATRIMONIAL LA PAZ (2026)
        </span>
        <span>CARTOGRAFÍA CULTURAL &amp; DISEÑO EDITORIAL</span>
        <span className="footer-bottom__credits">
          Taller de Proyecto · Informática · UMSA · Mapa base © OpenStreetMap y CARTO
          <PatitoDoodle />
        </span>
      </div>
    </footer>
  );
}
