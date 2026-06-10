import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const envFile = fs.readFileSync(".env.local", "utf8");
const env: Record<string, string> = {};
envFile.split("\n").forEach((line) => {
    const parts = line.split("=");
    if (parts.length >= 2) env[parts[0]] = parts.slice(1).join("=");
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const nuevasOpcionesDispositivos = [
    { modelo: "iPhone 17 Pro Max 256GB", categoria: "Premium", precio_rd: 108495, destacado: true, disponible: true },
    { modelo: "Samsung S25 Ultra 512GB", categoria: "Premium", precio_rd: 93095, destacado: true, disponible: true },
    { modelo: "iPhone 17 256GB", categoria: "Premium", precio_rd: 72395, destacado: true, disponible: true },
    { modelo: "iPhone 17 Pro 256GB", categoria: "Premium", precio_rd: 99445, destacado: true, disponible: true },
    { modelo: "Samsung A56 256GB", categoria: "Mid-range", precio_rd: 32395, destacado: true, disponible: true },
    { modelo: "Honor 400 5G 512GB", categoria: "Premium", precio_rd: 37745, destacado: false, disponible: true },
    { modelo: "Motorola G85 256GB", categoria: "Mid-range", precio_rd: 21895, destacado: false, disponible: true },
    { modelo: "Samsung A26 5G 256GB", categoria: "Mid-range", precio_rd: 20445, destacado: false, disponible: true },
    { modelo: "Honor 400 5G", categoria: "Mid-range", precio_rd: 16095, destacado: false, disponible: true },
    { modelo: "Honor 400 Lite 256GB", categoria: "Mid-range", precio_rd: 16095, destacado: false, disponible: true },
    { modelo: "Honor 90 smart 5G 256GB", categoria: "Mid-range", precio_rd: 18045, destacado: false, disponible: true },
    { modelo: "Motorola G56 256GB", categoria: "Mid-range", precio_rd: 17995, destacado: false, disponible: true },
    { modelo: "Samsung A07 128GB", categoria: "Basico", precio_rd: 8395, destacado: false, disponible: true },
    { modelo: "Honor X5B 128GB", categoria: "Basico", precio_rd: 6945, destacado: false, disponible: true },
    { modelo: "Xiaomi Redmi A5", categoria: "Basico", precio_rd: 6745, destacado: false, disponible: true },
    { modelo: "Motorola G06 128GB", categoria: "Basico", precio_rd: 6495, destacado: true, disponible: true },
    { modelo: "Motorola G06 4G 128GB", categoria: "Basico", precio_rd: 6495, destacado: false, disponible: true },
    { modelo: "TCL ONE TOUCH", categoria: "Basico", precio_rd: 1845, destacado: false, disponible: true },
];

const nuevosPlanes = [
    { nombre: "Internet Flota Apps Plus 10", tipo: "Voz y Datos", precio_mensual: 1995, datos_gb: 15, descripcion: "10GB + Bono 5GB", activo: true },
    { nombre: "Internet Flota Bloqueo Plus 10", tipo: "Voz y Datos", precio_mensual: 1695, datos_gb: 15, descripcion: "10GB + Bono 5GB", activo: true },
    { nombre: "Internet Flota Apps Plus 15", tipo: "Voz y Datos", precio_mensual: 2195, datos_gb: 15, descripcion: "15GB + Bono", activo: true },
    { nombre: "Internet Flota Bloqueo Plus 15", tipo: "Voz y Datos", precio_mensual: 4295, datos_gb: 20, descripcion: "15GB + Bono 5GB", activo: true },
    { nombre: "Internet Flota Apps Plus 5", tipo: "Voz y Datos", precio_mensual: 1395, datos_gb: 7, descripcion: "5GB + Bono 2GB", activo: true },
    { nombre: "Internet Flota Bloqueo Plus 5", tipo: "Voz y Datos", precio_mensual: 1295, datos_gb: 7, descripcion: "5GB + Bono 2GB", activo: true },
    { nombre: "Internet Flota Bloqueo Plus 2", tipo: "Voz y Datos", precio_mensual: 1095, datos_gb: 3, descripcion: "2GB + Bono 1GB", activo: true },
    { nombre: "Internet Movil Flota APPs 50 GB", tipo: "Datos", precio_mensual: 260, datos_gb: 50, descripcion: "con tope de 50 GB", activo: true },
    { nombre: "Internet Movil Flota APPs 25 GB", tipo: "Datos", precio_mensual: 795, datos_gb: 25, descripcion: "con tope de 50 GB", activo: true },
    { nombre: "Unidades de Flota Libre", tipo: "Voz", precio_mensual: 645, datos_gb: 0, descripcion: "", activo: true },
    { nombre: "Paquete 2,000 minutos", tipo: "Voz", precio_mensual: 4100, datos_gb: 0, descripcion: "", activo: true }
];

async function updateDB() {
    console.log("Emptying devices table...");
    const { data: devices } = await supabase.from('catalogo_dispositivos').select('id');
    if (devices && devices.length > 0) {
        await supabase.from('catalogo_dispositivos').delete().in('id', devices.map(d => d.id));
    }

    console.log("Emptying planes table...");
    const { data: plans } = await supabase.from('planes_claro').select('id');
    if (plans && plans.length > 0) {
        const res = await supabase.from('planes_claro').delete().in('id', plans.map(p => p.id));
    }

    console.log("Inserting new devices...");
    const { error: err1 } = await supabase.from('catalogo_dispositivos').insert(nuevasOpcionesDispositivos);
    if (err1) console.error("Error inserting devices:", err1);

    console.log("Inserting new plans...");
    const { error: err2 } = await supabase.from('planes_claro').insert(nuevosPlanes);
    if (err2) console.error("Error inserting plans:", err2);

    console.log("Done checking rows!");
}

updateDB();
