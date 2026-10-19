"""Pruebas de humo E2E para IO Solver v8.1.4.

Requiere Playwright para Python y Chromium instalado:
  python -m pip install playwright
  python -m playwright install chromium
  python tests/test_e2e_v800.py

El servidor HTTP se inicia automáticamente en un puerto libre y sirve la raíz
actual del proyecto. Esta suite no requiere Git, rutas locales preconfiguradas ni
un navegador abierto manualmente. No mide la precisión del OCR de fotografías.
"""
from __future__ import annotations

import functools
import shutil
import threading
import unittest
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError as exc:  # pragma: no cover - setup guidance
    raise SystemExit(
        "Falta Playwright. Instálalo con: python -m pip install playwright\n"
        "Después ejecuta: python -m playwright install chromium"
    ) from exc

ROOT = Path(__file__).resolve().parent.parent


class IOHTTPServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


class TestIOSolverV800(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        handler = functools.partial(SimpleHTTPRequestHandler, directory=str(ROOT))
        cls.server = IOHTTPServer(("127.0.0.1", 0), handler)
        cls.server_thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.server.server_address[1]}"
        cls.playwright = sync_playwright().start()
        try:
            system_chromium = shutil.which("chromium") or shutil.which("chromium-browser") or shutil.which("google-chrome")
            launch_options = {"headless": True}
            if system_chromium:
                launch_options["executable_path"] = system_chromium
            cls.browser = cls.playwright.chromium.launch(**launch_options)
        except Exception:
            cls.server.shutdown()
            cls.server.server_close()
            cls.playwright.stop()
            raise

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={"width": 1360, "height": 900})
        self.page = self.context.new_page()
        self.page_errors = []
        self.page.on("pageerror", lambda error: self.page_errors.append(str(error)))
        self.page.goto(f"{self.base_url}/index.html", wait_until="load")
        self.page.wait_for_function("document.readyState === 'complete'")

    def tearDown(self):
        self.context.close()

    def open_module(self, name: str):
        self.page.locator(f'[data-module="{name}"]').click()
        self.page.wait_for_function(
            "name => !document.getElementById(name + '-module').classList.contains('hidden')",
            arg=name,
        )

    def test_version_launcher_and_five_modules(self):
        p = self.page
        self.assertEqual(p.locator('meta[name="version"]').get_attribute("content"), "8.1.4")
        self.assertEqual(p.locator(".module-card").count(), 5)
        self.assertIn("OCR", p.locator(".launcher-beta-note").inner_text())
        self.assertIn("beta", p.locator(".launcher-beta-note").inner_text().lower())
        for module in ("simplex", "pert", "transportation", "route-shortest", "optimization"):
            self.open_module(module)
            self.assertTrue(p.locator(f"#{module}-module").is_visible())
            p.locator(f"#{module}-module [data-back-launcher]").click()
            p.wait_for_function("!document.getElementById('launcher').classList.contains('hidden')")
        self.assertEqual(self.page_errors, [])

    def test_shortest_path_example(self):
        p = self.page
        self.open_module("route-shortest")
        p.locator("#route-example").click()
        p.locator("#route-solve").click()
        p.wait_for_function("!document.getElementById('route-result').classList.contains('hidden')")
        summary = p.locator("#route-summary").inner_text()
        self.assertIn("10", summary)
        self.assertIn("A", summary)
        self.assertIn("E", summary)
        self.assertGreater(p.locator("#route-steps tbody tr").count(), 0)
        self.assertEqual(self.page_errors, [])

    def test_optimization_known_polynomial(self):
        p = self.page
        self.open_module("optimization")
        p.locator("#optimization-analyze").click()
        result = p.evaluate("""() => {
          const a = window.IOOptimizationUI?.getResult();
          if (!a) return null;
          return { min: a.minimum.value, max: a.maximum.value,
            inflections: a.inflections.map(p => ({x:p.x, y:p.y})),
            critical: a.critical.map(p => ({x:p.x, y:p.y, kind:p.kind})) };
        }""")
        self.assertIsNotNone(result)
        self.assertAlmostEqual(result["min"], 1, places=5)
        self.assertAlmostEqual(result["max"], 21, places=5)
        self.assertTrue(any(abs(pt["x"] - 2) < 1e-4 and abs(pt["y"] - 3) < 1e-4 for pt in result["inflections"]))
        p.locator('[data-optimization-view="inflection"]').click()
        self.assertIn("Puntos de inflexión", p.locator("#optimization-output").inner_text())
        self.assertEqual(self.page_errors, [])

    def test_transport_text_import_is_reviewed_before_solving(self):
        p = self.page
        self.open_module("transportation")
        source = (
            "Tres fábricas envían su producto a cinco distribuidores.\n"
            "FABRICAS 1 2 3 4 5 DISPONIBILIDADES\n"
            "1 20 19 14 21 16 40\n"
            "2 15 20 13 19 16 60\n"
            "3 18 15 18 20 X 70\n"
            "REQUERIMIENTOS 30 40 50 60 40"
        )
        p.locator("#transport-paste-text").fill(source)
        p.locator("#transport-paste-btn").click()
        p.wait_for_selector("#review-apply")
        self.assertTrue(p.locator("#transport-import-results").is_visible())
        self.assertIn("Revisión", p.locator("#transport-import-results").inner_text())
        self.assertTrue(p.locator("#transport-result").evaluate("el => el.classList.contains('hidden')"))
        p.locator("#review-apply").click()
        p.wait_for_function("document.getElementById('transport-doc-status').textContent.includes('no se ha resuelto')")
        self.assertTrue(p.locator("#transport-result").evaluate("el => el.classList.contains('hidden')"))
        self.assertEqual(self.page_errors, [])

    def test_pert_text_import_apply_and_calculate(self):
        p = self.page
        self.open_module("pert")
        text = "Actividad | Predecesoras | Duración\nA | — | 3\nB | A | 4\nC | A | 2\nD | B, C | 5"
        p.locator("#pert-import-text").fill(text)
        p.locator("#pert-interpret-text").click()
        p.wait_for_selector("#pert-import-apply")
        self.assertEqual(p.locator("#pert-import-preview tbody tr").count(), 4)
        self.assertTrue(p.locator("#pert-result").evaluate("el => el.classList.contains('hidden')"))
        p.locator("#pert-import-apply").click()
        self.assertEqual(p.locator("#pert-activity-body tr").count(), 4)
        self.assertTrue(p.locator("#pert-result").evaluate("el => el.classList.contains('hidden')"))
        p.locator("#pert-solve-btn").click()
        p.wait_for_function("!document.getElementById('pert-result').classList.contains('hidden')")
        self.assertEqual(self.page_errors, [])

    def test_pert_exercise_choices_remain_available_while_reviewing(self):
        p = self.page
        self.open_module("pert")
        text = (
            "Ejercicio 1: Plan A\nActividad | Predecesoras | Duración\nA | — | 2\nB | A | 3\n"
            "Ejercicio 2: Plan B\nActividad | Predecesoras | Duración\nC | — | 4\nD | C | 5"
        )
        p.locator("#pert-import-text").fill(text)
        p.locator("#pert-interpret-text").click()
        choices = p.locator("#pert-import-preview [data-exercise-index]")
        self.assertEqual(choices.count(), 2)
        choices.nth(0).click()
        self.assertEqual(p.locator("#pert-import-preview [data-exercise-index]").count(), 2)
        self.assertEqual(p.locator("#pert-import-preview tbody tr").count(), 2)
        p.locator('#pert-import-preview [data-exercise-index="1"]').click()
        self.assertEqual(p.locator("#pert-import-preview [data-exercise-index]").count(), 2)
        self.assertEqual(p.locator("#pert-import-preview tbody tr").count(), 2)
        self.assertIn("Ejercicio 2", p.locator("#pert-import-preview").inner_text())
        self.assertEqual(self.page_errors, [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
