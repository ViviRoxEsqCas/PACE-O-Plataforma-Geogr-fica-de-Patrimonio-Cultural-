// Verificación de extremo a extremo del ESPACIO SOCIAL con un navegador real (Chromium/Chrome).
// Requisitos: backend en :8000 (catálogo cargado), frontend en :5173 y el paquete "playwright".
// Se recomienda iniciar el backend con SOCIAL_REGISTRO_LIMITE=100/hour SOCIAL_ACCESO_LIMITE=100/hour.
// Variables: PACENO_URL, PACENO_API, PACENO_EVIDENCIAS, PACENO_CHROME.
// Crea cuentas de prueba «e2e_soc_<marca>_a/b/c»; no toca fichas ni cuentas del personal editorial.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = (process.env.PACENO_URL ?? "http://127.0.0.1:5173").replace(/\/$/, "");
const API = (process.env.PACENO_API ?? "http://127.0.0.1:8000").replace(/\/$/, "");
const SALIDA = process.env.PACENO_EVIDENCIAS ?? "../docs/evidencias/social";
mkdirSync(SALIDA, { recursive: true });
const marca = Date.now().toString(36);
const CLAVE = `Cl4ve-Soc-${marca}-!`;
const U = { a: `e2e_soc_${marca}_a`, b: `e2e_soc_${marca}_b`, c: `e2e_soc_${marca}_c` };
const COMENTARIO = `Una visita muy recomendable para conocer la historia del lugar (${marca}).`;

const resultados = [];
const paginas = [];
async function caso(id, descripcion, fn) {
  try {
    await fn();
    resultados.push({ id, ok: true });
    console.log(`  ✔ ${id} ${descripcion}`);
  } catch (e) {
    resultados.push({ id, ok: false });
    for (const [i, pagina] of paginas.entries()) await pagina.screenshot({ path: join(SALIDA, `fallo_${id}_${i}.png`), fullPage: true }).catch(() => {});
    console.log(`  ✘ ${id} ${descripcion}\n      ${e.message.split("\n")[0]}`);
  }
}
const cierto = (c, msg) => { if (!c) throw new Error(msg); };

const navegador = await chromium.launch(process.env.PACENO_CHROME ? { executablePath: process.env.PACENO_CHROME } : {});
const errores = [];
async function sesion(ancho = 1366, alto = 900) {
  const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: 1 });
  await ctx.route(/tile\.openstreetmap|fonts\.(googleapis|gstatic)/, (r) => r.abort());
  const p = await ctx.newPage();
  paginas.push(p);
  p.on("pageerror", (e) => errores.push(e.message));
  return { ctx, p };
}
const foto = (p, nombre) => p.screenshot({ path: join(SALIDA, `${nombre}.png`), fullPage: true });
async function registrar(p, usuario, nombre) {
  await p.goto(`${BASE}/cuenta`);
  await p.getByRole("button", { name: "Crear una cuenta" }).click();
  await p.getByLabel("Usuario").fill(usuario);
  if (nombre) await p.getByLabel("Nombre visible (opcional)").fill(nombre);
  await p.getByLabel("Contraseña").fill(CLAVE);
  await p.getByRole("button", { name: "Crear cuenta" }).click();
  await p.getByRole("heading", { name: "Mi cuenta" }).waitFor();
}
const bienes = await (await fetch(`${API}/api/bienes/?page_size=3`)).json();
const [B1, B2] = bienes.results;
// La base puede tener valoraciones de ejecuciones anteriores: se comprueban DIFERENCIAS respecto de este punto de partida.
const resumenApi = async () => (await fetch(`${API}/api/bienes/${B1.id}/social/`)).json();
const base = await resumenApi();

const A = await sesion();
const Bsesion = await sesion();
const C = await sesion();
const anonimo = await sesion();

await caso("S-01", "Sin cuenta la ficha muestra la invitación y ningún formulario; el catálogo sigue siendo anónimo", async () => {
  await anonimo.p.goto(`${BASE}/bienes/${B1.id}`);
  await anonimo.p.getByText("Opiniones de visitantes").waitFor();
  cierto(await anonimo.p.getByRole("link", { name: "Ingresa o crea tu cuenta" }).isVisible(), "falta invitación");
  cierto((await anonimo.p.getByRole("button", { name: "Marcar como visitado" }).count()) === 0, "botón de visita visible sin cuenta");
  cierto((await anonimo.p.getByText("No son información verificada").count()) > 0, "falta aviso de opiniones no verificadas");
  await foto(anonimo.p, "s01_ficha_anonima");
});

