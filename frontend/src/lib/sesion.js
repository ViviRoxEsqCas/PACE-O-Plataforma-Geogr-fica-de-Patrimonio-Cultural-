// Token de sesión del espacio social. Se guarda en localStorage; si el navegador lo bloquea, solo en memoria.
// El token identifica una cuenta de visitante. Nunca se guarda la contraseña.
const CLAVE = "paceno.sesion.v1";
let enMemoria = null;

export function leerToken() {
  try {
    return localStorage.getItem(CLAVE) || enMemoria;
  } catch {
    return enMemoria;
  }
}

export function guardarToken(token) {
  enMemoria = token || null;
  try {
    if (token) localStorage.setItem(CLAVE, token);
    else localStorage.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento: la sesión dura mientras la pestaña esté abierta */
  }
}

export const EVENTO_SESION_EXPIRADA = "paceno:sesion-expirada";
