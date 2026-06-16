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

type Vista = "pendientes" | "entregadas" | "sin_imei";

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
    const [fechaEntrega, setFechaEntrega] = useState(new Date().toISOString().split("T")[0]);
    const [saving, setSaving] = useState(false);
    const [importing, setImporting] = useState(false);
    const importRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [signed, setSigned] = useState(false);
    const [drawing, setDrawing] = useState(false);

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
            || l.imei?.includes(q)
            || l.dispositivo_2026?.toLowerCase().includes(q);
        if (!ok) return false;
        if (vista === "pendientes") return !l.entregado;
        if (vista === "entregadas") return l.entregado;
        if (vista === "sin_imei") return !l.entregado && !l.imei?.trim();
        return true;
    });

    const kpis = {
        total: lineas.length,
        conImei: lineas.filter(l => l.imei?.trim()).length,
        entregados: lineas.filter(l => l.entregado).length,
        sinImei: lineas.filter(l => !l.entregado && !l.imei?.trim()).length,
        inventarioLibre: inventario.filter(i => !i.asignado).length,
    };

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

    // ── Guardar IMEI/SIM ──────────────────────────────────────────────────────
    async function guardarImei() {
        if (!modalLinea) return;
        let imei = "", sim = "";

        if (useManual) {
            imei = manualImei.trim();
            sim = manualSim.trim();
            if (!imei) { toast.error("El IMEI es obligatorio"); return; }
        } else {
            if (!selectedInvId) { toast.error("Selecciona un dispositivo del inventario"); return; }
            const item = inventario.find(i => i.id === selectedInvId);
            if (!item) return;
            imei = item.imei; sim = item.sim;
        }

        setSaving(true);

        // Un-assign previous inventory item if changing
        const prevItem = inventario.find(i => i.linea_id === modalLinea.id);
        if (prevItem && prevItem.id !== selectedInvId) {
            await supabase.from("inventario_altice")
                .update({ asignado: false, linea_id: null })
                .eq("id", prevItem.id);
        }

        // Mark new inventory item as assigned
        if (!useManual && selectedInvId) {
            await supabase.from("inventario_altice")
                .update({ asignado: true, linea_id: modalLinea.id })
                .eq("id", selectedInvId);
        }

        // Update line (mutate syncs instantly to Perfiles via Realtime)
        const ok = await mutate(modalLinea.id, { imei, sim });
        await loadInventario();

        if (ok) toast.success("IMEI y SIM asignados ✓");
        setSaving(false);
        setModalLinea(null);
    }

    // ── Registrar entrega ─────────────────────────────────────────────────────
    async function registrarEntrega() {
        if (!modalLinea) return;
        if (!signed) { toast.error("Se requiere firma digital"); return; }
        setSaving(true);
        const ok = await mutate(modalLinea.id, { entregado: true, fecha_entrega: fechaEntrega });
        if (ok) {
            imprimirActa(modalLinea);
            toast.success("Entrega registrada ✓");
        }
        setSaving(false);
        setModalLinea(null);
        setSigned(false);
    }

    // ── Imprimir acta ─────────────────────────────────────────────────────────
    function imprimirActa(linea: LineaAltice) {
        const firma = canvasRef.current?.toDataURL("image/png") ?? "";
        const html = `<html><head><title>Acta de Entrega</title>
        <style>
          body{font-family:Arial,sans-serif;padding:40px;max-width:620px;margin:0 auto;color:#1e293b}
          h1{color:#2563eb;font-size:18px;margin-bottom:4px}
          h2{font-size:13px;color:#64748b;font-weight:normal;margin-bottom:20px}
          table{width:100%;border-collapse:collapse;margin:16px 0}
          td,th{padding:9px 12px;border:1px solid #e2e8f0;font-size:13px}
          th{background:#f8fafc;font-weight:600;width:40%}
          .badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;background:#dcfce7;color:#16a34a}
          .footer{margin-top:36px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8}
          .firma-box{margin-top:28px}
          .firma-label{font-size:12px;font-weight:600;color:#334155;margin-bottom:6px}
          .firma-nombre{margin-top:8px;border-top:1px solid #334155;padding-top:4px;font-size:12px;width:280px}
        </style></head>
        <body>
          <h1>🤝 Acta de Entrega de Dispositivo</h1>
          <h2>Renovación Flota Claro 2026 — ADOSE / Unión Adventista Sureste</h2>
          <span class="badge">ENTREGADO</span>
          <table>
            <tr><th>Beneficiario</th><td><strong>${linea.usuario_linea || "—"}</strong></td></tr>
            <tr><th>Titular responsable</th><td>${linea.titular_responsable || "—"}</td></tr>
            <tr><th>Tipo</th><td>${linea.tipo || "—"}</td></tr>
            <tr><th>Número de línea</th><td>${linea.telefono}</td></tr>
            <tr><th>Dispositivo asignado</th><td>${linea.dispositivo_2026 || "—"}</td></tr>
            <tr><th>IMEI</th><td><strong>${linea.imei || "—"}</strong></td></tr>
            <tr><th>SIM / ICC</th><td>${linea.sim || "—"}</td></tr>
            <tr><th>Plan de datos</th><td>${linea.gb_solicitado || linea.gb_antes || "—"}</td></tr>
            <tr><th>Fecha de entrega</th><td><strong>${new Date(fechaEntrega).toLocaleDateString("es-DO", { year: "numeric", month: "long", day: "numeric" })}</strong></td></tr>
          </table>
          <p style="font-size:12px;color:#475569;line-height:1.6">
            Al firmar este documento, el beneficiario confirma haber recibido el dispositivo en perfectas condiciones
            y acepta las políticas de uso institucional establecidas por la ADOSE.
          </p>
          <div class="firma-box">
            <p class="firma-label">Firma del beneficiario:</p>
            ${firma ? `<img src="${firma}" style="width:260px;height:80px;border:1px solid #e2e8f0;border-radius:8px"/>` : ""}
            <p class="firma-nombre">${linea.usuario_linea || "—"}</p>
          </div>
          <div class="footer">Generado por ADOSE Flota 2026 · ${new Date().toLocaleString("es-DO")}</div>
        </body></html>`;
        const w = window.open("", "_blank");
        if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 600); }
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
        setManualImei(currentInv ? "" : (linea.imei || ""));
        setManualSim(currentInv ? "" : (linea.sim || ""));
        setUseManual(!currentInv && !!linea.imei);
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
                                <p className="font-bold text-slate-800 dark:text-white text-base">
                                    {modalMode === "imei" ? "📱 Asignar dispositivo" : "🤝 Registrar Entrega"}
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                    {modalLinea.usuario_linea || "—"} · {modalLinea.telefono}
                                </p>
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 font-medium">
                                    {modalLinea.dispositivo_2026 || "Dispositivo no especificado"}
                                </p>
                            </div>
                            <button onClick={() => setModalLinea(null)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-800 text-lg flex-shrink-0">✕</button>
                        </div>

                        {modalMode === "imei" ? (
                            <>
                                {/* Toggle: inventario vs manual */}
                                <div className="flex gap-2">
                                    <button onClick={() => setUseManual(false)}
                                        className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${!useManual ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"}`}>
                                        📦 Del inventario Altice
                                    </button>
                                    <button onClick={() => setUseManual(true)}
                                        className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${useManual ? "bg-slate-700 text-white border-slate-700" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"}`}>
                                        ✏️ Manual
                                    </button>
                                </div>

                                {!useManual ? (
                                    <div>
                                        <label className={labelCls}>
                                            Dispositivo del inventario Altice
                                            {modalLinea.dispositivo_2026 && <span className="text-slate-400 ml-1">— mostrando {modalLinea.dispositivo_2026}</span>}
                                        </label>
                                        <select value={selectedInvId} onChange={e => setSelectedInvId(e.target.value)} className={inputCls}>
                                            <option value="">— Seleccionar dispositivo —</option>
                                            {matchingInventario(modalLinea).map(item => (
                                                <option key={item.id} value={item.id}>
                                                    {item.imei} · SIM …{item.sim.slice(-6)}
                                                    {item.linea_id === modalLinea.id ? " (asignado actualmente)" : ""}
                                                </option>
                                            ))}
                                        </select>
                                        {matchingInventario(modalLinea).length === 0 && (
                                            <p className="text-xs text-amber-600 mt-1">
                                                No hay dispositivos disponibles para este modelo. Usa entrada manual.
                                            </p>
                                        )}
                                        {selectedInvId && (() => {
                                            const it = inventario.find(i => i.id === selectedInvId);
                                            return it ? (
                                                <div className="mt-2 bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-xs space-y-1">
                                                    <p className="font-semibold text-slate-700 dark:text-slate-200">{it.marca}</p>
                                                    <p><span className="text-slate-400 w-12 inline-block">IMEI:</span><span className="font-mono">{it.imei}</span></p>
                                                    <p><span className="text-slate-400 w-12 inline-block">SIM:</span><span className="font-mono">{it.sim}</span></p>
                                                </div>
                                            ) : null;
                                        })()}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div>
                                            <label className={labelCls}>IMEI del dispositivo <span className="text-red-500">*</span></label>
                                            <input value={manualImei}
                                                onChange={e => setManualImei(e.target.value)}
                                                placeholder="15 dígitos — ej: 352099001761481"
                                                className={inputCls} />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Número de SIM / ICC</label>
                                            <input value={manualSim}
                                                onChange={e => setManualSim(e.target.value)}
                                                placeholder="ej: 890101250725747238"
                                                className={inputCls} />
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-2 pt-1">
                                    <button onClick={() => setModalLinea(null)}
                                        className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold">
                                        Cancelar
                                    </button>
                                    <button onClick={guardarImei} disabled={saving}
                                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-50 transition-colors">
                                        {saving ? "Guardando..." : "💾 Guardar"}
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

                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className={labelCls}>Firma digital del beneficiario <span className="text-red-500">*</span></label>
                                        <button onClick={clearSign} className="text-xs text-red-500 hover:underline">Limpiar</button>
                                    </div>
                                    <canvas ref={canvasRef} width={460} height={100}
                                        onMouseDown={startDraw} onMouseMove={draw}
                                        onMouseUp={() => setDrawing(false)} onMouseLeave={() => setDrawing(false)}
                                        className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-crosshair bg-slate-50 dark:bg-slate-700 w-full touch-none" />
                                    {!signed && <p className="text-xs text-slate-400 mt-1">Dibuja la firma con el mouse o dedo</p>}
                                </div>

                                <div className="flex gap-2 pt-1">
                                    <button onClick={() => setModalLinea(null)}
                                        className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold">
                                        Cancelar
                                    </button>
                                    <button onClick={registrarEntrega} disabled={saving || !signed}
                                        className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                                        {saving
                                            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Guardando...</>
                                            : "🤝 Registrar + Imprimir Acta"}
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
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">🤝 Módulo de Entregas</h2>
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
                            : "📥 Importar por Excel"}
                    </button>
                </div>
            </div>

            {/* ── KPIs ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                    { label: "Total a entregar", value: kpis.total, color: "text-slate-700 dark:text-slate-200", bg: "bg-white dark:bg-slate-800" },
                    { label: "Con IMEI asignado", value: kpis.conImei, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
                    { label: "Entregados", value: kpis.entregados, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" },
                    { label: "Sin IMEI / Pendiente", value: kpis.sinImei, color: kpis.sinImei > 0 ? "text-amber-600" : "text-slate-400", bg: kpis.sinImei > 0 ? "bg-amber-50 dark:bg-amber-900/20" : "bg-white dark:bg-slate-800" },
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
                <p className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-widest mb-2">
                    📦 Inventario Altice cargado — {inventario.length} dispositivos totales
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
                {(["pendientes", "sin_imei", "entregadas"] as Vista[]).map(v => (
                    <button key={v} onClick={() => setVista(v)}
                        className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${vista === v ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50"}`}>
                        {v === "pendientes" ? `🕐 Pendientes (${kpis.total - kpis.entregados})`
                            : v === "sin_imei" ? `⚠️ Sin IMEI (${kpis.sinImei})`
                                : `✅ Entregadas (${kpis.entregados})`}
                    </button>
                ))}
            </div>

            {/* ── TABLA ─────────────────────────────────────────────── */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {filtered.length === 0 ? (
                    <div className="py-16 text-center text-slate-400">
                        <p className="text-4xl mb-2">🤝</p>
                        <p className="font-medium">No hay líneas en esta vista</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    {["Beneficiario", "Titular", "Teléfono", "Dispositivo", "IMEI", "SIM", "Estado", "Acciones"].map(h => (
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
                                            {linea.imei
                                                ? <span className="font-mono text-xs text-slate-700 dark:text-slate-200">{linea.imei}</span>
                                                : <span className="text-xs text-amber-600 font-medium">Sin asignar</span>}
                                        </td>
                                        <td className="p-3">
                                            {linea.sim
                                                ? <span className="font-mono text-xs text-slate-600 dark:text-slate-300">…{linea.sim.slice(-8)}</span>
                                                : <span className="text-slate-300 text-xs">—</span>}
                                        </td>
                                        <td className="p-3">
                                            {linea.entregado ? (
                                                <div>
                                                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                        ✅ Entregado
                                                    </span>
                                                    {linea.fecha_entrega && <p className="text-xs text-slate-400 mt-1">{formatDate(linea.fecha_entrega)}</p>}
                                                </div>
                                            ) : linea.imei ? (
                                                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                    📱 IMEI asignado
                                                </span>
                                            ) : (
                                                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                    ⏳ Pendiente
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            {linea.entregado ? (
                                                <button onClick={() => { setModalLinea(linea); setModalMode("entrega"); imprimirActa(linea); }}
                                                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors font-medium">
                                                    🖨️ Reimprimir
                                                </button>
                                            ) : (
                                                <div className="flex gap-1">
                                                    <button onClick={() => abrirImei(linea)}
                                                        className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 transition-colors font-medium whitespace-nowrap">
                                                        📱 {linea.imei ? "Cambiar" : "Asignar"}
                                                    </button>
                                                    {linea.imei && (
                                                        <button onClick={() => abrirEntrega(linea)}
                                                            className="text-xs px-2.5 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white transition-colors font-medium whitespace-nowrap">
                                                            🤝 Entregar
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
