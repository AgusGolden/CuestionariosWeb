# Cuestionarios

App web para estudiar con tus propias preguntas, sin ver la respuesta antes de tiempo.
Es HTML, CSS y JavaScript sin dependencias: abrí `index.html` en el navegador (doble clic alcanza) o publicala en GitHub Pages.

## Qué hace

- **Biblioteca**: tus cuestionarios agrupados por materia, con progreso, preguntas para repasar hoy, racha y mapa de actividad.
- **Tres modos de estudio**
  - *Repaso inteligente*: repaso espaciado (sistema de cajas). Primero lo que te toca repasar, después lo nuevo; lo que errás vuelve al final de la sesión.
  - *Práctica libre*: al azar, con corrección inmediata.
  - *Simulacro de examen*: sin correcciones hasta el final, navegación libre y tiempo límite opcional.
- **Sin espiar**: la respuesta no está en la página hasta que la pedís.
  - Múltiple choice: marcás y comprobás; ves aciertos, errores y las correctas que te faltaron.
  - Desarrollo: escribís tu respuesta, la revelás, la comparás con la esperada (se resaltan las palabras clave que mencionaste) y te autoevaluás.
- **Repasar falladas**, marcar preguntas, filtrar por nuevas, falladas o marcadas, y combinar varios cuestionarios en una sesión.
- **Editor**: búsqueda, filtro de preguntas con problemas (por ejemplo, sin opción correcta), reordenar, duplicar, deshacer al borrar, explicación opcional y `Ctrl+S`.
- **Importación**: backups `.json` (también los de la versión anterior), un JSON pegado o texto plano. Incluye instrucciones listas para pedirle a una IA que genere preguntas desde tus apuntes.
- Tema claro y oscuro, funciona en el celular, atajos de teclado (`?` para verlos).

## Formato de texto para pegar preguntas

```
¿Qué capa del modelo OSI se encarga del enrutamiento?
- Enlace de datos
+ Red
- Transporte

Explicá qué es el DOM.
R: Es la representación en árbol del documento HTML,
que permite modificarlo desde JavaScript.
E: (opcional) explicación que se muestra al responder
```

`+` marca una opción correcta y `-` una incorrecta. Cada pregunta se separa de la siguiente con una línea en blanco.

## Datos

Todo se guarda en el `localStorage` del navegador:

| Clave | Contenido |
| --- | --- |
| `cuestionarios` | Array de cuestionarios (mismo formato que la versión anterior) |
| `cuestionarios.progreso` | Progreso por pregunta, actividad diaria e historial de sesiones |
| `cuestionarios.sesion` | Sesión en curso, para poder retomarla |
| `cuestionarios.prefs` | Preferencias (tema, última configuración, fecha del último backup) |

El progreso se identifica por el contenido de cada pregunta. Así, una pregunta que aparece en varios cuestionarios comparte el progreso, y al reimportar un backup no se pierde lo estudiado.

Formato de un cuestionario:

```json
{
  "idCuestionario": 1755000939974,
  "nombre": "Clase 1",
  "materia": "MDW",
  "fechaCreacion": "2025-08-12T12:00:00.000Z",
  "preguntas": [
    { "tipo": "multiple", "texto": "¿…?", "opciones": [{ "texto": "…", "esCorrecta": true }] },
    { "tipo": "desarrollar", "texto": "…", "respuesta": "…", "explicacion": "opcional" }
  ]
}
```

## Estructura

```
index.html
css/app.css
js/util.js            utilidades (DOM, iconos, diálogos, avisos)
js/store.js           datos, progreso, repaso espaciado e importación
js/app.js             rutas (#/...), tema y atajos globales
js/views/*.js         una vista por pantalla
backups/              backups de cuestionarios
```
