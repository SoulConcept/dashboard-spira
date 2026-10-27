# SPIRA Talks

Fuente: https://www.youtube.com/playlist?list=PLFXSG0xBg5S9yx4loZHUBVfgaoyqw33gx

## Activación

1. En un proyecto de Google Cloud, activar YouTube Data API v3, YouTube Analytics API y YouTube Reporting API.
2. Crear un cliente OAuth y autorizar la cuenta propietaria del canal con acceso offline y los scopes `https://www.googleapis.com/auth/youtube.readonly` y `https://www.googleapis.com/auth/yt-analytics.readonly`. Guardar el refresh token únicamente como secreto. No usar una cuenta de servicio.
3. Configurar GitHub Secrets: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN, YOUTUBE_CHANNEL_ID. Opcional YOUTUBE_SPIRA_TALKS_PLAYLIST_ID (la playlist suministrada es el valor predeterminado).
4. Ejecutar el workflow `spira-talks.yml`, revisar el resultado y verificar el JSON servido por Vercel. Un fallo mantiene los episodios y updatedAt anteriores, con metadata.stale=true.
5. La automatización existente de Codex debe invocar `gh workflow run spira-talks.yml --repo SoulConcept/dashboard-spira --ref main` después de publicar Notion. Esperar el resultado, verificar el commit resultante y Vercel. Si main cambia durante el proceso, reejecutar desde main actual. No existe un segundo cron. Los fallos de YouTube no revierten ni bloquean la actualización de Notion.

## Metodología y cobertura

Solo vídeos de la playlist pertenecientes al canal autorizado, on-demand (sin liveStreamingDetails), duración mínima 600 segundos y publicación desde el 13/01/2026. No se usa la fecha de incorporación a la playlist. Las ventanas comprenden el día de publicación y los siguientes 6/29/59 días de YouTube (America/Los_Angeles), no intervalos exactos de 168/720 horas. Se aplica un corte conservador de tres días por latencia de Analytics. Los episodios cuya ventana no está completa quedan marcados como parciales y fuera del ranking de 30 días.

KPI y tabla muestran acumulados hasta el corte de Analytics. La línea del gráfico utiliza retención de los mismos primeros 30 días que las barras. Retención y duración media se ponderan por views; CTR por impresiones. Los filtros siempre seleccionan episodios por publicación, no actividad del mes.

Reporting crea automáticamente un job channel_reach_basic_a1 si falta. El primer informe puede tardar días y solo recupera unos 30 días previos a la creación del job. No se inventan impresiones históricas. El JSON conserva las filas diarias de alcance de los episodios y reemplaza los días revisados por backfill. El CTR y las impresiones llevan una cobertura independiente visible. CSV es el formato oficial de descarga automática de Reporting; nunca requiere cargas manuales.

No se han cargado las cifras de referencia del brief como métricas de producción. Falta el export original para conciliar títulos, fechas y corte con los 12 episodios / 6.936 views de referencia. Los totales actuales pueden diferir al tener otro corte temporal.

Pruebas: `node --test scripts/test-spira-talks.mjs`.
Documentación: https://developers.google.com/youtube/analytics/channel_reports ; https://developers.google.com/youtube/reporting/v1/reports ; https://developers.google.com/youtube/reporting/v1/reports/channel_reports