await caso("S-02", "Registro de visitante (sin correo) y acceso a «Mi cuenta»", async () => {
  await registrar(A.p, U.a, "Ana Paz");
  cierto(await A.p.getByText(`@${U.a}`).first().isVisible(), "no muestra el usuario");
  cierto((await A.p.getByText("Aún no tienes logros").count()) === 1, "debería comenzar sin logros");
  await foto(A.p, "s02_mi_cuenta");
});

await caso("S-03", "Contraseña débil y usuario repetido se rechazan con mensaje claro", async () => {
  await C.p.goto(`${BASE}/cuenta`);
  await C.p.getByRole("button", { name: "Crear una cuenta" }).click();
  await C.p.getByLabel("Usuario").fill(U.a);
  await C.p.getByLabel("Contraseña").fill(CLAVE);
  await C.p.getByRole("button", { name: "Crear cuenta" }).click();
  await C.p.getByText(/ya está en uso/).waitFor();
  await C.p.getByLabel("Usuario").fill(`${U.c}`);
  await C.p.getByLabel("Contraseña").fill("12345678");
  await C.p.getByRole("button", { name: "Crear cuenta" }).click();
  await C.p.getByRole("alert").waitFor();
});

await caso("S-04", "Marcar como visitado: declarada, no verificada, sin duplicar; abrir la ficha no cuenta", async () => {
  const p = A.p;
  await p.goto(`${BASE}/bienes/${B1.id}`);
  await p.getByRole("button", { name: "Marcar como visitado" }).waitFor();
  cierto((await p.locator(".social__visitas").innerText()).startsWith(`${base.visitas_declaradas} `), "abrir la ficha no debe registrar visita");
  await p.getByText("no está verificada ni usa tu ubicación").waitFor();
  await p.getByRole("button", { name: "Marcar como visitado" }).click();
  await p.getByRole("button", { name: /Visitado · quitar marca/ }).waitFor();
  await p.locator(".social__visitas", { hasText: `${base.visitas_declaradas + 1} ` }).waitFor();
  await p.reload();
  await p.getByRole("button", { name: /Visitado · quitar marca/ }).waitFor();
});

await caso("S-05", "Valorar con estrellas y comentario; promedio, cantidad y comentario público", async () => {
  const p = A.p;
  await p.getByRole("radio", { name: "4 estrellas" }).check({ force: true });
  await p.getByLabel("Tu opinión (opcional)").fill(COMENTARIO);
  await p.getByRole("button", { name: "Publicar valoración" }).click();
  await p.locator(".social__resumen", { hasText: `${base.cantidad + 1} ` }).waitFor();
  const api = await resumenApi();
  cierto(api.cantidad === base.cantidad + 1, "la cantidad no aumentó en 1");
  cierto((await p.locator(".social__promedio").innerText()) === api.promedio.toFixed(1), "el promedio mostrado difiere del calculado por la API");
  await p.locator(".comentario__texto", { hasText: COMENTARIO }).waitFor();
  await foto(p, "s05_ficha_con_opinion");
});

await caso("S-06", "Editar la valoración no la duplica; retirar la quita del promedio", async () => {
  const p = A.p;
  await p.getByRole("radio", { name: "5 estrellas" }).check({ force: true });
  await p.getByRole("button", { name: "Guardar cambios" }).click();
  await p.getByText("Actualizaste tu valoración.").waitFor();
  cierto((await resumenApi()).cantidad === base.cantidad + 1, "se duplicó la valoración");
  await p.getByRole("button", { name: "Retirar mi valoración" }).click();
  await p.getByText("Retiraste tu valoración.").waitFor();
  cierto((await resumenApi()).cantidad === base.cantidad, "retirar no la quitó del conteo");
  await p.getByRole("radio", { name: "4 estrellas" }).check({ force: true });
  await p.getByLabel("Tu opinión (opcional)").fill(COMENTARIO);
  await p.getByRole("button", { name: "Publicar valoración" }).click();
  await p.locator(".comentario__texto", { hasText: COMENTARIO }).waitFor();
  await p.getByRole("button", { name: "Guardar cambios" }).waitFor();
});

await caso("S-07", "Comentario con enlace se rechaza en el servidor", async () => {
  const p = A.p;
  await p.getByLabel("Tu opinión (opcional)").fill("Visiten www.ofertas.example ahora mismo");
  await p.getByRole("button", { name: "Guardar cambios" }).click();
  await p.getByText(/no puede incluir enlaces/).waitFor();
  await p.getByLabel("Tu opinión (opcional)").fill(COMENTARIO);
});

