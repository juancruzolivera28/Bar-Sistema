# Kairo CRM: Fase 0 (plan técnico y plan de diseño)

Estado: propuesta, esperando visto bueno. No hay código de producto todavía.
Decisiones y supuestos: ver `DECISIONES.md`.

---

## 1. Plan técnico

### 1.1 Repositorio y estructura

Kairo CRM es un producto aparte de Vuelos Bar. Va en su propio repositorio
(ver pregunta bloqueante 1). Estructura:

```
kairo-crm/
  apps/web/                     React + Vite + TypeScript (PWA)
    src/app/                    router, layout, proveedores
    src/features/hoy|clientes|empresa|aprobaciones|agentes|ajustes|documentos
    src/components/ui/          shadcn/ui (Radix) adaptados al sistema visual
    src/lib/                    cliente Supabase, consultas (TanStack Query), textos
  supabase/
    migrations/                 esquema, RLS, triggers, roles de agentes, vistas
    seed/demo.sql               20 empresas ficticias (es_demo = true)
    tests/                      tests SQL (RLS, transiciones, permisos de agentes)
    functions/
      _shared/                  AgentRunner, cliente Claude, acceso a datos con
                                lista de permitidos, esquemas zod, costos
      agente-requerimientos/    Fase 2
      agente-cotizacion/        Fase 3
      agente-prospeccion/       Fase 4
  config/precios-modelos.json   USD por millón de tokens, editable
  DECISIONES.md  README.md  .env.example
```

### 1.2 Frontend

- React + Vite + TypeScript estricto, react-router, TanStack Query.
- Tailwind CSS + shadcn/ui (Radix) solo para primitivas accesibles (diálogo,
  menú, pestañas, interruptor, tooltip). Estilo propio, no el tema por defecto.
- dnd-kit para el tablero (con alternativa por menú y por teclado).
- Recharts solo para el embudo y la barra de gasto (o SVG propio si alcanza:
  son dos gráficos simples, se decide al construir por peso del bundle).
- lucide-react para íconos. vite-plugin-pwa (ya lo usás en Vuelos Bar).
- Fuentes Inter y JetBrains Mono autoalojadas (paquetes @fontsource), así la
  PWA funciona sin conexión y no depende de Google Fonts.
- Realtime de Supabase para el estado de los agentes y el contador de
  Aprobaciones.
- Versiones exactas: se verifican contra npm al instalar, no se asumen.

### 1.3 Backend (Supabase)

**Esquema:** el del Apéndice A, con estos agregados:

- Triggers `actualizada_en` / `actualizado_en`.
- `etapa_desde timestamptz` en `empresas` (para "días en la etapa") y tabla
  `eventos_empresa` (línea de tiempo: cambio de etapa, nota, mensaje, etc.),
  alimentada por triggers. Así la línea de tiempo y el "deshacer etapa" salen
  de un solo lugar.
- Índices por `owner_id`, `empresa_id`, `etapa`, `estado`.
- Vista `gasto_ia_mes` (suma de `costo_usd` del mes en curso, con
  `security_invoker = true` para que respete RLS).
- Vista `respuestas_por_senal` ("Qué señal funciona").
- Restricción: un mensaje necesita `texto_baja` incluido (se valida en la app
  y con un check en la función del agente; en la base se valida que el cuerpo
  no esté vacío).

**Máquina de estados de `mensajes`** (trigger `before update`):

```
pendiente  -> aprobado | rechazado
aprobado   -> enviado | pendiente   (deshacer aprobación, mientras no se envió)
enviado    -> respondido
rechazado  -> pendiente             (solo si cambia asunto o cuerpo)
```

Cualquier otra transición: error con mensaje claro. Las fechas
`aprobado_en`, `enviado_en`, `respondido_en` las pone el trigger.
`alcances` y `propuestas`: `pendiente -> aprobado | rechazado`,
`rechazado -> pendiente` solo con contenido editado.

**Guardia "un agente no aprueba a otro"** (más estricta que el ejemplo del
Apéndice A): en vez de prohibir solo `service_role`, se permite únicamente a la
persona dueña:

```
transición a aprobado/enviado/respondido/rechazado, o cambio de precio_final
  => permitido solo si current_user = 'authenticated'
     y auth.uid() = owner_id de la fila
```

Eso bloquea la clave de servicio, los roles de agentes y cualquier otro rol.

**Permisos mínimos por agente (lo resuelvo en Fase 1, aunque los agentes
lleguen después):**

