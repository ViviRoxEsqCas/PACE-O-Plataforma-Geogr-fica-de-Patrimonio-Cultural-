import { Link } from "react-router-dom";

export function Corazon({ tamano = 22 }) {
  return (
    <svg className="corazon" width={tamano} height={tamano} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M16 27S4.5 19.8 4.5 11.8c0-3.7 2.8-6.3 6.2-6.3 2.2 0 4.2 1.2 5.3 3.1 1.1-1.9 3.1-3.1 5.3-3.1 3.4 0 6.2 2.6 6.2 6.3C27.5 19.8 16 27 16 27z" fill="currentColor" />
    </svg>
  );
}

export default function Cabecera() {
  return (
    <header className="cabecera">
      <div className="cabecera__contenido">
        <Link to="/" className="marca" aria-label="Paceño, ir al inicio">
          <span className="marca__nombre">Paceño</span>
          <Corazon tamano={26} />
        </Link>
        <p className="cabecera__lema">Descubre, aprende y cuida el patrimonio cultural de La Paz</p>
      </div>
      <div className="cabecera__escalera" aria-hidden="true" />
    </header>
  );
}
