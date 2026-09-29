# MISSENCE Subscriptions

Aplicación Next.js para la experiencia web de MISSENCE y la integración logística Shopify → Bigblue del primer envío de determinadas suscripciones.

Shopify sigue siendo la fuente de verdad comercial. La integración no modifica pedidos, contratos de suscripción, precios, descuentos, pagos ni fulfillment orders de Shopify. Solo ajusta la copia logística de Bigblue antes de que el pedido alcance `PREPARED`.

## Stack

- Next.js 16 con App Router y Route Handlers.
- React 19 y TypeScript estricto.
- Tailwind CSS v4 con tokens de marca en `app/globals.css`.
- `tsx` y `node:test` para tests TypeScript.
- `@clack/prompts` para el CLI del proyecto.

## Puesta en marcha

```bash
pnpm install
cp .env.example .env
pnpm dev
```

El repositorio también funciona con npm. El CLI detecta el gestor desde el que se ejecuta.

## CLI MISSENCE

Abre el menú interactivo:

```bash
pnpm missence
```

También acepta comandos directos:

```bash
pnpm missence dev
pnpm missence typecheck
pnpm missence lint
pnpm missence test
pnpm missence check
pnpm missence dry-run
pnpm missence build
pnpm missence --help
```

`check` ejecuta tipos, lint y tests sin hacer una build. La build queda reservada para la validación final o CI.

`dry-run` comprueba las reglas configuradas y hace una consulta `ListOrders` de una sola página a Bigblue. Es estrictamente de solo lectura: no llama a `UpdateOrder` ni muestra información de pedidos.

## Variables de entorno

```env
SHOPIFY_WEBHOOK_SECRET=
SHOPIFY_STORE_DOMAIN=missence.com
SHOPIFY_PUBLIC_ACCESS_TOKEN=
SHOPIFY_PRIVATE_ACCESS_TOKEN=
SHOPIFY_ACCESS_TOKEN=
SHOPIFY_ADMIN_STORE_DOMAIN=
RECONCILIATION_CRON_SECRET=
BIGBLUE_API_KEY=
BIGBLUE_WEBHOOK_KEY=
```

- `SHOPIFY_WEBHOOK_SECRET`: client secret de la app Shopify utilizado para verificar `X-Shopify-Hmac-SHA256`. Por compatibilidad también se admite el nombre actual `SHOPIFY_WEBHOOK_KEY`.
- `SHOPIFY_STORE_DOMAIN`: dominio usado para consultar Storefront API. Si se omite, utiliza `missence.com`.
- `SHOPIFY_PRIVATE_ACCESS_TOKEN`: token privado de Storefront API utilizado únicamente en servidor para comprobar la conexión con Shopify.
- `SHOPIFY_PUBLIC_ACCESS_TOKEN`: token público disponible para futuros usos en cliente; el flujo actual no lo necesita.
- `SHOPIFY_ACCESS_TOKEN`: token de Admin GraphQL API con permiso `read_orders` para reconciliar los pedidos recientes. No es el token privado de Storefront. También se admite `SHOPIFY_ADMIN_ACCESS_TOKEN` como alternativa.
- `SHOPIFY_ADMIN_STORE_DOMAIN`: dominio permanente `*.myshopify.com` de la tienda si `SHOPIFY_STORE_DOMAIN` es un dominio público. Si `SHOPIFY_STORE_DOMAIN` ya es `cy6gdd-q8.myshopify.com`, se reutiliza y esta variable no hace falta.
- `RECONCILIATION_CRON_SECRET`: secreto aleatorio que debe enviar el cron externo como `Authorization: Bearer <secreto>`.
- `BIGBLUE_API_KEY`: API key enviada como `Authorization: Bearer ...` a la Store API.
- `BIGBLUE_WEBHOOK_KEY`: clave que se usa para derivar un token exclusivo para la URL del webhook de Bigblue. Debe tener el mismo valor en local y Vercel. La clave original nunca se introduce en la URL.

Los secretos solo se leen en módulos de servidor y nunca se incluyen en logs.

## Integración Shopify → Bigblue

