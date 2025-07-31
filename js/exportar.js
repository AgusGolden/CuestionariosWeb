import { obtenerTodoStorage } from './storage.js';

document.addEventListener('DOMContentLoaded', () => {
  const btnExportar = document.getElementById('btn-exportar');
  if (!btnExportar) return;

  btnExportar.addEventListener('click', () => {
    const datos = obtenerTodoStorage();

    const blob = new Blob([JSON.stringify(datos, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup-localStorage.json';
    a.click();
    URL.revokeObjectURL(url);
  });
});