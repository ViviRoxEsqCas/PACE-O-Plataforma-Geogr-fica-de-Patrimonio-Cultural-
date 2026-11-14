import { Link, Route, Routes } from "react-router-dom";
import { AvisoProvider } from "./components/Aviso";
import Marco from "./components/Marco";
import { CatalogoProvider } from "./hooks/Catalogo";
import { ItinerarioProvider } from "./hooks/Itinerario";
import { UbicacionProvider } from "./hooks/Ubicacion";
import Explorar from "./pages/Explorar";
import Ficha from "./pages/Ficha";
import Inicio from "./pages/Inicio";
import Rutas from "./pages/Rutas";

function NoEncontrada() {
  return (
    <Marco activa="" insignia="PACEÑO · LA PAZ" notaMenu="Archivo Digital del Patrimonio Cultural Paceño">
      <div className="pagina-estado">
        <div className="estado estado--vacio">
          <p className="estado__titulo">No encontramos esta página.</p>
          <Link to="/explorar" className="btn-outline-pill">
            Ir a explorar
          </Link>
        </div>
      </div>
    </Marco>
  );
}

export default function App() {
  return (
    <UbicacionProvider>
      <CatalogoProvider>
        <ItinerarioProvider>
          <AvisoProvider>
            <a className="saltar" href="#contenido">
              Saltar al contenido
            </a>
            <Routes>
              <Route path="/" element={<Inicio />} />
              <Route path="/explorar" element={<Explorar />} />
              <Route path="/bienes/:id" element={<Ficha />} />
              <Route path="/rutas" element={<Rutas />} />
              <Route path="*" element={<NoEncontrada />} />
            </Routes>
          </AvisoProvider>
        </ItinerarioProvider>
      </CatalogoProvider>
    </UbicacionProvider>
  );
}
