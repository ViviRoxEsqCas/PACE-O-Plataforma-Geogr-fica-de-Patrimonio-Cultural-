import { useEffect, useState } from "react";

export function useMedia(consulta) {
  const [coincide, setCoincide] = useState(() => window.matchMedia(consulta).matches);
  useEffect(() => {
    const lista = window.matchMedia(consulta);
    const alCambiar = () => setCoincide(lista.matches);
    alCambiar();
    lista.addEventListener("change", alCambiar);
    return () => lista.removeEventListener("change", alCambiar);
  }, [consulta]);
  return coincide;
}
