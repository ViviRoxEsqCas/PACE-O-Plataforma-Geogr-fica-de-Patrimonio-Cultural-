import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

// Aviso breve («toast») para confirmar acciones como guardar o quitar una parada.
const Contexto = createContext(() => {});

export function AvisoProvider({ children }) {
  const [mensaje, setMensaje] = useState("");
  const [visible, setVisible] = useState(false);
  const temporizador = useRef(null);

  const mostrar = useCallback((texto) => {
    clearTimeout(temporizador.current);
    setMensaje(texto);
    setVisible(true);
    temporizador.current = setTimeout(() => setVisible(false), 3200);
  }, []);
  useEffect(() => () => clearTimeout(temporizador.current), []);

  const valor = useMemo(() => mostrar, [mostrar]);
  return (
    <Contexto.Provider value={valor}>
      {children}
      <div className={`paceno-toast${visible ? " is-visible" : ""}`} role="status" aria-live="polite">
        {mensaje}
      </div>
    </Contexto.Provider>
  );
}

export const useAviso = () => useContext(Contexto);
