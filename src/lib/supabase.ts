import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: "flota" },
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type Rol = "admin" | "usuario";
export type EstadoSolicitud =
    | "pendiente"
    | "enviado"
    | "transito"
    | "recibido"
    | "listo-entrega"
    | "entregado"
    | "cancelado";

export type Area = "Pastores" | "Empleados CEADIC" | "Familiares";

export interface Usuario {
    id: string;
    email: string;
    nombre: string;
    cargo: string;
    area: Area;
    rol: Rol;
    activo: boolean;
    created_at: string;
}

export interface PlanClaro {
    id: number;
    nombre: string;
    tipo: string;
    precio_mensual: number;
    datos_gb: number | null;
    descripcion: string;
    activo: boolean;
}

export interface Dispositivo {
    id: number;
    modelo: string;
    categoria: "Basico" | "Mid-range" | "Premium";
    precio_rd: number;
    pantalla: string;
    ram: string;
    almacenamiento: string;
    camara: string;
    bateria: string;
    disponible: boolean;
    destacado: boolean;
}

export interface Solicitud {
    id: string;
    fecha: string;
    usuario_id: string;
    nombre: string;
    cargo: string;
    area: Area;
    plan_id: number;
    dispositivo_id: number;
    precio_equipo: number;
    estado: EstadoSolicitud;
    justificacion: string;
    corte_id: string | null;
    created_at: string;
    planes_claro?: PlanClaro;
    catalogo_dispositivos?: Dispositivo;
    usuarios?: Usuario;
}

export interface FlotaMaestra {
    id: string;
    solicitud_id: string | null;
    nombre: string;
    cargo: string;
    area: Area;
    numero_telefono: string;
    imei: string;
    sim: string;
    plan_id: number | null;
    dispositivo_id: number | null;
    costo_dispositivo: number;
    fecha_entrega: string | null;
    fecha_contrato: string | null;
    fecha_cambio_18m: string | null;
    estado: string;
    notas: string;
    planes_claro?: PlanClaro;
    catalogo_dispositivos?: Dispositivo;
}

export interface Corte {
    id: string;
    fecha_corte: string;
    fecha_envio_claro: string | null;
    solicitudes_ids: string[];
    total_solicitudes: number;
    estado: string;
    notas: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const ESTADO_LABELS: Record<EstadoSolicitud, string> = {
    pendiente: "Pendiente",
    enviado: "Enviado a Claro",
    transito: "En Tránsito",
    recibido: "Recibido",
    "listo-entrega": "Listo para Entrega",
    entregado: "Entregado",
    cancelado: "Cancelado",
};

export const AREAS: Area[] = ["Pastores", "Empleados CEADIC", "Familiares"];

export function formatRD(amount: number) {
    return new Intl.NumberFormat("es-DO", {
        style: "currency",
        currency: "DOP",
        minimumFractionDigits: 0,
    }).format(amount);
}

export function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("es-DO", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

export function add18Months(dateStr: string): string {
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + 18);
    return d.toISOString().split("T")[0];
}

export async function getNextSolicitudId(): Promise<string> {
    const year = new Date().getFullYear();
    const { count } = await supabase
        .from("solicitudes")
        .select("*", { count: "exact", head: true })
        .like("id", `FL-${year}-%`);
    const next = ((count ?? 0) + 1).toString().padStart(3, "0");
    return `FL-${year}-${next}`;
}

export async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
        .from("usuarios")
        .select("*")
        .eq("id", user.id)
        .single();
    return data as Usuario | null;
}

// ─── Altice Renovation 2026 ───────────────────────────────────────────────────

export type Accion2026 = "BAJA" | "ALTA" | "CAMBIO SOLICITADO" | "SE MANTIENE" | "REVISAR" | "NO REQUIERE FLOTA" | "";
export type EstadoLinea = "CONFIRMADA" | "POR CONFIRMAR" | "PENDIENTE" | "OK" | "RESPONDIÓ" | "SIN RESPUESTA" | "";

export interface LineaAltice {
    id: string;
    telefono: string;
    usuario_linea: string;
    titular_responsable: string;
    tipo: string;
    accion_2026: string;
    detalle_origen: string;
    gb_antes: string;
    gb_solicitado: string;
    min_antes: string;
    min_solicitados: string;
    dispositivo_2026: string;
    estado: string;
    proxima_accion: string;
    observaciones: string;
    seguimiento: string;
    nota_resolucion: string;
    portabilidad: string;
    archivada: boolean;
    updated_at?: string;
    monto_mensual: string;
    cotizacion: string;
    titular_vinculado: string;
    revisado_por: string;
    imei: string;
    sim: string;
    fecha_entrega: string | null;
    entregado: boolean;
    sim_instalado: boolean;
    numero_altice?: string;
    entregado_por?: string | null;
    nota_importante?: string;
    alerta_cambio_sim?: string;
    alerta_linea_id?: string | null;
    alerta_resuelta?: boolean;
}

export interface InventarioAltice {
    id: string;
    marca: string;
    imei: string;
    sim: string;
    asignado: boolean;
    linea_id: string | null;
}

export const ACCION_COLORS: Record<string, string> = {
    "BAJA": "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    "ALTA": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    "CAMBIO SOLICITADO": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    "REVISAR": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    "SE MANTIENE": "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
    "NO REQUIERE FLOTA": "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

export const PORTABILIDAD_OPTIONS = ["", "Altice", "Claro", "Nuevo", "Baja"] as const;

export const PORTABILIDAD_COLORS: Record<string, string> = {
    "Claro":  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    "Nuevo":  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    "Baja":   "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400",
    "Altice": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

export const ESTADO_LINEA_COLORS: Record<string, string> = {
    "CONFIRMADA": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    "POR CONFIRMAR": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    "PENDIENTE": "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
    "OK": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    "RESPONDIÓ": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    "SIN RESPUESTA": "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};
