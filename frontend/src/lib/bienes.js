// Utilidades de presentación de los bienes (sin dependencias de React).

/** Código visible de la ficha, derivado del identificador real: LPZ-007. */
export const codigoBien = (id) => `LPZ-${String(id).padStart(3, "0")}`;

export const nombreTipo = (tipo) => (tipo === "material" ? "Material" : "Inmaterial");

/** Línea descriptiva corta para tarjetas: la dirección de referencia si existe, o el tipo y la categoría. */
export function resumenBien(bien) {
  const direccion = bien.direccion_referencia?.trim();
  if (direccion) return direccion;
  return `Patrimonio ${bien.tipo === "material" ? "material" : "inmaterial"} · ${bien.categoria.nombre}.`;
}

/** Acorta un nombre largo sin partir palabras: «Celebración de la Revolución…». */
export function nombreCorto(nombre, maximo = 34) {
  if (nombre.length <= maximo) return nombre;
  const corte = nombre.slice(0, maximo).replace(/\s+\S*$/, "");
  return `${corte}…`;
}

/** Enlace del mapa que enfoca un bien con ubicación o, si no la tiene, lo busca por nombre. */
export const enlaceMapa = (bien) => (bien.tiene_ubicacion ? `/explorar?bien=${bien.id}` : `/explorar?q=${encodeURIComponent(bien.nombre)}`);

/** Primero los bienes con portada (para las composiciones fotográficas), luego el resto. */
export const conPortadaPrimero = (bienes) => [...bienes.filter((b) => b.portada), ...bienes.filter((b) => !b.portada)];