```text
Shopify orders/create
        ↓
verificación HMAC sobre raw body
        ↓
detección SKU + variant ID
        ↓
Bigblue ListOrders + retry corto
        ↓
estado final idempotente
        ↓
Bigblue UpdateOrder
```

### Endpoint

```text
POST /api/webhooks/shopify/orders-create
```

El Route Handler utiliza el runtime Node.js porque la verificación requiere `node:crypto`. Lee primero `request.text()`, valida el HMAC con comparación timing-safe y solo después parsea el JSON.

También exige:

```text
X-Shopify-Topic: orders/create
```

### Parejas configuradas

| Pareja | Rol | SKU | Product ID | Variant ID |
| --- | --- | --- | ---: | ---: |
| `MISS_0002_0004` | Suscripción | `MISS-000000-0002` | `10791019643207` | `53887845564743` |
| `MISS_0002_0004` | Experiencia | `MISS-000000-0004-UP` | `10987479859527` | `54579708854599` |
| `MISS_0002_0004` | Reemplazo | `MISS-000000-0004` | `10897754554695` | `54311286243655` |
| `MISS_0001_0003` | Suscripción | `MISS-000000-0001` | `10790886310215` | `54328475517255` |
| `MISS_0001_0003` | Experiencia | `MISS-000000-0003-UP` | `10987460002119` | `54579583025479` |
| `MISS_0001_0003` | Reemplazo | `MISS-000000-0003` | `10897753637191` | `54311284736327` |

Se tienen que encontrar simultáneamente el SKU y el Product ID de ambos productos. Cuando hay un Variant ID confirmado también se valida. `variantId: null` desactiva únicamente esa comprobación adicional; no relaja la coincidencia de SKU y producto. La experiencia solo aparece en el checkout inicial o cuando el cliente vuelve a suscribirse; su presencia junto a la suscripción es el marcador del primer envío. Una renovación automática solo contiene la suscripción y se ignora.

### Regla de cantidad

```ts
targetQuantity = Math.max(
  shopifySubscriptionQuantity - shopifyExperienceQuantity,
  0,
);
```

Cada unidad de experiencia contiene una unidad del producto, por lo que resta una unidad de la línea de suscripción. La cantidad objetivo siempre se deriva del webhook de Shopify, nunca de `bigblueCurrentQuantity - experienceQuantity`. Por eso repetir el mismo evento converge al mismo estado.

Si el objetivo es cero se elimina la línea logística; no se envía `quantity: 0`. Si Bigblue ya tiene la cantidad objetivo, o la línea ya está ausente cuando el objetivo es cero, no se llama a `UpdateOrder`.

### Reemplazo de experiencias para fulfillment

Cada experiencia define su reemplazo de forma explícita en `config/subscription-product-pairs.ts`. No se deduce a partir de `-UP` ni de ningún otro patrón: el SKU, el Product ID y el Variant ID pueden ser distintos para cada pareja.

El comportamiento se activa o desactiva globalmente en `config/fulfillment-settings.ts`:

```ts
replaceExperienceSku: true
```

Cuando está activo, la copia logística de Bigblue utiliza siempre el SKU configurado en `experience.replacement`, exista o no el SKU original en Bigblue:

- La experiencia recibe su importe de Shopify más el importe de las unidades de suscripción incluidas dentro de ella. Así, retirar unidades logísticas no reduce el total económico.
- Los precios, impuestos y descuentos de ambas líneas se calculan desde el webhook, incluso si Bigblue ya tiene un reemplazo con un precio distinto (por ejemplo, 1 €). Si Shopify informa precios con impuestos incluidos, se separan en el `unit_price` neto y el `unit_tax` que espera Bigblue, sin sumar el impuesto dos veces.
- Los reintentos comparan cantidades e importes y no acumulan el valor transferido.
- Los logs de planificación incluyen precios, impuestos y descuentos para comprobar el resultado.

Este cambio solo afecta al fulfillment en Bigblue. El pedido, el SKU, los precios, los impuestos y los descuentos originales permanecen intactos en Shopify.

### Sincronización y retry

