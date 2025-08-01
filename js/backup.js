import {
  obtenerCuestionarios,
  guardarCuestionarios,
  guardarTodoStorage
} from './storage.js';

document.addEventListener('DOMContentLoaded', () => {
  const btnExportar = document.getElementById('btn-exportar');
  const btnImportar = document.getElementById('importarDatos');
  const inputImportar = document.getElementById('input-importar');

  if (!btnExportar || !btnImportar || !inputImportar) return;

  // Exportar cuestionarios
  btnExportar.addEventListener('click', () => {
    const cuestionarios = obtenerCuestionarios();
    const dataStr = JSON.stringify(cuestionarios, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    
    const now = new Date();
    const fecha = 
    now.getFullYear() + '_' +
    String(now.getMonth() + 1).padStart(2, '0') + '_' +
    String(now.getDate()).padStart(2, '0') +
    ' - ' +
    String(now.getHours()).padStart(2, '0') + '_' +
    String(now.getMinutes()).padStart(2, '0');

    const nombreArchivo = `Backup JSON (${fecha}).json`;
    a.download = nombreArchivo;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // Abrir selector de archivo
  btnImportar.addEventListener('click', () => {
    inputImportar.click();
  });

  // Leer archivo JSON importado
  inputImportar.addEventListener('change', (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;

    const lector = new FileReader();
    lector.onload = (event) => {
      try {
        const datos = JSON.parse(event.target.result);

        if (Array.isArray(datos)) {
          guardarCuestionarios(datos);
          alert('✅ Cuestionarios importados correctamente.');
        } else if (typeof datos === 'object' && datos !== null) {
          guardarTodoStorage(datos);
          alert('✅ Datos completos importados correctamente.');
        } else {
          throw new Error('❌ Formato no reconocido.');
        }

        location.reload();
      } catch (error) {
        alert('❌ Error al importar: ' + error.message);
      }
    };

    lector.readAsText(archivo);
  });
});