await caso("S-08", "Segunda cuenta: solicita amistad buscando a Ana; Ana la acepta", async () => {
  await registrar(Bsesion.p, U.b, "Beto Mamani");
  await Bsesion.p.goto(`${BASE}/amistades`);
  await Bsesion.p.getByLabel(/Buscar personas/).fill(U.a);
  await Bsesion.p.getByRole("button", { name: "Buscar", exact: true }).click();
  await Bsesion.p.getByRole("button", { name: "Solicitar amistad" }).click();
  await Bsesion.p.getByText(/Enviadas \(1\)/).waitFor();
  await A.p.goto(`${BASE}/amistades`);
  await A.p.getByText(/Solicitudes recibidas \(1\)/).waitFor();
  await foto(A.p, "s08_solicitud_recibida");
  await A.p.getByRole("button", { name: "Aceptar" }).click();
  await A.p.getByText(/Amistades \(1\)/).waitFor();
});

await caso("S-09", "La actividad de Ana (visita, valoración y comentario) aparece a su amistad", async () => {
  await Bsesion.p.goto(`${BASE}/amistades`);
  await Bsesion.p.getByText(/Amistades \(1\)/).waitFor();
  await Bsesion.p.getByText("marcó como visitado").waitFor();
  await Bsesion.p.getByText("valoró", { exact: false }).first().waitFor();
  await Bsesion.p.getByText("comentó").waitFor();
  await foto(Bsesion.p, "s09_actividad_de_amistades");
});

await caso("S-10", "Duplicados: no se puede solicitar de nuevo a una amistad (409 en español)", async () => {
  await Bsesion.p.getByLabel(/Buscar personas/).fill(U.a);
  await Bsesion.p.getByRole("button", { name: "Buscar", exact: true }).click();
  await Bsesion.p.getByRole("button", { name: "Solicitar amistad" }).click();
  await Bsesion.p.getByText("Ya son amistades.").waitFor();
});

await caso("S-11", "Beto reporta el comentario de Ana; no puede reportarlo dos veces", async () => {
  const p = Bsesion.p;
  await p.goto(`${BASE}/bienes/${B1.id}`);
  await p.locator(".comentario__texto", { hasText: COMENTARIO }).waitFor();
  const item = p.locator(".comentario", { hasText: COMENTARIO });
  await item.getByRole("button", { name: "Reportar comentario" }).click();
  await item.getByLabel("Motivo del reporte").fill("Prueba de reporte");
  await item.getByRole("button", { name: "Enviar reporte" }).click();
  await item.getByText("Reporte enviado.").waitFor();
  const token = await p.evaluate(() => localStorage.getItem("paceno.sesion.v1"));
  const lista = await (await fetch(`${API}/api/bienes/${B1.id}/valoraciones/`)).json();
  const id = lista.results.find((c) => c.comentario === COMENTARIO).id;
  const otra = await fetch(`${API}/api/valoraciones/${id}/reportar/`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Token ${token}` }, body: JSON.stringify({ motivo: "otra vez" }) });
  cierto(otra.status === 409, `segundo reporte: ${otra.status}`);
});

await caso("S-12", "Perfil público de Ana: puntos, ranking y logros; ranking con fórmula visible", async () => {
  await anonimo.p.goto(`${BASE}/perfiles/${U.a}`);
  await anonimo.p.getByText("Primera visita declarada").waitFor();
  await anonimo.p.getByText("Primera opinión").first().waitFor();
  await anonimo.p.getByText("7", { exact: true }).first().waitFor(); // 3 + 2 + 2
  await foto(anonimo.p, "s12_perfil_publico");
  await anonimo.p.goto(`${BASE}/ranking`);
  await anonimo.p.getByText("Cómo se calcula").waitFor();
  await anonimo.p.getByText(/Desempate/).waitFor();
  await anonimo.p.getByText(`@${U.a}`).waitFor();
  await foto(anonimo.p, "s12_ranking");
});

await caso("S-13", "Privacidad: actividad «privada» desaparece de la vista de la amistad (en el servidor)", async () => {
  await A.p.goto(`${BASE}/cuenta`);
  await A.p.getByLabel("¿Quién puede ver mi actividad?").selectOption("privado");
  await A.p.getByRole("button", { name: "Guardar cambios" }).click();
  await A.p.getByText("Perfil actualizado.").waitFor();
  await Bsesion.p.goto(`${BASE}/amistades`);
  await Bsesion.p.getByText("Sin actividad para mostrar.").waitFor();
  await Bsesion.p.goto(`${BASE}/perfiles/${U.a}`);
  await Bsesion.p.getByText("no es visible para ti").waitFor();
  const r = await Bsesion.p.evaluate(async (u) => (await fetch(`/api/perfiles/${u}/`, { headers: { Authorization: `Token ${localStorage.getItem("paceno.sesion.v1")}` } })).json(), U.a);
  cierto(r.actividad === null, "la API entregó actividad privada");
});

await caso("S-14", "Privacidad: perfil «privado» responde como inexistente y sale del ranking y de la búsqueda", async () => {
  await A.p.getByLabel("¿Quién puede ver mi perfil?").selectOption("privado");
  await A.p.getByRole("button", { name: "Guardar cambios" }).click();
  await A.p.getByText("Perfil actualizado.").waitFor();
  await anonimo.p.goto(`${BASE}/perfiles/${U.a}`);
  await anonimo.p.getByText("no existe o no es visible").waitFor();
  const estado = await anonimo.p.evaluate(async (u) => (await fetch(`/api/perfiles/${u}/`)).status, U.a);
  cierto(estado === 404, `estado ${estado}`);
  await anonimo.p.goto(`${BASE}/ranking`);
  await anonimo.p.getByText("Cómo se calcula").waitFor();
  cierto((await anonimo.p.getByText(`@${U.a}`).count()) === 0, "perfil privado en el ranking");
  // se restablece lo público
  await A.p.getByLabel("¿Quién puede ver mi perfil?").selectOption("publico");
  await A.p.getByRole("button", { name: "Guardar cambios" }).click();
  await A.p.getByText("Perfil actualizado.").waitFor();
});

await caso("S-15", "Una cuenta no puede modificar la valoración de otra (la API la crea como propia)", async () => {
  const token = await Bsesion.p.evaluate(() => localStorage.getItem("paceno.sesion.v1"));
  const r = await fetch(`${API}/api/bienes/${B1.id}/mi-valoracion/`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Token ${token}` }, body: JSON.stringify({ estrellas: 1 }) });
  cierto(r.status === 201, `estado ${r.status}`);
  const resumen = await (await fetch(`${API}/api/bienes/${B1.id}/social/`)).json();
  cierto(resumen.cantidad === base.cantidad + 2, `resumen ${JSON.stringify(resumen)}`);
  const sinToken = await fetch(`${API}/api/bienes/${B1.id}/mi-valoracion/`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estrellas: 5 }) });
  cierto(sinToken.status === 401, `sin sesión: ${sinToken.status}`);
});

