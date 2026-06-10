"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase, type LineaAltice, ACCION_COLORS } from "@/lib/supabase";
import toast from "react-hot-toast";

interface Stats {
    total: number;
    bajas: number;
    altas: number;
    cambios: number;
    revisar: number;
    seMantiene: number;
    sinTitular: number;
    criticos: number;
    confirmadas: number;
    porConfirmar: number;
    pendientes: number;
}

const CRITICOS = [
    "829-521-5406",
    "829-679-7928",
    "829-755-8327",
    "829-420-7725",
];

function calcStats(rows: LineaAltice[]): Stats {
    return {
        total: rows.length,
        bajas: rows.filter(r => r.accion_2026 === "BAJA").length,
        altas: rows.filter(r => r.accion_2026 === "ALTA").length,
        cambios: rows.filter(r => r.accion_2026 === "CAMBIO SOLICITADO").length,
        revisar: rows.filter(r => r.accion_2026 === "REVISAR").length,
        seMantiene: rows.filter(r => r.accion_2026 === "SE MANTIENE").length,
        sinTitular: rows.filter(r => !r.titular_responsable || r.titular_responsable.includes("SIN TITULAR")).length,
        criticos: rows.filter(r => CRITICOS.includes(r.telefono)).length,
        confirmadas: rows.filter(r => r.estado === "CONFIRMADA" || r.estado === "OK").length,
        porConfirmar: rows.filter(r => r.estado === "POR CONFIRMAR").length,
        pendientes: rows.filter(r => r.estado === "PENDIENTE" || r.estado === "SIN RESPUESTA" || r.estado === "").length,
    };
}

export default function DashboardTab() {
    const [lineas, setLineas] = useState<LineaAltice[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<Stats | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase.from("lineas_altice").select("*");
        if (error) { toast.error("Error cargando datos"); setLoading(false); return; }
        const rows = (data ?? []) as LineaAltice[];
        setLineas(rows);
        setStats(calcStats(rows));
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const StatCard = ({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) => (
        <div className={`rounded-2xl p-4 flex items-center gap-4 ${color}`}>
            <span className="text-3xl">{icon}</span>
            <div>
                <p className="text-2xl font-black leading-none">{value}</p>
                <p className="text-xs font-semibold opacity-80 mt-0.5">{label}</p>
            </div>
        </div>
    );

    if (loading) return (
        <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white">Renovación Flota 2026 — ADOSE</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        Contrato Altice · {stats?.total ?? 0} registros · Actualizado: {new Date().toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                </div>
                <button onClick={loadData}
                    className="text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-xl font-medium transition-colors">
                    🔄 Actualizar
                </button>
            </div>

            {stats && lineas.length > 0 && (
                <>
                    {/* Acciones 2026 */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Acciones 2026</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                            <StatCard label="Total registros" value={stats.total} icon="📱" color="bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-white" />
                            <StatCard label="Bajas" value={stats.bajas} icon="🛑" color="bg-rose-50 text-rose-800 dark:bg-rose-900/20 dark:text-rose-300" />
                            <StatCard label="Altas solicitadas" value={stats.altas} icon="➕" color="bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300" />
                            <StatCard label="Cambios" value={stats.cambios} icon="🔄" color="bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300" />
                            <StatCard label="A revisar" value={stats.revisar} icon="⚠️" color="bg-orange-50 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300" />
                        </div>
                    </div>

                    {/* Estado de gestión */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Estado de gestión</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <StatCard label="Se mantienen" value={stats.seMantiene} icon="✅" color="bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200" />
                            <StatCard label="Confirmadas" value={stats.confirmadas} icon="✔️" color="bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300" />
                            <StatCard label="Por confirmar" value={stats.porConfirmar} icon="⌛" color="bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300" />
                            <StatCard label="Pendientes / Sin respuesta" value={stats.pendientes} icon="🔴" color="bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300" />
                        </div>
                    </div>

                    {/* Alertas */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 flex items-center gap-3">
                            <span className="text-2xl">🛑</span>
                            <div>
                                <p className="font-bold text-rose-700 dark:text-rose-400">{stats.criticos} casos críticos abiertos</p>
                                <p className="text-xs text-rose-600 dark:text-rose-500">Requieren llamada o reunión urgente</p>
                            </div>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-center gap-3">
                            <span className="text-2xl">⚠️</span>
                            <div>
                                <p className="font-bold text-amber-700 dark:text-amber-400">{stats.sinTitular} líneas sin titular identificado</p>
                                <p className="text-xs text-amber-600 dark:text-amber-500">Requieren regularización antes del cierre</p>
                            </div>
                        </div>
                    </div>

                    {/* Distribución por tipo */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Distribución por tipo</h3>
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                {Object.entries(
                                    lineas.reduce((acc, r) => {
                                        const tipo = r.tipo || "Sin tipo";
                                        acc[tipo] = (acc[tipo] || 0) + 1;
                                        return acc;
                                    }, {} as Record<string, number>)
                                ).sort((a, b) => b[1] - a[1]).map(([tipo, cnt]) => (
                                    <div key={tipo} className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 rounded-xl px-3 py-2">
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{tipo}</span>
                                        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{cnt}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Casos críticos */}
                    <div>
                        <h3 className="text-xs font-bold text-rose-500 uppercase tracking-widest mb-3">🛑 Casos críticos abiertos</h3>
                        <div className="space-y-2">
                            {lineas.filter(r => CRITICOS.includes(r.telefono)).map(r => (
                                <div key={r.telefono} className="bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800 rounded-2xl p-4">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <span className="font-bold text-slate-800 dark:text-white">{r.usuario_linea}</span>
                                        <span className="font-mono text-xs text-slate-500">{r.telefono}</span>
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ACCION_COLORS[r.accion_2026] ?? "bg-slate-100 text-slate-500"}`}>{r.accion_2026 || "—"}</span>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-300">{r.proxima_accion || r.observaciones}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
