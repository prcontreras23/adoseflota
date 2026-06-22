"use client";
import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

interface AlticeItem {
    id: string;
    tipo: "nota" | "contacto" | "hito";
    titulo: string;
    contenido: string;
    fecha: string | null;
    prioridad: string;
    created_at: string;
    updated_at: string;
}

const TIPO_CONFIG = {
    nota: {
        label: "Nota",
        color: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
        badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
        icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
        ),
    },
    contacto: {
        label: "Contacto",
        color: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800",
        badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
        icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
        ),
    },
    hito: {
        label: "Hito",
        color: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
        badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
        icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
        ),
    },
};

function ItemModal({
    item,
    onSave,
    onClose,
}: {
    item: Partial<AlticeItem> | null;
    onSave: (saved: AlticeItem) => void;
    onClose: () => void;
}) {
    const [tipo, setTipo] = useState<"nota" | "contacto" | "hito">((item?.tipo as "nota" | "contacto" | "hito") ?? "nota");
    const [titulo, setTitulo] = useState(item?.titulo ?? "");
    const [contenido, setContenido] = useState(item?.contenido ?? "");
    const [fecha, setFecha] = useState(item?.fecha ?? "");
    const [prioridad, setPrioridad] = useState(item?.prioridad ?? "normal");
    const [saving, setSaving] = useState(false);

    async function handleSave() {
        if (!titulo.trim()) { toast.error("El título es requerido"); return; }
        setSaving(true);
        const payload = {
            tipo,
            titulo: titulo.trim(),
            contenido: contenido.trim(),
            fecha: fecha || null,
            prioridad,
            updated_at: new Date().toISOString(),
        };
        let data: AlticeItem | null = null;
        let error = null;
        if (item?.id) {
            const res = await supabase.from("altice_items").update(payload).eq("id", item.id).select().single();
            data = res.data as AlticeItem; error = res.error;
        } else {
            const res = await supabase.from("altice_items").insert(payload).select().single();
            data = res.data as AlticeItem; error = res.error;
        }
        setSaving(false);
        if (error) { toast.error("Error al guardar"); return; }
        toast.success(item?.id ? "Actualizado" : "Guardado ✓");
        onSave(data!);
        onClose();
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col gap-0 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-800 dark:text-white">
                        {item?.id ? "Editar" : "Nuevo registro"}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>

                <div className="px-6 py-5 flex flex-col gap-4">
                    {/* Tipo */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Tipo</label>
                        <div className="flex gap-2">
                            {(["nota", "contacto", "hito"] as const).map(t => (
                                <button key={t} onClick={() => setTipo(t)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-all ${tipo === t ? TIPO_CONFIG[t].badge + " border-transparent" : "border-slate-200 dark:border-slate-600 text-slate-500 hover:border-slate-300"}`}>
                                    {TIPO_CONFIG[t].icon}
                                    {TIPO_CONFIG[t].label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Título */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                            {tipo === "contacto" ? "Nombre completo *" : "Título *"}
                        </label>
                        <input value={titulo} onChange={e => setTitulo(e.target.value)}
                            placeholder={tipo === "contacto" ? "Ej: Juan Pérez — Ejecutivo Altice" : tipo === "hito" ? "Ej: Firma del contrato" : "Ej: Condición de precios acordada"}
                            className="w-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>

                    {/* Contenido */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                            {tipo === "contacto" ? "Teléfono / Email / Cargo" : "Detalle"}
                        </label>
                        <textarea value={contenido} onChange={e => setContenido(e.target.value)}
                            rows={tipo === "nota" ? 4 : 2}
                            placeholder={tipo === "contacto" ? "809-000-0000 · juan@altice.com.do · Gerente Corporativo" : "Descripción detallada..."}
                            className="w-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {/* Fecha */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Fecha</label>
                            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                                className="w-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        {/* Prioridad */}
                        {tipo !== "contacto" && (
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Importancia</label>
                                <select value={prioridad} onChange={e => setPrioridad(e.target.value)}
                                    className="w-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="alta">🔴 Alta</option>
                                    <option value="normal">🔵 Normal</option>
                                    <option value="baja">⚪ Baja</option>
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                        {saving ? "Guardando..." : item?.id ? "Guardar cambios" : "Crear"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AlticeTab() {
    const [items, setItems] = useState<AlticeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<Partial<AlticeItem> | null | false>(false);
    const [filterTipo, setFilterTipo] = useState<string>("all");
    const [search, setSearch] = useState("");

    const cargar = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase.from("altice_items").select("*").order("created_at", { ascending: false });
        setItems((data as AlticeItem[]) ?? []);
        setLoading(false);
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    async function eliminar(id: string) {
        if (!confirm("¿Eliminar este registro?")) return;
        setItems(prev => prev.filter(i => i.id !== id));
        await supabase.from("altice_items").delete().eq("id", id);
        toast.success("Eliminado");
    }

    function onSave(saved: AlticeItem) {
        setItems(prev => {
            const idx = prev.findIndex(i => i.id === saved.id);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = saved;
                return next;
            }
            return [saved, ...prev];
        });
    }

    const filtered = items.filter(i => {
        if (filterTipo !== "all" && i.tipo !== filterTipo) return false;
        if (search && ![i.titulo, i.contenido].join(" ").toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const notas = filtered.filter(i => i.tipo === "nota");
    const contactos = filtered.filter(i => i.tipo === "contacto");
    const hitos = filtered.filter(i => i.tipo === "hito");

    const groups = [
        { tipo: "hito" as const, items: hitos, title: "Hitos y fechas clave" },
        { tipo: "nota" as const, items: notas, title: "Notas del proceso" },
        { tipo: "contacto" as const, items: contactos, title: "Contactos Altice" },
    ];

    return (
        <div className="space-y-6">
            {modal !== false && (
                <ItemModal
                    item={modal}
                    onSave={onSave}
                    onClose={() => setModal(false)}
                />
            )}

            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5 mb-1">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.82 19.79 19.79 0 01.13 1.2 2 2 0 012.11 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.91 7.09a16 16 0 006 6l.56-.56a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92z"/>
                            </svg>
                        </div>
                        <h2 className="text-xl font-black text-slate-800 dark:text-white">Proceso Altice</h2>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {items.length} registro{items.length !== 1 ? "s" : ""} · Notas, contactos e hitos de la negociación
                    </p>
                </div>
                <button onClick={() => setModal({})}
                    className="flex items-center gap-2 text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-semibold transition-colors shadow-sm shadow-blue-200 dark:shadow-none">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nuevo registro
                </button>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-2 items-center">
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar..."
                    className="border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]" />
                {["all", "hito", "nota", "contacto"].map(t => (
                    <button key={t} onClick={() => setFilterTipo(t)}
                        className={`text-xs font-semibold px-3 py-2 rounded-xl border transition-colors ${filterTipo === t
                            ? "bg-blue-600 text-white border-blue-600"
                            : "border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-300 bg-white dark:bg-slate-800"}`}>
                        {t === "all" ? "Todos" : TIPO_CONFIG[t as "nota" | "contacto" | "hito"].label + "s"}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20 text-slate-400">
                    <svg className="animate-spin w-6 h-6 mr-2" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity=".2"/><path d="M22 12a10 10 0 01-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg>
                    Cargando...
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400">
                            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.82 19.79 19.79 0 01.13 1.2 2 2 0 012.11 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.09a16 16 0 006 6l.56-.56a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/>
                        </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No hay registros aún</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Agrega notas, contactos o hitos del proceso</p>
                    <button onClick={() => setModal({})}
                        className="mt-4 text-sm text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                        Crear primer registro
                    </button>
                </div>
            ) : (
                <div className="space-y-8">
                    {groups.map(g => g.items.length > 0 && (
                        <div key={g.tipo}>
                            <div className="flex items-center gap-2 mb-3">
                                <span className={`p-1.5 rounded-lg ${TIPO_CONFIG[g.tipo].badge}`}>
                                    {TIPO_CONFIG[g.tipo].icon}
                                </span>
                                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{g.title}</h3>
                                <span className="text-xs text-slate-400">({g.items.length})</span>
                            </div>
                            <div className={`grid gap-3 ${g.tipo === "contacto" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}>
                                {g.items.map(item => (
                                    <div key={item.id}
                                        className={`border rounded-2xl p-4 ${TIPO_CONFIG[item.tipo].color} group relative`}>
                                        {/* Actions */}
                                        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setModal(item)}
                                                className="w-7 h-7 rounded-lg bg-white/80 dark:bg-slate-700/80 flex items-center justify-center text-slate-500 hover:text-blue-600 transition-colors">
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                            </button>
                                            <button onClick={() => eliminar(item.id)}
                                                className="w-7 h-7 rounded-lg bg-white/80 dark:bg-slate-700/80 flex items-center justify-center text-slate-500 hover:text-red-500 transition-colors">
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                                            </button>
                                        </div>

                                        <div className="flex items-start gap-3 pr-16">
                                            <span className={`shrink-0 mt-0.5 ${TIPO_CONFIG[item.tipo].badge.split(" ").slice(0, 2).join(" ")} p-1.5 rounded-lg`}>
                                                {TIPO_CONFIG[item.tipo].icon}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-800 dark:text-white leading-snug">{item.titulo}</p>
                                                {item.contenido && (
                                                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed whitespace-pre-wrap">{item.contenido}</p>
                                                )}
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {item.fecha && (
                                                        <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                                            {new Date(item.fecha + "T00:00:00").toLocaleDateString("es-DO", { day: "numeric", month: "short", year: "numeric" })}
                                                        </span>
                                                    )}
                                                    {item.tipo !== "contacto" && item.prioridad && item.prioridad !== "normal" && (
                                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.prioridad === "alta" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"}`}>
                                                            {item.prioridad === "alta" ? "🔴 Alta" : "⚪ Baja"}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
