"""
Pruebas de la semana 1 (informe, sección 13). Cada caso indica su identificador PT-xx.
Se ejecutan contra PostgreSQL real (restricciones CHECK, índices parciales y unaccent).
"""
import io
import shutil
import tempfile
from datetime import date
from decimal import Decimal

from django.contrib.admin.models import LogEntry
from django.contrib.auth.models import Group, User
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from django.urls import reverse
from PIL import Image

from .models import (
    BienFuente,
    BienPatrimonial,
    Categoria,
    EstadoPublicacion,
    FuenteDocumental,
    HistorialEstadoBien,
    Licencia,
    RecursoMultimedia,
    TipoFuente,
    TipoPatrimonio,
    ZonaPiloto,
)
from .roles import GRUPO_ADMINISTRADOR, GRUPO_EDITOR

LAT, LON = Decimal("-16.496900"), Decimal("-68.136600")  # dentro del área piloto


def crear_bien(nombre="Bien de prueba", tipo="material", estado=EstadoPublicacion.BORRADOR, coords=True, **extra):
    categoria, _ = Categoria.objects.get_or_create(nombre="Arquitectura de prueba")
    datos = dict(
        nombre=nombre,
        descripcion="Descripción de prueba.",
        tipo_patrimonio=TipoPatrimonio.objects.get(nombre=tipo),
        categoria=categoria,
        latitud=LAT if coords else None,
        longitud=LON if coords else None,
        estado_publicacion=estado,
    )
    datos.update(extra)
    return BienPatrimonial.objects.create(**datos)


def agregar_fuente(bien, titulo="Fuente de prueba"):
    fuente = FuenteDocumental.objects.create(
        titulo=titulo, tipo_fuente=TipoFuente.objects.get(nombre="norma"), fecha_consulta=date(2026, 10, 11)
    )
    return BienFuente.objects.create(bien=bien, fuente=fuente)


def png_bytes():
    buffer = io.BytesIO()
    Image.new("RGB", (4, 4), "red").save(buffer, "PNG")
    return buffer.getvalue()


def formset_vacio(prefijo):
    return {f"{prefijo}-TOTAL_FORMS": 0, f"{prefijo}-INITIAL_FORMS": 0,
            f"{prefijo}-MIN_NUM_FORMS": 0, f"{prefijo}-MAX_NUM_FORMS": 1000}


def datos_formulario_bien(bien=None, fuente_id=None, **campos):
    """POST del formulario de Django Admin para BienPatrimonial (con sus formularios en línea)."""
    datos = dict(
        nombre="Ficha desde el panel", descripcion="Texto", direccion_referencia="",
        tipo_patrimonio=TipoPatrimonio.objects.get(nombre="material").pk,
        categoria=Categoria.objects.get_or_create(nombre="Arquitectura de prueba")[0].pk,
        latitud=str(LAT), longitud=str(LON), estado_publicacion="borrador",
    )
    datos.update(campos)
    datos.update(formset_vacio("recursos"))
    datos.update(formset_vacio("historial"))
    if fuente_id:
        datos.update({"bien_fuentes-TOTAL_FORMS": 1, "bien_fuentes-INITIAL_FORMS": 0,
                      "bien_fuentes-MIN_NUM_FORMS": 0, "bien_fuentes-MAX_NUM_FORMS": 1000,
                      "bien_fuentes-0-fuente": fuente_id, "bien_fuentes-0-nota": ""})
    else:
        datos.update(formset_vacio("bien_fuentes"))
    return datos


