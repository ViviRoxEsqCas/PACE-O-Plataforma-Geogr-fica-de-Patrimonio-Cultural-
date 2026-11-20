// Semana 4: configuración instalable de la PWA. Comprueba el manifiesto, sus iconos y el enlace en index.html.
// No hay service worker: el funcionamiento sin conexión NO forma parte del MVP y no debe presentarse como implementado.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = process.cwd(); // vitest se ejecuta desde frontend/
const publico = (ruta) => join(RAIZ, "public", ruta.replace(/^\//, ""));
const manifiesto = JSON.parse(readFileSync(publico("manifest.webmanifest"), "utf8"));

/** Ancho y alto leídos de la cabecera IHDR de un PNG. */
function dimensionesPng(ruta) {
  const b = readFileSync(ruta);
  expect(b.subarray(1, 4).toString("ascii")).toBe("PNG");
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe("manifiesto de la PWA", () => {
  it("define nombre, inicio, ámbito y modo de pantalla instalable", () => {
    expect(manifiesto.name).toMatch(/Paceño/);
    expect(manifiesto.short_name.length).toBeLessThanOrEqual(12);
    expect(manifiesto.start_url).toBe("/");
    expect(manifiesto.scope).toBe("/");
    expect(["standalone", "minimal-ui", "fullscreen"]).toContain(manifiesto.display);
    expect(manifiesto.lang).toBe("es");
  });

  it("usa los mismos colores que la interfaz (theme-color de index.html)", () => {
    const html = readFileSync(join(RAIZ, "index.html"), "utf8");
    const tema = /<meta name="theme-color" content="(#[0-9a-f]{6})"/i.exec(html)?.[1];
    expect(manifiesto.theme_color.toLowerCase()).toBe(tema.toLowerCase());
    expect(manifiesto.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("incluye iconos de 192 y 512 px que existen y tienen las dimensiones declaradas", () => {
    const tamanos = manifiesto.icons.map((i) => i.sizes);
    expect(tamanos).toContain("192x192");
    expect(tamanos).toContain("512x512");
    for (const icono of manifiesto.icons) {
      expect(existsSync(publico(icono.src)), `falta ${icono.src}`).toBe(true);
      const [ancho, alto] = icono.sizes.split("x").map(Number);
      expect(dimensionesPng(publico(icono.src))).toEqual([ancho, alto]);
      expect(icono.type).toBe("image/png");
    }
  });

  it("ofrece un icono «any» y uno «maskable» de 512 px", () => {
    const de512 = manifiesto.icons.filter((i) => i.sizes === "512x512").map((i) => i.purpose);
    expect(de512).toContain("any");
    expect(de512).toContain("maskable");
  });
});

describe("index.html", () => {
  const html = readFileSync(join(RAIZ, "index.html"), "utf8");

  it("enlaza el manifiesto y el icono de iOS", () => {
    expect(html).toMatch(/<link rel="manifest" href="\/manifest\.webmanifest"/);
    const ios = /<link rel="apple-touch-icon" href="([^"]+)"/.exec(html)?.[1];
    expect(ios).toBeTruthy();
    expect(existsSync(publico(ios))).toBe(true);
  });
});

describe("alcance sin conexión", () => {
  const fuentes = [];
  const recorrer = (dir) => {
    for (const nombre of readdirSync(dir)) {
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (/\.(jsx?|html)$/.test(nombre) && !/\.test\.js$/.test(nombre)) fuentes.push(readFileSync(ruta, "utf8"));
    }
  };
  recorrer(join(RAIZ, "src"));
  fuentes.push(readFileSync(join(RAIZ, "index.html"), "utf8"));

  it("no registra ningún service worker ni promete uso sin conexión (fuera del MVP)", () => {
    expect(fuentes.some((f) => /serviceWorker\.register|navigator\.serviceWorker/.test(f))).toBe(false);
    expect(existsSync(publico("sw.js"))).toBe(false);
  });
});
