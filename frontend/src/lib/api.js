// Cliente de la API pública (capa de presentación → lógica de aplicación, sección 8.1).
// Todas las funciones aceptan un AbortSignal y lanzan ApiError con mensajes en español.

const BASE = (import.meta.env?.VITE_API_URL ?? "").replace(/\/$/, "");
export const TAMANO_MAXIMO = 100; // máximo que admite la API por página

export class ApiError extends Error {
  constructor(mensaje, estado = 0) {
    super(mensaje);
    this.name = "ApiError";
    this.estado = estado;
  }
}

function consulta(params) {
  const qs = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params ?? {})) {
    if (valor !== undefined && valor !== null && String(valor).trim() !== "") qs.set(clave, String(valor).trim());
  }
  const texto = qs.toString();
  return texto ? `?${texto}` : "";
}

async function pedir(ruta, params, signal, opciones = {}) {
  let respuesta;
  try {
    respuesta = await fetch(`${BASE}${ruta}${consulta(params)}`, {
      signal,
      ...opciones,
      headers: { Accept: "application/json", ...(opciones.headers ?? {}) },
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new ApiError("No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.");
  }
  if (respuesta.status === 429) throw new ApiError("Enviaste varios reportes seguidos. Espera un rato antes de enviar otro.", 429);
  if (respuesta.status === 400) {
    let detalle = {};
    try {
      detalle = await respuesta.json();
    } catch {
      /* sin detalle */
    }
    const primero = Object.values(detalle).flat()[0];
    throw new ApiError(typeof primero === "string" ? primero : "Los datos enviados no son válidos.", 400);
  }
  if (respuesta.status === 404) throw new ApiError("No se encontró lo que buscas.", 404);
  if (!respuesta.ok) throw new ApiError("El servidor no pudo responder. Inténtalo de nuevo en unos minutos.", respuesta.status);
  try {
    return await respuesta.json();
  } catch {
    throw new ApiError("La respuesta del servidor no es válida.", respuesta.status);
  }
}

/** Página de bienes publicados. Devuelve { count, next, previous, results }. */
export function listarBienes({ q, categoria, page = 1, pageSize = 10 } = {}, signal) {
  return pedir("/api/bienes/", { q, categoria, page, page_size: pageSize }, signal);
}

/** Todos los bienes que cumplen el filtro y tienen ubicación puntual (para los marcadores). */
export async function listarMarcadores({ q, categoria } = {}, signal) {
  const marcadores = [];
  let total = 0;
  for (let pagina = 1; ; pagina += 1) {
    const datos = await pedir("/api/bienes/", { q, categoria, page: pagina, page_size: TAMANO_MAXIMO }, signal);
    total = datos.count;
    marcadores.push(...datos.results.filter((b) => b.tiene_ubicacion));
    if (!datos.next) break;
  }
  return { total, marcadores };
}

export const obtenerBien = (id, signal) => pedir(`/api/bienes/${encodeURIComponent(id)}/`, null, signal);
export const listarCategorias = (signal) => pedir("/api/categorias/", null, signal);

// --- Semana 3 -----------------------------------------------------------------
const enviarJson = (ruta, cuerpo, signal) =>
  pedir(ruta, null, signal, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });

/** Actividades activas de una ficha. La respuesta correcta NO viene en los datos (RN-04). */
export const listarActividades = (bienId, signal) => pedir(`/api/bienes/${encodeURIComponent(bienId)}/actividades/`, null, signal);
/** Corrige en el servidor. Devuelve { correcta, opcion_correcta, puntos, retroalimentacion }. */
export const responderActividad = (actividadId, opcionId, signal) =>
  enviarJson(`/api/actividades/${encodeURIComponent(actividadId)}/responder/`, { opcion: opcionId }, signal);
export const listarTiposReporte = (signal) => pedir("/api/tipos-reporte/", null, signal);
/** Envía un reporte: { bien, tipo_reporte, descripcion } → { id, estado }. */
export const enviarReporte = (datos, signal) => enviarJson("/api/reportes/", datos, signal);