- Un rol de Postgres por agente: `agente_prospeccion`, `agente_requerimientos`,
  `agente_cotizacion`, cada uno con su propia contraseña (su "propia clave").
- GRANTs mínimos: prospección `insert/select` en `empresas`, `senales`,
  `mensajes`; requerimientos `select` en notas de su empresa e `insert` en
  `alcances`; cotización `select` en `alcances` aprobados de su empresa,
  `configuracion` (tarifa) y `proyectos_referencia`, `insert` en `propuestas`.
  Todos `insert` en `corridas_agente`/`acciones_agente` (solo su propio
  `agente`). Ninguno tiene `update` sobre `estado` ni `precio_final`.
- Políticas RLS para esos roles que limitan a `owner_id` y, para
  requerimientos y cotización, a la `empresa_id` de la corrida (variables de
  sesión fijadas por la función después de verificar el JWT del dueño).
- Además, una lista de permitidos en el código de `_shared` (doble barrera).
- Tests SQL que prueban que cada rol falla al escribir donde no debe y al
  intentar aprobar.

La conexión de las Edge Functions con esos roles (vía el pooler de Supabase)
se verifica contra la documentación en la Fase 2; si no fuera posible, el plan
B está en `DECISIONES.md` (D-07).

**Auth:** un solo usuario dueño con email y contraseña (mismo patrón que Vuelos
Bar, con recuperación de contraseña). Enlace mágico opcional. Registro abierto
deshabilitado en el panel después de crear la cuenta (paso en el README).

### 1.4 Agentes (Fases 2 a 4, para que la Fase 1 deje el lugar listo)

- Interfaz `AgentRunner` en `_shared`: `run(entrada) -> resultado`, con los 8
  pasos de la sección 7 del brief (verificar sesión, chequear pausa y topes,
  abrir corrida, llamar a Claude con salida estructurada, escribir con lista
  de permitidos, registrar acciones, registrar costo, cerrar corrida).
  Migrar a Claude Agent SDK o n8n después solo cambia la implementación.
- SDK oficial `@anthropic-ai/sdk` en Deno, salida estructurada con
  `output_config.format` + validación zod antes de guardar.
- Modelos por variable de entorno (verificados hoy, 10/11/2026):
  `CLAUDE_MODEL_REDACCION=claude-sonnet-5-5` (USD 2 / 10 por millón de tokens
  de entrada / salida) y `CLAUDE_MODEL_CLASIFICACION=claude-haiku-5-5`
  (USD 0,10 / 0,50 hasta 100K tokens de prompt). Precios en
  `config/precios-modelos.json`.
- Texto externo (webs, respuestas de clientes) siempre en un bloque marcado
  como dato no confiable; el agente no tiene herramientas que envíen nada.
- Límite de frecuencia por función (tabla de corridas recientes por dueño).

### 1.5 Calidad y tests

- `lint`, `typecheck`, `build` en verde; Vitest para la app (componentes de
  aprobación, reglas de mensajes, formateo, glosario sin jerga).
- Tests SQL contra Postgres 16 local con un esquema `auth` simulado
  (`auth.uid()`, `auth.role()`, `auth.users`), corridos con un script
  `npm run test:db`. Cubren: RLS entre dos dueños, transiciones válidas e
  inválidas, guardia de aprobación (dueño sí, service_role no, roles de agentes
  no), `precio_final`, `no_contactar`.
- Test de humo con Playwright: login demo, abrir Aprobaciones, aprobar con la
  tecla A, ver "Aprobado".
- Lighthouse de accesibilidad (objetivo 95 o más) a 375 px.

### 1.6 Entregable de la Fase 1

Migraciones + RLS + triggers + roles de agentes + tests SQL; app con Hoy,
Clientes (tablero y lista), Ficha, Aprobaciones, Agentes (tarjetas sin agentes
reales, botón "Ejecutar" deshabilitado con explicación), Ajustes; carga manual
de empresas y de mensajes de prueba; datos de demo con botón para borrarlos;
onboarding de 3 pasos; aviso legal la primera vez que se aprueba; PWA.
Criterio: cargás 20 empresas a mano y aprobás un mensaje de prueba.

---

## 2. Plan de diseño

### 2.1 Idea central

El CRM se lee como **un escritorio de trabajo con una pila de papeles por
firmar**, no como un panel de métricas. Todo lleva a una pregunta: ¿qué tengo
que decidir hoy? La audacia va en dos lugares y el resto queda quieto:

