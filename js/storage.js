export function obtenerCuestionarios() {
  try {
    const data = JSON.parse(localStorage.getItem('cuestionarios'));
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.cuestionarios)) return data.cuestionarios;
  } catch {}
  return [];
}

export function guardarCuestionarios(data) {
  // data es un array de cuestionarios
  if (!Array.isArray(data)) throw new Error("El parámetro debe ser un array");

  localStorage.setItem('cuestionarios', JSON.stringify(data));
}

export function obtenerTodoStorage() {
  const obj = {};
  for (const key of Object.keys(localStorage)) {
    try {
      obj[key] = JSON.parse(localStorage.getItem(key));
    } catch {
      obj[key] = localStorage.getItem(key);
    }
  }
  return obj;
}

export function guardarTodoStorage(obj) {
  localStorage.clear();
  for (const [clave, valor] of Object.entries(obj)) {
    localStorage.setItem(clave, JSON.stringify(valor));
  }
}