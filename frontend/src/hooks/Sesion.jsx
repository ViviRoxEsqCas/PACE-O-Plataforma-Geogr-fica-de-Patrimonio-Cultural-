import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { cerrarSesionApi, obtenerMiPerfil } from "../lib/api";
import { EVENTO_SESION_EXPIRADA, guardarToken, leerToken } from "../lib/sesion";

// Sesión del espacio social. Sin sesión, la PWA funciona igual que antes (catálogo, mapa, actividades, reportes).
const Contexto = createContext({ perfil: null, listo: true, entrar: () => {}, salir: async () => {}, actualizar: () => {} });

export function SesionProvider({ children }) {
  const [perfil, setPerfil] = useState(null);
  const [listo, setListo] = useState(() => !leerToken());

  useEffect(() => {
    if (!leerToken()) return undefined;
    const control = new AbortController();
    obtenerMiPerfil(control.signal).then(
      (datos) => {
        setPerfil(datos);
        setListo(true);
      },
      (error) => {
        if (error?.name === "AbortError") return;
        if (error?.estado === 401) guardarToken(null);
        setListo(true);
      },
    );
    return () => control.abort();
  }, []);

  useEffect(() => {
    const alExpirar = () => setPerfil(null);
    window.addEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
    return () => window.removeEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
  }, []);

  const entrar = useCallback(({ token, perfil: datos }) => {
    guardarToken(token);
    setPerfil(datos);
    setListo(true);
  }, []);

  const salir = useCallback(async () => {
    try {
      await cerrarSesionApi();
    } catch {
      /* si el servidor no responde, igualmente se olvida el token en este dispositivo */
    }
    guardarToken(null);
    setPerfil(null);
  }, []);

  const actualizar = useCallback((datos) => setPerfil((previo) => ({ ...(previo ?? {}), ...datos })), []);

  const valor = useMemo(() => ({ perfil, listo, entrar, salir, actualizar }), [perfil, listo, entrar, salir, actualizar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export const useSesion = () => useContext(Contexto);
