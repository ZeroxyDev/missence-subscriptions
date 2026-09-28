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

Después de `UpdateOrder`, el webhook relee el pedido sin espera y verifica cantidades, SKUs, precios y el ajuste fiscal aplicado. Si la actualización todavía no aparece en Bigblue, devuelve `503`. Esta comprobación confirma el estado inmediato; una sincronización posterior desde Shopify puede modificarlo otra vez. Para garantizar la persistencia a largo plazo hace falta una cola durable y una reconciliación posterior de pedidos pendientes.

El residuo de `additional_tax` de un céntimo solo se limpia cuando la suma de las líneas finales y otros cargos de Bigblue, sin ese residuo, coincide exactamente con `total_price` de Shopify. Si el webhook no proporciona el total o hay otros cargos que no se pueden conciliar, se conserva el valor original.

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
adjustment_detected
adjustment_planned
already_adjusted
update_verified
update_not_persisted
updated
update_failed
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
