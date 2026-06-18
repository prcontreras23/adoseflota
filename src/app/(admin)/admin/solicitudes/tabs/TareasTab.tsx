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
    created_at: string;
    updated_at: string;
}

const PRIORIDAD_COLORS: Record<string, string> = {
    alta: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    normal: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    baja: "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
};

interface NuevaTareaModalProps {
    titulares: string[];
    lineas: import("@/lib/supabase").LineaAltice[];
    onCreada: (t: Tarea) => void;
    onClose: () => void;
    prefillTitular?: string;
    prefillLineaId?: string;
}

function NuevaTareaModal({ titulares, lineas, onCreada, onClose, prefillTitular, prefillLineaId }: NuevaTareaModalProps) {
    const [titulo, setTitulo] = useState("");
    const [descripcion, setDescripcion] = useState("");
    const [titular, setTitular] = useState(prefillTitular ?? "");
    const [lineaId, setLineaId] = useState(prefillLineaId ?? "");
    const [prioridad, setPrioridad] = useState("normal");
    const [saving, setSaving] = useState(false);

    const lineasDelTitular = titular
        ? lineas.filter(l => l.titular_responsable === titular && !l.archivada)
        : lineas.filter(l => !l.archivada);

    async function handleSave() {
        if (!titulo.trim()) { toast.error("El título es requerido"); return; }
        setSaving(true);
        const { data, error } = await supabase.from("tareas").insert({
            titulo: titulo.trim(),
            descripcion: descripcion.trim(),
            titular: titular.trim(),
            linea_id: lineaId || null,
            prioridad,
        }).select().single();
        setSaving(false);
        if (error) { toast.error("Error al crear tarea"); return; }
        toast.success("Tarea creada ✓");
        onCreada(data as Tarea);
        onClose();
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Nueva tarea</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>

                <div className="flex flex-col gap-3">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Título *</label>
                        <input value={titulo} onChange={e => setTitulo(e.target.value)}
                            placeholder="Ej: Llamar a confirmar plan..."
                            className="w-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Descripción</label>
                        <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)}
                            rows={2} placeholder="Detalles adicionales..."
                            className="w-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Titular</label>
                            <select value={titular} onChange={e => { setTitular(e.target.value); setLineaId(""); }}
                                className="w-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="">(general)</option>
                                {titulares.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Línea específica</label>
                            <select value={lineaId} onChange={e => setLineaId(e.target.value)}
                                className="w-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="">(cualquiera)</option>
                                {lineasDelTitular.map(l => (
                                    <option key={l.id} value={l.id}>{l.telefono} — {l.usuario_linea || "sin usuario"}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Prioridad</label>
                        <div className="flex gap-2">
                            {(["alta", "normal", "baja"] as const).map(p => (
                                <button key={p} onClick={() => setPrioridad(p)}
                                    className={`flex-1 text-xs font-semibold py-2 rounded-xl border transition-colors capitalize ${prioridad === p ? PRIORIDAD_COLORS[p] + " border-transparent" : "border-slate-200 dark:border-slate-600 text-slate-500 hover:border-slate-400"}`}>
                                    {p === "alta" ? "🔴 Alta" : p === "normal" ? "🔵 Normal" : "⚪ Baja"}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 pt-2">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                        {saving ? "Guardando..." : "Crear tarea"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function TareasTab() {
    const { lineas } = useLineas();
    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [filterTitular, setFilterTitular] = useState("");
    const [filterPrioridad, setFilterPrioridad] = useState("");
    const [showCompletadas, setShowCompletadas] = useState(false);
    const [search, setSearch] = useState("");

    const titulares = [...new Set(lineas.filter(l => !l.archivada && l.titular_responsable).map(l => l.titular_responsable))].sort();

    const cargar = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase.from("tareas").select("*").order("created_at", { ascending: false });
        setTareas((data as Tarea[]) ?? []);
        setLoading(false);
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    // Realtime
    useEffect(() => {
        const ch = supabase.channel("tareas-rt")
            .on("postgres_changes", { event: "*", schema: "public", table: "tareas" }, () => cargar())
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [cargar]);

    async function toggleCompletada(t: Tarea) {
        const nuevo = !t.completada;
        setTareas(prev => prev.map(x => x.id === t.id ? { ...x, completada: nuevo } : x));
        await supabase.from("tareas").update({ completada: nuevo, updated_at: new Date().toISOString() }).eq("id", t.id);
    }

    async function eliminar(id: string) {
        if (!confirm("¿Eliminar esta tarea?")) return;
        setTareas(prev => prev.filter(t => t.id !== id));
        await supabase.from("tareas").delete().eq("id", id);
        toast.success("Tarea eliminada");
    }

    const activas = tareas.filter(t => !t.completada);
    const completadas = tareas.filter(t => t.completada);

    const filtrar = (lista: Tarea[]) => lista.filter(t => {
        if (filterTitular && t.titular !== filterTitular) return false;
        if (filterPrioridad && t.prioridad !== filterPrioridad) return false;
        if (search && ![t.titulo, t.descripcion, t.titular].join(" ").toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const tareasVisibles = filtrar(showCompletadas ? completadas : activas);

    const linea = (id: string | null) => id ? lineas.find(l => l.id === id) : null;

    if (loading) return (
        <div className="flex items-center justify-center py-20 text-slate-400">
            <svg className="animate-spin w-6 h-6 mr-2" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity=".2"/><path d="M22 12a10 10 0 01-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg>
            Cargando tareas…
        </div>
    );

    return (
        <div className="space-y-4">
            {showModal && (
                <NuevaTareaModal
                    titulares={titulares}
                    lineas={lineas}
                    onCreada={t => setTareas(prev => [t, ...prev])}
                    onClose={() => setShowModal(false)}
                />
            )}

            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Tareas</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {activas.length} pendiente{activas.length !== 1 ? "s" : ""}
                        {completadas.length > 0 && ` · ${completadas.length} completada${completadas.length !== 1 ? "s" : ""}`}
                    </p>
                </div>
                <button onClick={() => setShowModal(true)}
                    className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-semibold transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nueva tarea
                </button>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-2 items-center">
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar tarea..."
                    className="border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]" />
                <select value={filterTitular} onChange={e => setFilterTitular(e.target.value)}
                    className="border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Todos los titulares</option>
                    {titulares.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={filterPrioridad} onChange={e => setFilterPrioridad(e.target.value)}
                    className="border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Todas las prioridades</option>
                    <option value="alta">🔴 Alta</option>
                    <option value="normal">🔵 Normal</option>
                    <option value="baja">⚪ Baja</option>
                </select>
                <button onClick={() => setShowCompletadas(!showCompletadas)}
                    className={`text-xs font-semibold px-3 py-2 rounded-xl border transition-colors ${showCompletadas ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700" : "border-slate-200 dark:border-slate-600 text-slate-500 hover:border-slate-400"}`}>
                    {showCompletadas ? "Ver pendientes" : `Completadas (${completadas.length})`}
                </button>
            </div>

            {/* Lista */}
            {tareasVisibles.length === 0 ? (
                <div className="text-center py-16 text-slate-400 dark:text-slate-500">
                    <svg className="w-12 h-12 mx-auto mb-3 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                    </svg>
                    <p className="text-sm font-medium">{showCompletadas ? "No hay tareas completadas" : "No hay tareas pendientes"}</p>
                    {!showCompletadas && <p className="text-xs mt-1">¡Bien! O crea una tarea nueva.</p>}
                </div>
            ) : (
                <div className="space-y-2">
                    {tareasVisibles.map(t => {
                        const l = linea(t.linea_id);
                        return (
                            <div key={t.id}
                                className={`bg-white dark:bg-slate-800 border rounded-xl p-4 flex gap-3 items-start transition-opacity ${t.completada ? "opacity-60" : "border-slate-200 dark:border-slate-700"}`}>
                                {/* Checkbox */}
                                <button onClick={() => toggleCompletada(t)}
                                    className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${t.completada ? "bg-green-500 border-green-500" : "border-slate-300 dark:border-slate-500 hover:border-green-400"}`}>
                                    {t.completada && (
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                    )}
                                </button>

                                {/* Contenido */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <span className={`text-sm font-semibold text-slate-800 dark:text-white ${t.completada ? "line-through text-slate-400" : ""}`}>{t.titulo}</span>
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORIDAD_COLORS[t.prioridad] ?? PRIORIDAD_COLORS.normal}`}>
                                            {t.prioridad === "alta" ? "🔴 Alta" : t.prioridad === "normal" ? "🔵 Normal" : "⚪ Baja"}
                                        </span>
                                    </div>
                                    {t.descripcion && <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t.descripcion}</p>}
                                    <div className="flex flex-wrap gap-2 text-xs text-slate-400 dark:text-slate-500">
                                        {t.titular && (
                                            <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-medium">
                                                👤 {t.titular}
                                            </span>
                                        )}
                                        {l && (
                                            <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
                                                📱 {l.telefono}
                                            </span>
                                        )}
                                        <span>{new Date(t.created_at).toLocaleDateString("es-DO", { day: "numeric", month: "short" })}</span>
                                    </div>
                                </div>

                                {/* Eliminar */}
                                <button onClick={() => eliminar(t.id)}
                                    className="text-slate-300 hover:text-red-400 dark:text-slate-600 dark:hover:text-red-400 transition-colors flex-shrink-0">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
