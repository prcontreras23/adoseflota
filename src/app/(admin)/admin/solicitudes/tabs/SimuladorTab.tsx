"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase, formatRD, type LineaAltice } from "@/lib/supabase";
import { useLineas } from "@/lib/LineasContext";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SimRegla {
    id: string;
    equipo: string;
    plan: string;
    precio_base: number;
    pct_subsidio: number;
    inst_paga: number;
    cantidad_override: number | null;
    orden: number;
}

interface SimEspecial {
    id: string;
    nombre: string;
    equipo: string;
    cantidad: number;
    precio_base: number;
    subsidio_altice: number;
    inst_paga: number;
    usuario_paga: number;
    orden: number;
}

interface SimSnapshot {
    id: string;
    nombre: string;
    descripcion: string;
    reglas_json: SimRegla[];
    especiales_json: SimEspecial[];
    subsidio_disponible: number;
    resumen_json: ResumenSnapshot;
    created_at: string;
}

interface ResumenSnapshot {
    totalSubsidioAltice: number;
    totalInstPaga: number;
    totalUsuarioPaga: number;
    totalEquipos: number;
    subsidio_disponible: number;
    diferencia: number;
}

interface ReglaRow extends SimRegla {
    cantidad_calc: number;
    subsidio_unit: number;
    inst_unit: number;
    usuario_unit: number;
    total_subsidio: number;
    total_inst: number;
    total_usuario: number;
}

interface EspecialRow extends SimEspecial {
    total_subsidio: number;
    total_inst: number;
    total_usuario: number;
}

// ─── Helpers de normalización ─────────────────────────────────────────────────

function normalizeDevice(d: string): string {
    const s = (d ?? "").toLowerCase();
    if (s.includes("g56") || (s.includes("motorola") && s.includes("g")))
        return "Motorola G56 5G 256GB";
    if (s.includes("a17")) return "Samsung A17 5G 256GB";
    if (s.includes("a56")) return "Samsung A56 5G 256GB";
    if (s.includes("pro max") && s.includes("512")) return "iPhone 17 Pro Max 512GB";
    if (s.includes("pro max")) return "iPhone 17 Pro Max 256GB";
    if (s.includes("iphone") && s.includes("17")) return "iPhone 17 256GB";
    if (s.includes("s26") && s.includes("ultra")) return "Samsung S26 Ultra";
    return d;
}

function extractPlan(gb: string): string {
    const s = (gb ?? "").toUpperCase();
    const m = s.match(/(\d+)\s*GB/);
    if (!m) return "sin_datos";
    const n = parseInt(m[1]);
    if (n >= 50) return "50GB";
    if (n >= 25) return "25GB";
    if (n >= 15) return "15GB";
    if (n >= 10) return "10GB";
    if (n >= 5) return "5GB";
    return "sin_datos";
}

function countLineas(lineas: LineaAltice[], equipo: string, plan: string): number {
    return lineas.filter(l => {
        if (!l.dispositivo_2026) return false;
        if (normalizeDevice(l.dispositivo_2026) !== equipo) return false;
        if (plan === "*") return true;
        return extractPlan(l.gb_solicitado) === plan;
    }).length;
}

