import { beforeEach, describe, expect, it, vi } from "vitest";
import { puntajeTotal, registrarAcierto, reiniciarPuntaje, yaPuntuada } from "./puntaje";

function almacenFalso() {
  const datos = new Map();
  return { getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => datos.set(k, v), removeItem: (k) => datos.delete(k) };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", almacenFalso());
  reiniciarPuntaje();
});

describe("puntaje local", () => {
  it("suma los puntos de cada actividad acertada", () => {
    expect(puntajeTotal()).toBe(0);
    expect(registrarAcierto(1, 10)).toBe(10);
    expect(registrarAcierto(2, 15)).toBe(15);
    expect(puntajeTotal()).toBe(25);
  });
  it("otorga los puntos una sola vez por actividad (PT-15)", () => {
    expect(registrarAcierto(7, 10)).toBe(10);
    expect(registrarAcierto(7, 10)).toBe(0);
    expect(yaPuntuada(7)).toBe(true);
    expect(puntajeTotal()).toBe(10);
  });
  it("se conserva en localStorage", () => {
    registrarAcierto(3, 10);
    expect(JSON.parse(localStorage.getItem("paceno.puntaje.v1"))).toEqual({ 3: 10 });
  });
  it("sigue funcionando si localStorage está bloqueado", () => {
    const roto = { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("bloqueado"); }, removeItem: () => { throw new Error("bloqueado"); } };
    vi.stubGlobal("localStorage", roto);
    expect(() => registrarAcierto(9, 10)).not.toThrow();
    expect(puntajeTotal()).toBe(10);
  });
  it("ignora datos corruptos y puntos no válidos", () => {
    localStorage.setItem("paceno.puntaje.v1", "{no es json");
    expect(puntajeTotal()).toBe(0);
    expect(registrarAcierto(4, -5)).toBe(0);
    expect(registrarAcierto(5, NaN)).toBe(0);
  });
});
