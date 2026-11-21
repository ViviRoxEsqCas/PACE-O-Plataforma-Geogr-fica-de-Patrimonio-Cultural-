import { useCallback, useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import {
  desmarcarVisitado, guardarValoracion, listarComentarios, marcarVisitado, reportarComentario, resumenSocial, retirarValoracion,
} from "../lib/api";
import { useSesion } from "../hooks/Sesion";
import { useAviso } from "./Aviso";
import Persona from "./Persona";
import { EstrellasLectura, EstrellasSelector } from "./Estrellas";
import { ErrorCarga } from "./Estados";

const MAXIMO = 500;
const fecha = (iso) => new Date(iso).toLocaleDateString("es-BO", { day: "numeric", month: "short", year: "numeric" });

/** «Visitado»: declaración de la persona. No se verifica con GPS y no se envía ninguna ubicación. */
function Visita({ bienId, visitado, onCambio }) {
  const aviso = useAviso();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const cambiar = async () => {
    setEnviando(true);
    setError(null);
    try {
      if (visitado) await desmarcarVisitado(bienId);
      else await marcarVisitado(bienId);
      onCambio(!visitado);
      aviso(visitado ? "Quitaste la marca de visitado." : "Marcado como visitado (declarado).");
    } catch (e) {
      setError(e);
    } finally {
      setEnviando(false);
    }
  };
  return (
    <div className="social__visita">
      <button type="button" className={visitado ? "btn-outline-pill is-activo" : "cta-pill-btn"} onClick={cambiar} disabled={enviando} aria-pressed={visitado}>
        {visitado ? "✓ Visitado · quitar marca" : "Marcar como visitado"}
      </button>
      <p className="formulario__nota">Visita <strong>declarada por ti</strong>: no está verificada ni usa tu ubicación. Abrir una ficha no cuenta como visita.</p>
      {error && <ErrorCarga error={error} />}
    </div>
  );
}

function FormularioValoracion({ bienId, propia, onGuardada, onRetirada }) {
  const idTexto = useId();
  const aviso = useAviso();
  const [estrellas, setEstrellas] = useState(propia?.estrellas ?? 0);
  const [comentario, setComentario] = useState(propia?.comentario ?? "");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const enviar = async (evento) => {
    evento.preventDefault();
    if (!estrellas) return;
    setEnviando(true);
    setError(null);
    try {
      await guardarValoracion(bienId, { estrellas, comentario: comentario.trim() });
      aviso(propia ? "Actualizaste tu valoración." : "¡Gracias por tu valoración!");
      onGuardada();
    } catch (e) {
      setError(e);
    } finally {
      setEnviando(false);
    }
  };
  const retirar = async () => {
    setEnviando(true);
    setError(null);
    try {
      await retirarValoracion(bienId);
      setEstrellas(0);
      setComentario("");
      aviso("Retiraste tu valoración.");
      onRetirada();
    } catch (e) {
      setError(e);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="formulario" onSubmit={enviar} noValidate>
      <div className="campo">
        <span className="campo__etiqueta">{propia ? "Tu valoración" : "Valora este bien"}</span>
        <EstrellasSelector valor={estrellas} onCambiar={setEstrellas} deshabilitado={enviando} />
      </div>
      <div className="campo">
        <label htmlFor={idTexto}>Tu opinión (opcional)</label>
        <textarea id={idTexto} rows={3} maxLength={MAXIMO} value={comentario} onChange={(e) => setComentario(e.target.value)} aria-describedby={`${idTexto}-c`} />
        <span id={`${idTexto}-c`} className="formulario__contador">{comentario.length} / {MAXIMO}</span>
      </div>
      {propia?.comentario_oculto && (
        <p className="resultado resultado--mal" role="status">El equipo editorial ocultó tu comentario. Tus estrellas siguen contando.</p>
      )}
      {error && <ErrorCarga error={error} />}
      <div className="formulario__acciones">
        <button type="submit" className="cta-pill-btn" disabled={!estrellas || enviando}>
          {enviando ? "Guardando…" : propia ? "Guardar cambios" : "Publicar valoración"}
        </button>
        {propia && (
          <button type="button" className="btn-text" onClick={retirar} disabled={enviando}>
            Retirar mi valoración
          </button>
        )}
      </div>
    </form>
  );
}

function Comentario({ c, puedeReportar }) {
  const aviso = useAviso();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState(null);
  const [hecho, setHecho] = useState(false);

  const reportar = async (evento) => {
    evento.preventDefault();
    setError(null);
    try {
      await reportarComentario(c.id, motivo.trim());
      setHecho(true);
      setAbierto(false);
      aviso("Gracias. El equipo editorial revisará el comentario.");
    } catch (e) {
      setError(e);
    }
  };
  return (
    <li className="comentario">
      <div className="comentario__cab">
        {c.autor ? <Persona persona={c.autor} tamano={30} /> : <span className="persona__nombre">Persona visitante</span>}
        <EstrellasLectura valor={c.estrellas} />
        <time dateTime={c.fecha} className="comentario__fecha">{fecha(c.fecha)}</time>
      </div>
      <p className="comentario__texto">{c.comentario}</p>
      {puedeReportar && !c.propia && !hecho && (
        <>
          {!abierto ? (
            <button type="button" className="btn-text" onClick={() => setAbierto(true)}>Reportar comentario</button>
          ) : (
            <form className="formulario" onSubmit={reportar} noValidate>
              <div className="campo">
                <label htmlFor={`m-${c.id}`}>Motivo del reporte</label>
                <input id={`m-${c.id}`} type="text" maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </div>
              {error && <ErrorCarga error={error} />}
              <div className="formulario__acciones">
                <button type="submit" className="btn-outline-pill" disabled={motivo.trim().length < 3}>Enviar reporte</button>
                <button type="button" className="btn-text" onClick={() => setAbierto(false)}>Cancelar</button>
              </div>
            </form>
          )}
        </>
      )}
      {hecho && <p className="formulario__nota">Reporte enviado.</p>}
    </li>
  );
}

/** Espacio social de la ficha: valoración, comentarios ciudadanos y visita declarada. */
export default function Opiniones({ bienId }) {
  const { perfil, listo } = useSesion();
  const [resumen, setResumen] = useState(null);
  const [comentarios, setComentarios] = useState({ results: [], count: 0, page: 1, has_next: false });
  const [error, setError] = useState(null);
  const [cargandoMas, setCargandoMas] = useState(false);
  const usuario = perfil?.username ?? null;

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [r, c] = await Promise.all([resumenSocial(bienId), listarComentarios(bienId, 1)]);
      setResumen(r);
      setComentarios(c);
    } catch (e) {
      if (e?.name !== "AbortError") setError(e);
    }
  }, [bienId]);

  // Se recarga al cambiar de ficha o de sesión (ingresar/salir cambia «lo mío»).
  useEffect(() => {
    setResumen(null); // al cambiar de ficha o de cuenta no se muestran datos de la anterior
    setComentarios({ results: [], count: 0, page: 1, has_next: false });
    if (listo) cargar();
  }, [cargar, listo, usuario]);

  const verMas = async () => {
    setCargandoMas(true);
    try {
      const c = await listarComentarios(bienId, comentarios.page + 1);
      setComentarios((p) => ({ ...c, results: [...p.results, ...c.results] }));
    } catch (e) {
      setError(e);
    } finally {
      setCargandoMas(false);
    }
  };

  return (
    <section className="detail-panel social" aria-labelledby="t-social">
      <h2 id="t-social" className="detail-panel__title">Opiniones de visitantes</h2>
      <p className="formulario__nota">
        Son experiencias y valoraciones de personas visitantes. <strong>No son información verificada</strong> por el equipo editorial: la ficha de arriba y sus fuentes sí lo son.
      </p>
      {error && <ErrorCarga error={error} onReintentar={cargar} />}
      {resumen && (
        <div className="social__resumen">
          {resumen.cantidad > 0 ? (
            <>
              <strong className="social__promedio">{resumen.promedio.toFixed(1)}</strong>
              <EstrellasLectura valor={resumen.promedio} etiqueta={`Promedio ${resumen.promedio.toFixed(1)} de 5 estrellas`} />
              <span>{resumen.cantidad} {resumen.cantidad === 1 ? "valoración" : "valoraciones"}</span>
            </>
          ) : (
            <span>Aún no hay valoraciones. ¡Sé la primera persona!</span>
          )}
          <span className="social__visitas">{resumen.visitas_declaradas} {resumen.visitas_declaradas === 1 ? "visita declarada" : "visitas declaradas"}</span>
        </div>
      )}

      {perfil ? (
        resumen && (
          <>
            <Visita bienId={bienId} visitado={Boolean(resumen.visitado)} onCambio={(v) => setResumen((r) => ({ ...r, visitado: v, visitas_declaradas: r.visitas_declaradas + (v ? 1 : -1) }))} />
            <FormularioValoracion key={`${bienId}-${usuario}`} bienId={bienId} propia={resumen.mi_valoracion} onGuardada={cargar} onRetirada={cargar} />
          </>
        )
      ) : (
        <p className="social__invitacion">
          <Link to="/cuenta" className="btn-outline-pill">Ingresa o crea tu cuenta</Link> para valorar, comentar y marcar este bien como visitado.
        </p>
      )}

      <h3 className="social__subtitulo">Comentarios ({comentarios.count})</h3>
      {comentarios.results.length === 0 ? (
        <p className="formulario__nota">Todavía no hay comentarios.</p>
      ) : (
        <ul className="comentarios">
          {comentarios.results.map((c) => (
            <Comentario key={c.id} c={c} puedeReportar={Boolean(perfil)} />
          ))}
        </ul>
      )}
      {comentarios.has_next && (
        <button type="button" className="btn-outline-pill" onClick={verMas} disabled={cargandoMas}>
          {cargandoMas ? "Cargando…" : "Ver más comentarios"}
        </button>
      )}
    </section>
  );
}
