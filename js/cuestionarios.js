import { obtenerCuestionarios } from './storage.js';

document.addEventListener('DOMContentLoaded', () => {
  const selectCuestionario = document.getElementById('lista-cuestionarios');
  const contenedorPreguntas = document.getElementById('contenedor-preguntas');

  const cuestionarios = obtenerCuestionarios();

  cuestionarios.forEach((cuestionario, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = cuestionario.nombre;
    selectCuestionario.appendChild(option);
  });

  selectCuestionario.addEventListener("change", () => {
    const seleccion = selectCuestionario.value;
    if (seleccion === "") {
      contenedorPreguntas.innerHTML = "";
      return;
    }

    const preguntas = cuestionarios[seleccion].preguntas;
    contenedorPreguntas.innerHTML = "";

    preguntas.forEach((preg, i) => {
      const div = document.createElement("div");
      div.classList.add("pregunta");

      const numero = document.createElement("div");
      numero.classList.add("numero");
      numero.textContent = `Pregunta ${i + 1}`;
      div.appendChild(numero);

      const titulo = document.createElement("div");
      titulo.classList.add("titulo");
      titulo.textContent = preg.texto || "Sin texto";
      div.appendChild(titulo);

      const tipo = document.createElement("div");
      tipo.classList.add("tipo");
      tipo.innerHTML = `<strong>Tipo:</strong> ${preg.tipo}`;
      div.appendChild(tipo);

      if (preg.tipo === "multiple") {
        const opciones = document.createElement("ul");
        opciones.classList.add("opciones");
        preg.opciones.forEach(op => {
        const li = document.createElement("li");
        li.innerHTML = `
            <input type="checkbox" disabled ${op.esCorrecta ? "checked" : ""}>
            <label>${op.texto}</label>
        `;
        
        if (op.esCorrecta) {
            li.classList.add("opcion-correcta");
        }

        opciones.appendChild(li);
        });

        div.appendChild(opciones);
      }

      if (preg.tipo === "desarrollar" && preg.respuesta) {
        const respuesta = document.createElement("div");
        respuesta.classList.add("respuesta");
        respuesta.innerHTML = `<strong>Respuesta esperada:</strong> ${preg.respuesta}`;
        div.appendChild(respuesta);
      }

      contenedorPreguntas.appendChild(div);
    });
  });
});
