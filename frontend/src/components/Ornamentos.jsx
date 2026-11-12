// Ornamentos propios de Paceño: todo es SVG en línea, usa currentColor y es decorativo
// (aria-hidden), así que el color se controla desde el CSS del contenedor.

const base = { "aria-hidden": "true", focusable: "false" };
const CORAZON = "M16 27S4.5 19.8 4.5 11.8c0-3.7 2.8-6.3 6.2-6.3 2.2 0 4.2 1.2 5.3 3.1 1.1-1.9 3.1-3.1 5.3-3.1 3.4 0 6.2 2.6 6.2 6.3C27.5 19.8 16 27 16 27z";

/** Corazón de la marca (se conserva del diseño anterior). */
export function Corazon({ tamano = 22, className = "corazon" }) {
  return (
    <svg className={className} width={tamano} height={tamano} viewBox="0 0 32 32" {...base}>
      <path d={CORAZON} fill="currentColor" />
    </svg>
  );
}

/** Margarita de ocho pétalos. */
export function Margarita({ tamano = 40, className = "" }) {
  return (
    <svg className={className} width={tamano} height={tamano} viewBox="0 0 40 40" {...base}>
      <g fill="#faf4ea" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((giro) => (
          <ellipse key={giro} cx="20" cy="9.5" rx="3.4" ry="7.2" transform={`rotate(${giro} 20 20)`} />
        ))}
      </g>
      <circle cx="20" cy="20" r="4.2" fill="#ca9c59" />
    </svg>
  );
}

/** Rama de lavanda (vertical). */
export function Lavanda({ tamano = 64, className = "" }) {
  const brotes = [
    [20, 10], [16, 16], [24, 16], [14, 24], [26, 24], [12, 32], [28, 32],
  ];
  return (
    <svg className={className} width={tamano * 0.5} height={tamano} viewBox="0 0 40 80" {...base}>
      <path d="M20 78C20 58 20 44 20 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M20 66C14 62 10 56 9 50M20 62c6-4 10-10 11-16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <g fill="#a8999d">
        {brotes.map(([x, y]) => (
          <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="3" ry="5" transform={`rotate(${x < 20 ? -22 : x > 20 ? 22 : 0} ${x} ${y})`} />
        ))}
      </g>
    </svg>
  );
}

/** Destello de cuatro puntas (guiño a los destellos de la web del Museo Mucha). */
export function Chispa({ tamano = 18, className = "" }) {
  return (
    <svg className={className} width={tamano} height={tamano} viewBox="0 0 24 24" {...base}>
      <path d="M12 1c.6 6.4 4.6 10.4 11 11-6.4.6-10.4 4.6-11 11-.6-6.4-4.6-10.4-11-11 6.4-.6 10.4-4.6 11-11z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

const HOJA = "M0 0C3-6 11-6 15 0 11 6 3 6 0 0z";

/** Ramita horizontal con corazón central: separador de secciones. */
export function Ramita({ className = "", ancho = 260 }) {
  const hojas = [
    [18, 17, -35], [38, 13, -28], [58, 10, -22], [78, 8, -14],
    [26, 21, 38], [48, 17, 30], [68, 14, 22],
  ];
  const lado = (espejo) => (
    <g transform={espejo ? "translate(260 0) scale(-1 1)" : undefined}>
      <path d="M6 20C34 20 66 14 106 18" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      {hojas.map(([x, y, giro]) => (
        <path key={`${x}-${y}`} d={HOJA} transform={`translate(${x} ${y}) rotate(${giro})`} fill="currentColor" opacity="0.8" />
      ))}
    </g>
  );
  return (
    <svg className={className} width={ancho} height={(ancho * 40) / 260} viewBox="0 0 260 40" {...base}>
      {lado(false)}
      {lado(true)}
      <path d={CORAZON} transform="translate(116 4) scale(.88)" fill="#b67b5b" />
    </svg>
  );
}

/** Sello circular con texto (como el de la web del Museo Mucha). Gira despacio. */
export function Sello({ texto = "PACEÑO · PATRIMONIO CULTURAL · LA PAZ · ", tamano = 120, className = "" }) {
  return (
    <svg className={className} width={tamano} height={tamano} viewBox="0 0 120 120" {...base}>
      <defs>
        <path id="sello-circulo" d="M60 60m-46 0a46 46 0 1 1 92 0a46 46 0 1 1-92 0" />
      </defs>
      <text fill="currentColor" fontSize="9.5" fontWeight="500" fontFamily="var(--f-cuerpo)">
        <textPath href="#sello-circulo" textLength="286" lengthAdjust="spacing">{texto}</textPath>
      </text>
      <path d={CORAZON} transform="translate(44 44) scale(1)" fill="currentColor" opacity="0.85" />
    </svg>
  );
}
