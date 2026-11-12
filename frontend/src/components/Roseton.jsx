// Rosetón de seis pétalos: el motivo de la marca (inspirado en la flor de la referencia y en la kantuta).
// `petalos`/`centro` aceptan cualquier color CSS; con "currentColor" se tiñe desde el contenedor.
const PETALOS = [
  [16, 7],
  [23.8, 11.5],
  [23.8, 20.5],
  [16, 25],
  [8.2, 20.5],
  [8.2, 11.5],
];

export function Roseton({ tamano = 28, petalos = "#ee8296", centro = "#d6c77e", className = "roseton", ...resto }) {
  return (
    <svg className={className} width={tamano} height={tamano} viewBox="0 0 32 32" aria-hidden="true" focusable="false" {...resto}>
      <g fill={petalos}>
        {PETALOS.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="5.2" />
        ))}
      </g>
      <circle cx="16" cy="16" r="4.4" fill={centro} />
    </svg>
  );
}

/** Mismo dibujo como texto SVG, para el marcador de Leaflet (que no es React). */
export const ROSETON_SVG = (tamano = 40) =>
  `<svg viewBox="0 0 32 32" width="${tamano}" height="${tamano}" aria-hidden="true" focusable="false">` +
  `<g fill="#ee8296" stroke="#fffdf8" stroke-width="1.4">${PETALOS.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5.2"/>`).join("")}</g>` +
  `<circle cx="16" cy="16" r="4.6" fill="#d6c77e" stroke="#2b2622" stroke-width="1"/></svg>`;

/** Degradado de categoría: la misma categoría siempre tiene el mismo color. */
export const claseCategoria = (categoria) => `cat-${Math.abs(Number(categoria?.id) || 0) % 6}`;
