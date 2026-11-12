"""
Pruebas de la semana 3 (informe: PT-12 a PT-20 y PT-25). Cada caso indica su identificador.
Se ejecutan contra PostgreSQL real, igual que las de la semana 1.
"""
import csv
import io
import shutil
import tempfile
from pathlib import Path

from django.contrib.auth.models import Group, User
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings
from django.urls import reverse
from PIL import Image
from rest_framework.settings import api_settings

from .models import (
    Actividad,
    EstadoPublicacion,
    EstadoReporte,
    HistorialEstadoReporte,
    Licencia,
    OpcionActividad,
    RecursoMultimedia,
    ReporteCiudadano,
    TipoReporte,
)
from .roles import GRUPO_ADMINISTRADOR, GRUPO_EDITOR
from .tests import agregar_fuente, crear_bien


def publicar(nombre="Bien publicado"):
    bien = crear_bien(nombre)
    agregar_fuente(bien)
    bien.estado_publicacion = EstadoPublicacion.PUBLICADO
    bien.save()
    return bien


def crear_actividad(bien, activa=True, puntos=10, correcta=1, n=3):
    actividad = Actividad.objects.create(bien=bien, enunciado="¿Pregunta?", retroalimentacion="Porque sí.", puntos=puntos, activa=activa)
    for i in range(n):
        OpcionActividad.objects.create(actividad=actividad, texto=f"Opción {i}", es_correcta=(i == correcta))
    return actividad


