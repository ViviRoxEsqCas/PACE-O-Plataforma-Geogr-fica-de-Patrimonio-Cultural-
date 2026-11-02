import { useId } from "react";

export default function Filtros({ texto, onTexto, categoria, onCategoria, categorias, hayFiltros, onLimpiar }) {
  const idBusqueda = useId();
  const idCategoria = useId();
  return (
    <form className="filtros" role="search" aria-label="Buscar bienes" onSubmit={(e) => e.preventDefault()}>
      <div className="campo">
        <label htmlFor={idBusqueda}>Buscar por nombre</label>
        <input
          id={idBusqueda}
          type="search"
          value={texto}
          onChange={(e) => onTexto(e.target.value)}
          placeholder="Por ejemplo: plaza"
          autoComplete="off"
          enterKeyHint="search"
        />
      </div>
      <div className="campo">
        <label htmlFor={idCategoria}>Categoría</label>
        <select id={idCategoria} value={categoria} onChange={(e) => onCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} ({c.total_bienes})
            </option>
          ))}
        </select>
      </div>
      {hayFiltros && (
        <button type="button" className="boton boton--texto" onClick={onLimpiar}>
          Quitar filtros
        </button>
      )}
    </form>
  );
}
