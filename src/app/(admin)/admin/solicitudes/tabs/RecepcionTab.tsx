"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase, formatDate, formatRD, type Solicitud } from "@/lib/supabase";
import toast from "react-hot-toast";

export default function RecepcionTab() {
    const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<string | null>(null);
    const [form, setForm] = useState({ imei: "", numero_telefono: "", sim: "", fecha_contrato: "" });
    const [saving, setSaving] = useState(false);

    const loadData = useCallback(async () => {
        const { data } = await supabase.from("solicitudes")
            .select("*, planes_claro(*), catalogo_dispositivos(*)")
            .in("estado", ["enviado", "transito"])
            .order("created_at", { ascending: false });
        setSolicitudes(data ?? []);
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    async function handleRecibir(solicitud: Solicitud) {
        if (!form.imei || !form.numero_telefono || !form.sim || !form.fecha_contrato) {
            toast.error("Completa todos los campos: IMEI, número, SIM y fecha de activación");
            return;
        }
        setSaving(true);

        // Calculate 18 months
        const fechaContrato = new Date(form.fecha_contrato);
        const fecha18m = new Date(fechaContrato);
        fecha18m.setMonth(fecha18m.getMonth() + 18);

        // Update solicitud estado
        await supabase.from("solicitudes").update({ estado: "listo-entrega" }).eq("id", solicitud.id);

        // Create flota_maestra record
        const { error } = await supabase.from("flota_maestra").insert({
            solicitud_id: solicitud.id,
            nombre: solicitud.nombre,
            cargo: solicitud.cargo,
            area: solicitud.area,
            numero_telefono: form.numero_telefono,
            imei: form.imei,
            sim: form.sim,
            plan_id: solicitud.plan_id,
            dispositivo_id: solicitud.dispositivo_id,
            costo_dispositivo: solicitud.precio_equipo,
            fecha_contrato: form.fecha_contrato,
            fecha_cambio_18m: fecha18m.toISOString().split("T")[0],
            estado: "activo",
        });

        if (error) toast.error("Error al registrar recepción");
        else {
            toast.success(`✅ Recibido. Fecha cambiazo: ${formatDate(fecha18m.toISOString())}`);
            setEditing(null);
            setForm({ imei: "", numero_telefono: "", sim: "", fecha_contrato: "" });
            loadData();
        }
        setSaving(false);
    }

    if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Recepción de Dispositivos</h2>
                <span className="text-sm text-slate-500 dark:text-slate-400">{solicitudes.length} esperando</span>
            </div>

            {solicitudes.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 py-20 text-center">
                    <div className="flex justify-center mb-3 text-slate-300 dark:text-slate-600"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div>
                    <p className="text-slate-500 dark:text-slate-400">No hay dispositivos esperando recepción</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {solicitudes.map(s => (
                        <div key={s.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 animate-fade-in">
                            <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
                                <div>
                                    <span className="font-mono text-blue-600 dark:text-blue-400 font-bold text-sm">{s.id}</span>
                                    <h3 className="font-semibold text-slate-800 dark:text-white">{s.nombre} · {s.cargo}</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        {s.catalogo_dispositivos?.modelo} · {s.planes_claro?.nombre}
                                    </p>
                                </div>
                                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                    {s.estado === "enviado" ? "Enviado a Claro" : "En Tránsito"}
                                </span>
                            </div>

                            {editing === s.id ? (
                                <div className="border-t border-slate-100 dark:border-slate-700 pt-4 space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">IMEI *</label>
                                            <input value={form.imei} onChange={e => setForm(f => ({ ...f, imei: e.target.value }))} placeholder="15 dígitos"
                                                className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Número de Teléfono *</label>
                                            <input value={form.numero_telefono} onChange={e => setForm(f => ({ ...f, numero_telefono: e.target.value }))} placeholder="829-000-0000"
                                                className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Número SIM / ICC *</label>
                                            <input value={form.sim} onChange={e => setForm(f => ({ ...f, sim: e.target.value }))} placeholder="SIM ID"
                                                className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Fecha de Activación *</label>
                                            <input type="date" value={form.fecha_contrato} onChange={e => setForm(f => ({ ...f, fecha_contrato: e.target.value }))}
                                                className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setEditing(null)}
                                            className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                            Cancelar
                                        </button>
                                        <button onClick={() => handleRecibir(s)} disabled={saving}
                                            className="flex-1 bg-green-600 hover:bg-green-500 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                            {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Guardando...</> : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.1 9 11.1"/></svg> Marcar como Recibido</>}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button onClick={() => { setEditing(s.id); setForm({ imei: "", numero_telefono: "", sim: "", fecha_contrato: new Date().toISOString().split("T")[0] }); }}
                                    className="w-full bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 rounded-xl py-2.5 text-sm text-slate-600 dark:text-slate-300 font-medium transition-colors flex items-center justify-center gap-1.5">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Registrar Recepción
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
