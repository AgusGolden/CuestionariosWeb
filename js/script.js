import { obtenerCuestionarios, guardarCuestionarios } from './storage.js';

document.addEventListener('DOMContentLoaded', () => {
  const btnExportar = document.getElementById('btn-exportar');
  const btnImportar = document.getElementById('importarDatos');
  const inputImportar = document.getElementById('input-importar');

  btnExportar.addEventListener('click', () => {
    const cuestionarios = obtenerCuestionarios();
    const dataStr = JSON.stringify(cuestionarios, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup-cuestionarios.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  btnImportar.addEventListener('click', () => {
    const file = inputImportar.files[0];
    if (!file) {
      alert('Por favor selecciona un archivo JSON para importar.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data)) throw new Error('Formato inválido');
        guardarCuestionarios(data);
        alert('Importación exitosa');
        location.reload();
      } catch (error) {
        alert('Error al importar el archivo: ' + error.message);
      }
    };
    reader.readAsText(file);
  });
});
