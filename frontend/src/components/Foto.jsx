import { useEffect, useState } from "react";

/**
 * Espacio de imagen del diseño («asset-slot»): muestra la fotografía o ilustración y, si no hay
 * imagen o no carga, el recuadro punteado de reserva con su etiqueta, igual que el frontend de referencia.
 * `as` permite usarlo como figure (por defecto), div, Link, etc.
 */
export default function Foto({ src, alt = "", as: Etiqueta = "figure", cover = true, transparente = false, etiqueta, pista, className = "", children, ...resto }) {
  const [fallo, setFallo] = useState(!src);
  useEffect(() => setFallo(!src), [src]);

  const clases = ["asset-slot", transparente && "asset-slot--transparent", fallo && "is-empty", className].filter(Boolean).join(" ");
  return (
    <Etiqueta className={clases} {...resto}>
      {children}
      {src && <img src={src} alt={fallo ? "" : alt} className={`asset-image${cover ? " asset-image--cover" : ""}`} loading="lazy" onError={() => setFallo(true)} onLoad={() => setFallo(false)} />}
      <span className="asset-slot__placeholder" aria-hidden="true">
        {etiqueta && <span className="asset-slot__tag">{etiqueta}</span>}
        {pista && <span className="asset-slot__hint">{pista}</span>}
      </span>
    </Etiqueta>
  );
}
