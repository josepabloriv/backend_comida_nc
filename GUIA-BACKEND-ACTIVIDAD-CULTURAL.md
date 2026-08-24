# GUÍA BACKEND — ACTIVIDAD CULTURAL

> **Documento fuente de verdad del proyecto.**
> Este archivo rige toda decisión de arquitectura, reglas de negocio y estructura de código del backend. Ninguna conversación futura debe contradecirlo. Cualquier cambio a lo aquí definido (nombres de tablas, RPC, relaciones, reglas financieras) requiere **autorización explícita** antes de implementarse.

---

## 1. Descripción general

Sistema de control de pagos para una **actividad cultural de un centro educativo**. Permite registrar anticipos hacia una cuota cultural fija, vender platos extra, emitir y validar comprobantes, generar y versionar códigos QR como boleto de acceso, y presentar reportes/dashboard de ingresos. Toda operación queda auditada con el usuario que la ejecutó.

No maneja roles: todo usuario autenticado tiene las mismas capacidades dentro del sistema.

---

## 2. Objetivos

- Controlar pagos de la cuota cultural (Q150) permitiendo anticipos parciales.
- Vender y controlar platos extra (Q40 c/u) de forma independiente a la cuota.
- Emitir un QR único y versionado por cuenta de estudiante, que se invalida automáticamente al regenerarse.
- Validar QR contra PostgreSQL en el momento del escaneo (nunca confiar en el contenido del QR).
- Emitir comprobantes con numeración oficial y dos copias visuales del mismo pago.
- Exponer un dashboard con ingresos, estado de cuotas y platos habilitados, alimentado por vistas de PostgreSQL.
- Mantener una auditoría básica: quién ejecutó cada pago y cada generación de QR.
- Entregar una API REST lista para ser consumida por un frontend React/Vite que **no** escribe directamente en Supabase.

---

## 3. Stack tecnológico

### Frontend (fase posterior, fuera de este documento salvo como consumidor de la API)
- React
- Vite
- Tailwind CSS
- Despliegue en Vercel

### Backend
- Node.js 18+
- Express.js
- JavaScript con **ES Modules** (no TypeScript, salvo solicitud explícita futura)
- API REST
- `@supabase/supabase-js`
- `dotenv`
- `cors`
- `helmet`
- `morgan`
- Middleware propio de autenticación
- Manejo centralizado de errores
- Git + GitHub
- Despliegue en Render

### Base de datos
- Supabase (PostgreSQL)
- Supabase Auth
- UUID como llave primaria/relacional
- Funciones RPC en PostgreSQL para toda escritura financiera
- Row Level Security (RLS)

---

## 4. Arquitectura

```text
React + Vite + Tailwind
          ↓
      API REST
          ↓
Node.js + Express
          ↓
Supabase JS
          ↓
Supabase Auth
          ↓
PostgreSQL
```

**Regla dura:** el frontend NUNCA realiza operaciones financieras directamente contra Supabase. Prohibido explícitamente:

```javascript
supabase.from('payments').insert(...)
```

Toda operación crítica sigue siempre:

```text
Frontend → Backend Express → RPC PostgreSQL → Supabase
```

### Responsabilidades por capa

**Frontend**
- Formularios, validaciones de UI, mostrar errores.
- Mostrar estudiantes, estado de cuenta, dashboard.
- Mostrar y escanear QR.
- Mostrar comprobantes y solicitar impresión.
- Nunca es una capa de seguridad.

**Backend (Express)**
- Autenticación y validación de JWT.
- Validación de entrada y sanitización.
- Control de flujo del proceso de negocio.
- Llamadas a RPC y consultas a vistas.
- Generación de la representación visual del QR.
- Preparación/generación de comprobantes.
- Manejo centralizado de errores y respuestas HTTP.
- Auditoría (propagación del usuario autenticado).
- Único canal entre frontend y Supabase para procesos críticos.

