import { describe, expect, it } from "vitest";
import { distanciaA, distanciaMetros, formatearDistancia } from "./distancia";

describe("distanciaMetros", () => {
  it("es 0 entre el mismo punto", () => {
    expect(distanciaMetros({ lat: -16.4956, lon: -68.1336 }, { lat: -16.4956, lon: -68.1336 })).toBeCloseTo(0, 5);
  });
  it("un grado de longitud en el ecuador mide ~111,2 km", () => {
    expect(distanciaMetros({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }) / 1000).toBeCloseTo(111.19, 1);
  });
  it("Plaza Murillo → plaza San Francisco está a unos 340–380 m (cálculo manual ≈ 357 m)", () => {
    const d = distanciaMetros({ lat: -16.495648, lon: -68.133566 }, { lat: -16.496226, lon: -68.136853 });
    expect(d).toBeGreaterThan(340);
    expect(d).toBeLessThan(380);
  });
});

describe("formatearDistancia", () => {
  it("redondea a decenas de metros bajo 1 km", () => {
    expect(formatearDistancia(854)).toBe("a ~850 m");
    expect(formatearDistancia(3)).toBe("a ~10 m");
  });
  it("usa kilómetros con coma decimal desde 1 km", () => {
    expect(formatearDistancia(1250)).toBe("a ~1,3 km");
    expect(formatearDistancia(12400)).toBe("a ~12 km");
  });
  it("devuelve texto vacío si no es un número", () => {
    expect(formatearDistancia(NaN)).toBe("");
  });
});

describe("distanciaA", () => {
  const posicion = { lat: -16.4956, lon: -68.1336 };
  it("es null sin posición o sin ubicación puntual (RF-12)", () => {
    expect(distanciaA({ tiene_ubicacion: true, latitud: -16.49, longitud: -68.13 }, null)).toBeNull();
    expect(distanciaA({ tiene_ubicacion: false, latitud: null, longitud: null }, posicion)).toBeNull();
  });
  it("calcula la distancia cuando hay posición y coordenadas", () => {
    expect(distanciaA({ tiene_ubicacion: true, latitud: -16.4956, longitud: -68.1336 }, posicion)).toBeCloseTo(0, 3);
  });
});
