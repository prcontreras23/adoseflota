"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase, formatDate, type LineaAltice } from "@/lib/supabase";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

type Vista = "pendientes" | "entregadas" | "sin_imei";

export default function EntregasLineasTab() {
    const [lineas, setLineas] = useState<LineaAltice[]>([]);
    const [loading, setLoading] = useState(true);
    const [vista, setVista] = useState<Vista>("pendientes");
    const [search, setSearch] = useState("");
    const [modalLinea, setModalLinea] = useState<LineaAltice | null>(null);
    const [modalMode, setModalMode] = useState<"imei" | "entrega">("imei");
    const [formImei, setFormImei] = useState({ imei: "", sim: "" });
    const [fechaEntrega, setFechaEntrega] = useState(new Date().toISOString().split("T")[0]);
    const [saving, setSaving] = useState(false);
    const [importing, setImporting] = useState(false);
    const importRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [signed, setSigned] = useState(false);
    const [drawing, setDrawing] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase
            .from("lineas_altice")
            .select("*")
            .in("accion_2026", ["CAMBIO SOLICITADO", "ALTA", "SE MANTIENE"])
            .order("usuario_linea");
        setLineas((data ?? []) as LineaAltice[]);
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const filtered = lineas.filter(l => {
        const q = search.toLowerCase();
        const matchSearch = !q || l.usuario_linea?.toLowerCase().includes(q)
            || l.telefono?.includes(q)
            || l.imei?.includes(q)
            || l.sim?.includes(q)
            || l.dispositivo_2026?.toLowerCase().includes(q);
        if (!matchSearch) return false;
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
    };

    // ── Canvas firma ──────────────────────────────────────────────────────────
    function startDraw(e: React.MouseEvent<HTMLCanvasElement>) {
        const c = canvasRef.current; if (!c) return;
        const r = c.getBoundingClientRect();
        c.getContext("2d")!.beginPath();
        c.getContext("2d")!.moveTo(e.clientX - r.left, e.clientY - r.top);
        setDrawing(true);
    }
    function draw(e: React.MouseEvent<HTMLCanvasElement>) {
        if (!drawing) return;
        const c = canvasRef.current; if (!c) return;
        const r = c.getBoundingClientRect();
        const ctx = c.getContext("2d")!;
        ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
        ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2; ctx.lineCap = "round";
        ctx.stroke();
        setSigned(true);
    }
    function clearSign() {
        const c = canvasRef.current; if (!c) return;
        c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
        setSigned(false);
    }

    // ── Guardar IMEI/SIM ──────────────────────────────────────────────────────
    async function guardarImei() {
        if (!modalLinea) return;
        if (!formImei.imei.trim()) { toast.error("El IMEI es obligatorio"); return; }
        setSaving(true);
        const { error } = await supabase
            .from("lineas_altice")
            .update({ imei: formImei.imei.trim(), sim: formImei.sim.trim() })
            .eq("id", modalLinea.id);
        if (error) { toast.error("Error al guardar"); setSaving(false); return; }
        toast.success("IMEI y SIM guardados ✓");
        setSaving(false);
        setModalLinea(null);
        loadData();
    }

    // ── Registrar entrega ──────────────────────────────────────────────────────
    async function registrarEntrega() {
        if (!modalLinea) return;
        if (!signed) { toast.error("Se requiere firma digital"); return; }
        setSaving(true);
        const { error } = await supabase
            .from("lineas_altice")
            .update({ entregado: true, fecha_entrega: fechaEntrega })
            .eq("id", modalLinea.id);
        if (error) { toast.error("Error al registrar entrega"); setSaving(false); return; }
        imprimirActa(modalLinea);
        toast.success("Entrega registrada ✓");
        setSaving(false);
        setModalLinea(null);
        setSigned(false);
        loadData();
    }

    // ── Imprimir acta ──────────────────────────────────────────────────────────
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
            <tr><th>Plan</th><td>${linea.gb_solicitado || linea.gb_antes || "—"}</td></tr>
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

    // ── Importar Excel masivo ──────────────────────────────────────────────────
    async function handleImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]; if (!file) return;
        setImporting(true);
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });

        // Detectar columnas flexiblemente
        const normalize = (s: string) => s?.toString().toLowerCase().replace(/[^a-z0-9]/g, "");
        const findCol = (row: Record<string, string>, keys: string[]) => {
            const entries = Object.entries(row);
            for (const k of keys) {
                const found = entries.find(([h]) => normalize(h).includes(k));
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

            // Normalizar teléfono para buscar (sin guiones)
            const { data } = await supabase
                .from("lineas_altice")
                .select("id, telefono")
                .or(`telefono.ilike.%${tel}%`);

            if (!data || data.length === 0) { notFound++; continue; }
            await supabase.from("lineas_altice")
                .update({ imei, sim })
                .eq("id", data[0].id);
            ok++;
        }
        toast.success(`Importado: ${ok} líneas actualizadas, ${notFound} no encontradas, ${skipped} filas omitidas`);
        setImporting(false);
        if (importRef.current) importRef.current.value = "";
        loadData();
    }

    // ── Abrir modales ─────────────────────────────────────────────────────────
    function abrirImei(linea: LineaAltice) {
        setModalLinea(linea);
        setModalMode("imei");
        setFormImei({ imei: linea.imei || "", sim: linea.sim || "" });
    }
    function abrirEntrega(linea: LineaAltice) {
        setModalLinea(linea);
        setModalMode("entrega");
        setFechaEntrega(new Date().toISOString().split("T")[0]);
        setSigned(false);
        setTimeout(() => { canvasRef.current && canvasRef.current.getContext("2d")!.clearRect(0, 0, 999, 999); }, 50);
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
                    <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">

                        {/* Header del modal */}
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <p className="font-bold text-slate-800 dark:text-white text-base">
                                    {modalMode === "imei" ? "📱 Asignar IMEI y SIM" : "🤝 Registrar Entrega"}
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
                                <div className="grid grid-cols-1 gap-3">
                                    <div>
                                        <label className={labelCls}>IMEI del dispositivo <span className="text-red-500">*</span></label>
                                        <input value={formImei.imei}
                                            onChange={e => setFormImei(p => ({ ...p, imei: e.target.value }))}
                                            placeholder="15 dígitos — ej: 352099001761481"
                                            className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Número de SIM / ICC</label>
                                        <input value={formImei.sim}
                                            onChange={e => setFormImei(p => ({ ...p, sim: e.target.value }))}
                                            placeholder="ej: 89302720401234567890"
                                            className={inputCls} />
                                    </div>
                                </div>
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
                                {/* Info del dispositivo */}
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-sm space-y-1">
                                    <div className="flex gap-2"><span className="text-slate-400 w-20">IMEI:</span><span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{modalLinea.imei || "—"}</span></div>
                                    <div className="flex gap-2"><span className="text-slate-400 w-20">SIM:</span><span className="font-mono text-slate-700 dark:text-slate-200">{modalLinea.sim || "—"}</span></div>
                                    <div className="flex gap-2"><span className="text-slate-400 w-20">Teléfono:</span><span className="text-slate-700 dark:text-slate-200">{modalLinea.telefono}</span></div>
                                </div>

                                <div>
                                    <label className={labelCls}>Fecha de entrega</label>
                                    <input type="date" value={fechaEntrega}
                                        onChange={e => setFechaEntrega(e.target.value)}
                                        className={inputCls} />
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
                    <p className="text-sm text-slate-500 dark:text-slate-400">Asigna IMEI/SIM y registra la entrega con firma digital</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImportExcel} className="hidden" />
                    <button onClick={() => importRef.current?.click()} disabled={importing}
                        className="text-sm bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl font-semibold transition-colors flex items-center gap-2">
                        {importing
                            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Importando...</>
                            : "📥 Importar IMEI/SIM (Excel)"}
                    </button>
                </div>
            </div>

            {/* ── KPIs ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: "Total a entregar", value: kpis.total, color: "text-slate-700 dark:text-slate-200", bg: "bg-white dark:bg-slate-800" },
                    { label: "Con IMEI asignado", value: kpis.conImei, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
                    { label: "Entregados", value: kpis.entregados, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" },
                    { label: "Sin IMEI / Pendiente", value: kpis.sinImei, color: kpis.sinImei > 0 ? "text-amber-600" : "text-slate-400", bg: kpis.sinImei > 0 ? "bg-amber-50 dark:bg-amber-900/20" : "bg-white dark:bg-slate-800" },
                ].map(k => (
                    <div key={k.label} className={`${k.bg} rounded-2xl border border-slate-200 dark:border-slate-700 p-4`}>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{k.label}</p>
                        <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                    </div>
                ))}
            </div>

            {/* ── FORMATO EXCEL DE IMPORTACIÓN ──────────────────────── */}
            <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-2xl p-4">
                <p className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-widest mb-2">📋 Formato del Excel de importación masiva</p>
                <p className="text-xs text-purple-600 dark:text-purple-300">
                    El archivo debe tener al menos las columnas: <strong>Telefono</strong>, <strong>IMEI</strong> y opcionalmente <strong>SIM</strong>.
                    El sistema buscará cada línea por el número de teléfono y actualizará el IMEI y SIM automáticamente.
                </p>
                <div className="mt-2 overflow-x-auto">
                    <table className="text-xs border-collapse">
                        <thead>
                            <tr className="bg-purple-100 dark:bg-purple-900/30">
                                <th className="border border-purple-300 dark:border-purple-700 px-3 py-1.5 text-purple-700 dark:text-purple-300">Telefono</th>
                                <th className="border border-purple-300 dark:border-purple-700 px-3 py-1.5 text-purple-700 dark:text-purple-300">IMEI</th>
                                <th className="border border-purple-300 dark:border-purple-700 px-3 py-1.5 text-purple-700 dark:text-purple-300">SIM</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="bg-white dark:bg-slate-800">
                                <td className="border border-purple-200 dark:border-purple-800 px-3 py-1.5 font-mono text-slate-600 dark:text-slate-300">829-760-9833</td>
                                <td className="border border-purple-200 dark:border-purple-800 px-3 py-1.5 font-mono text-slate-600 dark:text-slate-300">352099001761481</td>
                                <td className="border border-purple-200 dark:border-purple-800 px-3 py-1.5 font-mono text-slate-600 dark:text-slate-300">89302720401234567890</td>
                            </tr>
                        </tbody>
                    </table>
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
                        {v === "pendientes" ? `🕐 Pendientes (${kpis.total - kpis.entregados})` : v === "sin_imei" ? `⚠️ Sin IMEI (${kpis.sinImei})` : `✅ Entregadas (${kpis.entregados})`}
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
                                    {["Beneficiario", "Teléfono", "Dispositivo", "IMEI", "SIM", "Estado", "Acciones"].map(h => (
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
                                        <td className="p-3 font-mono text-slate-600 dark:text-slate-300">{linea.telefono}</td>
                                        <td className="p-3 text-xs text-slate-600 dark:text-slate-300 max-w-[140px]">
                                            {linea.dispositivo_2026 || <span className="text-slate-300 italic">—</span>}
                                        </td>
                                        <td className="p-3">
                                            {linea.imei
                                                ? <span className="font-mono text-xs text-slate-700 dark:text-slate-200">{linea.imei}</span>
                                                : <span className="text-xs text-amber-600 font-medium">Sin asignar</span>}
                                        </td>
                                        <td className="p-3">
                                            {linea.sim
                                                ? <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{linea.sim.slice(0, 12)}…</span>
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
                                                <button onClick={() => imprimirActa(linea)}
                                                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors font-medium">
                                                    🖨️ Reimprimir
                                                </button>
                                            ) : (
                                                <div className="flex gap-1">
                                                    <button onClick={() => abrirImei(linea)}
                                                        className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 transition-colors font-medium whitespace-nowrap">
                                                        📱 {linea.imei ? "Editar IMEI" : "Asignar IMEI"}
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
