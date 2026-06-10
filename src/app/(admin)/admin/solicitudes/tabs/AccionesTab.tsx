"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase, type LineaAltice, ACCION_COLORS } from "@/lib/supabase";
import toast from "react-hot-toast";

const CRITICOS = ["829-521-5406", "829-679-7928", "829-755-8327", "829-420-7725"];

type FiltroAccion = "TODOS" | "LLAMAR" | "CARTA" | "CANCELAR" | "COTIZAR" | "CRITICOS";

function detectarTipo(proxima: string): string {
    const p = proxima.toLowerCase();
    if (p.includes("llamar") || p.includes("llamada")) return "LLAMAR";
    if (p.includes("carta") || p.includes("comunicación") || p.includes("notificación")) return "CARTA";
    if (p.includes("cancelar") || p.includes("cancel")) return "CANCELAR";
    if (p.includes("cotizar") || p.includes("cotización")) return "COTIZAR";
    return "OTRO";
}

const TIPO_STYLES: Record<string, string> = {
    "LLAMAR": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    "CARTA": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    "CANCELAR": "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    "COTIZAR": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    "OTRO": "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

const TIPO_ICONS: Record<string, string> = {
    "LLAMAR": "📞", "CARTA": "📄", "CANCELAR": "❌", "COTIZAR": "💰", "OTRO": "📌",
};

export default function AccionesTab() {
    const [all, setAll] = useState<LineaAltice[]>([]);
    const [loading, setLoading] = useState(true);
    const [filtro, setFiltro] = useState<FiltroAccion>("TODOS");
    const [search, setSearch] = useState("");
    const [completadas, setCompletadas] = useState<Set<string>>(new Set());

    const loadData = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase.from("lineas_altice").select("*");
        setAll((data ?? []) as LineaAltice[]);
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // Cargar completadas desde localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem("acciones_completadas");
            if (saved) setCompletadas(new Set(JSON.parse(saved)));
        } catch { /* ok */ }
    }, []);

    function toggleCompletada(id: string) {
        setCompletadas(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            localStorage.setItem("acciones_completadas", JSON.stringify([...next]));
            return next;
        });
    }

    async function marcarEstado(id: string, estado: string) {
        const { error } = await supabase.from("lineas_altice").update({ estado }).eq("id", id);
        if (error) { toast.error("Error guardando"); return; }
        setAll(prev => prev.map(r => r.id === id ? { ...r, estado } : r));
        toast.success("Estado actualizado ✓", { duration: 1200 });
    }

    async function guardarSeguimiento(id: string, valor: string) {
        const { error } = await supabase.from("lineas_altice").update({ seguimiento: valor }).eq("id", id);
        if (error) { toast.error("Error guardando"); return; }
        setAll(prev => prev.map(r => r.id === id ? { ...r, seguimiento: valor } : r));
        toast.success("Nota guardada ✓", { duration: 1200 });
    }

    const pendientes = all.filter(r => r.proxima_accion && r.proxima_accion.trim() !== "");

    const filtrados = pendientes.filter(r => {
        const esCritico = CRITICOS.includes(r.telefono);
        if (filtro === "CRITICOS") return esCritico;
        if (filtro !== "TODOS") return detectarTipo(r.proxima_accion) === filtro;
        if (search) {
            const q = search.toLowerCase();
            return r.usuario_linea.toLowerCase().includes(q) ||
                r.titular_responsable.toLowerCase().includes(q) ||
                r.telefono.includes(q) ||
                r.proxima_accion.toLowerCase().includes(q);
        }
        return true;
    }).filter(r => {
        if (!search || filtro !== "TODOS") return true;
        const q = search.toLowerCase();
        return r.usuario_linea.toLowerCase().includes(q) ||
            r.titular_responsable.toLowerCase().includes(q) ||
            r.telefono.includes(q) ||
            r.proxima_accion.toLowerCase().includes(q);
    });

    // Agrupar críticos primero
    const criticos = filtrados.filter(r => CRITICOS.includes(r.telefono));
    const normales = filtrados.filter(r => !CRITICOS.includes(r.telefono));
    const ordenado = [...criticos, ...normales];

    const pendientesSinCompletar = ordenado.filter(r => !completadas.has(r.id));
    const completadasList = ordenado.filter(r => completadas.has(r.id));

    if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Acciones Pendientes</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {pendientesSinCompletar.length} pendientes · {completadasList.length} completadas
                    </p>
                </div>
                {completadas.size > 0 && (
                    <button onClick={() => { setCompletadas(new Set()); localStorage.removeItem("acciones_completadas"); }}
                        className="text-sm text-slate-500 hover:text-red-500 underline transition-colors">
                        Limpiar marcas ✓
                    </button>
                )}
            </div>

            {/* Filtros */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                    {(["TODOS", "CRITICOS", "LLAMAR", "CARTA", "CANCELAR", "COTIZAR"] as FiltroAccion[]).map(f => (
                        <button key={f} onClick={() => setFiltro(f)}
                            className={`text-sm px-3 py-1.5 rounded-full font-semibold transition-all ${filtro === f
                                ? f === "CRITICOS" ? "bg-rose-600 text-white" : "bg-blue-600 text-white"
                                : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                                }`}>
                            {f === "CRITICOS" ? "🔴 Críticos" : f === "TODOS" ? "Todos" : `${TIPO_ICONS[f]} ${f}`}
                        </button>
                    ))}
                </div>
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="🔍 Buscar por nombre, titular, teléfono o acción..."
                    className="w-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* Lista de acciones */}
            <div className="space-y-2">
                {pendientesSinCompletar.map(r => {
                    const esCritico = CRITICOS.includes(r.telefono);
                    const tipo = detectarTipo(r.proxima_accion);
                    return (
                        <div key={r.id}
                            className={`bg-white dark:bg-slate-800 rounded-2xl border transition-all ${esCritico
                                ? "border-rose-300 dark:border-rose-700 shadow-sm shadow-rose-100 dark:shadow-rose-900/20"
                                : "border-slate-200 dark:border-slate-700"
                                }`}>
                            <div className="p-4">
                                <div className="flex flex-wrap items-start gap-3">
                                    {/* Checkbox completado */}
                                    <button onClick={() => toggleCompletada(r.id)}
                                        className="w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-600 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors shrink-0 mt-0.5 flex items-center justify-center">
                                    </button>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            {esCritico && <span className="text-xs font-bold text-rose-600 dark:text-rose-400">🔴 CRÍTICO</span>}
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TIPO_STYLES[tipo]}`}>
                                                {TIPO_ICONS[tipo]} {tipo}
                                            </span>
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ACCION_COLORS[r.accion_2026] ?? "bg-slate-100 text-slate-500"}`}>
                                                {r.accion_2026 || "—"}
                                            </span>
                                        </div>
                                        <p className="font-bold text-sm text-slate-800 dark:text-white">{r.usuario_linea || "Sin nombre"}</p>
                                        <p className="text-xs text-slate-400 mb-2">
                                            {r.titular_responsable && r.titular_responsable !== r.usuario_linea && `Titular: ${r.titular_responsable} · `}
                                            {r.telefono}
                                        </p>
                                        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 text-sm text-slate-700 dark:text-slate-200 border-l-4 border-blue-400">
                                            {r.proxima_accion}
                                        </div>
                                    </div>

                                    {/* Estado */}
                                    <div className="shrink-0">
                                        <select value={r.estado}
                                            onChange={e => marcarEstado(r.id, e.target.value)}
                                            className="text-xs border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                            {["", "CONFIRMADA", "POR CONFIRMAR", "PENDIENTE", "OK", "RESPONDIÓ", "SIN RESPUESTA"].map(a => (
                                                <option key={a} value={a}>{a || "(estado)"}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Nota de seguimiento */}
                                <SeguimientoInline id={r.id} value={r.seguimiento} onSave={v => guardarSeguimiento(r.id, v)} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Completadas */}
            {completadasList.length > 0 && (
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">✅ Completadas</h3>
                    <div className="space-y-2">
                        {completadasList.map(r => (
                            <div key={r.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 p-3 opacity-60">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => toggleCompletada(r.id)}
                                        className="w-6 h-6 rounded-full bg-green-500 text-white text-xs flex items-center justify-center shrink-0">
                                        ✓
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <span className="font-medium text-sm text-slate-600 dark:text-slate-300 line-through">{r.usuario_linea}</span>
                                        <span className="font-mono text-xs text-slate-400 ml-2">{r.telefono}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {ordenado.length === 0 && (
                <div className="py-16 text-center text-slate-400">
                    <p className="text-4xl mb-2">🎉</p>
                    <p>No hay acciones pendientes con esos filtros</p>
                </div>
            )}
        </div>
    );
}

function SeguimientoInline({ id, value, onSave }: { id: string; value: string; onSave: (v: string) => void }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);

    function commit() {
        setEditing(false);
        if (draft !== value) onSave(draft);
    }

    return (
        <div className="mt-2">
            {editing ? (
                <div className="flex gap-2">
                    <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2}
                        className="flex-1 text-xs border border-blue-400 rounded-lg p-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                    <div className="flex flex-col gap-1">
                        <button onClick={commit} className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-500">✓</button>
                        <button onClick={() => setEditing(false)} className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 px-3 py-1 rounded-lg">✕</button>
                    </div>
                </div>
            ) : (
                <button onClick={() => { setDraft(value); setEditing(true); }}
                    className="w-full text-left text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded-lg px-2 py-1 transition-colors">
                    {value ? `📝 ${value}` : <span className="italic text-slate-300 dark:text-slate-600">+ Agregar nota de seguimiento</span>}
                </button>
            )}
        </div>
    );
}
