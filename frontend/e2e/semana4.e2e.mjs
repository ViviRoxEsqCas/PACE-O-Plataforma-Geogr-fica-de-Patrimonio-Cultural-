// Verificación de extremo a extremo de la semana 4 con un navegador real (Chromium/Chrome).
// Recorre el flujo de la sección 11 del documento de la semana: panel editorial → PWA → actividad → reporte → revisión.
// Casos que cubre: PT-01 a PT-05, PT-09, PT-12 a PT-14, PT-15 (panel), PT-16 a PT-23, PT-24 (páginas nuevas) y PT-25, más la PWA.
//
// Requisitos (ver docs/semana4.md):
//   · Backend en :8000 con el catálogo cargado y cuentas demo (python manage.py crear_cuentas_demo).
//   · Backend iniciado con REPORTES_LIMITE=30/hour (el límite por IP también cuenta los envíos de esta prueba).
//   · Frontend en :5173 (npm run dev) o en :4173 (npm run build && npm run preview).
//   · Paquete "playwright" (npm i -D playwright). Opcional: PACENO_CHROME=ruta\a\chrome.exe para usar un Chrome ya instalado.
// Variables: PACENO_URL, PACENO_API, PACENO_EDITOR, PACENO_EDITOR_CLAVE, PACENO_ADMIN, PACENO_ADMIN_CLAVE, PACENO_EVIDENCIAS.
// Uso: node e2e/semana4.e2e.mjs
//
// La prueba crea una ficha propia («E2E Semana 4 …»), una actividad y un reporte, y al terminar desactiva la ficha
// para que no aparezca en el catálogo público. Los registros (historial, reporte) se conservan por trazabilidad.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = (process.env.PACENO_URL ?? "http://127.0.0.1:5173").replace(/\/$/, "");
const API = (process.env.PACENO_API ?? "http://127.0.0.1:8000").replace(/\/$/, "");
const EDITOR = { usuario: process.env.PACENO_EDITOR ?? "editor_demo", clave: process.env.PACENO_EDITOR_CLAVE };
const ADMIN = { usuario: process.env.PACENO_ADMIN ?? "admin_demo", clave: process.env.PACENO_ADMIN_CLAVE };
const SALIDA = process.env.PACENO_EVIDENCIAS ?? "../docs/evidencias/semana4";
mkdirSync(SALIDA, { recursive: true });
if (!EDITOR.clave || !ADMIN.clave) {
  console.error("Defina PACENO_EDITOR_CLAVE y PACENO_ADMIN_CLAVE (contraseñas de crear_cuentas_demo).");
  process.exit(2);
}

const marca = Date.now().toString(36);
const NOMBRE = `E2E Semana 4 ${marca}`;
const TOKEN_REPORTE = `reporte-e2e-${marca}`;
const CUENTA_NUEVA = `e2e_${marca}`;
const CLAVE_NUEVA = `Cl4ve-E2E-${marca}-!`;
// PNG válido de 16×16 (rojo aguayo) generado aquí: el servidor valida las imágenes con Pillow y rechaza archivos dañados.
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (const byte of buf) {
    c = (crc ^ byte) & 0xff;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngRojo(lado = 16) {
  const trozo = (tipo, datos) => {
    const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
    const largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(cuerpo));
    return Buffer.concat([largo, cuerpo, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(lado, 0); ihdr.writeUInt32BE(lado, 4); ihdr[8] = 8; ihdr[9] = 2; // 8 bits, RGB
  const fila = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: lado }, () => [200, 22, 29]).flat())]);
  const crudo = Buffer.concat(Array.from({ length: lado }, () => fila));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), trozo("IHDR", ihdr), trozo("IDAT", deflateSync(crudo)), trozo("IEND", Buffer.alloc(0))]);
}
const PNG = pngRojo();
const carpetaTmp = mkdtempSync(join(tmpdir(), "paceno-e2e-"));
const RUTA_PNG = join(carpetaTmp, "imagen_prueba.png");
writeFileSync(RUTA_PNG, PNG);

