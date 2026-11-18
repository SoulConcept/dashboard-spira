# Actualización diaria desde Notion

La tarea programada en Codex se ejecuta cada día a las 09:00 Europe/Madrid,
después de la tarea de inversión de las 08:00. Necesita el equipo encendido,
Codex abierto, la conexión de Notion y `gh` autenticado con acceso al repositorio.
Vercel despliega los commits de `main` mediante la integración existente.

## Fuentes y lectura

`scripts/notion_sources.json` contiene las seis vistas: leads y cinco tablas
de inversión (General, México, Colombia, Perú y CAM). No usar Total x País.
Usar el conector Notion: fetch de los esquemas, después query_data_sources
con `mode: view`, `page_size: 100`. Repetir cada vista con su `next_cursor`
como `start_cursor` hasta `has_more: false`. No usar SQL.

Guardar las respuestas completas programáticamente en un archivo temporal
fuera del repositorio. No copiar datos manualmente ni publicar las exportaciones.
Unir todas las páginas conservando todas las filas. El formato de entrada es:

```json
{
  "leads": {"results": [], "has_more": false},
  "investment": {
    "General": {"results": [], "has_more": false},
    "México": {"results": [], "has_more": false},
    "Colombia": {"results": [], "has_more": false},
    "Perú": {"results": [], "has_more": false},
    "CAM": {"results": [], "has_more": false}
  }
}
```

Los arrays del ejemplo deben contener las filas reales de Notion.

## Ejecución

1. Obtener el SHA actual de `main` con `gh api repos/SoulConcept/dashboard-spira/git/ref/heads/main --jq .object.sha`.
2. Descargar el repositorio en ese SHA en una carpeta temporal nueva.
3. Leer las seis fuentes y guardar el snapshot temporal completo.
4. Ejecutar `python3 scripts/sync_notion.py /ruta/snapshot.json --date YYYY-MM-DD`
   usando la fecha del día en Europe/Madrid.
5. Ejecutar `python3 -m unittest discover -s scripts -p 'test_*.py'` y
   `node --check assets/js/data.js`. Comparar los totales y la cantidad de filas
   con Notion. Si hay una caída inexplicada de filas, datos inválidos o una
   lectura incompleta, detener la publicación y avisar.
6. Publicar solamente los datos con
   `python3 scripts/publish_data.py --expected-head SHA --message "Actualiza datos de Notion YYYY-MM-DD" assets/js/data.js`.
   Si `main` cambió, descargar la nueva versión y repetir transformación y validación.
7. Consultar el estado de Vercel asociado al nuevo commit y comprobar el archivo
   `/assets/js/data.js` del sitio de producción. No anunciar éxito del despliegue
   hasta verificarlo. No forzar actualizaciones de rama.

## Reglas conservadas

- Los indicadores visibles se calculan en `dashboard.js` desde
  `commercial.opportunities`, `investment.history` y `investment.countryHistory`.
- Solo cuentan como leads las filas con Empresa, País y fecha
  de envío a comercial completos. Las filas vacías o incompletas se excluyen de
  opportunities y de todos los indicadores; no se borran de Notion. Comercial,
  origen, estado y valores monetarios pueden estar pendientes y no son requisitos.
  La numeración es opcional siempre. Si falta Número, se usa la URL estable de
  la página de Notion como identificador. Un identificador no convierte una fila
  vacía en un lead válido.
- El mes comercial procede de la fecha de envío a comercial. No se inventan fechas.
- Informar usableLeadRows como leads, nunca sourceRows. sourceRows es el total
  bruto; blankRows, incompleteRows y excludedRows explican las exclusiones.
- Ecuador y Estados Unidos se asignan a Colombia, siguiendo la versión existente.
  Centroamérica se agrupa como CAM. Un país sin correspondencia detiene la publicación.
- Los estados siguen las notas de https://app.notion.com/p/302662d9fcba8005aba2ebb9a905f89d.
  Leer esta página en cada sincronización. Usar Etapa (dashboard) y Motivo (dashboard).
  Si el conector entrega referencias formulaResult://, usar Etapa y Motivo de caída.
  Sin etapa, solo se admite la traducción conocida Pendiente Asignación → 1;
  cualquier otra traducción histórica desconocida bloquea la publicación.
  Estado se conserva como historicalStatus, sin dirigir los indicadores.
- Etapas: 1 pendiente asignación; 2 sin contacto; 3 contactado/agendando;
  4 reunión/necesidades; 5 propuesta en preparación; 6 propuesta final con importe;
  7 negociación; 8 ganado; 9 perdido; 10 descartado/no calificaba.
  Etapa 6 sin importe positivo pasa a 5. Motivo solo se conserva en 9 y 10.
  Pipeline activo: etapas 6 y 7 con importe. Ganado: etapa 8. Perdido: etapa 9;
  descartados no se confunden con perdidos. Los importes no determinan por sí solos el estado.
- Perù se normaliza a Perú conservando rawCountry. Las notas de comité y la fecha
  de sincronización Ropofy contextualizan la información; no inventar estados o fechas.
  Google/Pago, formularios recibidos y todos los leads son universos distintos.
  No copiar los totales narrativos de la página como cifras actuales.
- El presupuesto ausente usa el último presupuesto de un mes anterior de la misma
  tabla, incluso del año anterior. Un presupuesto cero es válido. Sin antecedente,
  se detiene la actualización. `Leads #` ausente queda en null.
- Se mantienen los valores numéricos de Notion sin redondear antes del cálculo.
- Las estructuras heredadas de resumen y referencias manuales se conservan;
  no son la fuente de los gráficos dinámicos. No actualizar las métricas de
  `digital-data.js`, cuyo origen GA4/YouTube/LinkedIn es independiente.
- La fecha de sincronización acredita la lectura de Notion, no que la otra tarea
  haya actualizado la inversión a las 08:00. No hay señal automática de finalización.

No guardar tokens ni exportaciones completas de Notion en el repositorio.