Bigblue puede importar el pedido después de que Shopify entregue el webhook. `ListOrders` busca por:

```ts
[shopifyOrder.name, String(shopifyOrder.id)].includes(
  String(bigblueOrder.external_id),
)
```

Bigblue guarda actualmente el número visible de Shopify, por ejemplo `#1026`, como `external_id`. También se conserva el ID interno como alternativa para que la búsqueda funcione si cambia la configuración de la integración.

Se usa una ventana de una hora a ambos lados de `created_at` y paginación con `next_page_token`. El webhook hace una búsqueda inmediata: si Bigblue todavía no muestra el pedido, devuelve `503` para que Shopify vuelva a entregar el evento. Shopify exige responder en cinco segundos; por eso las llamadas a Bigblue comparten un plazo de cuatro segundos. Shopify limita los reintentos; si se agotan, hace falta una recuperación manual.

Después de `UpdateOrder`, el webhook relee el pedido sin espera y verifica cantidades, SKUs, precios, moneda y **el `total` que Bigblue devuelve** contra `total_price` de Shopify. Si la actualización todavía no aparece en Bigblue o el total difiere aunque sea un céntimo, devuelve `503`: nunca registra el pedido como correcto. Esta comprobación confirma el estado inmediato; una sincronización posterior desde Shopify puede modificarlo otra vez. La reconciliación programada vuelve a comparar los pedidos recientes con Shopify y reaplica el estado deseado mientras Bigblue siga en `PENDING`.

### Reconciliación programada (necesaria en producción)

La ruta `POST /api/cron/reconcile-bigblue` requiere `Authorization: Bearer <RECONCILIATION_CRON_SECRET>`. Consulta por Admin GraphQL los pedidos de las últimas 48 horas que incluyen una de las experiencias configuradas, descarta pedidos cancelados o ya procesados y ajusta los que Bigblue tenga en `PENDING`. También reevalúa pedidos editados si todavía conservan la pareja configurada. Es idempotente: si el pedido sigue correcto, no escribe. Si un pedido falla, devuelve `503` y registra `reconciliation_failed`; el siguiente ciclo vuelve a intentarlo.

En Vercel Hobby configura un cron externo, por ejemplo cada cinco minutos, para enviar una petición `POST` a `https://<tu-dominio>/api/cron/reconcile-bigblue` con esa cabecera. No basta con desplegar el código: hay que configurar en Vercel `SHOPIFY_ACCESS_TOKEN`, `SHOPIFY_STORE_DOMAIN=cy6gdd-q8.myshopify.com` (o `SHOPIFY_ADMIN_STORE_DOMAIN`) y `RECONCILIATION_CRON_SECRET`, y crear el cron externo con el mismo secreto. El token necesita permiso `read_orders`. Usa un secreto largo y no lo pongas en la URL. Supervisa las respuestas distintas de `200` y el evento `reconciliation_finished`.

Si Bigblue prepara un pedido antes del siguiente ciclo, la ruta lo omite por seguridad y no puede corregirlo automáticamente; en ese caso hay que detener la preparación y resolverlo con Bigblue. Si una edición elimina la pareja de productos, no hay una transformación segura y el pedido requiere revisión manual.

### Webhooks de cambios de pedido en Shopify

La ruta `POST /api/webhooks/shopify/order-events` recibe **`orders/updated` y `orders/edited`**. Verifica el HMAC, el tema y el dominio de la tienda. Después obtiene por Admin GraphQL el estado **actual** del pedido concreto (el payload de `orders/edited` solo contiene el cambio), usando `currentQuantity` y `currentTotalPriceSet` para no confundir unidades retiradas ni importes originales con los vigentes. Los impuestos y descuentos de líneas editadas se prorratean, pero **solo** se escribe en Bigblue si el total planificado cuadra exactamente con el total vigente de Shopify. Comprueba o corrige Bigblue mientras siga en `PENDING`. Si Bigblue aún no tiene el pedido o la reconciliación falla, devuelve `503` para reintentar. Los eventos de pedidos cancelados o ya enviados no modifican Bigblue. Si una edición quita la pareja, registra `manual_review_required`.

