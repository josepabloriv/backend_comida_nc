-- =====================================================================
-- FIX: Un pago parcial (ej. Q50) ya no se trata como una deuda
-- =====================================================================
-- Antes: pagar Q50 (1 plato) dejaba "saldo pendiente" de Q100 y
--        estado_cuota = 'PENDIENTE', como si se debiera dinero.
-- Ahora: cada pago es una compra completa de los platos que alcanzó a
--        cubrir. Ya no existe el estado 'PENDIENTE' (deuda); solo:
--          'SIN PAGO' -> todavía no ha pagado nada
--          'PAGADO'   -> ya pagó algo (aunque sea parcial), sin deuda
--        cuota_completa pasa de significar "pagó los Q150 completos"
--        a "ya pagó algo" (mismo booleano, nuevo significado; alimenta
--        directamente las tarjetas "Cuotas completas/pendientes" del
--        dashboard sin tocar esa vista).
--
-- El monto que falta para completar la cuota de Q150 (saldo_cuota)
-- SIGUE calculándose igual -- sigue siendo útil saber cuánto más se
-- podría pagar para sumar más platos -- pero ya no se presenta como
-- una deuda en ninguna pantalla (eso se ajusta en el frontend/backend
-- Node.js, fuera de este script).
--
-- Todo dentro de una sola transacción: si algo falla, no se aplica nada.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) v_estado_cuentas
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_estado_cuentas AS
SELECT aa.id AS account_id,
    a.id AS activity_id,
    a.nombre AS actividad,
    s.id AS student_id,
    s.nombre,
    s.apellidos,
    concat_ws(' '::text, s.nombre, s.apellidos) AS estudiante,
    s.grado,
    a.cuota_base,
    COALESCE(sum(p.monto_cuota), 0::numeric)::numeric(10,2) AS cuota_pagada,
    GREATEST(a.cuota_base - COALESCE(sum(p.monto_cuota), 0::numeric), 0::numeric)::numeric(10,2) AS saldo_cuota,
    -- Ya pagó algo (aunque sea parcial) = sin deuda, compra completa de esos platos.
    CASE
        WHEN COALESCE(sum(p.monto_cuota), 0::numeric) > 0::numeric THEN true
        ELSE false
    END AS cuota_completa,
    CASE
        WHEN COALESCE(sum(p.monto_cuota), 0::numeric) > 0::numeric THEN 'PAGADO'::text
        ELSE 'SIN PAGO'::text
    END AS estado_cuota,
    CASE
        WHEN a.platos_incluidos > 0 THEN
            LEAST(
                FLOOR(COALESCE(sum(p.monto_cuota), 0::numeric) / (a.cuota_base / a.platos_incluidos::numeric)),
                a.platos_incluidos
            )
        ELSE 0
    END::integer AS platos_incluidos,
    COALESCE(sum(p.cantidad_platos_extra), 0::bigint)::integer AS platos_extra,
    (
        (CASE
            WHEN a.platos_incluidos > 0 THEN
                LEAST(
                    FLOOR(COALESCE(sum(p.monto_cuota), 0::numeric) / (a.cuota_base / a.platos_incluidos::numeric)),
                    a.platos_incluidos
                )
            ELSE 0
        END) + COALESCE(sum(p.cantidad_platos_extra), 0::bigint)
    )::integer AS total_platos,
    COALESCE(sum(p.total_extras), 0::numeric)::numeric(10,2) AS ingresos_extras,
    COALESCE(sum(p.total_pago), 0::numeric)::numeric(10,2) AS total_pagado,
    count(p.id)::integer AS cantidad_pagos
FROM activity_accounts aa
    JOIN activities a ON a.id = aa.activity_id
    JOIN students s ON s.id = aa.student_id
    LEFT JOIN payments p ON p.account_id = aa.id
GROUP BY aa.id, a.id, a.nombre, a.cuota_base, a.platos_incluidos, s.id, s.nombre, s.apellidos, s.grado;

