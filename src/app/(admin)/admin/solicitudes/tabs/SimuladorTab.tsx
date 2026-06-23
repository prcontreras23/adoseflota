"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase, formatRD, type LineaAltice } from "@/lib/supabase";
import { useLineas } from "@/lib/LineasContext";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SimRegla {
    id: string;
    equipo: string;
    plan: string;
    precio_base: number;
    pct_subsidio: number;
    inst_paga: number;
    descuento: number;
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
    aprobado: boolean;
    aprobado_at: string | null;
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
    cantidad_real: number;  // conteo vivo del portal, siempre
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

// ─── Constantes ───────────────────────────────────────────────────────────────

const PLANES_OPCIONES = ["*", "sin_datos", "5GB", "10GB", "15GB", "25GB", "50GB"];
const EQUIPOS_CONOCIDOS = [
    "Motorola G56 5G 256GB",
    "Samsung A17 5G 256GB",
    "Samsung A56 5G 256GB",
    "iPhone 17 256GB",
    "iPhone 17 Pro Max 256GB",
    "iPhone 17 Pro Max 512GB",
    "Samsung S26 Ultra",
];

const REGLA_NUEVA_INIT = {
    equipo: "Motorola G56 5G 256GB",
    equipoPersonalizado: "",
    plan: "*",
    precio_base: 0,
    pct_subsidio: 0,
    inst_paga: 0,
    descuento: 0,
};

const ESPECIAL_NUEVA_INIT = {
    nombre: "",
    equipo: "iPhone 17 256GB",
    equipoPersonalizado: "",
    cantidad: 1,
    precio_base: 0,
    subsidio_altice: 0,
    inst_paga: 0,
    usuario_paga: 0,
};

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
        const linePlan = extractPlan(l.gb_solicitado ?? "");
        if (plan === "*") return linePlan === "sin_datos";
        return linePlan === plan;
    }).length;
}

interface PortalGap { equipo: string; plan: string; count: number; }

