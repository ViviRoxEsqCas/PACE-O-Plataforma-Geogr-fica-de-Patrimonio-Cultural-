"""
Pruebas del espacio social: cuentas, permisos de objeto, duplicados, privacidad, validaciones,
moderación, ranking/logros y flujos principales. Se ejecutan contra PostgreSQL real.
"""
import io
import shutil
import tempfile
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from django.urls import reverse
from PIL import Image
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from apps.patrimonio.models import BienPatrimonial
from apps.patrimonio.roles import GRUPO_ADMINISTRADOR, GRUPO_EDITOR
from apps.patrimonio.test_semana3 import crear_actividad, publicar

from . import reglas
from .models import Amistad, EstadoAmistad, Privacidad, ReporteComentario, Valoracion, VisitaDeclarada
from .throttles import AmistadThrottle, RegistroThrottle

User = get_user_model()
CLAVE = "Cl4ve-segura-987"
TEXTO_LARGO = "Una visita muy recomendable para conocer la historia del lugar."  # > 30 caracteres


def registrar(username, privacidad_perfil=Privacidad.PUBLICO, privacidad_actividad=Privacidad.PUBLICO):
    """Crea una cuenta de visitante y devuelve (usuario, cliente autenticado con su token)."""
    u = User.objects.create_user(username, password=CLAVE)
    from .models import PerfilVisitante
    PerfilVisitante.objects.create(usuario=u, nombre_visible=username.capitalize(), privacidad_perfil=privacidad_perfil, privacidad_actividad=privacidad_actividad)
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Token {Token.objects.create(user=u).key}")
    return u, c


def hacer_amigos(c1, u2, c2):
    r = c1.post("/api/amistades/solicitar/", {"username": u2.username}, format="json")
    assert r.status_code == 201, r.content
    assert c2.post(f"/api/amistades/{r.json()['id']}/aceptar/").status_code == 200


