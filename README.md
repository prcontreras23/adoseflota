# Sistema de Gestión de Flota Móvil ADOSE 2026

Plataforma integral para la gestión, solicitud y entrega de la nueva flota de dispositivos móviles Claro 2026 para la Asociación Dominicana del Sureste (ADOSE) / Unión Adventista Sureste.

## ✨ Características

- **Catálogo Interactivo**: Visualización de equipos destacados con especificaciones y acceso al PDF completo de Claro.
- **Sistema de Solicitudes**: Formulario fácil para que los usuarios elijan equipo, plan y suban su justificación.
- **Panel Administrativo (Dashboard)**:
  - **Solicitudes**: Aprobación masiva y exportación automática a Excel para enviar a Claro (Cortes).
  - **Recepción**: Ingreso fácil de IMEI, SIM, número y cálculo automático del "Cambiazo 18 meses".
  - **Entregas**: Generación de acta de entrega en PDF y **Firma Digital (Canvas)** en pantalla.
  - **Flota Maestra**: Control total de líneas habilitadas, vista de estados e importación inicial desde Excel.
  - **Usuarios**: Gestión de cuentas de usuario, generación de contraseñas automáticas y roles (Admin/Usuario).
  - **Catálogo Admin**: Agrega/edita/elimina dispositivos al catálogo y decide cuáles 6 se muestran como principales.

## 🚀 Tecnologías

- **Framework**: Next.js 15 (App Router)
- **Base de Datos & Auth**: Supabase (PostgreSQL serverless)
- **UI/Estilos**: Tailwind CSS + Shadcn UI + Glassmorphism UX
- **Hosting recomendado**: Vercel

---

## 🛠️ Guía de Instalación y Configuración (Paso a Paso)

### 1. Preparar Supabase (Base de Datos)

1. Ve a [Supabase.com](https://supabase.com) y crea una cuenta gratuita.
2. Crea un nuevo proyecto (ej. `adose-flotas-2026`).
3. Ve a **Settings > API** y copia la `URL` y la `anon` key.
4. En este proyecto local, abre el archivo `.env.local.example`, copia su contenido y crea un nuevo archivo llamado `.env.local`. Pega las claves ahí.
5. Abre el **SQL Editor** en Supabase y ejecuta **todo** el contenido del archivo `supabase/schema.sql`. Esto creará las tablas y reglas de seguridad.
6. Luego ejecuta el contenido del archivo `supabase/seed.sql`. Esto insertará los planes de Claro y los celulares base.
7. Ve a **Authentication > Providers** y asegúrate de que **Email** esté activado (Email Confirmations *apagado* para empezar más rápido si quieres).

### 2. Ejecutar el Proyecto

\`\`\`bash

# 1. Instala las dependencias

npm install

# (Si hay conflictos de version usar: npm install --legacy-peer-deps)

# 2. Levanta el servidor local

npm run dev
\`\`\`
Visita [http://localhost:3000](http://localhost:3000)

### 3. Crear el primer Administrador

Por la seguridad de Supabase, debes crear tu propio administrador principal la primera vez:

1. Ve al panel de Supabase > **Authentication > Users** y agrega tu correo de administrador (ej. `secretariosureste23@gmail.com`).
2. Luego ve al panel **Table Editor > usuarios**. Revisa que tu usuario esté ahí (o agrégalo) y asegúrate de que la columna `rol` diga `admin`.
3. ¡Listo! Ya puedes iniciar sesión en el localhost con tu correo y contraseña, y verás el Dashboard completo.

### 4. Despliegue en Vercel

1. Sube este código a GitHub.
2. Ve a [Vercel.com](https://vercel.com) y selecciona "Import Project".
3. En la configuración del deploy en Vercel, agrega las **Environment Variables** (`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. Haz clic en **Deploy**. El archivo `vercel.json` incluido se encargará del resto.
