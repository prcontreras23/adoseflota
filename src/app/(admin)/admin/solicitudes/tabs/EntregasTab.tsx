"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase, formatDate, formatRD, type FlotaMaestra } from "@/lib/supabase";
import toast from "react-hot-toast";

export default function EntregasTab() {
    const [items, setItems] = useState<FlotaMaestra[]>([]);
    const [loading, setLoading] = useState(true);
    const [delivering, setDelivering] = useState<string | null>(null);
    const [fechaEntrega, setFechaEntrega] = useState(new Date().toISOString().split("T")[0]);
    const [saving, setSaving] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [signed, setSigned] = useState(false);
    const [drawing, setDrawing] = useState(false);

    const loadData = useCallback(async () => {
        // Get flota_maestra records linked to solicitudes in listo-entrega state
        const { data: solicitudes } = await supabase
            .from("solicitudes")
            .select("id")
            .eq("estado", "listo-entrega");
        const ids = (solicitudes ?? []).map(s => s.id);
        if (ids.length === 0) { setItems([]); setLoading(false); return; }
        const { data } = await supabase.from("flota_maestra")
            .select("*, planes_claro(*), catalogo_dispositivos(*)")
            .in("solicitud_id", ids);
        setItems(data ?? []);
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // Canvas drawing
    function startDraw(e: React.MouseEvent<HTMLCanvasElement>) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const ctx = canvas.getContext("2d")!;
        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
        setDrawing(true);
    }
    function draw(e: React.MouseEvent<HTMLCanvasElement>) {
        if (!drawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const ctx = canvas.getContext("2d")!;
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2; ctx.lineCap = "round";
        ctx.stroke();
        setSigned(true);
    }
    function clearSign() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setSigned(false);
    }

    async function handleEntregar(item: FlotaMaestra) {
        if (!signed) { toast.error("Se requiere firma digital para registrar la entrega"); return; }
        setSaving(true);

        await supabase.from("flota_maestra").update({ fecha_entrega: fechaEntrega, estado: "entregado" }).eq("id", item.id);
        if (item.solicitud_id) {
            await supabase.from("solicitudes").update({ estado: "entregado" }).eq("id", item.solicitud_id);
        }

        // Print acta
        printActa(item);

        toast.success(`Entrega registrada para ${item.nombre}`);
        setDelivering(null);
        setSigned(false);
        loadData();
        setSaving(false);
    }

    function printActa(item: FlotaMaestra) {
        const canvas = canvasRef.current;
        const firmaImg = canvas?.toDataURL("image/png") ?? "";
        const html = `
      <html><head><title>Acta de Entrega</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;max-width:600px;margin:0 auto}
      h1{color:#007BFF;font-size:20px}h2{font-size:15px;color:#333}
      table{width:100%;border-collapse:collapse;margin:16px 0}
      td,th{padding:8px;border:1px solid #ddd;font-size:13px}th{background:#f5f5f5}
      .firma{margin-top:24px}img{border:1px solid #ccc;border-radius:4px}</style></head>
      <body>
        <img src="/logo-adose.png" style="height:50px;margin-bottom:16px" onerror="this.style.display='none'"/>
        <h1>Acta de Entrega de Dispositivo Claro</h1>
        <h2>Unión Adventista Sureste — Sistema Flotas 2026</h2>
        <table>
          <tr><th>Campo</th><th>Detalle</th></tr>
          <tr><td>Nombre</td><td>${item.nombre}</td></tr>
          <tr><td>Cargo</td><td>${item.cargo}</td></tr>
          <tr><td>Área</td><td>${item.area}</td></tr>
          <tr><td>Dispositivo</td><td>${(item as any).catalogo_dispositivos?.modelo ?? "—"}</td></tr>
          <tr><td>IMEI</td><td>${item.imei}</td></tr>
          <tr><td>Número</td><td>${item.numero_telefono}</td></tr>
          <tr><td>SIM</td><td>${item.sim}</td></tr>
          <tr><td>Plan</td><td>${(item as any).planes_claro?.nombre ?? "—"}</td></tr>
          <tr><td>Fecha Contrato</td><td>${formatDate(item.fecha_contrato)}</td></tr>
          <tr><td>Fecha Cambiazo 18m</td><td>${formatDate(item.fecha_cambio_18m)}</td></tr>
          <tr><td>Costo Dispositivo</td><td>${formatRD(item.costo_dispositivo)}</td></tr>
          <tr><td>Fecha Entrega</td><td>${formatDate(fechaEntrega)}</td></tr>
        </table>
        <p style="font-size:12px;color:#666">Al firmar este documento, el beneficiario confirma haber recibido el dispositivo en perfectas condiciones y acepta las políticas de uso institucional de la ADOSE.</p>
        <div class="firma">
          <p style="font-size:12px;font-weight:bold">Firma del beneficiario:</p>
          ${firmaImg ? `<img src="${firmaImg}" style="width:250px;height:80px"/>` : ""}
          <p style="border-top:1px solid #333;margin-top:40px;padding-top:4px;font-size:12px">${item.nombre}</p>
        </div>
      </body></html>`;
        const w = window.open("", "_blank");
        if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
    }

    if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Entregas Pendientes ({items.length})</h2>

            {items.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 py-20 text-center">
                    <div className="flex justify-center mb-3 text-slate-300 dark:text-slate-600"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></div>
                    <p className="text-slate-500">No hay entregas pendientes</p>
                </div>
            ) : items.map(item => (
                <div key={item.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 animate-fade-in">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-white">{item.nombre}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{item.cargo} · {item.area}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-1.5">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                                {(item as any).catalogo_dispositivos?.modelo} ·{" "}
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.86 9.11a19.79 19.79 0 01-3.07-8.67A2 2 0 012.77.5h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.34a16 16 0 006.29 6.29l1.1-1.1a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                                {item.numero_telefono}
                            </p>
                        </div>
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                            Listo para entrega
                        </span>
                    </div>

                    {delivering === item.id ? (
                        <div className="border-t border-slate-100 dark:border-slate-700 pt-4 space-y-3">
                            <div>
                                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Fecha de entrega</label>
                                <input type="date" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)}
                                    className="border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Firma digital del beneficiario</label>
                                    <button onClick={clearSign} className="text-xs text-red-500 hover:underline">Limpiar</button>
                                </div>
                                <canvas ref={canvasRef} width={400} height={100}
                                    onMouseDown={startDraw} onMouseMove={draw} onMouseUp={() => setDrawing(false)} onMouseLeave={() => setDrawing(false)}
                                    className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-crosshair bg-slate-50 dark:bg-slate-700 w-full max-w-md touch-none" />
                                {!signed && <p className="text-xs text-slate-400 mt-1">Dibuja la firma con el mouse</p>}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setDelivering(null)}
                                    className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                    Cancelar
                                </button>
                                <button onClick={() => handleEntregar(item)} disabled={saving}
                                    className="flex-1 bg-green-600 hover:bg-green-500 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                    {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Guardando...</> : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> Registrar Entrega + Imprimir Acta</>}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button onClick={() => setDelivering(item.id)}
                            className="w-full bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-900/40 border border-orange-200 dark:border-orange-800 rounded-xl py-2.5 text-sm text-orange-700 dark:text-orange-300 font-medium transition-colors flex items-center justify-center gap-1.5">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> Registrar Entrega
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}
