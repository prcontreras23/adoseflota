"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useLineas } from "@/lib/LineasContext";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

interface DispositivoStock {
    id: string;
    dispositivo: string;
    cantidad_stock: number;
    notas: string;
    updated_at: string;
}

interface DispositivoConStats extends DispositivoStock {
    solicitados: number;  // líneas con ese equipo en accion_2026 (CAMBIO/ALTA/SE MANTIENE)
    entregados: number;   // entregado = true
    pendientes: number;   // IMEI asignado pero no entregado aún
    disponibles: number;  // stock - entregados (unidades físicas aún disponibles)
}

function badge(entregados: number, stock: number, solicitados: number) {
    if (stock === 0) return { label: "Sin stock", cls: "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400" };
    if (entregados >= stock) return { label: "Todo entregado", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" };
    if (solicitados > stock) return { label: `Déficit ${solicitados - stock}`, cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" };
    if (entregados > 0) return { label: "En progreso", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
    return { label: "Pendiente", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
}

function BarEntrega({ entregados, pendientes, total }: { entregados: number; pendientes: number; total: number }) {
    if (total === 0) return <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-700 w-full" />;
    const pctEntregado = Math.min((entregados / total) * 100, 100);
    const pctPendiente = Math.min((pendientes / total) * 100, 100 - pctEntregado);
    return (
        <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-700 w-full overflow-hidden flex">
            <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${pctEntregado}%` }} />
            <div className="h-full bg-blue-400 transition-all duration-500" style={{ width: `${pctPendiente}%` }} />
        </div>
    );
}

interface FormState {
    dispositivo: string;
    cantidad_stock: string;
    notas: string;
}

const FORM_VACIO: FormState = { dispositivo: "", cantidad_stock: "", notas: "" };

export default function AlmacenTab() {
    const { lineas: ctxLineas } = useLineas();
    const [rawStock, setRawStock] = useState<DispositivoStock[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal agregar / editar
    const [modal, setModal] = useState<"closed" | "nuevo" | "editar">("closed");
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<FormState>(FORM_VACIO);
    const [saving, setSaving] = useState(false);

    // Confirmación de borrado
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Solo carga el inventario; las líneas vienen del contexto compartido (Realtime)
    const loadStock = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase.from("almacen_dispositivos").select("*").order("dispositivo");
        setRawStock((data ?? []) as DispositivoStock[]);
        setLoading(false);
    }, []);

    useEffect(() => { loadStock(); }, [loadStock]);

    // Suscripción Realtime al inventario: altas/ediciones/bajas de stock se
    // reflejan al instante en cualquier ventana o dispositivo (sin recargar).
    useEffect(() => {
        const channel = supabase
            .channel("almacen_dispositivos_sync")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "almacen_dispositivos" },
                (payload) => {
                    setRawStock((prev) => {
                        if (payload.eventType === "INSERT") {
                            const n = payload.new as DispositivoStock;
                            if (prev.some((r) => r.id === n.id)) {
                                return prev.map((r) => (r.id === n.id ? n : r));
                            }
                            return [...prev, n].sort((a, b) => a.dispositivo.localeCompare(b.dispositivo));
                        }
                        if (payload.eventType === "UPDATE") {
                            const n = payload.new as DispositivoStock;
                            return prev.map((r) => (r.id === n.id ? { ...r, ...n } : r));
                        }
                        if (payload.eventType === "DELETE") {
                            const o = payload.old as { id?: string };
                            return o?.id ? prev.filter((r) => r.id !== o.id) : prev;
                        }
                        return prev;
                    });
                }
            )
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Estadísticas calculadas en vivo desde LineasContext (Realtime):
    // cualquier entrega registrada en la pestaña Entregas se refleja aquí al instante.
    const { stock, sinCatalogar } = useMemo(() => {
        const ACCIONES_ENTREGA = ["CAMBIO SOLICITADO", "ALTA", "SE MANTIENE"];
        const conteoSolicitados: Record<string, number> = {};
        const conteoEntregados: Record<string, number> = {};
        const conteoPendientes: Record<string, number> = {};

        for (const l of ctxLineas) {
            const d = l.dispositivo_2026?.trim();
            if (!d || d.toUpperCase() === "SIN CAMBIO" || d === "—") continue;
            const key = d.toLowerCase();
            if (ACCIONES_ENTREGA.includes(l.accion_2026)) {
                conteoSolicitados[key] = (conteoSolicitados[key] || 0) + 1;
            }
            if (l.entregado) {
                conteoEntregados[key] = (conteoEntregados[key] || 0) + 1;
            }
            // Pendiente = IMEI asignado pero no entregado
            if (l.imei?.trim() && !l.entregado && ACCIONES_ENTREGA.includes(l.accion_2026)) {
                conteoPendientes[key] = (conteoPendientes[key] || 0) + 1;
            }
        }

        const enriched: DispositivoConStats[] = rawStock.map(s => {
            const key = s.dispositivo.toLowerCase();
            const solicitados = conteoSolicitados[key] ?? 0;
            const entregados = conteoEntregados[key] ?? 0;
            const pendientes = conteoPendientes[key] ?? 0;
            return {
                ...s,
                solicitados,
                entregados,
                pendientes,
                disponibles: s.cantidad_stock - entregados,
            };
        });

        // Dispositivos en líneas sin entrada en almacén
        const catalogados = new Set(rawStock.map(s => s.dispositivo.toLowerCase()));
        const noEnAlmacen: Record<string, number> = {};
        for (const [key, cnt] of Object.entries(conteoSolicitados)) {
            if (!catalogados.has(key)) noEnAlmacen[key] = cnt;
        }
        const sc = Object.entries(noEnAlmacen)
            .sort((a, b) => b[1] - a[1])
            .map(([nombre, cantidad]) => ({ nombre, cantidad }));

        return { stock: enriched, sinCatalogar: sc };
    }, [rawStock, ctxLineas]);

    function abrirNuevo(nombreSugerido?: string) {
        setForm({ ...FORM_VACIO, dispositivo: nombreSugerido ?? "" });
        setEditId(null);
        setModal("nuevo");
    }

    function abrirEditar(item: DispositivoConStats) {
        setForm({ dispositivo: item.dispositivo, cantidad_stock: String(item.cantidad_stock), notas: item.notas });
        setEditId(item.id);
        setModal("editar");
    }

    async function guardar() {
        if (!form.dispositivo.trim()) { toast.error("El nombre del dispositivo es obligatorio"); return; }
        const cantidad = parseInt(form.cantidad_stock);
        if (isNaN(cantidad) || cantidad < 0) { toast.error("La cantidad debe ser un número positivo"); return; }

        setSaving(true);
        if (modal === "nuevo") {
            const { error } = await supabase.from("almacen_dispositivos").insert([{
                dispositivo: form.dispositivo.trim(),
                cantidad_stock: cantidad,
                notas: form.notas.trim(),
            }]);
            if (error) { toast.error("Error al crear: " + error.message); setSaving(false); return; }
            toast.success("Dispositivo agregado al almacén ✓");
        } else if (editId) {
            const { error } = await supabase.from("almacen_dispositivos").update({
                dispositivo: form.dispositivo.trim(),
                cantidad_stock: cantidad,
                notas: form.notas.trim(),
            }).eq("id", editId);
            if (error) { toast.error("Error al guardar: " + error.message); setSaving(false); return; }
            toast.success("Stock actualizado ✓");
        }
        setSaving(false);
        setModal("closed");
        await loadStock();
    }

    async function eliminar(id: string) {
        setDeleting(true);
        const { error } = await supabase.from("almacen_dispositivos").delete().eq("id", id);
        setDeleting(false);
        if (error) { toast.error("Error al eliminar"); return; }
        toast.success("Eliminado del almacén");
        setConfirmDeleteId(null);
        await loadStock();
    }

    // KPIs generales
    const totalModelos = stock.length;
    const totalUnidades = stock.reduce((s, i) => s + i.cantidad_stock, 0);
    const totalEntregados = stock.reduce((s, i) => s + i.entregados, 0);
    const totalPendientes = stock.reduce((s, i) => s + i.pendientes, 0);
    const totalDisponibles = stock.reduce((s, i) => s + Math.max(i.disponibles, 0), 0);
    const conDeficit = stock.filter(i => i.solicitados > i.cantidad_stock).length;

    function exportarAlmacen() {
        const rows = stock.map(s => ({
            "Dispositivo": s.dispositivo,
            "Stock": s.cantidad_stock,
            "Solicitados": s.solicitados,
            "Libres (sin solicitar)": s.cantidad_stock - s.solicitados,
            "Entregados": s.entregados,
            "Pendientes (IMEI asig.)": s.pendientes,
            "Disponibles (sin entregar)": s.disponibles,
            "Estado": badge(s.entregados, s.cantidad_stock, s.solicitados).label,
            "Notas": s.notas,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws["!cols"] = [{ wch: 30 }, { wch: 8 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 22 }, { wch: 20 }, { wch: 30 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Almacén Dispositivos");
        XLSX.writeFile(wb, `Almacen-Dispositivos-${new Date().toISOString().split("T")[0]}.xlsx`);
        toast.success("Almacén exportado");
    }

    const inputCls = "w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
    const labelCls = "text-xs text-slate-500 mb-1 block font-medium";

    if (loading) return (
        <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="space-y-5">

            {/* ── MODAL AGREGAR / EDITAR ──────────────────────────────── */}
            {modal !== "closed" && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setModal("closed")} />
                    <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="font-bold text-slate-800 dark:text-white text-base">
                                {modal === "nuevo" ? "➕ Agregar al almacén" : "✏️ Editar stock"}
                            </p>
                            <button onClick={() => setModal("closed")}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-800 text-lg">✕</button>
                        </div>

                        <div>
                            <label className={labelCls}>Modelo de dispositivo <span className="text-red-500">*</span></label>
                            <input value={form.dispositivo}
                                onChange={e => setForm(p => ({ ...p, dispositivo: e.target.value }))}
                                placeholder="Ej: Samsung A56, iPhone 17 Pro Max..."
                                className={inputCls} />
                            <p className="text-[11px] text-slate-400 mt-1">
                                Debe coincidir exactamente con el nombre usado en las líneas
                            </p>
                        </div>

                        <div>
                            <label className={labelCls}>Cantidad en stock <span className="text-red-500">*</span></label>
                            <input value={form.cantidad_stock}
                                onChange={e => setForm(p => ({ ...p, cantidad_stock: e.target.value }))}
                                type="number" min="0"
                                placeholder="Ej: 10"
                                className={inputCls} />
                        </div>

                        <div>
                            <label className={labelCls}>Notas</label>
                            <textarea value={form.notas}
                                onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
                                rows={2} placeholder="Colores disponibles, condición, ubicación..."
                                className={inputCls + " resize-none"} />
                        </div>

                        <div className="flex gap-3 pt-1">
                            <button onClick={() => setModal("closed")}
                                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-200 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={guardar} disabled={saving}
                                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-50 transition-colors">
                                {saving ? "Guardando..." : modal === "nuevo" ? "Agregar" : "Guardar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── HEADER ─────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">📦 Almacén de Dispositivos</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Stock real vs. solicitados en las líneas
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={exportarAlmacen} disabled={stock.length === 0}
                        className="text-sm bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white px-4 py-2 rounded-xl font-semibold transition-colors">
                        📊 Exportar Excel
                    </button>
                    <button onClick={() => abrirNuevo()}
                        className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-semibold transition-colors">
                        ➕ Agregar dispositivo
                    </button>
                </div>
            </div>

            {/* ── KPI CARDS ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: "Total en almacén", value: totalUnidades, color: "text-slate-700 dark:text-slate-200", bg: "bg-white dark:bg-slate-800" },
                    { label: "Entregados", value: totalEntregados, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
                    { label: "IMEI asig. / pendientes", value: totalPendientes, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
                    { label: "Disponibles en almacén", value: totalDisponibles, color: conDeficit > 0 ? "text-rose-600" : "text-teal-600", bg: conDeficit > 0 ? "bg-rose-50 dark:bg-rose-900/20" : "bg-teal-50 dark:bg-teal-900/20" },
                ].map(k => (
                    <div key={k.label} className={`${k.bg} rounded-2xl border border-slate-200 dark:border-slate-700 p-4`}>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{k.label}</p>
                        <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                    </div>
                ))}
            </div>

            {/* ── ALERTA DEFICIT ─────────────────────────────────────── */}
            {conDeficit > 0 && (
                <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 flex items-start gap-3">
                    <span className="text-xl mt-0.5">🔴</span>
                    <div>
                        <p className="font-bold text-rose-700 dark:text-rose-400 text-sm">
                            {conDeficit} modelo{conDeficit > 1 ? "s" : ""} con déficit de stock
                        </p>
                        <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">
                            Hay más solicitudes que unidades disponibles. Revisa y ajusta el stock o las asignaciones.
                        </p>
                    </div>
                </div>
            )}

            {/* ── TABLA PRINCIPAL ────────────────────────────────────── */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {stock.length === 0 ? (
                    <div className="py-16 text-center text-slate-400">
                        <p className="text-4xl mb-2">📦</p>
                        <p className="font-medium">No hay dispositivos en el almacén</p>
                        <p className="text-xs mt-1">Agrega los modelos que recibiste con el botón de arriba</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    {["Dispositivo", "Stock", "Solicitados", "Libres", "Entregados", "Pendientes", "Disponibles", "Progreso de entrega", "Estado", ""].map(h => (
                                        <th key={h} className="p-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {stock.map(item => {
                                    const b = badge(item.entregados, item.cantidad_stock, item.solicitados);
                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                            <td className="p-3 font-medium text-slate-800 dark:text-white whitespace-nowrap">
                                                {item.dispositivo}
                                                {item.notas && <p className="text-xs text-slate-400 font-normal mt-0.5">{item.notas}</p>}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="font-bold text-slate-700 dark:text-slate-200 text-base">
                                                    {item.cantidad_stock}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`font-semibold text-base ${item.solicitados > item.cantidad_stock ? "text-rose-600" : "text-amber-600 dark:text-amber-400"}`}>
                                                    {item.solicitados}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center">
                                                {(() => {
                                                    const libres = item.cantidad_stock - item.solicitados;
                                                    return (
                                                        <span className={`font-bold text-base ${libres < 0 ? "text-rose-600" : libres === 0 ? "text-slate-400" : "text-sky-600 dark:text-sky-400"}`}>
                                                            {libres < 0 ? libres : libres}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="font-bold text-base text-emerald-600 dark:text-emerald-400">
                                                    {item.entregados}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`font-semibold text-base ${item.pendientes > 0 ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`}>
                                                    {item.pendientes}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`font-bold text-base ${item.disponibles <= 0 ? "text-rose-600" : "text-teal-600 dark:text-teal-400"}`}>
                                                    {item.disponibles}
                                                </span>
                                            </td>
                                            <td className="p-3 min-w-[140px]">
                                                <BarEntrega entregados={item.entregados} pendientes={item.pendientes} total={item.cantidad_stock} />
                                                <p className="text-[10px] text-slate-400 mt-1 flex gap-3">
                                                    <span className="text-emerald-600">■ {item.entregados} entregados</span>
                                                    {item.pendientes > 0 && <span className="text-blue-500">■ {item.pendientes} con IMEI</span>}
                                                </p>
                                            </td>
                                            <td className="p-3">
                                                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${b.cls}`}>
                                                    {b.label}
                                                </span>
                                            </td>
                                            <td className="p-3 whitespace-nowrap">
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => abrirEditar(item)}
                                                        className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 transition-colors font-medium">
                                                        ✏️ Editar
                                                    </button>
                                                    {confirmDeleteId === item.id ? (
                                                        <div className="flex gap-1">
                                                            <button
                                                                onClick={() => eliminar(item.id)}
                                                                disabled={deleting}
                                                                className="text-xs px-2.5 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-500 font-semibold disabled:opacity-50 transition-colors">
                                                                {deleting ? "..." : "Confirmar"}
                                                            </button>
                                                            <button
                                                                onClick={() => setConfirmDeleteId(null)}
                                                                className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors">
                                                                No
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setConfirmDeleteId(item.id)}
                                                            className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-rose-100 dark:hover:bg-rose-900/30 hover:text-rose-600 transition-colors">
                                                            🗑
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── DISPOSITIVOS NO CATALOGADOS ─────────────────────────── */}
            {sinCatalogar.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-3">
                        ⚠️ Dispositivos en líneas sin entrada en almacén ({sinCatalogar.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {sinCatalogar.map(({ nombre, cantidad }) => (
                            <button
                                key={nombre}
                                onClick={() => abrirNuevo(nombre)}
                                title={`Agregar «${nombre}» al almacén`}
                                className="text-xs px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors font-medium">
                                {nombre} <span className="text-amber-500">({cantidad})</span> ＋
                            </button>
                        ))}
                    </div>
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2">
                        Haz clic en cualquiera para agregarlo al almacén con el nombre exacto.
                    </p>
                </div>
            )}
        </div>
    );
}
