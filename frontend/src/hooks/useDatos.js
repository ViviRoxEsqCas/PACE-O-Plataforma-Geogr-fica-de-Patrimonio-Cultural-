import { useCallback, useEffect, useState } from "react";

/**
 * Carga datos asíncronos con cancelación y reintento.
 * `cargar(signal)` debe ser estable (useCallback) o cambiará en cada render.
 * Devuelve { datos, error, cargando, reintentar }.
 */
export function useDatos(cargar) {
  const [estado, setEstado] = useState({ datos: null, error: null, cargando: true });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    const control = new AbortController();
    setEstado((previo) => ({ ...previo, error: null, cargando: true }));
    cargar(control.signal).then(
      (datos) => setEstado({ datos, error: null, cargando: false }),
      (error) => {
        if (error?.name === "AbortError") return;
        setEstado({ datos: null, error, cargando: false });
      },
    );
    return () => control.abort();
  }, [cargar, intento]);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);
  return { ...estado, reintentar };
}

export function useRetardo(valor, ms = 300) {
  const [retardado, setRetardado] = useState(valor);
  useEffect(() => {
    const id = setTimeout(() => setRetardado(valor), ms);
    return () => clearTimeout(id);
  }, [valor, ms]);
  return retardado;
}