class BaseSocial(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.plaza = publicar("Plaza Murillo")
        cls.iglesia = publicar("Iglesia de San Francisco")
        cls.borrador = BienPatrimonial.objects.create(
            nombre="Borrador", tipo_patrimonio=cls.plaza.tipo_patrimonio, categoria=cls.plaza.categoria
        )

    def setUp(self):
        cache.clear()  # contadores de frecuencia
        self.anonimo = APIClient()


# ---------------------------------------------------------------------------------------------------
class CuentasTests(BaseSocial):
    def setUp(self):
        super().setUp()
        # El límite real (5/hora por IP) lo comprueba su propia prueba; aquí no debe interferir.
        parche = patch.object(RegistroThrottle, "THROTTLE_RATES", {"social_registro": "1000/hour"})
        parche.start()
        self.addCleanup(parche.stop)

    def registrar_api(self, username="ana_paz", clave=CLAVE, **extra):
        return self.anonimo.post("/api/cuentas/registro/", {"username": username, "password": clave, **extra}, format="json")

    def test_registro_crea_visitante_sin_privilegios_ni_correo(self):
        r = self.registrar_api(nombre_visible="Ana Paz")
        self.assertEqual(r.status_code, 201, r.content)
        u = User.objects.get(username="ana_paz")
        self.assertFalse(u.is_staff or u.is_superuser)
        self.assertEqual(u.groups.count(), 0)
        self.assertEqual(u.email, "")
        self.assertTrue(Token.objects.filter(user=u, key=r.json()["token"]).exists())
        self.assertEqual(r.json()["perfil"]["nombre_visible"], "Ana Paz")
        self.assertNotIn("email", r.json()["perfil"])

    def test_registro_rechaza_duplicados_sin_distinguir_mayusculas_y_claves_debiles(self):
        self.registrar_api("Ana_Paz")
        self.assertEqual(self.registrar_api("ana_paz").status_code, 400)
        self.assertEqual(self.registrar_api("otra", clave="12345678").status_code, 400)
        self.assertEqual(self.registrar_api("otra", clave="corta1").status_code, 400)
        self.assertEqual(self.registrar_api("con espacio").status_code, 400)
        self.assertEqual(self.registrar_api("ab").status_code, 400)
        self.assertEqual(User.objects.count(), 1)

    def test_registro_tiene_limite_de_frecuencia(self):
        with patch.object(RegistroThrottle, "THROTTLE_RATES", {"social_registro": "2/hour"}):
            self.assertEqual(self.registrar_api("uno_uno").status_code, 201)
            self.assertEqual(self.registrar_api("dos_dos").status_code, 201)
            self.assertEqual(self.registrar_api("tres_tres").status_code, 429)

    def test_acceso_correcto_incorrecto_y_cuenta_desactivada(self):
        u, _ = registrar("luis")
        ok = self.anonimo.post("/api/cuentas/acceso/", {"username": "luis", "password": CLAVE}, format="json")
        self.assertEqual(ok.status_code, 200)
        self.assertTrue(ok.json()["token"])
        self.assertEqual(self.anonimo.post("/api/cuentas/acceso/", {"username": "luis", "password": "mal"}, format="json").status_code, 400)
        u.is_active = False
        u.save()
        self.assertEqual(self.anonimo.post("/api/cuentas/acceso/", {"username": "luis", "password": CLAVE}, format="json").status_code, 400)

    def test_cuenta_desactivada_con_token_pierde_acceso(self):
        u, c = registrar("luis")
        u.is_active = False
        u.save()
        self.assertEqual(c.get("/api/cuentas/yo/").status_code, 401)

    def test_salida_invalida_el_token(self):
        _, c = registrar("luis")
        self.assertEqual(c.post("/api/cuentas/salida/").status_code, 204)
        self.assertEqual(c.get("/api/cuentas/yo/").status_code, 401)

    def test_un_visitante_no_entra_al_panel_editorial(self):
        u, _ = registrar("luis")
        self.client.force_login(u)
        r = self.client.get(reverse("admin:index"))
        self.assertEqual(r.status_code, 302)
        self.assertIn("/admin/login/", r["Location"])

    def test_los_roles_editor_y_administrador_no_cambian(self):
        editor = User.objects.create_user("edit", password=CLAVE, is_staff=True)
        editor.groups.add(Group.objects.get(name=GRUPO_EDITOR))
        self.assertEqual(list(editor.groups.values_list("name", flat=True)), [GRUPO_EDITOR])
        permisos = Group.objects.get(name=GRUPO_EDITOR).permissions.values_list("codename", flat=True)
        self.assertIn("change_bienpatrimonial", permisos)
        self.assertIn("change_valoracion", permisos)
        self.assertNotIn("delete_valoracion", permisos)
        self.assertNotIn("add_valoracion", permisos)
        self.assertNotIn("view_user", permisos)

    def test_perfil_propio_se_edita_y_no_expone_correo(self):
        u, c = registrar("luis")
        u.email = "secreto@example.com"
        u.save()
        r = c.patch("/api/cuentas/yo/", {"nombre_visible": "Luis M.", "biografia": "Me gustan las plazas.", "privacidad_perfil": "amigos"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertNotIn("secreto@example.com", str(c.get("/api/cuentas/yo/").content))
        self.assertNotIn("secreto@example.com", str(self.anonimo.get("/api/perfiles/luis/").content))
        u.perfil_visitante.refresh_from_db()
        self.assertEqual((u.perfil_visitante.nombre_visible, u.perfil_visitante.privacidad_perfil), ("Luis M.", "amigos"))

    def test_perfil_valida_privacidad_longitudes_y_enlaces(self):
        _, c = registrar("luis")
        for datos in ({"privacidad_perfil": "todos"}, {"biografia": "x" * 281}, {"nombre_visible": "a"}, {"biografia": "Visite http://spam.example"}, {"nombre_visible": "Luis\nM"}):
            self.assertEqual(c.patch("/api/cuentas/yo/", datos, format="json").status_code, 400, datos)

    def test_no_se_puede_editar_otro_perfil_ni_cambiar_el_propietario(self):
        a, ca = registrar("ana")
        b, _ = registrar("beto")
        ca.patch("/api/cuentas/yo/", {"nombre_visible": "Ana Nueva", "usuario": b.id, "username": "beto"}, format="json")
        a.perfil_visitante.refresh_from_db()
        b.perfil_visitante.refresh_from_db()
        self.assertEqual(a.perfil_visitante.nombre_visible, "Ana Nueva")
        self.assertEqual(b.perfil_visitante.nombre_visible, "Beto")
        a.refresh_from_db()
        self.assertEqual(a.username, "ana")
        self.assertEqual(self.anonimo.patch("/api/cuentas/yo/", {}, format="json").status_code, 401)

    def test_foto_de_perfil_valida_formato_y_tamano(self):
        media = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, media, True)
        with override_settings(MEDIA_ROOT=media):
            _, c = registrar("luis")
            buf = io.BytesIO()
            Image.new("RGB", (20, 20), "red").save(buf, "PNG")
            buen = SimpleUploadedFile("f.png", buf.getvalue(), content_type="image/png")
            r = c.patch("/api/cuentas/yo/", {"foto": buen}, format="multipart")
            self.assertEqual(r.status_code, 200, r.content)
            self.assertTrue(r.json()["foto"].endswith(".png"))
            falso = SimpleUploadedFile("f.png", b"no soy una imagen", content_type="image/png")
            self.assertEqual(c.patch("/api/cuentas/yo/", {"foto": falso}, format="multipart").status_code, 400)
            gif = io.BytesIO()
            Image.new("RGB", (5, 5)).save(gif, "GIF")
            self.assertEqual(c.patch("/api/cuentas/yo/", {"foto": SimpleUploadedFile("f.gif", gif.getvalue(), content_type="image/gif")}, format="multipart").status_code, 400)
            grande = SimpleUploadedFile("g.png", buf.getvalue() + b"0" * (2 * 1024 * 1024), content_type="image/png")
            self.assertEqual(c.patch("/api/cuentas/yo/", {"foto": grande}, format="multipart").status_code, 400)


# ---------------------------------------------------------------------------------------------------
class ValoracionesTests(BaseSocial):
    def valorar(self, cliente, bien, estrellas=4, **extra):
        return cliente.put(f"/api/bienes/{bien.id}/mi-valoracion/", {"estrellas": estrellas, **extra}, format="json")

    def test_todo_lo_que_escribe_exige_sesion(self):
        b = self.plaza.id
        for metodo, url in (
            ("put", f"/api/bienes/{b}/mi-valoracion/"), ("delete", f"/api/bienes/{b}/mi-valoracion/"),
            ("put", f"/api/bienes/{b}/mi-visita/"), ("delete", f"/api/bienes/{b}/mi-visita/"),
            ("post", "/api/valoraciones/1/reportar/"), ("post", "/api/amistades/solicitar/"),
            ("get", "/api/amistades/"), ("get", "/api/amistades/actividad/"), ("get", "/api/cuentas/yo/"),
        ):
            self.assertEqual(getattr(self.anonimo, metodo)(url, {}, format="json").status_code, 401, (metodo, url))
        self.assertEqual(Valoracion.objects.count() + VisitaDeclarada.objects.count(), 0)

    def test_una_valoracion_por_usuario_y_bien_se_edita_sin_duplicar(self):
        u, c = registrar("ana")
        self.assertEqual(self.valorar(c, self.plaza, 4, comentario=TEXTO_LARGO).status_code, 201)
        r = self.valorar(c, self.plaza, 2, comentario="Cambié de opinión.")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Valoracion.objects.filter(usuario=u, bien=self.plaza).count(), 1)
        v = Valoracion.objects.get(usuario=u)
        self.assertEqual((v.estrellas, v.comentario), (2, "Cambié de opinión."))
        self.assertEqual(self.valorar(c, self.iglesia, 5).status_code, 201)  # otro bien: otra valoración

    def test_la_base_de_datos_impide_duplicados_aunque_falle_la_validacion(self):
        u, _ = registrar("ana")
        Valoracion.objects.create(usuario=u, bien=self.plaza, estrellas=3)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Valoracion.objects.create(usuario=u, bien=self.plaza, estrellas=5)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Valoracion.objects.create(usuario=u, bien=self.iglesia, estrellas=9)
        with self.assertRaises(IntegrityError), transaction.atomic():
            VisitaDeclarada.objects.bulk_create([VisitaDeclarada(usuario=u, bien=self.plaza)] * 2)

    def test_validaciones_de_estrellas_y_comentario_en_el_servidor(self):
        _, c = registrar("ana")
        malos = [
            {"estrellas": 0}, {"estrellas": 6}, {"estrellas": "x"}, {},
            {"estrellas": 3, "comentario": "x" * 501},
            {"estrellas": 3, "comentario": "ab"},
            {"estrellas": 3, "comentario": "Visite www.ofertas.example ahora"},
            {"estrellas": 3, "comentario": "holaaaaaaaaaaaaaaaaaa" + "!" * 12},
            {"estrellas": 3, "comentario": "Texto\x00con control"},
        ]
        for datos in malos:
            self.assertEqual(c.put(f"/api/bienes/{self.plaza.id}/mi-valoracion/", datos, format="json").status_code, 400, datos)
        self.assertEqual(Valoracion.objects.count(), 0)

    def test_comentario_es_opcional_y_solo_texto_plano_se_guarda_tal_cual(self):
        _, c = registrar("ana")
        self.assertEqual(self.valorar(c, self.plaza, 5).status_code, 201)
        r = self.valorar(c, self.plaza, 5, comentario="<b>Muy bonito</b> lugar para pasear")
        self.assertEqual(r.json()["comentario"], "<b>Muy bonito</b> lugar para pasear")  # React lo escapa al mostrarlo

    def test_solo_se_valora_un_bien_publicado(self):
        _, c = registrar("ana")
        self.assertEqual(self.valorar(c, self.borrador).status_code, 404)
        self.assertEqual(c.put(f"/api/bienes/{self.borrador.id}/mi-visita/").status_code, 404)
        self.assertEqual(self.anonimo.get(f"/api/bienes/{self.borrador.id}/social/").status_code, 404)

    def test_retirar_la_valoracion(self):
        _, c = registrar("ana")
        self.valorar(c, self.plaza)
        self.assertEqual(c.delete(f"/api/bienes/{self.plaza.id}/mi-valoracion/").status_code, 204)
        self.assertEqual(c.delete(f"/api/bienes/{self.plaza.id}/mi-valoracion/").status_code, 404)
        self.assertEqual(Valoracion.objects.count(), 0)

    def test_nadie_modifica_la_valoracion_de_otra_persona(self):
        a, ca = registrar("ana")
        _, cb = registrar("beto")
        self.valorar(ca, self.plaza, 5, comentario=TEXTO_LARGO)
        self.assertEqual(self.valorar(cb, self.plaza, 1).status_code, 201)  # crea la SUYA
        self.assertEqual(Valoracion.objects.get(usuario=a).estrellas, 5)
        self.assertEqual(cb.delete(f"/api/bienes/{self.plaza.id}/mi-valoracion/").status_code, 204)  # borra solo la suya
        self.assertTrue(Valoracion.objects.filter(usuario=a).exists())

    def test_resumen_promedio_cantidad_y_estado_propio(self):
        _, ca = registrar("ana")
        _, cb = registrar("beto")
        self.valorar(ca, self.plaza, 5)
        self.valorar(cb, self.plaza, 2, comentario="Regular, esperaba más.")
        r = self.anonimo.get(f"/api/bienes/{self.plaza.id}/social/").json()
        self.assertEqual((r["promedio"], r["cantidad"], r["mi_valoracion"], r["visitado"]), (3.5, 2, None, None))
        mio = ca.get(f"/api/bienes/{self.plaza.id}/social/").json()
        self.assertEqual(mio["mi_valoracion"]["estrellas"], 5)
        self.assertFalse(mio["visitado"])
        vacio = self.anonimo.get(f"/api/bienes/{self.iglesia.id}/social/").json()
        self.assertEqual((vacio["promedio"], vacio["cantidad"]), (None, 0))

    def test_comentarios_publicos_orden_reciente_primero_y_solo_con_texto(self):
        _, ca = registrar("ana")
        _, cb = registrar("beto")
        _, cc = registrar("carla")
        self.valorar(ca, self.plaza, 5, comentario="Primer comentario del día.")
        self.valorar(cb, self.plaza, 3, comentario="Segundo comentario del día.")
        self.valorar(cc, self.plaza, 4)  # sin texto: cuenta en el promedio, no aparece en la lista
        r = self.anonimo.get(f"/api/bienes/{self.plaza.id}/valoraciones/").json()
        self.assertEqual([x["comentario"] for x in r["results"]], ["Segundo comentario del día.", "Primer comentario del día."])
        self.assertEqual(r["count"], 2)
        self.assertEqual(self.anonimo.get(f"/api/bienes/{self.plaza.id}/social/").json()["cantidad"], 3)

    def test_comentarios_se_paginan(self):
        for i in range(12):
            _, c = registrar(f"user{i:02d}")
            self.valorar(c, self.plaza, 4, comentario=f"Comentario número {i} del grupo")
        p1 = self.anonimo.get(f"/api/bienes/{self.plaza.id}/valoraciones/").json()
        p2 = self.anonimo.get(f"/api/bienes/{self.plaza.id}/valoraciones/?page=2").json()
        self.assertEqual((len(p1["results"]), p1["has_next"], len(p2["results"]), p2["has_next"]), (10, True, 2, False))

    def test_la_api_de_bienes_no_cambia_ni_mezcla_opiniones_con_la_ficha(self):
        _, c = registrar("ana")
        self.valorar(c, self.plaza, 5, comentario=TEXTO_LARGO)
        ficha = self.anonimo.get(f"/api/bienes/{self.plaza.id}/").json()
        for clave in ("valoraciones", "comentarios", "promedio", "estrellas"):
            self.assertNotIn(clave, ficha)

    def test_las_actividades_siguen_sin_exponer_la_opcion_correcta(self):
        actividad = crear_actividad(self.plaza)
        _, c = registrar("ana")
        for cliente in (self.anonimo, c):
            texto = cliente.get(f"/api/bienes/{self.plaza.id}/actividades/").content.decode()
            self.assertNotIn("es_correcta", texto)
            self.assertNotIn("retroalimentacion", texto)
        self.assertEqual(self.anonimo.post(f"/api/actividades/{actividad.id}/responder/", {"opcion": actividad.opciones.first().id}, format="json").status_code, 200)

    # -- moderación ---------------------------------------------------------------------------------
    def test_reportar_comentario_una_sola_vez_y_nunca_el_propio(self):
        _, ca = registrar("ana")
        _, cb = registrar("beto")
        self.valorar(ca, self.plaza, 1, comentario="Comentario ofensivo de prueba.")
        v = Valoracion.objects.get()
        url = f"/api/valoraciones/{v.id}/reportar/"
        self.assertEqual(ca.post(url, {"motivo": "spam"}, format="json").status_code, 400)
        self.assertEqual(cb.post(url, {"motivo": ""}, format="json").status_code, 400)
        self.assertEqual(cb.post(url, {"motivo": "Es ofensivo"}, format="json").status_code, 201)
        self.assertEqual(cb.post(url, {"motivo": "Es ofensivo"}, format="json").status_code, 409)
        self.assertEqual(ReporteComentario.objects.count(), 1)

    def test_comentario_oculto_desaparece_del_publico_pero_las_estrellas_cuentan(self):
        _, ca = registrar("ana")
        self.valorar(ca, self.plaza, 2, comentario="Comentario que será ocultado.")
        Valoracion.objects.update(comentario_oculto=True)
        self.assertEqual(self.anonimo.get(f"/api/bienes/{self.plaza.id}/valoraciones/").json()["count"], 0)
        self.assertEqual(self.anonimo.get(f"/api/bienes/{self.plaza.id}/social/").json()["cantidad"], 1)
        propio = ca.get(f"/api/bienes/{self.plaza.id}/social/").json()["mi_valoracion"]
        self.assertTrue(propio["comentario_oculto"])
        # editar el texto no lo hace reaparecer: lo restituye solo el equipo editorial
        self.valorar(ca, self.plaza, 2, comentario="Intento de volver a publicar.")
        self.assertTrue(Valoracion.objects.get().comentario_oculto)

    def test_el_editor_oculta_y_restituye_desde_el_panel_pero_no_borra(self):
        _, ca = registrar("ana")
        self.valorar(ca, self.plaza, 1, comentario="Comentario inapropiado de prueba.")
        v = Valoracion.objects.get()
        editor = User.objects.create_user("editor", password=CLAVE, is_staff=True)
        editor.groups.add(Group.objects.get(name=GRUPO_EDITOR))
        self.client.force_login(editor)
        r = self.client.post(reverse("admin:social_valoracion_changelist"), {"action": "ocultar_comentarios", "_selected_action": [v.pk]})
        self.assertEqual(r.status_code, 302)
        v.refresh_from_db()
        self.assertTrue(v.comentario_oculto)
        self.client.post(reverse("admin:social_valoracion_changelist"), {"action": "restituir_comentarios", "_selected_action": [v.pk]})
        v.refresh_from_db()
        self.assertFalse(v.comentario_oculto)
        self.assertEqual(self.client.post(reverse("admin:social_valoracion_delete", args=[v.pk]), {"post": "yes"}).status_code, 403)
        self.assertEqual(self.client.post(reverse("admin:social_valoracion_add"), {}).status_code, 403)
        self.assertTrue(Valoracion.objects.filter(pk=v.pk).exists())

    def test_un_visitante_no_puede_moderar_desde_el_panel(self):
        _, ca = registrar("ana")
        self.valorar(ca, self.plaza, 1, comentario="Comentario de prueba aquí.")
        u = User.objects.get(username="ana")
        self.client.force_login(u)
        r = self.client.post(reverse("admin:social_valoracion_changelist"), {"action": "ocultar_comentarios", "_selected_action": [Valoracion.objects.get().pk]})
        self.assertEqual(r.status_code, 302)  # redirigido al ingreso del panel
        self.assertFalse(Valoracion.objects.get().comentario_oculto)

    def test_escrituras_tienen_limite_de_frecuencia(self):
        from .throttles import EscrituraSocialThrottle
        _, c = registrar("ana")
        with patch.object(EscrituraSocialThrottle, "THROTTLE_RATES", {"social_escritura": "3/hour"}):
            codigos = [self.valorar(c, self.plaza, 3).status_code for _ in range(5)]
        self.assertEqual(codigos, [201, 200, 200, 429, 429])


# ---------------------------------------------------------------------------------------------------
class VisitasTests(BaseSocial):
    def test_abrir_la_ficha_no_registra_una_visita(self):
        _, c = registrar("ana")
        c.get(f"/api/bienes/{self.plaza.id}/")
        c.get(f"/api/bienes/{self.plaza.id}/social/")
        self.assertEqual(VisitaDeclarada.objects.count(), 0)

    def test_marcar_como_visitado_es_idempotente_y_declarado_no_verificado(self):
        u, c = registrar("ana")
        r1 = c.put(f"/api/bienes/{self.plaza.id}/mi-visita/")
        r2 = c.put(f"/api/bienes/{self.plaza.id}/mi-visita/")
        self.assertEqual((r1.status_code, r2.status_code), (201, 200))
        self.assertEqual(r1.json(), {"visitado": True, "verificada": False})
        self.assertEqual(VisitaDeclarada.objects.filter(usuario=u).count(), 1)
        self.assertTrue(c.get(f"/api/bienes/{self.plaza.id}/social/").json()["visitado"])
        self.assertEqual(c.delete(f"/api/bienes/{self.plaza.id}/mi-visita/").status_code, 204)
        self.assertFalse(c.get(f"/api/bienes/{self.plaza.id}/social/").json()["visitado"])

    def test_la_visita_no_guarda_ubicacion(self):
        campos = {f.name for f in VisitaDeclarada._meta.get_fields()}
        self.assertEqual(campos, {"id", "usuario", "bien", "created_at"})
        _, c = registrar("ana")
        c.put(f"/api/bienes/{self.plaza.id}/mi-visita/", {"latitud": -16.5, "longitud": -68.1}, format="json")
        self.assertEqual(VisitaDeclarada.objects.count(), 1)


# ---------------------------------------------------------------------------------------------------
class AmistadesTests(BaseSocial):
    def solicitar(self, cliente, username):
        return cliente.post("/api/amistades/solicitar/", {"username": username}, format="json")

    def test_flujo_solicitud_aceptacion_y_lista(self):
        a, ca = registrar("ana")
        b, cb = registrar("beto")
        r = self.solicitar(ca, "beto")
        self.assertEqual((r.status_code, r.json()["estado"]), (201, "pendiente"))
        self.assertEqual(len(cb.get("/api/amistades/").json()["recibidas"]), 1)
        self.assertEqual(len(ca.get("/api/amistades/").json()["enviadas"]), 1)
        self.assertEqual(cb.post(f"/api/amistades/{r.json()['id']}/aceptar/").status_code, 200)
        for cliente, otro in ((ca, "beto"), (cb, "ana")):
            datos = cliente.get("/api/amistades/").json()
            self.assertEqual([x["persona"]["username"] for x in datos["amigos"]], [otro])
            self.assertEqual((datos["recibidas"], datos["enviadas"]), ([], []))

    def test_no_a_si_mismo_ni_duplicadas_ni_cruzadas(self):
        a, ca = registrar("ana")
        b, cb = registrar("beto")
        self.assertEqual(self.solicitar(ca, "ana").status_code, 400)
        self.assertEqual(self.solicitar(ca, "beto").status_code, 201)
        self.assertEqual(self.solicitar(ca, "beto").status_code, 409)
        self.assertEqual(self.solicitar(cb, "ana").status_code, 409)  # cruzada: ya le escribió ella
        self.assertEqual(Amistad.objects.count(), 1)

    def test_no_se_puede_solicitar_a_quien_ya_es_amistad(self):
        a, ca = registrar("ana")
        b, cb = registrar("beto")
        hacer_amigos(ca, b, cb)
        self.assertEqual(self.solicitar(cb, "ana").status_code, 409)
        self.assertEqual(self.solicitar(ca, "beto").status_code, 409)
        self.assertEqual(Amistad.objects.count(), 1)

    def test_la_base_de_datos_impide_amistades_inversas_duplicadas_y_autoamistad(self):
        a, _ = registrar("ana")
        b, _ = registrar("beto")
        Amistad.objects.create(solicitante=a, destinatario=b)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Amistad.objects.create(solicitante=b, destinatario=a)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Amistad.objects.create(solicitante=a, destinatario=b)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Amistad.objects.create(solicitante=a, destinatario=a)

    def test_solo_el_destinatario_responde(self):
        a, ca = registrar("ana")
        b, cb = registrar("beto")
        _, cc = registrar("carla")
        fid = self.solicitar(ca, "beto").json()["id"]
        for cliente in (ca, cc, self.anonimo):
            self.assertIn(cliente.post(f"/api/amistades/{fid}/aceptar/").status_code, (404, 401))
            self.assertIn(cliente.post(f"/api/amistades/{fid}/rechazar/").status_code, (404, 401))
        self.assertEqual(Amistad.objects.get().estado, EstadoAmistad.PENDIENTE)
        self.assertEqual(cc.delete(f"/api/amistades/{fid}/").status_code, 404)  # una tercera persona no ve la solicitud
        self.assertEqual(cb.delete(f"/api/amistades/{fid}/").status_code, 409)  # el destinatario usa «rechazar»

    def test_rechazada_quien_fue_rechazado_no_insiste_pero_quien_rechazo_si_puede(self):
        a, ca = registrar("ana")
        b, cb = registrar("beto")
        fid = self.solicitar(ca, "beto").json()["id"]
        self.assertEqual(cb.post(f"/api/amistades/{fid}/rechazar/").json()["estado"], "rechazada")
        self.assertEqual(self.solicitar(ca, "beto").status_code, 409)
        self.assertEqual(ca.get("/api/amistades/").json()["enviadas"], [])
        self.assertEqual(self.solicitar(cb, "ana").status_code, 201)  # reabre en sentido inverso
        self.assertEqual(Amistad.objects.count(), 1)
        self.assertEqual(ca.post(f"/api/amistades/{Amistad.objects.get().id}/aceptar/").status_code, 200)

    def test_cancelar_una_solicitud_y_retirar_una_amistad(self):
        a, ca = registrar("ana")
        b, cb = registrar("beto")
        fid = self.solicitar(ca, "beto").json()["id"]
        self.assertEqual(ca.delete(f"/api/amistades/{fid}/").status_code, 204)
        self.assertEqual(Amistad.objects.count(), 0)
        hacer_amigos(ca, b, cb)
        self.assertEqual(cb.delete(f"/api/amistades/{Amistad.objects.get().id}/").status_code, 204)
        self.assertEqual(Amistad.objects.count(), 0)
        self.assertEqual(self.solicitar(ca, "beto").status_code, 201)  # puede volver a empezar

    def test_destinatario_inexistente_o_privado_responde_igual(self):
        _, ca = registrar("ana")
        registrar("secreto", privacidad_perfil=Privacidad.PRIVADO)
        r1 = self.solicitar(ca, "fantasma")
        r2 = self.solicitar(ca, "secreto")
        self.assertEqual((r1.status_code, r2.status_code), (404, 404))
        self.assertEqual(r1.json(), r2.json())

    def test_limite_de_solicitudes_pendientes_y_de_frecuencia(self):
        _, ca = registrar("ana")
        for i in range(21):
            registrar(f"amigo{i:02d}")
        with patch.object(AmistadThrottle, "THROTTLE_RATES", {"social_amistad": "1000/day"}):
            codigos = [self.solicitar(ca, f"amigo{i:02d}").status_code for i in range(21)]
        self.assertEqual(codigos, [201] * 20 + [409])
        with patch.object(AmistadThrottle, "THROTTLE_RATES", {"social_amistad": "1/day"}):
            cache.clear()
            _, cb = registrar("beto")
            self.assertEqual(self.solicitar(cb, "amigo00").status_code, 201)
            self.assertEqual(self.solicitar(cb, "amigo01").status_code, 429)

    def test_usuario_desactivado_desaparece_de_las_listas(self):
        a, ca = registrar("ana")
        b, cb = registrar("beto")
        hacer_amigos(ca, b, cb)
        b.is_active = False
        b.save()
        self.assertEqual(ca.get("/api/amistades/").json()["amigos"], [])


# ---------------------------------------------------------------------------------------------------
class PrivacidadTests(BaseSocial):
    def test_perfil_privado_no_existe_para_los_demas_pero_si_para_su_dueno(self):
        u, c = registrar("secreto", privacidad_perfil=Privacidad.PRIVADO)
        _, otro = registrar("otro")
        self.assertEqual(self.anonimo.get("/api/perfiles/secreto/").status_code, 404)
        self.assertEqual(otro.get("/api/perfiles/secreto/").status_code, 404)
        self.assertEqual(self.anonimo.get("/api/perfiles/inexistente/").status_code, 404)
        self.assertEqual(c.get("/api/perfiles/secreto/").status_code, 200)

    def test_perfil_solo_amistades(self):
        u, c = registrar("ana", privacidad_perfil=Privacidad.AMIGOS)
        b, cb = registrar("beto")
        _, cc = registrar("carla")
        self.assertEqual(self.anonimo.get("/api/perfiles/ana/").status_code, 404)
        self.assertEqual(cc.get("/api/perfiles/ana/").status_code, 404)
        hacer_amigos(c, b, cb)
        r = cb.get("/api/perfiles/ana/")
        self.assertEqual((r.status_code, r.json()["relacion"]["estado"]), (200, "amigos"))

    def test_perfil_publico_muestra_logros_ranking_y_nada_privado(self):
        u, c = registrar("ana")
        c.put(f"/api/bienes/{self.plaza.id}/mi-visita/")
        c.put(f"/api/bienes/{self.plaza.id}/mi-valoracion/", {"estrellas": 5, "comentario": TEXTO_LARGO}, format="json")
        r = self.anonimo.get("/api/perfiles/ana/").json()
        self.assertEqual(r["puntos"], 7)
        self.assertEqual(r["posicion_ranking"], 1)
        self.assertEqual({x["codigo"] for x in r["logros"]}, {"primera_visita", "primera_valoracion", "primera_opinion"})
        for prohibido in ("email", "password", "token", "is_staff", "last_login"):
            self.assertNotIn(prohibido, str(r).lower())

    def test_actividad_del_perfil_segun_su_privacidad(self):
        u, c = registrar("ana", privacidad_actividad=Privacidad.PRIVADO)
        b, cb = registrar("beto")
        c.put(f"/api/bienes/{self.plaza.id}/mi-visita/")
        self.assertIsNone(self.anonimo.get("/api/perfiles/ana/").json()["actividad"])
        hacer_amigos(c, b, cb)
        self.assertIsNone(cb.get("/api/perfiles/ana/").json()["actividad"])
        self.assertEqual(len(c.get("/api/perfiles/ana/").json()["actividad"]), 1)  # la propia persona sí
        c.patch("/api/cuentas/yo/", {"privacidad_actividad": "amigos"}, format="json")
        self.assertIsNone(self.anonimo.get("/api/perfiles/ana/").json()["actividad"])
        self.assertEqual(len(cb.get("/api/perfiles/ana/").json()["actividad"]), 1)
        c.patch("/api/cuentas/yo/", {"privacidad_actividad": "publico"}, format="json")
        self.assertEqual(self.anonimo.get("/api/perfiles/ana/").json()["actividad"][0]["tipo"], "visita")

    def test_actividad_de_amistades_solo_de_amistades_y_respeta_su_privacidad(self):
        a, ca = registrar("ana")
        b, cb = registrar("beto", privacidad_actividad=Privacidad.AMIGOS)
        p, cp = registrar("priv", privacidad_actividad=Privacidad.PRIVADO)
        e, ce = registrar("extra")
        for usuario_cliente in ((b, cb), (p, cp)):
            hacer_amigos(ca, *usuario_cliente)
        cb.put(f"/api/bienes/{self.plaza.id}/mi-visita/")
        cb.put(f"/api/bienes/{self.plaza.id}/mi-valoracion/", {"estrellas": 4, "comentario": "Comentario de Beto aquí."}, format="json")
        cp.put(f"/api/bienes/{self.plaza.id}/mi-visita/")
        ce.put(f"/api/bienes/{self.iglesia.id}/mi-visita/")  # no es amistad de ana
        tipos = sorted((x["usuario"]["username"], x["tipo"]) for x in ca.get("/api/amistades/actividad/").json()["results"])
        self.assertEqual(tipos, [("beto", "comentario"), ("beto", "valoracion"), ("beto", "visita")])
        self.assertEqual(ce.get("/api/amistades/actividad/").json()["results"], [])

    def test_actividad_no_incluye_bienes_no_publicados(self):
        a, ca = registrar("ana")
        b, cb = registrar("beto")
        hacer_amigos(ca, b, cb)
        VisitaDeclarada.objects.create(usuario=b, bien=self.borrador)
        self.assertEqual(ca.get("/api/amistades/actividad/").json()["results"], [])

    def test_autor_de_comentario_se_oculta_si_su_perfil_no_es_publico(self):
        _, cp = registrar("privada", privacidad_perfil=Privacidad.PRIVADO)
        _, ca = registrar("amiga", privacidad_perfil=Privacidad.AMIGOS)
        _, cpub = registrar("publica")
        for c, t in ((cp, "Comentario de la persona privada."), (ca, "Comentario de la persona amiga."), (cpub, "Comentario de la persona pública.")):
            c.put(f"/api/bienes/{self.plaza.id}/mi-valoracion/", {"estrellas": 5, "comentario": t}, format="json")
        r = self.anonimo.get(f"/api/bienes/{self.plaza.id}/valoraciones/").json()["results"]
        autores = {x["comentario"].split()[-1]: x["autor"] for x in r}
        self.assertIsNone(autores["privada."])
        self.assertIsNone(autores["amiga."])
        self.assertEqual(autores["pública."]["username"], "publica")
        propio = cp.get(f"/api/bienes/{self.plaza.id}/valoraciones/").json()["results"]
        self.assertTrue(any(x["propia"] and x["autor"] for x in propio))

    def test_el_personal_editorial_no_tiene_perfil_publico_ni_recibe_solicitudes(self):
        User.objects.create_user("editor_demo", password=CLAVE, is_staff=True)
        _, c = registrar("ana")
        self.assertEqual(self.anonimo.get("/api/perfiles/editor_demo/").status_code, 404)
        self.assertEqual(self.anonimo.get("/api/perfiles/?q=editor").json()["results"], [])
        self.assertEqual(c.post("/api/amistades/solicitar/", {"username": "editor_demo"}, format="json").status_code, 404)

    def test_busqueda_de_perfiles_solo_publicos_y_minimo_de_caracteres(self):
        registrar("marta_publica")
        registrar("marta_amigos", privacidad_perfil=Privacidad.AMIGOS)
        registrar("marta_privada", privacidad_perfil=Privacidad.PRIVADO)
        r = self.anonimo.get("/api/perfiles/?q=marta").json()["results"]
        self.assertEqual([x["username"] for x in r], ["marta_publica"])
        self.assertEqual(self.anonimo.get("/api/perfiles/?q=m").status_code, 400)


# ---------------------------------------------------------------------------------------------------
class RankingYLogrosTests(BaseSocial):
    def valorar(self, c, bien, comentario=""):
        datos = {"estrellas": 4}
        if comentario:
            datos["comentario"] = comentario
        return c.put(f"/api/bienes/{bien.id}/mi-valoracion/", datos, format="json")

    def test_formula_visita_3_valoracion_2_comentario_2(self):
        u, c = registrar("ana")
        c.put(f"/api/bienes/{self.plaza.id}/mi-visita/")
        self.assertEqual(reglas.contadores(u.id)["puntos"], 3)
        self.valorar(c, self.plaza)
        self.assertEqual(reglas.contadores(u.id)["puntos"], 5)
        self.valorar(c, self.plaza, TEXTO_LARGO)
        self.assertEqual(reglas.contadores(u.id)["puntos"], 7)

    def test_acciones_triviales_o_repetidas_no_suman(self):
        u, c = registrar("ana")
        for _ in range(5):
            c.put(f"/api/bienes/{self.plaza.id}/mi-visita/")
            self.valorar(c, self.plaza, "Comentario corto ok")  # < 30 caracteres: sin puntos de comentario
        self.assertEqual(reglas.contadores(u.id)["puntos"], 5)
        c.delete(f"/api/bienes/{self.plaza.id}/mi-valoracion/")
        self.valorar(c, self.plaza)  # borrar y volver a crear no suma dos veces
        self.assertEqual(reglas.contadores(u.id)["puntos"], 5)
        Valoracion.objects.update(comentario=TEXTO_LARGO, comentario_oculto=True)
        self.assertEqual(reglas.contadores(u.id)["comentarios"], 0)  # oculto por moderación: no puntúa

    def test_bienes_no_publicados_no_puntuan(self):
        u, _ = registrar("ana")
        VisitaDeclarada.objects.create(usuario=u, bien=self.borrador)
        Valoracion.objects.create(usuario=u, bien=self.borrador, estrellas=5)
        self.assertEqual(reglas.contadores(u.id)["puntos"], 0)

    def test_orden_desempate_y_exclusion_de_perfiles_no_publicos(self):
        a, ca = registrar("ana")
        b, cb = registrar("beto")
        c_, cc = registrar("carla")
        d, cd = registrar("dani")
        p, cp = registrar("priva", privacidad_perfil=Privacidad.PRIVADO)
        cp.put(f"/api/bienes/{self.plaza.id}/mi-visita/")
        cp.put(f"/api/bienes/{self.iglesia.id}/mi-visita/")
        # carla: 3 puntos (1 visita). beto: 3 puntos... (valoración 2 + nada) no: usar combinaciones iguales
        cc.put(f"/api/bienes/{self.plaza.id}/mi-visita/")  # 3 pts, 1 visita
        self.valorar(cb, self.plaza)  # 2 pts
        self.valorar(cb, self.iglesia)  # 4 pts, 0 visitas
        cd.put(f"/api/bienes/{self.iglesia.id}/mi-visita/")  # 3 pts, 1 visita, dani creada después que carla
        ca.put(f"/api/bienes/{self.plaza.id}/mi-visita/")
        ca.put(f"/api/bienes/{self.iglesia.id}/mi-visita/")  # 6 pts, 2 visitas
        r = self.anonimo.get("/api/ranking/").json()
        self.assertEqual([(x["persona"]["username"], x["puntos"], x["posicion"]) for x in r["results"]],
                         [("ana", 6, 1), ("beto", 4, 2), ("carla", 3, 3), ("dani", 3, 4)])
        self.assertNotIn("priva", str(r))
        self.assertEqual(r["formula"]["visita_declarada"], 3)
        self.assertEqual(cc.get("/api/ranking/").json()["mi_posicion"], 3)
        self.assertIsNone(cp.get("/api/ranking/").json()["mi_posicion"])
        self.assertIsNone(self.anonimo.get("/api/ranking/").json()["mi_posicion"])

    def test_ranking_es_reproducible(self):
        _, c = registrar("ana")
        c.put(f"/api/bienes/{self.plaza.id}/mi-visita/")
        self.assertEqual(self.anonimo.get("/api/ranking/").json(), self.anonimo.get("/api/ranking/").json())

    def test_logros_solo_con_acciones_reales(self):
        u, c = registrar("ana")
        self.assertEqual(reglas.logros_de(reglas.contadores(u.id)), [])  # sin acciones, sin logros (nada retroactivo)
        c.put(f"/api/bienes/{self.plaza.id}/mi-visita/")
        self.assertEqual([x["codigo"] for x in reglas.logros_de(reglas.contadores(u.id))], ["primera_visita"])
        c.put(f"/api/bienes/{self.iglesia.id}/mi-visita/")  # existen 2 bienes publicados: recorrido completo
        codigos = [x["codigo"] for x in reglas.logros_de(reglas.contadores(u.id))]
        self.assertIn("recorrido_completo", codigos)
        self.assertNotIn("explorador", codigos)
        c.delete(f"/api/bienes/{self.iglesia.id}/mi-visita/")
        self.assertNotIn("recorrido_completo", [x["codigo"] for x in reglas.logros_de(reglas.contadores(u.id))])

    def test_logro_de_amistad(self):
        a, ca = registrar("ana")
        b, cb = registrar("beto")
        hacer_amigos(ca, b, cb)
        self.assertIn("primera_amistad", [x["codigo"] for x in reglas.logros_de(reglas.contadores(a.id))])