function calcularResumen(
    reglas: SimRegla[],
    especiales: SimEspecial[],
    subsidioDisponible: number,
    lineas: LineaAltice[]
): { reglaRows: ReglaRow[]; especialRows: EspecialRow[]; totales: ResumenSnapshot } {
    const reglaRows: ReglaRow[] = reglas.map(r => {
        const cantidad_calc = r.cantidad_override ?? countLineas(lineas, r.equipo, r.plan);
        const subsidio_unit = r.precio_base * r.pct_subsidio;
        const inst_unit = r.inst_paga;
        const usuario_unit = Math.max(0, r.precio_base - subsidio_unit - inst_unit);
        return {
            ...r,
            cantidad_calc,
            subsidio_unit,
            inst_unit,
            usuario_unit,
            total_subsidio: subsidio_unit * cantidad_calc,
            total_inst: inst_unit * cantidad_calc,
            total_usuario: usuario_unit * cantidad_calc,
        };
    });

    const especialRows: EspecialRow[] = especiales.map(e => ({
        ...e,
        total_subsidio: e.subsidio_altice * e.cantidad,
        total_inst: e.inst_paga * e.cantidad,
        total_usuario: e.usuario_paga * e.cantidad,
    }));

    let totalSubsidioAltice = 0, totalInstPaga = 0, totalUsuarioPaga = 0, totalEquipos = 0;
    reglaRows.forEach(r => {
        totalSubsidioAltice += r.total_subsidio;
        totalInstPaga += r.total_inst;
        totalUsuarioPaga += r.total_usuario;
        totalEquipos += r.precio_base * r.cantidad_calc;
    });
    especialRows.forEach(e => {
        totalSubsidioAltice += e.total_subsidio;
        totalInstPaga += e.total_inst;
        totalUsuarioPaga += e.total_usuario;
        totalEquipos += e.precio_base * e.cantidad;
    });

    return {
        reglaRows,
        especialRows,
        totales: {
            totalSubsidioAltice,
            totalInstPaga,
            totalUsuarioPaga,
            totalEquipos,
            subsidio_disponible: subsidioDisponible,
            diferencia: subsidioDisponible - totalSubsidioAltice,
        },
    };
}

const PLAN_ORDER: Record<string, number> = { "50GB": 0, "25GB": 1, "15GB": 2, "10GB": 3, "5GB": 4, "*": 5 };
function planLabel(plan: string) { return plan === "*" ? "Cualquier plan" : plan; }

// ─── Componente principal ─────────────────────────────────────────────────────

