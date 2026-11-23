import { ImagePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { urlRecurso } from "../lib/api";

/**
 * Espacio de imagen del diseño («ImageSlot» de la referencia): muestra la fotografía o ilustración y, si no hay
 * imagen o no carga, el recuadro de reserva con icono y etiqueta.
 * `as` permite usarlo como figure (por defecto), div, Link, etc.
 * `tono`: neutral | warm | sage | slate | terracotta (fondo y borde del recuadro, como en la referencia).
 */
export default function Foto({ src, alt = "", as: Etiqueta = "figure", cover = true, transparente = false, imgClassName = "", tono = "neutral", etiqueta, pista, className = "", children, ...resto }) {
  const [fallo, setFallo] = useState(!src);
  useEffect(() => setFallo(!src), [src]);

  const clases = ["asset-slot", transparente ? "asset-slot--transparent" : `tone-${tono}`, fallo && "is-empty", className].filter(Boolean).join(" ");
  return (
    <Etiqueta className={clases} {...resto}>
      {children}
      {src && <img src={urlRecurso(src)} alt={fallo ? "" : alt} className={`asset-image${cover ? " asset-image--cover" : ""}${imgClassName ? ` ${imgClassName}` : ""}`} loading="lazy" onError={() => setFallo(true)} onLoad={() => setFallo(false)} />}
      <span className="asset-slot__placeholder" aria-hidden="true">
        <span className="asset-slot__icon">
          <ImagePlus size={16} strokeWidth={1.5} />
        </span>
        {etiqueta && <span className="asset-slot__tag">{etiqueta}</span>}
        {pista && <span className="asset-slot__hint">{pista}</span>}
      </span>
    </Etiqueta>
  );
}
