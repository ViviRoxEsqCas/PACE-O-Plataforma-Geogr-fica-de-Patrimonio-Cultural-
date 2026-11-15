import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { distanciaA, formatearDistancia } from "../lib/distancia";
import { nombreTipo } from "../lib/bienes";

// Vista inicial del diseño de referencia (centro de La Paz); luego se encuadran los marcadores.
const CENTRO = [-16.4975, -68.1335];
const ZOOM = 14;
// CARTO (estilo Positron del diseño) exige una clave de API desde el 25/09/2026: sin ella sus teselas muestran
// «API KEY REQUIRED» en lugar del mapa. Con VITE_CARTO_API_KEY se conserva ese mapa base; sin clave se usa
// OpenStreetMap, que no la requiere (el servicio devuelve 200 con el aviso, así que no se puede detectar el fallo).
const CLAVE_CARTO = (import.meta.env?.VITE_CARTO_API_KEY ?? "").trim();
const TESELAS = CLAVE_CARTO
  ? `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(CLAVE_CARTO)}`
  : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATRIBUCION_OSM = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">Colaboradores de OpenStreetMap</a>';
const ATRIBUCION = `${ATRIBUCION_OSM}${CLAVE_CARTO ? ' © <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>' : ""} · PACEÑO`;

/** Pin numerado del diseño. `texto` es el número del marcador (o ★ en la ficha). */
function iconoPin(texto, seleccionado) {
  return L.divIcon({
    className: "marcador paceno-pin-wrapper",
    html: `<div class="paceno-pin${seleccionado ? " is-selected" : ""}"><span class="paceno-pin__inner">${texto}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34],
  });
}

function contenidoVistaPrevia(bien, posicion, onAbrir) {
  const caja = document.createElement("div");
  caja.className = "map-popup-card vista-previa";
  const categoria = document.createElement("span");
  categoria.className = "map-popup-card__cat";
  categoria.textContent = bien.categoria.nombre;
  const titulo = document.createElement("strong");
  titulo.className = "map-popup-card__title";
  titulo.textContent = bien.nombre;
  const meta = document.createElement("span");
  meta.className = "map-popup-card__zone";
  const distancia = formatearDistancia(distanciaA(bien, posicion));
  meta.textContent = [`Patrimonio ${nombreTipo(bien.tipo).toLowerCase()}`, distancia].filter(Boolean).join(" · ");
  caja.append(categoria, titulo, meta);
  if (onAbrir) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "map-popup-card__cta";
    boton.textContent = "Abrir ficha patrimonial →";
    boton.addEventListener("click", () => onAbrir(bien.id));
    caja.append(boton);
  }
  return caja;
}

/**
 * Mapa Leaflet con un pin numerado por bien con coordenadas (RF-07).
 * bienes: con latitud/longitud · foco: { id, volar } del bien a destacar (objeto nuevo en cada petición)
 * posicion: { lat, lon } | null · reinicio: número que, al cambiar, restablece la vista
 * onAbrir(id) abre la ficha · onSeleccionar(id) avisa del pin pulsado · ficha: versión de un solo bien (★, sin vista previa).
 */
export default function MapaBienes({ bienes, foco, posicion, onAbrir, onSeleccionar, reinicio = 0, ficha = false, className = "", etiqueta = "Mapa de bienes patrimoniales" }) {
  const contenedor = useRef(null);
  const mapa = useRef(null);
  const capa = useRef(null);
  const capaPosicion = useRef(null);
  const marcadores = useRef(new Map()); // id → { marcador, numero }
  const abrirRef = useRef(onAbrir);
  abrirRef.current = onAbrir;
  const seleccionarRef = useRef(onSeleccionar);
  seleccionarRef.current = onSeleccionar;
  const bienesRef = useRef(bienes);
  bienesRef.current = bienes;
  const encuadrado = useRef("");
  const focoAplicado = useRef(null);

  const encuadrar = () => {
    const puntos = bienesRef.current.filter((b) => b.tiene_ubicacion).map((b) => [b.latitud, b.longitud]);
    if (puntos.length > 1) mapa.current.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 17 });
    else if (puntos.length === 1) mapa.current.setView(puntos[0], 16);
    else mapa.current.setView(CENTRO, ZOOM);
  };

  useEffect(() => {
    const instancia = L.map(contenedor.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false }).setView(CENTRO, ZOOM);
    L.control.zoom({ position: "bottomright", zoomInTitle: "Acercar", zoomOutTitle: "Alejar" }).addTo(instancia);
    L.tileLayer(TESELAS, { maxZoom: 19, attribution: ATRIBUCION }).addTo(instancia);
    capa.current = L.layerGroup().addTo(instancia);
    capaPosicion.current = L.layerGroup().addTo(instancia);
    mapa.current = instancia;
    // El diseño reacomoda el mapa al cambiar de ancho (tablet/móvil) o al cargar las tipografías.
    const observador = typeof ResizeObserver === "function" ? new ResizeObserver(() => instancia.invalidateSize()) : null;
    observador?.observe(contenedor.current);
    return () => {
      observador?.disconnect();
      instancia.remove();
      mapa.current = null;
    };
  }, []);

  // Marcadores
  useEffect(() => {
    const instancia = mapa.current;
    if (!instancia) return;
    capa.current.clearLayers();
    marcadores.current.clear();
    let numero = 0;
    for (const bien of bienes) {
      if (!bien.tiene_ubicacion) continue;
      numero += 1;
      const texto = ficha ? "★" : String(numero).padStart(2, "0");
      const marcador = L.marker([bien.latitud, bien.longitud], { icon: iconoPin(texto, ficha || foco?.id === bien.id), title: bien.nombre, keyboard: true });
      if (!ficha) {
        marcador.bindPopup(() => contenidoVistaPrevia(bien, posicion, abrirRef.current && ((id) => abrirRef.current(id))), { closeButton: true });
        marcador.on("click", () => seleccionarRef.current?.(bien.id));
      }
      marcador.on("add", () => marcador.getElement()?.setAttribute("aria-label", ficha ? `Ubicación de ${bien.nombre}` : `${bien.nombre}. Abrir vista previa`));
      marcador.addTo(capa.current);
      marcadores.current.set(bien.id, { marcador, texto });
    }
    // Encuadra solo cuando cambia el conjunto de bienes, no cada vez que llega la posición.
    const clave = bienes.map((b) => b.id).join(",");
    if (clave !== encuadrado.current) {
      encuadrado.current = clave;
      encuadrar();
    }
  }, [bienes, posicion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Posición de la persona (solo si la concedió)
  useEffect(() => {
    capaPosicion.current?.clearLayers();
    if (posicion) {
      L.circleMarker([posicion.lat, posicion.lon], { radius: 8, color: "#fff", weight: 3, fillColor: "#c8161d", fillOpacity: 1 })
        .bindTooltip("Tu ubicación aproximada")
        .addTo(capaPosicion.current);
    }
  }, [posicion]);

  // Pin seleccionado en rojo (el diseño marca el pin activo)
  useEffect(() => {
    if (ficha) return;
    for (const [id, { marcador }] of marcadores.current) marcador.getElement()?.querySelector(".paceno-pin")?.classList.toggle("is-selected", id === foco?.id);
  }, [foco, bienes, ficha]);

  // Abrir la vista previa del bien enfocado desde la lista lateral, las tarjetas o la URL
  useEffect(() => {
    if (!foco || focoAplicado.current === foco) return;
    const entrada = marcadores.current.get(foco.id);
    if (!entrada || !mapa.current) return;
    focoAplicado.current = foco;
    if (foco.volar) mapa.current.flyTo(entrada.marcador.getLatLng(), Math.max(mapa.current.getZoom(), 16), { duration: 0.75 });
    entrada.marcador.openPopup();
  }, [foco, bienes]);

  // «Restablecer vista»
  const reinicioPrevio = useRef(reinicio);
  useEffect(() => {
    if (reinicioPrevio.current === reinicio) return;
    reinicioPrevio.current = reinicio;
    mapa.current?.closePopup();
    encuadrar();
  }, [reinicio]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={contenedor} className={`mapa ${className}`.trim()} role="region" aria-label={etiqueta} />;
}
