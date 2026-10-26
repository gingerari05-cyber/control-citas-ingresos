-- Ejecutar después de crear la cuenta dueña en Supabase Auth.
-- Las citas existentes sin user_id se asignan a la cuenta Auth más antigua.

-- 1. Agregar user_id y vincularlo con el usuario propietario.
ALTER TABLE public.citas
  ADD COLUMN IF NOT EXISTS user_id uuid
  REFERENCES auth.users(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users) THEN
    RAISE EXCEPTION 'Crea primero la cuenta dueña en Supabase Auth.';
  END IF;
END
$$;

-- 2. Asignar los registros existentes sin propietario a la cuenta más antigua.
UPDATE public.citas
SET user_id = (
  SELECT id
  FROM auth.users
  ORDER BY created_at, id
  LIMIT 1
)
WHERE user_id IS NULL;

-- 3. Habilitar seguridad de nivel de fila.
ALTER TABLE public.citas ENABLE ROW LEVEL SECURITY;

-- 4. Eliminar todas las políticas anteriores para que ninguna política
-- permisiva siga otorgando acceso público.
DO $$
DECLARE
  existing_policy record;
BEGIN
  FOR existing_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'citas'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.citas',
      existing_policy.policyname
    );
  END LOOP;
END
$$;

-- Revocar privilegios explícitos de acceso público y anon.
REVOKE ALL PRIVILEGES ON TABLE public.citas FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.citas TO authenticated;

-- 5. Permitir a cada usuario operar solamente sobre sus propias citas.
CREATE POLICY "Users can select own citas"
  ON public.citas
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own citas"
  ON public.citas
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own citas"
  ON public.citas
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own citas"
  ON public.citas
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Completar el aislamiento para todas las filas nuevas y acelerar las consultas.
ALTER TABLE public.citas
  ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS citas_user_id_fecha_hora_idx
  ON public.citas (user_id, fecha, hora);
