// Distancia aproximada en línea recta (fórmula de Haversine). Se calcula en el navegador:
// la posición de la persona nunca se envía al servidor ni se almacena (RN-07, RF-11).
const RADIO_TIERRA_M = 6371008.8;
const aRad = (grados) => (grados * Math.PI) / 180;

export function distanciaMetros(a, b) {
  const dLat = aRad(b.lat - a.lat);
  const dLon = aRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aRad(a.lat)) * Math.cos(aRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** «a ~850 m» / «a ~1,3 km». Redondea para no aparentar una precisión que no existe. */
export function formatearDistancia(metros) {
  if (!Number.isFinite(metros)) return "";
  if (metros < 1000) return `a ~${Math.max(10, Math.round(metros / 10) * 10)} m`;
  const km = metros / 1000;
  const texto = km < 10 ? km.toFixed(1).replace(".", ",") : String(Math.round(km));
  return `a ~${texto} km`;
}

export function distanciaA(bien, posicion) {
  if (!posicion || !bien?.tiene_ubicacion) return null;
  return distanciaMetros(posicion, { lat: bien.latitud, lon: bien.longitud });
}