function calcularResumen(
    reglas: SimRegla[],
    especiales: SimEspecial[],
    subsidioDisponible: number,
    lineas: LineaAltice[]
): { reglaRows: ReglaRow[]; especialRows: EspecialRow[]; totales: ResumenSnapshot; gaps: PortalGap[] } {
    const reglaRows: ReglaRow[] = reglas.map(r => {
        const cantidad_real = countLineas(lineas, r.equipo, r.plan);
        const cantidad_calc = r.cantidad_override ?? cantidad_real;
        const subsidio_unit = r.precio_base * r.pct_subsidio;
        const inst_unit = r.inst_paga;
        const usuario_unit = Math.max(0, r.precio_base - subsidio_unit - inst_unit - (r.descuento ?? 0));
        return {
            ...r,
            cantidad_calc,
            cantidad_real,
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

    // Detectar combinaciones dispositivo+plan del portal sin regla configurada
    const portalByDevicePlan = new Map<string, number>();
    for (const l of lineas) {
        if (!l.dispositivo_2026) continue;
        const dev = normalizeDevice(l.dispositivo_2026);
        const pl = extractPlan(l.gb_solicitado ?? "");
        const key = `${dev}|||${pl}`;
        portalByDevicePlan.set(key, (portalByDevicePlan.get(key) ?? 0) + 1);
    }
    const gaps: PortalGap[] = [];
    for (const [key, count] of portalByDevicePlan) {
        const sep = key.indexOf("|||");
        const equipo = key.slice(0, sep);
        const plan = key.slice(sep + 3);
        const covered = reglas.some(r =>
            r.equipo === equipo && (r.plan === plan || (r.plan === "*" && plan === "sin_datos"))
        );
        if (!covered) gaps.push({ equipo, plan, count });
    }

    return {
        reglaRows,
        especialRows,
        gaps,
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

const PLAN_ORDER: Record<string, number> = { "50GB": 0, "25GB": 1, "15GB": 2, "10GB": 3, "5GB": 4, "sin_datos": 5, "*": 6 };
function planLabel(plan: string) {
    if (plan === "*") return "No deseo internet";
    if (plan === "sin_datos") return "No desea internet";
    return plan;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function SimuladorTab() {
    const { lineas, patchLocal } = useLineas();

    const [reglas, setReglas] = useState<SimRegla[]>([]);
    const [especiales, setEspeciales] = useState<SimEspecial[]>([]);
    const [subsidioDisponible, setSubsidioDisponible] = useState(3331330);
    const [snapshots, setSnapshots] = useState<SimSnapshot[]>([]);
    const [loading, setLoading] = useState(true);

    // Edición inline regla
    const [editingReglaId, setEditingReglaId] = useState<string | null>(null);
    const [reglaEdit, setReglaEdit] = useState<Partial<SimRegla>>({});

    // Edición inline especial
    const [editingEspecialId, setEditingEspecialId] = useState<string | null>(null);
    const [especialEdit, setEspecialEdit] = useState<Partial<SimEspecial>>({});

    // Formulario nueva regla
    const [showNewRegla, setShowNewRegla] = useState(false);
    const [newRegla, setNewRegla] = useState(REGLA_NUEVA_INIT);
    const [savingNewRegla, setSavingNewRegla] = useState(false);

    // Formulario nueva regla especial
    const [showNewEspecial, setShowNewEspecial] = useState(false);
    const [newEspecial, setNewEspecial] = useState(ESPECIAL_NUEVA_INIT);
    const [savingNewEspecial, setSavingNewEspecial] = useState(false);

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

    // Consulta rápida por empleado
    const [consultaEquipo, setConsultaEquipo] = useState(EQUIPOS_CONOCIDOS[0]);
    const [consultaPlan, setConsultaPlan] = useState("*");

    // Resetear cantidades manuales
    const [reseteando, setReseteando] = useState(false);

    // Dispositivos desde almacén
    const [equiposAlmacen, setEquiposAlmacen] = useState<string[]>([]);

    // Aplicar precios a empleados
    const [showAplicarModal, setShowAplicarModal] = useState(false);
    const [aplicando, setAplicando] = useState(false);

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

    useEffect(() => {
        const cargarAlmacen = async () => {
            const { data } = await supabase.from("almacen_dispositivos").select("dispositivo").order("dispositivo");
            if (data && data.length > 0) {
                const nombres = data.map((d: { dispositivo: string }) => d.dispositivo);
                setEquiposAlmacen(nombres);
                setConsultaEquipo(eq => eq === EQUIPOS_CONOCIDOS[0] ? nombres[0] : eq);
                setNewRegla(r => r.equipo === EQUIPOS_CONOCIDOS[0] ? { ...r, equipo: nombres[0] } : r);
            }
        };
        cargarAlmacen();
        const ch = supabase.channel("almacen_sim_sync")
            .on("postgres_changes", { event: "*", schema: "public", table: "almacen_dispositivos" }, cargarAlmacen)
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, []);

    const { reglaRows, especialRows, totales, gaps } = useMemo(
        () => calcularResumen(reglas, especiales, subsidioDisponible, lineas),
        [reglas, especiales, subsidioDisponible, lineas]
    );

    const consultaResult = useMemo(() => {
        const regla = reglas.find(r => r.equipo === consultaEquipo && r.plan === consultaPlan)
            ?? reglas.find(r => r.equipo === consultaEquipo && r.plan === "*");
        if (!regla) return null;
        const subsidio = regla.precio_base * regla.pct_subsidio;
        const adose = regla.inst_paga;
        const empleado = Math.max(0, regla.precio_base - subsidio - adose);
        return { regla, subsidio, adose, empleado };
    }, [reglas, consultaEquipo, consultaPlan]);

    const planesDelEquipo = useMemo(() => {
        const planes = reglas.filter(r => r.equipo === consultaEquipo).map(r => r.plan);
        return PLANES_OPCIONES.filter(p => planes.includes(p));
    }, [reglas, consultaEquipo]);

    // ── Subsidio disponible ───────────────────────────────────────────────────
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
        setReglaEdit({ precio_base: r.precio_base, pct_subsidio: r.pct_subsidio, inst_paga: r.inst_paga, cantidad_override: r.cantidad_override });
        setEditingEspecialId(null);
        setShowNewRegla(false);
    }

    async function saveRegla(id: string) {
        const patch: Partial<SimRegla> = {
            precio_base: Number(reglaEdit.precio_base) || 0,
            pct_subsidio: Math.min(1, Math.max(0, Number(reglaEdit.pct_subsidio) || 0)),
            inst_paga: Number(reglaEdit.inst_paga) || 0,
            descuento: Number(reglaEdit.descuento) || 0,
            cantidad_override: (reglaEdit.cantidad_override === null || reglaEdit.cantidad_override === undefined)
                ? null : (Number(reglaEdit.cantidad_override) || null),
        };
        const { error } = await supabase.from("sim_reglas").update(patch).eq("id", id);
        if (error) { toast.error("Error al guardar"); return; }
        setReglas(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
        setEditingReglaId(null);
        toast.success("Regla actualizada");
    }

    async function deleteRegla(id: string, equipo: string, plan: string) {
        if (!confirm(`¿Eliminar la regla "${equipo} / ${planLabel(plan)}"?`)) return;
        const { error } = await supabase.from("sim_reglas").delete().eq("id", id);
        if (error) { toast.error("Error al eliminar"); return; }
        setReglas(prev => prev.filter(r => r.id !== id));
        toast.success("Regla eliminada");
    }

    // ── Agregar nueva regla ───────────────────────────────────────────────────
    async function addRegla() {
        const equipoFinal = newRegla.equipo === "otro" ? newRegla.equipoPersonalizado.trim() : newRegla.equipo;
        if (!equipoFinal) { toast.error("Ingresa el nombre del equipo"); return; }
        if (newRegla.precio_base <= 0) { toast.error("Ingresa el precio base"); return; }
        setSavingNewRegla(true);
        const maxOrden = reglas.length > 0 ? Math.max(...reglas.map(r => r.orden)) : 0;
        const { data, error } = await supabase.from("sim_reglas").insert({
            equipo: equipoFinal,
            plan: newRegla.plan,
            precio_base: Number(newRegla.precio_base),
            pct_subsidio: Math.min(1, Math.max(0, Number(newRegla.pct_subsidio))),
            inst_paga: Number(newRegla.inst_paga) || 0,
            descuento: Number(newRegla.descuento) || 0,
            cantidad_override: null,
            orden: maxOrden + 1,
        }).select().single();
        if (error || !data) { toast.error("Error al agregar"); setSavingNewRegla(false); return; }
        setReglas(prev => [...prev, data as SimRegla]);
        setNewRegla(REGLA_NUEVA_INIT);
        setShowNewRegla(false);
        setSavingNewRegla(false);
        toast.success("Regla agregada");
    }

    // ── Edición inline — especiales ───────────────────────────────────────────
    function startEditEspecial(e: SimEspecial) {
        setEditingEspecialId(e.id);
        setEspecialEdit({ cantidad: e.cantidad, precio_base: e.precio_base, subsidio_altice: e.subsidio_altice, inst_paga: e.inst_paga, usuario_paga: e.usuario_paga });
        setEditingReglaId(null);
        setShowNewEspecial(false);
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

    async function deleteEspecial(id: string, nombre: string) {
        if (!confirm(`¿Eliminar la regla especial "${nombre}"?`)) return;
        const { error } = await supabase.from("sim_especiales").delete().eq("id", id);
        if (error) { toast.error("Error al eliminar"); return; }
        setEspeciales(prev => prev.filter(e => e.id !== id));
        toast.success("Regla especial eliminada");
    }

    // ── Agregar nueva regla especial ──────────────────────────────────────────
    async function addEspecial() {
        if (!newEspecial.nombre.trim()) { toast.error("Ingresa una descripción"); return; }
        const equipoFinal = newEspecial.equipo === "otro" ? newEspecial.equipoPersonalizado.trim() : newEspecial.equipo;
        if (!equipoFinal) { toast.error("Ingresa el nombre del equipo"); return; }
        if (newEspecial.precio_base <= 0) { toast.error("Ingresa el precio base"); return; }
        setSavingNewEspecial(true);
        const maxOrden = especiales.length > 0 ? Math.max(...especiales.map(e => e.orden)) : 0;
        const { data, error } = await supabase.from("sim_especiales").insert({
            nombre: newEspecial.nombre.trim(),
            equipo: equipoFinal,
            cantidad: Number(newEspecial.cantidad) || 1,
            precio_base: Number(newEspecial.precio_base),
            subsidio_altice: Number(newEspecial.subsidio_altice) || 0,
            inst_paga: Number(newEspecial.inst_paga) || 0,
            usuario_paga: Number(newEspecial.usuario_paga) || 0,
            orden: maxOrden + 1,
        }).select().single();
        if (error || !data) { toast.error("Error al agregar"); setSavingNewEspecial(false); return; }
        setEspeciales(prev => [...prev, data as SimEspecial]);
        setNewEspecial(ESPECIAL_NUEVA_INIT);
        setShowNewEspecial(false);
        setSavingNewEspecial(false);
        toast.success("Regla especial agregada");
    }

    // ── Usar datos reales de lineas_altice ────────────────────────────────────
    async function usarDatosReales() {
        const conOverride = reglas.filter(r => r.cantidad_override !== null);
        if (conOverride.length === 0) {
            toast("Ya estás usando los datos reales de los empleados.", { icon: "ℹ️" });
            return;
        }
        if (!confirm(`Esto eliminará los ${conOverride.length} valor(es) manuales de cantidad y usará los datos reales de los empleados. ¿Continuar?`)) return;
        setReseteando(true);
        await Promise.all(
            conOverride.map(r =>
                supabase.from("sim_reglas").update({ cantidad_override: null }).eq("id", r.id)
            )
        );
        setReglas(prev => prev.map(r => ({ ...r, cantidad_override: null })));
        setReseteando(false);
        toast.success("Cantidades actualizadas con los datos reales de los empleados");
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
        setSnapNombre(""); setSnapDesc("");
        await load();
        setSaving(false);
    }

    // ── Restaurar snapshot ────────────────────────────────────────────────────
    async function restaurarSnapshot(snap: SimSnapshot) {
        if (!confirm(`¿Restaurar el escenario "${snap.nombre}"? Esto reemplazará las reglas actuales.`)) return;
        setSaving(true);
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

    async function eliminarSnapshot(id: string, nombre: string) {
        if (!confirm(`¿Eliminar el escenario "${nombre}"?`)) return;
        await supabase.from("sim_snapshots").delete().eq("id", id);
        setSnapshots(prev => prev.filter(s => s.id !== id));
        if (viewingSnapshot?.id === id) setViewingSnapshot(null);
        toast.success("Escenario eliminado");
    }

    // ─── Aplicar precios a empleados ─────────────────────────────────────────
    async function aplicarPrecios() {
        setAplicando(true);
        let count = 0;
        const actualizaciones: { id: string; monto: string }[] = [];

        for (const regla of reglaRows) {
            const matching = lineas.filter(l => {
                if (!l.dispositivo_2026) return false;
                if (normalizeDevice(l.dispositivo_2026) !== regla.equipo) return false;
                const lPlan = extractPlan(l.gb_solicitado ?? "");
                return regla.plan === "*" ? lPlan === "sin_datos" : lPlan === regla.plan;
            });
            if (!matching.length) continue;
            const monto = regla.usuario_unit.toFixed(2);
            const ids = matching.map(l => l.id);
            const { error } = await supabase.from("lineas_altice").update({ monto_mensual: monto }).in("id", ids);
            if (!error) {
                count += ids.length;
                ids.forEach(id => actualizaciones.push({ id, monto }));
            }
        }

        patchLocal(prev => prev.map(l => {
            const u = actualizaciones.find(a => a.id === l.id);
            return u ? { ...l, monto_mensual: u.monto } : l;
        }));

        setAplicando(false);
        setShowAplicarModal(false);
        toast.success(`Precios asignados a ${count} empleado${count !== 1 ? "s" : ""}`);
    }

    // ─── Aprobar escenario ────────────────────────────────────────────────────
    async function aprobarSnapshot(snap: SimSnapshot) {
        const now = new Date().toISOString();
        await supabase.from("sim_snapshots").update({ aprobado: false, aprobado_at: null }).neq("id", "00000000-0000-0000-0000-000000000000");
        const { error } = await supabase.from("sim_snapshots").update({ aprobado: true, aprobado_at: now }).eq("id", snap.id);
        if (error) { toast.error("Error al aprobar"); return; }
        setSnapshots(prev => prev.map(s => ({
            ...s,
            aprobado: s.id === snap.id,
            aprobado_at: s.id === snap.id ? now : null,
        })));
        toast.success(`"${snap.nombre}" marcado como escenario aprobado`);
    }

    // ─── Exportar Excel ──────────────────────────────────────────────────────
    function exportarExcel() {
        const wb = XLSX.utils.book_new();

        // Hoja 1 — Reglas estándar
        const std = [
            ["Equipo", "Plan", "Precio base", "% Subsidio", "Altice cubre", "ADOSE aporta", "1 empleado paga", "Cantidad config.", "Cantidad portal", "Total subsidio", "Total empleados"],
            ...reglaRows.map(r => [
                r.equipo,
                planLabel(r.plan),
                r.precio_base,
                (r.pct_subsidio * 100).toFixed(0) + "%",
                r.subsidio_unit,
                r.inst_unit,
                r.usuario_unit,
                r.cantidad_calc,
                r.cantidad_real,
                r.total_subsidio,
                r.total_usuario,
            ]),
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(std), "Reglas estándar");

        // Hoja 2 — Reglas especiales
        const esp = [
            ["Descripción", "Equipo", "Cantidad", "Precio base", "Altice cubre", "ADOSE aporta", "1 empleado paga", "Total subsidio", "Total empleados"],
            ...especialRows.map(e => [
                e.nombre,
                e.equipo ?? "",
                e.cantidad,
                e.precio_base,
                e.subsidio_altice,
                e.inst_paga,
                e.usuario_paga,
                e.total_subsidio,
                e.total_usuario,
            ]),
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(esp), "Reglas especiales");

        // Hoja 3 — Resumen
        const res = [
            ["Concepto", "Monto (RD$)"],
            ["Total equipos", totales.totalEquipos],
            ["Subsidio Altice", totales.totalSubsidioAltice],
            ["Aporte ADOSE", totales.totalInstPaga],
            ["Total empleados", totales.totalUsuarioPaga],
            ["Subsidio disponible", totales.subsidio_disponible],
            ["Diferencia", totales.diferencia],
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(res), "Resumen");

        const fecha = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `Simulador ADOSE ${fecha}.xlsx`);
        toast.success("Excel exportado");
    }

    // ─── Renderizado ──────────────────────────────────────────────────────────

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    const pct = Math.min(100, (totales.totalSubsidioAltice / totales.subsidio_disponible) * 100);
    const equiposOpciones = equiposAlmacen.length > 0 ? equiposAlmacen : EQUIPOS_CONOCIDOS;
    const overBudget = totales.diferencia < 0;
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
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => setShowAplicarModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                        Aplicar precios
                    </button>
                    <button
                        onClick={exportarExcel}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                        Exportar Excel
                    </button>
                    <button
                        onClick={() => { setSnapNombre(""); setSnapDesc(""); setShowSaveModal(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        Guardar escenario
                    </button>
                </div>
            </div>

            {/* ── Consulta rápida por empleado ───────────────────────────── */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-blue-200/60 dark:border-blue-800/60">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        "Mira, tú vas a pagar…" — Consulta por empleado
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Selecciona el equipo y plan del empleado para ver exactamente cuánto le corresponde pagar.</p>
                </div>
                <div className="px-5 py-4">
                    <div className="flex flex-wrap gap-3 mb-4">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">Equipo</label>
                            <select value={consultaEquipo}
                                onChange={e => { setConsultaEquipo(e.target.value); setConsultaPlan("*"); }}
                                className="w-full border border-blue-200 dark:border-blue-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm">
                                {equiposOpciones.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                            </select>
                        </div>
                        <div className="w-40">
                            <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">Plan de datos</label>
                            <select value={consultaPlan} onChange={e => setConsultaPlan(e.target.value)}
                                className="w-full border border-blue-200 dark:border-blue-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm">
                                {planesDelEquipo.length > 0
                                    ? planesDelEquipo.map(p => <option key={p} value={p}>{planLabel(p)}</option>)
                                    : <option value="*">Cualquier plan</option>}
                            </select>
                        </div>
                    </div>

                    {consultaResult ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-white dark:bg-slate-800 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700">
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Precio del equipo</p>
                                <p className="text-base font-bold text-slate-700 dark:text-slate-200">{formatRD(consultaResult.regla.precio_base)}</p>
                            </div>
                            <div className="bg-white dark:bg-slate-800 rounded-xl p-3.5 border border-blue-200 dark:border-blue-700">
                                <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide mb-1">Altice cubre</p>
                                <p className="text-base font-bold text-blue-700 dark:text-blue-400">{formatRD(consultaResult.subsidio)}</p>
                                <p className="text-[10px] text-blue-400 mt-0.5">{(consultaResult.regla.pct_subsidio * 100).toFixed(0)}% del precio</p>
                            </div>
                            <div className="bg-white dark:bg-slate-800 rounded-xl p-3.5 border border-amber-200 dark:border-amber-700">
                                <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide mb-1">ADOSE aporta</p>
                                <p className="text-base font-bold text-amber-600 dark:text-amber-400">{formatRD(consultaResult.adose)}</p>
                            </div>
                            <div className={`rounded-xl p-3.5 border-2 ${consultaResult.empleado > 0 ? "bg-rose-50 dark:bg-rose-900/20 border-rose-300 dark:border-rose-700" : "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700"}`}>
                                <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${consultaResult.empleado > 0 ? "text-rose-500" : "text-green-600"}`}>El empleado paga</p>
                                <p className={`text-xl font-black ${consultaResult.empleado > 0 ? "text-rose-600 dark:text-rose-400" : "text-green-600 dark:text-green-400"}`}>
                                    {consultaResult.empleado > 0 ? formatRD(consultaResult.empleado) : "¡Gratis!"}
                                </p>
                                {consultaResult.empleado > 0 && (
                                    <p className="text-[10px] text-rose-400 mt-0.5">{((consultaResult.empleado / consultaResult.regla.precio_base) * 100).toFixed(0)}% del precio</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-4 text-sm text-slate-400">
                            No hay regla configurada para <strong className="text-slate-600 dark:text-slate-300">{consultaEquipo}</strong> con plan <strong className="text-slate-600 dark:text-slate-300">{consultaPlan === "*" ? "cualquier plan" : consultaPlan}</strong>.
                        </div>
                    )}
                </div>
            </div>

            {/* ── Cards resumen ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: "Subsidio Altice", value: totales.totalSubsidioAltice },
                    { label: "Total equipos", value: totales.totalEquipos },
                    { label: "ADOSE aporta", value: totales.totalInstPaga },
                    { label: "Empleados pagan", value: totales.totalUsuarioPaga },
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
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Subsidio disponible Altice</span>
                        {!editSubsidio ? (
                            <span onClick={() => { setSubsidioEditVal(String(subsidioDisponible)); setEditSubsidio(true); }}
                                className="text-sm font-bold text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">
                                {formatRD(subsidioDisponible)}
                            </span>
                        ) : (
                            <div className="flex items-center gap-1">
                                <input autoFocus type="number" value={subsidioEditVal} onChange={e => setSubsidioEditVal(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter") saveSubsidio(); if (e.key === "Escape") setEditSubsidio(false); }}
                                    className="w-36 text-sm font-bold border border-blue-400 rounded-lg px-2 py-0.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none" />
                                <button onClick={saveSubsidio} className="text-green-600 hover:text-green-500"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>
                                <button onClick={() => setEditSubsidio(false)} className="text-slate-400 hover:text-slate-600"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                            </div>
                        )}
                        <span className="text-xs text-slate-400">(clic para editar)</span>
                    </div>
                    <span className={`text-sm font-bold ${overBudget ? "text-rose-600" : "text-green-600"}`}>
                        {overBudget ? "−" : "+"}{formatRD(Math.abs(totales.diferencia))}
                        <span className="font-normal text-slate-400 ml-1">{overBudget ? "excede" : "sobrante"}</span>
                    </span>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${overBudget ? "bg-rose-500" : pct > 85 ? "bg-amber-500" : "bg-blue-500"}`}
                        style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <div className="flex justify-between mt-1">
                    <span className="text-xs text-slate-400">{formatRD(totales.totalSubsidioAltice)} usado ({pct.toFixed(1)}%)</span>
                    <span className="text-xs text-slate-400">{formatRD(subsidioDisponible)} total</span>
                </div>
            </div>

            {/* ── Reglas estándar ─────────────────────────────────────────── */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                            Reglas estándar por equipo y plan
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[11px] font-semibold">
                                {reglaRows.reduce((s, r) => s + r.cantidad_calc, 0)} dispositivos
                            </span>
                            {gaps.length > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[11px] font-semibold">
                                    ⚠ {gaps.reduce((s, g) => s + g.count, 0)} sin regla
                                </span>
                            )}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Usa el botón <strong>Editar</strong> en cada fila para modificar precio, porcentaje o cantidad.
                            {reglas.some(r => r.cantidad_override !== null) && (
                                <span className="ml-2 inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                    {reglas.filter(r => r.cantidad_override !== null).length} cantidad(s) manual(es)
                                </span>
                            )}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={usarDatosReales} disabled={reseteando}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50">
                            {reseteando
                                ? <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>}
                            Usar datos reales
                        </button>
                        <button onClick={() => { setShowNewRegla(v => !v); setEditingReglaId(null); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${showNewRegla ? "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200" : "bg-blue-600 hover:bg-blue-500 text-white"}`}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            {showNewRegla ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></> : <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>}
                        </svg>
                        {showNewRegla ? "Cancelar" : "Agregar regla"}
                        </button>
                    </div>
                </div>

                {/* Formulario nueva regla */}
                {showNewRegla && (
                    <div className="px-5 py-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
                        <p className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-3">Nueva regla estándar</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Equipo</label>
                                <select value={newRegla.equipo} onChange={e => setNewRegla(p => ({ ...p, equipo: e.target.value }))}
                                    className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    {equiposOpciones.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                                    <option value="otro">Otro (escribir)...</option>
                                </select>
                                {newRegla.equipo === "otro" && (
                                    <input type="text" placeholder="Nombre del equipo" value={newRegla.equipoPersonalizado}
                                        onChange={e => setNewRegla(p => ({ ...p, equipoPersonalizado: e.target.value }))}
                                        className="mt-1 w-full border border-blue-400 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none" />
                                )}
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Plan de datos</label>
                                <select value={newRegla.plan} onChange={e => setNewRegla(p => ({ ...p, plan: e.target.value }))}
                                    className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    {PLANES_OPCIONES.map(pl => <option key={pl} value={pl}>{pl === "*" ? "* Cualquier plan" : planLabel(pl)}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Precio base (RD$)</label>
                                <input type="number" placeholder="0" value={newRegla.precio_base || ""}
                                    onChange={e => setNewRegla(p => ({ ...p, precio_base: parseFloat(e.target.value) || 0 }))}
                                    className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">% Subsidio Altice (0–1)</label>
                                <input type="number" placeholder="0.00" step="0.01" min="0" max="1" value={newRegla.pct_subsidio || ""}
                                    onChange={e => setNewRegla(p => ({ ...p, pct_subsidio: parseFloat(e.target.value) || 0 }))}
                                    className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <p className="text-[10px] text-blue-600 mt-0.5">{((newRegla.pct_subsidio || 0) * 100).toFixed(0)}% = {formatRD((newRegla.precio_base || 0) * (newRegla.pct_subsidio || 0))}</p>
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">ADOSE aporta (RD$)</label>
                                <input type="number" placeholder="0" value={newRegla.inst_paga || ""}
                                    onChange={e => setNewRegla(p => ({ ...p, inst_paga: parseFloat(e.target.value) || 0 }))}
                                    className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Descuento empleado (RD$)</label>
                                <input type="number" placeholder="0" value={newRegla.descuento || ""}
                                    onChange={e => setNewRegla(p => ({ ...p, descuento: parseFloat(e.target.value) || 0 }))}
                                    className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
                            </div>
                            <div className="flex items-end">
                                <button onClick={addRegla} disabled={savingNewRegla}
                                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50">
                                    {savingNewRegla ? <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                                    Guardar regla
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/50">
                                {["Equipo", "Plan", "Precio base", "% Subsidio", "Altice cubre", "ADOSE aporta", "1 empleado paga", "Cantidad", "Total subsidio", "Total empleados", ""].map(h => (
                                    <th key={h} className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {equipos.map(equipo => {
                                const rows = reglaRows.filter(r => r.equipo === equipo).sort((a, b) => (PLAN_ORDER[a.plan] ?? 9) - (PLAN_ORDER[b.plan] ?? 9));
                                const equipoTotal = rows.reduce((s, r) => s + r.total_subsidio, 0);
                                const equipoTotalUsuario = rows.reduce((s, r) => s + r.total_usuario, 0);
                                const equipoTotalCantidad = rows.reduce((s, r) => s + r.cantidad_calc, 0);
                                return [
                                    ...rows.map((r, ri) => {
                                        const isEditing = editingReglaId === r.id;
                                        return (
                                            <tr key={r.id}
                                                onClick={() => !isEditing && startEditRegla(r)}
                                                className={`border-t border-slate-100 dark:border-slate-700/50 cursor-pointer transition-colors ${isEditing ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-700/30"} ${ri === 0 ? "border-t-2 border-slate-200 dark:border-slate-600" : ""}`}>
                                                <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">{ri === 0 ? equipo : ""}</td>
                                                <td className="px-3 py-2">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium text-[10px]">{planLabel(r.plan)}</span>
                                                </td>
                                                {isEditing ? (
                                                    <>
                                                        <td className="px-2 py-1.5"><input type="number" value={reglaEdit.precio_base ?? ""} onChange={e => setReglaEdit(p => ({ ...p, precio_base: parseFloat(e.target.value) }))} onClick={e => e.stopPropagation()} className="w-24 border border-blue-400 rounded px-1.5 py-0.5 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none" /></td>
                                                        <td className="px-2 py-1.5">
                                                            <div className="flex items-center gap-1">
                                                                <input type="number" step="0.01" min="0" max="1" value={reglaEdit.pct_subsidio ?? ""} onChange={e => setReglaEdit(p => ({ ...p, pct_subsidio: parseFloat(e.target.value) }))} onClick={e => e.stopPropagation()} className="w-16 border border-blue-400 rounded px-1.5 py-0.5 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none" />
                                                                <span className="text-slate-400">{((reglaEdit.pct_subsidio ?? 0) * 100).toFixed(0)}%</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 text-blue-700 dark:text-blue-400 font-semibold">{formatRD((reglaEdit.precio_base ?? 0) * (reglaEdit.pct_subsidio ?? 0))}</td>
                                                        <td className="px-2 py-1.5"><input type="number" value={reglaEdit.inst_paga ?? ""} onChange={e => setReglaEdit(p => ({ ...p, inst_paga: parseFloat(e.target.value) }))} onClick={e => e.stopPropagation()} className="w-24 border border-blue-400 rounded px-1.5 py-0.5 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none" /></td>
                                                        <td className="px-2 py-1.5">
                                                            <div className="flex flex-col gap-1" onClick={e => e.stopPropagation()}>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-[10px] text-slate-400 shrink-0">Dto:</span>
                                                                    <input type="number" placeholder="0" value={reglaEdit.descuento ?? ""} onChange={e => setReglaEdit(p => ({ ...p, descuento: parseFloat(e.target.value) || 0 }))} className="w-16 border border-purple-400 rounded px-1.5 py-0.5 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none" />
                                                                </div>
                                                                <span className="text-[10px] text-slate-500">{formatRD(Math.max(0, (reglaEdit.precio_base ?? 0) - (reglaEdit.precio_base ?? 0) * (reglaEdit.pct_subsidio ?? 0) - (reglaEdit.inst_paga ?? 0) - (reglaEdit.descuento ?? 0)))}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-1.5"><input type="number" placeholder="auto" value={reglaEdit.cantidad_override ?? ""} onChange={e => setReglaEdit(p => ({ ...p, cantidad_override: e.target.value === "" ? null : parseInt(e.target.value) }))} onClick={e => e.stopPropagation()} className="w-16 border border-blue-400 rounded px-1.5 py-0.5 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none placeholder-slate-300" /></td>
                                                        <td className="px-3 py-2 text-blue-700 dark:text-blue-400 font-bold">—</td>
                                                        <td className="px-3 py-2 text-slate-400">—</td>
                                                        <td className="px-3 py-2">
                                                            <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                                                <button onClick={() => saveRegla(r.id)} className="text-green-600 hover:text-green-500"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>
                                                                <button onClick={() => setEditingReglaId(null)} className="text-slate-400 hover:text-slate-600"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                                                                <button onClick={() => deleteRegla(r.id, r.equipo, r.plan)} className="text-rose-400 hover:text-rose-600"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
                                                            </div>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{formatRD(r.precio_base)}</td>
                                                        <td className="px-3 py-2">
                                                            <span className={`font-semibold ${r.pct_subsidio >= 1 ? "text-green-600 dark:text-green-400" : r.pct_subsidio === 0 ? "text-slate-400" : "text-amber-600 dark:text-amber-400"}`}>{(r.pct_subsidio * 100).toFixed(0)}%</span>
                                                        </td>
                                                        <td className="px-3 py-2 text-blue-700 dark:text-blue-400 font-semibold">{formatRD(r.subsidio_unit)}</td>
                                                        <td className="px-3 py-2 text-amber-600 dark:text-amber-400">{formatRD(r.inst_unit)}</td>
                                                        <td className="px-3 py-2">
                                                            <span className="text-slate-500 dark:text-slate-400">{formatRD(r.usuario_unit)}</span>
                                                            {(r.descuento ?? 0) > 0 && (
                                                                <span className="ml-1 text-[10px] text-purple-600 dark:text-purple-400 font-semibold">−{formatRD(r.descuento)}</span>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className={`font-bold ${r.cantidad_override !== null && r.cantidad_override > r.cantidad_real ? "text-rose-600 dark:text-rose-400" : r.cantidad_override !== null && r.cantidad_override < r.cantidad_real ? "text-amber-600 dark:text-amber-400" : "text-slate-700 dark:text-slate-200"}`}>
                                                                    {r.cantidad_calc}
                                                                    {r.cantidad_override !== null && r.cantidad_override > r.cantidad_real && (
                                                                        <span className="ml-1 text-[10px]">▲+{r.cantidad_override - r.cantidad_real}</span>
                                                                    )}
                                                                    {r.cantidad_override !== null && r.cantidad_override < r.cantidad_real && (
                                                                        <span className="ml-1 text-[10px]">▼{r.cantidad_override - r.cantidad_real}</span>
                                                                    )}
                                                                </span>
                                                                {r.cantidad_override !== null && r.cantidad_override !== r.cantidad_real && (
                                                                    <span className="text-[10px] text-slate-400">portal: {r.cantidad_real}</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 text-blue-700 dark:text-blue-400 font-bold">{formatRD(r.total_subsidio)}</td>
                                                                        <td className="px-3 py-2 font-semibold text-rose-600 dark:text-rose-400">{r.total_usuario > 0 ? formatRD(r.total_usuario) : <span className="text-slate-300">—</span>}</td>
                                                        <td className="px-3 py-2">
                                                            <button onClick={e => { e.stopPropagation(); startEditRegla(r); }}
                                                                className="px-2.5 py-1 text-[11px] font-semibold text-blue-600 hover:text-white hover:bg-blue-600 rounded-lg border border-blue-200 dark:border-blue-700 dark:text-blue-400 dark:hover:text-white dark:hover:bg-blue-600 transition-colors whitespace-nowrap">
                                                                Editar
                                                            </button>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        );
                                    }),
                                    <tr key={`sub-${equipo}`} className="bg-blue-50/60 dark:bg-blue-900/10 border-t border-slate-100 dark:border-slate-700/50">
                                        <td className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 italic" colSpan={7}>Subtotal {equipo}</td>
                                        <td className="px-3 py-1.5 font-bold text-xs text-slate-700 dark:text-slate-200">{equipoTotalCantidad}</td>
                                        <td className="px-3 py-1.5 text-blue-700 dark:text-blue-400 font-bold text-xs">{formatRD(equipoTotal)}</td>
                                        <td className="px-3 py-1.5 text-rose-600 dark:text-rose-400 font-bold text-xs">{equipoTotalUsuario > 0 ? formatRD(equipoTotalUsuario) : "—"}</td>
                                        <td />
                                    </tr>,
                                ];
                            })}
                            {(() => {
                                const totalConfig = reglaRows.reduce((s, r) => s + r.cantidad_calc, 0);
                                const totalReal   = reglaRows.reduce((s, r) => s + r.cantidad_real, 0);
                                const diff = totalConfig - totalReal;
                                return (
                                    <tr className="bg-slate-100 dark:bg-slate-700/50 border-t-2 border-slate-300 dark:border-slate-600">
                                        <td colSpan={6} className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                            Dispositivos totales
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="flex flex-col gap-0.5">
                                                <span className={`font-bold text-sm ${diff > 0 ? "text-rose-600 dark:text-rose-400" : diff < 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>
                                                    {totalConfig} configurados
                                                    {diff !== 0 && <span className="ml-1 text-xs">({diff > 0 ? "+" : ""}{diff} vs portal)</span>}
                                                </span>
                                                <span className="text-[11px] text-slate-500 dark:text-slate-400">{totalReal} en portal</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2">
                                            {diff > 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-[10px] font-bold">+{diff} extra</span>}
                                            {diff < 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold">{diff} faltan</span>}
                                            {diff === 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold">✓ exacto</span>}
                                        </td>
                                        <td colSpan={2} />
                                    </tr>
                                );
                            })()}
                            {gaps.length > 0 && gaps.map(g => (
                                <tr key={`gap-${g.equipo}-${g.plan}`} className="bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800/40">
                                    <td className="px-3 py-2 text-amber-700 dark:text-amber-400 font-semibold text-xs whitespace-nowrap">
                                        <span className="mr-1.5">⚠</span>{g.equipo}
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-800/50 text-amber-800 dark:text-amber-300 font-medium text-[10px]">
                                            {g.plan === "sin_datos" ? "Sin internet" : g.plan}
                                        </span>
                                    </td>
                                    <td colSpan={5} className="px-3 py-2 text-amber-600 dark:text-amber-400 text-xs italic">sin regla configurada</td>
                                    <td className="px-3 py-2 font-bold text-amber-700 dark:text-amber-400 text-xs">{g.count}</td>
                                    <td colSpan={3} className="px-3 py-2 text-amber-500 text-[10px]">— agrega una regla para cubrir estos {g.count} empleado{g.count !== 1 ? "s" : ""}</td>
                                </tr>
                            ))}
                            <tr className="bg-blue-600 text-white">
                                <td colSpan={8} className="px-3 py-2 font-bold text-sm">Total — Reglas estándar</td>
                                <td className="px-3 py-2 font-bold text-sm">{formatRD(reglaRows.reduce((s, r) => s + r.total_subsidio, 0))}</td>
                                <td className="px-3 py-2 font-bold text-sm">{formatRD(reglaRows.reduce((s, r) => s + r.total_usuario, 0))}</td>
                                <td />
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Reglas especiales ───────────────────────────────────────── */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            Reglas especiales (acuerdos particulares)
                            <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold">
                                {especialRows.reduce((s, e) => s + e.cantidad, 0)} dispositivos
                            </span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">Montos fijos acordados individualmente. Usa el botón <strong>Editar</strong> en cada fila.</p>
                    </div>
                    <button onClick={() => { setShowNewEspecial(v => !v); setEditingEspecialId(null); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${showNewEspecial ? "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200" : "bg-indigo-600 hover:bg-indigo-500 text-white"}`}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            {showNewEspecial ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></> : <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>}
                        </svg>
                        {showNewEspecial ? "Cancelar" : "Agregar especial"}
                    </button>
                </div>

                {/* Formulario nueva regla especial */}
                {showNewEspecial && (
                    <div className="px-5 py-4 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800">
                        <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-3">Nueva regla especial (monto fijo)</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Descripción *</label>
                                <input type="text" placeholder="Ej. iPhone Pro Max — Director regional" value={newEspecial.nombre}
                                    onChange={e => setNewEspecial(p => ({ ...p, nombre: e.target.value }))}
                                    className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Equipo</label>
                                <select value={newEspecial.equipo} onChange={e => setNewEspecial(p => ({ ...p, equipo: e.target.value }))}
                                    className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                    {equiposOpciones.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                                    <option value="otro">Otro (escribir)...</option>
                                </select>
                                {newEspecial.equipo === "otro" && (
                                    <input type="text" placeholder="Nombre del equipo" value={newEspecial.equipoPersonalizado}
                                        onChange={e => setNewEspecial(p => ({ ...p, equipoPersonalizado: e.target.value }))}
                                        className="mt-1 w-full border border-indigo-400 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none" />
                                )}
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Cantidad</label>
                                <input type="number" min="1" value={newEspecial.cantidad}
                                    onChange={e => setNewEspecial(p => ({ ...p, cantidad: parseInt(e.target.value) || 1 }))}
                                    className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { key: "precio_base", label: "Precio base (RD$)", placeholder: "0" },
                                { key: "subsidio_altice", label: "Subsidio Altice (RD$)", placeholder: "0" },
                                { key: "inst_paga", label: "ADOSE aporta (RD$)", placeholder: "0" },
                                { key: "usuario_paga", label: "Empleado paga (RD$)", placeholder: "0" },
                            ].map(f => (
                                <div key={f.key}>
                                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">{f.label}</label>
                                    <input type="number" placeholder={f.placeholder}
                                        value={(newEspecial as Record<string, number | string>)[f.key] || ""}
                                        onChange={e => setNewEspecial(p => ({ ...p, [f.key]: parseFloat(e.target.value) || 0 }))}
                                        className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                            <p className="text-xs text-indigo-600 dark:text-indigo-400">
                                Total subsidio: <strong>{formatRD((newEspecial.subsidio_altice || 0) * (newEspecial.cantidad || 1))}</strong>
                                {" · "}Total ADOSE: <strong>{formatRD((newEspecial.inst_paga || 0) * (newEspecial.cantidad || 1))}</strong>
                            </p>
                            <button onClick={addEspecial} disabled={savingNewEspecial}
                                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50">
                                {savingNewEspecial ? <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : null}
                                Guardar regla especial
                            </button>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/50">
                                {["Descripción", "Equipo", "Cant.", "Precio base", "Altice cubre", "ADOSE aporta", "1 empleado paga", "Total subsidio", "Total empleados", ""].map(h => (
                                    <th key={h} className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {especialRows.map(e => {
                                const isEditing = editingEspecialId === e.id;
                                return (
                                    <tr key={e.id} onClick={() => !isEditing && startEditEspecial(e)}
                                        className={`border-t border-slate-100 dark:border-slate-700/50 cursor-pointer transition-colors ${isEditing ? "bg-indigo-50 dark:bg-indigo-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-700/30"}`}>
                                        <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300 max-w-[220px]"><span className="block truncate" title={e.nombre}>{e.nombre}</span></td>
                                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">{e.equipo}</td>
                                        {isEditing ? (
                                            <>
                                                <td className="px-2 py-1.5"><input type="number" value={especialEdit.cantidad ?? ""} onChange={ev => setEspecialEdit(p => ({ ...p, cantidad: parseInt(ev.target.value) }))} onClick={ev => ev.stopPropagation()} className="w-14 border border-indigo-400 rounded px-1.5 py-0.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none" /></td>
                                                <td className="px-2 py-1.5"><input type="number" value={especialEdit.precio_base ?? ""} onChange={ev => setEspecialEdit(p => ({ ...p, precio_base: parseFloat(ev.target.value) }))} onClick={ev => ev.stopPropagation()} className="w-24 border border-indigo-400 rounded px-1.5 py-0.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none" /></td>
                                                <td className="px-2 py-1.5"><input type="number" value={especialEdit.subsidio_altice ?? ""} onChange={ev => setEspecialEdit(p => ({ ...p, subsidio_altice: parseFloat(ev.target.value) }))} onClick={ev => ev.stopPropagation()} className="w-24 border border-indigo-400 rounded px-1.5 py-0.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none" /></td>
                                                <td className="px-2 py-1.5"><input type="number" value={especialEdit.inst_paga ?? ""} onChange={ev => setEspecialEdit(p => ({ ...p, inst_paga: parseFloat(ev.target.value) }))} onClick={ev => ev.stopPropagation()} className="w-24 border border-indigo-400 rounded px-1.5 py-0.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none" /></td>
                                                <td className="px-2 py-1.5"><input type="number" value={especialEdit.usuario_paga ?? ""} onChange={ev => setEspecialEdit(p => ({ ...p, usuario_paga: parseFloat(ev.target.value) }))} onClick={ev => ev.stopPropagation()} className="w-24 border border-indigo-400 rounded px-1.5 py-0.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none" /></td>
                                                <td className="px-3 py-2 text-indigo-700 dark:text-indigo-400 font-bold">{formatRD((especialEdit.subsidio_altice ?? 0) * (especialEdit.cantidad ?? 1))}</td>
                                                <td className="px-3 py-2 text-slate-400">—</td>
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center gap-1.5" onClick={ev => ev.stopPropagation()}>
                                                        <button onClick={() => saveEspecial(e.id)} className="text-green-600 hover:text-green-500"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>
                                                        <button onClick={() => setEditingEspecialId(null)} className="text-slate-400 hover:text-slate-600"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                                                        <button onClick={() => deleteEspecial(e.id, e.nombre)} className="text-rose-400 hover:text-rose-600"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
                                                    </div>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">{e.cantidad}</td>
                                                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{formatRD(e.precio_base)}</td>
                                                <td className="px-3 py-2 text-indigo-700 dark:text-indigo-400 font-semibold">{formatRD(e.subsidio_altice)}</td>
                                                <td className="px-3 py-2 text-amber-600 dark:text-amber-400">{formatRD(e.inst_paga)}</td>
                                                <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{formatRD(e.usuario_paga)}</td>
                                                <td className="px-3 py-2 text-indigo-700 dark:text-indigo-400 font-bold">{formatRD(e.total_subsidio)}</td>
                                                <td className="px-3 py-2 font-semibold text-rose-600 dark:text-rose-400">{e.total_usuario > 0 ? formatRD(e.total_usuario) : <span className="text-slate-300">—</span>}</td>
                                                <td className="px-3 py-2">
                                                    <button onClick={ev => { ev.stopPropagation(); startEditEspecial(e); }}
                                                        className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:text-white hover:bg-indigo-600 rounded-lg border border-indigo-200 dark:border-indigo-700 dark:text-indigo-400 dark:hover:text-white dark:hover:bg-indigo-600 transition-colors whitespace-nowrap">
                                                        Editar
                                                    </button>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                            <tr className="bg-indigo-600 text-white">
                                <td colSpan={7} className="px-3 py-2 font-bold text-sm">Total — Reglas especiales</td>
                                <td className="px-3 py-2 font-bold text-sm">{formatRD(especialRows.reduce((s, e) => s + e.total_subsidio, 0))}</td>
                                <td className="px-3 py-2 font-bold text-sm">{formatRD(especialRows.reduce((s, e) => s + e.total_usuario, 0))}</td>
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
                            <p className={`text-sm font-bold ${c.highlight ? (overBudget ? "text-rose-600" : "text-green-600") : "text-slate-900 dark:text-white"}`}>{formatRD(c.value)}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Historial de escenarios ─────────────────────────────────── */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Historial de escenarios</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{snapshots.length} escenario{snapshots.length !== 1 ? "s" : ""} guardado{snapshots.length !== 1 ? "s" : ""}.</p>
                </div>
                {snapshots.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-slate-400">
                        Aún no hay escenarios guardados. Usa <strong>Guardar escenario</strong> para crear el primero.
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {snapshots.map(snap => {
                            const r = snap.resumen_json;
                            const overB = r.diferencia < 0;
                            return (
                                <div key={snap.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{snap.nombre}</p>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${overB ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`}>{overB ? "Excede" : "OK"}</span>
                                            {snap.aprobado && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">✓ Aprobado</span>}
                                        </div>
                                        {snap.descripcion && <p className="text-xs text-slate-400 mt-0.5">{snap.descripcion}</p>}
                                        <div className="flex flex-wrap items-center gap-3 mt-1">
                                            <span className="text-xs text-slate-500">Subsidio: <strong className="text-blue-600">{formatRD(r.totalSubsidioAltice)}</strong></span>
                                            <span className="text-xs text-slate-500">Disponible: {formatRD(r.subsidio_disponible)}</span>
                                            <span className={`text-xs font-semibold ${overB ? "text-rose-600" : "text-green-600"}`}>{overB ? "−" : "+"}{formatRD(Math.abs(r.diferencia))}</span>
                                            <span className="text-[10px] text-slate-400">{new Date(snap.created_at).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                                        <button onClick={() => aprobarSnapshot(snap)} className={`text-xs font-medium px-2 py-1 rounded-lg transition-colors ${snap.aprobado ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" : "text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"}`}>{snap.aprobado ? "✓ Aprobado" : "Aprobar"}</button>
                                        <button onClick={() => setViewingSnapshot(viewingSnapshot?.id === snap.id ? null : snap)} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">{viewingSnapshot?.id === snap.id ? "Ocultar" : "Ver"}</button>
                                        <button onClick={() => restaurarSnapshot(snap)} disabled={saving} className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline px-2 py-1 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-40">Restaurar</button>
                                        <button onClick={() => eliminarSnapshot(snap.id, snap.nombre)} className="text-xs font-medium text-rose-500 dark:text-rose-400 hover:underline px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors">Eliminar</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {viewingSnapshot && (
                    <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-5 py-4">
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3">Detalle: {viewingSnapshot.nombre}</h4>
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

            {/* ── Modal Aplicar precios ──────────────────────────────────── */}
            {showAplicarModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] flex flex-col">
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
                            <h2 className="text-base font-bold text-slate-900 dark:text-white">Aplicar precios a empleados</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Esto actualizará el campo <strong>Monto mensual</strong> de cada empleado en Perfiles según su dispositivo y plan configurado.
                            </p>
                        </div>
                        <div className="overflow-y-auto flex-1 px-6 py-4">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-700">
                                        {["Equipo", "Plan", "Descuento", "Empleado paga", "Empleados"].map(h => (
                                            <th key={h} className="text-left pb-2 font-semibold text-slate-500 dark:text-slate-400 pr-4">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {reglaRows.map(r => (
                                        <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700/50">
                                            <td className="py-2 pr-4 font-medium text-slate-700 dark:text-slate-300">{r.equipo}</td>
                                            <td className="py-2 pr-4">
                                                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px]">{planLabel(r.plan)}</span>
                                            </td>
                                            <td className="py-2 pr-4 text-purple-600 dark:text-purple-400">{(r.descuento ?? 0) > 0 ? `−${formatRD(r.descuento)}` : "—"}</td>
                                            <td className="py-2 pr-4 font-bold text-slate-800 dark:text-white">{formatRD(r.usuario_unit)}</td>
                                            <td className="py-2 text-slate-600 dark:text-slate-300">{r.cantidad_real}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-slate-300 dark:border-slate-600">
                                        <td colSpan={4} className="pt-3 font-semibold text-slate-700 dark:text-slate-300">Total empleados a actualizar</td>
                                        <td className="pt-3 font-bold text-orange-600 dark:text-orange-400">{reglaRows.reduce((s, r) => s + r.cantidad_real, 0)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                            <p className="text-xs text-slate-400">Los empleados en reglas especiales no se modifican aquí — edítalos directamente en Perfiles.</p>
                            <div className="flex gap-2 shrink-0">
                                <button onClick={() => setShowAplicarModal(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-all">Cancelar</button>
                                <button onClick={aplicarPrecios} disabled={aplicando} className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                                    {aplicando ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : null}
                                    {aplicando ? "Aplicando…" : "Confirmar y aplicar"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal guardar escenario ─────────────────────────────────── */}
            {showSaveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700">
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
                            <h2 className="text-base font-bold text-slate-900 dark:text-white">Guardar escenario</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Subsidio: <strong className="text-blue-600">{formatRD(totales.totalSubsidioAltice)}</strong> · <strong className={overBudget ? "text-rose-600" : "text-green-600"}>{overBudget ? "−" : "+"}{formatRD(Math.abs(totales.diferencia))}</strong>
                            </p>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Nombre *</label>
                                <input autoFocus type="text" value={snapNombre} onChange={e => setSnapNombre(e.target.value)} onKeyDown={e => e.key === "Enter" && guardarSnapshot()} placeholder="Ej. Propuesta inicial, Versión ajustada…" className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Descripción (opcional)</label>
                                <textarea value={snapDesc} onChange={e => setSnapDesc(e.target.value)} rows={2} placeholder="Notas sobre este escenario…" className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex gap-3 justify-end">
                            <button onClick={() => setShowSaveModal(false)} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50">Cancelar</button>
                            <button onClick={guardarSnapshot} disabled={saving || !snapNombre.trim()} className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all disabled:opacity-50 flex items-center gap-2">
                                {saving ? <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Guardando...</> : "Guardar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
