import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, listarBienes, listarMarcadores, obtenerBien } from "./api";

const respuesta = (cuerpo, estado = 200) => ({ ok: estado < 400, status: estado, json: async () => cuerpo });
afterEach(() => vi.unstubAllGlobals());

describe("listarBienes", () => {
  it("envía q, categoria, page y page_size; omite los vacíos", async () => {
    const fetchSimulado = vi.fn().mockResolvedValue(respuesta({ count: 0, results: [] }));
    vi.stubGlobal("fetch", fetchSimulado);
    await listarBienes({ q: " plaza ", categoria: "", page: 2, pageSize: 10 });
    expect(fetchSimulado.mock.calls[0][0]).toBe("/api/bienes/?q=plaza&page=2&page_size=10");
  });
  it("traduce un fallo de red en ApiError con mensaje claro", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(listarBienes()).rejects.toThrow(/No se pudo conectar/);
  });
  it("propaga el AbortError sin convertirlo", async () => {
    const abortar = Object.assign(new Error("abortado"), { name: "AbortError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortar));
    await expect(listarBienes()).rejects.toMatchObject({ name: "AbortError" });
  });
  it("mapea errores HTTP", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuesta({}, 500)));
    await expect(listarBienes()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("obtenerBien", () => {
  it("convierte 404 en ApiError con estado 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuesta({}, 404)));
    await expect(obtenerBien(99)).rejects.toMatchObject({ estado: 404 });
  });
});

describe("listarMarcadores", () => {
  it("recorre todas las páginas y conserva solo bienes con ubicación puntual", async () => {
    const fetchSimulado = vi
      .fn()
      .mockResolvedValueOnce(respuesta({ count: 3, next: "x", results: [{ id: 1, tiene_ubicacion: true }, { id: 2, tiene_ubicacion: false }] }))
      .mockResolvedValueOnce(respuesta({ count: 3, next: null, results: [{ id: 3, tiene_ubicacion: true }] }));
    vi.stubGlobal("fetch", fetchSimulado);
    const { total, marcadores } = await listarMarcadores({ categoria: 4 });
    expect(total).toBe(3);
    expect(marcadores.map((m) => m.id)).toEqual([1, 3]);
    expect(fetchSimulado.mock.calls[1][0]).toContain("page=2");
    expect(fetchSimulado.mock.calls[0][0]).toContain("page_size=100");
  });
});