1. **Aprobaciones**: cada borrador se muestra como **una carta sobre papel**
   (fondo blanco, ancho de lectura, tipografía de texto cómoda) con una
   **nota al margen** que explica el porqué: la señal, el dato en mono, la
   fuente y la fecha. El "por qué" no es una etiqueta: es la anotación que el
   dueño haría en lápiz. En celular, la nota al margen pasa arriba de la carta.
2. **Hoy**: una sola frase grande con el número en JetBrains Mono naranja
   ("**3** cosas esperan tu aprobación") y un botón. Debajo, todo en gris y
   en tamaño normal.

### 2.2 Paleta

| Uso | Color |
| --- | --- |
| Fondo | `#FDFDFC` |
| Superficie (carta, paneles) | `#FFFFFF` |
| Texto | `#171717` |
| Texto secundario | `#5F5F5B` |
| Bordes y divisores | `#E7E5E0` |
| Acento (solo acción o atención) | `#F5820A` |

Contraste (calculado con la fórmula WCAG): el naranja `#F5820A` sobre blanco
da 2,60:1, **no llega a AA ni para texto grande** (pide 3:1). Propuesta:

- Botón principal: fondo `#F5820A` con texto `#171717` (6,90:1, pasa AA).
- Naranja como texto sobre blanco (el número de "Hoy", enlaces de acción):
  `#B45A00`, misma familia, 4,77:1 (pasa AA).
- El `#F5820A` puro queda para rellenos (botón, barra de gasto, punto del
  contador), nunca como texto sobre claro.
- Texto secundario `#5F5F5B` sobre fondo: 6,30:1, pasa.

Etapas (color + ícono + texto, nunca solo color). Uso los colores del brief
para el punto y el borde del chip; el texto del chip va en `#171717` para
garantizar AA:

| Etapa | Color | Ícono (lucide) |
| --- | --- | --- |
| Nuevo | `#8A8F98` | `Circle` |
| Contactado | `#3B82C4` | `Send` |
| Respondió | `#7C5CC4` | `MessageCircle` |
| Reunión | `#1AA6A6` | `CalendarDays` |
| Alcance | `#C99A06` | `FileText` |
| Propuesta | `#F5820A` | `Receipt` |
| Ganado | `#2E9E5B` | `CheckCircle2` |
| Perdido | `#B5483F` | `XCircle` |

Contraste de los colores de etapa sobre blanco: reunión `#1AA6A6` (2,98:1),
alcance `#C99A06` (2,59:1) y propuesta `#F5820A` (2,60:1) quedan por debajo
de 3:1. Como el significado lo llevan también el ícono y el texto, no es un
bloqueo, pero para íconos y bordes uso una variante más oscura de esos tres
(se fija al construir y se verifica con la misma fórmula); el color original
queda para el punto de relleno.

Nota: "Propuesta" comparte color con el acento. Para que no se confunda con
"requiere acción", el chip de Propuesta usa el ícono y un fondo muy claro, y
nunca el botón sólido.

Modo oscuro opcional: mismas tintas invertidas (fondo `#141413`, superficie
`#1C1C1A`, texto `#EDEDEA`), acento sin cambios.

### 2.3 Tipografía

- Inter para toda la interfaz. Escala: 13 / 15 / 17 / 22 / 32 px. Cuerpo 15
  en compu, 16 en celular (evita zoom en iOS en campos de texto).
- JetBrains Mono solo para datos: cifras, fechas, segundos de carga, horas,
  precios, dominios de fuente. Ejemplo: "tarda **7,2 s** en cargar".
- Carta de Aprobaciones: Inter 17 px, interlineado 1,6, ancho máximo de 68
  caracteres.
- Títulos en oración normal, sin mayúsculas sostenidas ni etiquetas encima.

### 2.4 Layout y navegación

Compu (barra lateral fija de 220 px):

```
┌──────────────┬───────────────────────────────────────────────────┐
│ Kairo        │                                                   │
│              │   (contenido, ancho máximo 1080 px)               │
│ Hoy          │                                                   │
│ Clientes     │                                                   │
│ Aprobaciones 3                                                   │
│ Agentes      │                                                   │
│ Ajustes      │                                                   │
│              │                                                   │
│ ──────────── │                                                   │
│ IA: 4 de 20  │  <- medidor de gasto, siempre visible             │
│ [ Pausar ]   │  <- interruptor general                           │
└──────────────┴───────────────────────────────────────────────────┘
```

