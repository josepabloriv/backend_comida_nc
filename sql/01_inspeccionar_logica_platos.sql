-- =====================================================================
-- PASO 1 (SOLO LECTURA) — Inspeccionar la lógica actual de "platos"
-- =====================================================================
-- Este script NO modifica nada. Solo trae la definición actual de la
-- función registrar_pago() y de las vistas que calculan los platos
-- base/habilitados, para poder escribir el cambio real (Q50 = 1 plato,
-- hasta 3) sin romper columnas o lógica de la que depende el backend.
--
-- Instrucciones:
--   1. Pega TODO este archivo en el SQL Editor de Supabase.
--   2. Ejecuta cada bloque (o todo junto).
--   3. Copia el resultado completo de cada consulta (la columna
--      "definicion" completa, no la recortes) y pégamelo de vuelta.
-- =====================================================================

-- 1. Definición completa de la función registrar_pago()
select pg_get_functiondef(p.oid) as definicion
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'registrar_pago';

-- 2. Definición de la vista v_estado_cuentas (estado por estudiante,
--    de donde sale platos_incluidos / platos_extra / total_platos)
select pg_get_viewdef('public.v_estado_cuentas'::regclass, true) as definicion;

-- 3. Definición de la vista v_dashboard_actividad (totales agregados,
--    platos_base_habilitados / total_platos_habilitados)
select pg_get_viewdef('public.v_dashboard_actividad'::regclass, true) as definicion;

-- 4. Definición de la vista v_ingresos_por_grado (también trae
--    platos_extra_vendidos por grado)
select pg_get_viewdef('public.v_ingresos_por_grado'::regclass, true) as definicion;

-- 5. Definición de la vista v_comprobantes (usada para el comprobante
--    impreso; puede depender de los mismos campos de platos)
select pg_get_viewdef('public.v_comprobantes'::regclass, true) as definicion;

-- 6. Definición de validar_qr() — esta es la función que AUTORIZA
--    platos en la puerta al escanear el QR. Es la más importante:
--    si compara contra el mismo campo que cambiaremos, el cambio de
--    regla se refleja automáticamente ahí también.
select pg_get_functiondef(p.oid) as definicion
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'validar_qr';

-- 7. Estructura de la tabla activity_accounts (por si platos_incluidos
--    o cuota_completa se guardan como columna física en vez de
--    calcularse al vuelo en la vista)
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'activity_accounts'
order by ordinal_position;