class BaseCuentas(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.editor = User.objects.create_user("editor", password="x-Editor-123", is_staff=True)
        cls.editor.groups.add(Group.objects.get(name=GRUPO_EDITOR))
        cls.admin = User.objects.create_user("admin", password="x-Admin-123", is_staff=True)
        cls.admin.groups.add(Group.objects.get(name=GRUPO_ADMINISTRADOR))


# ---------------------------------------------------------------------------
# Base de datos y migraciones (entregable 1)
# ---------------------------------------------------------------------------
class BaseDeDatosTests(TestCase):
    def test_catalogos_y_zona_piloto_cargados_por_migracion(self):
        self.assertEqual(set(TipoPatrimonio.objects.values_list("nombre", flat=True)), {"material", "inmaterial"})
        self.assertTrue(Licencia.objects.exists())
        self.assertEqual(ZonaPiloto.objects.filter(activa=True).count(), 1)

    def test_categoria_nombre_unico_sin_distinguir_mayusculas_RF02(self):
        Categoria.objects.create(nombre="Música")
        with self.assertRaises(IntegrityError), transaction.atomic():
            Categoria.objects.create(nombre="música")

    def test_check_de_estado_y_coordenadas_en_par(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            BienPatrimonial.objects.filter(pk=crear_bien().pk).update(estado_publicacion="otro")
        with self.assertRaises(IntegrityError), transaction.atomic():
            crear_bien("Solo latitud", coords=False, latitud=LAT)


# ---------------------------------------------------------------------------
# PT-01 a PT-05 (módulo 1)
# ---------------------------------------------------------------------------
class FichasTests(BaseCuentas):
    def setUp(self):
        self.client.force_login(self.editor)

    def test_PT01_registro_de_ficha_en_borrador_no_aparece_en_api(self):
        resp = self.client.post(reverse("admin:patrimonio_bienpatrimonial_add"), datos_formulario_bien())
        self.assertEqual(resp.status_code, 302, getattr(resp, "context", None) and resp.context["errors"])
        bien = BienPatrimonial.objects.get(nombre="Ficha desde el panel")
        self.assertEqual(bien.estado_publicacion, EstadoPublicacion.BORRADOR)
        self.assertEqual(bien.creado_por, self.editor)
        self.assertEqual(self.client.get("/api/bienes/").json()["count"], 0)

    def test_PT02_no_se_publica_sin_fuente_en_el_panel(self):
        resp = self.client.post(
            reverse("admin:patrimonio_bienpatrimonial_add"),
            datos_formulario_bien(estado_publicacion="publicado"), follow=True,
        )
        bien = BienPatrimonial.objects.get(nombre="Ficha desde el panel")
        self.assertEqual(bien.estado_publicacion, EstadoPublicacion.BORRADOR)
        self.assertContains(resp, "NO se publicó")
        self.assertContains(resp, "al menos una fuente")
        self.assertEqual(self.client.get("/api/bienes/").json()["count"], 0)

    def test_PT02_modelo_rechaza_publicar_sin_fuente(self):
        bien = crear_bien()
        bien.estado_publicacion = EstadoPublicacion.PUBLICADO
        with self.assertRaisesMessage(ValidationError, "fuente"):
            bien.save()

    def test_PT02_publica_cuando_la_ficha_esta_completa_en_el_panel(self):
        fuente = FuenteDocumental.objects.create(
            titulo="Ley de prueba", tipo_fuente=TipoFuente.objects.get(nombre="norma"), fecha_consulta=date(2026, 10, 11)
        )
        self.client.post(
            reverse("admin:patrimonio_bienpatrimonial_add"),
            datos_formulario_bien(estado_publicacion="publicado", fuente_id=fuente.pk),
        )
        bien = BienPatrimonial.objects.get(nombre="Ficha desde el panel")
        self.assertEqual(bien.estado_publicacion, EstadoPublicacion.PUBLICADO)
        self.assertEqual(self.client.get("/api/bienes/").json()["count"], 1)  # PT-04 vía panel

    def test_PT03_bien_material_sin_coordenadas_no_se_publica(self):
        bien = crear_bien(coords=False)
        agregar_fuente(bien)
        bien.estado_publicacion = EstadoPublicacion.PUBLICADO
        with self.assertRaisesMessage(ValidationError, "requiere coordenadas"):
            bien.save()

    def test_PT03_bien_fuera_del_area_piloto_se_rechaza(self):
        bien = crear_bien(latitud=Decimal("-17.000000"), longitud=Decimal("-68.000000"))  # fuera de la caja
        agregar_fuente(bien)
        bien.estado_publicacion = EstadoPublicacion.PUBLICADO
        with self.assertRaisesMessage(ValidationError, "fuera del área piloto"):
            bien.save()

    def test_PT03_el_panel_rechaza_coordenadas_fuera_del_area(self):
        resp = self.client.post(
            reverse("admin:patrimonio_bienpatrimonial_add"),
            datos_formulario_bien(latitud="-17.000000", longitud="-68.000000"),
        )
        self.assertEqual(resp.status_code, 200)  # se vuelve a mostrar el formulario con el error
        self.assertFalse(BienPatrimonial.objects.filter(nombre="Ficha desde el panel").exists())

    def test_PT03_manifestacion_inmaterial_sin_coordenadas_si_se_publica(self):
        bien = crear_bien("Manifestación", tipo="inmaterial", coords=False)
        agregar_fuente(bien)
        bien.estado_publicacion = EstadoPublicacion.PUBLICADO
        bien.save()
        self.assertEqual(bien.estado_publicacion, EstadoPublicacion.PUBLICADO)

    def test_PT04_ficha_completa_publicada_aparece_en_api(self):
        bien = crear_bien()
        agregar_fuente(bien)
        bien.estado_publicacion = EstadoPublicacion.PUBLICADO
        bien.save()
        datos = self.client.get("/api/bienes/").json()
        self.assertEqual([b["id"] for b in datos["results"]], [bien.pk])

    def test_PT05_imagen_sin_autor_se_rechaza(self):
        bien = crear_bien()
        licencia = Licencia.objects.first()
        imagen = RecursoMultimedia(bien=bien, autor="", licencia=licencia,
                                   archivo=SimpleUploadedFile("a.png", png_bytes(), "image/png"))
        with self.assertRaises(ValidationError):
            imagen.full_clean()
        with self.assertRaises(IntegrityError), transaction.atomic():  # y también la base de datos
            RecursoMultimedia.objects.create(bien=bien, autor="", licencia=licencia, archivo="bienes/a.png")

    def test_PT05_imagen_sin_licencia_se_rechaza(self):
        bien = crear_bien()
        imagen = RecursoMultimedia(bien=bien, autor="Autor", licencia=None,
                                   archivo=SimpleUploadedFile("a.png", png_bytes(), "image/png"))
        with self.assertRaises(ValidationError):
            imagen.full_clean()

    def test_PT05_el_panel_rechaza_imagen_sin_autor_ni_licencia(self):
        media = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, media, ignore_errors=True)
        bien = crear_bien()
        datos = datos_formulario_bien(bien)
        datos.update({"recursos-TOTAL_FORMS": 1, "recursos-0-autor": "", "recursos-0-licencia": "",
                      "recursos-0-archivo": SimpleUploadedFile("a.png", png_bytes(), "image/png")})
        with override_settings(MEDIA_ROOT=media):
            resp = self.client.post(reverse("admin:patrimonio_bienpatrimonial_change", args=[bien.pk]), datos)
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(bien.recursos.exists())

    def test_publicar_con_imagen_cuyo_autor_es_solo_espacios_se_rechaza_RN02(self):
        bien = crear_bien()
        agregar_fuente(bien)
        RecursoMultimedia.objects.create(bien=bien, autor="   ", licencia=Licencia.objects.first(), archivo="bienes/a.png")
        bien.estado_publicacion = EstadoPublicacion.PUBLICADO
        with self.assertRaisesMessage(ValidationError, "requiere autor y licencia"):
            bien.save()

    def test_editar_una_ficha_publicada_hasta_dejarla_incompleta_la_retira_RN01(self):
        bien = crear_bien()
        enlace = agregar_fuente(bien)
        bien.estado_publicacion = EstadoPublicacion.PUBLICADO
        bien.save()
        datos = datos_formulario_bien(bien, estado_publicacion="publicado")
        datos.update({"bien_fuentes-TOTAL_FORMS": 1, "bien_fuentes-INITIAL_FORMS": 1,
                      "bien_fuentes-0-id": enlace.pk, "bien_fuentes-0-bien": bien.pk,
                      "bien_fuentes-0-fuente": enlace.fuente_id, "bien_fuentes-0-DELETE": "on"})
        datos["nombre"] = bien.nombre
        resp = self.client.post(reverse("admin:patrimonio_bienpatrimonial_change", args=[bien.pk]), datos, follow=True)
        bien.refresh_from_db()
        self.assertEqual(bien.estado_publicacion, EstadoPublicacion.REVISION)
        self.assertContains(resp, "pasó a «En revisión»")
        self.assertEqual(self.client.get("/api/bienes/").json()["count"], 0)

    def test_historial_de_estados_registra_usuario_y_fecha(self):
        fuente = FuenteDocumental.objects.create(
            titulo="F", tipo_fuente=TipoFuente.objects.get(nombre="norma"), fecha_consulta=date(2026, 10, 11)
        )
        self.client.post(reverse("admin:patrimonio_bienpatrimonial_add"),
                         datos_formulario_bien(estado_publicacion="publicado", fuente_id=fuente.pk))
        bien = BienPatrimonial.objects.get(nombre="Ficha desde el panel")
        pasos = list(bien.historial.order_by("id").values_list("estado_anterior", "estado_nuevo"))
        self.assertEqual(pasos, [(None, "borrador"), ("borrador", "publicado")])
        self.assertTrue(all(h.usuario == self.editor and h.fecha for h in bien.historial.all()))

    def test_historial_guarda_el_estado_anterior_de_una_ficha_cargada_de_la_bd(self):
        bien = crear_bien()
        agregar_fuente(bien)
        recargada = BienPatrimonial.objects.get(pk=bien.pk)  # instancia leída de la BD, no recién creada
        recargada.estado_publicacion = EstadoPublicacion.PUBLICADO
        recargada.save()
        ultimo = recargada.historial.order_by("-id").first()
        self.assertEqual((ultimo.estado_anterior, ultimo.estado_nuevo), ("borrador", "publicado"))

    def test_acciones_masivas_publicar_valida_y_desactivar(self):
        completo = crear_bien("Completo")
        agregar_fuente(completo)
        incompleto = crear_bien("Incompleto")
        url = reverse("admin:patrimonio_bienpatrimonial_changelist")
        self.client.post(url, {"action": "publicar", "_selected_action": [completo.pk, incompleto.pk]}, follow=True)
        completo.refresh_from_db(); incompleto.refresh_from_db()
        self.assertEqual(completo.estado_publicacion, EstadoPublicacion.PUBLICADO)
        self.assertEqual(incompleto.estado_publicacion, EstadoPublicacion.BORRADOR)
        self.client.post(url, {"action": "desactivar", "_selected_action": [completo.pk]}, follow=True)
        completo.refresh_from_db()
        self.assertEqual(completo.estado_publicacion, EstadoPublicacion.DESACTIVADO)
        self.assertEqual(self.client.get("/api/bienes/").json()["count"], 0)


# ---------------------------------------------------------------------------
# Roles y acceso al panel (M5): PT-21 y PT-23
# ---------------------------------------------------------------------------
class RolesTests(BaseCuentas):
    def test_PT21_sin_sesion_el_panel_redirige_al_inicio_de_sesion(self):
        resp = self.client.get(reverse("admin:index"))
        self.assertEqual(resp.status_code, 302)
        self.assertIn("/admin/login/", resp["Location"])

    def test_PT21_editor_no_accede_a_usuarios_ni_grupos(self):
        self.client.force_login(self.editor)
        self.assertEqual(self.client.get(reverse("admin:auth_user_changelist")).status_code, 403)
        self.assertEqual(self.client.get(reverse("admin:auth_group_changelist")).status_code, 403)
        self.assertEqual(self.client.get(reverse("admin:auth_user_add")).status_code, 403)
        indice = self.client.get(reverse("admin:index")).content.decode()
        self.assertNotIn("/admin/auth/user/", indice)
        self.assertIn("/admin/patrimonio/bienpatrimonial/", indice)

    def test_PT21_editor_accede_a_fichas(self):
        self.client.force_login(self.editor)
        self.assertEqual(self.client.get(reverse("admin:patrimonio_bienpatrimonial_changelist")).status_code, 200)

    def test_administrador_gestiona_usuarios_pero_no_edita_permisos_de_grupos(self):
        self.client.force_login(self.admin)
        self.assertEqual(self.client.get(reverse("admin:auth_user_changelist")).status_code, 200)
        self.assertEqual(self.client.get(reverse("admin:auth_user_add")).status_code, 200)
        self.assertEqual(self.client.get(reverse("admin:auth_group_add")).status_code, 403)

    def test_administrador_no_ve_superusuarios_ni_puede_darse_permisos(self):
        root = User.objects.create_superuser("root", password="x-Root-123")
        self.client.force_login(self.admin)
        lista = self.client.get(reverse("admin:auth_user_changelist")).content.decode()
        self.assertNotIn("root", lista)
        self.assertEqual(self.client.get(reverse("admin:auth_user_change", args=[root.pk])).status_code, 302)
        form = self.client.get(reverse("admin:auth_user_change", args=[self.admin.pk])).context["adminform"].form
        self.assertTrue(form.fields["is_superuser"].disabled)
        self.assertTrue(form.fields["user_permissions"].disabled)

    def test_cuenta_desactivada_no_ingresa_RF22(self):
        self.editor.is_active = False
        self.editor.save()
        self.assertFalse(self.client.login(username="editor", password="x-Editor-123"))

    def test_PT23_historial_del_panel_solo_para_administrador(self):
        self.client.force_login(self.editor)
        self.client.post(reverse("admin:patrimonio_bienpatrimonial_add"), datos_formulario_bien())
        self.assertTrue(LogEntry.objects.filter(user=self.editor, object_repr="Ficha desde el panel").exists())
        self.assertEqual(self.client.get(reverse("admin:admin_logentry_changelist")).status_code, 403)
        self.client.force_login(self.admin)
        resp = self.client.get(reverse("admin:admin_logentry_changelist"))
        self.assertContains(resp, "Ficha desde el panel")
        self.assertContains(resp, "editor")

    def test_editor_no_puede_borrar_fichas(self):
        bien = crear_bien()
        self.client.force_login(self.editor)
        self.assertEqual(self.client.post(reverse("admin:patrimonio_bienpatrimonial_delete", args=[bien.pk]),
                                          {"post": "yes"}).status_code, 403)
        self.assertTrue(BienPatrimonial.objects.filter(pk=bien.pk).exists())

    def test_grupos_se_sincronizan_con_permisos_esperados(self):
        editor = Group.objects.get(name=GRUPO_EDITOR).permissions.values_list("codename", flat=True)
        self.assertIn("change_bienpatrimonial", editor)
        self.assertNotIn("delete_bienpatrimonial", editor)
        self.assertNotIn("view_user", editor)
        admin = Group.objects.get(name=GRUPO_ADMINISTRADOR).permissions.values_list("codename", flat=True)
        self.assertIn("add_user", admin)
        self.assertIn("view_logentry", admin)
        self.assertNotIn("change_group", admin)


# ---------------------------------------------------------------------------
# API pública de lectura (entregable: endpoints de bienes y categorías)
# ---------------------------------------------------------------------------
class ApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.plaza = crear_bien("Plaza Murillo")
        agregar_fuente(cls.plaza)
        cls.plaza.estado_publicacion = EstadoPublicacion.PUBLICADO
        cls.plaza.save()

        cls.cueca = crear_bien("Cueca Paceña", tipo="inmaterial", coords=False)
        agregar_fuente(cls.cueca)
        cls.cueca.estado_publicacion = EstadoPublicacion.PUBLICADO
        cls.cueca.save()

        cls.borrador = crear_bien("Ficha en borrador")
        cls.desactivado = crear_bien("Ficha desactivada", estado=EstadoPublicacion.DESACTIVADO)

    def test_lista_solo_devuelve_publicados_RN01_RF06(self):
        nombres = [b["nombre"] for b in self.client.get("/api/bienes/").json()["results"]]
        self.assertEqual(nombres, ["Cueca Paceña", "Plaza Murillo"])

    def test_lista_esta_paginada_RF06(self):
        datos = self.client.get("/api/bienes/?page_size=1").json()
        self.assertEqual(datos["count"], 2)
        self.assertEqual(len(datos["results"]), 1)
        self.assertIsNotNone(datos["next"])

    def test_coordenadas_numericas_y_bien_sin_ubicacion_RF12(self):
        por_nombre = {b["nombre"]: b for b in self.client.get("/api/bienes/").json()["results"]}
        plaza, cueca = por_nombre["Plaza Murillo"], por_nombre["Cueca Paceña"]
        self.assertIsInstance(plaza["latitud"], float)
        self.assertTrue(plaza["tiene_ubicacion"])
        self.assertIsNone(cueca["latitud"])
        self.assertFalse(cueca["tiene_ubicacion"])

    def test_busqueda_sin_tildes_ni_mayusculas_PT07(self):
        for consulta in ("cueca", "CUECA", "pace%C3%B1a", "pacena"):
            nombres = [b["nombre"] for b in self.client.get(f"/api/bienes/?q={consulta}").json()["results"]]
            self.assertEqual(nombres, ["Cueca Paceña"], consulta)

    def test_filtro_por_categoria_y_limpiarlo_PT08(self):
        otra = Categoria.objects.create(nombre="Otra")
        self.cueca.categoria = otra
        self.cueca.save()
        solo = self.client.get(f"/api/bienes/?categoria={otra.pk}").json()["results"]
        self.assertEqual([b["nombre"] for b in solo], ["Cueca Paceña"])
        self.assertEqual(self.client.get("/api/bienes/").json()["count"], 2)
        self.assertEqual(self.client.get("/api/bienes/?categoria=abc").json()["count"], 0)

    def test_detalle_incluye_fuentes_e_imagenes_con_atribucion_RF10(self):
        RecursoMultimedia.objects.create(
            bien=self.plaza, autor="Autora Ejemplo", licencia=Licencia.objects.get(nombre="CC BY 4.0"),
            archivo="bienes/ejemplo.png", es_portada=True,
        )
        datos = self.client.get(f"/api/bienes/{self.plaza.pk}/").json()
        self.assertEqual(len(datos["fuentes"]), 1)
        self.assertEqual(datos["fuentes"][0]["fecha_consulta"], "2026-10-11")
        self.assertEqual(datos["imagenes"][0]["autor"], "Autora Ejemplo")
        self.assertEqual(datos["imagenes"][0]["licencia"], "CC BY 4.0")
        self.assertEqual(datos["portada"]["autor"], "Autora Ejemplo")
        self.assertIn("descripcion", datos)

    def test_detalle_de_bien_no_publicado_devuelve_404(self):
        for bien in (self.borrador, self.desactivado):
            self.assertEqual(self.client.get(f"/api/bienes/{bien.pk}/").status_code, 404)

    def test_categorias_con_total_de_publicados(self):
        datos = self.client.get("/api/categorias/").json()
        self.assertIsInstance(datos, list)  # sin paginar
        prueba = next(c for c in datos if c["nombre"] == "Arquitectura de prueba")
        self.assertEqual(prueba["total_bienes"], 2)  # no cuenta borrador ni desactivado

    def test_la_api_es_de_solo_lectura(self):
        self.assertEqual(self.client.post("/api/bienes/", {}).status_code, 405)
        self.assertEqual(self.client.delete(f"/api/bienes/{self.plaza.pk}/").status_code, 405)

    def test_la_lista_no_hace_consultas_por_cada_bien(self):
        licencia = Licencia.objects.first()
        for i in range(5):
            b = crear_bien(f"Extra {i}")
            agregar_fuente(b, f"F{i}")
            b.estado_publicacion = EstadoPublicacion.PUBLICADO
            b.save()
            RecursoMultimedia.objects.create(bien=b, autor="A", licencia=licencia, archivo=f"bienes/{i}.png")
        with self.assertNumQueries(4):  # conteo, bienes, recursos, licencias (no crece con el nº de bienes)
            self.client.get("/api/bienes/")


# ---------------------------------------------------------------------------
# Catálogo inicial (semana 2: 10 fichas publicadas con fuente)
# ---------------------------------------------------------------------------
class CargaFichasTests(TestCase):
    def cargar(self, *args):
        from django.core.management import call_command

        call_command("cargar_fichas_iniciales", *args, stdout=io.StringIO())

    def test_carga_10_fichas_publicadas_y_es_idempotente(self):
        self.cargar()
        self.cargar()
        self.cargar("--actualizar")
        publicados = BienPatrimonial.objects.filter(estado_publicacion=EstadoPublicacion.PUBLICADO)
        self.assertEqual(BienPatrimonial.objects.count(), 10)
        self.assertEqual(publicados.count(), 10)
        self.assertEqual(FuenteDocumental.objects.count(), len({f.fuente_id for f in BienFuente.objects.all()}))

    def test_todas_las_fichas_cumplen_RN02_y_RN03(self):
        self.cargar()
        zona = ZonaPiloto.vigente()
        for bien in BienPatrimonial.objects.select_related("tipo_patrimonio"):
            with self.subTest(bien=bien.nombre):
                self.assertEqual(bien.errores_publicacion(), [])
                self.assertTrue(bien.bien_fuentes.filter(fuente__fecha_consulta__isnull=False).exists())
                if bien.es_material:
                    self.assertTrue(zona.contiene(bien.latitud, bien.longitud))
                else:
                    self.assertIsNone(bien.latitud)

    def test_la_api_publica_las_10_con_6_marcadores_y_4_sin_ubicacion(self):
        self.cargar()
        datos = self.client.get("/api/bienes/?page_size=100").json()
        self.assertEqual(datos["count"], 10)
        self.assertEqual(sum(b["tiene_ubicacion"] for b in datos["results"]), 6)

    def test_verificar_catalogo_informa_la_falta_de_imagenes_y_lo_exige_con_estricto(self):
        from django.core.management import CommandError, call_command

        self.cargar()
        salida = io.StringIO()
        call_command("verificar_catalogo", stdout=salida)  # sin --estricto no falla
        texto = salida.getvalue()
        self.assertIn("Fichas publicadas: 10", texto)
        self.assertIn("fuente con fecha de consulta: 10/10 (100 %)", texto)
        self.assertIn("CRITERIO NO CUMPLIDO", texto)
        with self.assertRaises(CommandError):
            call_command("verificar_catalogo", "--estricto", stdout=io.StringIO())

        licencia = Licencia.objects.first()
        for bien in BienPatrimonial.objects.all():  # con imagen atribuida en cada ficha, el criterio se cumple
            RecursoMultimedia.objects.create(bien=bien, autor="Autor", licencia=licencia, archivo=f"bienes/{bien.pk}.png")
        salida = io.StringIO()
        call_command("verificar_catalogo", "--estricto", stdout=salida)
        self.assertIn("CRITERIO CUMPLIDO", salida.getvalue())
