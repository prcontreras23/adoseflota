"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase, formatDate, type Corte } from "@/lib/supabase";
import toast from "react-hot-toast";

export default function CortesTab() {
    const [cortes, setCortes] = useState<Corte[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        const { data } = await supabase.from("cortes").select("*").order("fecha_corte", { ascending: false });
        setCortes(data ?? []);
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    async function updateEstado(id: string, estado: string) {
        const updates: Record<string, unknown> = { estado };
        if (estado === "enviado") updates.fecha_envio_claro = new Date().toISOString();
        const { error } = await supabase.from("cortes").update(updates).eq("id", id);
        if (error) toast.error("Error al actualizar");
        else { toast.success("Corte actualizado"); loadData(); }
    }

    if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Historial de Cortes</h2>
                <span className="text-sm text-slate-500 dark:text-slate-400">{cortes.length} cortes registrados</span>
            </div>

            {cortes.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 py-20 text-center">
                    <p className="mb-3"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></p>
                    <p className="text-slate-500 dark:text-slate-400">No hay cortes generados aún</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Ve a "Solicitudes" y selecciona solicitudes pendientes para generar un corte</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {cortes.map(c => (
                        <div key={c.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 animate-fade-in">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white font-mono">{c.id}</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                        {c.total_solicitudes} solicitudes · Generado: {formatDate(c.fecha_corte)}
                                        {c.fecha_envio_claro && ` · Enviado: ${formatDate(c.fecha_envio_claro)}`}
                                    </p>
                                    {c.notas && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 italic">{c.notas}</p>}
                                </div>
                                <div className="flex items-center gap-3">
                                    <select value={c.estado}
                                        onChange={e => updateEstado(c.id, e.target.value)}
                                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-xl border cursor-pointer focus:outline-none ${c.estado === "confirmado" ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800" :
                                                c.estado === "enviado" ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800" :
                                                    "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800"
                                            }`}>
                                        <option value="pendiente">Pendiente</option>
                                        <option value="enviado">Enviado a Claro</option>
                                        <option value="confirmado">Confirmado</option>
                                    </select>
                                </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {c.solicitudes_ids.map(sid => (
                                    <span key={sid} className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-mono">{sid}</span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
