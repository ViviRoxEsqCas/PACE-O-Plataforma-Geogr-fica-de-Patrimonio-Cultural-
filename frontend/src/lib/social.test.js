import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError, actualizarMiPerfil, guardarValoracion, iniciarSesion, marcarVisitado, retirarValoracion, solicitarAmistad,
} from "./api";
import { EVENTO_SESION_EXPIRADA, guardarToken, leerToken } from "./sesion";

const respuesta = (cuerpo, estado = 200) => ({ ok: estado < 400, status: estado, json: async () => cuerpo });
beforeEach(() => {
  guardarToken(null);
  vi.stubGlobal("window", new EventTarget());
});
afterEach(() => vi.unstubAllGlobals());

describe("sesión", () => {
  it("guarda y olvida el token (en memoria si no hay localStorage)", () => {
    guardarToken("abc");
    expect(leerToken()).toBe("abc");
    guardarToken(null);
    expect(leerToken()).toBeNull();
  });
});

describe("cliente del espacio social", () => {
  it("envía el token solo si hay sesión", async () => {
    const f = vi.fn().mockResolvedValue(respuesta({ visitado: true }, 201));
    vi.stubGlobal("fetch", f);
    await marcarVisitado(3);
    expect(f.mock.calls[0][1].headers.Authorization).toBeUndefined();
    guardarToken("tok");
    await marcarVisitado(3);
    expect(f.mock.calls[1][0]).toBe("/api/bienes/3/mi-visita/");
    expect(f.mock.calls[1][1]).toMatchObject({ method: "PUT", headers: { Authorization: "Token tok" } });
  });

  it("guarda la valoración como JSON con PUT", async () => {
    const f = vi.fn().mockResolvedValue(respuesta({ id: 1 }, 201));
    vi.stubGlobal("fetch", f);
    await guardarValoracion(5, { estrellas: 4, comentario: "Muy bueno el lugar" });
    expect(f.mock.calls[0][1]).toMatchObject({ method: "PUT", headers: { "Content-Type": "application/json" } });
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ estrellas: 4, comentario: "Muy bueno el lugar" });
  });

  it("204 devuelve null (retirar valoración)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204 }));
    await expect(retirarValoracion(5)).resolves.toBeNull();
  });

  it("muestra el detalle de un 400 y de un 409 en español", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuesta({ detail: "Usuario o contraseña incorrectos." }, 400)));
    await expect(iniciarSesion({})).rejects.toMatchObject({ estado: 400, message: "Usuario o contraseña incorrectos." });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuesta({ detail: "Ya envió una solicitud a esta persona." }, 409)));
    await expect(solicitarAmistad("ana")).rejects.toMatchObject({ estado: 409, message: /Ya envió/ });
  });

  it("un 401 con sesión borra el token y avisa a la aplicación", async () => {
    guardarToken("vencido");
    const avisos = vi.fn();
    window.addEventListener(EVENTO_SESION_EXPIRADA, avisos);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuesta({}, 401)));
    await expect(marcarVisitado(1)).rejects.toBeInstanceOf(ApiError);
    expect(leerToken()).toBeNull();
    expect(avisos).toHaveBeenCalledTimes(1);
  });

  it("un 401 sin sesión pide ingresar y un 429 usa un mensaje general", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuesta({}, 401)));
    await expect(marcarVisitado(1)).rejects.toMatchObject({ estado: 401, message: /Ingresa/ });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuesta({}, 429)));
    await expect(solicitarAmistad("ana")).rejects.toMatchObject({ estado: 429, message: expect.stringMatching(/demasiadas acciones/) });
  });

  it("la fotografía se envía como multipart sin forzar Content-Type", async () => {
    const f = vi.fn().mockResolvedValue(respuesta({}));
    vi.stubGlobal("fetch", f);
    const datos = new FormData();
    datos.append("nombre_visible", "Ana");
    await actualizarMiPerfil(datos);
    expect(f.mock.calls[0][1].method).toBe("PATCH");
    expect(f.mock.calls[0][1].headers["Content-Type"]).toBeUndefined();
    expect(f.mock.calls[0][1].body).toBe(datos);
  });
});