**PostgreSQL**
- Integridad referencial y UUID.
- Cuota máxima (Q150).
- Precio oficial de platos extra (Q40).
- Registro transaccional de pagos.
- Versionado e invalidación de QR (un único QR activo).
- Cálculos financieros, relaciones, restricciones e historial.

---

## 5. Reglas del negocio (INMUTABLES)

Estas reglas no se reinterpretan ni se cambian sin autorización explícita del usuario. Ver también sección 33.

1. La cuota cultural es **Q150.00** fija.
2. Se permiten anticipos (pagos parciales sucesivos) hacia la cuota.
3. La suma aplicada a cuota **nunca** puede superar Q150.
4. Completar Q150 da derecho a **3 platos base**.
5. Los 3 platos base **NO** se calculan como Q150 / 3 = Q50 c/u. La cuota cubre otros costos de la actividad (mobiliario, decoración, organización, etc.); los platos son un beneficio incluido, no una compra unitaria.
6. Cada **plato extra** cuesta **Q40.00** fijo, independiente de la cuota.
7. Mientras la cuota no llegue a Q150, los 3 platos base **no están habilitados** (0 platos base), aunque sí se cuentan los platos extra pagados.
8. Al completar Q150, los 3 platos base se habilitan y se suman a los extra ya pagados.
9. El precio de plato extra y el límite de cuota siempre provienen de PostgreSQL — nunca de un valor enviado por el frontend.
10. No existen roles: todo usuario autenticado tiene las mismas funciones.
11. Los estudiantes se relacionan internamente solo por `student_id` (UUID), nunca por nombre/apellido como FK.
12. Búsqueda de estudiante por `nombre`, `apellidos`, `grado`.
13. Todo pago se registra exclusivamente vía RPC `registrar_pago()`.
14. Cada pago genera automáticamente una nueva versión de QR.
15. Cada regeneración manual también genera una nueva versión de QR.
16. El QR anterior queda invalidado; solo el de mayor versión es válido.
17. Debe existir contador/historial de generaciones de QR.
18. El QR contiene como mínimo: token, versión, nombre del estudiante, grado, cantidad de platos — pero el contenido del QR nunca es la fuente de verdad: el token siempre se valida contra PostgreSQL.
19. Un pago genera **un único registro financiero** con dos copias visuales de comprobante (contribuyente / registro), nunca dos inserciones.
20. El frontend nunca escribe pagos directamente en la base de datos.

### Ejemplo de referencia (no reinterpretar)

```text
Cuota cultural:       Q150
Platos incluidos:        3

Platos extra:            2
Precio extra:          Q40
Extras: 2 × Q40 = Q80

Total económico: Q150 + Q80 = Q230
Total platos:     3 + 2 = 5
```

Anticipo antes de completar cuota:

```text
Cuota pagada: Q100   → Cuota: PENDIENTE
Saldo:         Q50
Extras:          2   → Platos base habilitados: 0
                       Platos extra:             2
                       Total actualmente habilitado: 2
```

Al completar Q150:

```text
Cuota: PAGADA
Platos base:  3
Extras:       2
Total:        5
```

---

## 6. Modelo de seguridad

- Helmet activo en toda la app.
- CORS restringido exclusivamente al `FRONTEND_URL` autorizado (Vercel/localhost dev).
- Todas las rutas protegidas exigen `Authorization: Bearer <access_token>` válido.
- Toda validación de payload ocurre en backend antes de llamar a un RPC.
- El backend nunca confía en: precio de plato, total calculado, versión de QR o token de QR enviados desde el frontend — todos esos valores se recalculan/verifican en PostgreSQL.
- `SUPABASE_SERVICE_ROLE_KEY` nunca se expone al frontend ni se sube a GitHub (`.env` en `.gitignore`).
- No se almacenan contraseñas propias; Supabase Auth es la única fuente de credenciales.
- No se permite SQL arbitrario construido a partir de parámetros de request; toda escritura pasa por RPC parametrizadas.
- En producción no se devuelven stack traces ni detalles internos del error al cliente.

---

## 7. Autenticación

