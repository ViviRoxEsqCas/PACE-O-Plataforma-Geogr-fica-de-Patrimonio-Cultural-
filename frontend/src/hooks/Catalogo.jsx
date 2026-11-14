import { createContext, useCallback, useContext, useMemo } from "react";
import { listarCatalogo } from "../lib/api";
import { useDatos } from "./useDatos";

// Catálogo completo (una sola petición compartida): lo usan Inicio, Rutas, el pie y la navegación entre fichas.
// Si falla, las pantallas siguen funcionando con sus datos propios; solo pierden esos complementos.
const Contexto = createContext({ bienes: [], cargando: false, error: null, reintentar: () => {} });

export function CatalogoProvider({ children }) {
  const { datos, cargando, error, reintentar } = useDatos(useCallback((signal) => listarCatalogo(signal), []));
  const valor = useMemo(() => ({ bienes: datos ?? [], cargando, error, reintentar }), [datos, cargando, error, reintentar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export const useCatalogo = () => useContext(Contexto);
