"use client";
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ── Tipos ─────────────────────────────────────────────────────────────────────
export interface ConfigItem {
    id: string;
    lista: string;
    valor: string;
    orden: number;
    activo: boolean;
}

interface ConfigListasValue {
    items: ConfigItem[];
    loading: boolean;
    /** Devuelve los valores activos de una lista, ordenados */
    getList: (lista: string) => string[];
    /** Refresca desde Supabase */
    reload: () => Promise<void>;
}

const ConfigListasContext = createContext<ConfigListasValue>({
    items: [],
    loading: true,
    getList: () => [],
    reload: async () => {},
});

export function ConfigListasProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<ConfigItem[]>([]);
    const [loading, setLoading] = useState(true);

    const reload = useCallback(async () => {
        const { data } = await supabase
            .from("config_listas")
            .select("*")
            .eq("activo", true)
            .order("lista")
            .order("orden");
        if (data) setItems(data as ConfigItem[]);
        setLoading(false);
    }, []);

    useEffect(() => { reload(); }, [reload]);

    // Realtime — actualiza al instante cuando alguien edita desde ConfiguracionTab
    useEffect(() => {
        const ch = supabase
            .channel("config-listas-realtime")
            .on("postgres_changes", { event: "*", schema: "public", table: "config_listas" }, () => {
                reload();
            })
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [reload]);

    function getList(lista: string): string[] {
        return items
            .filter(i => i.lista === lista && i.activo)
            .sort((a, b) => a.orden - b.orden)
            .map(i => i.valor);
    }

    return (
        <ConfigListasContext.Provider value={{ items, loading, getList, reload }}>
            {children}
        </ConfigListasContext.Provider>
    );
}

export function useConfigListas() {
    return useContext(ConfigListasContext);
}

/** Nombres legibles de cada lista */
export const LISTA_LABELS: Record<string, string> = {
    accion_2026:    "Acciones 2026",
    estado_linea:   "Estados de línea",
    tipo_linea:     "Tipos de línea",
    portabilidad:   "Portabilidad",
    proxima_accion: "Próximas acciones",
    plan_datos:     "Planes de datos",
    revisor:        "Revisores",
};
