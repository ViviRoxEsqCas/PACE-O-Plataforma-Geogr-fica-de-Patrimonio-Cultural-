import Marco from "./Marco";
import { AbejaVoxel } from "./Stickers";

/** Marco común de las pantallas del espacio social: cabecera caligráfica + serif de «Comunidad» de la referencia. */
export default function MarcoSocial({ activa, kicker, titulo, descripcion, children }) {
  return (
    <Marco
      activa={activa}
      insignia="COMUNIDAD · LA PAZ"
      notaMenu="Opiniones, amistades y logros alrededor del patrimonio"
      cta={{ descripcion: "Descubre el patrimonio del eje central y comparte tu experiencia.", texto: "+ Abrir mapa", a: "/explorar" }}
    >
      <section className="social-hero">
        <span className="social-hero__script">{kicker.toLowerCase()}</span>
        <h1 className="social-hero__title">{titulo}</h1>
        {descripcion && <p className="social-hero__texto">{descripcion}</p>}
        <AbejaVoxel className="social-hero__bee" />
      </section>
      <div className="social-page">{children}</div>
    </Marco>
  );
}
