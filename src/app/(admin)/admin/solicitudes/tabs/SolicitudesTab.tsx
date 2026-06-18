"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase, formatRD, formatDate, ESTADO_LABELS, type Solicitud, type EstadoSolicitud } from "@/lib/supabase";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

const ESTADOS: EstadoSolicitud[] = ["pendiente", "enviado", "transito", "recibido", "listo-entrega", "entregado", "cancelado"];
const ESTADO_CLASS: Record<string, string> = {
    pendiente: "status-pendiente", enviado: "status-enviado", transito: "status-transito",
    recibido: "status-recibido", "listo-entrega": "status-listo-entrega", entregado: "status-entregado", cancelado: "status-cancelado"
};

export default function SolicitudesTab() {
    const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
    const [filtered, setFiltered] = useState<Solicitud[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterEstado, setFilterEstado] = useState("");
    const [filterArea, setFilterArea] = useState("");
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [generatingCorte, setGeneratingCorte] = useState(false);

    const loadData = useCallback(async () => {
        const { data } = await supabase.from("solicitudes")
            .select("*, planes_claro(*), catalogo_dispositivos(*), usuarios(*)")
            .order("created_at", { ascending: false });
        setSolicitudes(data ?? []);
        setFiltered(data ?? []);
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    useEffect(() => {
        let f = solicitudes;
        if (filterEstado) f = f.filter(s => s.estado === filterEstado);
        if (filterArea) f = f.filter(s => s.area === filterArea);
        if (search) f = f.filter(s => s.nombre.toLowerCase().includes(search.toLowerCase()) || s.id.includes(search));
        setFiltered(f);
    }, [solicitudes, filterEstado, filterArea, search]);

    async function updateEstado(id: string, estado: EstadoSolicitud) {
        const { error } = await supabase.from("solicitudes").update({ estado }).eq("id", id);
        if (error) toast.error("Error al actualizar estado");
        else { toast.success("Estado actualizado"); loadData(); }
    }

    async function generarCorte() {
        if (selected.size === 0) { toast.error("Selecciona al menos una solicitud"); return; }
        setGeneratingCorte(true);
        const year = new Date().getFullYear();
        const week = Math.ceil(new Date().getDate() / 7);
        const { count } = await supabase.from("cortes").select("*", { count: "exact", head: true });
        const corteId = `Corte-${year}-${String((count ?? 0) + 1).padStart(2, "0")}`;

        const { error: corteError } = await supabase.from("cortes").insert({
            id: corteId, solicitudes_ids: Array.from(selected), total_solicitudes: selected.size,
            estado: "pendiente", fecha_corte: new Date().toISOString(),
        });
        if (corteError) { toast.error("Error al crear corte"); setGeneratingCorte(false); return; }

        await supabase.from("solicitudes").update({ estado: "enviado", corte_id: corteId }).in("id", Array.from(selected));

        // Export Excel for Claro
        const rows = solicitudes.filter(s => selected.has(s.id)).map(s => ({
            "ID Solicitud": s.id, "Nombre": s.nombre, "Cargo": s.cargo, "Área": s.area,
            "Plan": s.planes_claro?.nombre ?? "", "Equipo": s.catalogo_dispositivos?.modelo ?? "",
            "Precio Equipo RD$": s.precio_equipo, "Justificación": s.justificacion,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Solicitudes");
        XLSX.writeFile(wb, `${corteId}.xlsx`);

        toast.success(`Corte ${corteId} generado y exportado`);
        setSelected(new Set());
        loadData();
        setGeneratingCorte(false);
    }

    const pendientes = filtered.filter(s => s.estado === "pendiente");
    const toggleAll = () => {
        if (selected.size === pendientes.length) setSelected(new Set());
        else setSelected(new Set(pendientes.map(s => s.id)));
    };

    if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex flex-wrap gap-3">
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, ID..."
                        className="flex-1 min-w-48 border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)}
                        className="border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Todos los estados</option>
                        {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABELS[e]}</option>)}
                    </select>
                    <select value={filterArea} onChange={e => setFilterArea(e.target.value)}
                        className="border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Todas las áreas</option>
                        <option value="Pastores">Pastores</option>
                        <option value="Empleados CEADIC">Empleados CEADIC</option>
                        <option value="Familiares">Familiares</option>
                    </select>
                </div>
            </div>

            {/* Action bar */}
            {selected.size > 0 && (
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-3 flex items-center justify-between animate-fade-in">
                    <span className="text-blue-700 dark:text-blue-300 text-sm font-medium">{selected.size} solicitud(es) seleccionada(s)</span>
                    <button onClick={generarCorte} disabled={generatingCorte}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2">
                        {generatingCorte ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generando...</> : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Generar Corte + Exportar Excel</>}
                    </button>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: "Total", value: solicitudes.length, color: "text-slate-600 dark:text-slate-300" },
                    { label: "Pendientes", value: solicitudes.filter(s => s.estado === "pendiente").length, color: "text-yellow-600" },
                    { label: "Enviados", value: solicitudes.filter(s => s.estado === "enviado").length, color: "text-blue-600" },
                    { label: "Entregados", value: solicitudes.filter(s => s.estado === "entregado").length, color: "text-green-600" },
                ].map(stat => (
                    <div key={stat.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
                        <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="w-10 p-3 text-left">
                                    <input type="checkbox" onChange={toggleAll} checked={selected.size === pendientes.length && pendientes.length > 0}
                                        className="rounded border-slate-300 text-blue-600 cursor-pointer" />
                                </th>
                                <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-300">ID</th>
                                <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-300">Nombre</th>
                                <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-300 hidden md:table-cell">Área</th>
                                <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-300 hidden lg:table-cell">Dispositivo</th>
                                <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-300 hidden xl:table-cell">Plan</th>
                                <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-300">Estado</th>
                                <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-300 hidden sm:table-cell">Fecha</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {filtered.map(s => (
                                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                    <td className="p-3">
                                        {s.estado === "pendiente" && (
                                            <input type="checkbox" checked={selected.has(s.id)}
                                                onChange={e => setSelected(prev => { const n = new Set(prev); e.target.checked ? n.add(s.id) : n.delete(s.id); return n; })}
                                                className="rounded border-slate-300 text-blue-600 cursor-pointer" />
                                        )}
                                    </td>
                                    <td className="p-3 font-mono text-blue-600 dark:text-blue-400 font-bold text-xs">{s.id}</td>
                                    <td className="p-3">
                                        <p className="font-medium text-slate-800 dark:text-white">{s.nombre}</p>
                                        <p className="text-xs text-slate-400">{s.cargo}</p>
                                    </td>
                                    <td className="p-3 hidden md:table-cell text-slate-600 dark:text-slate-300">{s.area}</td>
                                    <td className="p-3 hidden lg:table-cell text-slate-600 dark:text-slate-300 text-xs">{s.catalogo_dispositivos?.modelo}</td>
                                    <td className="p-3 hidden xl:table-cell text-slate-600 dark:text-slate-300 text-xs">{s.planes_claro?.nombre}</td>
                                    <td className="p-3">
                                        <select value={s.estado} onChange={e => updateEstado(s.id, e.target.value as EstadoSolicitud)}
                                            className={`text-xs font-semibold px-2 py-1 rounded-lg border-0 outline-none cursor-pointer ${ESTADO_CLASS[s.estado]}`}>
                                            {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABELS[e]}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-3 hidden sm:table-cell text-slate-400 dark:text-slate-500 text-xs">{formatDate(s.fecha)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filtered.length === 0 && (
                    <div className="py-16 text-center text-slate-400 dark:text-slate-500">
                        <div className="flex justify-center mb-2 text-slate-300 dark:text-slate-600"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></div><p>No hay solicitudes que coincidan</p>
                    </div>
                )}
            </div>
        </div>
    );
}
