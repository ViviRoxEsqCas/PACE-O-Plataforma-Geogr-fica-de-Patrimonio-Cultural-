import { describe, expect, it } from "vitest";
import { codigoBien, conPortadaPrimero, enlaceMapa, nombreCorto, resumenBien } from "./bienes";

describe("bienes", () => {
  it("formatea el código de ficha", () => {
    expect(codigoBien(7)).toBe("LPZ-007");
    expect(codigoBien(123)).toBe("LPZ-123");
  });
  it("resume con la dirección o, si falta, con tipo y categoría", () => {
    expect(resumenBien({ direccion_referencia: " Plaza Murillo ", tipo: "material", categoria: { nombre: "X" } })).toBe("Plaza Murillo");
    expect(resumenBien({ direccion_referencia: "", tipo: "inmaterial", categoria: { nombre: "Música y danza" } })).toBe("Patrimonio inmaterial · Música y danza.");
  });
  it("acorta sin partir palabras", () => {
    expect(nombreCorto("Plaza")).toBe("Plaza");
    expect(nombreCorto("Celebración de la Revolución Libertaria del 16 de julio de 1809")).toBe("Celebración de la Revolución…");
  });
  it("el enlace del mapa depende de la ubicación", () => {
    expect(enlaceMapa({ id: 4, tiene_ubicacion: true, nombre: "A" })).toBe("/explorar?bien=4");
    expect(enlaceMapa({ id: 5, tiene_ubicacion: false, nombre: "Cueca Paceña" })).toBe("/explorar?q=Cueca%20Pace%C3%B1a");
  });
  it("ordena primero los bienes con portada", () => {
    const orden = conPortadaPrimero([{ id: 1, portada: null }, { id: 2, portada: {} }, { id: 3, portada: {} }]).map((b) => b.id);
    expect(orden).toEqual([2, 3, 1]);
  });
});
