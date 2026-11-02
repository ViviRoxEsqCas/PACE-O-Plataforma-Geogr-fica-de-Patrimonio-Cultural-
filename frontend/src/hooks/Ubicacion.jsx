import { createContext, useCallback, useContext, useMemo, useState } from "react";

// Posición actual de la persona, solo en memoria y solo si la pide (RF-11, RN-07).
// Nunca se envía al servidor, no se guarda en localStorage y no se hace seguimiento continuo.
const Contexto = createContext(null);

const MENSAJES = {
  1: "Permiso de ubicación denegado. El mapa y la lista siguen disponibles; puedes activarlo en los ajustes del navegador.",
  2: "No se pudo determinar tu ubicación. Inténtalo de nuevo.",
  3: "La ubicación tardó demasiado en responder. Inténtalo de nuevo.",
};

export function UbicacionProvider({ children }) {
  const [estado, setEstado] = useState({ fase: "inactiva", posicion: null, mensaje: "" });

  const solicitar = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setEstado({ fase: "error", posicion: null, mensaje: "Este navegador no permite obtener la ubicación." });
      return;
    }
    if (!window.isSecureContext) {
      setEstado({ fase: "error", posicion: null, mensaje: "La ubicación solo funciona en una conexión segura (HTTPS)." });
      return;
    }
    setEstado((previo) => ({ ...previo, fase: "pidiendo", mensaje: "" }));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setEstado({ fase: "activa", posicion: { lat: coords.latitude, lon: coords.longitude }, mensaje: "" }),
      (error) => setEstado({ fase: "error", posicion: null, mensaje: MENSAJES[error.code] ?? MENSAJES[2] }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  const quitar = useCallback(() => setEstado({ fase: "inactiva", posicion: null, mensaje: "" }), []);
  const valor = useMemo(() => ({ ...estado, solicitar, quitar }), [estado, solicitar, quitar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export const useUbicacion = () => useContext(Contexto);
