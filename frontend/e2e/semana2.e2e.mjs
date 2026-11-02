// Verificación de extremo a extremo de la semana 2 (PT-06 a PT-11 y PT-24) con un navegador real.
// Requisitos: backend en :8000 con las fichas cargadas, frontend en :5173 y el paquete "playwright"
// (npm i -D playwright && npx playwright install chromium). Uso: node e2e/semana2.e2e.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.PACENO_URL ?? "http://127.0.0.1:5173";
const SALIDA = process.env.PACENO_EVIDENCIAS ?? "../docs/evidencias/semana2";
mkdirSync(SALIDA, { recursive: true });

const resultados = [];
async function caso(id, descripcion, fn) {
  try {
    await fn();
    resultados.push({ id, descripcion, ok: true });
    console.log(`OK    ${id}  ${descripcion}`);
  } catch (error) {
    resultados.push({ id, descripcion, ok: false, detalle: String(error.message).split("\n")[0] });
    console.log(`FALLA ${id}  ${descripcion}\n      ${String(error.message).split("\n")[0]}`);
  }
}
const igual = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`); };
const cierto = (c, msg) => { if (!c) throw new Error(msg); };

const navegador = await chromium.launch();
async function nuevaPagina(opciones = {}) {
  const contexto = await navegador.newContext({ viewport: { width: 1366, height: 768 }, locale: "es-BO", ...opciones });
  const pagina = await contexto.newPage();
  // El entorno de pruebas no tiene salida a internet: las teselas de OpenStreetMap se cortan para no esperar.
  await pagina.route("**/tile.openstreetmap.org/**", (r) => r.abort());
  pagina.peticiones = [];
  pagina.on("request", (r) => pagina.peticiones.push({ url: r.url(), metodo: r.method() }));
  return pagina;
}
const nombres = (p) => p.locator(".lista .tarjeta__titulo").allInnerTexts();
// La lista puede estar oculta (móvil con la pestaña Mapa): basta con que exista en el DOM.
async function esperarLista(p) { await p.waitForSelector(".lista .tarjeta", { state: "attached" }); await p.waitForLoadState("networkidle"); }
async function esperarMarcadores(p, n) { await p.waitForFunction((n) => document.querySelectorAll(".marcador").length === n, n, { timeout: 8000 }); }

// ---------- PT-06 Mapa
await caso("PT-06", "Mapa: un marcador por bien con coordenadas; abre vista previa y la ficha", async () => {
  const p = await nuevaPagina();
  await p.goto(BASE); await esperarLista(p);
  await esperarMarcadores(p, 6);
  const bienesConUbicacion = (await (await p.request.get(`${BASE}/api/bienes/?page_size=100`)).json()).results.filter((b) => b.tiene_ubicacion).length;
  igual(await p.locator(".marcador").count(), bienesConUbicacion, "marcadores = bienes con coordenadas");
  await p.screenshot({ path: `${SALIDA}/pt06_escritorio_mapa_lista.png` });
  await p.locator(".marcador").first().click();
  await p.waitForSelector(".vista-previa");
  const titulo = await p.locator(".vista-previa strong").innerText();
  await p.locator(".vista-previa button", { hasText: "Ver ficha" }).click();
  await p.waitForSelector("article h1");
  igual(await p.locator("article h1").innerText(), titulo, "la ficha abierta es la del marcador");
  cierto(/\/bienes\/\d+$/.test(p.url()), "la URL apunta a la ficha");
  await p.context().close();
});

// ---------- PT-07 Búsqueda
await caso("PT-07", "Búsqueda: «plaza», «PLAZA» y nombre con tilde dan resultados equivalentes", async () => {
  const p = await nuevaPagina();
  await p.goto(BASE); await esperarLista(p);
  const buscar = async (texto) => {
    // Se espera la respuesta real de la API para esa búsqueda y luego a que la lista refleje su contenido.
    const respuesta = p.waitForResponse((r) => r.url().includes("/api/bienes/") && r.url().includes("page_size=10") && r.url().includes(`q=${encodeURIComponent(texto.trim())}`));
    await p.fill('input[type="search"]', texto);
    const { results } = await (await respuesta).json();
    await p.waitForFunction((n) => document.querySelectorAll(".lista .tarjeta").length === n, results.length);
    return nombres(p);
  };
  const a = await buscar("plaza"), b = await buscar("PLAZA");
  igual(b, a, "«PLAZA» = «plaza»");
  cierto(a.some((n) => n.includes("Plaza Murillo")), "encuentra Plaza Murillo");
  const c = await buscar("paceña"), d = await buscar("pacena"), e = await buscar("PACEÑA");
  igual(d, c, "«pacena» = «paceña»"); igual(e, c, "«PACEÑA» = «paceña»");
  cierto(c.includes("Cueca Paceña"), "encuentra Cueca Paceña");
  await buscar("zzzz");
  cierto(await p.getByText("No encontramos bienes con esos criterios.").isVisible(), "estado vacío con orientación");
  await p.screenshot({ path: `${SALIDA}/pt07_busqueda_sin_resultados.png` });
  await p.context().close();
});

// ---------- PT-08 Filtro
await caso("PT-08", "Filtro por categoría: solo esa categoría; al limpiarlo vuelven todas", async () => {
  const p = await nuevaPagina();
  await p.goto(BASE); await esperarLista(p);
  const todos = (await nombres(p)).length;
  await p.selectOption("select", { label: /Arquitectura religiosa/.source ? undefined : undefined }).catch(() => {});
  const opcion = await p.locator("select option", { hasText: "Arquitectura religiosa" }).first().getAttribute("value");
  await p.selectOption("select", opcion);
  await p.waitForFunction(() => document.querySelectorAll(".lista .tarjeta").length === 3);
  const filtrados = await nombres(p);
  igual(filtrados.sort(), ["Basílica Menor de San Francisco", "Centro Cultural «Museo San Francisco»", "Convento de San Francisco"].sort(), "solo arquitectura religiosa");
  await esperarMarcadores(p, 3);
  await p.screenshot({ path: `${SALIDA}/pt08_filtro_categoria.png` });
  await p.getByRole("button", { name: "Quitar filtros" }).first().click();
  await p.waitForFunction((n) => document.querySelectorAll(".lista .tarjeta").length === n, todos);
  await esperarMarcadores(p, 6);
  await p.context().close();
});

// ---------- PT-09 Ficha
await caso("PT-09", "Ficha: descripción, categoría, ubicación y fuentes con fecha de consulta", async () => {
  const p = await nuevaPagina();
  await p.goto(BASE); await esperarLista(p);
  await p.getByRole("link", { name: "Plaza Murillo" }).first().click();
  await p.waitForSelector("article h1");
  cierto((await p.locator("article h1").innerText()) === "Plaza Murillo", "título");
  cierto((await p.locator("#t-desc + p").innerText()).includes("Ley N.º 219"), "descripción");
  cierto((await p.locator(".fuentes li").count()) >= 1, "al menos una fuente");
  cierto(/Consultada el \d+ de \w+ de 2026/.test(await p.locator(".fuentes li").first().innerText()), "fecha de consulta visible");
  cierto(await p.locator(".ficha__mapa .mapa").isVisible(), "mapa de la ficha");
  await p.screenshot({ path: `${SALIDA}/pt09_ficha_escritorio.png`, fullPage: true });
  await p.context().close();
});

await caso("PT-09b", "Ficha: las imágenes muestran autor y licencia (respuesta de API simulada)", async () => {
  // La base real aún no tiene imágenes (ver README): se inyecta una respuesta con una imagen sintética
  // para comprobar que la interfaz exige y muestra la atribución.
  const p = await nuevaPagina();
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8Dwn4EIwDiqkL4KAcT9GO0U4BxoAAAAAElFTkSuQmCC";
  await p.route("**/api/bienes/1/", async (ruta) => {
    const r = await ruta.fetch(); const j = await r.json();
    j.imagenes = [{ id: 99, url: png, texto_alternativo: "Imagen de prueba", autor: "Autora de Prueba", licencia: "CC BY 4.0", licencia_url: "https://creativecommons.org/licenses/by/4.0/", es_portada: true }];
    await ruta.fulfill({ response: r, json: j });
  });
  await p.goto(`${BASE}/bienes/1`);
  await p.waitForSelector(".galeria figcaption");
  const pie = await p.locator(".galeria figcaption").innerText();
  cierto(pie.includes("Autora de Prueba") && pie.includes("CC BY 4.0"), `atribución visible: ${pie}`);
  await p.context().close();
});

// ---------- PT-10 Distancia
await caso("PT-10", "Distancia: con permiso muestra «a ~X m»; sin permiso el resto funciona; no se envía la posición", async () => {
  const con = await nuevaPagina({ permissions: ["geolocation"], geolocation: { latitude: -16.4956, longitude: -68.1336 } });
  await con.goto(BASE); await esperarLista(con);
  cierto(!(await con.locator(".lista").innerText()).includes("a ~"), "sin pedir permiso no hay distancias");
  await con.getByRole("button", { name: "Ver distancia a cada bien" }).click();
  await con.waitForFunction(() => document.querySelector(".lista")?.innerText.includes("a ~"));
  const textoLista = await con.locator(".lista").innerText();
  cierto(/a ~\d+ m|a ~\d+,\d km/.test(textoLista), "formato de distancia");
  await con.screenshot({ path: `${SALIDA}/pt10_distancia_con_permiso.png` });
  const enviaPosicion = con.peticiones.some((r) => r.url.includes("/api/") && (/lat|lon|-16\.49/i.test(r.url) || r.metodo !== "GET"));
  cierto(!enviaPosicion, "ninguna petición a la API incluye la posición ni usa otro método que GET");
  await con.context().close();

  const sin = await nuevaPagina(); // sin permiso concedido → el navegador deniega
  await sin.goto(BASE); await esperarLista(sin);
  await sin.getByRole("button", { name: "Ver distancia a cada bien" }).click();
  await sin.waitForSelector(".ubicacion__aviso");
  cierto((await sin.locator(".ubicacion__aviso").innerText()).length > 20, "mensaje claro");
  cierto((await sin.locator(".lista .tarjeta").count()) === 10, "la lista sigue completa");
  cierto(!(await sin.locator(".lista").innerText()).includes("a ~"), "sin distancias");
  await esperarMarcadores(sin, 6);
  await sin.screenshot({ path: `${SALIDA}/pt10_distancia_sin_permiso.png` });
  await sin.context().close();
});

// ---------- PT-11 Bien sin coordenadas
await caso("PT-11", "Bien sin coordenadas: aparece en la lista sin marcador y la ficha lo indica", async () => {
  const p = await nuevaPagina();
  await p.goto(BASE); await esperarLista(p); await esperarMarcadores(p, 6);
  const tarjeta = p.locator(".tarjeta", { hasText: "Cueca Paceña" });
  cierto(await tarjeta.isVisible(), "aparece en la lista");
  cierto((await tarjeta.innerText()).includes("Sin ubicación puntual"), "la tarjeta lo indica");
  cierto((await p.locator(".mapa__nota").innerText()).includes("4 bienes no tienen ubicación puntual"), "nota bajo el mapa");
  await tarjeta.getByRole("link").click();
  await p.waitForSelector("article h1");
  cierto((await p.locator("article").innerText()).includes("no tiene una ubicación puntual"), "la ficha lo indica");
  cierto((await p.locator(".ficha__mapa").count()) === 0, "sin mapa en la ficha");
  await p.context().close();
});

// ---------- Casos alternativos (CU-01)
await caso("CU-01-alt", "Si el mapa no carga, la lista sigue disponible; el error se puede reintentar", async () => {
  const p = await nuevaPagina();
  await p.route("**/api/bienes/?*page_size=100*", (r) => r.abort());
  await p.goto(BASE); await esperarLista(p);
  await p.waitForSelector(".mapa__aviso");
  cierto((await p.locator(".lista .tarjeta").count()) === 10, "lista completa");
  cierto((await p.locator(".mapa__aviso").innerText()).includes("No se pudo conectar"), "mensaje claro");
  await p.screenshot({ path: `${SALIDA}/cu01_mapa_caido_lista_disponible.png` });
  await p.unroute("**/api/bienes/?*page_size=100*");
  await p.locator(".mapa__aviso").getByRole("button", { name: "Reintentar" }).click();
  await esperarMarcadores(p, 6);
  await p.context().close();
});

await caso("ERR-red", "Sin servidor: mensaje claro con «Reintentar»; se recupera al volver", async () => {
  const p = await nuevaPagina();
  await p.route("**/api/**", (r) => r.abort());
  await p.goto(BASE);
  await p.waitForSelector(".estado--error");
  await p.unroute("**/api/**");
  await p.locator(".explorar__lista").getByRole("button", { name: "Reintentar" }).click();
  await esperarLista(p);
  await p.context().close();
});

await caso("ERR-404", "Ficha inexistente o no publicada: mensaje y salida", async () => {
  const p = await nuevaPagina();
  await p.goto(`${BASE}/bienes/99999`);
  await p.getByText("Esta ficha no existe o ya no está publicada.").waitFor();
  await p.context().close();
});

await caso("URL", "Búsqueda, filtro y página viven en la URL: «atrás» desde la ficha conserva el estado", async () => {
  const p = await nuevaPagina();
  await p.goto(`${BASE}/?q=san&vista=lista`); await esperarLista(p);
  const antes = await nombres(p);
  await p.getByRole("link", { name: antes[0] }).click();
  await p.waitForSelector("article h1");
  await p.getByRole("button", { name: /Volver a explorar/ }).click();
  await esperarLista(p);
  igual(await nombres(p), antes, "mismo listado al volver");
  cierto(await p.inputValue('input[type="search"]') === "san", "el cuadro de búsqueda conserva el texto");
  await p.context().close();
});

// ---------- PT-24 Adaptación
for (const [ancho, alto] of [[360, 740], [768, 1024], [1366, 768]]) {
  await caso("PT-24", `Adaptación a ${ancho} px: sin desbordes y con todas las funciones`, async () => {
    const p = await nuevaPagina({ viewport: { width: ancho, height: alto } });
    await p.goto(BASE); await esperarLista(p);
    const desborde = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    cierto(desborde <= 0, `desborde horizontal de ${desborde}px`);
    const escritorio = ancho >= 900;
    if (!escritorio) {
      cierto(await p.getByRole("button", { name: "Mapa", exact: true }).isVisible(), "pestaña Mapa");
      cierto(await p.locator(".mapa").first().isVisible(), "mapa visible por defecto");
      cierto(!(await p.locator(".explorar__lista").isVisible()), "la lista queda oculta hasta elegirla");
      await esperarMarcadores(p, 6);
      await p.screenshot({ path: `${SALIDA}/pt24_${ancho}px_mapa.png` });
      await p.getByRole("button", { name: "Lista", exact: true }).click();
      await p.locator(".lista .tarjeta").first().waitFor({ state: "visible" });
      cierto(!(await p.locator(".explorar__mapa").isVisible()), "el mapa se oculta al elegir la lista");
      // «Ver en el mapa» desde la lista vuelve al mapa y abre la vista previa
      await p.locator(".tarjeta", { hasText: "Plaza Murillo" }).getByRole("button", { name: "Ver en el mapa" }).click();
      await p.waitForSelector(".vista-previa");
      cierto((await p.locator(".vista-previa strong").innerText()) === "Plaza Murillo", "abre la vista previa del bien");
      await p.getByRole("button", { name: "Lista", exact: true }).click();
      await p.locator(".explorar__lista").waitFor({ state: "visible" });
      cierto(!(await p.locator(".explorar__mapa").isVisible()), "al volver a Lista el mapa se oculta");
      await p.screenshot({ path: `${SALIDA}/pt24_${ancho}px_lista.png` });
    } else {
      cierto(await p.locator(".explorar__lista").isVisible() && await p.locator(".explorar__mapa").isVisible(), "lista y mapa a la vez");
      cierto(!(await p.getByRole("button", { name: "Mapa", exact: true }).isVisible()), "sin pestañas en escritorio");
      await esperarMarcadores(p, 6);
      await p.screenshot({ path: `${SALIDA}/pt24_${ancho}px.png` });
    }
    // controles accesibles por teclado y con etiqueta
    cierto((await p.getByLabel("Buscar por nombre").count()) === 1 && (await p.getByLabel("Categoría").count()) === 1, "controles etiquetados");
    // ficha sin desbordes
    await p.goto(`${BASE}/bienes/1`); await p.waitForSelector("article h1"); await p.waitForLoadState("networkidle");
    cierto((await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, "ficha sin desborde");
    if (ancho === 360) await p.screenshot({ path: `${SALIDA}/pt24_360px_ficha.png`, fullPage: true });
    await p.context().close();
  });
}

await navegador.close();
const fallos = resultados.filter((r) => !r.ok);
const md = ["# Resultados e2e de la semana 2", "", `Fecha: ${new Date().toISOString()}`, "", "| Caso | Descripción | Resultado |", "|---|---|---|",
  ...resultados.map((r) => `| ${r.id} | ${r.descripcion} | ${r.ok ? "OK" : "FALLA: " + r.detalle} |`), "", `Total: ${resultados.length}; fallos: ${fallos.length}`].join("\n");
writeFileSync(`${SALIDA}/resultados_e2e.md`, md);
console.log(`\n${resultados.length - fallos.length}/${resultados.length} casos OK`);
process.exit(fallos.length ? 1 : 0);
