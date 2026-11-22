// Cliente de la API pública (capa de presentación → lógica de aplicación, sección 8.1).
// Todas las funciones aceptan un AbortSignal y lanzan ApiError con mensajes en español.

import { EVENTO_SESION_EXPIRADA, guardarToken, leerToken } from "./sesion";

const BASE = (import.meta.env?.VITE_API_URL ?? "").replace(/\/$/, "");
export const TAMANO_MAXIMO = 100; // máximo que admite la API por página

/**
 * Dirección con la que el navegador pide una imagen de la API. La API entrega rutas «/media/…» sin host (así el
 * teléfono no recibe una dirección que apunta a sí mismo). Sin VITE_API_URL se piden al origen de la página: el proxy
 * de Vite (o el servidor web) las lleva al backend. Con VITE_API_URL se anteponen a la dirección de la API.
 * Los activos propios del frontend («/assets/…») y las URL completas (almacenamiento externo) no se modifican.
 */
export function urlRecurso(url, base = BASE) {
  return typeof url === "string" && url.startsWith("/media/") ? `${base}${url}` : url;
}

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
  const token = leerToken();
  try {
    respuesta = await fetch(`${BASE}${ruta}${consulta(params)}`, {
      signal,
      ...opciones,
      headers: { Accept: "application/json", ...(token ? { Authorization: `Token ${token}` } : {}), ...(opciones.headers ?? {}) },
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new ApiError("No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.");
  }
  if (respuesta.status === 429) {
    throw new ApiError(
      ruta.startsWith("/api/reportes/")
        ? "Enviaste varios reportes seguidos. Espera un rato antes de enviar otro."
        : "Hiciste demasiadas acciones seguidas. Espera un rato antes de intentarlo de nuevo.",
      429,
    );
  }
  if (respuesta.status === 401) {
    if (token) {
      guardarToken(null); // la cuenta se desactivó o la sesión se cerró en otro dispositivo
      if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO_SESION_EXPIRADA));
    }
    throw new ApiError(token ? "Tu sesión terminó. Vuelve a ingresar." : "Ingresa a tu cuenta para continuar.", 401);
  }
  if (respuesta.status === 403) throw new ApiError("No tienes permiso para hacer esto.", 403);
  if (respuesta.status === 400 || respuesta.status === 409) {
    let detalle = {};
    try {
      detalle = await respuesta.json();
    } catch {
      /* sin detalle */
    }
    const primero = Object.values(detalle).flat()[0];
    throw new ApiError(typeof primero === "string" ? primero : "Los datos enviados no son válidos.", respuesta.status);
  }
  if (respuesta.status === 404) throw new ApiError("No se encontró lo que buscas.", 404);
  if (!respuesta.ok) throw new ApiError("El servidor no pudo responder. Inténtalo de nuevo en unos minutos.", respuesta.status);
  if (respuesta.status === 204) return null;
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

/** Catálogo completo de bienes publicados (todas las páginas). Alimenta Inicio, Rutas, el pie y la navegación entre fichas. */
export async function listarCatalogo(signal) {
  const bienes = [];
  for (let pagina = 1; ; pagina += 1) {
    const datos = await pedir("/api/bienes/", { page: pagina, page_size: TAMANO_MAXIMO }, signal);
    bienes.push(...datos.results);
    if (!datos.next) break;
  }
  return bienes;
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

// --- Espacio social (cuentas, opiniones, visitas declaradas, amistades, ranking) --------------------
const enviarJsonCon = (metodo, ruta, cuerpo, signal) =>
  pedir(ruta, null, signal, {
    method: metodo,
    ...(cuerpo === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) }),
  });
const e = encodeURIComponent;

export const registrarCuenta = (datos, signal) => enviarJsonCon("POST", "/api/cuentas/registro/", datos, signal);
export const iniciarSesion = (datos, signal) => enviarJsonCon("POST", "/api/cuentas/acceso/", datos, signal);
export const cerrarSesionApi = (signal) => enviarJsonCon("POST", "/api/cuentas/salida/", undefined, signal);
export const obtenerMiPerfil = (signal) => pedir("/api/cuentas/yo/", null, signal);
/** `datos` puede ser un objeto (JSON) o un FormData (con la fotografía). */
export const actualizarMiPerfil = (datos, signal) =>
  datos instanceof FormData ? pedir("/api/cuentas/yo/", null, signal, { method: "PATCH", body: datos }) : enviarJsonCon("PATCH", "/api/cuentas/yo/", datos, signal);
export const buscarPerfiles = (q, signal) => pedir("/api/perfiles/", { q }, signal);
export const obtenerPerfil = (username, signal) => pedir(`/api/perfiles/${e(username)}/`, null, signal);

export const resumenSocial = (bienId, signal) => pedir(`/api/bienes/${e(bienId)}/social/`, null, signal);
export const listarComentarios = (bienId, page, signal) => pedir(`/api/bienes/${e(bienId)}/valoraciones/`, { page }, signal);
export const guardarValoracion = (bienId, datos, signal) => enviarJsonCon("PUT", `/api/bienes/${e(bienId)}/mi-valoracion/`, datos, signal);
export const retirarValoracion = (bienId, signal) => enviarJsonCon("DELETE", `/api/bienes/${e(bienId)}/mi-valoracion/`, undefined, signal);
export const marcarVisitado = (bienId, signal) => enviarJsonCon("PUT", `/api/bienes/${e(bienId)}/mi-visita/`, undefined, signal);
export const desmarcarVisitado = (bienId, signal) => enviarJsonCon("DELETE", `/api/bienes/${e(bienId)}/mi-visita/`, undefined, signal);
export const reportarComentario = (valoracionId, motivo, signal) => enviarJsonCon("POST", `/api/valoraciones/${e(valoracionId)}/reportar/`, { motivo }, signal);

export const listarAmistades = (signal) => pedir("/api/amistades/", null, signal);
export const solicitarAmistad = (username, signal) => enviarJsonCon("POST", "/api/amistades/solicitar/", { username }, signal);
export const responderAmistad = (id, accion, signal) => enviarJsonCon("POST", `/api/amistades/${e(id)}/${accion}/`, undefined, signal);
export const quitarAmistad = (id, signal) => enviarJsonCon("DELETE", `/api/amistades/${e(id)}/`, undefined, signal);
export const actividadDeAmistades = (signal) => pedir("/api/amistades/actividad/", null, signal);
export const obtenerRanking = (signal) => pedir("/api/ranking/", null, signal);
