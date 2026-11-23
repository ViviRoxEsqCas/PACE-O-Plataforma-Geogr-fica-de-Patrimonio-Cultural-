import { Search } from "lucide-react";
import { useId } from "react";

/** Secciones 01 (búsqueda directa) y 02 (categorías patrimoniales) del panel lateral. */
export default function Filtros({ texto, onTexto, categoria, onCategoria, categorias, hayFiltros, onLimpiar }) {
  const idBusqueda = useId();
  const total = categorias.reduce((suma, c) => suma + c.total_bienes, 0);
  const chips = [{ id: "", nombre: "Todos los patrimonios", total_bienes: total }, ...categorias];

  return (
    <>
      <div className="sidebar-section">
        <label htmlFor={idBusqueda} className="sidebar-label">
          <span>01. BÚSQUEDA DIRECTA</span>
        </label>
        <div className="search-input-box">
          <Search className="search-input-box__icon" aria-hidden="true" />
          <input
            id={idBusqueda}
            type="search"
            className="search-input"
            aria-label="Buscar por nombre"
            value={texto}
            onChange={(e) => onTexto(e.target.value)}
            placeholder="Ej. plaza, Murillo, cueca…"
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>
      </div>

      <div className="sidebar-section">
        <span className="sidebar-label" id="etiqueta-categorias">
          02. CATEGORÍAS PATRIMONIALES
        </span>
        <div className="category-pills-list" role="group" aria-labelledby="etiqueta-categorias">
          {chips.map((c) => {
            const activa = String(c.id) === String(categoria);
            return (
              <button key={c.id === "" ? "todos" : c.id} type="button" className={`category-chip${activa ? " is-active" : ""}`} aria-pressed={activa} onClick={() => onCategoria(String(c.id))}>
                <span>{c.nombre}</span>
                <span className="category-chip__count">{c.total_bienes}</span>
              </button>
            );
          })}
        </div>
        {hayFiltros && (
          <button type="button" className="btn-text sidebar-clear" onClick={onLimpiar}>
            Quitar filtros
          </button>
        )}
      </div>
    </>
  );
}