Celular (375 px): barra superior mínima con el medidor de gasto y el botón de
pausa como ícono con texto corto "Pausar"; barra inferior con los 5 ítems
(ícono + texto) y el contador en Aprobaciones. Cuando los agentes están
pausados, una franja fina arriba en toda la app: "Agentes en pausa. Nada se
ejecuta. [Reanudar]".

### 2.5 Wireframes

**A) Hoy**

```
Buen día, Alexis                                   martes 10/11

  3 cosas esperan tu aprobación              [ Revisar ahora ]
  2 mensajes · 1 alcance

Tus clientes potenciales
  Nuevo        12  ████████████
  Contactado    5  █████
  Respondió     2  ██
  Reunión       2  ██
  Alcance       1  █
  Propuesta     1  █
  Ganado        0
  Perdido       1  █

Enviados hoy: 2 de 10

Qué hicieron los agentes                         ver todo ->
  hoy 09:14  Prospección encontró 8 empresas en Posadas
  ayer       Requerimientos armó el alcance de Taller Ríos (demo)

Gasto de IA este mes      USD 4,20 de 20   ██████░░░░░░░░░░

Qué señal funciona
  Sitio lento        6 enviados · 2 respondieron
  Sin sitio web      4 enviados · 0 respondieron
```

Una sola acción principal (Revisar ahora). El embudo es una lista con barras,
no un gráfico de embudo decorativo. Si no hay nada pendiente, la frase cambia
a "Nada espera tu aprobación" y la acción principal pasa a "Cargar una
empresa".

**B) Clientes (compu)**

```
Clientes potenciales         [Tablero | Lista]   [ + Cargar empresa ]
Filtrar: Zona [Todas v]  Rubro [Todos v]  Señal [Todas v]  Buscar [    ]

Nuevo 12      Contactado 5   Respondió 2   Reunión 2   Alcance 1 ...
┌──────────┐  ┌──────────┐
│Panadería │  │Ferretería│
│Don Luis  │  │El Tornillo│
│[Sitio    │  │[Sin sitio]│
│ lento]   │  │ 4 días    │
│ 2 días   │  └──────────┘
│     ...  │  <- menú "Mover a..." en cada tarjeta
└──────────┘
```

Columnas con desplazamiento horizontal propio (no de la página). En celular:
lista agrupada por etapa con un selector de etapa arriba.

**C) Ficha de empresa**

```
<- Clientes
Panadería Don Luis  [demo]
[● Nuevo]  Posadas · Panadería                [ Mover de etapa v ]

Próximo paso: aprobar el mensaje borrador        [ Ir al mensaje ]

Señales                               Línea de tiempo
  Sitio lento: 7,2 s en celular         10/11 09:14  Señal detectada
  PageSpeed · 10/11/2026 · fuente ↗     10/11 09:15  Mensaje borrador
  ¿Es correcta? [Sí] [No]               09/11        Empresa cargada

[ Mensajes ]  [ Alcance ]  [ Propuesta ]  [ Datos ]
  ...

No contactar  (con motivo)
```

**D) Aprobaciones (pantalla estrella)**

```
Aprobaciones · 3 pendientes        [Todo | Mensajes | Alcances | Propuestas]
                                   1 de 3   J siguiente · K anterior

  Por qué                       ┌──────────────────────────────────────┐
  Su sitio tarda                │ Para: info@panaderiadonluis.com.ar   │
  7,2 s                         │ Asunto: Una mejora rápida para la    │
  en cargar en celular.         │ web de la panadería                  │
                                │                                      │
  PageSpeed Insights            │ Hola, soy Alexis de Kairo Software.  │
  10/11/2026                    │ Vi que la web de la panadería tarda  │
  ver fuente ↗                  │ unos 7 segundos en abrir desde el    │
                                │ celular...            (editable)     │
  Panadería Don Luis (demo)     │                                      │
  Posadas · Nuevo               │ Cómo conseguimos tu contacto: ...    │
                                │ Para no recibir más mensajes: ...    │
                                └──────────────────────────────────────┘

              [ Rechazar  R ]   [ Editar  E ]   [ Aprobar  A ]
```

Al aprobar, la misma tarjeta cambia a:

```
  Aprobado. Ahora envialo vos.
  [ Copiar mensaje ]  [ Abrir en mi correo ]  [ Marcar como enviado ]
  Deshacer aprobación
```