class Base(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.editor = User.objects.create_user("editor", password="x-Editor-123", is_staff=True)
        cls.editor.groups.add(Group.objects.get(name=GRUPO_EDITOR))
        cls.admin = User.objects.create_user("admin", password="x-Admin-123", is_staff=True)
        cls.admin.groups.add(Group.objects.get(name=GRUPO_ADMINISTRADOR))
        cls.bien = publicar()

    def setUp(self):
        cache.clear()  # los contadores de frecuencia (RF-17) no deben filtrarse entre pruebas


# ---------------------------------------------------------------------------
# M3: PT-12 a PT-15
# ---------------------------------------------------------------------------
class ActividadesTests(Base):
    def test_PT12_lista_actividades_sin_exponer_la_correcta_RN04(self):
        crear_actividad(self.bien)
        crear_actividad(self.bien, activa=False)  # inactiva: no se ve (RN-05 del bloque)
        datos = self.client.get(f"/api/bienes/{self.bien.pk}/actividades/").json()
        self.assertEqual(len(datos), 1)
        self.assertEqual(len(datos[0]["opciones"]), 3)
        cuerpo = str(datos)
        self.assertNotIn("es_correcta", cuerpo)
        self.assertNotIn("retroalimentacion", cuerpo)
        for opcion in datos[0]["opciones"]:
            self.assertEqual(set(opcion), {"id", "texto"})

    def test_PT12_no_lista_actividades_de_fichas_no_publicadas_ni_mal_formadas(self):
        borrador = crear_bien("Borrador")
        crear_actividad(borrador)
        self.assertEqual(self.client.get(f"/api/bienes/{borrador.pk}/actividades/").status_code, 404)
        sin_correcta = crear_actividad(self.bien, correcta=99)  # ninguna correcta: no se sirve
        self.assertEqual(sin_correcta.errores_validez()[0:1] != [], True)
        self.assertEqual(self.client.get(f"/api/bienes/{self.bien.pk}/actividades/").json(), [])

    def test_PT13_respuesta_correcta_la_valida_el_servidor(self):
        act = crear_actividad(self.bien, puntos=15)
        buena = act.opciones.get(es_correcta=True)
        r = self.client.post(f"/api/actividades/{act.pk}/responder/", {"opcion": buena.pk}, content_type="application/json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {"correcta": True, "opcion_correcta": buena.pk, "puntos": 15, "retroalimentacion": "Porque sí."})

    def test_PT13_respuesta_incorrecta_no_revela_la_correcta_y_no_da_puntos(self):
        act = crear_actividad(self.bien)
        mala = act.opciones.filter(es_correcta=False).first()
        r = self.client.post(f"/api/actividades/{act.pk}/responder/", {"opcion": mala.pk}, content_type="application/json").json()
        self.assertFalse(r["correcta"])
        self.assertIsNone(r["opcion_correcta"])
        self.assertEqual(r["puntos"], 0)

    def test_PT13_entradas_invalidas(self):
        act = crear_actividad(self.bien)
        otra = crear_actividad(self.bien)
        ajena = otra.opciones.first()
        url = f"/api/actividades/{act.pk}/responder/"
        self.assertEqual(self.client.post(url, {"opcion": ajena.pk}, content_type="application/json").status_code, 400)
        self.assertEqual(self.client.post(url, {}, content_type="application/json").status_code, 400)
        self.assertEqual(self.client.post(url, {"opcion": "abc"}, content_type="application/json").status_code, 400)
        self.assertEqual(self.client.post("/api/actividades/99999/responder/", {"opcion": 1}, content_type="application/json").status_code, 404)
        self.assertEqual(self.client.get(url).status_code, 405)

    def test_PT13_actividad_inactiva_no_se_puede_responder(self):
        act = crear_actividad(self.bien, activa=False)
        r = self.client.post(f"/api/actividades/{act.pk}/responder/", {"opcion": act.opciones.first().pk}, content_type="application/json")
        self.assertEqual(r.status_code, 404)

    def test_PT14_se_puede_reintentar_y_siempre_hay_explicacion(self):
        act = crear_actividad(self.bien)
        url = f"/api/actividades/{act.pk}/responder/"
        mala = act.opciones.filter(es_correcta=False).first()
        buena = act.opciones.get(es_correcta=True)
        for opcion, esperado in ((mala, False), (mala, False), (buena, True)):
            r = self.client.post(url, {"opcion": opcion.pk}, content_type="application/json").json()
            self.assertEqual(r["correcta"], esperado)
            self.assertTrue(r["retroalimentacion"])

    def test_PT15_la_api_no_guarda_puntuacion_RN05(self):
        # El servidor responde los puntos de la actividad pero no persiste nada por visitante.
        act = crear_actividad(self.bien)
        antes = Actividad.objects.count(), OpcionActividad.objects.count(), ReporteCiudadano.objects.count()
        self.client.post(f"/api/actividades/{act.pk}/responder/", {"opcion": act.opciones.get(es_correcta=True).pk}, content_type="application/json")
        self.assertEqual(antes, (Actividad.objects.count(), OpcionActividad.objects.count(), ReporteCiudadano.objects.count()))

    def test_RN04_exactamente_una_correcta_la_base_rechaza_dos(self):
        from django.db import IntegrityError, transaction
        act = crear_actividad(self.bien)
        with self.assertRaises(IntegrityError), transaction.atomic():
            OpcionActividad.objects.create(actividad=act, texto="Otra correcta", es_correcta=True)

    def test_RN04_panel_rechaza_actividad_activa_sin_correcta_o_con_pocas_opciones(self):
        self.client.force_login(self.editor)

        def post(opciones, activa="on"):
            datos = {"bien": self.bien.pk, "enunciado": "¿Algo?", "retroalimentacion": "x", "puntos": 10,
                     "opciones-TOTAL_FORMS": len(opciones), "opciones-INITIAL_FORMS": 0,
                     "opciones-MIN_NUM_FORMS": 0, "opciones-MAX_NUM_FORMS": 1000}
            if activa:
                datos["activa"] = activa
            for i, (texto, correcta) in enumerate(opciones):
                datos[f"opciones-{i}-texto"] = texto
                if correcta:
                    datos[f"opciones-{i}-es_correcta"] = "on"
            return self.client.post(reverse("admin:patrimonio_actividad_add"), datos)

        self.assertEqual(post([("a", False), ("b", False)]).status_code, 200)       # sin correcta: formulario con error
        self.assertEqual(post([("a", True)]).status_code, 200)                       # una sola opción
        self.assertEqual(Actividad.objects.filter(enunciado="¿Algo?").count(), 0)
        self.assertEqual(post([("a", False), ("b", True)]).status_code, 302)         # válida
        self.assertEqual(post([("a", False)], activa=None).status_code, 302)        # inactiva: puede quedar incompleta


# ---------------------------------------------------------------------------
# M4: PT-16 a PT-20
# ---------------------------------------------------------------------------
class ReportesTests(Base):
    def datos(self, **extra):
        d = {"bien": self.bien.pk, "tipo_reporte": TipoReporte.objects.get(nombre="deterioro").pk, "descripcion": "La fachada tiene grietas."}
        d.update(extra)
        return d

    def enviar(self, **extra):
        return self.client.post("/api/reportes/", self.datos(**extra), content_type="application/json")

    def test_PT16_reporte_valido_se_guarda_en_estado_nuevo(self):
        r = self.enviar()
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["estado"], "nuevo")
        reporte = ReporteCiudadano.objects.get(pk=r.json()["id"])
        self.assertEqual((reporte.bien, reporte.estado.nombre), (self.bien, "nuevo"))
        self.assertEqual(reporte.descripcion, "La fachada tiene grietas.")

    def test_PT16_catalogo_de_tipos_para_el_formulario(self):
        nombres = {t["nombre"] for t in self.client.get("/api/tipos-reporte/").json()}
        self.assertEqual(nombres, {"deterioro", "información incorrecta", "acceso restringido", "otro"})

    def test_PT17_validaciones(self):
        for extra in (
            {"descripcion": "x" * 501}, {"descripcion": ""}, {"descripcion": "   "},
            {"bien": 99999}, {"tipo_reporte": 99999}, {"bien": None},
        ):
            cache.clear()  # el límite de frecuencia también cuenta los envíos inválidos
            self.assertEqual(self.enviar(**extra).status_code, 400, extra)
        cache.clear()
        self.assertEqual(self.enviar(descripcion="x" * 500).status_code, 201)  # el límite exacto sí
        self.assertEqual(ReporteCiudadano.objects.count(), 1)

    def test_PT17_no_se_reporta_una_ficha_no_publicada(self):
        borrador = crear_bien("Oculta")
        self.assertEqual(self.enviar(bien=borrador.pk).status_code, 400)

    def test_PT17_limite_de_frecuencia_responde_429(self):
        limite = int(api_settings.DEFAULT_THROTTLE_RATES["reportes"].split("/")[0])
        for _ in range(limite):
            self.assertEqual(self.enviar().status_code, 201)
        self.assertEqual(self.enviar().status_code, 429)
        self.assertEqual(ReporteCiudadano.objects.count(), limite)

    def test_PT17_el_visitante_no_puede_listar_ni_consultar_reportes(self):
        r = self.enviar()
        self.assertEqual(self.client.get("/api/reportes/").status_code, 405)
        self.assertEqual(self.client.get(f"/api/reportes/{r.json()['id']}/").status_code, 404)

    def test_PT18_transiciones_permitidas_y_prohibidas_RN06(self):
        e = {n: EstadoReporte.objects.get(nombre=n) for n in ("nuevo", "en revisión", "atendido", "descartado")}
        rep = ReporteCiudadano.objects.create(bien=self.bien, tipo_reporte=TipoReporte.objects.first(), estado=e["nuevo"], descripcion="x")
        with self.assertRaises(ValidationError):
            rep.cambiar_estado(e["atendido"], self.editor)               # nuevo → atendido: no
        rep.refresh_from_db()
        self.assertEqual(rep.estado.nombre, "nuevo")
        rep.cambiar_estado(e["en revisión"], self.editor)
        rep.cambiar_estado(e["atendido"], self.editor)
        for destino in ("nuevo", "en revisión", "descartado"):           # estado final: inmutable
            with self.assertRaises(ValidationError):
                rep.cambiar_estado(e[destino], self.editor)
        otro = ReporteCiudadano.objects.create(bien=self.bien, tipo_reporte=TipoReporte.objects.first(), estado=e["nuevo"], descripcion="y")
        otro.cambiar_estado(e["descartado"], self.editor)                # nuevo → descartado: sí
        with self.assertRaises(ValidationError):
            otro.cambiar_estado(e["en revisión"], self.editor)

    def test_PT19_cada_cambio_guarda_revisor_fecha_y_nota(self):
        e = EstadoReporte.objects.get
        rep = ReporteCiudadano.objects.create(bien=self.bien, tipo_reporte=TipoReporte.objects.first(), estado=e(nombre="nuevo"), descripcion="x")
        rep.cambiar_estado(e(nombre="en revisión"), self.editor, "Se verificará en campo.")
        h = HistorialEstadoReporte.objects.get(reporte=rep)
        self.assertEqual((h.estado_anterior.nombre, h.estado_nuevo.nombre, h.revisado_por, h.nota),
                         ("nuevo", "en revisión", self.editor, "Se verificará en campo."))
        self.assertIsNotNone(h.fecha)
        with self.assertRaises(ValidationError):
            rep.cambiar_estado(e(nombre="atendido"), None)               # sin revisor no hay cambio
        self.assertEqual(HistorialEstadoReporte.objects.filter(reporte=rep).count(), 1)

    def test_PT18_bandeja_del_panel_cambia_estado_con_formulario(self):
        r = self.enviar().json()
        self.client.force_login(self.editor)
        url = reverse("admin:patrimonio_reporteciudadano_change", args=[r["id"]])
        self.assertContains(self.client.get(reverse("admin:patrimonio_reporteciudadano_changelist")), "La fachada")
        en_rev = EstadoReporte.objects.get(nombre="en revisión").pk
        atendido = EstadoReporte.objects.get(nombre="atendido").pk
        base = {"nota_revision": "Revisado", "historial-TOTAL_FORMS": 0, "historial-INITIAL_FORMS": 0,
                "historial-MIN_NUM_FORMS": 0, "historial-MAX_NUM_FORMS": 1000}
        # nuevo → atendido: el formulario no ofrece esa opción
        self.assertEqual(self.client.post(url, {**base, "estado": atendido}).status_code, 200)
        self.assertEqual(ReporteCiudadano.objects.get(pk=r["id"]).estado.nombre, "nuevo")
        self.assertEqual(self.client.post(url, {**base, "estado": en_rev}).status_code, 302)
        rep = ReporteCiudadano.objects.get(pk=r["id"])
        self.assertEqual(rep.estado.nombre, "en revisión")
        h = rep.historial.get()
        self.assertEqual((h.revisado_por, h.nota), (self.editor, "Revisado"))

    def test_PT18_acciones_masivas_respetan_las_transiciones(self):
        ids = [self.enviar().json()["id"] for _ in range(2)]
        self.client.force_login(self.editor)
        lista = reverse("admin:patrimonio_reporteciudadano_changelist")
        self.client.post(lista, {"action": "marcar_atendido", "_selected_action": ids}, follow=True)
        self.assertEqual(ReporteCiudadano.objects.filter(estado__nombre="nuevo").count(), 2)   # no cambió nada
        self.client.post(lista, {"action": "marcar_en_revision", "_selected_action": ids}, follow=True)
        self.assertEqual(ReporteCiudadano.objects.filter(estado__nombre="en revisión").count(), 2)
        self.assertEqual(HistorialEstadoReporte.objects.filter(revisado_por=self.editor).count(), 2)

    def test_PT18_reporte_final_es_de_solo_lectura_en_el_panel(self):
        rep_id = self.enviar().json()["id"]
        rep = ReporteCiudadano.objects.get(pk=rep_id)
        rep.cambiar_estado(EstadoReporte.objects.get(nombre="descartado"), self.editor)
        self.client.force_login(self.editor)
        url = reverse("admin:patrimonio_reporteciudadano_change", args=[rep_id])
        r = self.client.post(url, {"estado": EstadoReporte.objects.get(nombre="nuevo").pk, "historial-TOTAL_FORMS": 0,
                                   "historial-INITIAL_FORMS": 0, "historial-MIN_NUM_FORMS": 0, "historial-MAX_NUM_FORMS": 1000})
        self.assertIn(r.status_code, (200, 302))
        self.assertEqual(ReporteCiudadano.objects.get(pk=rep_id).estado.nombre, "descartado")

    def test_PT20_acceso_a_reportes_restringido(self):
        r = self.enviar().json()
        url_lista = reverse("admin:patrimonio_reporteciudadano_changelist")
        # anónimo → redirige al login del panel
        self.assertEqual(self.client.get(url_lista).status_code, 302)
        # cuenta de staff sin grupo → sin permiso
        sin_rol = User.objects.create_user("sin_rol", password="x-123-456", is_staff=True)
        self.client.force_login(sin_rol)
        self.assertEqual(self.client.get(url_lista).status_code, 403)
        # Editor y Administrador: ven y cambian; nadie puede borrar ni crear
        for usuario in (self.editor, self.admin):
            self.client.force_login(usuario)
            self.assertEqual(self.client.get(url_lista).status_code, 200)
            self.assertEqual(self.client.get(reverse("admin:patrimonio_reporteciudadano_change", args=[r["id"]])).status_code, 200)
            self.assertEqual(self.client.get(reverse("admin:patrimonio_reporteciudadano_delete", args=[r["id"]])).status_code, 403)
            self.assertEqual(self.client.get(reverse("admin:patrimonio_reporteciudadano_add")).status_code, 403)

    def test_roles_semana3(self):
        permisos = lambda u: set(Group.objects.get(name=u).permissions.values_list("codename", flat=True))  # noqa: E731
        editor = permisos(GRUPO_EDITOR)
        self.assertIn("add_actividad", editor)
        self.assertIn("change_reporteciudadano", editor)
        self.assertNotIn("add_reporteciudadano", editor)
        self.assertNotIn("delete_reporteciudadano", editor)
        self.assertNotIn("change_historialestadoreporte", editor)


# ---------------------------------------------------------------------------
# PT-25: integración de punta a punta + comandos de carga
# ---------------------------------------------------------------------------
class IntegracionTests(Base):
    def test_PT25_flujo_completo_visitante_responde_reporta_y_editor_revisa(self):
        # 1. El visitante abre la ficha, ve la actividad y responde mal y luego bien.
        act = crear_actividad(self.bien, puntos=10)
        lista = self.client.get(f"/api/bienes/{self.bien.pk}/actividades/").json()
        self.assertEqual(lista[0]["id"], act.pk)
        mala = [o for o in lista[0]["opciones"] if o["id"] != act.opciones.get(es_correcta=True).pk][0]
        self.assertFalse(self.client.post(f"/api/actividades/{act.pk}/responder/", {"opcion": mala["id"]}, content_type="application/json").json()["correcta"])
        buena = self.client.post(f"/api/actividades/{act.pk}/responder/", {"opcion": act.opciones.get(es_correcta=True).pk}, content_type="application/json").json()
        self.assertTrue(buena["correcta"])
        # 2. Envía un reporte.
        r = self.client.post("/api/reportes/", {"bien": self.bien.pk, "tipo_reporte": TipoReporte.objects.get(nombre="información incorrecta").pk,
                                                "descripcion": "La fecha de la ficha parece errónea."}, content_type="application/json")
        self.assertEqual(r.status_code, 201)
        # 3. El Editor lo ve en la bandeja y lo pasa a revisión y luego a atendido.
        self.client.force_login(self.editor)
        self.assertContains(self.client.get(reverse("admin:patrimonio_reporteciudadano_changelist")), "La fecha de la ficha")
        rep = ReporteCiudadano.objects.get(pk=r.json()["id"])
        url = reverse("admin:patrimonio_reporteciudadano_change", args=[rep.pk])
        base = {"historial-TOTAL_FORMS": 0, "historial-INITIAL_FORMS": 0, "historial-MIN_NUM_FORMS": 0, "historial-MAX_NUM_FORMS": 1000}
        for destino, nota in (("en revisión", "Se contrasta con la fuente."), ("atendido", "Ficha corregida.")):
            self.assertEqual(self.client.post(url, {**base, "estado": EstadoReporte.objects.get(nombre=destino).pk, "nota_revision": nota}).status_code, 302)
        rep.refresh_from_db()
        self.assertEqual(rep.estado.nombre, "atendido")
        self.assertEqual([(h.estado_nuevo.nombre, h.revisado_por) for h in rep.historial.order_by("id")],
                         [("en revisión", self.editor), ("atendido", self.editor)])


class ComandosTests(TestCase):
    def test_cargar_actividades_iniciales_crea_13_validas_e_idempotente(self):
        call_command("cargar_fichas_iniciales", stdout=io.StringIO())
        salida = io.StringIO()
        call_command("cargar_actividades_iniciales", stdout=salida)
        call_command("cargar_actividades_iniciales", stdout=salida)
        self.assertEqual(Actividad.objects.filter(activa=True).count(), 13)
        self.assertEqual(OpcionActividad.objects.filter(es_correcta=True).count(), 13)
        self.assertTrue(all(not a.errores_validez() for a in Actividad.objects.all()))
        self.assertEqual(Actividad.objects.values("bien").distinct().count(), 13)

    def test_cargar_actividades_exige_las_fichas(self):
        with self.assertRaises(CommandError):
            call_command("cargar_actividades_iniciales", stdout=io.StringIO())

    def test_cargar_imagenes_valida_carga_y_no_duplica(self):
        bien = publicar("Ficha con foto")
        carpeta, media = Path(tempfile.mkdtemp()), tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, carpeta, True)
        self.addCleanup(shutil.rmtree, media, True)
        Image.new("RGB", (8, 8), "blue").save(carpeta / "foto.png")

        def manifiesto(filas):
            with (carpeta / "manifiesto.csv").open("w", encoding="utf-8", newline="") as f:
                w = csv.writer(f)
                w.writerow(["archivo", "bien", "autor", "licencia", "texto_alternativo", "portada"])
                w.writerows(filas)

        out = io.StringIO()
        with override_settings(MEDIA_ROOT=media):
            manifiesto([["", "Ficha con foto", "", "", "", ""]])            # fila vacía: se ignora
            call_command("cargar_imagenes", carpeta=str(carpeta), simular=False, stdout=out)
            self.assertEqual(RecursoMultimedia.objects.count(), 0)
            manifiesto([["foto.png", "Ficha con foto", "", "CC BY 4.0", "", "si"]])   # sin autor
            with self.assertRaisesMessage(CommandError, "falta el autor"):
                call_command("cargar_imagenes", carpeta=str(carpeta), simular=False, stdout=out)
            manifiesto([["foto.png", "Ficha con foto", "Ana", "Licencia inventada", "", "si"]])
            with self.assertRaisesMessage(CommandError, "no existe"):
                call_command("cargar_imagenes", carpeta=str(carpeta), simular=False, stdout=out)
            manifiesto([["foto.png", "Ficha con foto", "Ana Pérez", "CC BY 4.0", "Fachada de prueba", "si"]])
            call_command("cargar_imagenes", carpeta=str(carpeta), simular=True, stdout=out)
            self.assertEqual(RecursoMultimedia.objects.count(), 0)
            call_command("cargar_imagenes", carpeta=str(carpeta), simular=False, stdout=out)
            call_command("cargar_imagenes", carpeta=str(carpeta), simular=False, stdout=out)  # segunda vez: no duplica
            recurso = RecursoMultimedia.objects.get()
            self.assertEqual((recurso.bien, recurso.autor, recurso.licencia.nombre, recurso.es_portada), (bien, "Ana Pérez", "CC BY 4.0", True))
            self.assertTrue((Path(media) / "bienes" / "foto.png").is_file())
            # La ficha sigue publicable: la imagen tiene autor y licencia (RN-02).
            self.assertEqual(bien.errores_publicacion(), [])
