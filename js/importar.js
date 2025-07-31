import { guardarTodoStorage } from './storage.js';

document.addEventListener('DOMContentLoaded', () => {
  const inputImportar = document.getElementById('input-importar');
  const btnImportar = document.getElementById('importarDatos');

  if (!btnImportar || !inputImportar) return;

  btnImportar.addEventListener('click', () => {
    inputImportar.click();
  });

  inputImportar.addEventListener('change', (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;

    const lector = new FileReader();
    lector.onload = (event) => {
      try {
        const datos = JSON.parse(event.target.result);
        if (typeof datos !== 'object' || datos === null) {
          alert('El archivo no contiene un JSON válido.');
          return;
        }

        guardarTodoStorage(datos);
        alert('Datos importados correctamente.');
        location.reload();
      } catch (err) {
        alert('Error al importar datos: ' + err.message);
      }
    };

    lector.readAsText(archivo);
  });
});