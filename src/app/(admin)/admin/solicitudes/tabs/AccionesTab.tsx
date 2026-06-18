"use client";
import React, { useEffect, useState } from "react";
import { type LineaAltice, ACCION_COLORS } from "@/lib/supabase";
import { useLineas } from "@/lib/LineasContext";
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

const TIPO_ICONS: Record<string, React.ReactNode> = {
    "LLAMAR": <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>,
    "CARTA": <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
    "CANCELAR": <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
    "COTIZAR": <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
    "OTRO": <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
};

// IDs completados en esta sesión (para mostrar la sección "Completadas" sin recargar)
type CompletadaItem = { id: string; usuario: string; telefono: string; accionAnterior: string };

export default function AccionesTab() {
    const { lineas: all, loading, reload, mutate } = useLineas();
    const [filtro, setFiltro] = useState<FiltroAccion>("TODOS");
    const [search, setSearch] = useState("");
    // Registro en sesión de ítems completados (solo visual, la fuente de verdad es Supabase)
    const [completadasSesion, setCompletadasSesion] = useState<CompletadaItem[]>([]);
    const [completando, setCompletando] = useState<string | null>(null);

    // Marcar como completada: limpia proxima_accion en Supabase
    async function completar(r: LineaAltice) {
        setCompletando(r.id);
        const ok = await mutate(r.id, { proxima_accion: "" });
        setCompletando(null);

        if (!ok) { toast.error("Error al guardar"); return; }

        setCompletadasSesion(prev => [
            { id: r.id, usuario: r.usuario_linea || r.telefono, telefono: r.telefono, accionAnterior: r.proxima_accion },
            ...prev,
        ]);
        toast.success(`✓ Acción completada — ${r.usuario_linea || r.telefono}`, { duration: 2000 });
    }

    // Deshacer: restaura la proxima_accion anterior
    async function deshacer(item: CompletadaItem) {
        const ok = await mutate(item.id, { proxima_accion: item.accionAnterior });
        if (!ok) { toast.error("Error al restaurar"); return; }
        setCompletadasSesion(prev => prev.filter(c => c.id !== item.id));
        toast.success("Acción restaurada");
    }

    async function marcarEstado(id: string, estado: string) {
        const ok = await mutate(id, { estado });
        if (!ok) { toast.error("Error guardando"); return; }
        toast.success("Estado actualizado ✓", { duration: 1200 });
    }

    async function guardarSeguimiento(id: string, valor: string) {
        const ok = await mutate(id, { seguimiento: valor });
        if (!ok) { toast.error("Error guardando"); return; }
        toast.success("Nota guardada ✓", { duration: 1200 });
    }

    // Líneas con proxima_accion pendiente (fuente de verdad: Supabase)
    const pendientes = all.filter(r => r.proxima_accion && r.proxima_accion.trim() !== "");
    const totalPendientes = pendientes.length;

    const filtrados = pendientes.filter(r => {
        const esCritico = CRITICOS.includes(r.telefono);
        if (filtro === "CRITICOS" && !esCritico) return false;
        if (filtro !== "TODOS" && filtro !== "CRITICOS" && detectarTipo(r.proxima_accion) !== filtro) return false;
        if (search) {
            const q = search.toLowerCase();
            return (
                r.usuario_linea.toLowerCase().includes(q) ||
                r.titular_responsable.toLowerCase().includes(q) ||
                r.telefono.includes(q) ||
                r.proxima_accion.toLowerCase().includes(q) ||
                r.seguimiento.toLowerCase().includes(q)
            );
        }
        return true;
    });

    // Críticos primero
    const criticos = filtrados.filter(r => CRITICOS.includes(r.telefono));
    const normales = filtrados.filter(r => !CRITICOS.includes(r.telefono));
    const ordenado = [...criticos, ...normales];

    if (loading) return (
        <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Acciones Pendientes</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-amber-600">{totalPendientes}</span> pendientes
                        {completadasSesion.length > 0 && (
                            <> · <span className="font-semibold text-emerald-600">{completadasSesion.length}</span> completadas esta sesión</>
                        )}
                    </p>
                </div>
                <button onClick={reload}
                    className="text-sm bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 px-3 py-2 rounded-xl font-semibold transition-colors flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> Actualizar
                </button>
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
                            {f === "CRITICOS" ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle",marginRight:3}}><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> Críticos</> : f === "TODOS" ? "Todos" : <span className="flex items-center gap-1">{TIPO_ICONS[f] ?? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>} {f}</span>}
                        </button>
                    ))}
                </div>
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por nombre, titular, teléfono o acción..."
                    className="w-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* Lista de acciones pendientes */}
            <div className="space-y-2">
                {ordenado.map(r => {
                    const esCritico = CRITICOS.includes(r.telefono);
                    const tipo = detectarTipo(r.proxima_accion);
                    const estaCargando = completando === r.id;
                    return (
                        <div key={r.id}
                            className={`bg-white dark:bg-slate-800 rounded-2xl border transition-all ${esCritico
                                ? "border-rose-300 dark:border-rose-700 shadow-sm shadow-rose-100 dark:shadow-rose-900/20"
                                : "border-slate-200 dark:border-slate-700"
                                } ${estaCargando ? "opacity-50" : ""}`}>
                            <div className="p-4">
                                <div className="flex flex-wrap items-start gap-3">
                                    {/* Botón completar */}
                                    <button
                                        onClick={() => completar(r)}
                                        disabled={estaCargando}
                                        title="Marcar como completada"
                                        className="w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-600 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all shrink-0 mt-0.5 flex items-center justify-center disabled:opacity-40 group">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity"><polyline points="20 6 9 17 4 12"/></svg>
                                    </button>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            {esCritico && <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> CRÍTICO</span>}
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${TIPO_STYLES[tipo]}`}>
                                                {TIPO_ICONS[tipo]} {tipo}
                                            </span>
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ACCION_COLORS[r.accion_2026] ?? "bg-slate-100 text-slate-500"}`}>
                                                {r.accion_2026 || "—"}
                                            </span>
                                        </div>
                                        <p className="font-bold text-sm text-slate-800 dark:text-white">{r.usuario_linea || "Sin nombre"}</p>
                                        <p className="text-xs text-slate-400 mb-2">
                                            {r.titular_responsable && r.titular_responsable !== r.usuario_linea
                                                ? `Titular: ${r.titular_responsable} · ` : ""}
                                            {r.titular_responsable === "" || !r.titular_responsable
                                                ? <span className="text-amber-500">(SIN TITULAR — identificar) · </span> : ""}
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

            {ordenado.length === 0 && totalPendientes === 0 && (
                <div className="py-16 text-center text-slate-400">
                    <div className="flex justify-center mb-2"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.1 9 11.1"/></svg></div>
                    <p className="font-medium">¡No hay acciones pendientes!</p>
                </div>
            )}

            {ordenado.length === 0 && totalPendientes > 0 && (
                <div className="py-10 text-center text-slate-400">
                    <div className="flex justify-center mb-2"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
                    <p>No hay acciones con esos filtros</p>
                </div>
            )}

            {/* Completadas esta sesión */}
            {completadasSesion.length > 0 && (
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.1 9 11.1"/></svg> Completadas esta sesión ({completadasSesion.length})
                    </h3>
                    <div className="space-y-1.5">
                        {completadasSesion.map(item => (
                            <div key={item.id}
                                className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-2xl px-4 py-2.5 flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
                                <div className="flex-1 min-w-0">
                                    <span className="font-medium text-sm text-slate-700 dark:text-slate-200">{item.usuario}</span>
                                    <span className="font-mono text-xs text-slate-400 ml-2">{item.telefono}</span>
                                    <p className="text-xs text-slate-400 truncate">{item.accionAnterior}</p>
                                </div>
                                <button onClick={() => deshacer(item)}
                                    title="Deshacer"
                                    className="text-xs text-slate-400 hover:text-amber-600 underline shrink-0 transition-colors">
                                    Deshacer
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function SeguimientoInline({ id, value, onSave }: { id: string; value: string; onSave: (v: string) => void }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);

    useEffect(() => { setDraft(value); }, [value]);

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
                        <button onClick={commit} className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-500 flex items-center justify-center"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>
                        <button onClick={() => setEditing(false)} className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 px-3 py-1 rounded-lg flex items-center justify-center"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                    </div>
                </div>
            ) : (
                <button onClick={() => { setDraft(value); setEditing(true); }}
                    className="w-full text-left text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded-lg px-2 py-1 transition-colors">
                    {value ? <span className="flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>{value}</span> : <span className="italic text-slate-300 dark:text-slate-600">+ Agregar nota de seguimiento</span>}
                </button>
            )}
        </div>
    );
}
