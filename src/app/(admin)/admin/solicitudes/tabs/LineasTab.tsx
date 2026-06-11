"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase, type LineaAltice, ACCION_COLORS, ESTADO_LINEA_COLORS } from "@/lib/supabase";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import NuevaLineaModal from "./NuevaLineaModal";

const ACCIONES = ["", "BAJA", "ALTA", "CAMBIO SOLICITADO", "SE MANTIENE", "REVISAR"];
const ESTADOS = ["", "CONFIRMADA", "POR CONFIRMAR", "PENDIENTE", "OK", "RESPONDIÓ", "SIN RESPUESTA"];
const TIPOS = ["", "EMPLEADO", "EMPLEADO 2", "FAMILIAR", "PASTORES", "DEPARTAMENTAL", "INSTITUCION", "JUBILADO", "EXTERNO", "UD", "DESVINCULAR", "N/D", "CONFLICTO"];

function FieldEditable({ value, onSave, multiline = false }: { value: string; onSave: (v: string) => void; multiline?: boolean }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

    useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);

    function commit() {
        setEditing(false);
        if (draft !== value) onSave(draft);
    }

    if (!editing) return (
        <span className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded px-1 py-0.5 block min-w-[60px] whitespace-pre-wrap"
            onClick={() => { setDraft(value); setEditing(true); }}>
            {value || <span className="text-slate-300 dark:text-slate-600 italic">—</span>}
        </span>
    );

    if (multiline) return (
        <textarea ref={ref as any} value={draft} onChange={e => setDraft(e.target.value)}
            onBlur={commit} onKeyDown={e => e.key === "Escape" && setEditing(false)}
            rows={3} className="w-full text-xs border border-blue-400 rounded-lg p-1 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
    );

    return (
        <input ref={ref as any} value={draft} onChange={e => setDraft(e.target.value)}
            onBlur={commit} onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
            className="w-full text-xs border border-blue-400 rounded-lg p-1 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
    );
}

