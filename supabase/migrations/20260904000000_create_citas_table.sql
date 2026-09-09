-- =========================================================
-- MIGRACIÓN DE SUPABASE: CREACIÓN DE TABLA CITAS
-- =========================================================

-- 1. Asegurar extensión pgcrypto para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Crear tabla public.citas con campos solicitados
CREATE TABLE IF NOT EXISTS public.citas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  nombre_cliente TEXT NOT NULL,
  servicio TEXT NOT NULL,
  fecha DATE NOT NULL,
  hora TEXT NOT NULL,
  precio NUMERIC(10, 2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente'
);

-- 3. Habilitar seguridad de nivel de fila (RLS)
ALTER TABLE public.citas ENABLE ROW LEVEL SECURITY;

-- 4. Política para permitir lectura y escritura a clientes con clave anon
CREATE POLICY "Permitir acceso publico total a citas" 
  ON public.citas 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 5. Habilitar replicación en tiempo real en Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.citas;
