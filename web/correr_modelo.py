# Ejecuta el notebook del modelo celda por celda e informa el avance como líneas JSON en stdout.
# Uso: python correr_modelo.py <notebook.ipynb> <salida.ipynb>
# Debe correrse con el Python que tiene las dependencias del modelo (numpy, geopandas, numba, ...).
import json, sys, pathlib, signal
import nbformat
from nbclient import NotebookClient
from nbclient.exceptions import CellExecutionError

def avisar(**datos):
    print(json.dumps(datos, ensure_ascii=False), flush=True)

signal.signal(signal.SIGTERM, lambda *_: sys.exit(143))   # «Detener»: sale apagando el kernel

entrada, salida = map(pathlib.Path, sys.argv[1:3])
nb = nbformat.read(entrada, as_version=4)
cliente = NotebookClient(nb, timeout=None, kernel_name="python3",
                         resources={"metadata": {"path": str(entrada.parent)}})

# Sección (último encabezado de markdown) de cada celda de código, para mostrarla en la web
codigo, seccion = [], ""
for i, celda in enumerate(nb.cells):
    if celda.cell_type == "markdown":
        for linea in celda.source.splitlines():
            if linea.startswith("#"):
                seccion = linea.lstrip("# ").strip()
                break
    elif celda.cell_type == "code":
        codigo.append((i, seccion))

codigo_salida = 0
with cliente.setup_kernel():
    for k, (i, sec) in enumerate(codigo, 1):
        avisar(celda=k, total=len(codigo), seccion=sec)
        try:
            cliente.execute_cell(nb.cells[i], i)
        except CellExecutionError as err:
            salidas = [o for o in nb.cells[i].get("outputs", []) if o.get("output_type") == "error"]
            detalle = f"{salidas[0]['ename']}: {salidas[0]['evalue']}" if salidas else str(err).splitlines()[0]
            avisar(error=detalle, celda=k, seccion=sec)
            codigo_salida = 1
            break

nbformat.write(nb, salida)
sys.exit(codigo_salida)
