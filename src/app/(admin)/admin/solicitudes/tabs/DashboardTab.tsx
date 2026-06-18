"use client";
import { useMemo } from "react";
import React from "react";
import { type LineaAltice, ACCION_COLORS } from "@/lib/supabase";
import { useLineas } from "@/lib/LineasContext";
import { useNav } from "@/lib/NavContext";

interface Stats {
    total: number;
    bajas: number;
    altas: number;
    cambios: number;
    revisar: number;
    seMantiene: number;
    sinTitular: number;
    confirmadas: number;
    porConfirmar: number;
    respondio: number;
    pendientes: number;
    conAccion: number;
    montoTotal: number;
    lineasConMonto: number;
    lineasSinMonto: number;
}


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
    const { lineas: todasLineas, loading, reload } = useLineas();
    const { goToPerfiles } = useNav();
    // Excluir archivadas de todos los conteos del dashboard
    const lineas = useMemo(() => todasLineas.filter(r => !r.archivada), [todasLineas]);
    const stats = useMemo(() => calcStats(lineas), [lineas]);

    const StatCard = ({ label, value, color, icon, onClick }: { label: string; value: number; color: string; icon: React.ReactNode; onClick?: () => void }) => (
        <div
            onClick={onClick}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? e => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
            className={`rounded-2xl p-4 flex items-center gap-4 ${color} ${onClick ? "cursor-pointer hover:brightness-95 active:scale-[0.99] transition-all" : ""}`}>
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
                        <div className="h-full bg-emerald-500 transition-all duration-700 cursor-pointer hover:brightness-90"
                            style={{ width: `${pctConfirmadas}%` }} title={`Confirmadas: ${stats.confirmadas}`}
                            onClick={() => goToPerfiles({ estado: "CONFIRMADA" })} />
                    )}
                    {pctPorConfirmar > 0 && (
                        <div className="h-full bg-blue-400 transition-all duration-700 cursor-pointer hover:brightness-90"
                            style={{ width: `${pctPorConfirmar}%` }} title={`Por confirmar: ${stats.porConfirmar}`}
                            onClick={() => goToPerfiles({ estado: "POR CONFIRMAR" })} />
                    )}
                    {pctRespondio > 0 && (
                        <div className="h-full bg-amber-400 transition-all duration-700 cursor-pointer hover:brightness-90"
                            style={{ width: `${pctRespondio}%` }} title={`Respondió: ${stats.respondio}`}
                            onClick={() => goToPerfiles({ estado: "RESPONDIÓ" })} />
                    )}
                    {pctPendientes > 0 && (
                        <div className="h-full bg-slate-200 dark:bg-slate-600 transition-all duration-700 cursor-pointer hover:brightness-90"
                            style={{ width: `${pctPendientes}%` }}
                            onClick={() => goToPerfiles({ estado: "PENDIENTE" })} />
                    )}
                </div>

                {/* Leyenda */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
                    {[
                        { color: "bg-emerald-500", label: "Confirmadas", count: stats.confirmadas, estado: "CONFIRMADA" },
                        { color: "bg-blue-400",    label: "Por confirmar", count: stats.porConfirmar, estado: "POR CONFIRMAR" },
                        { color: "bg-amber-400",   label: "Respondió",    count: stats.respondio, estado: "RESPONDIÓ" },
                        { color: "bg-slate-300 dark:bg-slate-600", label: "Pendientes", count: stats.pendientes, estado: "PENDIENTE" },
                    ].map(item => (
                        <button key={item.label}
                            onClick={() => goToPerfiles({ estado: item.estado })}
                            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                            <span className={`w-2.5 h-2.5 rounded-full inline-block ${item.color}`} />
                            {item.label} ({item.count})
                        </button>
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
                    <StatCard label="Total registros" value={stats.total} icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>} color="bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-white" onClick={() => goToPerfiles()} />
                    <StatCard label="Bajas" value={stats.bajas} icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>} color="bg-rose-50 text-rose-800 dark:bg-rose-900/20 dark:text-rose-300" onClick={() => goToPerfiles({ accion: "BAJA" })} />
                    <StatCard label="Altas solicitadas" value={stats.altas} icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>} color="bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300" onClick={() => goToPerfiles({ accion: "ALTA" })} />
                    <StatCard label="Cambios" value={stats.cambios} icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>} color="bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300" onClick={() => goToPerfiles({ accion: "CAMBIO SOLICITADO" })} />
                    <StatCard label="A revisar" value={stats.revisar} icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} color="bg-orange-50 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300" onClick={() => goToPerfiles({ accion: "REVISAR" })} />
                </div>
            </div>

            {/* ── ALERTAS ─────────────────────────────────────────────── */}
            {stats.sinTitular > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                    role="button" tabIndex={0}
                    onClick={() => goToPerfiles({ search: "SIN TITULAR" })}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") goToPerfiles({ search: "SIN TITULAR" }); }}
                    className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:brightness-95 active:scale-[0.99] transition-all group">
                    <span className="shrink-0 text-amber-600"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
                    <div>
                        <p className="font-bold text-amber-700 dark:text-amber-400">{stats.sinTitular} líneas sin titular identificado</p>
                        <p className="text-xs text-amber-600 dark:text-amber-500 group-hover:underline">Requieren regularización antes del cierre →</p>
                    </div>
                </div>
            </div>
            )}

            {/* ── ADVERTENCIAS ────────────────────────────────────────── */}
            {(() => {
                const cotizar = lineas.filter(r => r.proxima_accion === "COTIZAR").length;
                const cartas  = lineas.filter(r => r.proxima_accion === "CARTA").length;
                const sinMonto = lineas.filter(r => parseMonto(r.monto_mensual) === 0).length;
                const sinRespuesta = lineas.filter(r => r.estado === "SIN RESPUESTA" || r.estado === "PENDIENTE").length;
                const s26 = lineas.filter(r => r.dispositivo_2026?.toLowerCase().includes("s26") || r.dispositivo_2026?.toLowerCase().includes("ultra")).length;
                const sinPorta = lineas.filter(r => !r.portabilidad?.trim()).length;
                const porcConf = lineas.length > 0 ? Math.round((lineas.filter(r => r.estado === "CONFIRMADA" || r.estado === "OK").length / lineas.length) * 100) : 0;

                // Propuesta enviada a Altice el 9 abr vs levantamiento actual
                const propuesta: Record<string, number> = {
                    "iPhone 17 Pro Max": 4,
                    "iPhone 17": 6,
                    "Samsung A56 5G": 16,
                    "Samsung A17 5G": 30,
                    "Motorola G56 5G": 107,
                };
                const actual: Record<string, number> = {
                    "iPhone 17 Pro Max": lineas.filter(r => r.dispositivo_2026?.toLowerCase().includes("iphone 17 pro max")).length,
                    "iPhone 17": lineas.filter(r => r.dispositivo_2026?.toLowerCase().includes("iphone 17") && !r.dispositivo_2026?.toLowerCase().includes("pro")).length,
                    "Samsung A56 5G": lineas.filter(r => r.dispositivo_2026?.toLowerCase().includes("a56")).length,
                    "Samsung A17 5G": lineas.filter(r => r.dispositivo_2026?.toLowerCase().includes("a17")).length,
                    "Motorola G56 5G": lineas.filter(r => r.dispositivo_2026?.toLowerCase().includes("g56") || r.dispositivo_2026?.toLowerCase().includes("motorola")).length,
                };
                const hasDiff = Object.keys(propuesta).some(k => (actual[k] ?? 0) !== propuesta[k]);

                interface Advertencia { nivel: "rojo" | "naranja" | "azul"; titulo: string; desc: string; accion?: () => void; ctaLabel?: string; }
                const advertencias: Advertencia[] = [];

                if (hasDiff) advertencias.push({
                    nivel: "rojo",
                    titulo: "La propuesta enviada a Altice no refleja el levantamiento actual",
                    desc: `Enviaste 4 iPhone Pro Max y 107 Motorola G56; el levantamiento real muestra ${actual["iPhone 17 Pro Max"]} Pro Max y ${actual["Motorola G56 5G"]} Motorola G56. Altice necesita los números actualizados antes de firmar.`,
                    ctaLabel: "Ver iPhone 17 Pro Max",
                    accion: () => goToPerfiles({ dispositivoContains: "iPhone 17 Pro Max" }),
                });

                if (cotizar > 0) advertencias.push({
                    nivel: "rojo",
                    titulo: `${cotizar} líneas pendientes de cotización bloquean el cierre`,
                    desc: `Son equipos de alto costo (iPhone 17 Pro Max, S26 Ultra, A56) que Altice no puede comprometer sin cotización formal aprobada.`,
                    ctaLabel: `Ver ${cotizar} líneas →`,
                    accion: () => goToPerfiles({ proximaAccion: "COTIZAR" }),
                });

                if (sinMonto > 0) advertencias.push({
                    nivel: "naranja",
                    titulo: `${sinMonto} líneas sin monto mensual registrado`,
                    desc: `Sin montos no puedes calcular el costo total del contrato ni comparar con Claro. Agrega los precios una vez Altice envíe la propuesta formal.`,
                    ctaLabel: `Ver ${sinMonto} líneas →`,
                    accion: () => goToPerfiles({ sinMonto: true }),
                });

                if (s26 > 0) advertencias.push({
                    nivel: "naranja",
                    titulo: `${s26} Samsung S26 Ultra no estaban en la propuesta original`,
                    desc: `Este equipo no fue incluido en la solicitud de abril. Altice no tiene precio reservado para él y requiere cotización especial con aprobación directiva.`,
                    ctaLabel: `Ver ${s26} líneas →`,
                    accion: () => goToPerfiles({ dispositivoContains: "S26" }),
                });

                if (sinRespuesta > 0) advertencias.push({
                    nivel: "naranja",
                    titulo: `${sinRespuesta} titulares sin respuesta o pendientes`,
                    desc: `Confirmar estas personas antes de formalizar el contrato evita comprometerte con solicitudes que aún pueden cambiar.`,
                    ctaLabel: `Ver ${sinRespuesta} líneas →`,
                    accion: () => goToPerfiles({ estado: "PENDIENTE" }),
                });

                if (cartas > 0) advertencias.push({
                    nivel: "naranja",
                    titulo: `${cartas} cartas de suspensión/notificación pendientes de enviar`,
                    desc: `Sin carta formal, las bajas pueden ser impugnadas.`,
                    ctaLabel: `Ver ${cartas} cartas →`,
                    accion: () => goToPerfiles({ proximaAccion: "CARTA" }),
                });

                if (sinPorta > 5) advertencias.push({
                    nivel: "azul",
                    titulo: `${sinPorta} líneas sin portabilidad marcada`,
                    desc: `El campo portabilidad (Altice / Claro / Nuevo / Baja) necesita completarse. Las altas y portabilidades desde Claro son prioritarias.`,
                    ctaLabel: `Completar ${sinPorta} líneas →`,
                    accion: () => goToPerfiles({ sinPortabilidad: true }),
                });

                const clsBorder: Record<string, string> = {
                    rojo: "border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20",
                    naranja: "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20",
                    azul: "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20",
                };
                const clsTitle: Record<string, string> = {
                    rojo: "text-rose-800 dark:text-rose-300",
                    naranja: "text-amber-800 dark:text-amber-300",
                    azul: "text-blue-800 dark:text-blue-300",
                };
                const clsDesc: Record<string, string> = {
                    rojo: "text-rose-700 dark:text-rose-400",
                    naranja: "text-amber-700 dark:text-amber-400",
                    azul: "text-blue-700 dark:text-blue-400",
                };
                const icon: Record<string, React.ReactNode> = {
                    rojo: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
                    naranja: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
                    azul: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
                };

                return (
                    <div>
                        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                            Advertencias — cosas que pueden escaparse
                        </h3>
                        <div className="space-y-2.5">
                            {advertencias.map((a, i) => (
                                <div key={i}
                                    role={a.accion ? "button" : undefined}
                                    tabIndex={a.accion ? 0 : undefined}
                                    onClick={a.accion}
                                    onKeyDown={a.accion ? (e) => { if (e.key === "Enter" || e.key === " ") a.accion?.(); } : undefined}
                                    className={`border rounded-2xl p-4 flex gap-3 ${clsBorder[a.nivel]} ${a.accion ? "cursor-pointer hover:brightness-95 active:scale-[0.99] transition-all group" : ""}`}>
                                    <span className={clsTitle[a.nivel]}>{icon[a.nivel]}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-bold mb-0.5 ${clsTitle[a.nivel]}`}>{a.titulo}</p>
                                        <p className={`text-xs leading-relaxed ${clsDesc[a.nivel]}`}>{a.desc}</p>
                                        {a.ctaLabel && (
                                            <span className={`inline-block mt-2 text-xs font-semibold underline underline-offset-2 opacity-70 group-hover:opacity-100 transition-opacity ${clsTitle[a.nivel]}`}>
                                                {a.ctaLabel}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Tabla propuesta vs levantamiento */}
                        <div className="mt-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700">
                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Propuesta enviada a Altice (9 abr) vs levantamiento actual</p>
                            </div>
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs text-slate-500 dark:text-slate-400">
                                    <tr>
                                        <th className="px-5 py-2 text-left font-semibold">Equipo</th>
                                        <th className="px-4 py-2 text-center font-semibold">Propuesto</th>
                                        <th className="px-4 py-2 text-center font-semibold">Levantamiento</th>
                                        <th className="px-4 py-2 text-center font-semibold">Dif.</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {Object.entries(propuesta).map(([k, prop]) => {
                                        const act = actual[k] ?? 0;
                                        const diff = act - prop;
                                        return (
                                            <tr key={k}>
                                                <td className="px-5 py-2.5 text-slate-700 dark:text-slate-200">{k}</td>
                                                <td className="px-4 py-2.5 text-center text-slate-500 dark:text-slate-400">{prop}</td>
                                                <td className="px-4 py-2.5 text-center font-medium text-slate-700 dark:text-slate-200">{act}</td>
                                                <td className={`px-4 py-2.5 text-center font-bold ${diff > 0 ? "text-rose-600 dark:text-rose-400" : diff < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                                                    {diff > 0 ? `+${diff}` : diff === 0 ? "=" : diff}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {s26 > 0 && (
                                        <tr className="bg-rose-50/50 dark:bg-rose-950/10">
                                            <td className="px-5 py-2.5 text-slate-700 dark:text-slate-200">Samsung S26 Ultra</td>
                                            <td className="px-4 py-2.5 text-center text-slate-400">—</td>
                                            <td className="px-4 py-2.5 text-center font-medium text-rose-600 dark:text-rose-400">{s26}</td>
                                            <td className="px-4 py-2.5 text-center font-bold text-rose-600 dark:text-rose-400">+{s26} nuevo</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })()}

            {/* ── PRÓXIMAS ACCIONES PENDIENTES ────────────────────────── */}
            {(() => {
                const accionesPendientes = [
                    { label: "COTIZAR", count: lineas.filter(r => r.proxima_accion === "COTIZAR").length, color: "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300" },
                    { label: "CARTA",   count: lineas.filter(r => r.proxima_accion === "CARTA").length,   color: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300" },
                    { label: "LLAMAR",  count: lineas.filter(r => r.proxima_accion === "LLAMAR").length,  color: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300" },
                    { label: "CANCELAR",count: lineas.filter(r => r.proxima_accion === "CANCELAR").length,color: "bg-rose-100 text-rose-800 dark:bg-rose-900/20 dark:text-rose-300" },
                ];
                const total = accionesPendientes.reduce((a, b) => a + b.count, 0);
                if (total === 0) return null;
                return (
                    <div>
                        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Próximas acciones pendientes</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {accionesPendientes.map(a => (
                                <button key={a.label} onClick={() => goToPerfiles({ proximaAccion: a.label })}
                                    className={`rounded-2xl p-4 text-center w-full transition-transform hover:scale-105 active:scale-95 cursor-pointer ${a.color}`}>
                                    <p className="text-3xl font-black leading-none">{a.count}</p>
                                    <p className="text-xs font-semibold mt-1 opacity-80">{a.label}</p>
                                    <p className="text-[10px] opacity-50 mt-0.5">Ver →</p>
                                </button>
                            ))}
                        </div>
                    </div>
                );
            })()}

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


        </div>
    );
}
