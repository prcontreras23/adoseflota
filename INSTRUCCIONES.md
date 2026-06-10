# ADOSE Flota 2026 — Instrucciones de puesta en marcha

> ✅ **Supabase ya está configurado** — la tabla existe y las 190 líneas están cargadas.
> El archivo `.env.local` ya tiene las credenciales correctas del proyecto **ADOSE Flota 2026**.

## Solo necesitas:

```bash
cd adose-flota-2026
npm install
npm run dev
```

Luego abre: **http://localhost:3000/admin/solicitudes**

---

## Si necesitas reimportar los datos desde cero

1. En la pestaña **📊 Resumen**, presiona **"Importar Cuadro Maestro"**
2. Borrará todo y volverá a cargar las 192 líneas del código fuente

---

## Credenciales Supabase (proyecto ADOSE Flota 2026)

- **Project URL:** `https://pombitgkyojttbtoqvkh.supabase.co`
- **Proyecto ID:** `pombitgkyojttbtoqvkh`
- El archivo `.env.local` ya contiene estas credenciales

---

## Uso de la plataforma

| Pestaña | Para qué sirve |
|---------|---------------|
| 📊 Resumen | KPIs, estadísticas, casos críticos |
| 📱 Líneas | Tabla completa con filtros y edición inline |
| 👤 Perfiles | Agrupado por titular, todas sus líneas |
| ✅ Acciones | Lista de próximas acciones (llamar, carta, cancelar) |
| 📋 Flota Maestra | Registro maestro anterior (Claro) |
| 👥 Usuarios | Gestión de accesos |

## Campos editables

- **Acción 2026**: BAJA / ALTA / CAMBIO SOLICITADO / SE MANTIENE / REVISAR
- **Estado**: CONFIRMADA / POR CONFIRMAR / PENDIENTE / OK / RESPONDIÓ / SIN RESPUESTA
- **Seguimiento**: campo libre para notas, clic para editar
- **Próxima acción**: editable en la vista expandida de cada línea

Todos los cambios se guardan automáticamente en Supabase.
