"use client";
import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useLineas } from "@/lib/LineasContext";
import toast from "react-hot-toast";

export interface Tarea {
    id: string;
    titulo: string;
    descripcion: string;
    titular: string;
    linea_id: string | null;
    completada: boolean;
    prioridad: string;
    estado: "pendiente" | "en_proceso" | "finalizado";
    created_at: string;
    updated_at: string;
}

const PRIORIDAD_COLORS: Record<string, string> = {
    alta:   "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    normal: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    baja:   "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
};

const ESTADO_CONFIG: Record<Tarea["estado"], { label: string; color: string; bg: string; dot: string }> = {
    pendiente:   { label: "Pendiente",   color: "text-amber-700 dark:text-amber-300",   bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",    dot: "bg-amber-400" },
    en_proceso:  { label: "En proceso",  color: "text-blue-700 dark:text-blue-300",     bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",         dot: "bg-blue-500" },
    finalizado:  { label: "Finalizado",  color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800", dot: "bg-emerald-500" },
};

// ── Modal de tarea (crear y editar) ─────────────────────────────────────────

function TareaModal({
    tarea,
    titulares,
    lineas,
    onSave,
    onClose,
}: {
    tarea: Partial<Tarea> | null;
    titulares: string[];
    lineas: import("@/lib/supabase").LineaAltice[];
    onSave: (t: Tarea) => void;
    onClose: () => void;
}) {
    const [titulo, setTitulo] = useState(tarea?.titulo ?? "");
    const [descripcion, setDescripcion] = useState(tarea?.descripcion ?? "");
    const [titular, setTitular] = useState(tarea?.titular ?? "");
    const [lineaId, setLineaId] = useState(tarea?.linea_id ?? "");
    const [prioridad, setPrioridad] = useState(tarea?.prioridad ?? "normal");
    const [estado, setEstado] = useState<Tarea["estado"]>(tarea?.estado ?? "pendiente");
    const [saving, setSaving] = useState(false);

    const lineasDelTitular = titular
        ? lineas.filter(l => l.titular_responsable === titular && !l.archivada)
        : lineas.filter(l => !l.archivada);

    async function handleSave() {
        if (!titulo.trim()) { toast.error("El título es requerido"); return; }
        setSaving(true);
        const payload = {
            titulo: titulo.trim(),
            descripcion: descripcion.trim(),
            titular: titular.trim(),
            linea_id: lineaId || null,
            prioridad,
            estado,
            completada: estado === "finalizado",
            updated_at: new Date().toISOString(),
        };
        let data: Tarea | null = null;
        let error = null;
        if (tarea?.id) {
            const res = await supabase.from("tareas").update(payload).eq("id", tarea.id).select().single();
            data = res.data as Tarea; error = res.error;
        } else {
            const res = await supabase.from("tareas").insert(payload).select().single();
            data = res.data as Tarea; error = res.error;
        }
        setSaving(false);
        if (error) { toast.error("Error al guardar"); return; }
        toast.success(tarea?.id ? "Tarea actualizada" : "Tarea creada ✓");
        onSave(data!);
        onClose();
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-800 dark:text-white">
                        {tarea?.id ? "Editar tarea" : "Nueva tarea"}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>

                <div className="px-6 py-5 flex flex-col gap-4">
                    {/* Título */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Título *</label>
                        <input value={titulo} onChange={e => setTitulo(e.target.value)}
                            placeholder="Ej: Llamar a confirmar plan de datos..."
                            className="w-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>

                    {/* Descripción */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Descripción</label>
                        <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)}
                            rows={2} placeholder="Detalles adicionales..."
                            className="w-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                    </div>

                    {/* Estado */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Estado</label>
                        <div className="flex gap-2">
                            {(["pendiente", "en_proceso", "finalizado"] as const).map(e => {
                                const cfg = ESTADO_CONFIG[e];
                                return (
                                    <button key={e} onClick={() => setEstado(e)}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-all ${estado === e ? cfg.bg + " " + cfg.color + " border-transparent" : "border-slate-200 dark:border-slate-600 text-slate-500 hover:border-slate-300 dark:hover:border-slate-500"}`}>
                                        <span className={`w-2 h-2 rounded-full ${estado === e ? cfg.dot : "bg-slate-300 dark:bg-slate-600"}`} />
                                        {cfg.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Prioridad */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Prioridad</label>
                        <div className="flex gap-2">
                            {(["alta", "normal", "baja"] as const).map(p => (
                                <button key={p} onClick={() => setPrioridad(p)}
                                    className={`flex-1 text-xs font-semibold py-2 rounded-xl border transition-colors capitalize ${prioridad === p ? PRIORIDAD_COLORS[p] + " border-transparent" : "border-slate-200 dark:border-slate-600 text-slate-500 hover:border-slate-300 dark:hover:border-slate-500"}`}>
                                    {p === "alta" ? "🔴 Alta" : p === "normal" ? "🔵 Normal" : "⚪ Baja"}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {/* Titular */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Titular</label>
                            <select value={titular} onChange={e => { setTitular(e.target.value); setLineaId(""); }}
                                className="w-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="">(general)</option>
                                {titulares.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        {/* Línea */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Línea</label>
                            <select value={lineaId} onChange={e => setLineaId(e.target.value)}
                                className="w-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="">(cualquiera)</option>
                                {lineasDelTitular.map(l => (
                                    <option key={l.id} value={l.id}>{l.telefono} — {l.usuario_linea || "sin usuario"}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                        {saving ? "Guardando..." : tarea?.id ? "Guardar cambios" : "Crear tarea"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Tarjeta de tarea ─────────────────────────────────────────────────────────

function TareaCard({
    tarea,
    lineas,
    onEdit,
    onDelete,
    onMover,
}: {
    tarea: Tarea;
    lineas: import("@/lib/supabase").LineaAltice[];
    onEdit: () => void;
    onDelete: () => void;
    onMover: (destino: Tarea["estado"]) => void;
}) {
    const linea = tarea.linea_id ? lineas.find(l => l.id === tarea.linea_id) : null;
    const [showMover, setShowMover] = useState(false);

    const movimientos: Array<{ estado: Tarea["estado"]; label: string }> = (
        ["pendiente", "en_proceso", "finalizado"] as Tarea["estado"][]
    ).filter(e => e !== tarea.estado).map(e => ({ estado: e, label: ESTADO_CONFIG[e].label }));

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 group relative shadow-sm hover:shadow-md transition-shadow">
            {/* Prioridad dot */}
            {tarea.prioridad === "alta" && (
                <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-red-500" title="Alta prioridad" />
            )}

            {/* Titulo */}
            <p className="text-sm font-semibold text-slate-800 dark:text-white leading-snug pr-6">{tarea.titulo}</p>

            {tarea.descripcion && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed line-clamp-2">{tarea.descripcion}</p>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mt-2.5">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PRIORIDAD_COLORS[tarea.prioridad]}`}>
                    {tarea.prioridad === "alta" ? "🔴 Alta" : tarea.prioridad === "normal" ? "🔵 Normal" : "⚪ Baja"}
                </span>
                {tarea.titular && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        👤 {tarea.titular}
                    </span>
                )}
                {linea && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                        📱 {linea.telefono}
                    </span>
                )}
            </div>

            {/* Footer: fecha + acciones */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <span className="text-[10px] text-slate-400">
                    {new Date(tarea.created_at).toLocaleDateString("es-DO", { day: "numeric", month: "short" })}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Mover */}
                    <div className="relative">
                        <button onClick={() => setShowMover(v => !v)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            title="Mover a...">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                        {showMover && (
                            <div className="absolute bottom-8 right-0 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-10 min-w-[130px]">
                                {movimientos.map(m => (
                                    <button key={m.estado} onClick={() => { onMover(m.estado); setShowMover(false); }}
                                        className="w-full text-left px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${ESTADO_CONFIG[m.estado].dot}`} />
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* Editar */}
                    <button onClick={onEdit}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    {/* Eliminar */}
                    <button onClick={onDelete}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function TareasTab() {
    const { lineas } = useLineas();
    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<Partial<Tarea> | null | false>(false);
    const [search, setSearch] = useState("");
    const [filterTitular, setFilterTitular] = useState("");
    const [filterPrioridad, setFilterPrioridad] = useState("");

    const titulares = [...new Set(lineas.filter(l => !l.archivada && l.titular_responsable).map(l => l.titular_responsable!))].sort();

    const cargar = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase.from("tareas").select("*").order("created_at", { ascending: false });
        setTareas((data as Tarea[]) ?? []);
        setLoading(false);
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    useEffect(() => {
        const ch = supabase.channel("tareas-rt")
            .on("postgres_changes", { event: "*", schema: "public", table: "tareas" }, () => cargar())
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [cargar]);

    function onSave(saved: Tarea) {
        setTareas(prev => {
            const idx = prev.findIndex(t => t.id === saved.id);
            if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
            return [saved, ...prev];
        });
    }

    async function eliminar(id: string) {
        if (!confirm("¿Eliminar esta tarea?")) return;
        setTareas(prev => prev.filter(t => t.id !== id));
        await supabase.from("tareas").delete().eq("id", id);
        toast.success("Tarea eliminada");
    }

    async function mover(id: string, destino: Tarea["estado"]) {
        setTareas(prev => prev.map(t => t.id === id ? { ...t, estado: destino, completada: destino === "finalizado" } : t));
        await supabase.from("tareas").update({ estado: destino, completada: destino === "finalizado", updated_at: new Date().toISOString() }).eq("id", id);
        toast.success(`Movida a ${ESTADO_CONFIG[destino].label}`);
    }

    const filtrar = (lista: Tarea[]) => lista.filter(t => {
        if (filterTitular && t.titular !== filterTitular) return false;
        if (filterPrioridad && t.prioridad !== filterPrioridad) return false;
        if (search && ![t.titulo, t.descripcion, t.titular].join(" ").toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const pendientes   = filtrar(tareas.filter(t => t.estado === "pendiente"));
    const enProceso    = filtrar(tareas.filter(t => t.estado === "en_proceso"));
    const finalizadas  = filtrar(tareas.filter(t => t.estado === "finalizado"));

    const columnas: Array<{ estado: Tarea["estado"]; lista: Tarea[]; emptyLabel: string }> = [
        { estado: "pendiente",  lista: pendientes,  emptyLabel: "Sin tareas pendientes" },
        { estado: "en_proceso", lista: enProceso,   emptyLabel: "Nada en proceso" },
        { estado: "finalizado", lista: finalizadas, emptyLabel: "Nada completado aún" },
    ];

    if (loading) return (
        <div className="flex items-center justify-center py-20 text-slate-400">
            <svg className="animate-spin w-6 h-6 mr-2" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity=".2"/><path d="M22 12a10 10 0 01-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg>
            Cargando tareas…
        </div>
    );

    return (
        <div className="space-y-5">
            {modal !== false && (
                <TareaModal
                    tarea={modal}
                    titulares={titulares}
                    lineas={lineas}
                    onSave={onSave}
                    onClose={() => setModal(false)}
                />
            )}

            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Tareas</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {pendientes.length} pendiente{pendientes.length !== 1 ? "s" : ""} · {enProceso.length} en proceso · {finalizadas.length} finalizadas
                    </p>
                </div>
                <button onClick={() => setModal({})}
                    className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-semibold transition-colors shadow-sm shadow-blue-200 dark:shadow-none">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nueva tarea
                </button>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-2 items-center">
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar tarea..."
                    className="border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]" />
                <select value={filterTitular} onChange={e => setFilterTitular(e.target.value)}
                    className="border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Todos los titulares</option>
                    {titulares.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={filterPrioridad} onChange={e => setFilterPrioridad(e.target.value)}
                    className="border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Todas las prioridades</option>
                    <option value="alta">🔴 Alta</option>
                    <option value="normal">🔵 Normal</option>
                    <option value="baja">⚪ Baja</option>
                </select>
            </div>

            {/* Kanban */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {columnas.map(col => {
                    const cfg = ESTADO_CONFIG[col.estado];
                    return (
                        <div key={col.estado} className="flex flex-col gap-3">
                            {/* Columna header */}
                            <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${cfg.bg}`}>
                                <div className="flex items-center gap-2">
                                    <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                                    <span className={`text-xs font-bold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                                </div>
                                <span className={`text-xs font-black px-1.5 py-0.5 rounded-md ${cfg.bg} ${cfg.color}`}>
                                    {col.lista.length}
                                </span>
                            </div>

                            {/* Tarjetas */}
                            <div className="flex flex-col gap-3 min-h-[120px]">
                                {col.lista.length === 0 ? (
                                    <div className="flex-1 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center py-8">
                                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{col.emptyLabel}</p>
                                    </div>
                                ) : col.lista.map(t => (
                                    <TareaCard
                                        key={t.id}
                                        tarea={t}
                                        lineas={lineas}
                                        onEdit={() => setModal(t)}
                                        onDelete={() => eliminar(t.id)}
                                        onMover={dest => mover(t.id, dest)}
                                    />
                                ))}
                            </div>

                            {/* Agregar en esta columna */}
                            <button
                                onClick={() => setModal({ estado: col.estado })}
                                className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-2 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors w-full">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                Agregar aquí
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
