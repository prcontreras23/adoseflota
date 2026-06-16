"use client";
import { useMemo } from "react";
import React from "react";
import { type LineaAltice, ACCION_COLORS } from "@/lib/supabase";
import { useLineas } from "@/lib/LineasContext";

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
    respondio: number;
    pendientes: number;
    conAccion: number;
    montoTotal: number;
    lineasConMonto: number;
    lineasSinMonto: number;
}

const CRITICOS = [
    "829-521-5406",
    "829-679-7928",
    "829-755-8327",
    "829-420-7725",
];

function parseMonto(str: string): number {
    if (!str) return 0;
    const num = parseFloat(str.replace(/[^0-9.]/g, ""));
    return isNaN(num) ? 0 : num;
}

function calcStats(rows: LineaAltice[]): Stats {
    const confirmadas = rows.filter(r => r.estado === "CONFIRMADA" || r.estado === "OK").length;
    const porConfirmar = rows.filter(r => r.estado === "POR CONFIRMAR").length;
    const respondio = rows.filter(r => r.estado === "RESPONDIÓ").length;
    const pendientes = rows.filter(r =>
        r.estado === "PENDIENTE" || r.estado === "SIN RESPUESTA" || !r.estado
    ).length;

    const conMonto = rows.filter(r => parseMonto(r.monto_mensual) > 0);
    const montoTotal = conMonto.reduce((acc, r) => acc + parseMonto(r.monto_mensual), 0);

    return {
        total: rows.length,
        bajas: rows.filter(r => r.accion_2026 === "BAJA").length,
        altas: rows.filter(r => r.accion_2026 === "ALTA").length,
        cambios: rows.filter(r => r.accion_2026 === "CAMBIO SOLICITADO").length,
        revisar: rows.filter(r => r.accion_2026 === "REVISAR").length,
        seMantiene: rows.filter(r => r.accion_2026 === "SE MANTIENE").length,
        sinTitular: rows.filter(r => !r.titular_responsable || r.titular_responsable.includes("SIN TITULAR")).length,
        criticos: rows.filter(r => CRITICOS.includes(r.telefono)).length,
        confirmadas,
        porConfirmar,
        respondio,
        pendientes,
        conAccion: rows.filter(r => r.accion_2026 && r.accion_2026 !== "REVISAR").length,
        montoTotal,
        lineasConMonto: conMonto.length,
        lineasSinMonto: rows.length - conMonto.length,
    };
}