- Autenticación 100% delegada a **Supabase Auth**.
- No se crea tabla propia de usuarios/contraseñas.
- No se usa `bcrypt` para las credenciales principales (las administra Supabase Auth).
- No existen roles: todo usuario autenticado tiene las mismas funciones.
- El usuario responsable de cada operación se identifica mediante `auth.uid()` en PostgreSQL, y ese UUID se almacena en pagos y generaciones de QR para auditoría.

---

## 8. Manejo de JWT (crítico)

Flujo de login:

```text
Frontend → Supabase Auth (directo o vía endpoint backend) → access_token
Frontend → Authorization: Bearer <access_token> en cada request protegida
```

Middleware `authenticate` (obligatorio) debe:

1. Extraer el Bearer Token del header `Authorization`.
2. Verificar el token contra Supabase.
3. Obtener el usuario correspondiente.
4. Colocar el usuario en `req.user`.
5. Crear/usar un cliente Supabase **asociado al JWT de ese usuario** (no solo `service_role`).

Justificación: las funciones RPC (`registrar_pago`, `regenerar_qr`, `validar_qr`) dependen de `auth.uid()`. Ejecutarlas únicamente con `service_role` sin propagar el JWT del usuario pierde el contexto de auditoría.

Separación conceptual obligatoria en `src/config/supabase.js`:

```text
supabaseAdmin  → cliente con service_role (uso interno controlado, nunca expuesto)
supabaseUser   → cliente creado por request, contextualizado con el JWT del usuario autenticado
```

Las operaciones `registrar_pago`, `regenerar_qr` y `validar_qr` deben ejecutarse siempre a través de `supabaseUser`, manteniendo el contexto de `auth.uid()`.

---

## 9. Base de datos existente

No renombrar, no recrear, no alterar relaciones sin autorización explícita. El backend se adapta a este esquema, no al revés.

### 10. Tablas existentes

```text
students
activities
activity_accounts
payments
qr_tickets
```

### 11. Funciones RPC existentes

```text
registrar_pago()
regenerar_qr()
validar_qr()
```

Función interna (no invocable desde frontend ni desde endpoints públicos):

```text
_crear_nueva_version_qr()
```

### 12. Vistas existentes

```text
v_estado_cuentas
v_qr_actual
v_historial_qr
v_comprobantes
v_dashboard_actividad
v_ingresos_diarios
v_ingresos_por_grado
```

Regla: aprovechar estas vistas para lectura; no duplicar sus cálculos en Node.js.

### Resolución de estudiante

Los estudiantes provienen de una BD central externa, que solo expone `nombre`, `apellidos`, `grado`. La nueva BD genera su propio UUID interno:

```text
Nombre + Apellidos + Grado → Búsqueda → student_id (UUID) → relaciones internas
```

A partir de la localización, toda relación interna usa exclusivamente `student_id`.

---

## 13. Arquitectura del backend

```text
route → controller → service → Supabase/RPC
```

Los controllers son delgados (parseo de request, llamada al service, formato de respuesta). La lógica de negocio de orquestación vive en services; las reglas financieras críticas viven en PostgreSQL.

## 14. Estructura de carpetas

