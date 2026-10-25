# Servidor local del sitio: sirve web/ y permite correr el modelo desde el botón «Correr modelo».
#   python3 web/servidor.py                      (http://127.0.0.1:8000)
#   MODELO_PYTHON=/ruta/.venv/bin/python python3 web/servidor.py
# MODELO_PYTHON es el Python con las dependencias del modelo; por omisión, el que corre este servidor.
# Al terminar el notebook, copia ../salidas/mapa_siembra.gpkg a web/data/shapefile/ y ejecuta build.py.
import json, os, shutil, subprocess, sys, threading, time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

WEB      = Path(__file__).resolve().parent
REPO     = WEB.parent
NOTEBOOK = REPO / "modelo_compra_acoplado_v6.ipynb"
DATOS    = REPO / "datos"                         # el notebook lee datos/ y escribe ../salidas
SALIDAS  = REPO.parent / "salidas"
GPKG_WEB = WEB / "data/shapefile/mapa_siembra.gpkg"
PYTHON   = os.environ.get("MODELO_PYTHON", sys.executable)
HOST     = os.environ.get("HOST", "127.0.0.1")
PUERTO   = int(os.environ.get("PUERTO", "8000"))

ENTRADAS = [DATOS / "especies y poligonos/datos_limpios.csv",
            DATOS / "especies y poligonos/parametros_especies.csv",
            DATOS / "mapa/MapaCONAFOR.shp"]
MODULOS  = ["numpy", "pandas", "scipy", "matplotlib", "geopandas", "shapely", "numba", "nbclient", "nbformat", "ipykernel"]

candado = threading.Lock()
estado = dict(estado="inactivo", celda=0, total=0, seccion="", mensaje="", inicio=None, fin=None, log=[])
proceso = None

def actualizar(**cambios):
    with candado: estado.update(cambios)

def registrar(linea):
    with candado: estado["log"] = (estado["log"] + [linea])[-60:]

def revisar():
    """Lista de problemas que impiden correr el modelo (archivos o módulos faltantes)."""
    problemas = [f"Falta el archivo {p.relative_to(REPO)}" for p in ENTRADAS if not p.exists()]
    if not NOTEBOOK.exists(): problemas.append(f"Falta el notebook {NOTEBOOK.name}")
    modulos = MODULOS + (["openpyxl"] if (DATOS / "especies y poligonos/Competencia.xlsx").exists() else [])
    codigo = f"import importlib.util as u; print(','.join(m for m in {modulos!r} if u.find_spec(m) is None))"
    try:
        r = subprocess.run([PYTHON, "-c", codigo], capture_output=True, text=True, timeout=60)
        faltan = r.stdout.strip()
        if r.returncode: problemas.append(f"No se pudo usar {PYTHON}: {r.stderr.strip()[-200:]}")
        elif faltan: problemas.append(f"Faltan módulos en {PYTHON}: {faltan.replace(',', ', ')}")
    except (OSError, subprocess.TimeoutExpired) as err:
        problemas.append(f"No se pudo usar {PYTHON}: {err}")
    return problemas

def correr():
    global proceso
    try:
        SALIDAS.mkdir(exist_ok=True)
        ejecutado = SALIDAS / (NOTEBOOK.stem + ".ejecutado.ipynb")
        env = dict(os.environ, MPLBACKEND="Agg", PYTHONUNBUFFERED="1")
        proceso = subprocess.Popen([PYTHON, str(WEB / "correr_modelo.py"), str(NOTEBOOK), str(ejecutado)],
                                   cwd=REPO, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        error = None
        for linea in proceso.stdout:
            linea = linea.rstrip()
            try: dato = json.loads(linea)
            except ValueError: dato = None
            if not isinstance(dato, dict): registrar(linea); continue
            if "error" in dato: error = f"Falló la celda {dato['celda']} ({dato['seccion']}): {dato['error']}"
            else: actualizar(celda=dato["celda"], total=dato["total"], seccion=dato["seccion"],
                             mensaje=f"Celda {dato['celda']} de {dato['total']}")
        codigo = proceso.wait()
        if estado["estado"] == "detenido": return
        if codigo: raise RuntimeError(error or f"El notebook terminó con código {codigo}. Revisa el registro.")

        actualizar(mensaje="Actualizando el sitio")
        nuevo = SALIDAS / "mapa_siembra.gpkg"
        if not nuevo.exists(): raise RuntimeError("El notebook no generó salidas/mapa_siembra.gpkg")
        respaldo = GPKG_WEB.with_suffix(".anterior.gpkg")
        if GPKG_WEB.exists(): shutil.copy2(GPKG_WEB, respaldo)
        shutil.copy2(nuevo, GPKG_WEB)
        r = subprocess.run([sys.executable, str(WEB / "build.py")], capture_output=True, text=True)
        if r.returncode:                                   # se restaura el mapa anterior para no dejar el sitio roto
            if respaldo.exists(): shutil.copy2(respaldo, GPKG_WEB)
            subprocess.run([sys.executable, str(WEB / "build.py")], capture_output=True)
            raise RuntimeError("build.py falló: " + (r.stderr.strip().splitlines() or ["sin detalle"])[-1])
        actualizar(estado="ok", mensaje="Modelo terminado y sitio actualizado", fin=time.time())
    except Exception as err:
        actualizar(estado="error", mensaje=str(err), fin=time.time())
    finally:
        proceso = None

class Manejador(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=str(WEB), **k)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")         # index.html cambia después de cada corrida
        super().end_headers()

    def responder(self, codigo, datos):
        cuerpo = json.dumps(datos, ensure_ascii=False).encode()
        self.send_response(codigo); self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo))); self.end_headers(); self.wfile.write(cuerpo)

    def do_GET(self):
        if self.path == "/api/modelo":
            with candado: self.responder(200, dict(estado, ahora=time.time()))
        else: super().do_GET()

    def do_POST(self):
        if self.path == "/api/modelo":
            with candado:
                if estado["estado"] == "corriendo": return self.responder(409, dict(error="El modelo ya se está corriendo"))
            problemas = revisar()
            if problemas: return self.responder(400, dict(error="No se puede correr el modelo", problemas=problemas))
            actualizar(estado="corriendo", celda=0, total=0, seccion="", mensaje="Iniciando", inicio=time.time(), fin=None, log=[])
            threading.Thread(target=correr, daemon=True).start()
            self.responder(202, dict(ok=True))
        elif self.path == "/api/modelo/detener":
            p = proceso
            if estado["estado"] != "corriendo" or p is None: return self.responder(409, dict(error="No hay una corrida en curso"))
            actualizar(estado="detenido", mensaje="Corrida detenida; el sitio no cambió", fin=time.time())
            p.terminate()
            self.responder(200, dict(ok=True))
        else: self.send_error(404)

    def log_message(self, fmt, *args):
        if not self.path.startswith("/api/"): super().log_message(fmt, *args)

if __name__ == "__main__":
    print(f"Sitio en http://{HOST}:{PUERTO}  |  Python del modelo: {PYTHON}")
    for p in revisar(): print("  aviso:", p)
    ThreadingHTTPServer((HOST, PUERTO), Manejador).serve_forever()
