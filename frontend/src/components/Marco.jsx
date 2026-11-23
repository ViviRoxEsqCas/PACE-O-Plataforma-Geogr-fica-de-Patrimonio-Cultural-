import BarraLateral from "./BarraLateral";
import Cabecera from "./Cabecera";
import Pie from "./Pie";

/**
 * Lienzo editorial de todas las pantallas: barra lateral / dock móvil, barra superior, contenido y pie.
 * `insignia` (etiqueta de la pantalla) y `notaMenu` (descripción) alimentan la barra lateral.
 */
export default function Marco({ activa, insignia, notaMenu, cta, children }) {
  return (
    <div className="shell">
      <BarraLateral activa={activa} insignia={insignia} notaMenu={notaMenu} />
      <div className="shell__main">
        <Cabecera activa={activa} />
        <main id="contenido" className="animate-fade-in">
          {children}
        </main>
        <Pie cta={cta} />
      </div>
    </div>
  );
}
