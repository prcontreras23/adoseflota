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

type Vista = "pendientes" | "entregadas" | "sin_sim" | "con_sim";

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
    const [modalWA, setModalWA] = useState<{ numWA: string; mensaje: string } | null>(null);
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
        if (vista === "con_sim") return !l.entregado && !!l.sim_instalado;
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
    async function registrarEntrega(postAction?: "whatsapp" | "imprimir") {
        if (!modalLinea) return;
        if (!modalLinea.sim?.trim()) {
            toast.error("Debes asignar un número de SIM antes de registrar la entrega");
            return;
        }
        setSaving(true);
        const lineaSnapshot = { ...modalLinea };
        const fechaSnapshot = fechaEntrega;
        const ok = await mutate(modalLinea.id, {
            entregado: true,
            fecha_entrega: fechaEntrega,
            entregado_por: session?.nombre ?? null,
        });
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
            const snap = { ...lineaSnapshot, fecha_entrega: fechaSnapshot };
            if (postAction === "whatsapp") setTimeout(() => enviarWhatsApp(snap), 300);
            else if (postAction === "imprimir") setTimeout(() => imprimirActa(snap), 300);
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

        const monto = parseFloat(linea.monto_mensual || "0");
        const montoLinea = monto > 0
            ? `\n💰 *Pago único por el equipo:* RD$ ${monto.toLocaleString("es-DO", { minimumFractionDigits: 2 })}`
            : "";

        const noDeseabaInternet = linea.gb_solicitado?.trim() === "No deseo internet";
        const internetLinea = noDeseabaInternet
            ? `\n🌐 *Internet:* Logramos incluirte 5GB de internet en tu dispositivo 🎉`
            : (linea.gb_solicitado?.trim() && linea.gb_solicitado !== "No aplica"
                ? `\n🌐 *Plan de datos:* ${linea.gb_solicitado.replace(/\s*\(RD\$[^)]+\)/g, "").trim()}`
                : "");

        const mensaje =
`✅ *Entrega de dispositivo ADOSE Flota 2026*

Hola${linea.usuario_linea ? ` *${linea.usuario_linea}*` : ""}, te confirmamos que hemos registrado la entrega de tu dispositivo.

📱 *Dispositivo:* ${linea.dispositivo_2026 || "—"}
📞 *Número de línea:* ${linea.telefono}${linea.numero_altice ? `\n🔄 *N.° Altice (temporal):* ${linea.numero_altice}` : ""}${internetLinea}
📅 *Fecha de entrega:* ${fechaFormateada}${montoLinea}

Ante cualquier inconveniente comunícate con la secretaría ejecutiva de ADOSE.
_Francis Contreras_`;

        setModalWA({ numWA, mensaje });
    }

    // ── Imprimir acta ─────────────────────────────────────────────────────────
    function imprimirActa(linea: LineaAltice & { fecha_entrega?: string | null }) {
        const fechaImpresion = linea.fecha_entrega || fechaEntrega;
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
          <h1>Acta de Entrega de Dispositivo</h1>
          <h2>Renovación Flota Claro 2026 — ADOSE / Unión Adventista Sureste</h2>
          <span class="badge">ENTREGADO</span>
          <table>
            <tr><th>Beneficiario</th><td><strong>${linea.usuario_linea || "—"}</strong></td></tr>
            <tr><th>Titular responsable</th><td>${linea.titular_responsable || "—"}</td></tr>
            <tr><th>Tipo</th><td>${linea.tipo || "—"}</td></tr>
            <tr><th>Número de línea</th><td>${linea.telefono}</td></tr>
            ${linea.numero_altice?.trim() ? `<tr><th>N.° temporal Altice</th><td>${linea.numero_altice}</td></tr>` : ""}
            <tr><th>Dispositivo asignado</th><td>${linea.dispositivo_2026 || "—"}</td></tr>
            <tr><th>IMEI</th><td><strong>${linea.imei || "—"}</strong></td></tr>
            <tr><th>SIM / ICC</th><td>${linea.sim || "—"}</td></tr>
            <tr><th>Plan de datos</th><td>${linea.gb_solicitado || linea.gb_antes || "—"}</td></tr>
            <tr><th>Fecha de entrega</th><td><strong>${new Date(fechaImpresion).toLocaleDateString("es-DO", { year: "numeric", month: "long", day: "numeric" })}</strong></td></tr>
          </table>
          <p style="font-size:12px;color:#475569;line-height:1.6">
            Al firmar este documento, el beneficiario confirma haber recibido el dispositivo en perfectas condiciones
            y acepta las políticas de uso institucional establecidas por la ADOSE.
          </p>
          <div class="firma-box">
            <p class="firma-label">Firma del beneficiario:</p>
            <div style="width:300px;height:70px;border-bottom:1px solid #334155;margin-top:40px"></div>
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
        <><div className="space-y-5">

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

                                <div className="flex gap-2 pt-1 flex-wrap">
                                    <button onClick={() => setModalLinea(null)}
                                        className="py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold">
                                        Cancelar
                                    </button>
                                    <button onClick={() => registrarEntrega("whatsapp")} disabled={saving}
                                        className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
                                        {saving
                                            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Guardando...</>
                                            : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> Registrar + WA</>}
                                    </button>
                                    <button onClick={() => registrarEntrega("imprimir")} disabled={saving}
                                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
                                        {saving
                                            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Guardando...</>
                                            : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Registrar + Imprimir</>}
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
                {(["pendientes", "con_sim", "sin_sim", "entregadas"] as Vista[]).map(v => (
                    <button key={v} onClick={() => setVista(v)}
                        className={`px-4 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 ${vista === v ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50"}`}>
                        {v === "pendientes" ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Pendientes ({kpis.total - kpis.entregados})</>
                            : v === "con_sim" ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.1 9 11.1"/></svg> SIM Instalada ({kpis.simInstalado})</>
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
                                    {["Beneficiario", "Titular", "Teléfono", "Dispositivo", "N.° Altice", "N.° SIM", "SIM Instalada", "Estado", "Entregó", "Acciones"].map(h => (
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
                                                onClick={() => linea.sim?.trim() && toggleSimInstalado(linea)}
                                                title={!linea.sim?.trim() ? "Asigna una SIM primero" : linea.sim_instalado ? "SIM instalada — clic para desmarcar" : "Marcar SIM como instalada"}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${linea.sim_instalado ? "bg-violet-600" : "bg-slate-200 dark:bg-slate-600"} ${!linea.sim?.trim() ? "opacity-40 cursor-not-allowed" : ""}`}
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
                                        <td className="p-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                            {linea.entregado_por || <span className="text-slate-300">—</span>}
                                        </td>
                                        <td className="p-3">
                                            {linea.entregado ? (
                                                <div className="flex gap-1">
                                                    <button onClick={() => enviarWhatsApp(linea)}
                                                        className="text-xs px-2.5 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 transition-colors font-medium flex items-center gap-1">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> WA
                                                    </button>
                                                    <button onClick={() => imprimirActa(linea)}
                                                        className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors font-medium flex items-center gap-1">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Imprimir
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap gap-1">
                                                    <button onClick={() => abrirImei(linea)}
                                                        className="text-xs px-2.5 py-1.5 rounded-lg bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 hover:bg-violet-100 transition-colors font-medium whitespace-nowrap flex items-center gap-1">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg> {linea.sim?.trim() ? "Cambiar SIM" : "Asignar SIM"}
                                                    </button>
                                                    <button
                                                        disabled={!linea.sim_instalado}
                                                        onClick={() => {
                                                            const esNueva = linea.accion_2026 === "ALTA";
                                                            const rawNum = esNueva ? (linea.numero_altice || linea.telefono) : linea.telefono;
                                                            const numLimpio = rawNum?.replace(/\D/g, "") ?? "";
                                                            const numWA = numLimpio.length === 10 ? `1${numLimpio}` : numLimpio;
                                                            const alticeLinea = linea.numero_altice?.trim() ? `\n📞 *N.° temporal Altice:* ${linea.numero_altice}` : "";
                                                            const mensaje =
`📦 *Tu equipo ADOSE Flota 2026 está listo*

Hola${linea.usuario_linea ? ` *${linea.usuario_linea}*` : ""}, te informamos que tu dispositivo ya está preparado y puedes pasar a retirarlo.

📱 *Dispositivo:* ${linea.dispositivo_2026 || "—"}
📞 *Número de línea:* ${linea.telefono}${alticeLinea}

Por favor preséntate con tu cédula de identidad para completar la entrega.

_Francis Contreras_`;
                                                            setModalWA({ numWA, mensaje });
                                                        }}
                                                        title={linea.sim_instalado ? "Avisar por WhatsApp que puede retirar su equipo" : "Instala la SIM primero"}
                                                        className="text-xs px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap flex items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 disabled:hover:bg-amber-50">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .84h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg> Avisar
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

        {/* Modal edición mensaje WhatsApp */}
        {modalWA && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModalWA(null)}>
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col gap-4 p-6" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Mensaje de WhatsApp</h3>
                        <button onClick={() => setModalWA(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Puedes editar el mensaje antes de enviarlo.</p>
                    <textarea
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm p-3 resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
                        rows={14}
                        value={modalWA.mensaje}
                        onChange={e => setModalWA(prev => prev ? { ...prev, mensaje: e.target.value } : null)}
                    />
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setModalWA(null)} className="px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Cancelar</button>
                        <button
                            onClick={() => {
                                const url = `https://wa.me/${modalWA.numWA}?text=${encodeURIComponent(modalWA.mensaje)}`;
                                window.open(url, "_blank");
                                setModalWA(null);
                            }}
                            className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-500 hover:bg-green-600 text-white flex items-center gap-2"
                        >
                            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.554 4.118 1.524 5.849L0 24l6.34-1.503A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.897 0-3.671-.497-5.207-1.367l-.374-.222-3.864.916.977-3.768-.243-.388A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                            Enviar por WhatsApp
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
