// Iconos de línea delicados y consistentes (24×24, trazo 1.6, extremos redondeados).
// Son decorativos (aria-hidden): el texto accesible lo aporta el botón o el enlace que los contiene.

const TRAZOS = {
  inicio: (
    <>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6 9.5V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9.5" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  mapa: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-10.8A6.5 6.5 0 0 1 12 3.5a6.5 6.5 0 0 1 6.5 6.7C18.5 15.4 12 21 12 21Z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  patrimonio: (
    <>
      <path d="M3.5 9 12 4l8.5 5" />
      <path d="M5.5 9.5v8M9.2 9.5v8M14.8 9.5v8M18.5 9.5v8" />
      <path d="M3.5 20h17M4.5 17.5h15" />
    </>
  ),
  rutas: (
    <>
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M8 18h5.5a3.5 3.5 0 0 0 0-7h-3a3.5 3.5 0 0 1 0-7H16" />
    </>
  ),
  comunidad: (
    <>
      <circle cx="9" cy="9" r="3" />
      <path d="M3.5 19c.5-3 2.7-4.6 5.5-4.6s5 1.6 5.5 4.6" />
      <path d="M15.5 6.4a3 3 0 0 1 0 5.2M17 14.6c2 .5 3.2 2 3.5 4.4" />
    </>
  ),
  cuenta: (
    <>
      <circle cx="12" cy="9" r="3.4" />
      <path d="M5 20c.7-3.6 3.5-5.6 7-5.6s6.3 2 7 5.6" />
    </>
  ),
  menu: <path d="M5 8.5h14M5 15.5h14" />,
  cerrar: <path d="m6.5 6.5 11 11m0-11-11 11" />,
  buscar: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
  imagen: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="3.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m4.5 17 4.5-4.2 3.6 3.2 3-2.6 4 3.6" />
    </>
  ),
  "flecha-izquierda": <path d="m14.5 6-6 6 6 6" />,
  "flecha-derecha": <path d="m9.5 6 6 6-6 6" />,
  "flecha-diagonal": <path d="M8 16 16 8M9.5 8H16v6.5" />,
};

export default function Icono({ nombre, tamano = 20, className = "icono", trazo = 1.6 }) {
  return (
    <svg
      className={className}
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={trazo}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {TRAZOS[nombre]}
    </svg>
  );
}
