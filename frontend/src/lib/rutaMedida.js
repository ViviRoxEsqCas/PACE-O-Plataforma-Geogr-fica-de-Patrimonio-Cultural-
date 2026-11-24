// «Ruta a tu medida»: arma un recorrido a pie con los bienes del catálogo que caben en el tiempo que la
// persona tiene, con un ritmo pensado para La Paz (≈3.600 m de altura y calles en cuesta).
// Todo se calcula en el navegador con el catálogo ya cargado: la ubicación de la persona nunca se envía
// al servidor ni se guarda (RN-07, RF-11). Es una estimación, no un servicio de navegación.
import { distanciaMetros } from "./distancia";

export const RITMOS = [
  { id: "tranquilo", nombre: "Tranquilo", detalle: "≈ 2,8 km/h · para la altura y las cuestas", kmh: 2.8 },
  { id: "normal", nombre: "Normal", detalle: "≈ 3,8 km/h", kmh: 3.8 },
  { id: "agil", nombre: "Ágil", detalle: "≈ 4,8 km/h", kmh: 4.8 },
];
export const DURACIONES = [45, 60, 90, 120, 180, 240];
/** Las calles no van en línea recta: se alarga la distancia aérea para estimar el trayecto real. */
export const FACTOR_CALLES = 1.3;
export const MINUTOS_POR_PARADA = 12;
export const MAX_PARADAS = 8;
const RADIO_SEMILLA_M = 1200;

const punto = (bien) => ({ lat: bien.latitud, lon: bien.longitud });

