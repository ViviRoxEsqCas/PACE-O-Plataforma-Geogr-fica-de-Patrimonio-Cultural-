import { describe, expect, it } from "vitest";
import { distanciaMetros } from "./distancia";
import { DURACIONES, enlaceRecorrido, formatearMinutos, generarRuta } from "./rutaMedida";

const cat = (id) => ({ id, nombre: `Cat ${id}` });
const bien = (id, lat, lon, categoria = 1, tiene = true) => ({ id, nombre: `Bien ${id}`, categoria: cat(categoria), latitud: tiene ? lat : null, longitud: tiene ? lon : null, tiene_ubicacion: tiene });
// Centro de La Paz: ~0,001° de latitud ≈ 111 m.
const catalogo = [
  bien(1, -16.4956, -68.1336, 1),
  bien(2, -16.4962, -68.1368, 1),
  bien(3, -16.4975, -68.1352, 2),
  bien(4, -16.4968, -68.133, 2),
  bien(5, -16.4905, -68.1402, 3),
  bien(6, -16.55, -68.2, 3), // lejano
  bien(7, 0, 0, 3, false), // inmaterial sin lugar
];

describe("generarRuta", () => {
  it("nunca supera el tiempo disponible ni repite paradas", () => {
    for (const minutos of DURACIONES) {
      for (const ritmo of ["tranquilo", "normal", "agil"]) {
        const r = generarRuta({ bienes: catalogo, minutos, ritmo });
        expect(r.minutosTotal).toBeLessThanOrEqual(minutos + 1e-6);
        expect(new Set(r.paradas.map((p) => p.bien.id)).size).toBe(r.paradas.length);
      }
    }
  });

  it("con más tiempo se visitan más bienes y el ritmo tranquilo camina más despacio", () => {
    const corta = generarRuta({ bienes: catalogo, minutos: 30, ritmo: "normal" });
    const larga = generarRuta({ bienes: catalogo, minutos: 180, ritmo: "normal" });
    expect(larga.paradas.length).toBeGreaterThan(corta.paradas.length);
    const lenta = generarRuta({ bienes: catalogo.slice(0, 4), minutos: 240, ritmo: "tranquilo" });
    const rapida = generarRuta({ bienes: catalogo.slice(0, 4), minutos: 240, ritmo: "agil" });
    expect(lenta.minutosCaminando).toBeGreaterThan(rapida.minutosCaminando);
  });

  it("excluye bienes sin ubicación, avisa de cuántos son y respeta las categorías", () => {
    const todas = generarRuta({ bienes: catalogo, minutos: 240 });
    expect(todas.sinUbicacion).toBe(1);
    expect(todas.paradas.every((p) => p.bien.tiene_ubicacion)).toBe(true);
    const solo2 = generarRuta({ bienes: catalogo, minutos: 240, categorias: [2] });
    expect(solo2.paradas.map((p) => p.bien.id).sort()).toEqual([3, 4]);
  });

  it("sin inicio parte de la zona más densa y no camina hasta la primera parada", () => {
    const r = generarRuta({ bienes: catalogo, minutos: 120 });
    expect(r.usaPosicion).toBe(false);
    expect(r.paradas[0].caminarMin).toBe(0);
    expect(r.paradas[0].bien.id).not.toBe(6);
  });

  it("con inicio, la primera parada cuenta la caminata desde la persona", () => {
    const inicio = { lat: -16.4905, lon: -68.1402 };
    const r = generarRuta({ bienes: catalogo, minutos: 120, inicio });
    expect(r.usaPosicion).toBe(true);
    expect(r.paradas[0].caminarMin).toBeGreaterThanOrEqual(0);
    const d = distanciaMetros(inicio, { lat: r.paradas[0].bien.latitud, lon: r.paradas[0].bien.longitud });
    expect(r.paradas[0].metros).toBeCloseTo(d * 1.3, 3);
  });

  it("volver al inicio suma el regreso y sigue cabiendo en el tiempo", () => {
    const inicio = { lat: -16.493, lon: -68.131 };
    const ida = generarRuta({ bienes: catalogo, minutos: 90, inicio, regresar: false });
    const vuelta = generarRuta({ bienes: catalogo, minutos: 90, inicio, regresar: true });
    expect(vuelta.regreso.minutos).toBeGreaterThan(0);
    expect(vuelta.minutosTotal).toBeLessThanOrEqual(90 + 1e-6);
    expect(ida.regreso).toBeNull();
  });

  it("prefiere variedad: con poco tiempo toma categorías distintas antes que repetir", () => {
    const r = generarRuta({ bienes: catalogo.slice(0, 5), minutos: 60, ritmo: "agil" });
    expect(r.categorias).toBeGreaterThanOrEqual(Math.min(2, r.paradas.length));
  });

  it("devuelve una ruta vacía si no hay candidatos o no alcanza el tiempo", () => {
    expect(generarRuta({ bienes: [], minutos: 60 }).paradas).toEqual([]);
    expect(generarRuta({ bienes: catalogo, minutos: 5 }).paradas).toEqual([]);
    expect(generarRuta({ bienes: catalogo, minutos: 60, categorias: [99] }).paradas).toEqual([]);
  });

  it("el orden final no es peor que el orden del catálogo (2-opt)", () => {
    const r = generarRuta({ bienes: catalogo.slice(0, 5), minutos: 240, ritmo: "normal" });
    const ordenCatalogo = [...r.paradas].map((p) => p.bien).sort((a, b) => a.id - b.id);
    let base = 0;
    for (let i = 1; i < ordenCatalogo.length; i += 1) {
      base += distanciaMetros({ lat: ordenCatalogo[i - 1].latitud, lon: ordenCatalogo[i - 1].longitud }, { lat: ordenCatalogo[i].latitud, lon: ordenCatalogo[i].longitud }) * 1.3;
    }
    const nuestra = r.paradas.slice(1).reduce((s, p) => s + p.metros, 0);
    expect(nuestra).toBeLessThanOrEqual(base + 1e-6);
  });
});

describe("enlaceRecorrido y formatearMinutos", () => {
  it("arma el enlace con origen, paradas intermedias y destino en orden", () => {
    const r = generarRuta({ bienes: catalogo, minutos: 180, inicio: { lat: -16.49, lon: -68.13 } });
    const url = new URL(enlaceRecorrido(r));
    expect(url.searchParams.get("travelmode")).toBe("walking");
    expect(url.searchParams.get("origin")).toBe("-16.49,-68.13");
    const ultima = r.paradas[r.paradas.length - 1].bien;
    expect(url.searchParams.get("destination")).toBe(`${ultima.latitud},${ultima.longitud}`);
    expect((url.searchParams.get("waypoints") ?? "").split("|").filter(Boolean)).toHaveLength(r.paradas.length - 1);
  });

  it("no genera enlace sin paradas", () => {
    expect(enlaceRecorrido(generarRuta({ bienes: [], minutos: 60 }))).toBeNull();
  });

  it("formatea minutos", () => {
    expect(formatearMinutos(0)).toBe("0 min");
    expect(formatearMinutos(45.4)).toBe("45 min");
    expect(formatearMinutos(60)).toBe("1 h");
    expect(formatearMinutos(85)).toBe("1 h 25 min");
  });
});
