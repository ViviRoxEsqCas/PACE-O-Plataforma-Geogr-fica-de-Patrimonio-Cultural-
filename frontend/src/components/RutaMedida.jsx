import { Footprints, LocateFixed, MapPinned, Navigation, Plus, Route, Timer } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAviso } from "./Aviso";
import MapaBienes from "./MapaBienes";
import { useItinerario } from "../hooks/Itinerario";
import { useUbicacion } from "../hooks/Ubicacion";
import { formatearDistancia } from "../lib/distancia";
import { DURACIONES, RITMOS, enlaceRecorrido, formatearMinutos, generarRuta } from "../lib/rutaMedida";

const dos = (n) => String(n).padStart(2, "0");
const metros = (m) => formatearDistancia(m).replace(/^a /, "");

/**
 * «Ruta a tu medida»: la persona dice cuánto tiempo tiene y a qué ritmo camina; el catálogo real de PACEÑO se
 * ordena en un recorrido a pie que cabe en ese tiempo, con paradas de distintas categorías.
 * Se recalcula al instante en el navegador (la ubicación nunca sale de aquí).
 */
export default function RutaMedida({ bienes }) {
  const aviso = useAviso();
  const navegar = useNavigate();
  const itinerario = useItinerario();
  const { posicion, fase, mensaje, solicitar, quitar } = useUbicacion();
  const [minutos, setMinutos] = useState(90);
  const [ritmo, setRitmo] = useState("tranquilo");
  const [elegidas, setElegidas] = useState([]); // ids de categoría; vacío = todas
  const [regresar, setRegresar] = useState(false);
  const [desdeMi, setDesdeMi] = useState(false);

  const categorias = useMemo(() => {
    const mapa = new Map();
    for (const b of bienes) if (b.tiene_ubicacion && !mapa.has(b.categoria.id)) mapa.set(b.categoria.id, b.categoria.nombre);
    return [...mapa].map(([id, nombre]) => ({ id, nombre }));
  }, [bienes]);

  const inicio = desdeMi && posicion ? posicion : null;
  const ruta = useMemo(() => generarRuta({ bienes, minutos, ritmo, categorias: elegidas, inicio, regresar }), [bienes, minutos, ritmo, elegidas, inicio, regresar]);
  const enlace = enlaceRecorrido(ruta);
  const trazo = useMemo(() => {
    const puntos = ruta.paradas.map((p) => [p.bien.latitud, p.bien.longitud]);
    if (inicio && puntos.length) puntos.unshift([inicio.lat, inicio.lon]);
    if (regresar && puntos.length) puntos.push(ruta.origen ? [ruta.origen.lat, ruta.origen.lon] : puntos[0]);
    return puntos;
  }, [ruta, inicio, regresar]);

  const alternarCategoria = (id) => setElegidas((previas) => (previas.includes(id) ? previas.filter((c) => c !== id) : [...previas, id]));
  const usarMiUbicacion = () => {
    setDesdeMi(true);
    if (!posicion) solicitar();
  };
  const dejarMiUbicacion = () => {
    setDesdeMi(false);
    quitar();
  };
  const guardarRuta = () => {
    const { agregados, total } = itinerario.agregarVarios(ruta.paradas.map((p) => p.bien.id));
    aviso(agregados ? `Se añadieron ${agregados} ${agregados === 1 ? "parada" : "paradas"} a tu itinerario (${total} en total).` : "Todas las paradas de esta ruta ya estaban en tu itinerario.");
  };

  if (!categorias.length) return null;

  return (
    <section className="ruta-medida editorial-card" aria-labelledby="ruta-medida-titulo">
      <header className="ruta-medida__head">
        <div>
          <span className="kicker">novedad · recorrido inteligente</span>
          <h2 id="ruta-medida-titulo" className="chronicles-title">Ruta a tu medida</h2>
        </div>
        <p className="ruta-medida__intro">Dinos cuánto tiempo tienes y cómo caminas: armamos un recorrido a pie con el patrimonio que sí alcanzas a visitar, sin cruzar la ciudad de un lado a otro.</p>
      </header>

      <div className="ruta-medida__cuerpo">
        <div className="ruta-medida__controles">
          <fieldset className="ruta-medida__grupo">
            <legend><Timer aria-hidden="true" /> Tiempo disponible</legend>
            <div className="ruta-medida__chips">
              {DURACIONES.map((d) => (
                <button key={d} type="button" className="chip-ruta" aria-pressed={minutos === d} onClick={() => setMinutos(d)}>{formatearMinutos(d)}</button>
              ))}
            </div>
          </fieldset>

          <fieldset className="ruta-medida__grupo">
            <legend><Footprints aria-hidden="true" /> Tu ritmo</legend>
            <div className="ruta-medida__chips">
              {RITMOS.map((r) => (
                <button key={r.id} type="button" className="chip-ruta" aria-pressed={ritmo === r.id} onClick={() => setRitmo(r.id)} title={r.detalle}>{r.nombre}</button>
              ))}
            </div>
            <p className="ruta-medida__nota">{RITMOS.find((r) => r.id === ritmo).detalle}. La Paz está a ≈ 3.600 m: el ritmo tranquilo cuenta las cuestas y la falta de aire.</p>
          </fieldset>

          <fieldset className="ruta-medida__grupo">
            <legend><Route aria-hidden="true" /> Qué quieres ver</legend>
            <div className="ruta-medida__chips">
              <button type="button" className="chip-ruta" aria-pressed={elegidas.length === 0} onClick={() => setElegidas([])}>Todo</button>
              {categorias.map((c) => (
                <button key={c.id} type="button" className="chip-ruta" aria-pressed={elegidas.includes(c.id)} onClick={() => alternarCategoria(c.id)}>{c.nombre}</button>
              ))}
            </div>
          </fieldset>

          <fieldset className="ruta-medida__grupo">
            <legend><LocateFixed aria-hidden="true" /> Punto de partida</legend>
            <div className="ruta-medida__chips">
              <button type="button" className="chip-ruta" aria-pressed={!desdeMi || !posicion} onClick={dejarMiUbicacion}>Zona con más patrimonio</button>
              <button type="button" className="chip-ruta" aria-pressed={desdeMi && Boolean(posicion)} onClick={usarMiUbicacion} disabled={fase === "pidiendo"}>
                {fase === "pidiendo" ? "Obteniendo ubicación…" : "Desde mi ubicación"}
              </button>
            </div>
            <label className="ruta-medida__check">
              <input type="checkbox" checked={regresar} onChange={(e) => setRegresar(e.target.checked)} />
              Volver al punto de partida
            </label>
            {fase === "error" && <p className="ruta-medida__nota" role="status">{mensaje}</p>}
            <p className="ruta-medida__nota">Tu ubicación se usa solo en este navegador: no se envía ni se guarda.</p>
          </fieldset>
        </div>

        <div className="ruta-medida__resultado" aria-live="polite">
          {ruta.paradas.length === 0 ? (
            <div className="estado estado--vacio">
              <p className="estado__titulo">Con esas condiciones no hay una ruta que quepa.</p>
              <p>Prueba con más tiempo, otro ritmo o más categorías.</p>
            </div>
          ) : (
            <>
              <ul className="ruta-medida__resumen" aria-label="Resumen de la ruta">
                <li><strong>{ruta.paradas.length}</strong> {ruta.paradas.length === 1 ? "parada" : "paradas"}</li>
                <li><strong>{formatearMinutos(ruta.minutosTotal)}</strong> de {formatearMinutos(minutos)}</li>
                <li><strong>{metros(ruta.metrosTotal)}</strong> caminando</li>
                <li><strong>{ruta.categorias}</strong> {ruta.categorias === 1 ? "categoría" : "categorías"}</li>
              </ul>

              <MapaBienes className="ruta-medida__mapa" bienes={ruta.paradas.map((p) => p.bien)} posicion={inicio} trazo={trazo} onAbrir={(id) => navegar(`/bienes/${id}`)} etiqueta="Mapa de tu ruta a medida" />

              <ol className="ruta-medida__paradas">
                {ruta.paradas.map((p, i) => (
                  <li key={p.bien.id}>
                    <span className="ruta-medida__num">{dos(i + 1)}</span>
                    <div>
                      <Link to={`/bienes/${p.bien.id}`} className="ruta-medida__nombre">{p.bien.nombre}</Link>
                      <p className="ruta-medida__meta">
                        {p.bien.categoria.nombre} · {i === 0 && !inicio ? "punto de partida" : `${formatearMinutos(p.caminarMin)} caminando (${metros(p.metros)})`}
                      </p>
                      <p className="ruta-medida__meta">Llegas al minuto {Math.round(p.llegadaMin)} · visita de ≈ {p.visitaMin} min</p>
                    </div>
                  </li>
                ))}
                {ruta.regreso && (
                  <li className="ruta-medida__regreso">
                    <span className="ruta-medida__num" aria-hidden="true">↺</span>
                    <p className="ruta-medida__meta">Regreso al punto de partida: {formatearMinutos(ruta.regreso.minutos)} ({metros(ruta.regreso.metros)})</p>
                  </li>
                )}
              </ol>

              <div className="ruta-medida__acciones">
                <button type="button" className="cta-pill-btn" onClick={guardarRuta}>
                  <Plus aria-hidden="true" />
                  Guardar en mi itinerario
                </button>
                {enlace && (
                  <a className="btn-paper-pill" href={enlace} target="_blank" rel="noopener noreferrer">
                    <Navigation aria-hidden="true" />
                    Abrir recorrido a pie
                  </a>
                )}
                <Link to="/explorar" className="btn-outline-pill"><MapPinned aria-hidden="true" /> Ver catálogo en mapa</Link>
              </div>
              <p className="ruta-medida__nota">
                Estimación con la distancia en línea recta +30 % por el trazado de las calles y {ruta.paradas[0].visitaMin} min por parada; no mide las pendientes exactas ni cierres de calles.
                {ruta.sinUbicacion > 0 && ` ${ruta.sinUbicacion} ${ruta.sinUbicacion === 1 ? "manifestación inmaterial no tiene" : "manifestaciones inmateriales no tienen"} un lugar fijo, por eso no entran en el recorrido.`}
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