Estos eventos ayudan a detectar cambios en Shopify, pero no garantizan detectar una reversión interna de Bigblue que no cambie Shopify. Por eso el cron externo sigue siendo necesario como verificación periódica.

### Webhook de Bigblue (complementario)

En la pantalla de Bigblue selecciona **Order Status Update**, nunca **Inventory Update**. El Target URL apunta al receptor `POST /api/webhooks/bigblue/order-status`. Bigblue solo pide una URL, así que se añade un token de acceso derivado de `BIGBLUE_WEBHOOK_KEY` a esa URL; el receptor lo compara antes de hacer cualquier consulta. Para generar la URL completa **en tu equipo**, sin publicar la clave original:

```bash
node --env-file=.env --import tsx scripts/print-bigblue-webhook-url.mjs https://missence.vercel.app
```

Copia la URL resultante en **Target URL** y elige **Order Status Update** en **Event Type**. Trata la URL generada como un secreto: no la compartas en chats ni la registres en logs públicos. Configura `BIGBLUE_WEBHOOK_KEY`, `SHOPIFY_ACCESS_TOKEN`, `SHOPIFY_STORE_DOMAIN` y `BIGBLUE_API_KEY` en Vercel antes de activarlo. Un `GET` autenticado responde `200` para comprobación; cada `POST` autenticado lanza la reconciliación idempotente contra Shopify.

Este evento está documentado como actualización de *estado*, no como actualización de las líneas del pedido. No hay confirmación de que Bigblue lo emita cuando revierte solo la cantidad manteniendo el estado `PENDING`: por tanto el webhook **no sustituye** el cron externo como garantía. Una prueba real con una reversión y sus logs es necesaria para saber si en esta tienda sirve de disparador suficiente.

### Comprobación exacta del precio

Antes de enviar `UpdateOrder`, se comprueba que el total de la tienda y el importe en la moneda del cliente (*presentment*) de Shopify coinciden; si hay conversión de moneda o diferencia, se detiene el ajuste en lugar de declarar un precio falso. Después se suman en céntimos las líneas finales, los impuestos, el envío, `additional_tax` y los descuentos tal como Bigblue calcula `total`. La operación solo se envía si esa suma coincide exactamente con el total de Shopify. Tras actualizar se comprueban **dos importes**: el total recalculado desde las líneas que Bigblue guardó y el campo `total` devuelto por Bigblue. Ambos deben ser idénticos a Shopify, con la misma moneda. Un pedido aparentemente ajustado también se relee y valida; si `total` está desfasado, se fuerza una nueva actualización y se verifica.

El residuo de `additional_tax` de un céntimo solo se limpia si eso deja el total exactamente igual al de Shopify. No se añade ningún cargo, descuento o “céntimo de compensación” inventado para tapar un descuadre. Si falta un total verificable o los importes no cuadran, se registra `price_mismatch`/`update_not_persisted` y se devuelve `503` para que se investigue o se reintente, sin afirmar éxito.

### Payload de UpdateOrder

Bigblue requiere el pedido completo dentro de:

```json
{
  "order": {
    "id": "...",
    "external_id": "...",
    "line_items": []
  }
}
```

El payload se reconstruye con una allowlist de campos editables del modelo CreateOrder/UpdateOrder. No se reenvían propiedades de respuesta como `status`, `store`, `submit_time`, `total`, tracking, paquetes o fulfillments.

### Respuestas principales

- `200`: ignorado, ya ajustado o actualizado correctamente.
- `400`: topic o payload Shopify inválido.
- `401`: HMAC Shopify inválido.
- `502`: error permanente de Bigblue.
- `503`: Bigblue no está listo, rate limit, timeout, fallo de red o respuesta inválida reintentable.

### Logs

Los logs estructurados utilizan el nombre `bigblue_subscription_adjustment` y los eventos:

```text
ignored_no_pair
invalid_shopify_hmac
bigblue_not_ready
bigblue_order_found
bigblue_webhook_received
adjustment_detected
adjustment_planned
already_adjusted
update_verified
update_not_persisted
price_mismatch
price_verified
updated
update_failed
reconciliation_skipped
reconciliation_failed
reconciliation_finished
reconciliation_configuration_error
invalid_shopify_topic
invalid_shopify_payload
```

