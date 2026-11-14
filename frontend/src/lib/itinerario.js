// Itinerario personal: lista de identificadores de bienes guardados solo en este navegador
// (igual que la puntuación de «Practicar»): no se envía al servidor ni lleva datos personales.
export const CLAVE_ITINERARIO = "paceno_itinerario_v1";

const almacen = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // acceso bloqueado (modo privado, política del navegador)
  }
};

export function leerItinerario(storage = almacen()) {
  try {
    const crudo = storage?.getItem(CLAVE_ITINERARIO);
    const ids = crudo ? JSON.parse(crudo) : [];
    return Array.isArray(ids) ? [...new Set(ids.filter((id) => Number.isInteger(id)))] : [];
  } catch {
    return [];
  }
}

export function guardarItinerario(ids, storage = almacen()) {
  try {
    storage?.setItem(CLAVE_ITINERARIO, JSON.stringify(ids));
  } catch {
    /* sin almacenamiento: el itinerario sigue funcionando durante la sesión */
  }
}

/** Añade o quita un id sin mutar la lista. Devuelve { ids, agregado }. */
export function alternar(ids, id) {
  const esta = ids.includes(id);
  return { ids: esta ? ids.filter((x) => x !== id) : [...ids, id], agregado: !esta };
}
