"""
Pruebas de cierre de la semana 4: casos de la matriz PT-01 a PT-25 que no tenían una comprobación
directa en las semanas anteriores (permisos en el servidor y gestión de cuentas desde el panel).
Se ejecutan contra PostgreSQL real, igual que el resto. La correspondencia completa entre los
identificadores de la matriz y estas pruebas está en docs/pruebas/matriz_PT01_PT25.md.
"""
from django import forms
from django.contrib.auth.models import Group, User
from django.forms.widgets import MultiWidget
from django.test import TestCase
from django.urls import reverse

from .models import EstadoReporte, ReporteCiudadano, TipoReporte
from .roles import GRUPO_ADMINISTRADOR, GRUPO_EDITOR
from .test_semana3 import publicar


def datos_de_formulario(form, excluir=()):
    """Reconstruye el POST de un formulario de Django Admin a partir de sus valores actuales."""
    datos = {}
    for nombre, campo in form.fields.items():
        if nombre in excluir:
            continue
        valor = form.initial.get(nombre, campo.initial)
        if isinstance(campo.widget, MultiWidget):
            for i, parte in enumerate(campo.widget.decompress(valor)):
                datos[f"{nombre}_{i}"] = "" if parte is None else parte
        elif isinstance(campo, forms.BooleanField):
            if valor:
                datos[nombre] = "on"
        elif isinstance(campo, forms.ModelMultipleChoiceField):
            datos[nombre] = [getattr(o, "pk", o) for o in (valor or [])]
        elif valor is not None:
            datos[nombre] = valor
    return datos


