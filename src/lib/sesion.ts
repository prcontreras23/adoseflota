import { supabase } from "./supabase";

// Flota entra con el usuario de SIGA (Supabase Auth). Como las dos apps viven en
// el mismo dominio (siga.adventistassureste.org y /flota), la sesión de
// supabase-js se comparte sola: quien entró a SIGA ya está dentro de Flota.
//
// Las pestañas de cada persona viven en flota.accesos y las devuelve
// flota.mi_acceso(). Quien tiene gestionar_usuarios en SIGA es administrador.
// La base hace cumplir los permisos (RLS); esto solo decide qué se muestra.

export interface SesionFlota {
    id: string;
    nombre: string;
    es_admin: boolean;
    permisos: string[]; // ids de pestañas, mismo nombre que usaba access_pins
}

export type EstadoSesion =
    | { estado: "sin-sesion" }
    | { estado: "sin-acceso"; nombre: string }
    | { estado: "ok"; sesion: SesionFlota };

export async function cargarSesion(): Promise<EstadoSesion> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        localStorage.removeItem("flota_session");
        return { estado: "sin-sesion" };
    }
    const { data, error } = await supabase.rpc("mi_acceso");
    if (error || !data) {
        localStorage.removeItem("flota_session");
        return { estado: "sin-sesion" };
    }
    if (!data.puede_entrar) {
        localStorage.removeItem("flota_session");
        return { estado: "sin-acceso", nombre: data.nombre ?? "" };
    }
    const sesion: SesionFlota = {
        id: data.id,
        nombre: data.nombre ?? "",
        es_admin: !!data.es_admin,
        permisos: Array.isArray(data.pestanas) ? data.pestanas : [],
    };
    // Varias pestañas leen el nombre de aquí para mostrarlo. No da permisos:
    // el autor de historial, notas y documentos lo pone la base.
    localStorage.setItem("flota_session", JSON.stringify(sesion));
    return { estado: "ok", sesion };
}

export async function cerrarSesion() {
    localStorage.removeItem("flota_session");
    // Cierra también la sesión de SIGA: es la misma.
    await supabase.auth.signOut();
}
