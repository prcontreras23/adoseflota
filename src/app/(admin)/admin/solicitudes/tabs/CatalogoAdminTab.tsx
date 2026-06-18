"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase, formatRD, type Dispositivo } from "@/lib/supabase";
import toast from "react-hot-toast";

export default function CatalogoAdminTab() {
    const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<Dispositivo | null>(null);
    const [saving, setSaving] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [newItem, setNewItem] = useState({ modelo: "", categoria: "Mid-range" as Dispositivo["categoria"], precio_rd: 0, pantalla: "", ram: "", almacenamiento: "", camara: "", bateria: "" });

    const CLARO_PDF_URL = "/Cotización Soluciones Móviles Claro Febrero.pdf";

    const loadData = useCallback(async () => {
        const { data } = await supabase.from("catalogo_dispositivos").select("*").order("categoria").order("precio_rd");
        setDispositivos(data ?? []);
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    async function toggleDestacado(id: number, current: boolean) {
        const destacadosCount = dispositivos.filter(d => d.destacado).length;
        if (!current && destacadosCount >= 6) {
            toast.error("Máximo 6 dispositivos pueden estar destacados. Desactiva uno primero.");
            return;
        }
        await supabase.from("catalogo_dispositivos").update({ destacado: !current }).eq("id", id);
        setDispositivos(prev => prev.map(d => d.id === id ? { ...d, destacado: !current } : d));
        toast.success(!current ? "Dispositivo destacado en catálogo" : "Dispositivo ocultado del catálogo");
    }

    async function toggleDisponible(id: number, current: boolean) {
        await supabase.from("catalogo_dispositivos").update({ disponible: !current }).eq("id", id);
        setDispositivos(prev => prev.map(d => d.id === id ? { ...d, disponible: !current } : d));
    }

    async function saveEdit() {
        if (!editing) return;
        setSaving(true);
        const { error } = await supabase.from("catalogo_dispositivos")
            .update({ modelo: editing.modelo, precio_rd: editing.precio_rd, pantalla: editing.pantalla, ram: editing.ram, almacenamiento: editing.almacenamiento, camara: editing.camara, bateria: editing.bateria })
            .eq("id", editing.id);
        if (error) toast.error("Error al guardar");
        else { toast.success("Guardado"); setEditing(null); loadData(); }
        setSaving(false);
    }

    async function addDevice() {
        if (!newItem.modelo) { toast.error("El modelo es requerido"); return; }
        setSaving(true);
        const { error } = await supabase.from("catalogo_dispositivos").insert({ ...newItem, disponible: true, destacado: false });
        if (error) toast.error("Error al agregar");
        else { toast.success("Dispositivo agregado"); setShowNew(false); setNewItem({ modelo: "", categoria: "Mid-range", precio_rd: 0, pantalla: "", ram: "", almacenamiento: "", camara: "", bateria: "" }); loadData(); }
        setSaving(false);
    }

    async function deleteDevice(id: number) {
        if (!confirm("¿Eliminar este dispositivo del catálogo?")) return;
        await supabase.from("catalogo_dispositivos").delete().eq("id", id);
        toast.success("Dispositivo eliminado");
        loadData();
    }

    const catColor = (cat: string) => ({
        Basico: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        "Mid-range": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        Premium: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    }[cat] ?? "bg-slate-100 text-slate-700");

    if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Gestión de Catálogo</h2>
                    <p className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> {dispositivos.filter(d => d.destacado).length}/6 dispositivos visibles para usuarios
                    </p>
                </div>
                <div className="flex gap-2">
                    <a href={CLARO_PDF_URL} target="_blank"
                        className="flex items-center gap-1.5 text-sm bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-2 rounded-xl font-medium hover:bg-red-100 transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Ver PDF Claro
                    </a>
                    <button onClick={() => setShowNew(v => !v)}
                        className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-semibold transition-colors">
                        ＋ Agregar Dispositivo
                    </button>
                </div>
            </div>

            {/* Add new */}
            {showNew && (
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-5 animate-fade-in">
                    <h3 className="font-semibold text-slate-800 dark:text-white mb-3">Nuevo Dispositivo</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                            { label: "Modelo *", field: "modelo", type: "text" },
                            { label: "Precio RD$", field: "precio_rd", type: "number" },
                            { label: "Pantalla", field: "pantalla", type: "text" },
                            { label: "RAM", field: "ram", type: "text" },
                            { label: "Almacenamiento", field: "almacenamiento", type: "text" },
                            { label: "Cámara", field: "camara", type: "text" },
                            { label: "Batería", field: "bateria", type: "text" },
                        ].map(({ label, field, type }) => (
                            <div key={field}>
                                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">{label}</label>
                                <input type={type} value={(newItem as any)[field]} onChange={e => setNewItem(n => ({ ...n, [field]: type === "number" ? parseFloat(e.target.value) || 0 : e.target.value }))}
                                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                        ))}
                        <div>
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Categoría</label>
                            <select value={newItem.categoria} onChange={e => setNewItem(n => ({ ...n, categoria: e.target.value as any }))}
                                className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="Basico">Básico</option><option value="Mid-range">Mid-range</option><option value="Premium">Premium</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                        <button onClick={() => setShowNew(false)} className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                        <button onClick={addDevice} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-2 text-sm font-semibold transition-colors disabled:opacity-50">Guardar</button>
                    </div>
                </div>
            )}

            {/* Device list */}
            <div className="grid gap-3">
                {dispositivos.map(d => (
                    <div key={d.id} className={`bg-white dark:bg-slate-800 rounded-2xl border p-4 transition-all ${d.destacado ? "border-blue-300 dark:border-blue-600 shadow-sm shadow-blue-100 dark:shadow-blue-900/20" : "border-slate-200 dark:border-slate-700"}`}>
                        {editing?.id === d.id ? (
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {[
                                        { label: "Modelo", field: "modelo" },
                                        { label: "Precio RD$", field: "precio_rd" },
                                        { label: "Pantalla", field: "pantalla" },
                                        { label: "RAM", field: "ram" },
                                        { label: "Almacenamiento", field: "almacenamiento" },
                                        { label: "Cámara", field: "camara" },
                                        { label: "Batería", field: "bateria" },
                                    ].map(({ label, field }) => (
                                        <div key={field}>
                                            <label className="text-xs text-slate-500 mb-0.5 block">{label}</label>
                                            <input value={(editing as any)[field] ?? ""} onChange={e => setEditing(prev => prev ? { ...prev, [field]: field === "precio_rd" ? parseFloat(e.target.value) || 0 : e.target.value } : null)}
                                                className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setEditing(null)} className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                                    <button onClick={saveEdit} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-2 text-sm font-semibold transition-colors disabled:opacity-50">Guardar</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${catColor(d.categoria)}`}>{d.categoria}</span>
                                        {d.destacado && <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-0.5 rounded-full font-semibold"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Visible</span>}
                                        {!d.disponible && <span className="text-xs bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full font-semibold">Desactivado</span>}
                                    </div>
                                    <h3 className="font-bold text-slate-800 dark:text-white">{d.modelo}</h3>
                                    <p className="text-blue-600 dark:text-blue-400 font-bold text-sm">{formatRD(d.precio_rd)}</p>
                                    <p className="text-xs text-slate-400 mt-1">{[d.pantalla, d.ram, d.almacenamiento, d.camara].filter(Boolean).join(" · ")}</p>
                                </div>
                                <div className="flex flex-col gap-1.5 items-end">
                                    <button onClick={() => toggleDestacado(d.id, d.destacado)}
                                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${d.destacado ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400" : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-400"}`}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> {d.destacado ? "Quitar" : "Destacar"}
                                    </button>
                                    <button onClick={() => setEditing(d)} className="flex items-center gap-1.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 px-2.5 py-1 rounded-lg transition-colors"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar</button>
                                    <button onClick={() => deleteDevice(d.id)} className="flex items-center gap-1.5 text-xs bg-red-50 dark:bg-red-950/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 px-2.5 py-1 rounded-lg transition-colors"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg> Eliminar</button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
