"use client";
import {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    type ReactNode,
    type Dispatch,
    type SetStateAction,
} from "react";
import { supabase, type LineaAltice } from "./supabase";

// ─────────────────────────────────────────────────────────────────────────────
// Contexto compartido de líneas Altice
//
// Fuente ÚNICA de verdad para todos los módulos (Resumen, Líneas, Perfiles,
// Acciones, Almacén). Carga los datos una sola vez, los mantiene sincronizados
// vía Supabase Realtime y expone helpers para editar con actualización óptima.
//
// Gracias a esto, cuando se cambia un estado (p. ej. «POR CONFIRMAR») en
// cualquier pestaña, el Dashboard y las demás reflejan el cambio al instante,
// incluso desde otro dispositivo o navegador.
// ─────────────────────────────────────────────────────────────────────────────

interface LineasCtx {
    lineas: LineaAltice[];
    loading: boolean;
    /** Recarga completa desde Supabase. */
    reload: () => Promise<void>;
    /** Edita una línea por id (actualización óptima local + escritura en BD). */
    mutate: (id: string, patch: Partial<LineaAltice>) => Promise<boolean>;
    /** Inserta o reemplaza una línea en el estado local (tras crearla en BD). */
    upsertLocal: (linea: LineaAltice) => void;
    /** Quita una línea del estado local (tras eliminarla en BD). */
    removeLocal: (id: string) => void;
    /** Acceso directo al setter para operaciones especiales (vínculos, lotes). */
    patchLocal: Dispatch<SetStateAction<LineaAltice[]>>;
}

const Ctx = createContext<LineasCtx | null>(null);

export function useLineas(): LineasCtx {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error("useLineas() debe usarse dentro de <LineasProvider>");
    return ctx;
}

export function LineasProvider({ children }: { children: ReactNode }) {
    const [lineas, setLineas] = useState<LineaAltice[]>([]);
    const [loading, setLoading] = useState(true);

    const reload = useCallback(async () => {
        const { data, error } = await supabase
            .from("lineas_altice")
            .select("*")
            .order("titular_responsable");
        if (!error) setLineas((data ?? []) as LineaAltice[]);
        setLoading(false);
    }, []);

    // Carga inicial
    useEffect(() => {
        reload();
    }, [reload]);

    // Suscripción Realtime — propaga cambios de cualquier origen a todos los módulos
    useEffect(() => {
        const channel = supabase
            .channel("lineas_altice_sync")
            .on(
                "postgres_changes",
                { event: "*", schema: "flota", table: "lineas_altice" },
                (payload) => {
                    setLineas((prev) => {
                        if (payload.eventType === "INSERT") {
                            const nuevo = payload.new as LineaAltice;
                            if (prev.some((r) => r.id === nuevo.id)) {
                                return prev.map((r) => (r.id === nuevo.id ? nuevo : r));
                            }
                            return [...prev, nuevo];
                        }
                        if (payload.eventType === "UPDATE") {
                            const act = payload.new as LineaAltice;
                            return prev.map((r) => (r.id === act.id ? { ...r, ...act } : r));
                        }
                        if (payload.eventType === "DELETE") {
                            const viejo = payload.old as { id?: string };
                            return viejo?.id ? prev.filter((r) => r.id !== viejo.id) : prev;
                        }
                        return prev;
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const mutate = useCallback(
        async (id: string, patch: Partial<LineaAltice>): Promise<boolean> => {
            // Actualización óptima inmediata (todas las pestañas la ven al instante)
            setLineas((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
            const { error } = await supabase.from("lineas_altice").update(patch).eq("id", id);
            if (error) {
                // Si falla, revertimos recargando desde la BD
                await reload();
                return false;
            }
            return true;
        },
        [reload]
    );

    const upsertLocal = useCallback((linea: LineaAltice) => {
        setLineas((prev) => {
            if (prev.some((r) => r.id === linea.id)) {
                return prev.map((r) => (r.id === linea.id ? linea : r));
            }
            return [...prev, linea];
        });
    }, []);

    const removeLocal = useCallback((id: string) => {
        setLineas((prev) => prev.filter((r) => r.id !== id));
    }, []);

    return (
        <Ctx.Provider
            value={{ lineas, loading, reload, mutate, upsertLocal, removeLocal, patchLocal: setLineas }}
        >
            {children}
        </Ctx.Provider>
    );
}
