import { describe, expect, it } from "vitest";
import { alternar, CLAVE_ITINERARIO, guardarItinerario, leerItinerario } from "./itinerario";

const memoria = (inicial) => {
  const datos = new Map(inicial === undefined ? [] : [[CLAVE_ITINERARIO, inicial]]);
  return { getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => datos.set(k, v) };
};

describe("itinerario", () => {
  it("empieza vacío y tolera datos dañados", () => {
    expect(leerItinerario(memoria())).toEqual([]);
    expect(leerItinerario(memoria("{no es json"))).toEqual([]);
    expect(leerItinerario(memoria('{"a":1}'))).toEqual([]);
  });
  it("descarta valores que no son identificadores y duplicados", () => {
    expect(leerItinerario(memoria('[1,"2",1,null,3.5,4]'))).toEqual([1, 4]);
  });
  it("guarda y recupera", () => {
    const almacen = memoria();
    guardarItinerario([3, 5], almacen);
    expect(leerItinerario(almacen)).toEqual([3, 5]);
  });
  it("sin almacenamiento no falla", () => {
    expect(leerItinerario(null)).toEqual([]);
    expect(() => guardarItinerario([1], null)).not.toThrow();
  });
  it("alterna sin mutar", () => {
    const ids = [1, 2];
    expect(alternar(ids, 3)).toEqual({ ids: [1, 2, 3], agregado: true });
    expect(alternar(ids, 2)).toEqual({ ids: [1], agregado: false });
    expect(ids).toEqual([1, 2]);
  });
});