class CuentasYPermisosSemana4(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.editor = User.objects.create_user("editor", password="x-Editor-123", is_staff=True)
        cls.editor.groups.add(Group.objects.get(name=GRUPO_EDITOR))
        cls.admin = User.objects.create_user("admin", password="x-Admin-123", is_staff=True)
        cls.admin.groups.add(Group.objects.get(name=GRUPO_ADMINISTRADOR))

    # -- PT-21: los permisos se comprueban en el servidor, no solo se ocultan en la interfaz ----------
    def test_PT21_editor_no_puede_crear_cuentas_enviando_el_formulario_directamente(self):
        self.client.force_login(self.editor)
        resp = self.client.post(
            reverse("admin:auth_user_add"),
            {"username": "intruso", "password1": "Cl4ve-segura-987", "password2": "Cl4ve-segura-987", "usable_password": "true"},
        )
        self.assertEqual(resp.status_code, 403)
        self.assertFalse(User.objects.filter(username="intruso").exists())

    def test_PT21_editor_no_puede_modificar_cuentas_ni_grupos_por_POST(self):
        self.client.force_login(self.editor)
        url = reverse("admin:auth_user_change", args=[self.editor.pk])
        self.assertEqual(self.client.post(url, {"username": "editor", "is_superuser": "on", "is_staff": "on"}).status_code, 403)
        self.editor.refresh_from_db()
        self.assertFalse(self.editor.is_superuser)
        self.assertEqual(self.client.post(reverse("admin:auth_group_add"), {"name": "Nuevo"}).status_code, 403)
        self.assertFalse(Group.objects.filter(name="Nuevo").exists())

    # -- PT-22: el Administrador crea y desactiva una cuenta desde el panel -------------------------
    def test_PT22_administrador_crea_una_cuenta_y_al_desactivarla_ya_no_ingresa(self):
        self.client.force_login(self.admin)
        clave = "Cl4ve-segura-987"
        resp = self.client.post(
            reverse("admin:auth_user_add"),
            {"username": "nueva_editora", "password1": clave, "password2": clave, "usable_password": "true"},
        )
        self.assertEqual(resp.status_code, 302, getattr(resp, "context", None) and resp.context["adminform"].form.errors)
        cuenta = User.objects.get(username="nueva_editora")
        self.assertTrue(cuenta.is_active)

        # Se le asigna el grupo Editor y se marca como personal; con esos datos ya puede iniciar sesión.
        url = reverse("admin:auth_user_change", args=[cuenta.pk])
        formulario = self.client.get(url).context["adminform"].form
        datos = datos_de_formulario(formulario)
        datos.update({"is_staff": "on", "groups": [Group.objects.get(name=GRUPO_EDITOR).pk]})
        self.assertEqual(self.client.post(url, datos).status_code, 302)
        cuenta.refresh_from_db()
        self.assertTrue(cuenta.is_staff)
        self.assertTrue(self.client.login(username="nueva_editora", password=clave))

        # Se desactiva desde el panel (no se borra): sin «is_active», la cuenta no puede ingresar.
        self.client.force_login(self.admin)
        datos = datos_de_formulario(self.client.get(url).context["adminform"].form)
        datos.pop("is_active", None)
        self.assertEqual(self.client.post(url, datos).status_code, 302)
        cuenta.refresh_from_db()
        self.assertFalse(cuenta.is_active)
        self.client.logout()
        self.assertFalse(self.client.login(username="nueva_editora", password=clave))
        self.assertTrue(User.objects.filter(pk=cuenta.pk).exists(), "la cuenta se desactiva, no se borra")

    def test_PT22_una_cuenta_desactivada_con_sesion_abierta_pierde_el_acceso_al_panel(self):
        self.client.force_login(self.editor)
        self.assertEqual(self.client.get(reverse("admin:index")).status_code, 200)
        self.editor.is_active = False
        self.editor.save()
        resp = self.client.get(reverse("admin:index"))
        self.assertEqual(resp.status_code, 302)
        self.assertIn("/admin/login/", resp["Location"])

    def test_PT22_el_administrador_no_puede_borrar_cuentas(self):
        """RF-22: las cuentas se desactivan, no se borran (el permiso delete_user no se concede)."""
        self.client.force_login(self.admin)
        resp = self.client.post(reverse("admin:auth_user_delete", args=[self.editor.pk]), {"post": "yes"})
        self.assertEqual(resp.status_code, 403)
        self.assertTrue(User.objects.filter(pk=self.editor.pk).exists())


class BandejaDeReportesSemana4(TestCase):
    """PT-19: en la bandeja solo se ofrecen estados válidos (el estado actual y sus destinos permitidos)."""

    @classmethod
    def setUpTestData(cls):
        cls.editor = User.objects.create_user("editor", password="x-Editor-123", is_staff=True)
        cls.editor.groups.add(Group.objects.get(name=GRUPO_EDITOR))
        cls.bien = publicar("Ficha con reporte")
        cls.tipo = TipoReporte.objects.first()

    def opciones_de_estado(self, reporte):
        self.client.force_login(self.editor)
        formulario = self.client.get(reverse("admin:patrimonio_reporteciudadano_change", args=[reporte.pk])).context["adminform"].form
        return [etiqueta for _valor, etiqueta in formulario.fields["estado"].choices]

    def crear_reporte(self, estado):
        return ReporteCiudadano.objects.create(
            bien=self.bien, tipo_reporte=self.tipo, descripcion="Texto", estado=EstadoReporte.objects.get(nombre=estado)
        )

    def test_PT19_el_selector_no_ofrece_una_opcion_en_blanco_ni_transiciones_invalidas(self):
        self.assertEqual(self.opciones_de_estado(self.crear_reporte(EstadoReporte.NUEVO)), ["nuevo", "en revisión", "descartado"])
        self.assertEqual(self.opciones_de_estado(self.crear_reporte(EstadoReporte.EN_REVISION)), ["en revisión", "atendido", "descartado"])
        self.assertEqual(self.opciones_de_estado(self.crear_reporte(EstadoReporte.ATENDIDO)), ["atendido"])

    def test_PT19_una_transicion_invalida_enviada_directamente_se_rechaza(self):
        reporte = self.crear_reporte(EstadoReporte.NUEVO)
        self.client.force_login(self.editor)
        url = reverse("admin:patrimonio_reporteciudadano_change", args=[reporte.pk])
        atendido = EstadoReporte.objects.get(nombre=EstadoReporte.ATENDIDO)
        self.client.post(url, {"estado": atendido.pk, "nota_revision": "salto no permitido"})
        reporte.refresh_from_db()
        self.assertEqual(reporte.estado.nombre, EstadoReporte.NUEVO)
        self.assertFalse(reporte.historial.exists())
