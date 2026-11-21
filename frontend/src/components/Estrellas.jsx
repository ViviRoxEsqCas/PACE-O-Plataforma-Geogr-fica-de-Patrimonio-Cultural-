import { useId } from "react";

/** Estrellas de solo lectura (promedio o valoración ajena). */
export function EstrellasLectura({ valor, etiqueta }) {
  const llenas = Math.round(valor ?? 0);
  return (
    <span className="estrellas" role="img" aria-label={etiqueta ?? `${valor ?? 0} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} aria-hidden="true" className={n <= llenas ? "estrella is-llena" : "estrella"}>
          ★
        </span>
      ))}
    </span>
  );
}

/** Selector de 1 a 5 estrellas (grupo de opciones accesible con teclado). */
export function EstrellasSelector({ valor, onCambiar, deshabilitado }) {
  const nombre = useId();
  return (
    <div className="estrellas estrellas--selector" role="radiogroup" aria-label="Tu valoración de 1 a 5 estrellas">
      {[1, 2, 3, 4, 5].map((n) => (
        <label key={n} className={n <= valor ? "estrella is-llena" : "estrella"} title={`${n} ${n === 1 ? "estrella" : "estrellas"}`}>
          <input type="radio" name={nombre} value={n} checked={valor === n} disabled={deshabilitado} onChange={() => onCambiar(n)} className="sr-only" />
          <span aria-hidden="true">★</span>
          <span className="sr-only">{n} {n === 1 ? "estrella" : "estrellas"}</span>
        </label>
      ))}
    </div>
  );
}
