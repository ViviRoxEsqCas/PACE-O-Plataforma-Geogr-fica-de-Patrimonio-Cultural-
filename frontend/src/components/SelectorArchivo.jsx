import { ImagePlus, X } from "lucide-react";
import { useEffect, useState } from "react";

const tamano = (bytes) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);

/**
 * Selector de imagen con la estética de la interfaz (reemplaza al «Choose file» del navegador).
 * El <input type="file"> sigue en el DOM (accesible por teclado y lector de pantalla); la zona punteada es su
 * etiqueta y acepta arrastrar y soltar. `forma`: "circulo" (fotografía) | "banner" (cabecera 21/6).
 * `actual` es la URL que ya está guardada; `archivo` es la elección pendiente (se previsualiza sin subirla).
 */
export default function SelectorArchivo({ id, accept, archivo, actual = null, onChange, forma = "circulo", titulo = "Elegir imagen", ayuda, deshabilitado = false }) {
  const [vista, setVista] = useState(null);
  const [arrastrando, setArrastrando] = useState(false);

  useEffect(() => {
    if (!archivo) {
      setVista(null);
      return undefined;
    }
    const url = URL.createObjectURL(archivo);
    setVista(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  const imagen = vista || actual;
  const soltar = (evento) => {
    evento.preventDefault();
    setArrastrando(false);
    if (deshabilitado) return;
    const soltado = evento.dataTransfer?.files?.[0];
    if (soltado) onChange(soltado);
  };

  return (
    <div
      className={`file-picker file-picker--${forma}${arrastrando ? " is-dragging" : ""}${deshabilitado ? " is-disabled" : ""}`}
      onDragOver={(e) => { e.preventDefault(); if (!deshabilitado) setArrastrando(true); }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={soltar}
    >
      <input
        id={id}
        className="file-picker__input"
        type="file"
        accept={accept}
        disabled={deshabilitado}
        onChange={(e) => {
          const elegido = e.target.files?.[0] ?? null;
          e.target.value = ""; // permite volver a elegir el mismo archivo tras descartarlo
          if (elegido) onChange(elegido);
        }}
      />
      <label htmlFor={id} className="file-picker__zone">
        <span className="file-picker__preview" aria-hidden="true">
          {imagen ? <img src={imagen} alt="" /> : <ImagePlus />}
        </span>
        <span className="file-picker__texto">
          <span className="file-picker__titulo">{archivo ? "Elegir otra imagen" : titulo}</span>
          <span className="file-picker__ayuda">{archivo ? `${archivo.name} · ${tamano(archivo.size)}` : ayuda ?? "o arrástrala hasta aquí"}</span>
        </span>
        <span className="file-picker__boton btn-outline-pill" aria-hidden="true">Examinar</span>
      </label>
      {archivo && (
        <button type="button" className="file-picker__quitar" onClick={() => onChange(null)} aria-label="Descartar la imagen elegida">
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
