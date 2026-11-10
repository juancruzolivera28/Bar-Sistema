# Decisiones de Kairo CRM

Registro de decisiones y supuestos. Cada una dice qué se decidió, por qué y si
el dueño tiene que confirmarla. Lo que no está verificado va marcado.

| Id | Decisión | Motivo | Estado |
| --- | --- | --- | --- |
| D-01 | CRM propio sobre Supabase (no Twenty, EspoCRM ni HubSpot). | Lo central es la cola de aprobación y el registro de agentes; ningún CRM lo trae. Stack conocido. | Recomendado por la definición; a confirmar |
| D-02 | Repositorio propio para Kairo CRM, separado de Vuelos Bar. Mientras tanto, los documentos de Fase 0 viven en `kairo-crm/` de este repo. | Productos, datos y despliegues distintos. | Pregunta bloqueante 1 |
| D-03 | Proyecto de Supabase nuevo, separado del de Vuelos Bar. | Aislar datos y claves; un error en uno no toca al otro. | Pregunta bloqueante 2 |
| D-04 | Agentes en Supabase Edge Functions detrás de una interfaz `AgentRunner`. | Valor por defecto de la definición; permite migrar a Claude Agent SDK o n8n. | Por defecto |
| D-05 | El CRM nunca envía: "Copiar mensaje", "Abrir en mi correo" (`mailto:`), "Marcar como enviado". | Regla de la definición y de la ley. | Firme |
| D-06 | Guardia de aprobación por lista blanca: solo `current_user = 'authenticated'` y `auth.uid() = owner_id` pueden pasar a aprobado/enviado/respondido/rechazado o escribir `precio_final`. | Más seguro que bloquear solo `service_role`: también bloquea roles de agentes y cualquier rol nuevo. | Por defecto (conservador) |
| D-07 | Un rol de Postgres por agente con su contraseña y GRANTs mínimos, más RLS por `owner_id` y `empresa_id`, más lista de permitidos en código. | "Cada agente tiene su propia clave" y "permisos mínimos", con barrera en la base y no solo en el código. **Sin verificar**: conexión de Edge Functions con roles propios vía el pooler de Supabase. Plan B: la función usa un cliente con el JWT del dueño y un RPC `security definer` por agente que solo inserta en sus tablas. Se verifica en Fase 2. | Por defecto; verificación pendiente |
| D-08 | Roles de agentes, GRANTs y sus tests se crean en Fase 1. | Barato y deja probada la regla "un agente no aprueba a otro" antes de que exista un agente. | Por defecto |
| D-09 | Modelos por variable de entorno: `claude-sonnet-5-5` para redactar, `claude-haiku-5-5` para clasificar. Precios en `config/precios-modelos.json`: Sonnet 5.5 USD 2 / 10 por millón (entrada / salida); Haiku 5.5 USD 0,10 / 0,50 hasta 100K tokens de prompt (0,50 / 2,50 por encima). | Verificado el 10/11/2026 en la referencia de la API de Anthropic. Hay que revisarlo antes de la Fase 2. | Verificado hoy |
| D-10 | Salida de los agentes con `output_config.format` (salida estructurada) y validación zod antes de guardar. | Punto 9 de controles. | Por defecto |
| D-11 | Tope de gasto mensual por defecto USD 20 (marcador), 20 empresas por corrida, 10 mensajes por día. | Valores de la definición. Editables en Ajustes. | Por defecto |
| D-12 | Autenticación con email y contraseña (con recuperación), enlace mágico opcional; registro abierto deshabilitado tras crear al dueño. | Mismo patrón que Vuelos Bar. | Por defecto |
| D-13 | Fuentes Inter y JetBrains Mono autoalojadas (@fontsource), no Google Fonts. | La PWA funciona sin conexión y no se envían datos a terceros. | Por defecto |
| D-14 | `#F5820A` solo como relleno; como texto sobre claro se usa `#B45A00` (4,77:1). | `#F5820A` sobre blanco da 2,60:1, no pasa AA. | Por defecto |
| D-15 | Tests SQL contra Postgres 16 local con un esquema `auth` simulado, sin Docker. | El entorno no tiene Docker; `supabase test db` lo necesita. Si tenés Supabase CLI local, los mismos archivos corren ahí. | Por defecto |
| D-16 | Se agrega `etapa_desde` a `empresas` y tabla `eventos_empresa` para la línea de tiempo y el "deshacer etapa". | El Apéndice A no tenía cómo calcular "días en la etapa" ni historia de etapas. | Por defecto |
| D-17 | Un mensaje `aprobado` puede volver a `pendiente` (deshacer) mientras no se marcó como enviado. | Principio de "deshacer cuando sea posible"; no rompe ninguna regla de envío. | Por defecto; a confirmar |
| D-18 | Rechazar pide un motivo opcional con opciones rápidas. | Sirve para aprender qué señal o tono falla. | Por defecto |
| D-19 | Moneda por defecto ARS; tarifa por hora vacía hasta que la cargues. | Cotización (Fase 3) no corre sin tarifa. | Por defecto |
| D-20 | Datos de demo: 20 empresas ficticias con nombres genéricos y dominios `.example`, marcadas `es_demo`, con botón para borrarlas. | No inventar datos de empresas reales. Los dominios `.example` están reservados y nunca son de nadie. | Firme |
| D-21 | Google Places: solo `google_place_id`. Términos vigentes de Google Maps Platform y cuota de PageSpeed **sin verificar**; se revisan antes de la Fase 4. | La definición pide verificarlos antes de implementar. | Pendiente (Fase 4) |
| D-22 | Aviso legal (Ley 25.326 art. 27, Ley 26.951, consentimiento de WhatsApp) la primera vez que se aprueba un mensaje, con la recomendación de consultar a un abogado. | Requisito de la definición. No es asesoramiento legal. | Firme |