```text
backend/
│
├── src/
│   ├── config/
│   │   ├── env.js
│   │   └── supabase.js
│   │
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── activities.controller.js
│   │   ├── students.controller.js
│   │   ├── payments.controller.js
│   │   ├── qr.controller.js
│   │   ├── receipts.controller.js
│   │   └── dashboard.controller.js
│   │
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── students.service.js
│   │   ├── payments.service.js
│   │   ├── qr.service.js
│   │   ├── receipts.service.js
│   │   └── dashboard.service.js
│   │
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── activities.routes.js
│   │   ├── students.routes.js
│   │   ├── payments.routes.js
│   │   ├── qr.routes.js
│   │   ├── receipts.routes.js
│   │   └── dashboard.routes.js
│   │
│   ├── middleware/
│   │   ├── authenticate.js
│   │   ├── errorHandler.js
│   │   ├── notFound.js
│   │   └── validateRequest.js
│   │
│   ├── validators/
│   │   ├── payment.validator.js
│   │   ├── auth.validator.js
│   │   └── qr.validator.js
│   │
│   ├── utils/
│   │   ├── apiResponse.js
│   │   ├── qrGenerator.js
│   │   └── receiptGenerator.js
│   │
│   ├── app.js
│   └── server.js
│
├── .env
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## 15. Variables de entorno

```env
PORT=3000
NODE_ENV=development
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
FRONTEND_URL=http://localhost:5173
```

`SUPABASE_SERVICE_ROLE_KEY` nunca se expone al frontend ni se sube a control de versiones.

## 16. Middleware

- `authenticate`: ver sección 8. Rechaza con `401` si no hay token o es inválido.
- `errorHandler`: middleware centralizado de errores (último en la cadena). Traduce errores de RPC/Postgres a respuestas HTTP entendibles (ver sección 26); nunca expone stack trace en producción.
- `notFound`: captura rutas no definidas → `404`.
- `validateRequest`: ejecuta los validators (payment/auth/qr) y responde `422`/`400` ante payload inválido antes de llegar al controller.

## 17. Servicios

Cada service encapsula la comunicación con Supabase (RPC o vistas) para su dominio y no contiene lógica financiera crítica (esa vive en PostgreSQL):

- `auth.service.js`: login vía Supabase Auth, obtención de usuario actual, logout.
- `students.service.js`: listado/búsqueda/filtro de estudiantes, consulta de `v_estado_cuentas`.
- `payments.service.js`: invocación de `registrar_pago()`, consulta de pagos e historial.
- `qr.service.js`: invocación de `regenerar_qr()` y `validar_qr()`, consulta de `v_qr_actual` / `v_historial_qr`, generación de imagen QR (utils/qrGenerator).
- `receipts.service.js`: preparación de datos desde `v_comprobantes`, generación de representación (y PDF opcional).
- `dashboard.service.js`: lectura de `v_dashboard_actividad`, `v_ingresos_diarios`, `v_ingresos_por_grado`.

## 18. Controllers

Reciben `req`/`res`, delegan al service correspondiente, y formatean la respuesta con `utils/apiResponse.js` según el estándar de la sección 25. No contienen cálculos financieros ni lógica de reglas de negocio.

## 19. Routes

Cada archivo de rutas monta su prefijo (`/api/auth`, `/api/students`, etc.), aplica `authenticate` donde corresponda y conecta con su controller. Ver mapa completo de endpoints en sección 20.

---

## 20. Endpoints

### Autenticación
```text
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
```

### Actividad
```text
GET /api/activities/active
```

### Estudiantes
```text
GET /api/students            (?search=, ?grado=)
GET /api/students/:id
GET /api/students/:id/account
```
La búsqueda contempla `nombre`, `apellidos`, `grado`.

### Pagos
```text
POST /api/payments
GET  /api/payments/:id
GET  /api/students/:studentId/payments
```

### Comprobantes
```text
GET /api/payments/:id/receipt
GET /api/payments/:id/receipt/pdf   (opcional, si se implementa PDF)
```

### QR
```text
GET  /api/qr/:accountId/current
GET  /api/qr/:accountId/history
POST /api/qr/:accountId/regenerate
POST /api/qr/validate
```

### Dashboard
```text
GET /api/dashboard
GET /api/dashboard/daily
GET /api/dashboard/by-grade
```
Filtros a soportar posteriormente: `fecha_inicio`, `fecha_fin`, `grado`, `actividad`.

---

## 21. Flujo de estudiantes

```text
GET /api/students?search=&grado=
        ↓
students.service → consulta filtrada por nombre/apellidos/grado
        ↓
Selección de estudiante → student_id (UUID)
        ↓
GET /api/students/:id/account → v_estado_cuentas
        ↓
Respuesta: cuota acumulada, saldo, estado, platos habilitados
```

## 22. Flujo de pagos

```text
Usuario inicia sesión
        ↓
