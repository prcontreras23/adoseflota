"use client";
import { useMemo, useState, useCallback, useEffect } from "react";
import React from "react";
import { supabase, type LineaAltice, ACCION_COLORS } from "@/lib/supabase";
import { useLineas } from "@/lib/LineasContext";
import { useNav } from "@/lib/NavContext";
import { useConfigListas } from "@/lib/ConfigListasContext";
import toast from "react-hot-toast";

// ── Tipos de propuesta ────────────────────────────────────────────────────────
interface PropuestaRow {
    id: string;
    nombre: string;
    cantidad_propuesta: number;
    busqueda: string;   // pipe-separated search terms
    excluir: string;    // term to exclude (e.g. "pro" for plain iPhone 17)
    es_nuevo: boolean;
    orden: number;
}

function calcActual(lineas: LineaAltice[], row: PropuestaRow): number {
    return lineas.filter(r => {
        const disp = r.dispositivo_2026?.toLowerCase() ?? "";
        const terms = row.busqueda.split("|").map(t => t.trim()).filter(Boolean);
        const matches = terms.some(t => disp.includes(t));
        const excluded = row.excluir ? disp.includes(row.excluir.toLowerCase()) : false;
        return matches && !excluded;
    }).length;
}

// ── Modal de edición de propuesta ────────────────────────────────────────────
function PropuestaModal({
    rows,
    onSave,
    onClose,
}: {
    rows: PropuestaRow[];
    onSave: (updated: PropuestaRow[]) => void;
    onClose: () => void;
}) {
    const [draft, setDraft] = useState<PropuestaRow[]>(rows.map(r => ({ ...r })));
    const [saving, setSaving] = useState(false);
    const [adding, setAdding] = useState(false);
    const [newNombre, setNewNombre] = useState("");
    const [newCantidad, setNewCantidad] = useState("0");
    const [newBusqueda, setNewBusqueda] = useState("");
    const [newExcluir, setNewExcluir] = useState("");
    const [newEsNuevo, setNewEsNuevo] = useState(false);

    function update(id: string, field: keyof PropuestaRow, value: string | number | boolean) {
        setDraft(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    }

    async function eliminar(id: string) {
        setDraft(prev => prev.filter(r => r.id !== id));
        await supabase.from("propuesta_altice").delete().eq("id", id);
    }

    async function agregar() {
        if (!newNombre.trim() || !newBusqueda.trim()) { return; }
        const { data, error } = await supabase.from("propuesta_altice").insert({
            nombre: newNombre.trim(),
            cantidad_propuesta: parseInt(newCantidad) || 0,
            busqueda: newBusqueda.trim(),
            excluir: newExcluir.trim(),
            es_nuevo: newEsNuevo,
            orden: (draft[draft.length - 1]?.orden ?? 0) + 1,
        }).select().single();
        if (!error && data) {
            setDraft(prev => [...prev, data as PropuestaRow]);
            setNewNombre(""); setNewCantidad("0"); setNewBusqueda(""); setNewExcluir(""); setNewEsNuevo(false);
            setAdding(false);
        }
    }

    async function handleSave() {
        setSaving(true);
        for (const r of draft) {
            await supabase.from("propuesta_altice").update({
                nombre: r.nombre,
                cantidad_propuesta: r.cantidad_propuesta,
                busqueda: r.busqueda,
                excluir: r.excluir,
                es_nuevo: r.es_nuevo,
                orden: r.orden,
                updated_at: new Date().toISOString(),
            }).eq("id", r.id);
        }
        setSaving(false);
        toast.success("Propuesta actualizada para todos los usuarios");
        onSave(draft);
        onClose();
    }

    const inputCls = "border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0">
                    <div>
                        <h3 className="text-base font-bold text-slate-800 dark:text-white">Editar propuesta enviada a Altice</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Los cambios se reflejan para todos los usuarios inmediatamente</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>

                {/* Table */}
                <div className="overflow-y-auto flex-1 p-4">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                                <th className="text-left pb-2 pr-2">Equipo</th>
                                <th className="text-center pb-2 pr-2 w-20">Propuesto</th>
                                <th className="text-left pb-2 pr-2">Búsqueda (palabras clave)</th>
                                <th className="text-left pb-2 pr-2">Excluir</th>
                                <th className="text-center pb-2 w-16">¿Nuevo?</th>
                                <th className="w-8 pb-2" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {draft.map(r => (
                                <tr key={r.id} className="group">
                                    <td className="py-2 pr-2">
                                        <input value={r.nombre} onChange={e => update(r.id, "nombre", e.target.value)}
                                            className={inputCls + " w-full"} />
                                    </td>
                                    <td className="py-2 pr-2">
                                        <input type="number" min={0} value={r.cantidad_propuesta}
                                            onChange={e => update(r.id, "cantidad_propuesta", parseInt(e.target.value) || 0)}
                                            className={inputCls + " w-full text-center"} />
                                    </td>
                                    <td className="py-2 pr-2">
                                        <input value={r.busqueda} onChange={e => update(r.id, "busqueda", e.target.value)}
                                            placeholder="ej: a56 o g56|motorola"
                                            className={inputCls + " w-full"} />
                                    </td>
                                    <td className="py-2 pr-2">
                                        <input value={r.excluir} onChange={e => update(r.id, "excluir", e.target.value)}
                                            placeholder="ej: pro"
                                            className={inputCls + " w-full"} />
                                    </td>
                                    <td className="py-2 text-center pr-2">
                                        <button onClick={() => update(r.id, "es_nuevo", !r.es_nuevo)}
                                            className={`w-8 h-4 rounded-full transition-colors ${r.es_nuevo ? "bg-rose-500" : "bg-slate-200 dark:bg-slate-600"}`}>
                                            <span className={`block w-3 h-3 rounded-full bg-white shadow mx-0.5 transition-transform ${r.es_nuevo ? "translate-x-4" : "translate-x-0"}`} />
                                        </button>
                                    </td>
                                    <td className="py-2">
                                        <button onClick={() => eliminar(r.id)}
                                            className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Add row */}
                    {adding ? (
                        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">Nuevo equipo</p>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <div>
                                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-0.5 block">Nombre</label>
                                    <input value={newNombre} onChange={e => setNewNombre(e.target.value)} placeholder="Samsung A36 5G" className={inputCls + " w-full"} />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-0.5 block">Cantidad propuesta</label>
                                    <input type="number" min={0} value={newCantidad} onChange={e => setNewCantidad(e.target.value)} className={inputCls + " w-full"} />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-0.5 block">Búsqueda (separar con |)</label>
                                    <input value={newBusqueda} onChange={e => setNewBusqueda(e.target.value)} placeholder="a36" className={inputCls + " w-full"} />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-0.5 block">Excluir (opcional)</label>
                                    <input value={newExcluir} onChange={e => setNewExcluir(e.target.value)} placeholder="pro" className={inputCls + " w-full"} />
                                </div>
                            </div>
                            <div className="flex items-center gap-3 mb-3">
                                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                                    <input type="checkbox" checked={newEsNuevo} onChange={e => setNewEsNuevo(e.target.checked)} className="rounded" />
                                    Equipo no incluido en propuesta original (mostrar como "nuevo")
                                </label>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setAdding(false)} className="flex-1 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs font-semibold text-slate-500">Cancelar</button>
                                <button onClick={agregar} disabled={!newNombre.trim() || !newBusqueda.trim()}
                                    className="flex-1 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50">Agregar</button>
                            </div>
                        </div>
                    ) : (
                        <button onClick={() => setAdding(true)}
                            className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Agregar equipo
                        </button>
                    )}

                    <p className="text-xs text-slate-400 mt-4">
                        <strong>Búsqueda:</strong> palabras clave separadas por | (OR). Ej: <code>g56|motorola</code> coincide con cualquiera.<br/>
                        <strong>Excluir:</strong> término que excluye la línea si aparece en el dispositivo. Ej: <code>pro</code> excluye &quot;iPhone 17 Pro Max&quot;.
                    </p>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex gap-3 shrink-0">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">Cancelar</button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold">
                        {saving ? "Guardando..." : "Guardar cambios"}
                    </button>
                </div>
            </div>
        </div>
    );
}

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
    const confirmadas = rows.filter(r => { const e = r.estado?.trim(); return e === "CONFIRMADA" || e === "OK"; }).length;
    const porConfirmar = rows.filter(r => r.estado?.trim() === "POR CONFIRMAR").length;
    const respondio = rows.filter(r => r.estado?.trim() === "RESPONDIÓ").length;
    const pendientes = rows.filter(r => {
        const e = r.estado?.trim();
        return e === "PENDIENTE" || e === "SIN RESPUESTA" || !e;
    }).length;
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
    {
        id: "sin_numero",
        nombre: "Líneas nuevas sin número asignado",
        descripcion: "Altas (NUEVA-XX) que aún no tienen un número Altice real asignado.",
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
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [propuestaRows, setPropuestaRows] = useState<PropuestaRow[]>([]);
    const [showPropuestaModal, setShowPropuestaModal] = useState(false);

    useEffect(() => {
        supabase.from("propuesta_altice").select("*").order("orden").then(({ data }) => {
            if (data) setPropuestaRows(data as PropuestaRow[]);
        });
        const ch = supabase.channel("propuesta-rt")
            .on("postgres_changes", { event: "*", schema: "public", table: "propuesta_altice" }, () => {
                supabase.from("propuesta_altice").select("*").order("orden").then(({ data }) => {
                    if (data) setPropuestaRows(data as PropuestaRow[]);
                });
            })
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, []);

    function handleReload() {
        reload();
        setLastUpdated(new Date());
    }

    const lastUpdatedLabel = lastUpdated
        ? `Hace ${Math.max(0, Math.floor((Date.now() - lastUpdated.getTime()) / 60000))} min`
        : null;
    const { goToPerfiles, goToAlmacen, goToSimulador } = useNav();
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
        // Usa propuesta dinámica desde BD
        const noNuevos = propuestaRows.filter(r => !r.es_nuevo);
        const hasDiff = noNuevos.some(row => calcActual(lineas, row) !== row.cantidad_propuesta);

        const cotizar = lineas.filter(r => r.proxima_accion === "COTIZAR").length;
        const cartas  = lineas.filter(r => r.proxima_accion === "CARTA").length;
        const sinMonto = lineas.filter(r => parseMonto(r.monto_mensual) === 0).length;
        const sinRespuesta = lineas.filter(r => r.estado === "SIN RESPUESTA" || r.estado === "PENDIENTE").length;
        const nuevosRows = propuestaRows.filter(r => r.es_nuevo);
        const s26 = nuevosRows.length > 0
            ? nuevosRows.reduce((acc, r) => acc + calcActual(lineas, r), 0)
            : lineas.filter(r => r.dispositivo_2026?.toLowerCase().includes("s26")).length;
        const sinPorta = lineas.filter(r => !r.portabilidad?.trim()).length;
        const sinTitularCount = lineas.filter(r => !r.titular_responsable?.trim() || r.titular_responsable.trim().toUpperCase().includes("SIN TITULAR")).length;

        const candidatas: AlertaGenerada[] = [];

        if (hasDiff) {
            const diffs = noNuevos.filter(r => calcActual(lineas, r) !== r.cantidad_propuesta);
            const firstDiff = diffs[0];
            candidatas.push({
                id: "propuesta_altice",
                nivel: "rojo",
                titulo: "La propuesta enviada a Altice no refleja el levantamiento actual",
                desc: `${diffs.map(r => `${r.nombre}: propuesto ${r.cantidad_propuesta}, actual ${calcActual(lineas, r)}`).join(" · ")}. Altice necesita los números actualizados antes de firmar.`,
                ctaLabel: firstDiff ? `Ver ${firstDiff.nombre}` : undefined,
                accion: firstDiff ? () => goToPerfiles({ dispositivoContains: firstDiff.busqueda.split("|")[0] }) : undefined,
                count: diffs.reduce((acc, r) => acc + calcActual(lineas, r), 0),
            });
        }

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
            accion: () => goToPerfiles({ estadoIn: ["PENDIENTE", "SIN RESPUESTA"] }),
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
            accion: () => goToPerfiles({ sinTitular: true }),
            count: sinTitularCount,
        });

        const sinNumero = lineas.filter(r => r.telefono?.toUpperCase().startsWith("NUEVA") || r.telefono?.toUpperCase().startsWith("NUEVO")).length;
        if (sinNumero > 0) candidatas.push({
            id: "sin_numero",
            nivel: "naranja",
            titulo: `${sinNumero} líneas nuevas (ALTA) aún sin número Altice asignado`,
            desc: `Estas líneas tienen código temporal (NUEVA-XX). Ve a Perfiles, abre cada una y usa el panel naranja para asignar el número real.`,
            ctaLabel: `Asignar números →`,
            accion: () => goToPerfiles({ accion: "ALTA" }),
            count: sinNumero,
        });

        return candidatas;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lineas, propuestaRows]);

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

    // Hooks must be declared before any early returns (Rules of Hooks)
    const propuestaActual = useMemo(() =>
        propuestaRows.map(row => ({ row, actual: calcActual(lineas, row) })),
        [propuestaRows, lineas]
    );
    const s26 = useMemo(() => {
        const s26Row = propuestaRows.find(r => r.es_nuevo);
        return s26Row ? calcActual(lineas, s26Row) : lineas.filter(r => r.dispositivo_2026?.toLowerCase().includes("s26")).length;
    }, [propuestaRows, lineas]);

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
                <button onClick={handleReload}
                    className="text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
                    {lastUpdatedLabel ? `Actualizado · ${lastUpdatedLabel}` : "Actualizar"}
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
                    {pctConfirmadas > 0  && <div className="h-full bg-emerald-500 transition-all duration-700 cursor-pointer hover:brightness-90" style={{ width: `${pctConfirmadas}%` }} title={`Confirmadas: ${stats.confirmadas}`} onClick={() => goToPerfiles({ estadoIn: ["CONFIRMADA", "OK"] })} />}
                    {pctPorConfirmar > 0 && <div className="h-full bg-blue-400   transition-all duration-700 cursor-pointer hover:brightness-90" style={{ width: `${pctPorConfirmar}%` }} title={`Por confirmar: ${stats.porConfirmar}`} onClick={() => goToPerfiles({ estado: "POR CONFIRMAR" })} />}
                    {pctRespondio > 0    && <div className="h-full bg-amber-400  transition-all duration-700 cursor-pointer hover:brightness-90" style={{ width: `${pctRespondio}%` }} title={`Respondió: ${stats.respondio}`} onClick={() => goToPerfiles({ estado: "RESPONDIÓ" })} />}
                    {pctPendientes > 0   && <div className="h-full bg-slate-200 dark:bg-slate-600 transition-all duration-700 cursor-pointer hover:brightness-90" style={{ width: `${pctPendientes}%` }} onClick={() => goToPerfiles({ estadoIn: ["PENDIENTE", "SIN RESPUESTA", ""] })} />}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
                    {[
                        { color: "bg-emerald-500", label: "Confirmadas",   count: stats.confirmadas,  filter: { estadoIn: ["CONFIRMADA", "OK"] } },
                        { color: "bg-blue-400",    label: "Por confirmar", count: stats.porConfirmar, filter: { estado: "POR CONFIRMAR" } },
                        { color: "bg-amber-400",   label: "Respondió",     count: stats.respondio,    filter: { estado: "RESPONDIÓ" } },
                        { color: "bg-slate-300 dark:bg-slate-600", label: "Pendientes", count: stats.pendientes, filter: { estadoIn: ["PENDIENTE", "SIN RESPUESTA", ""] } },
                    ].filter(item => item.count > 0).map(item => (
                        <button key={item.label}
                            onClick={() => goToPerfiles(item.filter)}
                            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                            <span className={`w-2.5 h-2.5 rounded-full inline-block ${item.color}`} />
                            {item.label} ({item.count})
                        </button>
                    ))}
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

            {/* ── PANEL ASIGNACIÓN DE NÚMEROS ──────────────────────────── */}
            {(() => {
                const isNueva = (t: string) => t?.toUpperCase().startsWith("NUEVA") || t?.toUpperCase().startsWith("NUEVO");

                // Líneas ALTA nuevas (código NUEVA-XX → necesitan telefono real)
                const altasNuevas      = lineas.filter(r => r.accion_2026 === "ALTA" && isNueva(r.telefono));
                const altasAsignadas   = lineas.filter(r => r.accion_2026 === "ALTA" && !isNueva(r.telefono));

                // Portabilidades que requieren numero_altice provisional
                const portClaro  = lineas.filter(r => r.portabilidad === "Claro");
                const portAltice = lineas.filter(r => r.portabilidad === "Altice");
                const portNuevo  = lineas.filter(r => r.portabilidad === "Nuevo");

                const portClaroOk  = portClaro.filter(r => !!r.numero_altice);
                const portAlticeOk = portAltice.filter(r => !!r.numero_altice);
                const portNuevoOk  = portNuevo.filter(r => !!r.numero_altice || !isNueva(r.telefono));

                // Totales globales
                const totalNecesitan = altasNuevas.length + altasAsignadas.length + portClaro.length + portAltice.length + portNuevo.length;
                const totalAsignados = altasAsignadas.length + portClaroOk.length + portAlticeOk.length + portNuevoOk.length;
                const totalPendientes = totalNecesitan - totalAsignados;
                const pctGlobal = totalNecesitan > 0 ? Math.round((totalAsignados / totalNecesitan) * 100) : 0;

                if (totalNecesitan === 0) return null;

                function BarraCategoria({ label, ok, total, color, onClick }: { label: string; ok: number; total: number; color: string; onClick?: () => void }) {
                    if (total === 0) return null;
                    const p = Math.round((ok / total) * 100);
                    return (
                        <div
                            className={`space-y-1 ${onClick ? "cursor-pointer rounded-lg px-2 py-1.5 -mx-2 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors" : ""}`}
                            onClick={onClick}
                            role={onClick ? "button" : undefined}
                            tabIndex={onClick ? 0 : undefined}
                            onKeyDown={onClick ? e => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
                        >
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-600 dark:text-slate-300 font-medium">{label}</span>
                                <span className={`font-bold ${ok === total ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>{ok}/{total}</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${p}%` }} />
                            </div>
                        </div>
                    );
                }

                return (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        {/* Header */}
                        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Asignación de números Altice</p>
                                {totalPendientes > 0 && (
                                    <span className="flex h-2 w-2 relative">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                                    </span>
                                )}
                            </div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${totalPendientes === 0 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                                {pctGlobal}% completo
                            </span>
                        </div>

                        <div className="p-5 space-y-5">
                            {/* Contadores globales */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 p-3 text-center">
                                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalAsignados}</p>
                                    <p className="text-[10px] font-semibold text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-wide mt-0.5">Asignados</p>
                                </div>
                                <div className={`rounded-xl border p-3 text-center ${totalPendientes > 0 ? "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800" : "bg-slate-50 dark:bg-slate-700/40 border-slate-100 dark:border-slate-700"}`}>
                                    <p className={`text-2xl font-bold ${totalPendientes > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-400"}`}>{totalPendientes}</p>
                                    <p className={`text-[10px] font-semibold uppercase tracking-wide mt-0.5 ${totalPendientes > 0 ? "text-amber-600/70 dark:text-amber-400/70" : "text-slate-400"}`}>Pendientes</p>
                                </div>
                                <div className="rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700 p-3 text-center">
                                    <p className="text-2xl font-bold text-slate-600 dark:text-slate-300">{totalNecesitan}</p>
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">Total</p>
                                </div>
                            </div>

                            {/* Barra global */}
                            <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-700 ${pctGlobal === 100 ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${pctGlobal}%` }} />
                            </div>


                            {totalPendientes > 0 && (
                                <div className="flex gap-2">
                                    <button onClick={() => goToPerfiles({ accion: "ALTA" })} className="flex-1 text-center text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline">
                                        Ver perfiles pendientes →
                                    </button>
                                    <button onClick={() => goToAlmacen()} className="flex-1 text-center text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                                        Stock disponible en Almacén →
                                    </button>
                                    <button onClick={() => goToSimulador()} className="flex-1 text-center text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">
                                        Simular subsidio →
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* ── TABLA PROPUESTA VS LEVANTAMIENTO ─────────────────────── */}
            {showPropuestaModal && (
                <PropuestaModal
                    rows={propuestaRows}
                    onSave={updated => setPropuestaRows(updated)}
                    onClose={() => setShowPropuestaModal(false)}
                />
            )}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Propuesta enviada a Altice vs levantamiento actual</p>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 italic hidden sm:inline">Clic en fila para filtrar</span>
                        <button onClick={() => setShowPropuestaModal(true)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline shrink-0">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Editar propuesta
                        </button>
                    </div>
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
                        {propuestaActual.map(({ row, actual: act }) => {
                            if (row.es_nuevo) {
                                return act > 0 ? (
                                    <tr key={row.id}
                                        className="bg-rose-50/50 dark:bg-rose-950/10 cursor-pointer hover:bg-rose-100/60 dark:hover:bg-rose-950/30 transition-colors"
                                        onClick={() => goToPerfiles({ dispositivoContains: row.busqueda.split("|")[0] })}>
                                        <td className="px-5 py-2.5 text-slate-700 dark:text-slate-200">{row.nombre}</td>
                                        <td className="px-4 py-2.5 text-center text-slate-400">—</td>
                                        <td className="px-4 py-2.5 text-center font-medium text-rose-600 dark:text-rose-400">{act}</td>
                                        <td className="px-4 py-2.5 text-center font-bold text-rose-600 dark:text-rose-400">+{act} nuevo</td>
                                    </tr>
                                ) : null;
                            }
                            const diff = act - row.cantidad_propuesta;
                            return (
                                <tr key={row.id}
                                    onClick={() => goToPerfiles({ dispositivoContains: row.busqueda.split("|")[0] })}
                                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                                    <td className="px-5 py-2.5 text-slate-700 dark:text-slate-200">{row.nombre}</td>
                                    <td className="px-4 py-2.5 text-center text-slate-500 dark:text-slate-400">{row.cantidad_propuesta}</td>
                                    <td className="px-4 py-2.5 text-center font-medium text-slate-700 dark:text-slate-200">{act}</td>
                                    <td className={`px-4 py-2.5 text-center font-bold ${diff > 0 ? "text-rose-600 dark:text-rose-400" : diff < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                                        {diff > 0 ? `+${diff}` : diff === 0 ? "=" : diff}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {propuestaRows.length === 0 && (
                    <div className="px-5 py-6 text-center text-sm text-slate-400">
                        <button onClick={() => setShowPropuestaModal(true)} className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                            Configurar propuesta →
                        </button>
                    </div>
                )}
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
                                    className={`rounded-2xl px-4 py-3 w-full transition-all hover:scale-[1.02] active:scale-95 cursor-pointer flex items-center justify-between gap-3 ${a.color}`}>
                                    <div className="text-left">
                                        <p className="text-2xl font-black leading-none">{a.count}</p>
                                        <p className="text-xs font-semibold mt-0.5 opacity-80">{a.label}</p>
                                    </div>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-50"><polyline points="9 18 15 12 9 6"/></svg>
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
                                            onClick={() => goToPerfiles(k === "Sin marcar" ? { sinPortabilidad: true } : { portabilidad: k })}
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

            {/* ── DATOS CONTRATADOS ────────────────────────────────────── */}
            {(() => {
                // Agrupa por gb_solicitado; usa lista de configuración para el orden
                const configPlanes = getList("plan_datos"); // ej. ["5GB","10GB","15GB+5GB Bono"...]
                const gbMap: Record<string, number> = {};
                lineas.forEach(l => {
                    const raw = l.gb_solicitado?.trim();
                    if (!raw) { gbMap["Sin definir"] = (gbMap["Sin definir"] ?? 0) + 1; return; }
                    // Normaliza: extrae solo el primer bloque "XGB" o usa el valor completo
                    const match = raw.match(/^(\d+\s*GB)/i);
                    const key = match ? match[1].replace(/\s+/, "") : raw;
                    gbMap[key] = (gbMap[key] ?? 0) + 1;
                });
                if (Object.keys(gbMap).length === 0) return null;

                // Ordena: primero los que están en configPlanes, luego resto numérico, "Sin definir" al final
                const toNum = (s: string) => parseInt(s) || 9999;
                const allKeys = Object.keys(gbMap);
                const sorted = allKeys.sort((a, b) => {
                    const ai = configPlanes.findIndex(p => p.startsWith(a) || a.startsWith(parseInt(p).toString()));
                    const bi = configPlanes.findIndex(p => p.startsWith(b) || b.startsWith(parseInt(p).toString()));
                    if (a === "Sin definir") return 1;
                    if (b === "Sin definir") return -1;
                    if (ai !== -1 && bi !== -1) return ai - bi;
                    if (ai !== -1) return -1;
                    if (bi !== -1) return 1;
                    return toNum(a) - toNum(b);
                });

                const total = lineas.length || 1;
                const PALETTE = [
                    { bar: "bg-blue-500",    text: "text-blue-700 dark:text-blue-300",       bg: "bg-blue-50 dark:bg-blue-900/20" },
                    { bar: "bg-violet-500",  text: "text-violet-700 dark:text-violet-300",   bg: "bg-violet-50 dark:bg-violet-900/20" },
                    { bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
                    { bar: "bg-cyan-500",    text: "text-cyan-700 dark:text-cyan-300",       bg: "bg-cyan-50 dark:bg-cyan-900/20" },
                    { bar: "bg-amber-500",   text: "text-amber-700 dark:text-amber-300",     bg: "bg-amber-50 dark:bg-amber-900/20" },
                    { bar: "bg-pink-500",    text: "text-pink-700 dark:text-pink-300",       bg: "bg-pink-50 dark:bg-pink-900/20" },
                    { bar: "bg-lime-500",    text: "text-lime-700 dark:text-lime-300",       bg: "bg-lime-50 dark:bg-lime-900/20" },
                    { bar: "bg-orange-500",  text: "text-orange-700 dark:text-orange-300",   bg: "bg-orange-50 dark:bg-orange-900/20" },
                ];
                const sinDefinirStyle = { bar: "bg-slate-300", text: "text-slate-500 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-700/40" };

                return (
                    <div>
                        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Datos contratados (2026)</h3>
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                            {/* Barra stacked */}
                            <div className="flex rounded-full overflow-hidden h-3 gap-px">
                                {sorted.map((k, i) => {
                                    const c = k === "Sin definir" ? sinDefinirStyle : PALETTE[i % PALETTE.length];
                                    return (
                                        <div key={k} title={`${k}: ${gbMap[k]}`}
                                            style={{ width: `${((gbMap[k] ?? 0) / total) * 100}%` }}
                                            className={`${c.bar} transition-all`} />
                                    );
                                })}
                            </div>
                            {/* Tarjetas */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
                                {sorted.map((k, i) => {
                                    const c = k === "Sin definir" ? sinDefinirStyle : PALETTE[i % PALETTE.length];
                                    const v = gbMap[k] ?? 0;
                                    const displayLabel = k.replace(/\s*\(RD\$[^)]+\)/i, '').trim();
                                    return (
                                        <button key={k}
                                            onClick={() => goToPerfiles(k === "Sin definir" ? { sinGb: true } : { gbContains: k })}
                                            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl ${c.bg} hover:opacity-80 transition-opacity`}>
                                            <span className={`text-xs font-semibold ${c.text} truncate`}>{displayLabel}</span>
                                            <span className={`text-sm font-black ${c.text} shrink-0`}>{v}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── DISTRIBUCIÓN POR TIPO ────────────────────────────────── */}
            {(() => {
                const tipoMap = lineas.reduce((acc, r) => {
                    const tipo = r.tipo || "Sin tipo";
                    acc[tipo] = (acc[tipo] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);
                const tipoEntries = Object.entries(tipoMap).sort((a, b) => b[1] - a[1]);
                const tipoTotal = lineas.length || 1;
                const TIPO_PALETTE = [
                    { bar: "bg-blue-500",    bg: "bg-blue-50 dark:bg-blue-900/20",       text: "text-blue-700 dark:text-blue-300" },
                    { bar: "bg-violet-500",  bg: "bg-violet-50 dark:bg-violet-900/20",   text: "text-violet-700 dark:text-violet-300" },
                    { bar: "bg-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-300" },
                    { bar: "bg-amber-500",   bg: "bg-amber-50 dark:bg-amber-900/20",     text: "text-amber-700 dark:text-amber-300" },
                    { bar: "bg-rose-500",    bg: "bg-rose-50 dark:bg-rose-900/20",       text: "text-rose-700 dark:text-rose-300" },
                    { bar: "bg-cyan-500",    bg: "bg-cyan-50 dark:bg-cyan-900/20",       text: "text-cyan-700 dark:text-cyan-300" },
                    { bar: "bg-pink-500",    bg: "bg-pink-50 dark:bg-pink-900/20",       text: "text-pink-700 dark:text-pink-300" },
                    { bar: "bg-lime-500",    bg: "bg-lime-50 dark:bg-lime-900/20",       text: "text-lime-700 dark:text-lime-300" },
                ];
                return (
                    <div>
                        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Distribución por tipo</h3>
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                            {/* Barra stacked */}
                            <div className="flex rounded-full overflow-hidden h-3 gap-px">
                                {tipoEntries.map(([tipo, cnt], i) => {
                                    const c = TIPO_PALETTE[i % TIPO_PALETTE.length];
                                    return (
                                        <div key={tipo} title={`${tipo}: ${cnt}`}
                                            style={{ width: `${(cnt / tipoTotal) * 100}%` }}
                                            className={`${c.bar} transition-all`} />
                                    );
                                })}
                            </div>
                            {/* Filas con barra de progreso */}
                            <div className="space-y-1.5">
                                {tipoEntries.map(([tipo, cnt], i) => {
                                    const c = TIPO_PALETTE[i % TIPO_PALETTE.length];
                                    const pct = Math.round((cnt / tipoTotal) * 100);
                                    return (
                                        <button key={tipo}
                                            onClick={() => goToPerfiles(tipo === "Sin tipo" ? { sinTipo: true } : { tipo })}
                                            className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.bar}`} />
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 w-32 text-left truncate">{tipo}</span>
                                            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div className={`h-full ${c.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                            </div>
                                            <span className="text-xs text-slate-400 dark:text-slate-500 w-8 text-right shrink-0">{pct}%</span>
                                            <span className="text-sm font-bold text-slate-600 dark:text-slate-300 w-6 text-right shrink-0">{cnt}</span>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-0 group-hover:opacity-40 transition-opacity"><polyline points="9 18 15 12 9 6"/></svg>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            })()}

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
        </div>
    );
}