// ---------------------------------------------------------------------------------------------- utilidades
const resultados = [];
const hechos = new Set();
async function caso(id, descripcion, fn, { requiere = [] } = {}) {
  const faltan = requiere.filter((r) => !hechos.has(r));
  if (faltan.length) {
    resultados.push({ id, descripcion, ok: false, omitido: true, detalle: `No ejecutada: depende de ${faltan.join(", ")}` });
    console.log(`OMITE ${id}  ${descripcion}\n      depende de ${faltan.join(", ")}`);
    return;
  }
  try {
    await fn();
    hechos.add(id);
    resultados.push({ id, descripcion, ok: true });
    console.log(`OK    ${id}  ${descripcion}`);
  } catch (error) {
    const detalle = String(error.message).split("\n")[0];
    resultados.push({ id, descripcion, ok: false, detalle });
    console.log(`FALLA ${id}  ${descripcion}\n      ${detalle}`);
  }
}
const igual = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`); };
const cierto = (c, msg) => { if (!c) throw new Error(msg); };

const navegador = await chromium.launch(process.env.PACENO_CHROME ? { executablePath: process.env.PACENO_CHROME } : {});
const contextos = [];
async function contexto(opciones = {}) {
  const c = await navegador.newContext({ viewport: { width: 1366, height: 768 }, locale: "es-BO", ...opciones });
  // Sin salida a internet o para no depender de OpenStreetMap, las teselas se cortan (el mapa base queda gris).
  await c.route(/tile\.openstreetmap\.org|cartocdn\.com|fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  contextos.push(c);
  return c;
}
async function pagina(ctx) {
  const p = await ctx.newPage();
  p.erroresConsola = [];
  p.on("pageerror", (e) => p.erroresConsola.push(String(e)));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) p.erroresConsola.push(m.text()); });
  return p;
}
async function iniciarSesionPanel(p, { usuario, clave }) {
  await p.goto(`${API}/admin/login/?next=/admin/`);
  await p.fill("#id_username", usuario);
  await p.fill("#id_password", clave);
  await p.click('input[type="submit"]');
  await p.waitForSelector("#user-tools, .errornote");
  if (await p.locator(".errornote").count()) throw new Error(`no se pudo iniciar sesión: ${(await p.locator(".errornote").innerText()).split("\n")[0]}`);
}
const foto = (p, nombre, opciones = {}) => p.screenshot({ path: `${SALIDA}/${nombre}.png`, ...opciones });
const mensajes = (p) => p.locator(".messagelist li").allInnerTexts();
async function elegirEnSelect2(p, selectId, texto) {
  const contenedor = p.locator(`#${selectId} + .select2`);
  await contenedor.click();
  await p.locator(".select2-search__field").fill(texto);
  const opcion = p.locator(".select2-results__option", { hasText: texto }).first();
  await opcion.waitFor();
  await opcion.click();
}
const estado = {}; // datos compartidos entre casos

