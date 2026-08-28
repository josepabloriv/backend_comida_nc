-- =====================================================================
-- FIX: Platos base proporcionales al pago de la cuota
-- =====================================================================
-- Antes: 0 platos base hasta completar los Q150 (todo o nada).
-- Ahora: cada (cuota_base / platos_incluidos) pagado habilita 1 plato,
--        hasta el máximo de platos_incluidos.
--        Con cuota_base = Q150 y platos_incluidos = 3:
--          Q50 pagados  -> 1 plato
--          Q100 pagados -> 2 platos
--          Q150 pagados -> 3 platos (cuota completa)
--
-- Se corrigen los 2 lugares de PostgreSQL donde esta regla estaba
-- duplicada, más un ajuste menor en el backend (Node.js, fuera de este
-- script) donde se duplicaba una tercera vez para el comprobante impreso.
--
-- Todo dentro de una sola transacción: si algo falla, no se aplica nada.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) v_estado_cuentas
--    - "platos_incluidos" deja de ser la capacidad fija de la actividad
--      (siempre 3) y pasa a ser los platos base YA GANADOS según el
--      pago acumulado (0 a 3). Esto es lo que ya interpreta el frontend
--      (QrScanPage.jsx: "Incluidos en cuota: X"), así que el cambio de
--      significado no requiere tocar el frontend.
--    - "total_platos" (base + extra) se ajusta para sumar el nuevo
--      platos_incluidos proporcional.
--    - "cuota_completa" y "estado_cuota" NO cambian: siguen significando
--      "ya pagó los Q150 completos", que es un concepto distinto.
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
    CASE
        WHEN COALESCE(sum(p.monto_cuota), 0::numeric) >= a.cuota_base THEN true
        ELSE false
    END AS cuota_completa,
    CASE
        WHEN COALESCE(sum(p.monto_cuota), 0::numeric) >= a.cuota_base THEN 'PAGADO'::text
        WHEN COALESCE(sum(p.monto_cuota), 0::numeric) > 0::numeric THEN 'PENDIENTE'::text
        ELSE 'SIN PAGO'::text
    END AS estado_cuota,
    -- Platos base ya ganados, proporcional al pago acumulado (antes: a.platos_incluidos fijo)
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
-- 2) v_dashboard_actividad
--    "platos_base_habilitados" ahora suma directamente la columna ya
--    corregida de v_estado_cuentas, en vez de recalcular "todo o nada"
--    por su cuenta (antes dependía de cuota_completa).
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_dashboard_actividad AS
SELECT activity_id,
    actividad,
    count(*)::integer AS estudiantes_con_cuenta,
    count(*) FILTER (WHERE cuota_completa = true)::integer AS cuotas_completas,
    count(*) FILTER (WHERE cuota_completa = false)::integer AS cuotas_pendientes,
    COALESCE(sum(cuota_pagada), 0::numeric)::numeric(12,2) AS ingresos_cuotas,
    COALESCE(sum(saldo_cuota), 0::numeric)::numeric(12,2) AS saldo_total_pendiente,
    COALESCE(sum(ingresos_extras), 0::numeric)::numeric(12,2) AS ingresos_platos_extra,
    COALESCE(sum(total_pagado), 0::numeric)::numeric(12,2) AS ingresos_totales,
    COALESCE(sum(platos_extra), 0::bigint)::integer AS platos_extra_vendidos,
    COALESCE(sum(platos_incluidos), 0::bigint)::integer AS platos_base_habilitados,
    COALESCE(sum(total_platos), 0::bigint)::integer AS total_platos_habilitados,
    COALESCE(sum(cantidad_pagos), 0::bigint)::integer AS cantidad_transacciones
FROM v_estado_cuentas
GROUP BY activity_id, actividad;

-- ---------------------------------------------------------------------
-- 3) registrar_pago()
--    Mismo ajuste que en v_estado_cuentas, para que la respuesta
--    inmediata al registrar un pago (usada por el comprobante y el QR
--    recién generado) ya venga con el número correcto sin esperar a
--    una consulta posterior.
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
            'cuota_completa', v_pagado_final >= v_cuota,
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

-- =====================================================================
-- VERIFICACIÓN (opcional, corre esto después de aplicar el fix)
-- Revisa que ningún estudiante tenga platos_incluidos fuera de rango
-- ni total_platos negativo. No debería devolver ninguna fila.
-- =====================================================================
-- SELECT account_id, estudiante, cuota_pagada, platos_incluidos, platos_extra, total_platos
-- FROM v_estado_cuentas
-- WHERE platos_incluidos < 0 OR platos_incluidos > (SELECT platos_incluidos FROM activities WHERE id = v_estado_cuentas.activity_id)
--    OR total_platos < 0;