-- ---------------------------------------------------------------------
-- 2) registrar_pago() -- mismo ajuste en el booleano cuota_completa que
--    se devuelve al frontend justo después de registrar el pago.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_pago(
    p_student_id uuid,
    p_monto_cuota numeric,
    p_cantidad_platos_extra integer DEFAULT 0,
    p_metodo_pago text DEFAULT 'EFECTIVO'::text,
    p_observaciones text DEFAULT NULL::text,
    p_activity_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
    v_usuario UUID;
    v_activity_id UUID;
    v_account_id UUID;
    v_cuota NUMERIC(10,2);
    v_precio_extra NUMERIC(10,2);
    v_platos_incluidos INTEGER;
    v_pagado NUMERIC(10,2);
    v_saldo NUMERIC(10,2);
    v_monto NUMERIC(10,2);
    v_payment public.payments;
    v_qr public.qr_tickets;
    v_nombre TEXT;
    v_apellidos TEXT;
    v_grado TEXT;
    v_pagado_final NUMERIC(10,2);
    v_saldo_final NUMERIC(10,2);
    v_extras_total INTEGER;
    v_platos_base INTEGER;
    v_platos_habilitados INTEGER;
BEGIN

    -- ========================================================
    -- Usuario autenticado
    -- ========================================================
    v_usuario := auth.uid();
    IF v_usuario IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado.';
    END IF;

    -- ========================================================
    -- Validaciones básicas
    -- ========================================================
    IF p_monto_cuota IS NULL THEN
        RAISE EXCEPTION 'Debe indicar el monto aplicado a la cuota.';
    END IF;

    v_monto := ROUND(p_monto_cuota, 2);

    IF v_monto < 0 THEN
        RAISE EXCEPTION 'El monto de la cuota no puede ser negativo.';
    END IF;

    IF p_cantidad_platos_extra IS NULL OR p_cantidad_platos_extra < 0 THEN
        RAISE EXCEPTION 'La cantidad de platos extra no es válida.';
    END IF;

    IF v_monto = 0 AND p_cantidad_platos_extra = 0 THEN
        RAISE EXCEPTION 'Debe registrar un pago de cuota o platos extra.';
    END IF;

    IF p_metodo_pago IS NULL OR BTRIM(p_metodo_pago) = '' THEN
        RAISE EXCEPTION 'Debe indicar el método de pago.';
    END IF;

    -- ========================================================
    -- Buscar estudiante
    -- ========================================================
    SELECT nombre, apellidos, grado
    INTO v_nombre, v_apellidos, v_grado
    FROM public.students
    WHERE id = p_student_id
      AND activo = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El estudiante no existe o está inactivo.';
    END IF;

    -- ========================================================
    -- Buscar actividad
    -- ========================================================
    IF p_activity_id IS NULL THEN
        SELECT id
        INTO v_activity_id
        FROM public.activities
        WHERE activa = TRUE
        ORDER BY created_at DESC
        LIMIT 1;
    ELSE
        SELECT id
        INTO v_activity_id
        FROM public.activities
        WHERE id = p_activity_id
          AND activa = TRUE;
    END IF;

    IF v_activity_id IS NULL THEN
        RAISE EXCEPTION 'No existe una actividad activa.';
    END IF;

    -- ========================================================
    -- Crear cuenta si todavía no existe
    -- ========================================================
    INSERT INTO public.activity_accounts (activity_id, student_id)
    VALUES (v_activity_id, p_student_id)
    ON CONFLICT (activity_id, student_id)
    DO UPDATE SET student_id = EXCLUDED.student_id
    RETURNING id
    INTO v_account_id;

    -- ========================================================
    -- Bloqueo para evitar pagos simultáneos
    -- ========================================================
    PERFORM 1
    FROM public.activity_accounts
    WHERE id = v_account_id
    FOR UPDATE;

    -- ========================================================
    -- Configuración oficial
    -- ========================================================
    SELECT cuota_base, precio_plato_extra, platos_incluidos
    INTO v_cuota, v_precio_extra, v_platos_incluidos
    FROM public.activities
    WHERE id = v_activity_id;

    -- ========================================================
    -- Total previamente aplicado a cuota
    -- ========================================================
    SELECT COALESCE(SUM(monto_cuota), 0)
    INTO v_pagado
    FROM public.payments
    WHERE account_id = v_account_id;

    v_saldo := v_cuota - v_pagado;

    -- ========================================================
    -- Evitar exceder Q150
    -- ========================================================
    IF v_monto > v_saldo THEN
        RAISE EXCEPTION 'El monto excede el saldo pendiente. Saldo disponible: Q%', v_saldo;
    END IF;

    -- ========================================================
    -- Registrar pago
    -- ========================================================
    INSERT INTO public.payments (
        account_id, monto_cuota, cantidad_platos_extra,
        precio_plato_extra, metodo_pago, observaciones, registrado_por
    )
    VALUES (
        v_account_id, v_monto, p_cantidad_platos_extra,
        v_precio_extra, UPPER(BTRIM(p_metodo_pago)), p_observaciones, v_usuario
    )
    RETURNING *
    INTO v_payment;

    -- ========================================================
    -- Crear nueva versión del QR
    -- ========================================================
    v_qr := public._crear_nueva_version_qr(v_account_id, v_usuario);

    -- ========================================================
    -- Estado actualizado
    -- ========================================================
    SELECT COALESCE(SUM(monto_cuota), 0), COALESCE(SUM(cantidad_platos_extra), 0)
    INTO v_pagado_final, v_extras_total
    FROM public.payments
    WHERE account_id = v_account_id;

    v_saldo_final := GREATEST(v_cuota - v_pagado_final, 0);

    -- Platos base ya ganados, proporcional al pago acumulado:
    -- cada (cuota_base / platos_incluidos) pagado habilita 1 plato,
    -- hasta el máximo de platos_incluidos.
    IF v_platos_incluidos > 0 THEN
        v_platos_base := LEAST(
            FLOOR(v_pagado_final / (v_cuota / v_platos_incluidos::NUMERIC)),
            v_platos_incluidos
        )::INTEGER;
    ELSE
        v_platos_base := 0;
    END IF;

    v_platos_habilitados := v_platos_base + v_extras_total;

    -- ========================================================
    -- Respuesta al backend
    -- ========================================================
    RETURN JSONB_BUILD_OBJECT(
        'ok', TRUE,
        'payment_id', v_payment.id,
        'payment_number', v_payment.payment_number,
        'numero_comprobante', CONCAT('AC-', LPAD(v_payment.payment_number::TEXT, 6, '0')),
        'account_id', v_account_id,
        'student_id', p_student_id,
        'estudiante', CONCAT_WS(' ', v_nombre, v_apellidos),
        'grado', v_grado,
        'pago_actual', JSONB_BUILD_OBJECT(
            'monto_cuota', v_payment.monto_cuota,
            'platos_extra', v_payment.cantidad_platos_extra,
            'precio_plato_extra', v_payment.precio_plato_extra,
            'total_extras', v_payment.total_extras,
            'total_pago', v_payment.total_pago,
            'metodo_pago', v_payment.metodo_pago
        ),
        'estado_cuenta', JSONB_BUILD_OBJECT(
            'cuota_total', v_cuota,
            'cuota_pagada', v_pagado_final,
            'saldo', v_saldo_final,
            'cuota_completa', v_pagado_final > 0,
            'platos_incluidos', v_platos_base,
            'platos_extra', v_extras_total,
            'total_platos', v_platos_habilitados
        ),
        'qr', JSONB_BUILD_OBJECT(
            'token', v_qr.qr_token,
            'version', v_qr.version,
            'activo', v_qr.activo,
            'generado', v_qr.generated_at,
            'payload', JSONB_BUILD_OBJECT(
                'token', v_qr.qr_token::TEXT,
                'version', v_qr.version,
                'estudiante', CONCAT_WS(' ', v_nombre, v_apellidos),
                'grado', v_grado,
                'platos', v_platos_habilitados
            )
        )
    );

END;
$function$;

COMMIT;
