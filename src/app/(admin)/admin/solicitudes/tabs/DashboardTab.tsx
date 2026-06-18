"use client";
import { useMemo, useState, useCallback, useEffect } from "react";
import React from "react";
import { type LineaAltice, ACCION_COLORS } from "@/lib/supabase";
import { useLineas } from "@/lib/LineasContext";
import { useNav } from "@/lib/NavContext";
import { useConfigListas } from "@/lib/ConfigListasContext";

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
        confirmadas, porConfirmar, respondio, pendientes,
        conAccion: rows.filter(r => r.accion_2026 && r.accion_2026 !== "REVISAR").length,
        montoTotal, lineasConMonto: conMonto.length, lineasSinMonto: rows.length - conMonto.length,
    };
}

function formatRD(amount: number): string {
    return new Intl.NumberFormat("es-DO", {
        style: "currency", currency: "DOP",
        minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(amount);
}

// ─── TIPOS DE ALERTAS ────────────────────────────────────────────────────────

export interface AlertaGenerada {
    id: string;
    nivel: "rojo" | "naranja" | "azul";
    titulo: string;
    desc: string;
    ctaLabel?: string;
    accion?: () => void;
    count: number; // si cambia, la alerta reaparece aunque fue descartada
}

export interface PoliticaAlerta {
    id: string;
    nombre: string;           // nombre corto para el panel de políticas
    descripcion: string;      // qué condición dispara esta política
    nivel: "rojo" | "naranja" | "azul";
    habilitada: boolean;      // configurable por el usuario
}

// Políticas base (metadatos fijos; la lógica de generación está abajo)
const POLITICAS_BASE: Omit<PoliticaAlerta, "habilitada">[] = [
    {
        id: "propuesta_altice",
        nombre: "Propuesta desactualizada",
        descripcion: "Se dispara cuando los números actuales de equipos difieren de los enviados a Altice.",
        nivel: "rojo",
    },
    {
        id: "cotizar",
        nombre: "Líneas sin cotización",
        descripcion: "Equipos de alto costo (iPhone 17 Pro Max, S26 Ultra, A56) sin cotización formal.",
        nivel: "rojo",
    },
    {
        id: "sin_monto",
        nombre: "Líneas sin monto mensual",
        descripcion: "Líneas sin precio registrado impiden calcular el costo total del contrato.",
        nivel: "naranja",
    },
    {
        id: "s26_nuevo",
        nombre: "Samsung S26 Ultra no incluido",
        descripcion: "El S26 Ultra no estaba en la propuesta original de abril y requiere aprobación directiva.",
        nivel: "naranja",
    },
    {
        id: "sin_respuesta",
        nombre: "Titulares sin respuesta",
        descripcion: "Titulares en estado PENDIENTE / SIN RESPUESTA que aún no han confirmado su plan.",
        nivel: "naranja",
    },
    {
        id: "cartas",
        nombre: "Cartas pendientes",
        descripcion: "Líneas con próxima acción CARTA que no han recibido su notificación formal.",
        nivel: "naranja",
    },
    {
        id: "sin_portabilidad",
        nombre: "Líneas sin portabilidad",
        descripcion: "Líneas cuyo campo portabilidad (Altice/Claro/Nuevo/Baja) aún no se ha completado.",
        nivel: "azul",
    },
    {
        id: "sin_titular",
        nombre: "Líneas sin titular",
        descripcion: "Líneas que no tienen un titular responsable asignado.",
        nivel: "naranja",
    },
];

// ─── HOOK: preferencias de alertas (localStorage) ────────────────────────────

function useAlertPrefs() {
    // dismissed: { [alertId]: count-al-descartar }
    // si el count actual difiere → la alerta reaparece
    const [dismissed, setDismissed] = useState<Record<string, number>>({});
    // disabled: set de ids de políticas desactivadas permanentemente
    const [disabled, setDisabled] = useState<Set<string>>(new Set());

    useEffect(() => {
        try {
            const d = JSON.parse(localStorage.getItem("alertas_dismissed") || "{}");
            const x = JSON.parse(localStorage.getItem("alertas_disabled") || "[]");
            setDismissed(d);
            setDisabled(new Set(x));
        } catch { /* ignore */ }
    }, []);

    const dismiss = useCallback((id: string, count: number) => {
        setDismissed(prev => {
            const next = { ...prev, [id]: count };
            localStorage.setItem("alertas_dismissed", JSON.stringify(next));
            return next;
        });
    }, []);

    const restore = useCallback((id: string) => {
        setDismissed(prev => {
            const next = { ...prev };
            delete next[id];
            localStorage.setItem("alertas_dismissed", JSON.stringify(next));
            return next;
        });
    }, []);

    const toggleDisabled = useCallback((id: string) => {
        setDisabled(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            localStorage.setItem("alertas_disabled", JSON.stringify([...next]));
            return next;
        });
    }, []);

    return { dismissed, disabled, dismiss, restore, toggleDisabled };
}

// ─── COMPONENTES ─────────────────────────────────────────────────────────────

const clsBorder: Record<string, string> = {
    rojo:    "border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20",
    naranja: "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20",
    azul:    "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20",
};
const clsTitle: Record<string, string> = {
    rojo:    "text-rose-800 dark:text-rose-300",
    naranja: "text-amber-800 dark:text-amber-300",
    azul:    "text-blue-800 dark:text-blue-300",
};
const clsDesc: Record<string, string> = {
    rojo:    "text-rose-700 dark:text-rose-400",
    naranja: "text-amber-700 dark:text-amber-400",
    azul:    "text-blue-700 dark:text-blue-400",
};
const iconAlerta: Record<string, React.ReactNode> = {
    rojo:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    naranja: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    azul:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
};

// ─── PANEL DE POLÍTICAS ───────────────────────────────────────────────────────

function PoliticasPanel({
    politicas, disabled, onToggle, onClose,
}: {
    politicas: PoliticaAlerta[];
    disabled: Set<string>;
    onToggle: (id: string) => void;
    onClose: () => void;
}) {
    const badgeColor: Record<string, string> = {
        rojo:    "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
        naranja: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        azul:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    };
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white">Políticas de alertas</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Activa o desactiva qué condiciones generan alertas en el dashboard.
                            Las desactivadas no aparecerán aunque la condición se cumpla.
                        </p>
                    </div>
                    <button onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ml-4 shrink-0">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                {/* Lista de políticas */}
                <div className="overflow-y-auto flex-1 p-4 space-y-2">
                    {politicas.map(p => {
                        const off = disabled.has(p.id);
                        return (
                            <div key={p.id}
                                className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${off
                                    ? "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30 opacity-60"
                                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                }`}>
                                {/* Toggle */}
                                <button
                                    onClick={() => onToggle(p.id)}
                                    className={`relative shrink-0 mt-0.5 w-10 h-5 rounded-full transition-colors ${off ? "bg-slate-300 dark:bg-slate-600" : "bg-emerald-500"}`}
                                    title={off ? "Activar política" : "Desactivar política"}>
                                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${off ? "translate-x-0.5" : "translate-x-5"}`} />
                                </button>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{p.nombre}</span>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badgeColor[p.nivel]}`}>
                                            {p.nivel.toUpperCase()}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 leading-relaxed">{p.descripcion}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700">
                    <p className="text-xs text-slate-400">
                        Los cambios se guardan automáticamente en este navegador.
                    </p>
                </div>
            </div>
        </div>
    );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function DashboardTab() {
    const { lineas: todasLineas, loading, reload } = useLineas();
    const { goToPerfiles } = useNav();
    const { getList } = useConfigListas();
    const lineas = useMemo(() => todasLineas.filter(r => !r.archivada), [todasLineas]);
    const stats = useMemo(() => calcStats(lineas), [lineas]);

    const { dismissed, disabled, dismiss, restore, toggleDisabled } = useAlertPrefs();
    const [mostrarPoliticas, setMostrarPoliticas] = useState(false);
    const [mostrarDescartadas, setMostrarDescartadas] = useState(false);

    // Políticas con estado habilitada/deshabilitada
    const politicas: PoliticaAlerta[] = useMemo(
        () => POLITICAS_BASE.map(p => ({ ...p, habilitada: !disabled.has(p.id) })),
        [disabled]
    );

    // Conteo dinámico de acciones
    const accionesDinamicas = useMemo(() => {
        const map = new Map<string, number>();
        for (const l of lineas) {
            const a = l.accion_2026?.trim() || "(sin acción)";
            map.set(a, (map.get(a) ?? 0) + 1);
        }
        const orden = ["BAJA","ALTA","CAMBIO SOLICITADO","REVISAR","SE MANTIENE","NO REQUIERE FLOTA"];
        const sorted: { accion: string; count: number }[] = [];
        for (const a of orden) if (map.has(a)) sorted.push({ accion: a, count: map.get(a)! });
        for (const [a, count] of map) if (!orden.includes(a)) sorted.push({ accion: a, count });
        return sorted;
    }, [lineas]);

    // ── GENERAR ALERTAS desde las políticas ───────────────────────────────────
    const todasAlertas: AlertaGenerada[] = useMemo(() => {
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

        const cotizar = lineas.filter(r => r.proxima_accion === "COTIZAR").length;
        const cartas  = lineas.filter(r => r.proxima_accion === "CARTA").length;
        const sinMonto = lineas.filter(r => parseMonto(r.monto_mensual) === 0).length;
        const sinRespuesta = lineas.filter(r => r.estado === "SIN RESPUESTA" || r.estado === "PENDIENTE").length;
        const s26 = lineas.filter(r => r.dispositivo_2026?.toLowerCase().includes("s26") || r.dispositivo_2026?.toLowerCase().includes("ultra")).length;
        const sinPorta = lineas.filter(r => !r.portabilidad?.trim()).length;
        const sinTitularCount = lineas.filter(r => !r.titular_responsable || r.titular_responsable.includes("SIN TITULAR")).length;

        const candidatas: AlertaGenerada[] = [];

        if (hasDiff) candidatas.push({
            id: "propuesta_altice",
            nivel: "rojo",
            titulo: "La propuesta enviada a Altice no refleja el levantamiento actual",
            desc: `Enviaste 4 iPhone Pro Max y 107 Motorola G56; el levantamiento real muestra ${actual["iPhone 17 Pro Max"]} Pro Max y ${actual["Motorola G56 5G"]} Motorola G56. Altice necesita los números actualizados antes de firmar.`,
            ctaLabel: "Ver iPhone 17 Pro Max",
            accion: () => goToPerfiles({ dispositivoContains: "iPhone 17 Pro Max" }),
            count: Object.values(actual).reduce((a, b) => a + b, 0),
        });

        if (cotizar > 0) candidatas.push({
            id: "cotizar",
            nivel: "rojo",
            titulo: `${cotizar} líneas pendientes de cotización bloquean el cierre`,
            desc: `Son equipos de alto costo (iPhone 17 Pro Max, S26 Ultra, A56) que Altice no puede comprometer sin cotización formal aprobada.`,
            ctaLabel: `Ver ${cotizar} líneas →`,
            accion: () => goToPerfiles({ proximaAccion: "COTIZAR" }),
            count: cotizar,
        });

        if (sinMonto > 0) candidatas.push({
            id: "sin_monto",
            nivel: "naranja",
            titulo: `${sinMonto} líneas sin monto mensual registrado`,
            desc: `Sin montos no puedes calcular el costo total del contrato ni comparar con Claro. Agrega los precios una vez Altice envíe la propuesta formal.`,
            ctaLabel: `Ver ${sinMonto} líneas →`,
            accion: () => goToPerfiles({ sinMonto: true }),
            count: sinMonto,
        });

        if (s26 > 0) candidatas.push({
            id: "s26_nuevo",
            nivel: "naranja",
            titulo: `${s26} Samsung S26 Ultra no estaban en la propuesta original`,
            desc: `Este equipo no fue incluido en la solicitud de abril. Altice no tiene precio reservado para él y requiere cotización especial con aprobación directiva.`,
            ctaLabel: `Ver ${s26} líneas →`,
            accion: () => goToPerfiles({ dispositivoContains: "S26" }),
            count: s26,
        });

        if (sinRespuesta > 0) candidatas.push({
            id: "sin_respuesta",
            nivel: "naranja",
            titulo: `${sinRespuesta} titulares sin respuesta o pendientes`,
            desc: `Confirmar estas personas antes de formalizar el contrato evita comprometerte con solicitudes que aún pueden cambiar.`,
            ctaLabel: `Ver ${sinRespuesta} líneas →`,
            accion: () => goToPerfiles({ estado: "PENDIENTE" }),
            count: sinRespuesta,
        });

        if (cartas > 0) candidatas.push({
            id: "cartas",
            nivel: "naranja",
            titulo: `${cartas} cartas de suspensión/notificación pendientes de enviar`,
            desc: `Sin carta formal, las bajas pueden ser impugnadas.`,
            ctaLabel: `Ver ${cartas} cartas →`,
            accion: () => goToPerfiles({ proximaAccion: "CARTA" }),
            count: cartas,
        });

        if (sinPorta > 5) candidatas.push({
            id: "sin_portabilidad",
            nivel: "azul",
            titulo: `${sinPorta} líneas sin portabilidad marcada`,
            desc: `El campo portabilidad (Altice / Claro / Nuevo / Baja) necesita completarse. Las altas y portabilidades desde Claro son prioritarias.`,
            ctaLabel: `Completar ${sinPorta} líneas →`,
            accion: () => goToPerfiles({ sinPortabilidad: true }),
            count: sinPorta,
        });

        if (sinTitularCount > 0) candidatas.push({
            id: "sin_titular",
            nivel: "naranja",
            titulo: `${sinTitularCount} líneas sin titular identificado`,
            desc: `Requieren regularización antes del cierre del contrato.`,
            ctaLabel: `Ver ${sinTitularCount} líneas →`,
            accion: () => goToPerfiles({ search: "SIN TITULAR" }),
            count: sinTitularCount,
        });

        return candidatas;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lineas]);

    // Separar alertas: activas vs descartadas vs de política desactivada
    const alertasVisibles = useMemo(() =>
        todasAlertas.filter(a => {
            if (disabled.has(a.id)) return false; // política desactivada
            const dismissedCount = dismissed[a.id];
            if (dismissedCount === undefined) return true; // no fue descartada
            return a.count !== dismissedCount; // reaparece si el count cambió
        }),
        [todasAlertas, disabled, dismissed]
    );

    const alertasDescartadas = useMemo(() =>
        todasAlertas.filter(a => {
            if (disabled.has(a.id)) return false;
            const dismissedCount = dismissed[a.id];
            return dismissedCount !== undefined && a.count === dismissedCount;
        }),
        [todasAlertas, disabled, dismissed]
    );

    // ─── STATS ───────────────────────────────────────────────────────────────

    const StatCard = ({ label, value, color, icon, onClick }: {
        label: string; value: number; color: string; icon: React.ReactNode; onClick?: () => void;
    }) => (
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

    const pctConfirmadas  = stats.total > 0 ? Math.round((stats.confirmadas  / stats.total) * 100) : 0;
    const pctPorConfirmar = stats.total > 0 ? Math.round((stats.porConfirmar / stats.total) * 100) : 0;
    const pctRespondio    = stats.total > 0 ? Math.round((stats.respondio    / stats.total) * 100) : 0;
    const pctPendientes   = Math.max(0, 100 - pctConfirmadas - pctPorConfirmar - pctRespondio);
    const pctGestionadas  = pctConfirmadas + pctPorConfirmar + pctRespondio;

    // Propuesta vs actual (para la tabla)
    const propuesta: Record<string, number> = {
        "iPhone 17 Pro Max": 4, "iPhone 17": 6,
        "Samsung A56 5G": 16,  "Samsung A17 5G": 30, "Motorola G56 5G": 107,
    };
    const actual: Record<string, number> = {
        "iPhone 17 Pro Max": lineas.filter(r => r.dispositivo_2026?.toLowerCase().includes("iphone 17 pro max")).length,
        "iPhone 17": lineas.filter(r => r.dispositivo_2026?.toLowerCase().includes("iphone 17") && !r.dispositivo_2026?.toLowerCase().includes("pro")).length,
        "Samsung A56 5G": lineas.filter(r => r.dispositivo_2026?.toLowerCase().includes("a56")).length,
        "Samsung A17 5G": lineas.filter(r => r.dispositivo_2026?.toLowerCase().includes("a17")).length,
        "Motorola G56 5G": lineas.filter(r => r.dispositivo_2026?.toLowerCase().includes("g56") || r.dispositivo_2026?.toLowerCase().includes("motorola")).length,
    };
    const s26 = lineas.filter(r => r.dispositivo_2026?.toLowerCase().includes("s26") || r.dispositivo_2026?.toLowerCase().includes("ultra")).length;

    return (
        <div className="space-y-6">
            {/* ── PANEL DE POLÍTICAS ────────────────────────────────────── */}
            {mostrarPoliticas && (
                <PoliticasPanel
                    politicas={politicas}
                    disabled={disabled}
                    onToggle={toggleDisabled}
                    onClose={() => setMostrarPoliticas(false)}
                />
            )}

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
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
                    Actualizar
                </button>
            </div>

            {/* ── BARRA DE PROGRESO ─────────────────────────────────────── */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                <div className="flex items-start justify-between mb-3 gap-4">
                    <div>
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Progreso de gestión</h3>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-3xl font-black text-slate-800 dark:text-white leading-none">
                            {pctGestionadas}<span className="text-lg font-semibold text-slate-400">%</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">gestionadas</p>
                    </div>
                </div>
                <div className="w-full h-4 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden flex">
                    {pctConfirmadas > 0  && <div className="h-full bg-emerald-500 transition-all duration-700 cursor-pointer hover:brightness-90" style={{ width: `${pctConfirmadas}%` }} title={`Confirmadas: ${stats.confirmadas}`} onClick={() => goToPerfiles({ estado: "CONFIRMADA" })} />}
                    {pctPorConfirmar > 0 && <div className="h-full bg-blue-400   transition-all duration-700 cursor-pointer hover:brightness-90" style={{ width: `${pctPorConfirmar}%` }} title={`Por confirmar: ${stats.porConfirmar}`} onClick={() => goToPerfiles({ estado: "POR CONFIRMAR" })} />}
                    {pctRespondio > 0    && <div className="h-full bg-amber-400  transition-all duration-700 cursor-pointer hover:brightness-90" style={{ width: `${pctRespondio}%` }} title={`Respondió: ${stats.respondio}`} onClick={() => goToPerfiles({ estado: "RESPONDIÓ" })} />}
                    {pctPendientes > 0   && <div className="h-full bg-slate-200 dark:bg-slate-600 transition-all duration-700 cursor-pointer hover:brightness-90" style={{ width: `${pctPendientes}%` }} onClick={() => goToPerfiles({ estado: "PENDIENTE" })} />}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
                    {[
                        { color: "bg-emerald-500", label: "Confirmadas",   count: stats.confirmadas,  estado: "CONFIRMADA"   },
                        { color: "bg-blue-400",    label: "Por confirmar", count: stats.porConfirmar, estado: "POR CONFIRMAR" },
                        { color: "bg-amber-400",   label: "Respondió",     count: stats.respondio,    estado: "RESPONDIÓ"    },
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

            {/* ── PROYECCIÓN ───────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                    </div>
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
                        {stats.lineasConMonto > 0 ? formatRD(Math.round(stats.montoTotal / stats.lineasConMonto)) : "—"}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                        {stats.lineasSinMonto > 0
                            ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle",marginRight:3}}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>{stats.lineasSinMonto} sin cotización</>
                            : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle",marginRight:3}}><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.1 9 11.1"/></svg>Todas cotizadas</>
                        }
                    </p>
                </div>
            </div>

            {/* ── ACCIONES 2026 ────────────────────────────────────────── */}
            <div>
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Acciones 2026</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <StatCard
                        label="Total registros" value={stats.total}
                        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>}
                        color="bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-white"
                        onClick={() => goToPerfiles()}
                    />
                    {accionesDinamicas.map(({ accion, count }) => {
                        const colorMap: Record<string, string> = {
                            "BAJA":              "bg-rose-50 text-rose-800 dark:bg-rose-900/20 dark:text-rose-300",
                            "ALTA":              "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300",
                            "CAMBIO SOLICITADO": "bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
                            "REVISAR":           "bg-orange-50 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300",
                            "SE MANTIENE":       "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
                            "NO REQUIERE FLOTA": "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
                        };
                        const iconMap: Record<string, React.ReactNode> = {
                            "BAJA": <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
                            "ALTA": <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
                            "CAMBIO SOLICITADO": <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
                            "REVISAR": <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
                        };
                        const defaultIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>;
                        const labelMap: Record<string, string> = {
                            "BAJA": "Bajas", "ALTA": "Altas solicitadas", "CAMBIO SOLICITADO": "Cambios",
                            "REVISAR": "A revisar", "SE MANTIENE": "Se mantiene", "NO REQUIERE FLOTA": "No requiere flota",
                        };
                        return (
                            <StatCard
                                key={accion}
                                label={labelMap[accion] ?? accion}
                                value={count}
                                icon={iconMap[accion] ?? defaultIcon}
                                color={colorMap[accion] ?? "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"}
                                onClick={() => goToPerfiles({ accion })}
                            />
                        );
                    })}
                </div>
            </div>

            {/* ── ALERTAS (dinámicas y descartables) ───────────────────── */}
            <div>
                {/* Header con contador + botón de políticas */}
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        Advertencias
                        {alertasVisibles.length > 0 && (
                            <span className="ml-1 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{alertasVisibles.length}</span>
                        )}
                    </h3>
                    <button
                        onClick={() => setMostrarPoliticas(true)}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M6.34 6.34l-1.41-1.41M4.93 19.07l1.41-1.41M17.66 17.66l1.41 1.41M1 12h3m16 0h3M12 1v3m0 16v3"/></svg>
                        Políticas
                        {disabled.size > 0 && <span className="bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-300 text-[10px] font-bold px-1 rounded">{disabled.size} off</span>}
                    </button>
                </div>

                {/* Alertas activas */}
                {alertasVisibles.length === 0 ? (
                    <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-700 dark:text-emerald-400 text-sm font-medium">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.1 9 11.1"/></svg>
                        No hay advertencias activas. ¡Todo está en orden!
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {alertasVisibles.map(a => (
                            <div key={a.id}
                                className={`border rounded-2xl p-4 flex gap-3 ${clsBorder[a.nivel]} group relative`}>
                                {/* Icono */}
                                <span className={clsTitle[a.nivel]}>{iconAlerta[a.nivel]}</span>
                                {/* Contenido */}
                                <div className={`flex-1 min-w-0 pr-7 ${a.accion ? "cursor-pointer" : ""}`}
                                    role={a.accion ? "button" : undefined}
                                    tabIndex={a.accion ? 0 : undefined}
                                    onClick={a.accion}
                                    onKeyDown={a.accion ? e => { if (e.key === "Enter" || e.key === " ") a.accion?.(); } : undefined}>
                                    <p className={`text-sm font-bold mb-0.5 ${clsTitle[a.nivel]}`}>{a.titulo}</p>
                                    <p className={`text-xs leading-relaxed ${clsDesc[a.nivel]}`}>{a.desc}</p>
                                    {a.ctaLabel && (
                                        <span className={`inline-block mt-2 text-xs font-semibold underline underline-offset-2 opacity-70 hover:opacity-100 transition-opacity ${clsTitle[a.nivel]}`}>
                                            {a.ctaLabel}
                                        </span>
                                    )}
                                </div>
                                {/* Botón descartar */}
                                <button
                                    onClick={() => dismiss(a.id, a.count)}
                                    title="Descartar alerta (reaparece si los datos cambian)"
                                    className={`absolute top-3 right-3 p-1 rounded-lg opacity-40 hover:opacity-100 transition-opacity ${clsTitle[a.nivel]} hover:bg-black/10`}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Alertas descartadas (colapsable) */}
                {alertasDescartadas.length > 0 && (
                    <div className="mt-3">
                        <button
                            onClick={() => setMostrarDescartadas(v => !v)}
                            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                className={`transition-transform ${mostrarDescartadas ? "rotate-90" : ""}`}>
                                <polyline points="9 18 15 12 9 6"/>
                            </svg>
                            {alertasDescartadas.length} alerta{alertasDescartadas.length > 1 ? "s" : ""} descartada{alertasDescartadas.length > 1 ? "s" : ""} (haz clic para ver)
                        </button>
                        {mostrarDescartadas && (
                            <div className="space-y-2 mt-2">
                                {alertasDescartadas.map(a => (
                                    <div key={a.id}
                                        className="border border-slate-200 dark:border-slate-700 rounded-2xl p-3 flex gap-3 bg-slate-50 dark:bg-slate-800 opacity-60">
                                        <span className="text-slate-400 shrink-0 mt-0.5">{iconAlerta[a.nivel]}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 line-through">{a.titulo}</p>
                                        </div>
                                        <button
                                            onClick={() => restore(a.id)}
                                            title="Restaurar alerta"
                                            className="text-xs text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shrink-0 font-medium px-2">
                                            Restaurar
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── TABLA PROPUESTA VS LEVANTAMIENTO ─────────────────────── */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
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

            {/* ── PRÓXIMAS ACCIONES PENDIENTES ─────────────────────────── */}
            {(() => {
                const accionesPendientes = [
                    { label: "COTIZAR",  count: lineas.filter(r => r.proxima_accion === "COTIZAR").length,  color: "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300" },
                    { label: "CARTA",    count: lineas.filter(r => r.proxima_accion === "CARTA").length,    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300" },
                    { label: "LLAMAR",   count: lineas.filter(r => r.proxima_accion === "LLAMAR").length,   color: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300" },
                    { label: "CANCELAR", count: lineas.filter(r => r.proxima_accion === "CANCELAR").length, color: "bg-rose-100 text-rose-800 dark:bg-rose-900/20 dark:text-rose-300" },
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

            {/* ── PORTABILIDAD ─────────────────────────────────────────── */}
            {(() => {
                const portMap: Record<string, number> = {};
                lineas.forEach(l => {
                    const k = l.portabilidad?.trim() || "Sin marcar";
                    portMap[k] = (portMap[k] ?? 0) + 1;
                });
                // Lista dinámica desde Configuración + "Sin marcar" siempre al final
                const configVals = getList("portabilidad");
                const ORDER = [...configVals, "Sin marcar"];
                const allKeys = Array.from(new Set([...ORDER, ...Object.keys(portMap)]));
                const entries = allKeys
                    .sort((a, b) => {
                        const ai = ORDER.indexOf(a); const bi = ORDER.indexOf(b);
                        if (ai === -1 && bi === -1) return a.localeCompare(b);
                        if (ai === -1) return 1; if (bi === -1) return -1;
                        return ai - bi;
                    })
                    .map(k => [k, portMap[k] ?? 0] as [string, number])
                    .filter(([, v]) => v > 0);
                const total = lineas.length || 1;
                // Paleta base para valores conocidos + fallback cíclico para nuevos
                const KNOWN_COLOR: Record<string, { bar: string; text: string; bg: string }> = {
                    Altice:       { bar: "bg-blue-500",    text: "text-blue-700 dark:text-blue-300",       bg: "bg-blue-50 dark:bg-blue-900/20" },
                    Claro:        { bar: "bg-red-500",     text: "text-red-700 dark:text-red-300",         bg: "bg-red-50 dark:bg-red-900/20" },
                    Nuevo:        { bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
                    Baja:         { bar: "bg-slate-400",   text: "text-slate-500 dark:text-slate-400",     bg: "bg-slate-100 dark:bg-slate-700/40" },
                    "Sin marcar": { bar: "bg-amber-400",   text: "text-amber-700 dark:text-amber-300",     bg: "bg-amber-50 dark:bg-amber-900/20" },
                };
                const FALLBACK = [
                    { bar: "bg-violet-500", text: "text-violet-700 dark:text-violet-300", bg: "bg-violet-50 dark:bg-violet-900/20" },
                    { bar: "bg-cyan-500",   text: "text-cyan-700 dark:text-cyan-300",     bg: "bg-cyan-50 dark:bg-cyan-900/20" },
                    { bar: "bg-pink-500",   text: "text-pink-700 dark:text-pink-300",     bg: "bg-pink-50 dark:bg-pink-900/20" },
                    { bar: "bg-lime-500",   text: "text-lime-700 dark:text-lime-300",     bg: "bg-lime-50 dark:bg-lime-900/20" },
                    { bar: "bg-orange-500", text: "text-orange-700 dark:text-orange-300", bg: "bg-orange-50 dark:bg-orange-900/20" },
                ];
                let fallbackIdx = 0;
                function getColors(k: string) {
                    if (KNOWN_COLOR[k]) return KNOWN_COLOR[k];
                    return FALLBACK[fallbackIdx++ % FALLBACK.length];
                }
                return (
                    <div>
                        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Portabilidad</h3>
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                            {/* Barra stacked */}
                            <div className="flex rounded-full overflow-hidden h-3 gap-px">
                                {entries.map(([k, v]) => (
                                    <div key={k} title={`${k}: ${v}`}
                                        style={{ width: `${(v / total) * 100}%` }}
                                        className={`${getColors(k).bar} transition-all`} />
                                ))}
                            </div>
                            {/* Leyenda */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                                {entries.map(([k, v]) => {
                                    const c = getColors(k);
                                    return (
                                        <button key={k}
                                            onClick={() => goToPerfiles({ search: k === "Sin marcar" ? undefined : k, sinPortabilidad: k === "Sin marcar" })}
                                            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl ${c.bg} hover:opacity-80 transition-opacity`}>
                                            <span className={`text-xs font-semibold ${c.text}`}>{k}</span>
                                            <span className={`text-sm font-black ${c.text}`}>{v}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── DISTRIBUCIÓN POR TIPO ────────────────────────────────── */}
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
