# Backend — Actividad Cultural

API REST en Node.js + Express para el control de pagos de la actividad cultural.

La arquitectura, reglas de negocio y contrato de endpoints están definidos en
[`GUIA-BACKEND-ACTIVIDAD-CULTURAL.md`](./GUIA-BACKEND-ACTIVIDAD-CULTURAL.md).
Ese documento es la fuente de verdad del proyecto: cualquier cambio de
arquitectura debe revisarse contra esa guía antes de implementarse.

## Requisitos

- Node.js 18+
- Una cuenta/proyecto de Supabase con las tablas, RPC y vistas ya existentes.

## Configuración

1. Copiar `.env.example` a `.env` y completar las credenciales de Supabase:

   ```bash
   cp .env.example .env
   ```

2. Instalar dependencias:

   ```bash
   npm install
   ```

3. Levantar el servidor en desarrollo:

   ```bash
   npm run dev
   ```

   o en modo estándar:

   ```bash
   npm start
   ```

4. Verificar que el servicio responde:

   ```bash
   curl http://localhost:3000/api/health
   ```

## Pruebas

Suite de integración con el test runner nativo de Node (`node:test`), corre contra el Supabase real configurado en `.env` (no hay mocks). Cada test crea sus propios estudiantes desechables (`grado: "QA_TEST"`) y los borra al finalizar (orden `qr_tickets → payments → activity_accounts → students`, sin dejar rastro).

Requiere `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` en `.env` (un usuario de Supabase Auth ya existente).

```bash
npm test
```

Cobertura: los 8 casos de prueba obligatorios de la guía (sección 38), validaciones (`422`), guard de autenticación (`401`), estados `404`/`409`/`400`, y las Fases 2–7 completas.

## Estado del proyecto

- [x] Fase 1 — Inicialización (Express, ES Modules, dotenv, Supabase client, CORS, Helmet, Morgan, manejo de errores).
- [x] Fase 2 — Autenticación (login, `authenticate`, `req.user`, cliente contextualizado por JWT, logout con revocación de sesión).
- [x] Fase 3 — Estudiantes (listado, búsqueda, filtro por grado, detalle, estado de cuenta). Pendiente: migración `unaccent` para búsqueda sin tildes (`migrations/001_buscar_estudiantes_unaccent.sql`, aún no ejecutada).
- [x] Fase 4 — Pagos (`registrar_pago()`, historial por estudiante, detalle de pago). Casos de prueba 1, 2, 3, 4 y 8 verificados end-to-end contra Supabase real.
- [x] Fase 5 — QR (`v_qr_actual`, `v_historial_qr`, `regenerar_qr()`, `validar_qr()`, imagen visual vía `qrcode`). Casos de prueba 5, 6 y 7 verificados end-to-end contra Supabase real.
- [x] Fase 6 — Comprobantes (`GET /api/payments/:id/receipt` vía `v_comprobantes`, con QR de ese pago específico y usuario que lo registró). PDF pendiente (opcional, requiere librería no listada en el stack).
- [x] Fase 7 — Dashboard (`v_dashboard_actividad`, `v_ingresos_diarios`, `v_ingresos_por_grado`, filtros `actividad`/`fecha_inicio`/`fecha_fin`/`grado`). Verificado end-to-end contra Supabase real.
- [x] Fase 8 — Pruebas (`npm test`, 32 pruebas automatizadas con `node:test` contra Supabase real, casos obligatorios 1–8 incluidos, con limpieza automática de datos de prueba).
- [ ] Fase 9 — Producción.