function formatRD(amount: number): string {
    return new Intl.NumberFormat("es-DO", {
        style: "currency",
        currency: "DOP",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

export default function DashboardTab() {
    const { lineas, loading, reload } = useLineas();
    const stats = useMemo(() => calcStats(lineas), [lineas]);

    const StatCard = ({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) => (
        <div className={`rounded-2xl p-4 flex items-center gap-4 ${color}`}>
            <span className="shrink-0">{icon}</span>
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

    if (!stats) return null;

    const pctConfirmadas = stats.total > 0 ? Math.round((stats.confirmadas / stats.total) * 100) : 0;
    const pctPorConfirmar = stats.total > 0 ? Math.round((stats.porConfirmar / stats.total) * 100) : 0;
    const pctRespondio = stats.total > 0 ? Math.round((stats.respondio / stats.total) * 100) : 0;
    const pctPendientes = Math.max(0, 100 - pctConfirmadas - pctPorConfirmar - pctRespondio);
    const pctGestionadas = pctConfirmadas + pctPorConfirmar + pctRespondio;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white">Renovación Flota 2026 — ADOSE</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        Contrato Altice · {stats.total} registros · {new Date().toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                </div>
                <button onClick={reload}
                    className="text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> Actualizar
                </button>
            </div>

            {/* ── BARRA DE PROGRESO DE GESTIÓN ────────────────────────── */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                <div className="flex items-start justify-between mb-3 gap-4">
                    <div>
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Progreso de gestión</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {stats.confirmadas} confirmadas · {stats.porConfirmar} por confirmar · {stats.respondio} respondieron · {stats.pendientes} pendientes
                        </p>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-3xl font-black text-slate-800 dark:text-white leading-none">
                            {pctGestionadas}<span className="text-lg font-semibold text-slate-400">%</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">gestionadas</p>
                    </div>
                </div>

                {/* Barra segmentada */}
                <div className="w-full h-4 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden flex">
                    {pctConfirmadas > 0 && (
                        <div className="h-full bg-emerald-500 transition-all duration-700"
                            style={{ width: `${pctConfirmadas}%` }} title={`Confirmadas: ${stats.confirmadas}`} />
                    )}
                    {pctPorConfirmar > 0 && (
                        <div className="h-full bg-blue-400 transition-all duration-700"
                            style={{ width: `${pctPorConfirmar}%` }} title={`Por confirmar: ${stats.porConfirmar}`} />
                    )}
                    {pctRespondio > 0 && (
                        <div className="h-full bg-amber-400 transition-all duration-700"
                            style={{ width: `${pctRespondio}%` }} title={`Respondió: ${stats.respondio}`} />
                    )}
                    {pctPendientes > 0 && (
                        <div className="h-full bg-slate-200 dark:bg-slate-600 transition-all duration-700"
                            style={{ width: `${pctPendientes}%` }} />
                    )}
                </div>

                {/* Leyenda */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
                    {[
                        { color: "bg-emerald-500", label: "Confirmadas", count: stats.confirmadas },
                        { color: "bg-blue-400",    label: "Por confirmar", count: stats.porConfirmar },
                        { color: "bg-amber-400",   label: "Respondió",    count: stats.respondio },
                        { color: "bg-slate-300 dark:bg-slate-600", label: "Pendientes", count: stats.pendientes },
                    ].map(item => (
                        <span key={item.label} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <span className={`w-2.5 h-2.5 rounded-full inline-block ${item.color}`} />
                            {item.label} ({item.count})
                        </span>
                    ))}
                </div>
            </div>

            {/* ── PROYECCIÓN DE COSTO MENSUAL ─────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div>
                    <div>
                        <p className="text-xs font-semibold text-blue-100 uppercase tracking-wider mb-0.5">Proyección mensual total</p>
                        <p className="text-3xl font-black text-white leading-none">
                            {stats.montoTotal > 0 ? formatRD(stats.montoTotal) : "Sin datos aún"}
                        </p>
                        <p className="text-xs text-blue-200 mt-1">
                            Basado en {stats.lineasConMonto} líneas con monto definido
                            {stats.lineasSinMonto > 0 && ` · ${stats.lineasSinMonto} aún sin precio`}
                        </p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 flex flex-col justify-between">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Promedio por línea</p>
                    <p className="text-2xl font-black text-slate-800 dark:text-white mt-2">
                        {stats.lineasConMonto > 0
                            ? formatRD(Math.round(stats.montoTotal / stats.lineasConMonto))
                            : "—"}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                        {stats.lineasSinMonto > 0
                            ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle",marginRight:3}}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>{stats.lineasSinMonto} sin cotización</>
                            : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle",marginRight:3}}><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.1 9 11.1"/></svg>Todas cotizadas</>}
                    </p>
                </div>
            </div>

            {/* ── ACCIONES 2026 ───────────────────────────────────────── */}
            <div>
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Acciones 2026</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <StatCard label="Total registros" value={stats.total} icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>} color="bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-white" />
                    <StatCard label="Bajas" value={stats.bajas} icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>} color="bg-rose-50 text-rose-800 dark:bg-rose-900/20 dark:text-rose-300" />
                    <StatCard label="Altas solicitadas" value={stats.altas} icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>} color="bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300" />
                    <StatCard label="Cambios" value={stats.cambios} icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>} color="bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300" />
                    <StatCard label="A revisar" value={stats.revisar} icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} color="bg-orange-50 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300" />
                </div>
            </div>

            {/* ── ALERTAS ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 flex items-center gap-3">
                    <span className="shrink-0"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></span>
                    <div>
                        <p className="font-bold text-rose-700 dark:text-rose-400">{stats.criticos} casos críticos abiertos</p>
                        <p className="text-xs text-rose-600 dark:text-rose-500">Requieren llamada o reunión urgente</p>
                    </div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-center gap-3">
                    <span className="shrink-0"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
                    <div>
                        <p className="font-bold text-amber-700 dark:text-amber-400">{stats.sinTitular} líneas sin titular identificado</p>
                        <p className="text-xs text-amber-600 dark:text-amber-500">Requieren regularización antes del cierre</p>
                    </div>
                </div>
            </div>

            {/* ── DISTRIBUCIÓN POR TIPO ───────────────────────────────── */}
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

            {/* ── GRÁFICO DE DISPOSITIVOS ─────────────────────────────── */}
            <div>
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
                    Dispositivos solicitados 2026
                </h3>
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                    {(() => {
                        const conteo = Object.entries(
                            lineas.reduce((acc, r) => {
                                const d = r.dispositivo_2026?.trim() || "Sin especificar";
                                acc[d] = (acc[d] || 0) + 1;
                                return acc;
                            }, {} as Record<string, number>)
                        ).sort((a, b) => b[1] - a[1]).slice(0, 12);

                        const max = Math.max(...conteo.map(([, n]) => n), 1);

                        const COLORES = [
                            "bg-blue-500",
                            "bg-emerald-500",
                            "bg-violet-500",
                            "bg-amber-500",
                            "bg-rose-500",
                            "bg-cyan-500",
                            "bg-orange-500",
                            "bg-teal-500",
                            "bg-pink-500",
                            "bg-indigo-500",
                            "bg-lime-500",
                            "bg-slate-400",
                        ];

                        return (
                            <div className="space-y-2.5">
                                {conteo.map(([dispositivo, cantidad], i) => (
                                    <div key={dispositivo} className="flex items-center gap-3">
                                        <div className="w-44 text-xs text-slate-600 dark:text-slate-300 truncate shrink-0 text-right" title={dispositivo}>
                                            {dispositivo}
                                        </div>
                                        <div className="flex-1 flex items-center gap-2">
                                            <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-6 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${COLORES[i % COLORES.length]} transition-all duration-500 flex items-center justify-end pr-2`}
                                                    style={{ width: `${Math.max((cantidad / max) * 100, 4)}%` }}
                                                >
                                                </div>
                                            </div>
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 w-6 text-right shrink-0">
                                                {cantidad}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* ── CASOS CRÍTICOS ──────────────────────────────────────── */}
            {lineas.some(r => CRITICOS.includes(r.telefono)) && (
                <div>
                    <h3 className="text-xs font-bold text-rose-500 uppercase tracking-widest mb-3 flex items-center gap-1.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> Casos críticos abiertos</h3>
                    <div className="space-y-2">
                        {lineas.filter(r => CRITICOS.includes(r.telefono)).map(r => (
                            <div key={r.telefono} className="bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800 rounded-2xl p-4">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <span className="font-bold text-slate-800 dark:text-white">{r.usuario_linea}</span>
                                    <span className="font-mono text-xs text-slate-500">{r.telefono}</span>
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ACCION_COLORS[r.accion_2026] ?? "bg-slate-100 text-slate-500"}`}>
                                        {r.accion_2026 || "—"}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-300">{r.proxima_accion || r.observaciones}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