await caso("S-16", "Cerrar sesión invalida el token en el servidor", async () => {
  const token = await Bsesion.p.evaluate(() => localStorage.getItem("paceno.sesion.v1"));
  await Bsesion.p.goto(`${BASE}/cuenta`);
  await Bsesion.p.getByRole("button", { name: "Cerrar sesión" }).click();
  await Bsesion.p.getByRole("heading", { name: "Ingresa a Paceño" }).waitFor();
  const r = await fetch(`${API}/api/cuentas/yo/`, { headers: { Authorization: `Token ${token}` } });
  cierto(r.status === 401, `token aún válido: ${r.status}`);
});

await caso("S-17", "Regresión: catálogo, mapa, actividades y reporte siguen funcionando con y sin cuenta", async () => {
  for (const { p } of [anonimo, A]) {
    await p.goto(`${BASE}/explorar`);
    await p.waitForSelector(".leaflet-marker-icon", { timeout: 15000 });
    await p.goto(`${BASE}/bienes/${B2.id}`);
    await p.getByText("Practicar con este bien").first().waitFor();
    await p.getByText("Reportar un problema con esta ficha").waitFor();
  }
  const lista = await (await fetch(`${API}/api/bienes/${B1.id}/actividades/`)).text();
  cierto(!lista.includes("es_correcta"), "la lista de actividades expone la correcta");
});

await caso("S-18", "Responsive 360/768/1366: sin desbordes horizontales en las pantallas sociales", async () => {
  for (const ancho of [360, 768, 1366]) {
    const { ctx, p } = await sesion(ancho, 800);
    const token = await A.p.evaluate(() => localStorage.getItem("paceno.sesion.v1"));
    await p.addInitScript((t) => localStorage.setItem("paceno.sesion.v1", t), token);
    for (const ruta of [`/bienes/${B1.id}`, "/cuenta", "/amistades", "/ranking", `/perfiles/${U.a}`]) {
      await p.goto(`${BASE}${ruta}`);
      await p.waitForLoadState("networkidle");
      const exceso = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      cierto(exceso <= 1, `${ruta} a ${ancho}px desborda ${exceso}px`);
      await foto(p, `s18_${ancho}_${ruta.replace(/\W+/g, "_")}`);
    }
    await ctx.close();
  }
});

await caso("S-19", "Sin errores de JavaScript durante todo el recorrido", async () => {
  cierto(errores.length === 0, errores.join(" | "));
});

await navegador.close();
const fallos = resultados.filter((r) => !r.ok).length;
console.log(`\nEspacio social: ${resultados.length - fallos}/${resultados.length} comprobaciones superadas.`);
process.exit(fallos ? 1 : 0);
