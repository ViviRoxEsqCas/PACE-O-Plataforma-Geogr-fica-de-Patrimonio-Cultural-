import { useCallback, useEffect, useId, useState } from "react";
import { listarActividades, responderActividad } from "../lib/api";
import { puntajeTotal, registrarAcierto } from "../lib/puntaje";
import { Cargando, ErrorCarga } from "./Estados";

function Actividad({ actividad, alCambiarPuntaje }) {
  const nombre = useId();
  const [elegida, setElegida] = useState(null);
  const [resultado, setResultado] = useState(null); // { correcta, retroalimentacion, nuevos }
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const responder = async (evento) => {
    evento.preventDefault();
    if (elegida === null) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await responderActividad(actividad.id, elegida);
      const nuevos = r.correcta ? registrarAcierto(actividad.id, r.puntos) : 0;
      setResultado({ correcta: r.correcta, retroalimentacion: r.retroalimentacion, nuevos });
      if (nuevos) alCambiarPuntaje();
    } catch (e) {
      setError(e);
    } finally {
      setEnviando(false);
    }
  };

  const reintentar = () => {
    setResultado(null);
    setElegida(null);
  };

  return (
    <form className="actividad" onSubmit={responder}>
      <fieldset disabled={enviando || resultado?.correcta}>
        <legend>{actividad.enunciado}</legend>
        {actividad.opciones.map((opcion) => (
          <label key={opcion.id} className="actividad__opcion">
            <input type="radio" name={nombre} value={opcion.id} checked={elegida === opcion.id} onChange={() => setElegida(opcion.id)} />
            <span>{opcion.texto}</span>
          </label>
        ))}
      </fieldset>
      {error && <ErrorCarga error={error} />}
      {!resultado && (
        <button type="submit" className="boton boton--primario" disabled={elegida === null || enviando}>
          {enviando ? "Comprobando…" : "Responder"}
        </button>
      )}
      {resultado && (
        <div className={`resultado ${resultado.correcta ? "resultado--ok" : "resultado--mal"}`} role="status">
          <p className="resultado__titulo">
            {resultado.correcta ? "¡Correcto!" : "Todavía no."}
            {resultado.correcta && (resultado.nuevos > 0 ? ` +${resultado.nuevos} puntos` : " Ya habías sumado los puntos de esta pregunta.")}
          </p>
          {resultado.retroalimentacion && <p>{resultado.retroalimentacion}</p>}
          {!resultado.correcta && (
            <button type="button" className="boton boton--secundario" onClick={reintentar}>
              Intentar de nuevo
            </button>
          )}
        </div>
      )}
    </form>
  );
}

/** Sección «Practicar» de la ficha (RF-13 a RF-15). Carga las actividades solo cuando la persona la abre. */
export default function Practicar({ bienId }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, setEstado] = useState({ datos: null, error: null, cargando: false });
  const [puntos, setPuntos] = useState(() => puntajeTotal());
  const alCambiarPuntaje = useCallback(() => setPuntos(puntajeTotal()), []);

  useEffect(() => {
    setAbierto(false);
    setEstado({ datos: null, error: null, cargando: false });
  }, [bienId]);

  const cargar = useCallback(() => {
    const control = new AbortController();
    setEstado({ datos: null, error: null, cargando: true });
    listarActividades(bienId, control.signal).then(
      (datos) => setEstado({ datos, error: null, cargando: false }),
      (error) => error?.name !== "AbortError" && setEstado({ datos: null, error, cargando: false }),
    );
    return () => control.abort();
  }, [bienId]);

  const abrir = () => {
    setAbierto(true);
    setPuntos(puntajeTotal());
    cargar();
  };

  return (
    <section aria-labelledby="t-practicar" className="practicar">
      <h2 id="t-practicar">Practicar</h2>
      {!abierto ? (
        <button type="button" className="boton boton--primario" onClick={abrir}>
          Practicar con este bien
        </button>
      ) : (
        <>
          <p className="practicar__puntaje" aria-live="polite">
            Tu puntuación: <strong>{puntos}</strong> {puntos === 1 ? "punto" : "puntos"} <span>(se guarda solo en este navegador)</span>
          </p>
          {estado.cargando && <Cargando texto="Cargando preguntas…" />}
          {estado.error && <ErrorCarga error={estado.error} onReintentar={cargar} />}
          {estado.datos?.length === 0 && <p className="sin-imagenes">Este bien todavía no tiene preguntas.</p>}
          {estado.datos?.map((actividad) => (
            <Actividad key={actividad.id} actividad={actividad} alCambiarPuntaje={alCambiarPuntaje} />
          ))}
        </>
      )}
    </section>
  );
}

