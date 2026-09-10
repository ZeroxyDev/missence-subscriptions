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
BIGBLUE_API_KEY=
BIGBLUE_WEBHOOK_KEY=
```

- `SHOPIFY_WEBHOOK_SECRET`: client secret de la app Shopify utilizado para verificar `X-Shopify-Hmac-SHA256`. Por compatibilidad también se admite el nombre actual `SHOPIFY_WEBHOOK_KEY`.
- `SHOPIFY_STORE_DOMAIN`: dominio usado para consultar Storefront API. Si se omite, utiliza `missence.com`.
- `SHOPIFY_PRIVATE_ACCESS_TOKEN`: token privado de Storefront API utilizado únicamente en servidor para comprobar la conexión con Shopify.
- `SHOPIFY_PUBLIC_ACCESS_TOKEN`: token público disponible para futuros usos en cliente; el flujo actual no lo necesita.
- `BIGBLUE_API_KEY`: API key enviada como `Authorization: Bearer ...` a la Store API.
- `BIGBLUE_WEBHOOK_KEY`: shared secret para verificar futuros webhooks entrantes de Bigblue. No se usa en el flujo Shopify → Bigblue. El nombre existente `BIGBLUE_WEBHOOKE_KEY` puede permanecer mientras no recibamos esos webhooks.

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

| Pareja | Suscripción | Variant | Experiencia | Variant |
| --- | --- | ---: | --- | ---: |
| `MISS_0002_0004` | `MISS-000000-0002` | `10791019643207` | `MISS-000000-0004-UP` | `10987479859527` |
| `MISS_0001_0003` | `MISS-000000-0001` | `10790886310215` | `MISS-000000-0003-UP` | `10987460002119` |

Se tienen que encontrar simultáneamente el SKU y el variant ID de ambos productos. La experiencia solo aparece en el checkout inicial o cuando el cliente vuelve a suscribirse; su presencia junto a la suscripción es el marcador del primer envío. Una renovación automática solo contiene la suscripción y se ignora.

### Regla de cantidad

```ts
targetQuantity = Math.max(
  shopifySubscriptionQuantity - shopifyExperienceQuantity,
  0,
);
```

Cada unidad de experiencia contiene una unidad del producto, por lo que resta una unidad de la línea de suscripción. La cantidad objetivo siempre se deriva del webhook de Shopify, nunca de `bigblueCurrentQuantity - experienceQuantity`. Por eso repetir el mismo evento converge al mismo estado.

Si el objetivo es cero se elimina la línea logística; no se envía `quantity: 0`. Si Bigblue ya tiene la cantidad objetivo, o la línea ya está ausente cuando el objetivo es cero, no se llama a `UpdateOrder`.

### Sincronización y retry

Bigblue puede importar el pedido después de que Shopify entregue el webhook. `ListOrders` busca por:

```ts
String(bigblueOrder.external_id) === String(shopifyOrder.id)
```

Se usa una ventana de una hora a ambos lados de `created_at`, paginación con `next_page_token` y backoff `0, 1, 2, 4, 8` segundos. Cada petición tiene un timeout de dos segundos y `Retry-After` queda limitado a ocho segundos para mantener el procesamiento alrededor de los 25 segundos máximos.

Si el pedido todavía no aparece se devuelve `503`, permitiendo el reintento de Shopify. Para más volumen, el siguiente paso arquitectónico es sustituir el retry dentro del request por una cola durable y responder `2xx` inmediatamente después de encolar.

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
already_adjusted
updated
update_failed
```

Solo incluyen contexto operativo como IDs, pareja, SKU, cantidades y códigos de error. No registran credenciales ni direcciones de clientes.

## Configuración en Shopify

Registrar una suscripción webhook con:

```text
Topic: orders/create
Format: JSON
URL: https://<dominio>/api/webhooks/shopify/orders-create
```

Antes de producción:

1. Confirmar que `SHOPIFY_WEBHOOK_SECRET` corresponde al client secret de la app que firma el webhook.
2. Ejecutar un pedido combinado de prueba por cada pareja.
3. Verificar que Shopify conserva todas sus líneas y cantidades.
4. Verificar que Bigblue elimina o reduce únicamente la línea de suscripción.
5. Reenviar el mismo webhook y confirmar `alreadyAdjusted`.
6. Probar una renovación sin experiencia y confirmar `no_matching_pair`.

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

La suite cubre detección de parejas, renovaciones, mismatch de variantes, cálculo absoluto, eliminación de líneas, idempotencia, HMAC, validación de payload Shopify, paginación Bigblue y sanitización de UpdateOrder.

## Referencias

- [Shopify: verificar entregas de webhooks](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries)
- [Shopify: webhooks de pedidos](https://shopify.dev/docs/agents/orders/order-webhooks)
- [Bigblue Store API](https://bigblue.notion.site/Bigblue-Store-API-Documentation-4e9c3d052a1a4b73b59709edfe8b7457)