export default function LineasTab() {
    const [all, setAll] = useState<LineaAltice[]>([]);
    const [filtered, setFiltered] = useState<LineaAltice[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterAccion, setFilterAccion] = useState("");
    const [filterEstado, setFilterEstado] = useState("");
    const [filterTipo, setFilterTipo] = useState("");
    const [filterDispositivo, setFilterDispositivo] = useState("");
    const [filterGb, setFilterGb] = useState("");
    const [filterMin, setFilterMin] = useState("");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [showNueva, setShowNueva] = useState(false);
    const [importing, setImporting] = useState(false);
    const importRef = useRef<HTMLInputElement>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase.from("lineas_altice").select("*").order("titular_responsable");
        setAll((data ?? []) as LineaAltice[]);
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    useEffect(() => {
        let f = all;
        if (filterAccion) f = f.filter(r => r.accion_2026 === filterAccion);
        if (filterEstado) f = f.filter(r => r.estado === filterEstado);
        if (filterTipo) f = f.filter(r => r.tipo === filterTipo);
        if (filterDispositivo) f = f.filter(r => r.dispositivo_2026?.trim() === filterDispositivo);
        if (filterGb) f = f.filter(r => (r.gb_solicitado?.trim() || r.gb_antes?.trim()) === filterGb);
        if (filterMin) f = f.filter(r => (r.min_solicitados?.trim() || r.min_antes?.trim()) === filterMin);
        if (search) {
            const q = search.toLowerCase();
            f = f.filter(r =>
                r.usuario_linea.toLowerCase().includes(q) ||
                r.titular_responsable.toLowerCase().includes(q) ||
                r.telefono.includes(q) ||
                r.seguimiento.toLowerCase().includes(q)
            );
        }
        setFiltered(f);
    }, [all, filterAccion, filterEstado, filterTipo, filterDispositivo, filterGb, filterMin, search]);

    async function updateField(id: string, field: keyof LineaAltice, value: string) {
        const { error } = await supabase.from("lineas_altice").update({ [field]: value }).eq("id", id);
        if (error) { toast.error("Error guardando"); return; }
        setAll(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
        toast.success("Guardado ✓", { duration: 1200 });
    }

    function handleCreada(linea: LineaAltice) {
        setAll(prev => [...prev, linea].sort((a, b) => a.titular_responsable.localeCompare(b.titular_responsable)));
    }

    // Mapeo columna Excel → campo BD
    const COLUMNAS: Record<string, keyof LineaAltice> = {
        "Teléfono": "telefono",
        "Usuario": "usuario_linea",
        "Titular Responsable": "titular_responsable",
        "Tipo": "tipo",
        "Acción 2026": "accion_2026",
        "Detalle Origen": "detalle_origen",
        "GB Antes": "gb_antes",
        "GB Solicitado": "gb_solicitado",
        "Min Antes": "min_antes",
        "Min Solicitados": "min_solicitados",
        "Dispositivo 2026": "dispositivo_2026",
        "Cotización": "cotizacion",
        "Monto Mensual": "monto_mensual",
        "Estado": "estado",
        "Próxima Acción": "proxima_accion",
        "Observaciones": "observaciones",
        "Seguimiento": "seguimiento",
        "Titular Vinculado": "titular_vinculado",
    };

    function exportarFiltradas() {
        // Exporta solo las líneas visibles (con filtros aplicados)
        const rows = filtered.map(r => ({
            "Teléfono": r.telefono,
            "Usuario": r.usuario_linea,
            "Titular Responsable": r.titular_responsable,
            "Tipo": r.tipo,
            "Acción 2026": r.accion_2026,
            "GB Antes": r.gb_antes,
            "GB Solicitado": r.gb_solicitado,
            "Min Antes": r.min_antes,
            "Min Solicitados": r.min_solicitados,
            "Dispositivo 2026": r.dispositivo_2026,
            "Estado": r.estado,
            "Próxima Acción": r.proxima_accion,
            "Cotización": r.cotizacion,
            "Monto Mensual": r.monto_mensual,
            "Observaciones": r.observaciones,
            "Seguimiento": r.seguimiento,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws["!cols"] = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length, 14) }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Líneas Altice 2026");
        XLSX.writeFile(wb, `Exportar-Lineas-${new Date().toISOString().split("T")[0]}.xlsx`);
        toast.success(`${filtered.length} líneas exportadas`);
    }

    function exportPlantilla() {
        // Exporta TODAS las líneas (no solo filtradas) con TODOS los campos
        const rows = all.map(r => ({
            "Teléfono": r.telefono,
            "Usuario": r.usuario_linea,
            "Titular Responsable": r.titular_responsable,
            "Tipo": r.tipo,
            "Acción 2026": r.accion_2026,
            "Detalle Origen": r.detalle_origen,
            "GB Antes": r.gb_antes,
            "GB Solicitado": r.gb_solicitado,
            "Min Antes": r.min_antes,
            "Min Solicitados": r.min_solicitados,
            "Dispositivo 2026": r.dispositivo_2026,
            "Cotización": r.cotizacion,
            "Monto Mensual": r.monto_mensual,
            "Estado": r.estado,
            "Próxima Acción": r.proxima_accion,
            "Observaciones": r.observaciones,
            "Seguimiento": r.seguimiento,
            "Titular Vinculado": r.titular_vinculado,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        // Ancho mínimo por columna
        ws["!cols"] = Object.keys(rows[0] || {}).map(k =>
            ({ wch: Math.max(k.length, 15) })
        );
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Líneas Altice 2026");
        XLSX.writeFile(wb, `Plantilla-Flota-${new Date().toISOString().split("T")[0]}.xlsx`);
        toast.success("Plantilla descargada — edita y sube con «Importar»");
    }

    async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        // Limpiar el input para que el mismo archivo pueda volver a subirse
        e.target.value = "";
        setImporting(true);
        const toastId = toast.loading("Leyendo archivo...");

        try {
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const jsonRaw: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

            if (jsonRaw.length === 0) {
                toast.dismiss(toastId);
                toast.error("El archivo no tiene filas");
                setImporting(false);
                return;
            }

            // Mapear encabezados → campos BD
            const rows = jsonRaw.map(raw => {
                const r: Partial<LineaAltice> = {};
                for (const [col, field] of Object.entries(COLUMNAS)) {
                    if (col in raw) (r as any)[field] = String(raw[col] ?? "");
                }
                return r;
            }).filter(r => r.telefono?.trim()); // Teléfono es obligatorio

            if (rows.length === 0) {
                toast.dismiss(toastId);
                toast.error("No se encontró la columna «Teléfono» o no hay filas válidas");
                setImporting(false);
                return;
            }

            toast.loading(`Actualizando ${rows.length} líneas en Supabase...`, { id: toastId });

            // Upsert por lotes de 50
            const BATCH = 50;
            let errCount = 0;
            for (let i = 0; i < rows.length; i += BATCH) {
                const lote = rows.slice(i, i + BATCH);
                const { error } = await supabase
                    .from("lineas_altice")
                    .upsert(lote as any[], { onConflict: "telefono" });
                if (error) errCount++;
            }

            toast.dismiss(toastId);
            if (errCount > 0) {
                toast.error(`Importado con ${errCount} lotes con error`);
            } else {
                toast.success(`✅ ${rows.length} líneas actualizadas en Supabase`);
            }

            // Recargar datos
            await loadData();
        } catch (err) {
            toast.dismiss(toastId);
            toast.error("Error al leer el archivo: " + (err as Error).message);
        } finally {
            setImporting(false);
        }
    }

    if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-4">
            {showNueva && (
                <NuevaLineaModal
                    onClose={() => setShowNueva(false)}
                    onCreate={handleCreada}
                />
            )}

            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Líneas del Contrato</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{filtered.length} de {all.length} líneas</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => setShowNueva(true)}
                        className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-semibold transition-colors">
                        ➕ Nueva Línea
                    </button>
                    <button onClick={exportarFiltradas}
                        className="text-sm bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-xl font-semibold transition-colors">
                        📊 Exportar Excel
                    </button>
                    <button onClick={exportPlantilla}
                        className="text-sm bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-semibold transition-colors">
                        📥 Plantilla completa
                    </button>
                    <button
                        onClick={() => importRef.current?.click()}
                        disabled={importing}
                        className="text-sm bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl font-semibold transition-colors">
                        {importing ? "⏳ Importando..." : "📤 Importar Excel"}
                    </button>
                    <input
                        ref={importRef}
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={handleImport}
                    />
                </div>
            </div>

            {/* Filtros */}
            {(() => {
                const opcionesDispositivo = [...new Set(all.map(r => r.dispositivo_2026?.trim()).filter(Boolean))].sort() as string[];
                const opcionesGb = [...new Set(all.map(r => r.gb_solicitado?.trim() || r.gb_antes?.trim()).filter(Boolean))].sort((a, b) => parseFloat(a!) - parseFloat(b!)) as string[];
                const opcionesMin = [...new Set(all.map(r => r.min_solicitados?.trim() || r.min_antes?.trim()).filter(Boolean))].sort((a, b) => parseFloat(a!) - parseFloat(b!)) as string[];
                const hayFiltros = !!(filterAccion || filterEstado || filterTipo || filterDispositivo || filterGb || filterMin || search);
                const selCls = "border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
                return (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap gap-3">
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="🔍 Buscar nombre, titular, teléfono, seguimiento..."
                            className={`flex-1 min-w-52 ${selCls}`} />
                        <select value={filterAccion} onChange={e => setFilterAccion(e.target.value)} className={selCls}>
                            <option value="">Todas las acciones</option>
                            {ACCIONES.filter(Boolean).map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                        <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} className={selCls}>
                            <option value="">Todos los estados</option>
                            {ESTADOS.filter(Boolean).map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className={selCls}>
                            <option value="">Todos los tipos</option>
                            {TIPOS.filter(Boolean).map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                        <select value={filterDispositivo} onChange={e => setFilterDispositivo(e.target.value)} className={selCls}>
                            <option value="">📱 Todos los equipos</option>
                            {opcionesDispositivo.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <select value={filterGb} onChange={e => setFilterGb(e.target.value)} className={selCls}>
                            <option value="">📶 Todos los GB</option>
                            {opcionesGb.map(g => <option key={g} value={g}>{g} GB</option>)}
                        </select>
                        <select value={filterMin} onChange={e => setFilterMin(e.target.value)} className={selCls}>
                            <option value="">📞 Todos los min</option>
                            {opcionesMin.map(m => <option key={m} value={m}>{m} min</option>)}
                        </select>
                        {hayFiltros && (
                            <button onClick={() => { setFilterAccion(""); setFilterEstado(""); setFilterTipo(""); setFilterDispositivo(""); setFilterGb(""); setFilterMin(""); setSearch(""); }}
                                className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 underline whitespace-nowrap">
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                );
            })()}

            {/* Tabla */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                            <tr>
                                {["Teléfono", "Usuario / Titular", "Tipo", "Acción 2026", "GB Antes → 2026", "Min", "Dispositivo 2026", "Estado", "Seguimiento"].map(h => (
                                    <th key={h} className="p-2.5 text-left font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {filtered.map(r => (
                                <>
                                    <tr key={r.id}
                                        className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer"
                                        onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                                        <td className="p-2.5 font-mono font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
                                            {r.telefono === "NUEVA" ? <span className="text-green-600 font-bold">NUEVA</span> : r.telefono}
                                        </td>
                                        <td className="p-2.5">
                                            <p className="font-medium text-slate-800 dark:text-white">{r.usuario_linea || "—"}</p>
                                            <p className="text-slate-400 text-[11px]">{r.titular_responsable || <span className="text-red-400">Sin titular</span>}</p>
                                        </td>
                                        {/* Tipo — editable inline */}
                                        <td className="p-2.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                            <select value={r.tipo}
                                                onChange={e => updateField(r.id, "tipo", e.target.value)}
                                                className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                                                {TIPOS.map(t => <option key={t} value={t}>{t || "(tipo)"}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-2.5 whitespace-nowrap">
                                            <select value={r.accion_2026}
                                                onClick={e => e.stopPropagation()}
                                                onChange={e => updateField(r.id, "accion_2026", e.target.value)}
                                                className={`text-xs font-semibold px-2 py-1 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${ACCION_COLORS[r.accion_2026] ?? "bg-slate-100 text-slate-500"}`}>
                                                {ACCIONES.map(a => <option key={a} value={a}>{a || "(sin acción)"}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-2.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
                                            {r.gb_antes} → <span className="font-medium">{r.gb_solicitado || "—"}</span>
                                        </td>
                                        <td className="p-2.5 whitespace-nowrap text-slate-500 dark:text-slate-400">
                                            {r.min_antes}{r.min_solicitados && r.min_solicitados !== "—" ? ` → ${r.min_solicitados}` : ""}
                                        </td>
                                        <td className="p-2.5 text-slate-600 dark:text-slate-300 max-w-[160px]">
                                            <span className="line-clamp-2">{r.dispositivo_2026 || "—"}</span>
                                        </td>
                                        <td className="p-2.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                            <select value={r.estado}
                                                onChange={e => updateField(r.id, "estado", e.target.value)}
                                                className={`text-xs font-semibold px-2 py-1 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${ESTADO_LINEA_COLORS[r.estado] ?? "bg-slate-100 text-slate-500"}`}>
                                                {ESTADOS.map(a => <option key={a} value={a}>{a || "(sin estado)"}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-2.5 min-w-[180px]" onClick={e => e.stopPropagation()}>
                                            <FieldEditable value={r.seguimiento} onSave={v => updateField(r.id, "seguimiento", v)} multiline />
                                        </td>
                                    </tr>
                                    {expandedId === r.id && (
                                        <tr key={r.id + "-exp"} className="bg-blue-50/50 dark:bg-blue-900/10">
                                            <td colSpan={9} className="p-4">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                                                    <div>
                                                        <p className="font-bold text-slate-500 dark:text-slate-400 mb-1">PRÓXIMA ACCIÓN</p>
                                                        <FieldEditable value={r.proxima_accion} onSave={v => updateField(r.id, "proxima_accion", v)} multiline />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-500 dark:text-slate-400 mb-1">OBSERVACIONES</p>
                                                        <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{r.observaciones || "—"}</p>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-500 dark:text-slate-400 mb-1">DETALLE / ORIGEN</p>
                                                        <p className="text-slate-600 dark:text-slate-300">{r.detalle_origen || "—"}</p>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filtered.length === 0 && (
                    <div className="py-16 text-center text-slate-400">
                        <p className="text-4xl mb-2">🔍</p>
                        <p>No hay líneas con esos filtros</p>
                    </div>
                )}
            </div>
        </div>
    );
}
