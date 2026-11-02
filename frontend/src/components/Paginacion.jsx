export default function Paginacion({ pagina, total, tamano, onCambiar }) {
  const paginas = Math.max(1, Math.ceil(total / tamano));
  if (paginas <= 1) return null;
  return (
    <nav className="paginacion" aria-label="Páginas de resultados">
      <button type="button" className="boton boton--secundario" disabled={pagina <= 1} onClick={() => onCambiar(pagina - 1)}>
        Anterior
      </button>
      <span aria-live="polite">
        Página {pagina} de {paginas}
      </span>
      <button type="button" className="boton boton--secundario" disabled={pagina >= paginas} onClick={() => onCambiar(pagina + 1)}>
        Siguiente
      </button>
    </nav>
  );
}