Frontend obtiene JWT
        ↓
Busca estudiante → GET /api/students
        ↓
Selecciona estudiante → GET /api/students/:id/account
        ↓
Usuario registra: monto cuota, platos extra, método pago, observaciones
        ↓
POST /api/payments
        ↓
Middleware authenticate (JWT)
        ↓
validateRequest (payment.validator)
        ↓
payments.service → RPC registrar_pago()
        ↓
PostgreSQL (una única transacción):
  - valida estudiante
  - obtiene actividad activa
  - crea activity_account si hace falta
  - bloquea la cuenta
  - consulta saldo
  - valida límite Q150
  - obtiene precio oficial de extra (Q40)
  - registra el pago
  - invalida QR anterior
  - crea nuevo QR (_crear_nueva_version_qr)
  - commit
        ↓
Backend recibe resultado del RPC
        ↓
Genera imagen QR (utils/qrGenerator) a partir del qr_payload devuelto
        ↓
Prepara datos de comprobante (v_comprobantes)
        ↓
Frontend muestra: pago, saldo, platos, QR, comprobante
```

Garantía transaccional: no puede existir "pago registrado sin QR generado" ni "QR generado sin pago registrado" — todo ocurre dentro de la misma operación en PostgreSQL.

### Ejemplo de interpretación de payload

Entrada:

```json
{
    "studentId": "UUID",
    "montoCuota": 50,
    "cantidadPlatosExtra": 2,
    "metodoPago": "EFECTIVO",
    "observaciones": null
}
```

Interpretación correcta:

```text
Cuota:   Q50
Extras:  2 × Q40 = Q80
Total recibido: Q130
```

Interpretación prohibida: `Q50 = 1 plato`.

## 23. Flujo de QR

```text
Pago exitoso → PostgreSQL invalida QR anterior y crea versión N+1
        ↓
Backend consulta v_qr_actual → obtiene qr_payload de la versión activa
        ↓
utils/qrGenerator convierte el payload en imagen (librería `qrcode`)
        ↓
Frontend muestra QR
```

Regeneración manual:

```text
POST /api/qr/:accountId/regenerate
        ↓
authenticate
        ↓
qr.service → RPC regenerar_qr()
        ↓
PostgreSQL: versión actual → activo=false; nueva versión → activo=true
        ↓
Respuesta con el nuevo qr_payload
```

Ejemplo:

```text
Antes:  Versión 3, Activo: true
Después: Versión 3, Activo: false
         Versión 4, Activo: true
```

Contador de generaciones: cada regeneración incrementa `version = version + 1`; nunca se reutilizan tokens anteriores; cada QR nuevo recibe un `qr_token` completamente nuevo.

Contenido mínimo del QR:

```json
{
    "token": "UUID",
    "version": 4,
    "estudiante": "Juan Pérez López",
    "grado": "5to Bachillerato",
    "platos": 5
}
```

Validación (`POST /api/qr/validate`):

```text
Backend recibe token escaneado
        ↓
qr.service → RPC validar_qr()
        ↓
PostgreSQL verifica: token existe + activo = true + version = última versión
        ↓
VÁLIDO  → token activo y de la versión más reciente
INVÁLIDO → token existe pero es de una versión anterior
           ("Este código fue reemplazado por una versión más reciente")
```

Esto impide que una foto o impresión antigua del QR siga funcionando. El token del QR **siempre** se valida contra PostgreSQL; nunca se confía en el contenido embebido del QR (nombre/platos son informativos, no autoritativos).

`_crear_nueva_version_qr()` es interna: no se expone en ninguna ruta pública ni se invoca directamente desde el frontend.

## 24. Flujo de comprobantes

```text
Pago registrado (un único registro financiero)
        ↓
receipts.service consulta v_comprobantes por payment_id
        ↓
Backend prepara los datos (no genera un segundo registro)
        ↓
Frontend renderiza dos copias visuales del mismo comprobante:
  COPIA CONTRIBUYENTE
  COPIA REGISTRO
