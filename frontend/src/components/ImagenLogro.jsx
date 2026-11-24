import { Award, Lock } from "lucide-react";
import { useState } from "react";

// Ilustración propia de cada logro: se busca en /logros/<codigo>.<ext> (carpeta frontend/public/logros).
// Si todavía no existe, se muestra el recuadro de reserva con el nombre del logro.
const EXTENSIONES = ["png", "webp", "svg", "jpg"];
const resueltas = new Map(); // código → índice de la extensión que existe (o EXTENSIONES.length si no hay imagen)

export const urlLogro = (codigo, extension) => `${import.meta.env.BASE_URL}logros/${codigo}.${extension}`;

export default function ImagenLogro({ logro, tono = "warm", bloqueado = false, mostrarNombre = true, className = "" }) {
  const [indice, setIndice] = useState(() => resueltas.get(logro.codigo) ?? 0);
  const src = indice < EXTENSIONES.length ? urlLogro(logro.codigo, EXTENSIONES[indice]) : null;

  return (
    <div className={`asset-slot tone-${tono} logro-imagen${src ? "" : " is-empty"}${bloqueado ? " is-bloqueado" : ""}${className ? ` ${className}` : ""}`}>
      {src && (
        <img
          key={src}
          src={src}
          alt=""
          className="asset-image logro-imagen__img"
          loading="lazy"
          onLoad={() => resueltas.set(logro.codigo, indice)}
          onError={() => {
            const siguiente = indice + 1;
            if (siguiente >= EXTENSIONES.length) resueltas.set(logro.codigo, EXTENSIONES.length);
            setIndice(siguiente);
          }}
        />
      )}
      <span className="asset-slot__placeholder" aria-hidden="true">
        <span className="asset-slot__icon"><Award size={16} strokeWidth={1.5} /></span>
        {mostrarNombre && <span className="asset-slot__tag">{logro.nombre}</span>}
      </span>
      {bloqueado && <span className="logro-imagen__candado" aria-hidden="true"><Lock size={12} /></span>}
    </div>
  );
}
