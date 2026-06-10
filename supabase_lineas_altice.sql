-- ============================================================
-- TABLA: lineas_altice
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

create table if not exists public.lineas_altice (
  id                  uuid primary key default gen_random_uuid(),
  telefono            text not null unique,
  usuario_linea       text not null default '',
  titular_responsable text not null default '',
  tipo                text not null default '',
  accion_2026         text not null default '',
  detalle_origen      text not null default '',
  gb_antes            text not null default '',
  gb_solicitado       text not null default '',
  min_antes           text not null default '',
  min_solicitados     text not null default '',
  dispositivo_2026    text not null default '',
  estado              text not null default '',
  proxima_accion      text not null default '',
  observaciones       text not null default '',
  seguimiento         text not null default '',
  updated_at          timestamptz not null default now()
);

-- Trigger para actualizar updated_at automáticamente
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger lineas_altice_updated_at
  before update on public.lineas_altice
  for each row execute function public.set_updated_at();

-- Row Level Security: deshabilitar (solo tú accedes)
alter table public.lineas_altice disable row level security;

-- Índices útiles
create index if not exists idx_lineas_accion     on public.lineas_altice (accion_2026);
create index if not exists idx_lineas_titular    on public.lineas_altice (titular_responsable);
create index if not exists idx_lineas_estado     on public.lineas_altice (estado);