```

Ambas copias comparten `payment_id`, `payment_number` / `numero_comprobante` (formato `AC-000001`, `AC-000002`, ...).

Contenido mínimo del comprobante:
- Número de comprobante
- Actividad
- Fecha
- Estudiante
- Grado
- Monto aplicado a cuota
- Platos extra comprados en ese pago
- Precio de los extras
- Total de extras
- Total recibido
- Cuota acumulada
- Saldo pendiente
- Estado de la cuota
- Cantidad total de platos
- QR correspondiente
- Usuario que registró la operación

Separación de responsabilidades: PostgreSQL almacena el pago; Node.js prepara/genera el comprobante; el frontend lo muestra/imprime. Nunca se insertan registros duplicados para las dos copias.

## 25. Flujo del dashboard

```text
GET /api/dashboard        → v_dashboard_actividad
GET /api/dashboard/daily  → v_ingresos_diarios
GET /api/dashboard/by-grade → v_ingresos_por_grado
```

Datos mínimos a exponer:
- Ingresos totales
- Ingresos por cuota
- Ingresos por platos extra
- Saldo pendiente
- Número de transacciones
- Estudiantes con cuenta
- Cuotas completas
- Cuotas pendientes
- Platos extra vendidos
- Platos base habilitados
- Total de platos habilitados
- Ingresos diarios
- Ingresos por grado

Regla: no recalcular recorriendo pagos en Node.js cuando la vista de PostgreSQL ya entrega el resultado. Filtros a soportar a futuro: `fecha_inicio`, `fecha_fin`, `grado`, `actividad`.

---

## 26. Manejo de errores

Estructura de respuesta estándar (sección 25 del prompt original → aplicada globalmente):

Éxito:
```json
{
    "success": true,
    "message": "Pago registrado correctamente",
    "data": {}
}
```

Error:
```json
{
    "success": false,
    "message": "El monto excede el saldo pendiente",
    "error": "..."
}
```

Reglas:
- No enviar stack traces al frontend en producción.
- Un error de negocio devuelto por un RPC (p. ej. `El monto excede el saldo pendiente. Saldo disponible: Q20`) debe traducirse a una respuesta HTTP entendible (típicamente `409` o `422`), no ocultarse bajo un genérico "Error interno del servidor".
- Códigos HTTP a usar correctamente: `200`, `201`, `400`, `401`, `403`, `404`, `409`, `422`, `500`.

---

## 27. Validaciones

Tres niveles, todos activos:

1. **Frontend** — experiencia de usuario (no es seguridad).
2. **Backend** — control de forma de la solicitud, tipos, presencia de campos, y orquestación del flujo hacia el RPC.
3. **PostgreSQL** — última línea de defensa; ahí viven las reglas financieras críticas (límite Q150, precio de extra Q40, versionado de QR), aunque también se validen en backend.

---

## 28. Seguridad

Checklist exigido:
- Helmet habilitado.
- CORS limitado al frontend autorizado.
- Variables de entorno (nunca hardcodear credenciales).
- Autenticación Bearer + validación de JWT en cada ruta protegida.
- Validación de payload antes de llamar a cualquier RPC.
- Manejo centralizado de errores.
- No confiar en datos del frontend para reglas financieras.
- No aceptar precio de plato desde el frontend.
- No aceptar total calculado desde el frontend.
- No aceptar versión de QR desde el frontend.
- No aceptar token de QR creado por el frontend.
- No exponer `service_role` al frontend.
- No devolver información sensible en las respuestas.
- No almacenar contraseñas propias.
- No permitir SQL arbitrario desde parámetros de request.

---

## 29. Casos de prueba obligatorios

**Caso 1**
```text
Pago Q50 → Saldo Q100 → Cuota pendiente
```

**Caso 2**
```text
Pago anterior Q50 + nuevo pago Q100 → Cuota completa Q150 → 3 platos base habilitados
```

**Caso 3**
```text
Pagado Q140 → intentar pagar Q20 → RECHAZADO (excede el límite Q150)
```

**Caso 4**
```text
Q150 cuota + 2 platos extra → Cuota = Q150, Extras = Q80, Total = Q230, Platos = 5
```

**Caso 5**
```text
QR versión 1 → regenerar → QR 1 inválido, QR 2 válido
```

**Caso 6**
```text
Escanear QR 1 después de existir QR 2 → QR INVÁLIDO
```

**Caso 7**
```text
Escanear QR 2 (versión vigente) → QR VÁLIDO
```

**Caso 8**
```text
Usuario sin JWT intenta registrar pago → 401 Unauthorized
```

Cobertura adicional esperada en Fase 8: anticipos sucesivos, límite Q150, extras, QR viejo/nuevo, regeneración, JWT inválido, usuarios no autenticados, comprobantes, dashboard.

---

## 30. Orden de implementación

**Fase 1 — Inicialización**: Node.js, Express, ES Modules, variables de entorno, cliente Supabase, CORS, Helmet, Morgan, middleware de errores.

**Fase 2 — Autenticación**: login, JWT, middleware `authenticate`, `req.user`, cliente Supabase contextualizado por JWT.

**Fase 3 — Estudiantes**: listado, búsqueda, filtros, detalle, estado de cuenta.

**Fase 4 — Pagos**: endpoint, validaciones, RPC `registrar_pago`, manejo de errores, respuesta.

**Fase 5 — QR**: generación visual, consulta actual, historial, regeneración, validación.

**Fase 6 — Comprobantes**: datos, diseño, dos copias, reimpresión.

**Fase 7 — Dashboard**: totales, fechas, grados, cuotas, extras, platos.

**Fase 8 — Pruebas**: pagos, anticipos, límite Q150, extras, QR viejo, QR nuevo, regeneración, JWT inválido, usuarios no autenticados, comprobantes, dashboard.

**Fase 9 — Producción**: GitHub, Render, variables de entorno, CORS de Vercel, Supabase de producción.

---

## 31. Despliegue en Render

- Repositorio en GitHub conectado a Render (Web Service, Node).
- Variables de entorno configuradas directamente en el panel de Render (nunca commiteadas): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FRONTEND_URL`, `NODE_ENV=production`.
- `PORT` gestionado por Render (usar `process.env.PORT`).
- Build/start commands estándar de Node (`npm install` / `npm start`).
- CORS en producción restringido al dominio real de Vercel del frontend.
- `.env` nunca se sube al repositorio (`.gitignore`).

