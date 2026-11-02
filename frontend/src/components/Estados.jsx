export function Cargando({ texto = "Cargando…" }) {
  return (
    <p className="estado estado--cargando" role="status">
      <span className="giro" aria-hidden="true" />
      {texto}
    </p>
  );
}

export function ErrorCarga({ error, onReintentar }) {
  return (
    <div className="estado estado--error" role="alert">
      <p>{error?.message ?? "Ocurrió un error inesperado."}</p>
      {onReintentar && (
        <button type="button" className="boton boton--secundario" onClick={onReintentar}>
          Reintentar
        </button>
      )}
    </div>
  );
}

export function Vacio({ titulo, children }) {
  return (
    <div className="estado estado--vacio">
      <p className="estado__titulo">{titulo}</p>
      {children}
    </div>
  );
}