export default function SimuladorTab() {
    const { lineas } = useLineas();

    const [reglas, setReglas] = useState<SimRegla[]>([]);
    const [especiales, setEspeciales] = useState<SimEspecial[]>([]);
    const [subsidioDisponible, setSubsidioDisponible] = useState(3331330);
    const [snapshots, setSnapshots] = useState<SimSnapshot[]>([]);
    const [loading, setLoading] = useState(true);

    // Inline edición regla
    const [editingReglaId, setEditingReglaId] = useState<string | null>(null);
    const [reglaEdit, setReglaEdit] = useState<Partial<SimRegla>>({});

    // Inline edición especial
    const [editingEspecialId, setEditingEspecialId] = useState<string | null>(null);
    const [especialEdit, setEspecialEdit] = useState<Partial<SimEspecial>>({});

    // Editar subsidio disponible
    const [editSubsidio, setEditSubsidio] = useState(false);
    const [subsidioEditVal, setSubsidioEditVal] = useState("");

    // Modal guardar snapshot
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [snapNombre, setSnapNombre] = useState("");
    const [snapDesc, setSnapDesc] = useState("");
    const [saving, setSaving] = useState(false);

    // Ver detalle snapshot
    const [viewingSnapshot, setViewingSnapshot] = useState<SimSnapshot | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        const [r1, r2, r3, r4] = await Promise.all([
            supabase.from("sim_reglas").select("*").order("orden"),
            supabase.from("sim_especiales").select("*").order("orden"),
            supabase.from("sim_config").select("*").eq("id", 1).single(),
            supabase.from("sim_snapshots").select("*").order("created_at", { ascending: false }).limit(20),
        ]);
        if (r1.data) setReglas(r1.data);
        if (r2.data) setEspeciales(r2.data);
        if (r3.data) setSubsidioDisponible(r3.data.subsidio_disponible);
        if (r4.data) setSnapshots(r4.data as SimSnapshot[]);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const { reglaRows, especialRows, totales } = useMemo(
        () => calcularResumen(reglas, especiales, subsidioDisponible, lineas),
        [reglas, especiales, subsidioDisponible, lineas]
    );

    // ── Guardar cambio de subsidio disponible ─────────────────────────────────
    async function saveSubsidio() {
        const v = parseFloat(subsidioEditVal.replace(/[^0-9.]/g, ""));
        if (isNaN(v) || v <= 0) { toast.error("Monto inválido"); return; }
        await supabase.from("sim_config").update({ subsidio_disponible: v }).eq("id", 1);
        setSubsidioDisponible(v);
        setEditSubsidio(false);
        toast.success("Subsidio actualizado");
    }

    // ── Edición inline — reglas ───────────────────────────────────────────────
    function startEditRegla(r: SimRegla) {
        setEditingReglaId(r.id);
        setReglaEdit({
            precio_base: r.precio_base,
            pct_subsidio: r.pct_subsidio,
            inst_paga: r.inst_paga,
            cantidad_override: r.cantidad_override,
        });
        setEditingEspecialId(null);
    }

    async function saveRegla(id: string) {
        const patch: Partial<SimRegla> = {
            precio_base: Number(reglaEdit.precio_base) || 0,
            pct_subsidio: Math.min(1, Math.max(0, Number(reglaEdit.pct_subsidio) || 0)),
            inst_paga: Number(reglaEdit.inst_paga) || 0,
            cantidad_override: reglaEdit.cantidad_override === null || reglaEdit.cantidad_override === undefined
                ? null : Number(reglaEdit.cantidad_override) || null,
        };
        const { error } = await supabase.from("sim_reglas").update(patch).eq("id", id);
        if (error) { toast.error("Error al guardar"); return; }
        setReglas(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
        setEditingReglaId(null);
        toast.success("Regla actualizada");
    }

    // ── Edición inline — especiales ───────────────────────────────────────────
    function startEditEspecial(e: SimEspecial) {
        setEditingEspecialId(e.id);
        setEspecialEdit({
            cantidad: e.cantidad,
            precio_base: e.precio_base,
            subsidio_altice: e.subsidio_altice,
            inst_paga: e.inst_paga,
            usuario_paga: e.usuario_paga,
        });
        setEditingReglaId(null);
    }

    async function saveEspecial(id: string) {
        const patch: Partial<SimEspecial> = {
            cantidad: Number(especialEdit.cantidad) || 1,
            precio_base: Number(especialEdit.precio_base) || 0,
            subsidio_altice: Number(especialEdit.subsidio_altice) || 0,
            inst_paga: Number(especialEdit.inst_paga) || 0,
            usuario_paga: Number(especialEdit.usuario_paga) || 0,
        };
        const { error } = await supabase.from("sim_especiales").update(patch).eq("id", id);
        if (error) { toast.error("Error al guardar"); return; }
        setEspeciales(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
        setEditingEspecialId(null);
        toast.success("Regla especial actualizada");
    }

    // ── Guardar snapshot ──────────────────────────────────────────────────────
    async function guardarSnapshot() {
        if (!snapNombre.trim()) { toast.error("Ingresa un nombre"); return; }
        setSaving(true);
        const { error } = await supabase.from("sim_snapshots").insert({
            nombre: snapNombre.trim(),
            descripcion: snapDesc.trim(),
            reglas_json: reglas,
            especiales_json: especiales,
            subsidio_disponible: subsidioDisponible,
            resumen_json: totales,
        });
        if (error) { toast.error("Error al guardar"); setSaving(false); return; }
        toast.success("Escenario guardado");
        setShowSaveModal(false);
        setSnapNombre("");
        setSnapDesc("");
        await load();
        setSaving(false);
    }

    // ── Restaurar snapshot ────────────────────────────────────────────────────
    async function restaurarSnapshot(snap: SimSnapshot) {
        if (!confirm(`¿Restaurar el escenario "${snap.nombre}"? Esto reemplazará las reglas actuales.`)) return;
        setSaving(true);

        // Borrar y reinsertar reglas
        await supabase.from("sim_reglas").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        await supabase.from("sim_especiales").delete().neq("id", "00000000-0000-0000-0000-000000000000");

        const reglasSinId = snap.reglas_json.map(({ id: _id, ...r }) => r);
        const especialesSinId = snap.especiales_json.map(({ id: _id, ...e }) => e);

        await supabase.from("sim_reglas").insert(reglasSinId);
        await supabase.from("sim_especiales").insert(especialesSinId);
        await supabase.from("sim_config").update({ subsidio_disponible: snap.subsidio_disponible }).eq("id", 1);

        toast.success(`Escenario "${snap.nombre}" restaurado`);
        await load();
        setSaving(false);
        setViewingSnapshot(null);
    }

    // ── Eliminar snapshot ─────────────────────────────────────────────────────
    async function eliminarSnapshot(id: string, nombre: string) {
        if (!confirm(`¿Eliminar el escenario "${nombre}"?`)) return;
        await supabase.from("sim_snapshots").delete().eq("id", id);
        setSnapshots(prev => prev.filter(s => s.id !== id));
        if (viewingSnapshot?.id === id) setViewingSnapshot(null);
        toast.success("Escenario eliminado");
    }

    // ─── Renderizado ──────────────────────────────────────────────────────────

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    const pct = Math.min(100, (totales.totalSubsidioAltice / totales.subsidio_disponible) * 100);
    const overBudget = totales.diferencia < 0;

    // Agrupar reglas por equipo
    const equipos = [...new Set(reglaRows.map(r => r.equipo))];

    return (
        <div className="space-y-6">

            {/* ── Encabezado ─────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Simulador de Subsidio</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        Modifica precios, porcentajes y cantidades — los totales se actualizan en tiempo real.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { setSnapNombre(""); setSnapDesc(""); setShowSaveModal(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        Guardar escenario
                    </button>
                </div>
            </div>

            {/* ── Cards resumen ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: "Subsidio Altice", value: totales.totalSubsidioAltice, color: "blue", icon: "📱" },
                    { label: "Total equipos", value: totales.totalEquipos, color: "slate", icon: "📦" },
                    { label: "ADOSE aporta", value: totales.totalInstPaga, color: "amber", icon: "🏢" },
                    { label: "Empleados pagan", value: totales.totalUsuarioPaga, color: "green", icon: "👤" },
                ].map(c => (
                    <div key={c.label} className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{c.label}</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{formatRD(c.value)}</p>
                    </div>
                ))}
            </div>

            {/* ── Barra de presupuesto ────────────────────────────────────── */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Subsidio disponible Altice</span>
                        {!editSubsidio ? (
                            <span
                                onClick={() => { setSubsidioEditVal(String(subsidioDisponible)); setEditSubsidio(true); }}
                                className="text-sm font-bold text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">
                                {formatRD(subsidioDisponible)}
                            </span>
                        ) : (
                            <div className="flex items-center gap-1">
                                <input
                                    autoFocus
                                    type="number"
                                    value={subsidioEditVal}
                                    onChange={e => setSubsidioEditVal(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter") saveSubsidio(); if (e.key === "Escape") setEditSubsidio(false); }}
                                    className="w-36 text-sm font-bold border border-blue-400 rounded-lg px-2 py-0.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none" />
                                <button onClick={saveSubsidio} className="text-green-600 hover:text-green-500">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                </button>
                                <button onClick={() => setEditSubsidio(false)} className="text-slate-400 hover:text-slate-600">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                            </div>
                        )}
                        <span className="text-xs text-slate-400">(haz clic para editar)</span>
                    </div>
                    <span className={`text-sm font-bold ${overBudget ? "text-rose-600" : "text-green-600"}`}>
                        {overBudget ? "−" : "+"}{formatRD(Math.abs(totales.diferencia))}
                        <span className="font-normal text-slate-400 ml-1">{overBudget ? "excede" : "disponible"}</span>
                    </span>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${overBudget ? "bg-rose-500" : pct > 85 ? "bg-amber-500" : "bg-blue-500"}`}
                        style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <div className="flex justify-between mt-1">
                    <span className="text-xs text-slate-400">{formatRD(totales.totalSubsidioAltice)} usado ({pct.toFixed(1)}%)</span>
                    <span className="text-xs text-slate-400">{formatRD(subsidioDisponible)} total</span>
                </div>
            </div>

            {/* ── Reglas estándar ─────────────────────────────────────────── */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Reglas estándar por equipo y plan</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Haz clic en una fila para editar. La cantidad se calcula desde los datos de líneas activas si no se especifica.</p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/50">
                                {["Equipo", "Plan", "Precio base", "% Subsidio", "Subsidio Altice/u.", "ADOSE/u.", "Empleado/u.", "Cantidad", "Total subsidio"].map(h => (
                                    <th key={h} className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">{h}</th>
                                ))}
                                <th className="px-3 py-2.5" />
                            </tr>
                        </thead>
                        <tbody>
                            {equipos.map(equipo => {
                                const rows = reglaRows.filter(r => r.equipo === equipo).sort((a, b) => (PLAN_ORDER[a.plan] ?? 9) - (PLAN_ORDER[b.plan] ?? 9));
                                const equipoTotal = rows.reduce((s, r) => s + r.total_subsidio, 0);
                                return [
                                    ...rows.map((r, ri) => {
                                        const isEditing = editingReglaId === r.id;
                                        return (
                                            <tr
                                                key={r.id}
                                                onClick={() => !isEditing && startEditRegla(r)}
                                                className={`border-t border-slate-100 dark:border-slate-700/50 transition-colors cursor-pointer ${isEditing ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-700/30"} ${ri === 0 ? "border-t-2 border-slate-200 dark:border-slate-600" : ""}`}>
                                                <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                                    {ri === 0 ? equipo : ""}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium text-[10px]">
                                                        {planLabel(r.plan)}
                                                    </span>
                                                </td>
                                                {isEditing ? (
                                                    <>
                                                        <td className="px-2 py-1.5">
                                                            <input type="number" value={reglaEdit.precio_base ?? ""} onChange={e => setReglaEdit(p => ({ ...p, precio_base: parseFloat(e.target.value) }))}
                                                                onClick={e => e.stopPropagation()}
                                                                className="w-24 border border-blue-400 rounded px-1.5 py-0.5 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none" />
                                                        </td>
                                                        <td className="px-2 py-1.5">
                                                            <div className="flex items-center gap-1">
                                                                <input type="number" step="0.01" min="0" max="1" value={reglaEdit.pct_subsidio ?? ""} onChange={e => setReglaEdit(p => ({ ...p, pct_subsidio: parseFloat(e.target.value) }))}
                                                                    onClick={e => e.stopPropagation()}
                                                                    className="w-16 border border-blue-400 rounded px-1.5 py-0.5 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none" />
                                                                <span className="text-slate-400">({((reglaEdit.pct_subsidio ?? 0) * 100).toFixed(0)}%)</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 text-blue-700 dark:text-blue-400 font-semibold">
                                                            {formatRD((reglaEdit.precio_base ?? 0) * (reglaEdit.pct_subsidio ?? 0))}
                                                        </td>
                                                        <td className="px-2 py-1.5">
                                                            <input type="number" value={reglaEdit.inst_paga ?? ""} onChange={e => setReglaEdit(p => ({ ...p, inst_paga: parseFloat(e.target.value) }))}
                                                                onClick={e => e.stopPropagation()}
                                                                className="w-24 border border-blue-400 rounded px-1.5 py-0.5 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none" />
                                                        </td>
                                                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                                                            {formatRD(Math.max(0, (reglaEdit.precio_base ?? 0) - (reglaEdit.precio_base ?? 0) * (reglaEdit.pct_subsidio ?? 0) - (reglaEdit.inst_paga ?? 0)))}
                                                        </td>
                                                        <td className="px-2 py-1.5">
                                                            <input type="number" placeholder="auto" value={reglaEdit.cantidad_override ?? ""} onChange={e => setReglaEdit(p => ({ ...p, cantidad_override: e.target.value === "" ? null : parseInt(e.target.value) }))}
                                                                onClick={e => e.stopPropagation()}
                                                                className="w-16 border border-blue-400 rounded px-1.5 py-0.5 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none placeholder-slate-300" />
                                                        </td>
                                                        <td className="px-3 py-2 text-blue-700 dark:text-blue-400 font-bold">—</td>
                                                        <td className="px-3 py-2">
                                                            <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                                                <button onClick={() => saveRegla(r.id)} className="text-green-600 hover:text-green-500">
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                                                </button>
                                                                <button onClick={() => setEditingReglaId(null)} className="text-slate-400 hover:text-slate-600">
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{formatRD(r.precio_base)}</td>
                                                        <td className="px-3 py-2">
                                                            <span className={`font-semibold ${r.pct_subsidio >= 1 ? "text-green-600 dark:text-green-400" : r.pct_subsidio === 0 ? "text-slate-400" : "text-amber-600 dark:text-amber-400"}`}>
                                                                {(r.pct_subsidio * 100).toFixed(0)}%
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-blue-700 dark:text-blue-400 font-semibold">{formatRD(r.subsidio_unit)}</td>
                                                        <td className="px-3 py-2 text-amber-600 dark:text-amber-400">{formatRD(r.inst_unit)}</td>
                                                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{formatRD(r.usuario_unit)}</td>
                                                        <td className="px-3 py-2">
                                                            <span className="font-semibold text-slate-700 dark:text-slate-200">{r.cantidad_calc}</span>
                                                            {r.cantidad_override !== null && (
                                                                <span className="ml-1 text-[10px] text-blue-500 font-medium">(manual)</span>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2 text-blue-700 dark:text-blue-400 font-bold">{formatRD(r.total_subsidio)}</td>
                                                        <td className="px-3 py-2">
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300">
                                                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                            </svg>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        );
                                    }),
                                    <tr key={`sub-${equipo}`} className="bg-blue-50/60 dark:bg-blue-900/10 border-t border-slate-100 dark:border-slate-700/50">
                                        <td className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 italic" colSpan={8}>Subtotal {equipo}</td>
                                        <td className="px-3 py-1.5 text-blue-700 dark:text-blue-400 font-bold text-xs">{formatRD(equipoTotal)}</td>
                                        <td />
                                    </tr>,
                                ];
                            })}
                            <tr className="bg-blue-600 text-white">
                                <td colSpan={8} className="px-3 py-2 font-bold text-sm">Total subsidio Altice — Reglas estándar</td>
                                <td className="px-3 py-2 font-bold text-sm">{formatRD(reglaRows.reduce((s, r) => s + r.total_subsidio, 0))}</td>
                                <td />
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Reglas especiales ───────────────────────────────────────── */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Reglas especiales (acuerdos particulares)</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Montos fijos acordados individualmente. Haz clic en una fila para editar.</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/50">
                                {["Descripción", "Equipo", "Cant.", "Precio base", "Subsidio Altice/u.", "ADOSE/u.", "Empleado/u.", "Total subsidio"].map(h => (
                                    <th key={h} className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">{h}</th>
                                ))}
                                <th className="px-3 py-2.5" />
                            </tr>
                        </thead>
                        <tbody>
                            {especialRows.map(e => {
                                const isEditing = editingEspecialId === e.id;
                                return (
                                    <tr
                                        key={e.id}
                                        onClick={() => !isEditing && startEditEspecial(e)}
                                        className={`border-t border-slate-100 dark:border-slate-700/50 cursor-pointer transition-colors ${isEditing ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-700/30"}`}>
                                        <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300 max-w-[220px]">
                                            <span className="block truncate" title={e.nombre}>{e.nombre}</span>
                                        </td>
                                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">{e.equipo}</td>
                                        {isEditing ? (
                                            <>
                                                <td className="px-2 py-1.5">
                                                    <input type="number" value={especialEdit.cantidad ?? ""} onChange={ev => setEspecialEdit(p => ({ ...p, cantidad: parseInt(ev.target.value) }))}
                                                        onClick={ev => ev.stopPropagation()}
                                                        className="w-14 border border-blue-400 rounded px-1.5 py-0.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none" />
                                                </td>
                                                <td className="px-2 py-1.5">
                                                    <input type="number" value={especialEdit.precio_base ?? ""} onChange={ev => setEspecialEdit(p => ({ ...p, precio_base: parseFloat(ev.target.value) }))}
                                                        onClick={ev => ev.stopPropagation()}
                                                        className="w-24 border border-blue-400 rounded px-1.5 py-0.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none" />
                                                </td>
                                                <td className="px-2 py-1.5">
                                                    <input type="number" value={especialEdit.subsidio_altice ?? ""} onChange={ev => setEspecialEdit(p => ({ ...p, subsidio_altice: parseFloat(ev.target.value) }))}
                                                        onClick={ev => ev.stopPropagation()}
                                                        className="w-24 border border-blue-400 rounded px-1.5 py-0.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none" />
                                                </td>
                                                <td className="px-2 py-1.5">
                                                    <input type="number" value={especialEdit.inst_paga ?? ""} onChange={ev => setEspecialEdit(p => ({ ...p, inst_paga: parseFloat(ev.target.value) }))}
                                                        onClick={ev => ev.stopPropagation()}
                                                        className="w-24 border border-blue-400 rounded px-1.5 py-0.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none" />
                                                </td>
                                                <td className="px-2 py-1.5">
                                                    <input type="number" value={especialEdit.usuario_paga ?? ""} onChange={ev => setEspecialEdit(p => ({ ...p, usuario_paga: parseFloat(ev.target.value) }))}
                                                        onClick={ev => ev.stopPropagation()}
                                                        className="w-24 border border-blue-400 rounded px-1.5 py-0.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none" />
                                                </td>
                                                <td className="px-3 py-2 text-blue-700 dark:text-blue-400 font-bold">
                                                    {formatRD((especialEdit.subsidio_altice ?? 0) * (especialEdit.cantidad ?? 1))}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center gap-1.5" onClick={ev => ev.stopPropagation()}>
                                                        <button onClick={() => saveEspecial(e.id)} className="text-green-600 hover:text-green-500">
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                                        </button>
                                                        <button onClick={() => setEditingEspecialId(null)} className="text-slate-400 hover:text-slate-600">
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">{e.cantidad}</td>
                                                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{formatRD(e.precio_base)}</td>
                                                <td className="px-3 py-2 text-blue-700 dark:text-blue-400 font-semibold">{formatRD(e.subsidio_altice)}</td>
                                                <td className="px-3 py-2 text-amber-600 dark:text-amber-400">{formatRD(e.inst_paga)}</td>
                                                <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{formatRD(e.usuario_paga)}</td>
                                                <td className="px-3 py-2 text-blue-700 dark:text-blue-400 font-bold">{formatRD(e.total_subsidio)}</td>
                                                <td className="px-3 py-2">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300">
                                                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                    </svg>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                            <tr className="bg-indigo-600 text-white">
                                <td colSpan={7} className="px-3 py-2 font-bold text-sm">Total subsidio Altice — Reglas especiales</td>
                                <td className="px-3 py-2 font-bold text-sm">{formatRD(especialRows.reduce((s, e) => s + e.total_subsidio, 0))}</td>
                                <td />
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Resumen total ───────────────────────────────────────────── */}
            <div className={`rounded-2xl p-5 border shadow-sm ${overBudget ? "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800" : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"}`}>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Resumen consolidado</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
                    {[
                        { label: "Total equipos", value: totales.totalEquipos },
                        { label: "Subsidio Altice", value: totales.totalSubsidioAltice },
                        { label: "Disponible Altice", value: subsidioDisponible },
                        { label: "Diferencia", value: totales.diferencia, highlight: true },
                        { label: "ADOSE aporta", value: totales.totalInstPaga },
                        { label: "Empleados pagan", value: totales.totalUsuarioPaga },
                    ].map(c => (
                        <div key={c.label} className="bg-white/70 dark:bg-slate-800/70 rounded-xl p-3">
                            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-0.5">{c.label}</p>
                            <p className={`text-sm font-bold ${c.highlight ? (overBudget ? "text-rose-600" : "text-green-600") : "text-slate-900 dark:text-white"}`}>
                                {formatRD(c.value)}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Historial de escenarios ─────────────────────────────────── */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Historial de escenarios</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{snapshots.length} escenario{snapshots.length !== 1 ? "s" : ""} guardado{snapshots.length !== 1 ? "s" : ""}. Haz clic en uno para ver el detalle o restaurarlo.</p>
                </div>
                {snapshots.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-slate-400">
                        Aún no hay escenarios guardados. Usa el botón <strong>Guardar escenario</strong> para crear el primero.
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {snapshots.map(snap => {
                            const r = snap.resumen_json;
                            const overB = r.diferencia < 0;
                            return (
                                <div key={snap.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{snap.nombre}</p>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${overB ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`}>
                                                {overB ? "Excede" : "OK"}
                                            </span>
                                        </div>
                                        {snap.descripcion && (
                                            <p className="text-xs text-slate-400 mt-0.5">{snap.descripcion}</p>
                                        )}
                                        <div className="flex flex-wrap items-center gap-3 mt-1">
                                            <span className="text-xs text-slate-500">Subsidio: <strong className="text-blue-600">{formatRD(r.totalSubsidioAltice)}</strong></span>
                                            <span className="text-xs text-slate-500">Disponible: {formatRD(r.subsidio_disponible)}</span>
                                            <span className={`text-xs font-semibold ${overB ? "text-rose-600" : "text-green-600"}`}>
                                                {overB ? "−" : "+"}{formatRD(Math.abs(r.diferencia))}
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                                {new Date(snap.created_at).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => setViewingSnapshot(viewingSnapshot?.id === snap.id ? null : snap)}
                                            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                            {viewingSnapshot?.id === snap.id ? "Ocultar" : "Ver"}
                                        </button>
                                        <button
                                            onClick={() => restaurarSnapshot(snap)}
                                            disabled={saving}
                                            className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline px-2 py-1 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-40">
                                            Restaurar
                                        </button>
                                        <button
                                            onClick={() => eliminarSnapshot(snap.id, snap.nombre)}
                                            className="text-xs font-medium text-rose-500 dark:text-rose-400 hover:underline px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors">
                                            Eliminar
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Detalle de snapshot seleccionado */}
                {viewingSnapshot && (
                    <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-5 py-4">
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3">
                            Detalle: {viewingSnapshot.nombre}
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-center">
                            {[
                                { label: "Total equipos", value: viewingSnapshot.resumen_json.totalEquipos },
                                { label: "Subsidio Altice", value: viewingSnapshot.resumen_json.totalSubsidioAltice },
                                { label: "Disponible", value: viewingSnapshot.resumen_json.subsidio_disponible },
                                { label: "Diferencia", value: viewingSnapshot.resumen_json.diferencia },
                                { label: "ADOSE aporta", value: viewingSnapshot.resumen_json.totalInstPaga },
                                { label: "Empleados pagan", value: viewingSnapshot.resumen_json.totalUsuarioPaga },
                            ].map(c => (
                                <div key={c.label} className="bg-white dark:bg-slate-800 rounded-xl p-2.5 border border-slate-200 dark:border-slate-700">
                                    <p className="text-[10px] text-slate-400 mb-0.5">{c.label}</p>
                                    <p className="text-xs font-bold text-slate-800 dark:text-white">{formatRD(c.value)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Modal guardar escenario ─────────────────────────────────── */}
            {showSaveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700">
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
                            <h2 className="text-base font-bold text-slate-900 dark:text-white">Guardar escenario</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Subsidio Altice: <strong className="text-blue-600">{formatRD(totales.totalSubsidioAltice)}</strong> · Diferencia: <strong className={overBudget ? "text-rose-600" : "text-green-600"}>{overBudget ? "−" : "+"}{formatRD(Math.abs(totales.diferencia))}</strong>
                            </p>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Nombre del escenario *</label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={snapNombre}
                                    onChange={e => setSnapNombre(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && guardarSnapshot()}
                                    placeholder="Ej. Propuesta inicial, Versión ajustada…"
                                    className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Descripción (opcional)</label>
                                <textarea
                                    value={snapDesc}
                                    onChange={e => setSnapDesc(e.target.value)}
                                    rows={2}
                                    placeholder="Notas sobre este escenario…"
                                    className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex gap-3 justify-end">
                            <button onClick={() => setShowSaveModal(false)} disabled={saving}
                                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50">
                                Cancelar
                            </button>
                            <button onClick={guardarSnapshot} disabled={saving || !snapNombre.trim()}
                                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all disabled:opacity-50 flex items-center gap-2">
                                {saving
                                    ? <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Guardando...</>
                                    : "Guardar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