---

## 32. Integración futura con React/Vite/Vercel

- El frontend consumirá exclusivamente los endpoints REST documentados en la sección 20.
- El frontend obtiene su `access_token` vía Supabase Auth (directo o a través de `/api/auth/login`) y lo envía como `Authorization: Bearer` en cada request protegida.
- El frontend nunca realiza `supabase.from(...).insert/update/delete` sobre tablas financieras; toda escritura crítica pasa por la API backend.
- CORS del backend debe permitir el dominio de Vercel de producción y `http://localhost:5173` en desarrollo, vía `FRONTEND_URL`.
- El backend es agnóstico a cómo el frontend renderiza QR/comprobantes; solo entrega los datos/payload necesarios.

---

## 33. Reglas que nunca deben romperse

1. La cuota es Q150.
2. Se permiten anticipos.
3. La cuota máxima acumulada es Q150.
4. Q150 da derecho a 3 platos.
5. Los platos de la cuota NO valen Q50 cada uno.
6. Plato extra = Q40.
7. No existen roles.
8. Usuarios mediante Supabase Auth.
9. Estudiante relacionado mediante UUID (`student_id`), nunca por nombre/apellido como FK.
10. Búsqueda por nombre, apellidos y grado.
11. Pagos mediante `registrar_pago()` — nunca INSERT directo a `payments`.
12. Cada pago genera nuevo QR.
13. Cada regeneración genera nueva versión.
14. QR anterior queda inválido.
15. Solamente el último QR (mayor versión) vale.
16. Debe existir contador/historial de generaciones.
17. El QR contiene estudiante y cantidad de platos (además de token y versión).
18. El token siempre debe validarse contra Supabase/PostgreSQL, nunca confiar en el contenido del QR.
19. Un pago tiene dos copias de comprobante, no dos registros financieros.
20. El frontend no escribe pagos directamente en la BD.

