"use client";
import { useEffect, useState, useRef } from "react";
import { supabase, formatDate, type LineaAltice } from "@/lib/supabase";
import { useLineas } from "@/lib/LineasContext";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

interface InventarioItem {
    id: string;
    marca: string;
    imei: string;
    sim: string;
    asignado: boolean;
    linea_id: string | null;
}

type Vista = "pendientes" | "entregadas" | "sin_sim";

function modelKey(s: string): string {
    const l = s.toLowerCase();
    if (l.includes("a56")) return "a56";
    if (l.includes("a17")) return "a17";
    if (l.includes("g56")) return "g56";
    return "";
}

export default function EntregasLineasTab() {
    const { lineas: all, loading, mutate } = useLineas();
    const [inventario, setInventario] = useState<InventarioItem[]>([]);
    const [vista, setVista] = useState<Vista>("pendientes");
    const [search, setSearch] = useState("");
    const [modalLinea, setModalLinea] = useState<LineaAltice | null>(null);
    const [modalMode, setModalMode] = useState<"imei" | "entrega">("imei");
    const [selectedInvId, setSelectedInvId] = useState("");
    const [useManual, setUseManual] = useState(false);
    const [manualImei, setManualImei] = useState("");
    const [manualSim, setManualSim] = useState("");
    const [manualNumeroAltice, setManualNumeroAltice] = useState("");
    const [fechaEntrega, setFechaEntrega] = useState(new Date().toISOString().split("T")[0]);
    const [saving, setSaving] = useState(false);
    const [importing, setImporting] = useState(false);
    const importRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [signed, setSigned] = useState(false);
    const [drawing, setDrawing] = useState(false);
    const [session] = useState<{ id: string; nombre: string } | null>(() => {
        if (typeof window === "undefined") return null;
        try { return JSON.parse(localStorage.getItem("flota_session") ?? "null"); } catch { return null; }
    });

    // Lines that need delivery (synced via LineasContext — same source as Perfiles)
    const lineas = all.filter(l =>
        ["CAMBIO SOLICITADO", "ALTA", "SE MANTIENE"].includes(l.accion_2026)
    );

    async function loadInventario() {
        const { data } = await supabase.from("inventario_altice").select("*").order("marca");
        setInventario((data ?? []) as InventarioItem[]);
    }
    useEffect(() => { loadInventario(); }, []);

    function matchingInventario(linea: LineaAltice): InventarioItem[] {
        const key = modelKey(linea.dispositivo_2026 || "");
        return inventario.filter(i => {
            if (i.asignado && i.linea_id !== linea.id) return false;
            if (!key) return true;
            return modelKey(i.marca) === key;
        });
    }

    const filtered = lineas.filter(l => {
        const q = search.toLowerCase();
        const ok = !q || l.usuario_linea?.toLowerCase().includes(q)
            || l.titular_responsable?.toLowerCase().includes(q)
            || l.telefono?.includes(q)
            || l.sim?.includes(q)
            || l.dispositivo_2026?.toLowerCase().includes(q);
        if (!ok) return false;
        if (vista === "pendientes") return !l.entregado;
        if (vista === "entregadas") return l.entregado;
        if (vista === "sin_sim") return !l.entregado && !l.sim?.trim();
        return true;
    });

    const kpis = {
        total: lineas.length,
        conSim: lineas.filter(l => l.sim?.trim()).length,
        entregados: lineas.filter(l => l.entregado).length,
        sinSim: lineas.filter(l => !l.entregado && !l.sim?.trim()).length,
        inventarioLibre: inventario.filter(i => !i.asignado).length,
        simInstalado: lineas.filter(l => l.sim_instalado).length,
    };

    async function toggleSimInstalado(linea: LineaAltice) {
        const nuevo = !linea.sim_instalado;
        await mutate(linea.id, { sim_instalado: nuevo });
    }

    // ── Canvas firma ──────────────────────────────────────────────────────────
    function startDraw(e: React.MouseEvent<HTMLCanvasElement>) {
        const c = canvasRef.current; if (!c) return;
        const r = c.getBoundingClientRect();
        const ctx = c.getContext("2d")!;
        ctx.beginPath(); ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
        setDrawing(true);
    }
    function draw(e: React.MouseEvent<HTMLCanvasElement>) {
        if (!drawing) return;
        const c = canvasRef.current; if (!c) return;
        const r = c.getBoundingClientRect();
        const ctx = c.getContext("2d")!;
        ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
        ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2; ctx.lineCap = "round";
        ctx.stroke(); setSigned(true);
    }
    function clearSign() {
        const c = canvasRef.current; if (!c) return;
        c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
        setSigned(false);
    }

    // ── Guardar SIM ───────────────────────────────────────────────────────────
    async function guardarImei() {
        if (!modalLinea) return;
        let imei = "", sim = "";

        if (useManual) {
            sim = manualSim.trim();
            imei = manualImei.trim();
            if (!sim) { toast.error("El número de SIM es obligatorio"); return; }
        } else {
            if (!selectedInvId) { toast.error("Selecciona una SIM del inventario"); return; }
            const item = inventario.find(i => i.id === selectedInvId);
            if (!item) return;
            imei = item.imei; sim = item.sim;
        }

        setSaving(true);

        const prevItem = inventario.find(i => i.linea_id === modalLinea.id);
        if (prevItem && prevItem.id !== selectedInvId) {
            await supabase.from("inventario_altice")
                .update({ asignado: false, linea_id: null })
                .eq("id", prevItem.id);
        }

        if (!useManual && selectedInvId) {
            await supabase.from("inventario_altice")
                .update({ asignado: true, linea_id: modalLinea.id })
                .eq("id", selectedInvId);
        }

        const updates: Partial<LineaAltice> = { imei, sim };
        if (manualNumeroAltice.trim()) updates.numero_altice = manualNumeroAltice.trim();

        const ok = await mutate(modalLinea.id, updates);
        await loadInventario();

        if (ok && session) {
            const registros = [];
            if (sim !== (modalLinea.sim ?? "")) registros.push({ linea_id: modalLinea.id, usuario_id: session.id, usuario_nombre: session.nombre, campo: "SIM", valor_anterior: modalLinea.sim || null, valor_nuevo: sim || null });
            if (imei && imei !== (modalLinea.imei ?? "")) registros.push({ linea_id: modalLinea.id, usuario_id: session.id, usuario_nombre: session.nombre, campo: "IMEI", valor_anterior: modalLinea.imei || null, valor_nuevo: imei || null });
            if (registros.length > 0) await supabase.from("historial_cambios").insert(registros);
        }
        if (ok) toast.success("SIM asignada correctamente");
        setSaving(false);
        setModalLinea(null);
    }

    // ── Registrar entrega ─────────────────────────────────────────────────────
    async function registrarEntrega() {
        if (!modalLinea) return;
        setSaving(true);
        const lineaSnapshot = { ...modalLinea };
        const fechaSnapshot = fechaEntrega;
        const ok = await mutate(modalLinea.id, { entregado: true, fecha_entrega: fechaEntrega });
        setSaving(false);
        setModalLinea(null);
        setSigned(false);
        if (ok) {
            try {
                if (session) {
                    await supabase.from("historial_cambios").insert([{
                        linea_id: lineaSnapshot.id,
                        usuario_id: session.id,
                        usuario_nombre: session.nombre,
                        campo: "Entregado",
                        valor_anterior: "No",
                        valor_nuevo: `Sí — ${fechaSnapshot}`,
                    }]);
                }
            } catch (_) { /* historial no crítico */ }
            toast.success("Entrega registrada");
            setTimeout(() => enviarWhatsApp({ ...lineaSnapshot, fecha_entrega: fechaSnapshot }), 300);
        } else {
            toast.error("Error al registrar la entrega");
        }
    }

    // ── Enviar WhatsApp ───────────────────────────────────────────────────────
    function enviarWhatsApp(linea: LineaAltice & { fecha_entrega?: string | null }) {
        const fechaEntregaStr = linea.fecha_entrega || fechaEntrega;
        const fechaFormateada = new Date(fechaEntregaStr).toLocaleDateString("es-DO", {
            year: "numeric", month: "long", day: "numeric",
        });

        // Número real: para ALTA (línea nueva) usamos numero_altice, para el resto telefono
        const esNueva = linea.accion_2026 === "ALTA";
        const rawNum = esNueva
            ? (linea.numero_altice || linea.telefono)
            : linea.telefono;
        const numLimpio = rawNum?.replace(/\D/g, "") ?? "";
        // Agregar código de país 1 (RD) si el número tiene 10 dígitos
        const numWA = numLimpio.length === 10 ? `1${numLimpio}` : numLimpio;

        const mensaje =
`✅ *Entrega de dispositivo ADOSE Flota 2026*

Hola${linea.usuario_linea ? ` *${linea.usuario_linea}*` : ""}, te confirmamos que hemos registrado la entrega de tu dispositivo.

📱 *Dispositivo:* ${linea.dispositivo_2026 || "—"}
📞 *Número de línea:* ${linea.telefono}${linea.numero_altice ? `\n🔄 *N.° Altice (temporal):* ${linea.numero_altice}` : ""}
📅 *Fecha de entrega:* ${fechaFormateada}

Ante cualquier inconveniente comunícate con la secretaría ejecutiva de ADOSE.
_Unión Adventista Sureste_`;

        const url = `https://wa.me/${numWA}?text=${encodeURIComponent(mensaje)}`;
        window.open(url, "_blank");
    }

    // ── Importar Excel masivo ─────────────────────────────────────────────────
    async function handleImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]; if (!file) return;
        setImporting(true);
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
        const norm = (s: string) => s?.toString().toLowerCase().replace(/[^a-z0-9]/g, "");
        const findCol = (row: Record<string, string>, keys: string[]) => {
            const entries = Object.entries(row);
            for (const k of keys) {
                const found = entries.find(([h]) => norm(h).includes(k));
                if (found) return found[1]?.toString().trim() ?? "";
            }
            return "";
        };
        let ok = 0, notFound = 0, skipped = 0;
        for (const row of rows) {
            const tel = findCol(row, ["telefono", "numero", "linea", "phone"]).replace(/[^0-9]/g, "");
            const imei = findCol(row, ["imei"]);
            const sim = findCol(row, ["sim", "icc", "tarjeta"]);
            if (!tel || !imei) { skipped++; continue; }
            const { data } = await supabase
                .from("lineas_altice").select("id").or(`telefono.ilike.%${tel}%`);
            if (!data || data.length === 0) { notFound++; continue; }
            await mutate(data[0].id, { imei, sim });
            ok++;
        }
        toast.success(`Importado: ${ok} actualizadas, ${notFound} no encontradas, ${skipped} omitidas`);
        setImporting(false);
        if (importRef.current) importRef.current.value = "";
    }

    // ── Abrir modales ─────────────────────────────────────────────────────────
    function abrirImei(linea: LineaAltice) {
        setModalLinea(linea);
        setModalMode("imei");
        const currentInv = inventario.find(i => i.linea_id === linea.id);
        setSelectedInvId(currentInv?.id || "");
        setManualSim(currentInv ? "" : (linea.sim || ""));
        setManualImei(currentInv ? "" : (linea.imei || ""));
        setManualNumeroAltice(linea.numero_altice || "");
        setUseManual(!currentInv && !!linea.sim);
    }
    function abrirEntrega(linea: LineaAltice) {
        setModalLinea(linea);
        setModalMode("entrega");
        setFechaEntrega(new Date().toISOString().split("T")[0]);
        setSigned(false);
        setTimeout(() => {
            const c = canvasRef.current;
            if (c) c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
        }, 50);
    }

    const inputCls = "w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
    const labelCls = "text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block";

    if (loading) return (
        <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="space-y-5">

            {/* ── MODAL ──────────────────────────────────────────────── */}
            {modalLinea && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModalLinea(null)} />
                    <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">

                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <p className="font-bold text-slate-800 dark:text-white text-base flex items-center gap-1.5">
                                    {modalMode === "imei" ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg> Asignar SIM</> : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> Registrar Entrega</>}
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                    {modalLinea.usuario_linea || "—"} · {modalLinea.telefono}
                                </p>
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 font-medium">
                                    {modalLinea.dispositivo_2026 || "Dispositivo no especificado"}
                                </p>
                            </div>
                            <button onClick={() => setModalLinea(null)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-800 flex-shrink-0"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                        </div>

                        {modalMode === "imei" ? (
                            <>
                                {/* Toggle: inventario vs manual */}
                                <div className="flex gap-2">
                                    <button onClick={() => setUseManual(false)}
                                        className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all flex items-center justify-center gap-1.5 ${!useManual ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"}`}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg> Del inventario Altice
                                    </button>
                                    <button onClick={() => setUseManual(true)}
                                        className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all flex items-center justify-center gap-1.5 ${useManual ? "bg-slate-700 text-white border-slate-700" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"}`}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Manual
                                    </button>
                                </div>

                                {!useManual ? (
                                    (() => {
                                        const opciones = matchingInventario(modalLinea);
                                        const typedSim = manualSim.replace(/\D/g, "");
                                        const filtradas = opciones.filter(i =>
                                            !typedSim || i.sim.includes(typedSim)
                                        );
                                        return (
                                            <div className="space-y-3">
                                                {/* SIM combobox */}
                                                <div className="relative">
                                                    <label className={labelCls}>
                                                        Tarjeta SIM / ICC
                                                        {selectedInvId && <span className="ml-2 text-teal-600 font-semibold text-xs">inventario Altice</span>}
                                                    </label>
                                                    <input
                                                        value={manualSim}
                                                        onChange={e => { setManualSim(e.target.value); setSelectedInvId(""); setManualImei(""); }}
                                                        onFocus={() => { }}
                                                        placeholder="Escribe el número de SIM para buscar..."
                                                        className={inputCls}
                                                        autoComplete="off"
                                                    />
                                                    {filtradas.length > 0 && (
                                                        <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                                                            <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                                {filtradas.length} disponible{filtradas.length !== 1 ? "s" : ""}
                                                            </p>
                                                            {filtradas.map(item => (
                                                                <button key={item.id} type="button"
                                                                    onMouseDown={() => {
                                                                        setManualSim(item.sim);
                                                                        setManualImei(item.imei);
                                                                        setSelectedInvId(item.id);
                                                                    }}
                                                                    className="w-full text-left px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-t border-slate-100 dark:border-slate-700 first:border-0">
                                                                    <p className="font-mono text-sm text-slate-800 dark:text-white">{item.sim}</p>
                                                                    <p className="text-xs text-slate-400">IMEI: {item.imei} · {item.marca.split(" ").slice(0, 3).join(" ")}</p>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                {/* IMEI — solo lectura, se rellena al seleccionar SIM */}
                                                <div>
                                                    <label className={labelCls}>IMEI</label>
                                                    {manualImei ? (
                                                        <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl">
                                                            <span className="font-mono text-sm font-semibold text-slate-800 dark:text-white tracking-wide">{manualImei}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="px-3 py-2.5 bg-slate-50 dark:bg-slate-700/50 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl">
                                                            <span className="text-sm text-slate-400 italic">Se completa al seleccionar la SIM</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()
                                ) : (
                                    <div className="space-y-3">
                                        <div>
                                            <label className={labelCls}>Número de SIM / ICC <span className="text-red-500">*</span></label>
                                            <input value={manualSim}
                                                onChange={e => setManualSim(e.target.value)}
                                                placeholder="ej: 890101250725747238"
                                                className={inputCls}
                                                autoFocus />
                                        </div>
                                        <div>
                                            <label className={labelCls}>IMEI del dispositivo <span className="text-slate-400 font-normal">(opcional)</span></label>
                                            <input value={manualImei}
                                                onChange={e => setManualImei(e.target.value)}
                                                placeholder="15 dígitos — ej: 352099001761481"
                                                className={inputCls} />
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className={labelCls}>N.° Altice (número temporal) <span className="text-slate-400 font-normal">(opcional)</span></label>
                                    <input value={manualNumeroAltice}
                                        onChange={e => setManualNumeroAltice(e.target.value)}
                                        placeholder="ej: 8093100502"
                                        className={inputCls} />
                                </div>

                                <div className="flex gap-2 pt-1">
                                    <button onClick={() => setModalLinea(null)}
                                        className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold">
                                        Cancelar
                                    </button>
                                    <button onClick={guardarImei} disabled={saving}
                                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-50 transition-colors">
                                        {saving ? "Guardando..." : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Guardar</>}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-sm space-y-1">
                                    <div className="flex gap-2"><span className="text-slate-400 w-20">IMEI:</span><span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{modalLinea.imei || "—"}</span></div>
                                    <div className="flex gap-2"><span className="text-slate-400 w-20">SIM:</span><span className="font-mono text-slate-700 dark:text-slate-200">{modalLinea.sim || "—"}</span></div>
                                    <div className="flex gap-2"><span className="text-slate-400 w-20">Teléfono:</span><span>{modalLinea.telefono}</span></div>
                                    <div className="flex gap-2"><span className="text-slate-400 w-20">Equipo:</span><span>{modalLinea.dispositivo_2026 || "—"}</span></div>
                                </div>

                                <div>
                                    <label className={labelCls}>Fecha de entrega</label>
                                    <input type="date" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)} className={inputCls} />
                                </div>

                                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 text-xs text-green-700 dark:text-green-400 flex items-start gap-2">
                                    <svg className="flex-shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                                    <span>Al registrar se abrirá WhatsApp para notificar al beneficiario
                                    {modalLinea && (<> al número <strong>{modalLinea.accion_2026 === "ALTA" ? (modalLinea.numero_altice || modalLinea.telefono) : modalLinea.telefono}</strong>{modalLinea.accion_2026 === "ALTA" ? " (número nuevo)" : " (número real)"}</>)}.
                                    </span>
                                </div>

                                <div className="flex gap-2 pt-1">
                                    <button onClick={() => setModalLinea(null)}
                                        className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold">
                                        Cancelar
                                    </button>
                                    <button onClick={registrarEntrega} disabled={saving}
                                        className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                                        {saving
                                            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Guardando...</>
                                            : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> Registrar + Enviar WhatsApp</>}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ── HEADER ────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-1.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> Módulo de Entregas</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Asigna dispositivos del inventario Altice y registra la entrega con firma
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImportExcel} className="hidden" />
                    <button onClick={() => importRef.current?.click()} disabled={importing}
                        className="text-sm bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl font-semibold transition-colors flex items-center gap-2">
                        {importing
                            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Importando...</>
                            : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Importar por Excel</>}
                    </button>
                </div>
            </div>

            {/* ── KPIs ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                    { label: "Total a entregar", value: kpis.total, color: "text-slate-700 dark:text-slate-200", bg: "bg-white dark:bg-slate-800" },
                    { label: "Con SIM asignada", value: kpis.conSim, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
                    { label: "SIM instalada", value: `${kpis.simInstalado} / ${kpis.total}`, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-900/20" },
                    { label: "Entregados", value: kpis.entregados, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" },
                    { label: "Sin SIM / Pendiente", value: kpis.sinSim, color: kpis.sinSim > 0 ? "text-amber-600" : "text-slate-400", bg: kpis.sinSim > 0 ? "bg-amber-50 dark:bg-amber-900/20" : "bg-white dark:bg-slate-800" },
                    { label: "Inventario disponible", value: kpis.inventarioLibre, color: "text-teal-600", bg: "bg-teal-50 dark:bg-teal-900/20" },
                ].map(k => (
                    <div key={k.label} className={`${k.bg} rounded-2xl border border-slate-200 dark:border-slate-700 p-4`}>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{k.label}</p>
                        <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                    </div>
                ))}
            </div>

            {/* ── INVENTARIO ALTICE ─────────────────────────────────── */}
            <div className="bg-teal-50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-800 rounded-2xl p-4">
                <p className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> Inventario Altice cargado — {inventario.length} dispositivos totales
                </p>
                <div className="flex flex-wrap gap-4 text-sm">
                    {Object.entries(
                        inventario.reduce((acc, i) => {
                            const k = i.marca.split(" ").slice(0, 3).join(" ");
                            if (!acc[k]) acc[k] = { total: 0, libres: 0 };
                            acc[k].total++;
                            if (!i.asignado) acc[k].libres++;
                            return acc;
                        }, {} as Record<string, { total: number; libres: number }>)
                    ).map(([m, c]) => (
                        <div key={m} className="text-teal-700 dark:text-teal-300">
                            <span className="font-semibold">{m}</span>
                            <span className="text-teal-500 ml-2">{c.libres}/{c.total} disponibles</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── FILTROS ────────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-2 items-center">
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por nombre, teléfono, IMEI..."
                    className="flex-1 min-w-[200px] border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {(["pendientes", "sin_sim", "entregadas"] as Vista[]).map(v => (
                    <button key={v} onClick={() => setVista(v)}
                        className={`px-4 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 ${vista === v ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50"}`}>
                        {v === "pendientes" ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Pendientes ({kpis.total - kpis.entregados})</>
                            : v === "sin_sim" ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Sin SIM ({kpis.sinSim})</>
                                : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.1 9 11.1"/></svg> Entregadas ({kpis.entregados})</>}
                    </button>
                ))}
            </div>

            {/* ── TABLA ─────────────────────────────────────────────── */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {filtered.length === 0 ? (
                    <div className="py-16 text-center text-slate-400">
                        <div className="flex justify-center mb-2"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></div>
                        <p className="font-medium">No hay líneas en esta vista</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    {["Beneficiario", "Titular", "Teléfono", "Dispositivo", "N.° Altice", "N.° SIM", "SIM Instalada", "Estado", "Acciones"].map(h => (
                                        <th key={h} className="p-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {filtered.map(linea => (
                                    <tr key={linea.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 ${linea.entregado ? "opacity-60" : ""}`}>
                                        <td className="p-3">
                                            <p className="font-semibold text-slate-800 dark:text-white">{linea.usuario_linea || "—"}</p>
                                            <p className="text-xs text-slate-400">{linea.tipo}</p>
                                        </td>
                                        <td className="p-3 text-xs text-slate-600 dark:text-slate-300 max-w-[120px]">
                                            <span className="truncate block">{linea.titular_responsable || "—"}</span>
                                        </td>
                                        <td className="p-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">{linea.telefono}</td>
                                        <td className="p-3 text-xs text-slate-600 dark:text-slate-300 max-w-[130px]">
                                            {linea.dispositivo_2026 || <span className="text-slate-300 italic">—</span>}
                                        </td>
                                        <td className="p-3">
                                            {linea.numero_altice?.trim()
                                                ? <span className="font-mono text-xs text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/20 px-2 py-1 rounded-lg">{linea.numero_altice}</span>
                                                : <span className="text-slate-300 text-xs">—</span>}
                                        </td>
                                        <td className="p-3">
                                            {linea.sim?.trim()
                                                ? <span className="font-mono text-xs text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/20 px-2 py-1 rounded-lg">{linea.sim}</span>
                                                : <span className="text-xs text-amber-600 font-medium">Sin asignar</span>}
                                        </td>
                                        <td className="p-3">
                                            <button
                                                onClick={() => toggleSimInstalado(linea)}
                                                title={linea.sim_instalado ? "SIM instalada — clic para desmarcar" : "Marcar SIM como instalada"}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${linea.sim_instalado ? "bg-violet-600" : "bg-slate-200 dark:bg-slate-600"}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${linea.sim_instalado ? "translate-x-6" : "translate-x-1"}`} />
                                            </button>
                                        </td>
                                        <td className="p-3">
                                            {linea.entregado ? (
                                                <div>
                                                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1 w-fit">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.1 9 11.1"/></svg> Entregado
                                                    </span>
                                                    {linea.fecha_entrega && <p className="text-xs text-slate-400 mt-1">{formatDate(linea.fecha_entrega)}</p>}
                                                </div>
                                            ) : linea.sim_instalado ? (
                                                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1 w-fit">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.1 9 11.1"/></svg> SIM Instalada
                                                </span>
                                            ) : linea.sim?.trim() ? (
                                                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 flex items-center gap-1 w-fit">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg> SIM asignada
                                                </span>
                                            ) : (
                                                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 flex items-center gap-1 w-fit">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Pendiente
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            {linea.entregado ? (
                                                <button onClick={() => enviarWhatsApp(linea)}
                                                    className="text-xs px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 transition-colors font-medium flex items-center gap-1">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> Enviar WA
                                                </button>
                                            ) : (
                                                <div className="flex gap-1">
                                                    <button onClick={() => abrirImei(linea)}
                                                        className="text-xs px-2.5 py-1.5 rounded-lg bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 hover:bg-violet-100 transition-colors font-medium whitespace-nowrap flex items-center gap-1">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg> {linea.sim?.trim() ? "Cambiar SIM" : "Asignar SIM"}
                                                    </button>
                                                    {linea.sim?.trim() && (
                                                        <button onClick={() => abrirEntrega(linea)}
                                                            className="text-xs px-2.5 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white transition-colors font-medium whitespace-nowrap flex items-center gap-1">
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> Entregar
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
