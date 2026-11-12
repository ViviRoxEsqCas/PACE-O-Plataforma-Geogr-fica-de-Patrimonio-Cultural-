import { useEffect, useId, useState } from "react";
import { enviarReporte, listarTiposReporte } from "../lib/api";
import { ErrorCarga } from "./Estados";

const MAXIMO = 500;

/** Sección «Reportar» de la ficha (RF-16 y RF-17). Sin cuenta, sin datos de contacto y sin adjuntos. */
export default function Reportar({ bienId }) {
  const idTipo = useId();
  const idTexto = useId();
  const [abierto, setAbierto] = useState(false);
  const [tipos, setTipos] = useState([]);
  const [tipo, setTipo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    setAbierto(false);
    setEnviado(false);
    setError(null);
    setDescripcion("");
  }, [bienId]);

  useEffect(() => {
    if (!abierto || tipos.length) return undefined;
    const control = new AbortController();
    listarTiposReporte(control.signal).then(setTipos, (e) => e?.name !== "AbortError" && setError(e));
    return () => control.abort();
  }, [abierto, tipos.length]);

  const valido = tipo !== "" && descripcion.trim().length > 0 && descripcion.length <= MAXIMO;

  const enviar = async (evento) => {
    evento.preventDefault();
    if (!valido) return;
    setEnviando(true);
    setError(null);
    try {
      await enviarReporte({ bien: Number(bienId), tipo_reporte: Number(tipo), descripcion: descripcion.trim() });
      setEnviado(true);
      setDescripcion("");
      setTipo("");
    } catch (e) {
      setError(e);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section aria-labelledby="t-reportar" className="reportar">
      <h2 id="t-reportar">Reportar</h2>
      {!abierto ? (
        <button type="button" className="boton boton--secundario" onClick={() => setAbierto(true)}>
          Reportar un problema con esta ficha
        </button>
      ) : enviado ? (
        <div className="resultado resultado--ok" role="status">
          <p className="resultado__titulo">¡Gracias! Recibimos tu reporte.</p>
          <p>El equipo editorial lo revisará. No guardamos datos personales, así que no recibirás una respuesta.</p>
          <button type="button" className="boton boton--secundario" onClick={() => setEnviado(false)}>
            Enviar otro reporte
          </button>
        </div>
      ) : (
        <form className="formulario" onSubmit={enviar} noValidate>
          <p className="formulario__nota">Cuéntanos si el bien está deteriorado, si la información es incorrecta o si no se puede acceder. No escribas datos personales.</p>
          <div className="campo">
            <label htmlFor={idTipo}>Tipo de reporte</label>
            <select id={idTipo} value={tipo} onChange={(e) => setTipo(e.target.value)} required>
              <option value="">Elige un tipo…</option>
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor={idTexto}>Describe el problema</label>
            <textarea id={idTexto} rows={4} maxLength={MAXIMO} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} required aria-describedby={`${idTexto}-c`} />
            <span id={`${idTexto}-c`} className="formulario__contador">
              {descripcion.length} / {MAXIMO}
            </span>
          </div>
          {error && <ErrorCarga error={error} />}
          <div className="formulario__acciones">
            <button type="submit" className="boton boton--primario" disabled={!valido || enviando}>
              {enviando ? "Enviando…" : "Enviar reporte"}
            </button>
            <button type="button" className="boton boton--texto" onClick={() => setAbierto(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
