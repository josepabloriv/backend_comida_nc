-- =====================================================================
-- PASO 2 (SOLO LECTURA) — Inspeccionar la parte de QR
-- =====================================================================
-- Corre cada consulta POR SEPARADO (una a la vez) y pégame el resultado
-- de cada una. No modifica nada.
-- =====================================================================

-- A. Definición completa de _crear_nueva_version_qr()
--    (la función interna que genera el QR en cada pago; probablemente
--    calcula los platos habilitados por su cuenta)
select pg_get_functiondef(p.oid) as definicion
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = '_crear_nueva_version_qr';

-- B. Definición completa de validar_qr()
--    (la función que se llama al escanear el QR en la puerta del evento;
--    es la que de verdad autoriza la entrega de comida)
select pg_get_functiondef(p.oid) as definicion
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'validar_qr';

-- C. Estructura de la tabla qr_tickets
--    (para saber si el conteo de platos queda "congelado" en el QR
--    al momento de generarlo, o si vive en otro lado)
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'qr_tickets'
order by ordinal_position;