Toques para aprobar: abrir Aprobaciones (1) y Aprobar (2). Con teclado: A.
Rechazar pide un motivo opcional (chips: "Dato equivocado", "Tono", "No es
para ellos") que alimenta el aprendizaje de señales, y se puede deshacer.
La primera aprobación muestra el aviso legal (una vez).

**E) Agentes**

```
Equipo de agentes

┌ Prospección ─────────────────┐ ┌ Requerimientos ─────────┐ ┌ Cotización ...
│ Descansando                  │ │ Llega en la Fase 2      │
│ Última tarea: hace 2 días    │ │                         │
│ Gasto del mes: USD 1,10      │ │                         │
│ [Pausado o]  [ Ejecutar ]    │ │                         │
└──────────────────────────────┘ └─────────────────────────┘

Actividad
  hoy 09:14  Prospección encontró 8 empresas en Posadas        v
             Con qué datos: rubro Panaderías, zona Posadas
             Costo: USD 0,04 · 12.300 tokens
```

**F) Ajustes**: una sola columna, secciones con título y explicación de una
línea: Qué buscamos (rubro, zona), Topes, Precios (tarifa, moneda), Mensajes
(firma, texto de baja con vista previa), Señales (interruptores con "Hipótesis"
o "Con fuente" al lado), Proyectos de referencia, Claves (Configurada / Falta),
Datos de demostración (Borrar).

**G) Documento de alcance / propuesta**: vista de documento de ancho de
lectura, selector de versión ("Versión 2 de 3"), botón "Comparar con la
anterior" (diferencias resaltadas), y en propuesta el campo "Precio final"
con la nota "Solo lo definís vos".

### 2.6 Componentes y movimiento

- Tarjetas planas con borde de 1 px, sin sombra. La única superficie con
  sombra suave es la carta de Aprobaciones (es papel encima del escritorio).
- Botones: principal (fondo acento, texto oscuro), secundario (borde), y
  terciario (texto). Altura mínima 44 px en celular.
- Foco visible: anillo de 2 px `#171717` con separación de 2 px.
- Movimiento solo como respuesta: la carta aprobada se desliza a un lado y
  entra la siguiente (150 ms); la tarjeta arrastrada en el tablero; el
  despliegue de una actividad. Con `prefers-reduced-motion`, todo es corte
  directo.
- Avisos (toasts) cortos con el mismo verbo del botón y "Deshacer".

### 2.7 Revisión contra el look de "plantilla SaaS" y qué corregí

Primera versión que descarté, y por qué:

| Lo genérico que apareció | Qué cambié |
| --- | --- |
| Hoy con 4 tarjetas de KPI iguales (empresas, mensajes, respuestas, gasto) con sombra | Una frase con un número y un botón; el resto como lista sobria. Un solo foco. |
| Etiquetas en mayúsculas chicas encima de cada sección ("PIPELINE", "ACTIVIDAD") | Títulos en oración normal y en español del dueño ("Tus clientes potenciales"). |
| Embudo gráfico con degradado | Barras horizontales planas con el número en mono. |
| Tarjetas de Aprobaciones como items de una tabla con botones chicos | La carta en papel con nota al margen y tres botones grandes. |
| Chips de etapa solo de color | Punto de color + ícono + texto oscuro. |
| Naranja en todo lo "importante" (enlaces, íconos, títulos) | Naranja solo en la acción principal y en lo que pide atención. |
| Animación de entrada en cada tarjeta al cargar | Sin animaciones de entrada; solo respuesta a acciones. |
| Avatares/robots para los agentes | Nombre del agente y estado en texto con ícono simple. |

### 2.8 Glosario aplicado a la interfaz

Clientes potenciales, Etapas, Tarea del agente, Borrador, Aprobaciones,
Actividad, Señal, Fuente, Alcance, Propuesta, Precio final. Nunca: lead,
pipeline, run, job, draft, webhook, token, payload. Excepción acotada: en el
detalle de costo de una actividad aparece "tokens" como dato técnico de
consumo; propongo reemplazarlo por "consumo de IA" y mostrar los números
solo al expandir.

### 2.9 Onboarding (3 pasos, una vez)

1. "Los agentes preparan, vos decidís": qué hace cada uno en una línea.
2. "Así se aprueba": captura de la carta con los tres botones y las teclas.
3. "Si algo no te cierra, pausá todo": señala el botón Pausar.
