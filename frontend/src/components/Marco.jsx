import Cabecera from "./Cabecera";
import Pie from "./Pie";

/** Marco editorial de las pantallas interiores: cabecera global, contenido y pie global. */
export default function Marco({ activa, insignia, notaMenu, cta, children }) {
  return (
    <div className="viewport-shell">
      <div className="editorial-frame">
        <Cabecera activa={activa} insignia={insignia} notaMenu={notaMenu} bordeada />
        <main id="contenido">{children}</main>
        <Pie cta={cta} />
      </div>
    </div>
  );
}
