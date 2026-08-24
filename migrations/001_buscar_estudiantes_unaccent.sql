-- Migración: búsqueda de estudiantes insensible a tildes/mayúsculas.
-- Ejecutar en el SQL Editor de Supabase (proyecto: feenhbqyywinkezoclmf).
--
-- No modifica la tabla `students` ni ninguna regla financiera; solo agrega
-- una extensión estándar de PostgreSQL y una función de solo lectura.

-- 1. Extensión unaccent (elimina tildes/diacríticos para comparar texto).
create extension if not exists unaccent;

-- 2. Función de búsqueda de estudiantes.
--    SECURITY INVOKER (comportamiento por defecto): se ejecuta con los
--    privilegios de quien la invoca, por lo que sigue respetando las
--    políticas RLS de la tabla students para el usuario autenticado.
create or replace function public.buscar_estudiantes(
  p_search text default null,
  p_grado  text default null
)
returns setof public.students
language sql
stable
as $$
  select *
  from public.students
  where activo = true
    and (p_grado is null or grado = p_grado)
    and (
      p_search is null or p_search = '' or
      unaccent(lower(nombre))    ilike unaccent(lower('%' || p_search || '%')) or
      unaccent(lower(apellidos)) ilike unaccent(lower('%' || p_search || '%')) or
      unaccent(lower(grado))     ilike unaccent(lower('%' || p_search || '%'))
    )
  order by grado, apellidos, nombre;
$$;