### Reglas adicionales para el desarrollo asistido por IA

- Antes de proponer cambios, revisar esta guía.
- No renombrar tablas (`students`, `activities`, `activity_accounts`, `payments`, `qr_tickets`) sin solicitarlo.
- No renombrar RPC existentes (`registrar_pago`, `regenerar_qr`, `validar_qr`, `_crear_nueva_version_qr`).
- No cambiar relaciones existentes entre tablas.
- No duplicar en Node.js lógica ya resuelta en PostgreSQL (vistas y RPC).
- No trasladar reglas financieras críticas únicamente al frontend.
- No agregar roles.
- No agregar tablas innecesarias.
- No inventar funcionalidades no especificadas en esta guía.
- No reemplazar Supabase.
- No cambiar el stack Node.js + Express.
- No permitir escrituras financieras directas desde React.
- Mantener compatibilidad con Render (backend) y Vercel (frontend).
- Mantener código modular y separación `route → controller → service`.
- Mantener arquitectura REST.
- Explicar cualquier migración de base de datos antes de ejecutarla.

---

## 34. Checklist final

**Arquitectura**
- [ ] Frontend nunca escribe directo en Supabase para operaciones financieras.
- [ ] Todo pago pasa por `registrar_pago()`.
- [ ] Toda regeneración de QR pasa por `regenerar_qr()`.
- [ ] Toda validación de QR pasa por `validar_qr()`.
- [ ] `_crear_nueva_version_qr()` no se expone públicamente.

**Autenticación**
- [ ] Supabase Auth es la única fuente de credenciales.
- [ ] Middleware `authenticate` verifica el token y llena `req.user`.
- [ ] Existe separación `supabaseAdmin` / `supabaseUser`.
- [ ] `auth.uid()` queda correctamente propagado en operaciones RPC.

**Reglas de negocio**
- [ ] Cuota límite Q150 validada en PostgreSQL.
- [ ] Plato extra Q40 obtenido de PostgreSQL, no del frontend.
- [ ] Platos base solo se habilitan al completar Q150.
- [ ] No se calcula Q150/3 como precio de plato.

**QR**
- [ ] Un único QR activo por cuenta en todo momento.
- [ ] Versionado incremental sin reutilizar tokens.
- [ ] Contenido mínimo: token, versión, estudiante, grado, platos.
- [ ] Validación siempre contra PostgreSQL.

**Comprobantes**
- [ ] Un registro financiero, dos copias visuales.
- [ ] Numeración oficial `AC-000001...`.
- [ ] Datos obtenidos de `v_comprobantes`.

**Dashboard**
- [ ] Datos obtenidos de las vistas (`v_dashboard_actividad`, `v_ingresos_diarios`, `v_ingresos_por_grado`), sin recalcular en Node.js.

**Seguridad**
- [ ] Helmet, CORS restringido, variables de entorno protegidas.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` nunca expuesta al frontend ni al repositorio.
- [ ] Errores de negocio traducidos correctamente, sin stack traces en producción.

**Pruebas**
- [ ] Los 8 casos de prueba obligatorios (sección 29) pasan.

---

### Cómo usar esta guía en conversaciones futuras

Para desarrollar un módulo específico, indicar por ejemplo:

```text
"Usa GUIA-BACKEND-ACTIVIDAD-CULTURAL.md y crea el módulo de pagos"
"Usa GUIA-BACKEND-ACTIVIDAD-CULTURAL.md y crea el módulo QR"
```

La implementación debe respetar exactamente la estructura de carpetas (sección 14), los endpoints (sección 20), las tablas/RPC/vistas existentes (secciones 9–12) y las reglas inmutables (sección 33), sin introducir cambios de arquitectura no autorizados.