// =============================================================================================================
// 1. PWA instalable (manifiesto)
// =============================================================================================================
await caso("PWA", "Manifiesto enlazado, válido y sin errores de instalabilidad según Chrome (sin service worker)", async () => {
  const perfil = mkdtempSync(join(tmpdir(), "paceno-perfil-"));
  const ctx = await chromium.launchPersistentContext(perfil, process.env.PACENO_CHROME ? { executablePath: process.env.PACENO_CHROME } : {});
  try {
    const p = await ctx.newPage();
    await p.route(/tile\.openstreetmap\.org|fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await p.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    const cdp = await ctx.newCDPSession(p);
    await cdp.send("Page.enable");
    const m = await cdp.send("Page.getAppManifest");
    igual(m.errors, [], "errores del manifiesto");
    const datos = JSON.parse(m.data);
    cierto(/Paceño/.test(datos.name) && datos.display === "standalone", "nombre y modo standalone");
    const tamanos = datos.icons.map((i) => i.sizes);
    cierto(tamanos.includes("192x192") && tamanos.includes("512x512"), "iconos 192 y 512");
    const inst = await cdp.send("Page.getInstallabilityErrors");
    igual(inst.installabilityErrors, [], "errores de instalabilidad");
    const sw = await p.evaluate(async () => (await navigator.serviceWorker?.getRegistrations?.())?.length ?? 0);
    igual(sw, 0, "service workers registrados (no debe haber: sin modo sin conexión)");
  } finally {
    await ctx.close();
  }
});

// =============================================================================================================
// 2. Panel editorial (M5 + M1): PT-01, PT-02, PT-04, PT-05, PT-15
// =============================================================================================================
const ctxEditor = await contexto();
const panel = await pagina(ctxEditor);

await caso("PT-21a", "Sin sesión el panel pide autenticación", async () => {
  const anonimo = await pagina(await contexto());
  await anonimo.goto(`${API}/admin/`);
  cierto(/\/admin\/login\//.test(anonimo.url()), `redirige al inicio de sesión (URL: ${anonimo.url()})`);
  await foto(anonimo, "pt21_sin_sesion_pide_autenticacion");
});

await caso("EDITOR-login", "El Editor inicia sesión en el panel", async () => {
  await iniciarSesionPanel(panel, EDITOR);
  cierto((await panel.locator("#site-name, #branding").first().innerText()).includes("Paceño"), "panel de Paceño");
  await foto(panel, "panel_editor_inicio");
});

await caso("PT-01", "Registro de ficha con datos mínimos: se guarda como borrador y no aparece en la API pública", async () => {
  await panel.goto(`${API}/admin/patrimonio/fuentedocumental/add/`);
  estado.fuente = `Fuente E2E ${marca}`;
  await panel.fill("#id_titulo", estado.fuente);
  await panel.fill("#id_autor_institucion", "Prueba automatizada");
  await panel.selectOption("#id_tipo_fuente", { index: 1 });
  await panel.fill("#id_fecha_consulta", "2026-11-19");
  await panel.click('input[name="_save"]');
  await panel.waitForSelector(".messagelist");
  cierto((await panel.locator(".messagelist .success").count()) === 1, "fuente guardada");

  await panel.goto(`${API}/admin/patrimonio/bienpatrimonial/add/`);
  await panel.fill("#id_nombre", NOMBRE);
  await panel.fill("#id_descripcion", "Ficha creada por la prueba automatizada de la semana 4.");
  await panel.selectOption("#id_tipo_patrimonio", { label: "material" });
  await panel.selectOption("#id_categoria", { index: 1 });
  await panel.fill("#id_direccion_referencia", "Centro de La Paz (prueba)");
  await panel.fill("#id_latitud", "-16.4969");
  await panel.fill("#id_longitud", "-68.1366");
  await panel.selectOption("#id_estado_publicacion", "borrador");
  await panel.click('input[name="_continue"]');
  await panel.waitForSelector("#bienpatrimonial_form");
  estado.bienId = Number(/\/bienpatrimonial\/(\d+)\/change\//.exec(panel.url())?.[1]);
  cierto(estado.bienId > 0, "se guardó y se obtuvo el identificador");
  const lista = await (await panel.request.get(`${BASE}/api/bienes/?page_size=100`)).json();
  cierto(!lista.results.some((b) => b.id === estado.bienId), "el borrador NO aparece en GET /api/bienes/");
  igual((await panel.request.get(`${BASE}/api/bienes/${estado.bienId}/`)).status(), 404, "detalle del borrador");
  await foto(panel, "pt01_ficha_borrador_en_panel");
});

await caso("PT-02", "Publicar una ficha sin fuente se rechaza informando el motivo; sigue sin ser pública", async () => {
  await panel.goto(`${API}/admin/patrimonio/bienpatrimonial/${estado.bienId}/change/`);
  await panel.selectOption("#id_estado_publicacion", "publicado");
  await panel.click('input[name="_continue"]');
  await panel.waitForSelector(".messagelist");
  const texto = (await mensajes(panel)).join(" ");
  cierto(/NO se public/i.test(texto) && /fuente documental/i.test(texto), `mensaje de rechazo con el motivo: «${texto.slice(0, 160)}»`);
  await foto(panel, "pt02_publicacion_rechazada_sin_fuente");
  igual((await panel.request.get(`${BASE}/api/bienes/${estado.bienId}/`)).status(), 404, "sigue sin ser pública");
}, { requiere: ["PT-01"] });

await caso("PT-05", "Una imagen sin autor o sin licencia se rechaza (validación del servidor)", async () => {
  await panel.goto(`${API}/admin/patrimonio/bienpatrimonial/${estado.bienId}/change/`);
  await panel.locator("#recursos-group .add-row a").click();
  await panel.setInputFiles("#id_recursos-0-archivo", RUTA_PNG);
  // Se envía sin autor ni licencia desactivando la validación HTML5 para comprobar la del servidor.
  await panel.evaluate(() => { document.querySelector("#bienpatrimonial_form").noValidate = true; });
  await panel.click('input[name="_continue"]');
  await panel.waitForSelector(".errornote, .errorlist");
  await panel.waitForSelector(".errorlist");
  const errores = await panel.locator("#recursos-group .errorlist").allInnerTexts();
  // El rechazo debe deberse a la falta de autor Y de licencia (no a un archivo dañado).
  cierto(errores.length >= 2 && errores.every((e) => /requerido|requiere|obligatorio/i.test(e)), `faltan avisos de autor y licencia: ${JSON.stringify(errores)}`);
  cierto(errores.some((e) => /autor/i.test(e)), "avisa de que falta el autor");
  cierto(!errores.some((e) => /imagen válida/i.test(e)), "el archivo de prueba es una imagen válida");
  await foto(panel, "pt05_imagen_sin_autor_ni_licencia_rechazada");
  // La ficha sigue sin imágenes guardadas
  await panel.goto(`${API}/admin/patrimonio/bienpatrimonial/${estado.bienId}/change/`);
  igual(await panel.locator("#recursos-group .inline-related:not(.empty-form)").count(), 0, "no se guardó ninguna imagen");
}, { requiere: ["PT-01"] });

await caso("PT-04", "Una ficha completa (fuente + imagen con autor y licencia) se publica y aparece en GET /api/bienes/", async () => {
  await panel.goto(`${API}/admin/patrimonio/bienpatrimonial/${estado.bienId}/change/`);
  await elegirEnSelect2(panel, "id_bien_fuentes-0-fuente", estado.fuente);
  await panel.locator("#recursos-group .add-row a").click();
  await panel.setInputFiles("#id_recursos-0-archivo", RUTA_PNG);
  await panel.fill("#id_recursos-0-texto_alternativo", "Imagen de prueba automatizada");
  await panel.fill("#id_recursos-0-autor", "Autora de Prueba E2E");
  await panel.selectOption("#id_recursos-0-licencia", { label: "CC BY 4.0" });
  await panel.check("#id_recursos-0-es_portada");
  await panel.selectOption("#id_estado_publicacion", "publicado");
  await foto(panel, "pt04_ficha_completa_lista_para_publicar", { fullPage: true });
  await panel.click('input[name="_continue"]');
  await panel.waitForSelector(".messagelist");
  const texto = (await mensajes(panel)).join(" ");
  cierto(!/NO se public/i.test(texto), `sin rechazo: «${texto.slice(0, 200)}»`);
  igual(await panel.locator("#id_estado_publicacion").inputValue(), "publicado", "estado guardado");
  const detalle = await (await panel.request.get(`${BASE}/api/bienes/${estado.bienId}/`)).json();
  igual(detalle.nombre, NOMBRE, "aparece en la API pública");
  cierto(detalle.fuentes.length === 1 && detalle.imagenes.length === 1, "con su fuente y su imagen");
  igual([detalle.imagenes[0].autor, detalle.imagenes[0].licencia], ["Autora de Prueba E2E", "CC BY 4.0"], "atribución de la imagen");
  const lista = await (await panel.request.get(`${BASE}/api/bienes/?page_size=100`)).json();
  cierto(lista.results.some((b) => b.id === estado.bienId), "está en GET /api/bienes/");
}, { requiere: ["PT-02", "PT-05"] });

await caso("PT-15", "Una actividad con dos opciones correctas (o ninguna) se rechaza; con exactamente una se guarda", async () => {
  await panel.goto(`${API}/admin/patrimonio/actividad/add/`);
  await elegirEnSelect2(panel, "id_bien", NOMBRE);
  await panel.fill("#id_enunciado", "¿Cuál es la opción correcta de esta prueba?");
  await panel.fill("#id_retroalimentacion", "Porque así se definió en la prueba automatizada.");
  await panel.fill("#id_puntos", "10");
  const opciones = ["Opción incorrecta A", "Opción correcta E2E", "Opción incorrecta B", "Opción incorrecta C"];
  for (const [i, texto] of opciones.entries()) await panel.fill(`#id_opciones-${i}-texto`, texto);
  // a) dos correctas
  await panel.check("#id_opciones-0-es_correcta");
  await panel.check("#id_opciones-1-es_correcta");
  await panel.click('input[name="_continue"]');
  await panel.waitForSelector(".errornote, .errorlist");
  cierto(/exactamente una/i.test(await panel.locator(".errorlist").first().innerText()), "rechaza dos correctas");
  await foto(panel, "pt15_dos_opciones_correctas_rechazadas");
  // b) ninguna correcta
  await panel.uncheck("#id_opciones-0-es_correcta");
  await panel.uncheck("#id_opciones-1-es_correcta");
  await panel.click('input[name="_continue"]');
  await panel.waitForSelector(".errornote, .errorlist");
  cierto(/exactamente una/i.test(await panel.locator(".errorlist").first().innerText()), "rechaza ninguna correcta");
  // c) exactamente una
  await panel.check("#id_opciones-1-es_correcta");
  await panel.click('input[name="_continue"]');
  await panel.waitForSelector(".messagelist");
  cierto(!(await panel.locator(".errornote").count()), "se guarda con una sola correcta");
}, { requiere: ["PT-04"] });

// =============================================================================================================
// 3. La PWA (M2, M3, M4): visitante sin cuenta
// =============================================================================================================
const ctxVisitante = await contexto();
const visita = await pagina(ctxVisitante);

await caso("PT-06/07", "El visitante localiza la ficha nueva en la lista (búsqueda sin mayúsculas ni tildes) y en el mapa", async () => {
  await visita.goto(`${BASE}/explorar`);
  await visita.waitForSelector(".lista .tarjeta", { state: "attached" });
  const buscar = async (texto) => {
    // La consulta se compara ya decodificada: los espacios viajan como «+» o «%20» según quién arme la URL.
    const respuesta = visita.waitForResponse((r) => r.url().includes("/api/bienes/") && new URL(r.url()).searchParams.get("q") === texto.trim());
    await visita.fill('input[type="search"]', texto);
    await respuesta;
    await visita.waitForLoadState("networkidle");
    return visita.locator(".lista .tarjeta__titulo").allInnerTexts();
  };
  cierto((await buscar(NOMBRE.toUpperCase())).includes(NOMBRE), "búsqueda en MAYÚSCULAS");
  cierto((await buscar(NOMBRE.toLowerCase())).includes(NOMBRE), "búsqueda en minúsculas");
  const enApi = (await (await visita.request.get(`${BASE}/api/bienes/?page_size=100`)).json()).results.filter((b) => b.tiene_ubicacion).length;
  await visita.fill('input[type="search"]', "");
  await visita.waitForFunction((n) => document.querySelectorAll(".marcador").length === n, enApi, { timeout: 10000 });
  await foto(visita, "pt06_lista_y_mapa_con_la_ficha_nueva");
}, { requiere: ["PT-04"] });

await caso("PT-09", "La ficha muestra fuente e imagen con autor y licencia (datos reales cargados desde el panel)", async () => {
  await visita.goto(`${BASE}/bienes/${estado.bienId}`);
  await visita.waitForSelector("article h1");
  igual(await visita.locator("article h1").innerText(), NOMBRE, "título");
  cierto((await visita.locator(".fuentes li").first().innerText()).includes(estado.fuente), "fuente visible");
  const pie = await visita.locator(".galeria figcaption").innerText();
  cierto(pie.includes("Autora de Prueba E2E") && pie.includes("CC BY 4.0"), `atribución visible: ${pie}`);
  await foto(visita, "pt09_ficha_con_fuente_e_imagen_atribuida", { fullPage: true });
}, { requiere: ["PT-04"] });

await caso("PT-12", "La API no revela la opción correcta antes de responder; una respuesta correcta devuelve acierto y explicación", async () => {
  const lista = await (await visita.request.get(`${BASE}/api/bienes/${estado.bienId}/actividades/`)).json();
  igual(lista.length, 1, "una actividad activa");
  const crudo = JSON.stringify(lista);
  cierto(!/es_correcta|opcion_correcta|retroalimentacion/.test(crudo), "la lista de actividades no incluye la respuesta ni la explicación");
  estado.actividad = lista[0];
  estado.opcionCorrecta = lista[0].opciones.find((o) => o.texto === "Opción correcta E2E").id;
  estado.opcionMala = lista[0].opciones.find((o) => o.texto === "Opción incorrecta A").id;
  const r = await (await visita.request.post(`${BASE}/api/actividades/${estado.actividad.id}/responder/`, { data: { opcion: estado.opcionCorrecta } })).json();
  igual([r.correcta, r.opcion_correcta, r.puntos], [true, estado.opcionCorrecta, 10], "respuesta correcta");
  cierto(/prueba automatizada/.test(r.retroalimentacion), "incluye la explicación");
}, { requiere: ["PT-15"] });

await caso("PT-13", "Respuesta incorrecta en la PWA: indica el error, muestra explicación, no revela la correcta y permite reintentar", async () => {
  const mala = await (await visita.request.post(`${BASE}/api/actividades/${estado.actividad.id}/responder/`, { data: { opcion: estado.opcionMala } })).json();
  igual([mala.correcta, mala.opcion_correcta, mala.puntos], [false, null, 0], "API: incorrecta sin revelar la correcta");
  await visita.goto(`${BASE}/bienes/${estado.bienId}`);
  await visita.getByRole("button", { name: "Practicar con este bien" }).click();
  await visita.waitForSelector(".actividad");
  await visita.locator(".actividad__opcion", { hasText: "Opción incorrecta A" }).click();
  await visita.getByRole("button", { name: "Responder" }).click();
  await visita.waitForSelector(".resultado--mal");
  const texto = await visita.locator(".resultado--mal").innerText();
  cierto(/Todav[ií]a no/.test(texto) && /prueba automatizada/.test(texto), `error + explicación: «${texto.replace(/\n/g, " ")}»`);
  cierto(!/Opción correcta E2E/.test(texto), "no revela cuál era la correcta");
  await foto(visita, "pt13_respuesta_incorrecta_con_explicacion");
  await visita.getByRole("button", { name: "Intentar de nuevo" }).click();
  cierto(await visita.getByRole("button", { name: "Responder" }).isVisible(), "se puede reintentar");
}, { requiere: ["PT-12"] });

await caso("PT-14", "Acertar tras reintentar suma los puntos una sola vez y se conservan al recargar la página", async () => {
  // Estado de partida: contexto nuevo sin puntos (localStorage vacío)
  const puntos = async () => Number(await visita.locator(".practicar__puntaje strong").innerText());
  igual(await puntos(), 0, "puntuación inicial");
  await visita.locator(".actividad__opcion", { hasText: "Opción correcta E2E" }).click();
  await visita.getByRole("button", { name: "Responder" }).click();
  await visita.waitForSelector(".resultado--ok");
  cierto(/\+10 puntos/.test(await visita.locator(".resultado--ok").innerText()), "suma 10 puntos");
  igual(await puntos(), 10, "puntuación tras acertar");
  await foto(visita, "pt14_respuesta_correcta_suma_puntos");
  // Recarga: los puntos siguen en el navegador
  await visita.reload();
  await visita.getByRole("button", { name: "Practicar con este bien" }).click();
  await visita.waitForSelector(".actividad");
  igual(await puntos(), 10, "puntuación tras recargar");
  // Repetir el acierto no suma otra vez
  await visita.locator(".actividad__opcion", { hasText: "Opción correcta E2E" }).click();
  await visita.getByRole("button", { name: "Responder" }).click();
  await visita.waitForSelector(".resultado--ok");
  cierto(/Ya hab[ií]as sumado/.test(await visita.locator(".resultado--ok").innerText()), "avisa que ya sumó");
  igual(await puntos(), 10, "no se suma dos veces");
  // El servidor no guarda la puntuación (RN-05)
  const guardado = await visita.evaluate(() => localStorage.getItem("paceno.puntaje.v1"));
  cierto(guardado && JSON.parse(guardado)[estado.actividad.id] === 10, "guardada en localStorage del navegador");
}, { requiere: ["PT-13"] });

await caso("PT-16", "Un reporte válido enviado desde la ficha se guarda con estado «nuevo» y fecha", async () => {
  await visita.goto(`${BASE}/bienes/${estado.bienId}`);
  await visita.getByRole("button", { name: "Reportar un problema con esta ficha" }).click();
  await visita.waitForSelector(".formulario");
  const botonInicial = visita.getByRole("button", { name: "Enviar reporte" });
  cierto(await botonInicial.isDisabled(), "con el formulario vacío no se puede enviar");
  await visita.locator(".formulario select").selectOption({ index: 1 });
  await visita.locator(".formulario textarea").fill(`La información de la ficha necesita revisión (${TOKEN_REPORTE}).`);
  await foto(visita, "pt16_formulario_de_reporte");
  const respuesta = visita.waitForResponse((r) => r.url().endsWith("/api/reportes/") && r.request().method() === "POST");
  await botonInicial.click();
  const r = await respuesta;
  igual(r.status(), 201, "HTTP 201");
  const cuerpo = await r.json();
  igual(cuerpo.estado, "nuevo", "estado inicial");
  estado.reporteId = cuerpo.id;
  cierto(await visita.getByText("¡Gracias! Recibimos tu reporte.").isVisible(), "confirmación al visitante");
  await foto(visita, "pt16_reporte_enviado");
}, { requiere: ["PT-14"] });

await caso("PT-17", "Un reporte sin tipo, con más de 500 caracteres o sobre un bien no publicado se rechaza", async () => {
  const tipos = await (await visita.request.get(`${BASE}/api/tipos-reporte/`)).json();
  const valido = { bien: estado.bienId, tipo_reporte: tipos[0].id, descripcion: "Texto válido" };
  const envio = (datos) => visita.request.post(`${BASE}/api/reportes/`, { data: datos });
  igual((await envio({ bien: valido.bien, descripcion: "sin tipo" })).status(), 400, "sin tipo");
  igual((await envio({ ...valido, descripcion: "x".repeat(501) })).status(), 400, "501 caracteres");
  // Un bien no publicado: se usa un identificador inexistente/no público (la propia ficha desactivada al final se prueba aparte)
  igual((await envio({ ...valido, bien: 99999999 })).status(), 400, "bien inexistente o no publicado");
  // En la interfaz el formulario impide enviar sin tipo y no admite más de 500 caracteres
  await visita.goto(`${BASE}/bienes/${estado.bienId}`);
  await visita.getByRole("button", { name: "Reportar un problema con esta ficha" }).click();
  await visita.locator(".formulario textarea").fill("y".repeat(600));
  igual((await visita.locator(".formulario textarea").inputValue()).length, 500, "el campo limita a 500");
  cierto(await visita.getByRole("button", { name: "Enviar reporte" }).isDisabled(), "sin tipo no se puede enviar");
}, { requiere: ["PT-16"] });

await caso("PT-17b", "Un reporte sobre una ficha NO publicada (borrador) se rechaza", async () => {
  // Se crea un borrador desde el panel y se intenta reportarlo.
  await panel.goto(`${API}/admin/patrimonio/bienpatrimonial/add/`);
  await panel.fill("#id_nombre", `${NOMBRE} borrador`);
  await panel.fill("#id_descripcion", "Borrador de prueba");
  await panel.selectOption("#id_tipo_patrimonio", { label: "material" });
  await panel.selectOption("#id_categoria", { index: 1 });
  await panel.selectOption("#id_estado_publicacion", "borrador");
  await panel.click('input[name="_continue"]');
  await panel.waitForSelector("#bienpatrimonial_form");
  const borradorId = Number(/\/bienpatrimonial\/(\d+)\/change\//.exec(panel.url())?.[1]);
  const tipos = await (await visita.request.get(`${BASE}/api/tipos-reporte/`)).json();
  const r = await visita.request.post(`${BASE}/api/reportes/`, { data: { bien: borradorId, tipo_reporte: tipos[0].id, descripcion: "no debe aceptarse" } });
  igual(r.status(), 400, "borrador no reportable");
  cierto(/no existe o no est/i.test(JSON.stringify(await r.json())), "mensaje comprensible");
  estado.borradorId = borradorId;
}, { requiere: ["PT-01"] });

// =============================================================================================================
// 4. Revisión editorial del reporte (M4 + M5): PT-19, PT-20
// =============================================================================================================
await caso("PT-19/20", "El Editor revisa el reporte, solo ve transiciones válidas y el cambio guarda revisor y fecha", async () => {
  await panel.goto(`${API}/admin/patrimonio/reporteciudadano/?q=${TOKEN_REPORTE}`);
  await panel.waitForSelector("#result_list");
  await foto(panel, "pt19_bandeja_de_reportes");
  await panel.locator("#result_list th.field-id a, #result_list .field-id a").first().click();
  await panel.waitForSelector("#id_estado");
  // Desde «nuevo» solo se puede ir a «en revisión» o «descartado» (no a «atendido»)
  const desde = await panel.locator("#id_estado option").allInnerTexts();
  igual(desde.map((t) => t.trim()).sort(), ["descartado", "en revisión", "nuevo"], "opciones desde «nuevo»");
  await panel.selectOption("#id_estado", { label: "en revisión" });
  await panel.fill("#id_nota_revision", "Revisado por la prueba automatizada.");
  await panel.click('input[name="_continue"]');
  await panel.waitForSelector(".messagelist");
  // Ahora «en revisión» → atendido | descartado (no vuelve a «nuevo»)
  const luego = (await panel.locator("#id_estado option").allInnerTexts()).map((t) => t.trim()).sort();
  igual(luego, ["atendido", "descartado", "en revisión"], "opciones desde «en revisión»");
  const fila = await panel.locator("#historial-group tbody tr:not(.empty-form)").first().innerText();
  cierto(fila.includes(EDITOR.usuario), `el historial guarda el revisor (${EDITOR.usuario})`);
  cierto(/\d{4}|\d{1,2}:\d{2}/.test(fila), "el historial guarda la fecha");
  cierto(fila.includes("nuevo") && fila.includes("en revisión"), "estado anterior y nuevo");
  await foto(panel, "pt20_reporte_revisado_con_historial", { fullPage: true });
  // Cerrar el reporte: atendido (estado final) → queda de solo lectura
  await panel.selectOption("#id_estado", { label: "atendido" });
  await panel.click('input[name="_continue"]');
  await panel.waitForSelector(".messagelist");
  cierto(await panel.locator("#id_estado").isDisabled(), "un estado final no se puede modificar");
}, { requiere: ["PT-16"] });

await caso("PT-25", "Flujo completo: ficha publicada desde el panel → vista en la PWA → actividad → reporte → revisión editorial", async () => {
  // Cada eslabón ya se verificó en un caso previo; PT-25 exige que todos se hayan cumplido sobre la MISMA ficha.
  for (const previo of ["PT-04", "PT-09", "PT-12", "PT-14", "PT-16", "PT-19/20"]) cierto(hechos.has(previo), `falta ${previo}`);
  const reporte = await panel.request.get(`${API}/admin/patrimonio/reporteciudadano/${estado.reporteId}/change/`);
  igual(reporte.status(), 200, "el reporte existe en la base de datos y se abre en el panel");
  await foto(visita, "pt25_flujo_completo_visitante_final");
}, { requiere: ["PT-04", "PT-09", "PT-12", "PT-14", "PT-16", "PT-19/20"] });

// =============================================================================================================
// 5. Permisos y cuentas (M5): PT-21, PT-22, PT-23
// =============================================================================================================
await caso("PT-21b", "El Editor no accede a la gestión de usuarios ni de grupos (el servidor responde 403)", async () => {
  for (const ruta of ["/admin/auth/user/", "/admin/auth/user/add/", "/admin/auth/group/", "/admin/admin/logentry/"]) {
    const r = await panel.goto(`${API}${ruta}`);
    igual(r.status(), 403, `GET ${ruta}`);
  }
  await foto(panel, "pt21_editor_sin_acceso_a_usuarios");
  await panel.goto(`${API}/admin/`);
  cierto(!(await panel.content()).includes("/admin/auth/user/"), "el menú del Editor no ofrece usuarios");
}, { requiere: ["EDITOR-login"] });

const ctxAdmin = await contexto();
const admin = await pagina(ctxAdmin);
await caso("PT-22", "El Administrador crea una cuenta, la cuenta ingresa; al desactivarla ya no puede ingresar", async () => {
  await iniciarSesionPanel(admin, ADMIN);
  await admin.goto(`${API}/admin/auth/user/add/`);
  await admin.fill("#id_username", CUENTA_NUEVA);
  await admin.fill("#id_password1", CLAVE_NUEVA);
  await admin.fill("#id_password2", CLAVE_NUEVA);
  await admin.click('input[name="_save"]');
  await admin.waitForSelector("#user_form");
  await admin.check("#id_is_staff");
  await admin.locator("#id_groups_from option", { hasText: "Editor" }).dblclick();
  await admin.click('input[name="_continue"]');
  await admin.waitForSelector(".messagelist");
  await foto(admin, "pt22_cuenta_creada_por_el_administrador", { fullPage: true });

  const activo = await pagina(await contexto());
  await iniciarSesionPanel(activo, { usuario: CUENTA_NUEVA, clave: CLAVE_NUEVA }); // ingresa

  await admin.uncheck("#id_is_active");
  await admin.click('input[name="_continue"]');
  await admin.waitForSelector(".messagelist");
  igual(await admin.locator("#id_is_active").isChecked(), false, "cuenta desactivada");

  const bloqueado = await pagina(await contexto());
  let fallo = null;
  try { await iniciarSesionPanel(bloqueado, { usuario: CUENTA_NUEVA, clave: CLAVE_NUEVA }); } catch (e) { fallo = e.message; }
  cierto(fallo, "la cuenta desactivada NO debe poder ingresar");
  await foto(bloqueado, "pt22_cuenta_desactivada_no_ingresa");
}, { requiere: [] });

await caso("PT-23", "Editar una ficha deja constancia en el historial con usuario y fecha (panel y registro de cambios)", async () => {
  await admin.goto(`${API}/admin/admin/logentry/?q=${encodeURIComponent(NOMBRE)}`);
  await admin.waitForSelector("#result_list");
  const filas = await admin.locator("#result_list tbody tr").allInnerTexts();
  cierto(filas.some((f) => f.includes(NOMBRE) && f.includes(EDITOR.usuario)), "el registro de cambios muestra la ficha y al Editor que la editó");
  await foto(admin, "pt23_historial_de_cambios_del_panel");
  // Historial de estados de la propia ficha (borrador → publicado) con usuario
  await admin.goto(`${API}/admin/patrimonio/bienpatrimonial/${estado.bienId}/change/`);
  const hist = (await admin.locator("#historial-group tbody tr:not(.empty-form)").allInnerTexts()).filter((t) => t.trim());
  cierto(hist.length >= 2 && hist.every((h) => h.includes(EDITOR.usuario)), "historial de estados con usuario y fecha");
  cierto(hist.some((h) => /Publicado|publicado/.test(h)), "registra la publicación");
}, { requiere: ["PT-04"] });

// =============================================================================================================
// 6. PT-18 frecuencia de envío (429). Se deja al final de las pruebas de envío porque agota el límite por IP.
// =============================================================================================================
await caso("PT-18", "Enviar reportes repetidos supera el límite: la API responde 429 y la PWA lo comunica", async () => {
  const tipos = await (await visita.request.get(`${BASE}/api/tipos-reporte/`)).json();
  let estatus429 = null;
  for (let i = 0; i < 80 && estatus429 === null; i += 1) {
    const r = await visita.request.post(`${BASE}/api/reportes/`, { data: { bien: estado.bienId, tipo_reporte: tipos[0].id, descripcion: `prueba de frecuencia ${marca} #${i}` } });
    if (r.status() === 429) estatus429 = i;
    else igual(r.status(), 201, "envíos previos al límite");
  }
  cierto(estatus429 !== null, "se alcanzó el límite (HTTP 429)");
  await visita.goto(`${BASE}/bienes/${estado.bienId}`);
  await visita.getByRole("button", { name: "Reportar un problema con esta ficha" }).click();
  await visita.locator(".formulario select").selectOption({ index: 1 });
  await visita.locator(".formulario textarea").fill("Otro reporte inmediatamente después.");
  await visita.getByRole("button", { name: "Enviar reporte" }).click();
  await visita.waitForSelector(".estado--error, [role='alert']");
  const aviso = await visita.locator(".estado--error, [role='alert']").first().innerText();
  cierto(/varios reportes seguidos/i.test(aviso), `mensaje comprensible: «${aviso.replace(/\n/g, " ")}»`);
  cierto(await visita.locator(".formulario").isVisible(), "la interfaz no queda en un estado inconsistente (el formulario sigue disponible)");
  await foto(visita, "pt18_limite_de_frecuencia_429");
}, { requiere: ["PT-16"] });

// =============================================================================================================
// 7. PT-24 adaptación: páginas del recorrido, sin desbordes ni errores de consola
// =============================================================================================================
for (const [ancho, alto] of [[360, 740], [768, 1024], [1366, 768]]) {
  await caso("PT-24", `Adaptación a ${ancho} px: portada, mapa/lista, rutas y ficha con «Practicar» y «Reportar» abiertos, sin desbordes`, async () => {
    const p = await pagina(await contexto({ viewport: { width: ancho, height: alto } }));
    const desborde = () => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const rutas = [["/", "portada"], ["/explorar", "explorar"], ["/rutas", "rutas"], [`/bienes/${estado.bienId ?? 1}`, "ficha"]];
    for (const [ruta, nombre] of rutas) {
      await p.goto(`${BASE}${ruta}`);
      await p.waitForLoadState("networkidle");
      cierto((await desborde()) <= 0, `desborde horizontal de ${await desborde()}px en ${nombre}`);
    }
    // Ficha con ambas secciones abiertas
    await p.getByRole("button", { name: "Practicar con este bien" }).click();
    await p.waitForSelector(".actividad, .practicar .sin-imagenes");
    await p.getByRole("button", { name: "Reportar un problema con esta ficha" }).click();
    await p.waitForSelector(".formulario");
    cierto((await desborde()) <= 0, `desborde en la ficha con secciones abiertas: ${await desborde()}px`);
    // Controles táctiles: botones principales con área mínima razonable (≥ 32 px de alto)
    const bajos = await p.evaluate(() => [...document.querySelectorAll(".practicar button, .reportar button, .formulario button")].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 32).map((b) => b.innerText.trim()));
    igual(bajos, [], "botones con altura menor a 32 px");
    igual(p.erroresConsola, [], "errores de consola");
    await foto(p, `pt24_${ancho}px_ficha_practicar_y_reportar`, { fullPage: true });
  }, { requiere: ["PT-04"] });
}

// =============================================================================================================
// Limpieza: la ficha de prueba se desactiva para que no aparezca en el catálogo público.
// =============================================================================================================
async function limpiar() {
  for (const id of [estado.bienId, estado.borradorId].filter(Boolean)) {
    try {
      await panel.goto(`${API}/admin/patrimonio/bienpatrimonial/${id}/change/`);
      await panel.selectOption("#id_estado_publicacion", "desactivado");
      await panel.click('input[name="_save"]');
      await panel.waitForSelector(".messagelist");
    } catch (e) {
      console.log(`AVISO no se pudo desactivar la ficha de prueba #${id}: ${String(e.message).split("\n")[0]}. Hágalo desde el panel.`);
    }
  }
}
await limpiar();
for (const c of contextos) await c.close().catch(() => {});
await navegador.close();

const fallos = resultados.filter((r) => !r.ok);
const md = [
  "# Resultados e2e de la semana 4", "",
  `Fecha: ${new Date().toISOString()}`, `Entorno: ${BASE} (PWA) · ${API} (API y panel) · ${process.platform}`, "",
  "| Caso | Descripción | Resultado |", "|---|---|---|",
  ...resultados.map((r) => `| ${r.id} | ${r.descripcion} | ${r.ok ? "OK" : r.omitido ? r.detalle : "FALLA: " + r.detalle} |`),
  "", `Total: ${resultados.length}; fallos u omitidos: ${fallos.length}`, "",
].join("\n");
writeFileSync(`${SALIDA}/resultados_e2e.md`, md);
console.log(`\n${resultados.length - fallos.length}/${resultados.length} casos OK`);
process.exit(fallos.length ? 1 : 0);
