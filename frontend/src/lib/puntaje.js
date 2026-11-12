// Puntuación local (RN-05): vive solo en este navegador, nunca se envía al servidor.
// localStorage puede estar bloqueado o lleno (modo privado, políticas): todo va con try/catch
// y, si falla, la puntuación se conserva en memoria durante la visita.

const CLAVE = "paceno.puntaje.v1";
let memoria = {}; // respaldo: { [actividadId]: puntos }

function leer() {
  try {
    const crudo = globalThis.localStorage?.getItem(CLAVE);
    const datos = crudo ? JSON.parse(crudo) : null;
    if (datos && typeof datos === "object" && !Array.isArray(datos)) memoria = { ...memoria, ...datos };
  } catch {
    /* almacenamiento no disponible: se usa la memoria */
  }
  return memoria;
}

function guardar() {
  try {
    globalThis.localStorage?.setItem(CLAVE, JSON.stringify(memoria));
  } catch {
    /* sin persistencia: la visita sigue funcionando */
  }
}

/** Puntos acumulados (suma de actividades acertadas). */
export function puntajeTotal() {
  return Object.values(leer()).reduce((suma, p) => suma + (Number.isFinite(p) ? p : 0), 0);
}

/** ¿Ya se otorgaron puntos por esta actividad? */
export const yaPuntuada = (actividadId) => String(actividadId) in leer();

/** Los puntos se otorgan una sola vez por actividad. Devuelve los puntos nuevos (0 si ya estaba). */
export function registrarAcierto(actividadId, puntos) {
  if (yaPuntuada(actividadId)) return 0;
  const valor = Number.isFinite(puntos) && puntos > 0 ? puntos : 0;
  memoria[String(actividadId)] = valor;
  guardar();
  return valor;
}

export function reiniciarPuntaje() {
  memoria = {};
  try {
    globalThis.localStorage?.removeItem(CLAVE);
  } catch {
    /* nada que hacer */
  }
}
