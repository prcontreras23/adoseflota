"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase, formatRD, formatDate, ESTADO_LABELS, type Solicitud, type Usuario } from "@/lib/supabase";
import toast from "react-hot-toast";

const ESTADO_CLASS: Record<string, string> = {
    pendiente: "status-pendiente",
    enviado: "status-enviado",
    transito: "status-transito",
    recibido: "status-recibido",
    "listo-entrega": "status-listo-entrega",
    entregado: "status-entregado",
    cancelado: "status-cancelado",
};

export default function MisSolicitudesPage() {
    const router = useRouter();
    const [user, setUser] = useState<Usuario | null>(null);
    const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) { router.push("/login"); return; }
        const { data: userData } = await supabase.from("usuarios").select("*").eq("id", authUser.id).single();
        if (!userData) { router.push("/login"); return; }
        setUser(userData);

        const { data } = await supabase
            .from("solicitudes")
            .select("*, planes_claro(*), catalogo_dispositivos(*)")
            .eq("usuario_id", authUser.id)
            .order("created_at", { ascending: false });

        setSolicitudes(data ?? []);
        setLoading(false);
    }, [router]);

    useEffect(() => { loadData(); }, [loadData]);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <a href="/catalogo" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">← Catálogo</a>
                        <h1 className="font-bold text-slate-800 dark:text-white">Mis Solicitudes</h1>
                    </div>
                    <button onClick={() => { supabase.auth.signOut(); router.push("/login"); }}
                        className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg">Salir</button>
                </div>
            </header>

            <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
                {solicitudes.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="flex justify-center mb-3"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></div>
                        <p className="text-slate-600 dark:text-slate-400 font-medium">No tienes solicitudes aún</p>
                        <a href="/catalogo" className="text-blue-600 dark:text-blue-400 text-sm hover:underline mt-2 inline-block">Ver catálogo →</a>
                    </div>
                ) : (
                    solicitudes.map(s => (
                        <div key={s.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 animate-fade-in">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <span className="font-mono text-blue-600 dark:text-blue-400 font-bold text-sm">{s.id}</span>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{formatDate(s.fecha)}</p>
                                </div>
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ESTADO_CLASS[s.estado] ?? ""}`}>
                                    {ESTADO_LABELS[s.estado]}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                    <p className="text-slate-400 dark:text-slate-500 text-xs">Dispositivo</p>
                                    <p className="font-medium text-slate-700 dark:text-slate-200">{s.catalogo_dispositivos?.modelo ?? "—"}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 dark:text-slate-500 text-xs">Plan</p>
                                    <p className="font-medium text-slate-700 dark:text-slate-200">{s.planes_claro?.nombre ?? "—"}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 dark:text-slate-500 text-xs">Precio equipo</p>
                                    <p className="font-medium text-slate-700 dark:text-slate-200">{formatRD(s.precio_equipo)}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 dark:text-slate-500 text-xs">Área</p>
                                    <p className="font-medium text-slate-700 dark:text-slate-200">{s.area}</p>
                                </div>
                            </div>
                            {s.justificacion && (
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-3 border-t border-slate-100 dark:border-slate-700 pt-3 italic">"{s.justificacion}"</p>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
