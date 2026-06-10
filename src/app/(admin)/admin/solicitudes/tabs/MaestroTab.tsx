"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase, formatDate, formatRD, type FlotaMaestra } from "@/lib/supabase";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

export default function MaestroTab() {
    const [flota, setFlota] = useState<FlotaMaestra[]>([]);
    const [filtered, setFiltered] = useState<FlotaMaestra[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterArea, setFilterArea] = useState("");
    const importRef = useRef<HTMLInputElement>(null);
    const [importing, setImporting] = useState(false);

    const loadData = useCallback(async () => {
        const { data } = await supabase.from("flota_maestra")
            .select("*, planes_claro(*), catalogo_dispositivos(*)")
            .order("nombre");
        setFlota(data ?? []);
        setFiltered(data ?? []);
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    useEffect(() => {
        let f = flota;
        if (filterArea) f = f.filter(r => r.area === filterArea);
        if (search) f = f.filter(r => r.nombre.toLowerCase().includes(search.toLowerCase()) || r.numero_telefono.includes(search));
        setFiltered(f);
    }, [flota, filterArea, search]);

    function exportExcel() {
        const rows = filtered.map(r => ({
            "Nombre": r.nombre, "Cargo": r.cargo, "Área": r.area,
            "Teléfono": r.numero_telefono, "IMEI": r.imei, "SIM": r.sim,
            "Plan": (r as any).planes_claro?.nombre ?? "",
            "Dispositivo": (r as any).catalogo_dispositivos?.modelo ?? "",
            "Costo Dispositivo RD$": r.costo_dispositivo,
            "Fecha Contrato": r.fecha_contrato ?? "",
            "Fecha Entrega": r.fecha_entrega ?? "",
            "Fecha Cambiazo 18m": r.fecha_cambio_18m ?? "",
            "Estado": r.estado, "Notas": r.notas,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Flota Maestra");
        XLSX.writeFile(wb, `Flota-Maestra-ADOSE-${new Date().toISOString().split("T")[0]}.xlsx`);
        toast.success("Excel exportado correctamente");
    }

    async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true);
        try {
            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer, { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

            let imported = 0;
            for (const row of rows) {
                const nombre = row["Nombre"] || row["NOMBRE"] || row["nombre"] || "";
                if (!nombre) continue;
                await supabase.from("flota_maestra").insert({
                    nombre, cargo: row["Cargo"] || row["CARGO"] || "",
                    area: row["Área"] || row["AREA"] || "Empleados CEADIC",
                    numero_telefono: row["Teléfono"] || row["TELEFONO"] || row["Número"] || "",
                    imei: row["IMEI"] || "", sim: row["SIM"] || "",
                    estado: "activo", notas: "Importado desde Excel ADOSE 2024",
                });
                imported++;
            }
            toast.success(`✅ ${imported} registros importados desde Excel`);
            loadData();
        } catch (err) {
            toast.error("Error al leer el archivo Excel");
        }
        setImporting(false);
        if (importRef.current) importRef.current.value = "";
    }

    async function updateField(id: string, field: string, value: string) {
        const { error } = await supabase.from("flota_maestra").update({ [field]: value }).eq("id", id);
        if (!error) {
            setFlota(prev => prev.map(r => r.id === id ? ({ ...r, [field]: value }) : r));
        }
    }

    if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Registro Maestro ({flota.length} líneas)</h2>
                <div className="flex gap-2">
                    <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" id="import-excel" />
                    <label htmlFor="import-excel"
                        className="cursor-pointer text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2">
                        {importing ? <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : "📥"}
                        Importar Excel
                    </label>
                    <button onClick={exportExcel}
                        className="text-sm bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-xl font-semibold transition-colors flex items-center gap-2">
                        📊 Exportar Excel
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap gap-3">
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Buscar por nombre o teléfono..."
                    className="flex-1 min-w-48 border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <select value={filterArea} onChange={e => setFilterArea(e.target.value)}
                    className="border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Todas las áreas</option>
                    <option value="Pastores">Pastores</option>
                    <option value="Empleados CEADIC">Empleados CEADIC</option>
                    <option value="Familiares">Familiares</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                {["Nombre", "Área", "Teléfono", "IMEI", "Dispositivo", "Plan", "Costo", "Contrato", "Cambiazo 18m", "Estado"].map(h => (
                                    <th key={h} className="p-2.5 text-left font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {filtered.map(r => (
                                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                    <td className="p-2.5">
                                        <p className="font-medium text-slate-800 dark:text-white whitespace-nowrap">{r.nombre}</p>
                                        <p className="text-slate-400">{r.cargo}</p>
                                    </td>
                                    <td className="p-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">{r.area}</td>
                                    <td className="p-2.5 font-mono text-slate-700 dark:text-slate-200 whitespace-nowrap">{r.numero_telefono || "—"}</td>
                                    <td className="p-2.5 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">{r.imei || "—"}</td>
                                    <td className="p-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">{(r as any).catalogo_dispositivos?.modelo ?? "—"}</td>
                                    <td className="p-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">{(r as any).planes_claro?.nombre ?? "—"}</td>
                                    <td className="p-2.5 text-slate-700 dark:text-slate-200 whitespace-nowrap">{r.costo_dispositivo ? formatRD(r.costo_dispositivo) : "—"}</td>
                                    <td className="p-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDate(r.fecha_contrato)}</td>
                                    <td className="p-2.5 whitespace-nowrap">
                                        {r.fecha_cambio_18m ? (
                                            <span className={`font-medium ${new Date(r.fecha_cambio_18m) < new Date() ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
                                                {formatDate(r.fecha_cambio_18m)}
                                            </span>
                                        ) : "—"}
                                    </td>
                                    <td className="p-2.5">
                                        <select value={r.estado}
                                            onChange={e => updateField(r.id, "estado", e.target.value)}
                                            className="text-xs border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg px-1.5 py-1 focus:outline-none">
                                            <option value="activo">Activo</option>
                                            <option value="suspendido">Suspendido</option>
                                            <option value="cancelado">Cancelado</option>
                                            <option value="entregado">Entregado</option>
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filtered.length === 0 && (
                    <div className="py-16 text-center text-slate-400">
                        <p className="text-4xl mb-2">📊</p><p>No hay registros</p>
                    </div>
                )}
            </div>

            {/* Changeover alerts */}
            {flota.filter(r => r.fecha_cambio_18m && new Date(r.fecha_cambio_18m) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
                    <h3 className="font-semibold text-amber-700 dark:text-amber-400 mb-2">⚠️ Cambiazo próximo o vencido</h3>
                    <div className="space-y-1">
                        {flota.filter(r => r.fecha_cambio_18m && new Date(r.fecha_cambio_18m) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).map(r => (
                            <p key={r.id} className="text-sm text-amber-700 dark:text-amber-400">
                                {r.nombre} — Cambiazo: {formatDate(r.fecha_cambio_18m)} · {r.numero_telefono}
                            </p>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
