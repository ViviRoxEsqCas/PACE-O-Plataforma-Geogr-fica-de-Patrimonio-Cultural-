import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { alternar, guardarItinerario, leerItinerario } from "../lib/itinerario";

const Contexto = createContext(null);

/** Itinerario personal (ids de bienes) guardado solo en este navegador. */
export function ItinerarioProvider({ children }) {
  const [ids, setIds] = useState(() => leerItinerario());

  const alternarBien = useCallback(
    (id) => {
      const { ids: siguientes, agregado } = alternar(ids, id);
      setIds(siguientes);
      guardarItinerario(siguientes);
      return { agregado, total: siguientes.length };
    },
    [ids],
  );

  const valor = useMemo(() => ({ ids, alternar: alternarBien, guardado: (id) => ids.includes(id) }), [ids, alternarBien]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export const useItinerario = () => useContext(Contexto);
