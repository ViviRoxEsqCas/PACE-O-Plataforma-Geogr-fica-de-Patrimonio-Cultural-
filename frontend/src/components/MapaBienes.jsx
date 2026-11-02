import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { distanciaA, formatearDistancia } from "../lib/distancia";

// Centro del área piloto (plaza Murillo / San Francisco); se usa si aún no hay marcadores.
const CENTRO_PILOTO = [-16.4956, -68.1345];
const ATRIBUCION = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">Colaboradores de OpenStreetMap</a>';

// Marcador con forma de corazón (motivo de la marca): se reconoce por la forma, no solo por el color.
const ICONO = L.divIcon({
  className: "marcador",
  html: '<svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true" focusable="false"><path d="M16 29S3.5 21.2 3.5 12.4c0-4 3-6.9 6.7-6.9 2.4 0 4.6 1.3 5.8 3.4 1.2-2.1 3.4-3.4 5.8-3.4 3.7 0 6.7 2.9 6.7 6.9C28.5 21.2 16 29 16 29z" fill="#7b3b3a" stroke="#fff" stroke-width="2"/></svg>',
  iconSize: [34, 34],
  iconAnchor: [17, 31],
  popupAnchor: [0, -28],
});

function contenidoVistaPrevia(bien, posicion, onAbrir) {
  const caja = document.createElement("div");
  caja.className = "vista-previa";
  const titulo = document.createElement("strong");
  titulo.textContent = bien.nombre;
  const meta = document.createElement("span");
  meta.textContent = `${bien.tipo === "material" ? "Material" : "Inmaterial"} · ${bien.categoria.nombre}`;
  caja.append(titulo, meta);
  const distancia = formatearDistancia(distanciaA(bien, posicion));
  if (distancia) {
    const d = document.createElement("span");
    d.textContent = distancia;
    caja.append(d);
  }
  if (onAbrir) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "boton boton--primario";
    boton.textContent = "Ver ficha";
    boton.addEventListener("click", () => onAbrir(bien.id));
    caja.append(boton);
  }
  return caja;
}

/**
 * Mapa Leaflet con un marcador por bien con coordenadas (RF-07).
 * Props: bienes (con latitud/longitud), seleccionado (id a destacar), posicion ({lat,lon} | null),
 * visible (recalcula el tamaño al mostrarse), onAbrir(id), altura opcional por CSS.
 */
export default function MapaBienes({ bienes, seleccionado, posicion, visible = true, onAbrir, etiqueta = "Mapa de bienes patrimoniales" }) {
  const contenedor = useRef(null);
  const mapa = useRef(null);
  const capa = useRef(null);
  const capaPosicion = useRef(null);
  const marcadores = useRef(new Map());
  const abrirRef = useRef(onAbrir);
  abrirRef.current = onAbrir;
  const encuadrado = useRef("");

  useEffect(() => {
    const instancia = L.map(contenedor.current, { zoomControl: false, attributionControl: true }).setView(CENTRO_PILOTO, 15);
    L.control.zoom({ zoomInTitle: "Acercar", zoomOutTitle: "Alejar" }).addTo(instancia);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: ATRIBUCION }).addTo(instancia);
    capa.current = L.layerGroup().addTo(instancia);
    capaPosicion.current = L.layerGroup().addTo(instancia);
    mapa.current = instancia;
    return () => {
      instancia.remove();
      mapa.current = null;
    };
  }, []);

  useEffect(() => {
    if (visible) setTimeout(() => mapa.current?.invalidateSize(), 0);
  }, [visible]);

  // Marcadores
  useEffect(() => {
    const instancia = mapa.current;
    if (!instancia) return;
    capa.current.clearLayers();
    marcadores.current.clear();
    for (const bien of bienes) {
      if (!bien.tiene_ubicacion) continue;
      const marcador = L.marker([bien.latitud, bien.longitud], { icon: ICONO, title: bien.nombre, keyboard: true });
      marcador.bindPopup(() => contenidoVistaPrevia(bien, posicion, abrirRef.current && ((id) => abrirRef.current(id))), { closeButton: true });
      marcador.on("add", () => marcador.getElement()?.setAttribute("aria-label", `${bien.nombre}. Abrir vista previa`));
      marcador.addTo(capa.current);
      marcadores.current.set(bien.id, marcador);
    }
    // Encuadra solo cuando cambia el conjunto de bienes, no cada vez que llega la posición.
    const clave = bienes.map((b) => b.id).join(",");
    if (clave !== encuadrado.current) {
      encuadrado.current = clave;
      const puntos = bienes.filter((b) => b.tiene_ubicacion).map((b) => [b.latitud, b.longitud]);
      if (puntos.length > 1) instancia.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 17 });
      else if (puntos.length === 1) instancia.setView(puntos[0], 17);
    }
  }, [bienes, posicion]);

  // Posición de la persona (solo si la concedió)
  useEffect(() => {
    capaPosicion.current?.clearLayers();
    if (posicion) {
      L.circleMarker([posicion.lat, posicion.lon], { radius: 8, color: "#fff", weight: 3, fillColor: "#1f6f6b", fillOpacity: 1 })
        .bindTooltip("Tu ubicación aproximada")
        .addTo(capaPosicion.current);
    }
  }, [posicion]);

  // Abrir la vista previa del bien seleccionado desde la lista
  useEffect(() => {
    if (seleccionado == null) return;
    const marcador = marcadores.current.get(seleccionado);
    if (marcador && mapa.current) {
      mapa.current.setView(marcador.getLatLng(), Math.max(mapa.current.getZoom(), 16));
      marcador.openPopup();
    }
  }, [seleccionado]);

  return <div ref={contenedor} className="mapa" role="region" aria-label={etiqueta} />;
}
