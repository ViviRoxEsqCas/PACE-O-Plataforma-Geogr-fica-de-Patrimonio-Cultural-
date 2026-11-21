import Marco from "./Marco";

/** Marco común de las pantallas del espacio social (mismo encabezado editorial que Rutas). */
export default function MarcoSocial({ activa, kicker, titulo, descripcion, children }) {
  return (
    <Marco
      activa={activa}
      insignia="COMUNIDAD · LA PAZ"
      notaMenu="Opiniones, amistades y logros alrededor del patrimonio"
      cta={{ descripcion: "Descubre el patrimonio del eje central y comparte tu experiencia.", texto: "+ Abrir mapa", a: "/explorar" }}
    >
      <section className="social-hero">
        <span className="explore-kicker">{kicker}</span>
        <h1 className="explore-heading" style={{ marginTop: 8 }}>{titulo}</h1>
        {descripcion && <p className="social-hero__texto">{descripcion}</p>}
      </section>
      <div className="social-page">{children}</div>
    </Marco>
  );
}
