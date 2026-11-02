import { Link, Route, Routes } from "react-router-dom";
import Cabecera from "./components/Cabecera";
import { UbicacionProvider } from "./hooks/Ubicacion";
import Explorar from "./pages/Explorar";
import Ficha from "./pages/Ficha";

function NoEncontrada() {
  return (
    <main className="ficha" id="contenido">
      <div className="estado estado--vacio">
        <p className="estado__titulo">No encontramos esta página.</p>
        <Link to="/" className="boton boton--secundario">
          Ir a explorar
        </Link>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <UbicacionProvider>
      <a className="saltar" href="#contenido">
        Saltar al contenido
      </a>
      <Cabecera />
      <Routes>
        <Route path="/" element={<Explorar />} />
        <Route path="/bienes/:id" element={<Ficha />} />
        <Route path="*" element={<NoEncontrada />} />
      </Routes>
      <footer className="pie">
        <p>Taller de Proyecto · Carrera de Informática · UMSA. Mapa base © colaboradores de OpenStreetMap.</p>
      </footer>
    </UbicacionProvider>
  );
}