`ignored_no_pair` incluye un resumen de las líneas recibidas y, para cada pareja, los valores esperados frente a las líneas con el mismo SKU. Esto permite distinguir rápidamente un SKU ausente de un Product ID o Variant ID incorrecto. `adjustment_planned` registra las líneas, cantidades e importes antes y después del plan, sin datos personales.

`update_verified` confirma el estado releído inmediatamente desde Bigblue. `update_not_persisted` indica que el estado leído todavía no coincide con el ajuste y que la petición terminó con `503` para provocar un reintento.

Solo incluyen contexto operativo como IDs, pareja, SKU, cantidades, importes, estados y códigos de error. No registran credenciales, nombres, correos ni direcciones de clientes.

## Configuración en Shopify

Registrar una suscripción webhook con:

```text
Topic: orders/create
Format: JSON
URL: https://<dominio>/api/webhooks/shopify/orders-create
```

Añadir **dos suscripciones más**, ambas en JSON y ambas con la misma URL nueva:

```text
Topic: orders/updated
URL: https://missence.vercel.app/api/webhooks/shopify/order-events

Topic: orders/edited
URL: https://missence.vercel.app/api/webhooks/shopify/order-events
```

No apuntar `orders/create` a esta URL; conserva su receptor actual. Activa las dos suscripciones nuevas **solo después de desplegar la ruta**.

Antes de producción:

1. Confirmar que `SHOPIFY_WEBHOOK_SECRET` corresponde al client secret de la app que firma el webhook.
2. Ejecutar un pedido combinado de prueba por cada pareja.
3. Verificar que Shopify conserva todas sus líneas y cantidades.
4. Verificar que Bigblue elimina o reduce únicamente la línea de suscripción y utiliza el reemplazo configurado para la experiencia.
5. Confirmar que precio, impuestos y descuento de la experiencia se conservan en la línea reemplazada.
6. Reenviar el mismo webhook y confirmar `alreadyAdjusted` sin líneas duplicadas.
7. Probar una renovación sin experiencia y confirmar `no_matching_pair`.

## Frontend

La portada presenta el estado y el alcance de la integración con el sistema visual de MISSENCE:

- Paleta y medidas centralizadas como custom properties.
- Utilidades Tailwind `bg-missence-accent`, `text-missence-muted`, `rounded-missence-sm`, etc.
- Interfaz interna minimalista, responsive y sin apariencia de ecommerce.
- Rosa reservado para el estado y las señales funcionales; gris, negro y bordes para la estructura.
- Portada sencilla para identificar la aplicación y comprobar que está activa.
- Portada renderizada en servidor con un pequeño componente cliente para actualizar el estado.

Los logos de la aplicación se sirven desde `public/brand`.

## Estructura relevante

```text
app/
  api/health/route.ts
  api/webhooks/shopify/orders-create/route.ts
  globals.css
  layout.tsx
  page.tsx
components/operations/
config/
  fulfillment-settings.ts
  shopify.ts
  site.ts
  server-env.ts
  subscription-product-pairs.ts
lib/
  bigblue/
  health/
  observability/
  shopify/
  subscriptions/
scripts/
  missence.ts
tests/
```

## Verificación

```bash
pnpm missence check
pnpm missence build
```

La suite cubre detección de parejas, renovaciones, mismatch de variantes, cálculo absoluto, eliminación de líneas, reemplazo explícito de experiencias, conservación de valores económicos, idempotencia, HMAC, validación de payload Shopify, paginación Bigblue y sanitización de UpdateOrder.

## Referencias

- [Shopify: verificar entregas de webhooks](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries)
- [Shopify: webhooks de pedidos](https://shopify.dev/docs/agents/orders/order-webhooks)
- [Bigblue Store API](https://bigblue.notion.site/Bigblue-Store-API-Documentation-4e9c3d052a1a4b73b59709edfe8b7457)
