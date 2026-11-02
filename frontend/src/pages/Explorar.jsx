import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Cargando, ErrorCarga, Vacio } from "../components/Estados";
import Filtros from "../components/Filtros";
import ListaBienes from "../components/ListaBienes";
import MapaBienes from "../components/MapaBienes";
import Paginacion from "../components/Paginacion";
import { useUbicacion } from "../hooks/Ubicacion";
import { useDatos, useRetardo } from "../hooks/useDatos";
import { useMedia } from "../hooks/useMedia";
import { listarBienes, listarCategorias, listarMarcadores } from "../lib/api";

const TAMANO_PAGINA = 10;

function BarraUbicacion() {
  const { fase, mensaje, solicitar, quitar } = useUbicacion();
  return (
    <div className="ubicacion">
      {fase === "activa" ? (
        <>
          <p>Mostrando distancias aproximadas desde tu ubicación. No se envía ni se guarda.</p>
          <button type="button" className="boton boton--texto" onClick={quitar}>
            Dejar de usar mi ubicación
          </button>
        </>
      ) : (
        <button type="button" className="boton boton--secundario" onClick={solicitar} disabled={fase === "pidiendo"}>
          {fase === "pidiendo" ? "Obteniendo ubicación…" : "Ver distancia a cada bien"}
        </button>
      )}
      {fase === "error" && (
        <p className="ubicacion__aviso" role="status">
          {mensaje}
        </p>
      )}
    </div>
  );
}

export default function Explorar() {
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const { posicion } = useUbicacion();
  const escritorio = useMedia("(min-width: 900px)");

  const q = params.get("q") ?? "";
  const categoria = params.get("categoria") ?? "";
  const pagina = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const vista = params.get("vista") === "lista" ? "lista" : "mapa";

  const [texto, setTexto] = useState(q);
  const textoRetardado = useRetardo(texto, 300);
  const [seleccionado, setSeleccionado] = useState(null);

  const actualizar = useCallback(
    (cambios, reiniciarPagina = false) =>
      setParams(
        (previos) => {
          const siguientes = new URLSearchParams(previos);
          for (const [clave, valor] of Object.entries(cambios)) {
            if (valor === "" || valor == null) siguientes.delete(clave);
            else siguientes.set(clave, String(valor));
          }
          if (reiniciarPagina) siguientes.delete("page");
          return siguientes;
        },
        { replace: true },
      ),
    [setParams],
  );

  // La búsqueda escrita pasa a la URL tras la pausa (se puede compartir y sobrevive a «atrás»).
  useEffect(() => {
    if (textoRetardado.trim() !== q.trim()) actualizar({ q: textoRetardado.trim() }, true);
  }, [textoRetardado]); // eslint-disable-line react-hooks/exhaustive-deps

  const categorias = useDatos(useCallback((signal) => listarCategorias(signal), []));
  const lista = useDatos(useCallback((signal) => listarBienes({ q, categoria, page: pagina, pageSize: TAMANO_PAGINA }, signal), [q, categoria, pagina]));
  const mapa = useDatos(useCallback((signal) => listarMarcadores({ q, categoria }, signal), [q, categoria]));

  // Si la página pedida ya no existe (p. ej. tras filtrar), vuelve a la primera.
  useEffect(() => {
    if (lista.error?.estado === 404 && pagina > 1) actualizar({}, true);
  }, [lista.error, pagina, actualizar]);

  useEffect(() => {
    document.title = "Explorar el patrimonio · Paceño";
  }, []);

  const hayFiltros = Boolean(q || categoria);
  const limpiar = () => {
    setTexto("");
    actualizar({ q: "", categoria: "" }, true);
  };
  const verEnMapa = (id) => {
    setSeleccionado(id);
    if (!escritorio) actualizar({ vista: "mapa" });
  };
  const total = lista.datos?.count;
  const sinUbicacion = mapa.datos ? mapa.datos.total - mapa.datos.marcadores.length : 0;
  const mostrarLista = escritorio || vista === "lista";
  const mostrarMapa = escritorio || vista === "mapa";

  return (
    <main className="explorar" id="contenido">
      <div className="explorar__filtros">
        <h1 className="titulo-pagina">Explorar el patrimonio</h1>
        <Filtros
          texto={texto}
          onTexto={setTexto}
          categoria={categoria}
          onCategoria={(valor) => actualizar({ categoria: valor }, true)}
          categorias={categorias.datos ?? []}
          hayFiltros={hayFiltros}
          onLimpiar={limpiar}
        />
        <BarraUbicacion />
        <p className="contador" role="status" aria-live="polite">
          {total == null ? "" : total === 0 ? "Ningún bien coincide con tu búsqueda." : total === 1 ? "1 bien encontrado" : `${total} bienes encontrados`}
        </p>
      </div>

      <div className="pestanas" role="group" aria-label="Cambiar entre mapa y lista">
        {[["mapa", "Mapa"], ["lista", "Lista"]].map(([valor, etiqueta]) => (
          <button key={valor} type="button" aria-pressed={vista === valor} onClick={() => actualizar({ vista: valor })}>
            {vista === valor && <span aria-hidden="true">✓ </span>}
            {etiqueta}
          </button>
        ))}
      </div>

      <section className="explorar__lista" aria-label="Lista de bienes" hidden={!mostrarLista}>
        {lista.cargando && !lista.datos && <Cargando texto="Cargando bienes…" />}
        {lista.error && lista.error.estado !== 404 && <ErrorCarga error={lista.error} onReintentar={lista.reintentar} />}
        {lista.datos && lista.datos.results.length === 0 && (
          <Vacio titulo="No encontramos bienes con esos criterios.">
            <p>Prueba con otra palabra o quita los filtros.</p>
            {hayFiltros && (
              <button type="button" className="boton boton--secundario" onClick={limpiar}>
                Quitar filtros
              </button>
            )}
          </Vacio>
        )}
        {lista.datos && lista.datos.results.length > 0 && (
          <>
            <ListaBienes bienes={lista.datos.results} seleccionado={seleccionado} onVerEnMapa={verEnMapa} />
            <Paginacion pagina={pagina} total={lista.datos.count} tamano={TAMANO_PAGINA} onCambiar={(n) => actualizar({ page: n === 1 ? "" : n })} />
          </>
        )}
      </section>

      <section className="explorar__mapa" aria-label="Mapa" hidden={!mostrarMapa}>
        <MapaBienes
          bienes={mapa.datos?.marcadores ?? []}
          seleccionado={seleccionado}
          posicion={posicion}
          visible={mostrarMapa}
          onAbrir={(id) => navegar(`/bienes/${id}`)}
        />
        {mapa.error && (
          <div className="mapa__aviso">
            <ErrorCarga error={mapa.error} onReintentar={mapa.reintentar} />
            <p>La lista sigue disponible.</p>
          </div>
        )}
        {mapa.datos && sinUbicacion > 0 && (
          <p className="mapa__nota">
            {sinUbicacion === 1 ? "1 bien no tiene" : `${sinUbicacion} bienes no tienen`} ubicación puntual y solo {sinUbicacion === 1 ? "aparece" : "aparecen"} en la lista.
          </p>
        )}
      </section>
    </main>
  );
}