export function formatearMinutos(minutos) {
  const total = Math.max(0, Math.round(minutos));
  if (total < 60) return `${total} min`;
  const horas = Math.floor(total / 60);
  const resto = total % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

const vacia = (extra = {}) => ({
  paradas: [], minutosCaminando: 0, minutosVisitas: 0, minutosTotal: 0, metrosTotal: 0, categorias: 0,
  origen: null, usaPosicion: false, regresar: false, regreso: null, sinUbicacion: 0, ...extra,
});

/**
 * generarRuta({ bienes, minutos, ritmo, categorias, inicio, regresar })
 *  · bienes: catálogo (solo entran los que tienen ubicación puntual)
 *  · minutos: tiempo total disponible (caminar + visitar)
 *  · categorias: ids a incluir (vacío = todas) · inicio: { lat, lon } | null · regresar: volver al punto de partida
 * Sin `inicio`, la ruta arranca en la zona más densa del catálogo filtrado.
 * Método: inserción más barata (favoreciendo categorías aún no visitadas) + mejora 2-opt del orden.
 */
export function generarRuta({ bienes, minutos, ritmo = "normal", categorias = [], inicio = null, regresar = false, minutosPorParada = MINUTOS_POR_PARADA, maxParadas = MAX_PARADAS }) {
  const kmh = (RITMOS.find((r) => r.id === ritmo) ?? RITMOS[1]).kmh;
  const metrosPorMinuto = (kmh * 1000) / 60;
  const filtrados = bienes.filter((b) => !categorias.length || categorias.includes(b.categoria?.id));
  const candidatos = filtrados.filter((b) => b.tiene_ubicacion);
  const sinUbicacion = filtrados.length - candidatos.length;
  if (!candidatos.length) return vacia({ sinUbicacion });

  const metros = (a, b) => distanciaMetros(a, b) * FACTOR_CALLES;
  const minCamino = (a, b) => metros(a, b) / metrosPorMinuto;

  let origen = inicio;
  let ruta = [];
  if (!inicio) {
    // Semilla: el bien con más vecinos a menos de ~1,2 km (desempata el id menor); la ruta empieza ahí, sin caminar hasta él.
    const vecinos = (c) => candidatos.filter((o) => distanciaMetros(punto(c), punto(o)) <= RADIO_SEMILLA_M).length;
    const semilla = [...candidatos].sort((a, b) => vecinos(b) - vecinos(a) || a.id - b.id)[0];
    origen = punto(semilla);
    ruta = [semilla];
  }
  const fijo = inicio ? 0 : 1; // en modo «sin inicio» la semilla queda primera

  const nodos = (r) => [origen, ...r.map(punto)];
  const caminata = (r) => {
    const n = nodos(r);
    let total = 0;
    for (let i = 0; i < n.length - 1; i += 1) total += minCamino(n[i], n[i + 1]);
    if (regresar && r.length) total += minCamino(n[n.length - 1], n[0]);
    return total;
  };
  const tiempo = (r) => caminata(r) + r.length * minutosPorParada;

  if (ruta.length && tiempo(ruta) > minutos) return vacia({ origen, usaPosicion: Boolean(inicio), sinUbicacion, regresar });

  // Inserción más barata: cada vuelta suma la parada que menos tiempo añade y aún cabe en el presupuesto.
  let actual = ruta.length ? tiempo(ruta) : 0;
  while (ruta.length < maxParadas) {
    const vistas = new Set(ruta.map((b) => b.categoria?.id));
    let mejor = null;
    for (const c of candidatos) {
      if (ruta.includes(c)) continue;
      const nueva_categoria = !vistas.has(c.categoria?.id);
      for (let pos = fijo; pos <= ruta.length; pos += 1) {
        const nueva = [...ruta.slice(0, pos), c, ...ruta.slice(pos)];
        const t = tiempo(nueva);
        if (t > minutos) continue;
        const peso = (t - actual) * (nueva_categoria ? 0.7 : 1);
        if (!mejor || peso < mejor.peso - 1e-9 || (Math.abs(peso - mejor.peso) <= 1e-9 && c.id < mejor.id)) mejor = { peso, nueva, t, id: c.id };
      }
    }
    if (!mejor) break;
    ruta = mejor.nueva;
    actual = mejor.t;
  }

  // 2-opt: invierte tramos mientras eso acorte la caminata (solo puede bajar el tiempo total).
  let mejora = true;
  while (mejora) {
    mejora = false;
    for (let i = fijo; i < ruta.length - 1 && !mejora; i += 1) {
      for (let j = i + 1; j < ruta.length && !mejora; j += 1) {
        const probada = [...ruta.slice(0, i), ...ruta.slice(i, j + 1).reverse(), ...ruta.slice(j + 1)];
        if (caminata(probada) < caminata(ruta) - 1e-6) {
          ruta = probada;
          mejora = true;
        }
      }
    }
  }

  const n = nodos(ruta);
  let reloj = 0;
  let metrosTotal = 0;
  const paradas = ruta.map((bien, i) => {
    const m = metros(n[i], n[i + 1]);
    const caminarMin = m / metrosPorMinuto;
    reloj += caminarMin;
    const parada = { bien, metros: m, caminarMin, llegadaMin: reloj, visitaMin: minutosPorParada };
    reloj += minutosPorParada;
    metrosTotal += m;
    return parada;
  });
  let regreso = null;
  if (regresar && ruta.length) {
    const m = metros(n[n.length - 1], n[0]);
    regreso = { metros: m, minutos: m / metrosPorMinuto };
    metrosTotal += m;
  }
  const minutosCaminando = caminata(ruta);
  return {
    paradas, minutosCaminando, minutosVisitas: ruta.length * minutosPorParada, minutosTotal: tiempo(ruta), metrosTotal,
    categorias: new Set(ruta.map((b) => b.categoria?.id)).size, origen, usaPosicion: Boolean(inicio), regresar, regreso, sinUbicacion,
  };
}

/** Enlace de Google Maps con las paradas en orden, a pie (hasta 8 paradas = origen + 7 intermedias + destino). */
export function enlaceRecorrido(resultado) {
  const { paradas, origen, usaPosicion, regresar } = resultado;
  if (!paradas.length) return null;
  const texto = (p) => `${p.lat},${p.lon}`;
  const puntos = paradas.map((p) => punto(p.bien));
  const parametros = new URLSearchParams({ api: "1", travelmode: "walking" });
  let destino;
  let intermedios;
  if (usaPosicion) {
    parametros.set("origin", texto(origen));
    destino = regresar ? origen : puntos[puntos.length - 1];
    intermedios = regresar ? puntos : puntos.slice(0, -1);
  } else {
    parametros.set("origin", texto(puntos[0]));
    destino = regresar ? puntos[0] : puntos[puntos.length - 1];
    intermedios = regresar ? puntos.slice(1) : puntos.slice(1, -1);
  }
  if (!usaPosicion && !regresar && puntos.length === 1) parametros.delete("origin");
  parametros.set("destination", texto(destino));
  if (intermedios.length) parametros.set("waypoints", intermedios.map(texto).join("|"));
  return `https://www.google.com/maps/dir/?${parametros.toString()}`;
}
