-- ============================================================
-- ADOSE Flota 2026 - Supabase Schema
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ============================================================
-- 1. PLANES CLARO
CREATE TABLE IF NOT EXISTS planes_claro (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL,
    precio_mensual NUMERIC NOT NULL,
    datos_gb NUMERIC,
    descripcion TEXT DEFAULT '',
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);
-- 2. CATÁLOGO DISPOSITIVOS
CREATE TABLE IF NOT EXISTS catalogo_dispositivos (
    id SERIAL PRIMARY KEY,
    modelo TEXT NOT NULL,
    categoria TEXT NOT NULL CHECK (categoria IN ('Basico', 'Mid-range', 'Premium')),
    precio_rd NUMERIC NOT NULL,
    pantalla TEXT DEFAULT '',
    ram TEXT DEFAULT '',
    almacenamiento TEXT DEFAULT '',
    camara TEXT DEFAULT '',
    bateria TEXT DEFAULT '',
    disponible BOOLEAN DEFAULT true,
    destacado BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);
-- 3. USUARIOS (extiende Supabase Auth)
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    cargo TEXT DEFAULT '',
    area TEXT DEFAULT 'Empleados CEADIC',
    rol TEXT DEFAULT 'usuario' CHECK (rol IN ('admin', 'usuario')),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);
-- 4. SOLICITUDES
CREATE TABLE IF NOT EXISTS solicitudes (
    id TEXT PRIMARY KEY,
    fecha TIMESTAMPTZ DEFAULT now(),
    usuario_id UUID REFERENCES usuarios(id),
    nombre TEXT NOT NULL,
    cargo TEXT NOT NULL,
    area TEXT NOT NULL,
    plan_id INTEGER REFERENCES planes_claro(id),
    dispositivo_id INTEGER REFERENCES catalogo_dispositivos(id),
    precio_equipo NUMERIC DEFAULT 0,
    estado TEXT DEFAULT 'pendiente' CHECK (
        estado IN (
            'pendiente',
            'enviado',
            'transito',
            'recibido',
            'listo-entrega',
            'entregado',
            'cancelado'
        )
    ),
    justificacion TEXT DEFAULT '',
    corte_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
-- 5. CORTES
CREATE TABLE IF NOT EXISTS cortes (
    id TEXT PRIMARY KEY,
    fecha_corte TIMESTAMPTZ DEFAULT now(),
    fecha_envio_claro TIMESTAMPTZ,
    solicitudes_ids TEXT [] DEFAULT '{}',
    total_solicitudes INTEGER DEFAULT 0,
    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'enviado', 'confirmado')),
    notas TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);
-- FK cortes → solicitudes
ALTER TABLE solicitudes
ADD CONSTRAINT fk_corte FOREIGN KEY (corte_id) REFERENCES cortes(id);
-- 6. FLOTA MAESTRA
CREATE TABLE IF NOT EXISTS flota_maestra (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitud_id TEXT REFERENCES solicitudes(id),
    nombre TEXT NOT NULL,
    cargo TEXT DEFAULT '',
    area TEXT DEFAULT '',
    numero_telefono TEXT DEFAULT '',
    imei TEXT DEFAULT '',
    sim TEXT DEFAULT '',
    plan_id INTEGER REFERENCES planes_claro(id),
    dispositivo_id INTEGER REFERENCES catalogo_dispositivos(id),
    costo_dispositivo NUMERIC DEFAULT 0,
    fecha_entrega DATE,
    fecha_contrato DATE,
    fecha_cambio_18m DATE,
    estado TEXT DEFAULT 'activo',
    notas TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);
-- ─── RLS (Row Level Security) ────────────────────────────────────────────────
ALTER TABLE planes_claro ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogo_dispositivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cortes ENABLE ROW LEVEL SECURITY;
ALTER TABLE flota_maestra ENABLE ROW LEVEL SECURITY;
-- Todos los autenticados pueden leer catálogo y planes
CREATE POLICY "read_publico" ON planes_claro FOR
SELECT TO authenticated USING (true);
CREATE POLICY "read_publico" ON catalogo_dispositivos FOR
SELECT TO authenticated USING (true);
-- Admin puede todo en todas las tablas
CREATE POLICY "admin_todo" ON usuarios FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM usuarios u
        WHERE u.id = auth.uid()
            AND u.rol = 'admin'
    )
);
CREATE POLICY "admin_todo" ON solicitudes FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM usuarios u
        WHERE u.id = auth.uid()
            AND u.rol = 'admin'
    )
);
CREATE POLICY "admin_todo" ON cortes FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM usuarios u
        WHERE u.id = auth.uid()
            AND u.rol = 'admin'
    )
);
CREATE POLICY "admin_todo" ON flota_maestra FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM usuarios u
        WHERE u.id = auth.uid()
            AND u.rol = 'admin'
    )
);
CREATE POLICY "admin_todo_catalogo" ON catalogo_dispositivos FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM usuarios u
        WHERE u.id = auth.uid()
            AND u.rol = 'admin'
    )
);
CREATE POLICY "admin_todo_planes" ON planes_claro FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM usuarios u
        WHERE u.id = auth.uid()
            AND u.rol = 'admin'
    )
);
-- Usuarios solo ven sus propias solicitudes
CREATE POLICY "usuario_propio" ON solicitudes FOR
SELECT TO authenticated USING (usuario_id = auth.uid());
CREATE POLICY "usuario_insert" ON solicitudes FOR
INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());
-- Usuarios pueden ver su propio perfil
CREATE POLICY "usuario_ver_propio" ON usuarios FOR
SELECT TO authenticated USING (id = auth.uid());