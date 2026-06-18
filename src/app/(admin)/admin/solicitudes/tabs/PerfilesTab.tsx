"use client";
import React, { useEffect, useState } from "react";
import { supabase, type LineaAltice, ACCION_COLORS, ESTADO_LINEA_COLORS, PORTABILIDAD_COLORS, PORTABILIDAD_OPTIONS } from "@/lib/supabase";
import { useLineas } from "@/lib/LineasContext";
import { useNav } from "@/lib/NavContext";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import NuevaLineaModal from "./NuevaLineaModal";
import FormularioPanel from "./FormularioPanel";

interface HistorialEntry {
  id: string;
  linea_id: string;
  usuario_id: string | null;
  usuario_nombre: string;
  campo: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  created_at: string;
}

const CAMPOS_ETIQUETAS: Partial<Record<keyof LineaAltice, string>> = {
  usuario_linea: "Usuario",
  titular_responsable: "Titular",
  telefono: "Teléfono",
  tipo: "Tipo",
  accion_2026: "Acción 2026",
  estado: "Estado",
  proxima_accion: "Próxima acción",
  gb_antes: "GB antes",
  gb_solicitado: "GB solicitado",
  min_antes: "Min antes",
  min_solicitados: "Min solicitados",
  dispositivo_2026: "Dispositivo",
  cotizacion: "Cotización",
  monto_mensual: "Monto mensual",
  imei: "IMEI",
  sim: "SIM",
  revisado_por: "Revisado por",
  nota_resolucion: "Nota de resolución",
  observaciones: "Observaciones",
  seguimiento: "Seguimiento",
};

const PLANES_DATA = [
  "",
  "Data 5GB + Bono 2GB (RD$711.00)",
  "Data 10GB + Bono 5GB (RD$1,161.00)",
  "Data 15GB + Bono 5GB (RD$1,251.00)",
  "Data 25GB + Bono 5GB (RD$1,791.00)",
  "Data 50GB + Bono 50GB (RD$3,681.00)",
  "No deseo internet",
];

interface TitularGroup {
  nombre: string;
  lineas: LineaAltice[];
}

function EditModal({ linea, onClose, onSave, onDelete, session, upsertLocal }: {
  linea: LineaAltice;
  onClose: () => void;
  onSave: (updated: LineaAltice) => void;
  onDelete: (id: string) => void;
  session: { id: string; nombre: string } | null;
  upsertLocal: (l: LineaAltice) => void;
}) {
  const [form, setForm] = useState<LineaAltice>({ ...linea });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archivando, setArchivando] = useState(false);
  const [dispositivosStock, setDispositivosStock] = useState<{ dispositivo: string; disponibles: number }[]>([]);
  const [inventarioItems, setInventarioItems] = useState<{ id: string; marca: string; imei: string; sim: string; asignado: boolean; linea_id: string | null }[]>([]);
  const [selectedInvId, setSelectedInvId] = useState<string>("");
  const [imeiOpen, setImeiOpen] = useState(false);
  const [imeiDropOpen, setImeiDropOpen] = useState(false);
  const [historial, setHistorial] = useState<HistorialEntry[]>([]);
  const [historialLoading, setHistorialLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("historial_cambios")
      .select("*")
      .eq("linea_id", linea.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setHistorial((data ?? []) as HistorialEntry[]);
        setHistorialLoading(false);
      });
  }, [linea.id]);

  useEffect(() => {
    async function cargarDatos() {
      const [{ data: stockData }, { data: lineasData }, { data: invData }] = await Promise.all([
        supabase.from("almacen_dispositivos").select("dispositivo, cantidad_stock").order("dispositivo"),
        supabase.from("lineas_altice").select("dispositivo_2026"),
        supabase.from("inventario_altice").select("*").order("marca"),
      ]);
      if (stockData) {
        const conteo: Record<string, number> = {};
        (lineasData ?? []).forEach((l: { dispositivo_2026?: string }) => {
          const d = l.dispositivo_2026?.trim().toLowerCase();
          if (d) conteo[d] = (conteo[d] ?? 0) + 1;
        });
        setDispositivosStock(stockData.map((s: { dispositivo: string; cantidad_stock: number }) => ({
          dispositivo: s.dispositivo,
          disponibles: s.cantidad_stock - (conteo[s.dispositivo.toLowerCase()] ?? 0),
        })));
      }
      if (invData) {
        setInventarioItems(invData as typeof inventarioItems);
        // Pre-select if already assigned to this line
        const current = (invData as typeof inventarioItems).find(i => i.linea_id === linea.id);
        if (current) setSelectedInvId(current.id);
      }
    }
    cargarDatos();
  }, [linea.id]);

  async function handleDelete() {
    setDeleting(true);
    const { error } = await supabase.from("lineas_altice").delete().eq("id", linea.id);
    setDeleting(false);
    if (error) { toast.error("Error al eliminar"); return; }
    toast.success("Línea eliminada");
    onDelete(linea.id);
    onClose();
  }

  async function handleArchivar() {
    const nuevaVal = !linea.archivada;
    setArchivando(true);
    const { error } = await supabase.from("lineas_altice").update({ archivada: nuevaVal }).eq("id", linea.id);
    setArchivando(false);
    if (error) { toast.error("Error al archivar"); return; }
    upsertLocal({ ...linea, archivada: nuevaVal });
    toast.success(nuevaVal ? "Línea archivada — oculta del listado principal" : "Línea restaurada ✓");
    onClose();
  }

  async function handleSave() {
    setSaving(true);
    const tieneImeiSim = !!(form.imei?.trim() && form.sim?.trim());
    const fechaHoy = new Date().toISOString().split("T")[0];
    const nuevaFecha = tieneImeiSim ? (form.fecha_entrega || fechaHoy) : null;
    const { error } = await supabase.from("lineas_altice").update({
      telefono: form.telefono,
      usuario_linea: form.usuario_linea,
      titular_responsable: form.titular_responsable,
      tipo: form.tipo,
      accion_2026: form.accion_2026,
      estado: form.estado,
      gb_antes: form.gb_antes,
      gb_solicitado: form.gb_solicitado,
      min_antes: form.min_antes,
      min_solicitados: form.min_solicitados,
      dispositivo_2026: form.dispositivo_2026,
      cotizacion: form.cotizacion,
      monto_mensual: form.monto_mensual,
      proxima_accion: form.proxima_accion,
      observaciones: form.observaciones,
      seguimiento: form.seguimiento,
      nota_resolucion: form.nota_resolucion,
      portabilidad: form.portabilidad ?? "",
      revisado_por: form.revisado_por,
      imei: form.imei ?? "",
      sim: form.sim ?? "",
      entregado: tieneImeiSim,
      fecha_entrega: nuevaFecha,
    }).eq("id", linea.id);
    if (error) { toast.error("Error al guardar"); setSaving(false); return; }

    // Sync inventory assignment
    if (selectedInvId) {
      // Un-assign previous if different
      const prev = inventarioItems.find(i => i.linea_id === linea.id && i.id !== selectedInvId);
      if (prev) await supabase.from("inventario_altice").update({ asignado: false, linea_id: null }).eq("id", prev.id);
      await supabase.from("inventario_altice").update({ asignado: true, linea_id: linea.id }).eq("id", selectedInvId);
    } else if (!form.imei?.trim()) {
      // If IMEI was cleared, un-assign any inventory item
      const prev = inventarioItems.find(i => i.linea_id === linea.id);
      if (prev) await supabase.from("inventario_altice").update({ asignado: false, linea_id: null }).eq("id", prev.id);
    }

    // Log changed fields to historial
    if (session) {
      const registros = (Object.keys(CAMPOS_ETIQUETAS) as (keyof LineaAltice)[])
        .filter(campo => {
          const prev = (linea[campo] ?? "").toString().trim();
          const next = (form[campo] ?? "").toString().trim();
          return prev !== next;
        })
        .map(campo => ({
          linea_id: linea.id,
          usuario_id: session.id,
          usuario_nombre: session.nombre,
          campo: CAMPOS_ETIQUETAS[campo]!,
          valor_anterior: (linea[campo] ?? "").toString() || null,
          valor_nuevo: (form[campo] ?? "").toString() || null,
        }));
      if (registros.length > 0) {
        await supabase.from("historial_cambios").insert(registros);
      }
    }

    setSaving(false);
    onSave({ ...form, entregado: tieneImeiSim, fecha_entrega: nuevaFecha });
    if (tieneImeiSim && !form.entregado) toast.success("IMEI/SIM asignados — marcado como entregado");
    else toast.success("Guardado");
    onClose();
  }

  function set(field: keyof LineaAltice, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  const inputCls = "w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelCls = "text-xs text-slate-500 mb-1 block font-medium";
  const sectionTitleCls = "text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3";
  const [drawerTab, setDrawerTab] = React.useState<"resumen" | "avanzado">("resumen");

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 h-full overflow-y-auto flex flex-col shadow-2xl">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div>
            <p className="font-bold text-slate-800 dark:text-white text-base">Editar línea</p>
            <p className="text-xs text-slate-400 flex items-center gap-1">{linea.telefono}{!linea.telefono?.startsWith("NUEVA") && <a href={`tel:+1${linea.telefono?.replace(/-/g, "")}`} title="Llamar" className="text-blue-500 hover:text-blue-700"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg></a>} · {linea.usuario_linea}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-800">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Tabs Resumen / Avanzado */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 px-4 gap-1 sticky top-[61px] bg-white dark:bg-slate-900 z-10">
          {(["resumen", "avanzado"] as const).map(t => (
            <button key={t} onClick={() => setDrawerTab(t)}
              className={`py-2.5 px-4 text-sm font-semibold border-b-2 transition-colors capitalize -mb-px ${drawerTab === t ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
              {t === "resumen" ? "⚡ Rápido" : "⚙️ Avanzado"}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-6 flex-1">
          {/* Panel de respuesta del formulario */}
          {drawerTab === "avanzado" && (
            <FormularioPanel
              titular={linea.titular_responsable ?? ""}
              usuario={linea.usuario_linea ?? ""}
            />
          )}

          {drawerTab === "avanzado" && <section>
            <p className={`${sectionTitleCls} flex items-center gap-1.5`}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Identificación</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Teléfono</label>
                <input value={form.telefono} onChange={e => set("telefono", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Tipo</label>
                <select value={form.tipo} onChange={e => set("tipo", e.target.value)} className={inputCls}>
                  {["", "EMPLEADO", "EMPLEADO 2", "FAMILIAR", "PASTORES", "DEPARTAMENTAL", "INSTITUCION", "JUBILADO", "EXTERNO", "UD", "DESVINCULAR", "N/D", "CONFLICTO"].map(v => (
                    <option key={v} value={v}>{v || "(sin tipo)"}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Usuario de la línea</label>
                <input value={form.usuario_linea} onChange={e => set("usuario_linea", e.target.value)} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Titular responsable</label>
                <input value={form.titular_responsable} onChange={e => set("titular_responsable", e.target.value)} className={inputCls} />
              </div>
            </div>
          </section>}

          <section>
            <p className={`${sectionTitleCls} flex items-center gap-1.5`}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Plan</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Data actual (GB)</label>
                <input value={form.gb_antes} onChange={e => set("gb_antes", e.target.value)} className={inputCls} placeholder="Ej: 5" />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Plan de datos solicitado</label>
                <select value={form.gb_solicitado} onChange={e => set("gb_solicitado", e.target.value)} className={inputCls}>
                  {PLANES_DATA.map(p => <option key={p} value={p}>{p || "(sin plan de datos)"}</option>)}
                </select>
                {form.gb_solicitado && !PLANES_DATA.includes(form.gb_solicitado) && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Valor actual: <span className="font-medium">{form.gb_solicitado}</span> — no está en la lista de planes
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>Minutos actuales</label>
                <input value={form.min_antes} onChange={e => set("min_antes", e.target.value)} className={inputCls} placeholder="Ej: 300" />
              </div>
              <div>
                <label className={labelCls}>Minutos solicitados</label>
                <input value={form.min_solicitados} onChange={e => set("min_solicitados", e.target.value)} className={inputCls} placeholder="Ej: 500" />
              </div>
            </div>
          </section>

          <section>
            <p className={`${sectionTitleCls} flex items-center gap-1.5`}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg> Dispositivo y Costo</p>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Dispositivo 2026</label>
                <select
                  value={form.dispositivo_2026}
                  onChange={e => set("dispositivo_2026", e.target.value)}
                  className={inputCls}>
                  <option value="">(sin dispositivo)</option>
                  {/* Opción actual si no está en el catálogo de almacén */}
                  {form.dispositivo_2026 && !dispositivosStock.find(d => d.dispositivo === form.dispositivo_2026) && (
                    <option value={form.dispositivo_2026}>{form.dispositivo_2026} (actual — sin stock registrado)</option>
                  )}
                  {dispositivosStock.map(d => {
                    const etiqueta = d.disponibles > 0
                      ? `${d.disponibles} disponible${d.disponibles !== 1 ? "s" : ""}`
                      : d.disponibles === 0
                        ? "Agotado"
                        : `Déficit (${Math.abs(d.disponibles)} de más)`;
                    return (
                      <option key={d.dispositivo} value={d.dispositivo}>
                        {d.dispositivo} — {etiqueta}
                      </option>
                    );
                  })}
                </select>

                {/* Aviso inline cuando el dispositivo seleccionado no tiene stock */}
                {(() => {
                  const sel = dispositivosStock.find(d => d.dispositivo === form.dispositivo_2026);
                  if (!sel || sel.disponibles > 0) return null;
                  return (
                    <div className="mt-2 flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2">
                      <span className="text-amber-500 leading-tight mt-0.5 shrink-0"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
                      <p className="text-xs text-amber-700 dark:text-amber-300 leading-snug">
                        {sel.disponibles === 0
                          ? <><strong>Sin stock disponible</strong> para <em>{sel.dispositivo}</em>. Puedes asignarlo de todas formas, pero actualiza el almacén cuando recibas más unidades.</>
                          : <><strong>Déficit de {Math.abs(sel.disponibles)} unidad{Math.abs(sel.disponibles) !== 1 ? "es" : ""}</strong> para <em>{sel.dispositivo}</em>. Ya hay más solicitudes que stock. Puedes continuar, pero verifica con el proveedor.</>
                        }
                      </p>
                    </div>
                  );
                })()}
              </div>
              <div>
                <label className={labelCls}>Cotización</label>
                <input value={form.cotizacion} onChange={e => set("cotizacion", e.target.value)}
                  placeholder="Ej: Pendiente, RD$45,000, Aprobado..." className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Monto mensual</label>
                <input value={form.monto_mensual} onChange={e => set("monto_mensual", e.target.value)}
                  placeholder="Ej: RD$1,200" className={inputCls} />
              </div>
            </div>
          </section>

          {drawerTab === "avanzado" && <section>
            <p className={`${sectionTitleCls} flex items-center gap-1.5`}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> IMEI y SIM</p>
            {(() => {
              const getKey = (s: string) => {
                const l = s.toLowerCase();
                if (l.includes("a56")) return "a56";
                if (l.includes("a17")) return "a17";
                if (l.includes("g56")) return "g56";
                return "";
              };
              const modeloKey = getKey(form.dispositivo_2026 || "");
              const typedSim = (form.sim || "").replace(/\D/g, "");
              const typedImei = (form.imei || "").replace(/\D/g, "");
              const baseFilter = (i: typeof inventarioItems[0]) => {
                if (i.asignado && i.linea_id !== linea.id) return false;
                if (modeloKey && getKey(i.marca) !== modeloKey) return false;
                return true;
              };
              const sugerencias = inventarioItems.filter(i => {
                if (!baseFilter(i)) return false;
                if (typedSim && !i.sim.includes(typedSim)) return false;
                return true;
              });
              const sugerenciasImei = inventarioItems.filter(i => {
                if (!baseFilter(i)) return false;
                if (typedImei && !i.imei.includes(typedImei)) return false;
                return true;
              });

              return (
                <div className="space-y-3">
                  {/* SIM combobox — el usuario elige la SIM y el IMEI aparece solo */}
                  <div className="relative">
                    <label className={labelCls}>
                      Tarjeta SIM / ICC
                      {selectedInvId && <span className="ml-2 text-teal-600 font-semibold">del inventario Altice</span>}
                    </label>
                    <input
                      value={form.sim || ""}
                      onChange={e => {
                        setForm(prev => ({ ...prev, sim: e.target.value }));
                        setSelectedInvId("");
                        setImeiOpen(true);
                      }}
                      onFocus={() => setImeiOpen(true)}
                      onBlur={() => setTimeout(() => setImeiOpen(false), 150)}
                      placeholder="Escribe el número de SIM para buscar..."
                      className={inputCls}
                      autoComplete="off"
                    />
                    {imeiOpen && sugerencias.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                        <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Inventario Altice — {sugerencias.length} disponible{sugerencias.length !== 1 ? "s" : ""}
                        </p>
                        {sugerencias.map(item => (
                          <button
                            key={item.id}
                            type="button"
                            onMouseDown={() => {
                              setForm(prev => ({ ...prev, sim: item.sim, imei: item.imei }));
                              setSelectedInvId(item.id);
                              setImeiOpen(false);
                            }}
                            className="w-full text-left px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-3 border-t border-slate-100 dark:border-slate-700 first:border-0"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-mono text-sm text-slate-800 dark:text-white">{item.sim}</p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                IMEI: {item.imei} · {item.marca.split(" ").slice(0, 3).join(" ")}
                                {item.linea_id === linea.id && <span className="text-teal-600 ml-2 font-semibold">asignado</span>}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* IMEI — combobox editable, también puede seleccionar del inventario */}
                  <div className="relative">
                    <label className={labelCls}>
                      IMEI
                      {selectedInvId && <span className="ml-2 text-teal-600 font-semibold">del inventario Altice</span>}
                    </label>
                    <input
                      value={form.imei || ""}
                      onChange={e => {
                        setForm(prev => ({ ...prev, imei: e.target.value.replace(/\D/g, "") }));
                        setSelectedInvId("");
                        setImeiDropOpen(true);
                      }}
                      onFocus={() => setImeiDropOpen(true)}
                      onBlur={() => setTimeout(() => setImeiDropOpen(false), 150)}
                      placeholder="Escribe o selecciona el IMEI..."
                      className={`${inputCls} font-mono tracking-wide`}
                      autoComplete="off"
                      maxLength={20}
                    />
                    {imeiDropOpen && sugerenciasImei.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                        <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Inventario Altice — {sugerenciasImei.length} disponible{sugerenciasImei.length !== 1 ? "s" : ""}
                        </p>
                        {sugerenciasImei.map(item => (
                          <button
                            key={item.id}
                            type="button"
                            onMouseDown={() => {
                              setForm(prev => ({ ...prev, imei: item.imei, sim: item.sim }));
                              setSelectedInvId(item.id);
                              setImeiDropOpen(false);
                            }}
                            className="w-full text-left px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-3 border-t border-slate-100 dark:border-slate-700 first:border-0"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-mono text-sm text-slate-800 dark:text-white">{item.imei}</p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                SIM: {item.sim} · {item.marca.split(" ").slice(0, 3).join(" ")}
                                {item.linea_id === linea.id && <span className="text-teal-600 ml-2 font-semibold">asignado</span>}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Badge entregado */}
                  {form.entregado && (
                    <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg px-3 py-2">
                      <span className="text-green-600"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.1 9 11.1"/></svg></span>
                      <p className="text-xs text-green-700 dark:text-green-300 font-medium">
                        Entregado el {form.fecha_entrega ? new Date(form.fecha_entrega).toLocaleDateString("es-DO", { year: "numeric", month: "long", day: "numeric" }) : "—"}
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}
          </section>}

          <section>
            <p className={`${sectionTitleCls} flex items-center gap-1.5`}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> Estatus</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Acción 2026</label>
                <select value={form.accion_2026} onChange={e => set("accion_2026", e.target.value)} className={inputCls}>
                  {["", "BAJA", "ALTA", "CAMBIO SOLICITADO", "SE MANTIENE", "REVISAR", "NO REQUIERE FLOTA"].map(v => (
                    <option key={v} value={v}>{v || "(sin acción)"}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Estado</label>
                <select value={form.estado} onChange={e => set("estado", e.target.value)} className={inputCls}>
                  {["", "CONFIRMADA", "POR CONFIRMAR", "PENDIENTE", "OK", "RESPONDIÓ", "SIN RESPUESTA"].map(v => (
                    <option key={v} value={v}>{v || "(sin estado)"}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Próxima acción</label>
                <select value={form.proxima_accion} onChange={e => set("proxima_accion", e.target.value)} className={inputCls}>
                  {["", "LLAMAR", "CARTA", "COTIZAR", "CANCELAR"].map(v => (
                    <option key={v} value={v}>{v || "(sin próxima acción)"}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>📶 Portabilidad</label>
                <select value={form.portabilidad ?? ""} onChange={e => set("portabilidad", e.target.value)}
                  className={`${inputCls} font-semibold ${PORTABILIDAD_COLORS[form.portabilidad ?? ""] ?? ""}`}>
                  {PORTABILIDAD_OPTIONS.map(v => (
                    <option key={v} value={v}>{v || "(sin portabilidad)"}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className={`${labelCls} flex items-center gap-1`}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> Nota de resolución</label>
                <textarea value={form.nota_resolucion} onChange={e => set("nota_resolucion", e.target.value)}
                  placeholder="Registra aquí qué acción tomaste, resultado de llamadas, confirmaciones, etc. (Ej: Llamada 11-06 — confirmó su plan. iPhone 17 Pro aprobado por director)"
                  rows={3} className={`${inputCls} resize-none`} />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Esta nota te ayuda a documentar el seguimiento sin perder la alerta original.</p>
              </div>
            </div>
          </section>

          {drawerTab === "avanzado" && <section>
            <p className={`${sectionTitleCls} flex items-center gap-1.5`}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.1 9 11.1"/></svg> Revisión</p>
            <div>
              <label className={labelCls}>Revisado por</label>
              <select value={form.revisado_por} onChange={e => set("revisado_por", e.target.value)} className={inputCls}>
                <option value="">(sin revisar)</option>
                <option value="Francis">Francis</option>
                <option value="Carlos">Carlos</option>
                <option value="Soto">Soto</option>
              </select>
            </div>
          </section>}

          {drawerTab === "avanzado" && <section>
            <p className={`${sectionTitleCls} flex items-center gap-1.5`}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Notas</p>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Observaciones</label>
                <textarea value={form.observaciones} onChange={e => set("observaciones", e.target.value)}
                  rows={2} className={inputCls + " resize-none"} />
              </div>
              <div>
                <label className={labelCls}>Seguimiento</label>
                <textarea value={form.seguimiento} onChange={e => set("seguimiento", e.target.value)}
                  rows={3} className={inputCls + " resize-none"} />
              </div>
            </div>
          </section>}

          {/* Historial de cambios */}
          {drawerTab === "avanzado" && <section>
            <p className={`${sectionTitleCls} flex items-center gap-1.5`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Historial de cambios
            </p>
            {historialLoading ? (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : historial.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">Sin cambios registrados aún</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {historial.map(entry => (
                  <div key={entry.id} className="text-xs bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2.5 border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                        {entry.usuario_nombre}
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        {new Date(entry.created_at).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" })}
                        {" "}
                        {new Date(entry.created_at).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      <span className="font-medium">{entry.campo}:</span>{" "}
                      <span className="line-through text-rose-400">{entry.valor_anterior || "(vacío)"}</span>
                      <span className="mx-1 text-slate-400">→</span>
                      <span className="text-emerald-600 dark:text-emerald-400">{entry.valor_nuevo || "(eliminado)"}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>}
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 sticky bottom-0 bg-white dark:bg-slate-900">
          {/* Confirmación de eliminación */}
          {confirmDelete && (
            <div className="px-4 pt-4 pb-2">
              <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl p-3">
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-400 mb-0.5">
                  ¿Eliminar esta línea permanentemente?
                </p>
                <p className="text-xs text-rose-600 dark:text-rose-500 mb-3">
                  Se borrará <strong>{linea.telefono}</strong> ({linea.usuario_linea || "sin nombre"}) de la base de datos. Esta acción no se puede deshacer.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 transition-colors">
                    Cancelar
                  </button>
                  <button onClick={handleDelete} disabled={deleting}
                    className="flex-1 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500 disabled:opacity-50 transition-colors">
                    {deleting ? "Eliminando..." : "Sí, eliminar"}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="p-4 flex gap-3">
            <button onClick={handleArchivar} disabled={archivando}
              className={`py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors flex items-center gap-1.5 border ${linea.archivada ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100" : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"}`}>
              {linea.archivada
                ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l1 11a2 2 0 002 2h12a2 2 0 002-2L21 9"/><path d="M21 3H3v6h18V3z"/><path d="M10 14h4"/></svg> Restaurar</>
                : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l1 11a2 2 0 002 2h12a2 2 0 002-2L21 9"/><path d="M21 3H3v6h18V3z"/><path d="M10 14h4"/></svg> Archivar</>}
            </button>
            <button onClick={() => setConfirmDelete(true)}
              disabled={confirmDelete}
              className="py-2.5 px-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-sm font-semibold hover:bg-rose-100 dark:hover:bg-rose-950/40 disabled:opacity-40 transition-colors border border-rose-200 dark:border-rose-800 flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg> Eliminar
            </button>
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-50 transition-colors">
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LineaRow({ linea, onEdit, dimmed, onMutate, selected, onToggleSelect }: {
  linea: LineaAltice; onEdit: () => void; dimmed?: boolean;
  onMutate: (id: string, patch: Partial<LineaAltice>) => void;
  selected?: boolean; onToggleSelect?: (id: string) => void;
}) {
  return (
    <div className={`p-4 ${dimmed ? "opacity-80 bg-purple-50/30 dark:bg-purple-900/10" : ""} ${selected ? "bg-blue-50/60 dark:bg-blue-900/10" : ""}`}>
      <div className="flex items-start gap-3">
        {onToggleSelect && (
          <button onClick={e => { e.stopPropagation(); onToggleSelect(linea.id); }}
            className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${selected ? "bg-blue-600 border-blue-600" : "border-slate-300 dark:border-slate-500 hover:border-blue-400"}`}>
            {selected && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>}
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-slate-800 dark:text-white">{linea.usuario_linea || "Sin nombre"}</span>
            <span className="font-mono text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 rounded">{linea.telefono}</span>
            {linea.tipo && <span className="text-xs text-slate-400">{linea.tipo}</span>}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span className="flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> <strong>{linea.gb_antes || "—"}</strong> → <strong className="text-blue-600 dark:text-blue-400">{linea.gb_solicitado || "—"}</strong> GB</span>
            <span className="flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg> <strong>{linea.min_antes || "—"}</strong> → <strong className="text-blue-600 dark:text-blue-400">{linea.min_solicitados || "—"}</strong> min</span>
            {linea.dispositivo_2026 && <span className="flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg> {linea.dispositivo_2026}</span>}
            {linea.monto_mensual && <span className="text-green-600 dark:text-green-400 font-semibold flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> {linea.monto_mensual}</span>}
            {linea.cotizacion && <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> {linea.cotizacion}</span>}
          </div>
          {linea.seguimiento && (
            <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500 italic line-clamp-1 flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> {linea.seguimiento}</p>
          )}
          <div className="mt-1.5" onClick={e => e.stopPropagation()}>
            <select
              value={linea.proxima_accion ?? ""}
              onChange={e => onMutate(linea.id, { proxima_accion: e.target.value })}
              className={`text-[11px] font-semibold px-2 py-0.5 rounded border cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-400 transition-colors ${
                linea.proxima_accion
                  ? "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-600"
              }`}>
              <option value="">▷ (sin próxima acción)</option>
              {["LLAMAR", "CARTA", "COTIZAR", "CANCELAR"].map(v => (
                <option key={v} value={v}>▶ {v}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 items-end shrink-0">
          <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${ACCION_COLORS[linea.accion_2026] ?? "bg-slate-100 text-slate-500"}`}>
            {linea.accion_2026 || "—"}
          </span>
          {linea.portabilidad && (
            <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${PORTABILIDAD_COLORS[linea.portabilidad] ?? "bg-slate-100 text-slate-500"}`}>
              📶 {linea.portabilidad}
            </span>
          )}
          {linea.archivada && (
            <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l1 11a2 2 0 002 2h12a2 2 0 002-2L21 9"/><path d="M21 3H3v6h18V3z"/><path d="M10 14h4"/></svg> Archivada
            </span>
          )}
          {linea.estado && (
            <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${ESTADO_LINEA_COLORS[linea.estado] ?? "bg-slate-100 text-slate-500"}`}>
              {linea.estado}
            </span>
          )}
          {linea.revisado_por ? (
            <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.1 9 11.1"/></svg> {linea.revisado_por}
            </span>
          ) : (
            <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500 flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg> Sin revisar
            </span>
          )}
          {linea.entregado ? (
            <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.1 9 11.1"/></svg> Entregado
            </span>
          ) : linea.imei?.trim() ? (
            <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg> IMEI asig.
            </span>
          ) : null}
          <button onClick={onEdit}
            className="mt-1 text-xs px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 font-semibold transition-colors flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PerfilesTab() {
  const { lineas: all, loading, mutate, upsertLocal, removeLocal, patchLocal } = useLineas();
  const { consumeFilter } = useNav();

  // Aplica filtro entrante desde el Dashboard al montarse
  useEffect(() => {
    const f = consumeFilter();
    if (!f) return;
    if (f.proximaAccion) setFilterProximaAccion(f.proximaAccion);
    if (f.accion)        setFilterAccion(f.accion);
    if (f.estado)        setFilterEstado(f.estado);
    if (f.titular)       setSearch(f.titular);
    if (f.search)        setSearch(f.search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [session] = useState<{ id: string; nombre: string } | null>(() => {
    if (typeof window === "undefined") return null;
    try { return JSON.parse(localStorage.getItem("flota_session") ?? "null"); } catch { return null; }
  });
  const [search, setSearch] = useState("");
  const [filterDispositivo, setFilterDispositivo] = useState("");
  const [filterGb, setFilterGb] = useState("");
  const [filterMin, setFilterMin] = useState("");
  const [filterProximaAccion, setFilterProximaAccion] = useState("");
  const [filterAccion, setFilterAccion] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  // Quick chips
  const [chipSinDispositivo, setChipSinDispositivo] = useState(false);
  const [chipSinMonto, setChipSinMonto] = useState(false);
  const [chipConSeguimiento, setChipConSeguimiento] = useState(false);
  const [chipSinRevisar, setChipSinRevisar] = useState(false);
  const [filterRevisadoPor, setFilterRevisadoPor] = useState("");
  const [filterPortabilidad, setFilterPortabilidad] = useState("");
  const [expandedTitular, setExpandedTitular] = useState<string | null>(null);
  const [editingLinea, setEditingLinea] = useState<LineaAltice | null>(null);
  const [vinculandoTitular, setVinculandoTitular] = useState<string | null>(null);
  // Modal nueva línea: null = cerrado, string = titular pre-llenado (puede ser "")
  const [nuevaLineaTitular, setNuevaLineaTitular] = useState<string | null>(null);
  // Selección masiva
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkField, setBulkField] = useState("");
  const [bulkValue, setBulkValue] = useState("");
  const [applyingBulk, setApplyingBulk] = useState(false);

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectGroup(ids: string[]) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = ids.every(id => next.has(id));
      if (allSelected) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  }

  async function applyBulk() {
    if (!bulkField || !bulkValue || selectedIds.size === 0) return;
    setApplyingBulk(true);
    const ids = [...selectedIds];
    const patch: Partial<LineaAltice> = { [bulkField]: bulkValue };
    await Promise.all(ids.map(id => mutate(id, patch)));
    setApplyingBulk(false);
    setSelectedIds(new Set());
    setBulkField("");
    setBulkValue("");
    toast.success(`${ids.length} líneas actualizadas ✓`);
  }

  async function bulkArchivar() {
    if (selectedIds.size === 0) return;
    setApplyingBulk(true);
    const ids = [...selectedIds];
    await Promise.all(ids.map(id => mutate(id, { archivada: true } as Partial<LineaAltice>)));
    setApplyingBulk(false);
    setSelectedIds(new Set());
    toast.success(`${ids.length} líneas archivadas ✓`);
  }

  async function bulkEliminar() {
    if (selectedIds.size === 0) return;
    if (!confirm(`¿Eliminar definitivamente ${selectedIds.size} líneas? Esta acción no se puede deshacer.`)) return;
    setApplyingBulk(true);
    const ids = [...selectedIds];
    await Promise.all(ids.map(id => supabase.from("lineas_altice").delete().eq("id", id)));
    ids.forEach(id => removeLocal(id));
    setApplyingBulk(false);
    setSelectedIds(new Set());
    toast.success(`${ids.length} líneas eliminadas`);
  }

  const todosLosTitulares = [...new Set(all.map(r => r.titular_responsable).filter(Boolean))].sort();

  async function guardarVinculo(titularOrigen: string, titularDestino: string) {
    const [r1, r2] = await Promise.all([
      supabase.from("lineas_altice").update({ titular_vinculado: titularDestino }).eq("titular_responsable", titularOrigen),
      supabase.from("lineas_altice").update({ titular_vinculado: titularOrigen }).eq("titular_responsable", titularDestino),
    ]);
    if (r1.error || r2.error) { toast.error("Error al vincular"); return; }
    patchLocal(prev => prev.map(r => {
      if (r.titular_responsable === titularOrigen) return { ...r, titular_vinculado: titularDestino };
      if (r.titular_responsable === titularDestino) return { ...r, titular_vinculado: titularOrigen };
      return r;
    }));
    toast.success("Perfiles vinculados ✓");
    setVinculandoTitular(null);
  }

  async function quitarVinculo(titular: string, vinculado: string) {
    await Promise.all([
      supabase.from("lineas_altice").update({ titular_vinculado: "" }).eq("titular_responsable", titular),
      supabase.from("lineas_altice").update({ titular_vinculado: "" }).eq("titular_responsable", vinculado),
    ]);
    patchLocal(prev => prev.map(r =>
      r.titular_responsable === titular || r.titular_responsable === vinculado
        ? { ...r, titular_vinculado: "" } : r
    ));
    toast.success("Vínculo eliminado");
  }

  function exportarPerfiles() {
    const rows = all.map(r => ({
      "Titular Responsable": r.titular_responsable,
      "Teléfono": r.telefono,
      "Usuario": r.usuario_linea,
      "Tipo": r.tipo,
      "Acción 2026": r.accion_2026,
      "GB Antes": r.gb_antes,
      "GB Solicitado": r.gb_solicitado,
      "Min Antes": r.min_antes,
      "Min Solicitados": r.min_solicitados,
      "Dispositivo 2026": r.dispositivo_2026,
      "Cotización": r.cotizacion,
      "Monto Mensual": r.monto_mensual,
      "Estado": r.estado,
      "Próxima Acción": r.proxima_accion,
      "Seguimiento": r.seguimiento,
      "Observaciones": r.observaciones,
      "Portabilidad": r.portabilidad,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length, 14) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Perfiles Flota 2026");
    XLSX.writeFile(wb, `Perfiles-Flota-${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success(`${all.length} perfiles exportados`);
  }

  function handleCreada(linea: LineaAltice) {
    upsertLocal(linea);
    // Expandir el grupo del titular recién creado
    if (linea.titular_responsable) setExpandedTitular(linea.titular_responsable);
  }

  const [showArchivadas, setShowArchivadas] = useState(false);
  const allActivas = showArchivadas ? all : all.filter(r => !r.archivada);
  const totalArchivadas = all.filter(r => r.archivada).length;

  const grupos: TitularGroup[] = Object.values(
    allActivas.reduce((acc, r) => {
      const key = r.titular_responsable || "Sin titular identificado";
      if (!acc[key]) acc[key] = { nombre: key, lineas: [] };
      acc[key].lineas.push(r);
      return acc;
    }, {} as Record<string, TitularGroup>)
  ).sort((a, b) => a.nombre.localeCompare(b.nombre));

  // Opciones únicas para los filtros
  const opcionesDispositivo = [...new Set(all.map(r => r.dispositivo_2026?.trim()).filter(Boolean))].sort() as string[];
  const opcionesGb = [...new Set(all.map(r => r.gb_solicitado?.trim() || r.gb_antes?.trim()).filter(Boolean))].sort((a, b) => parseFloat(a!) - parseFloat(b!)) as string[];
  const opcionesMin = [...new Set(all.map(r => r.min_solicitados?.trim() || r.min_antes?.trim()).filter(Boolean))].sort((a, b) => parseFloat(a!) - parseFloat(b!)) as string[];

  const hayFiltros = !!(search || filterDispositivo || filterGb || filterMin || filterProximaAccion || filterAccion || filterEstado || filterTipo || filterPortabilidad || chipSinDispositivo || chipSinMonto || chipConSeguimiento || chipSinRevisar || filterRevisadoPor);

  const gruposFiltrados = grupos.filter(g => {
    const q = search.toLowerCase();
    const coincideTexto = !search || g.nombre.toLowerCase().includes(q) ||
      g.lineas.some(l =>
        l.usuario_linea.toLowerCase().includes(q) ||
        l.telefono.includes(q) ||
        l.seguimiento.toLowerCase().includes(q)
      );
    if (!coincideTexto) return false;

    // Al menos una línea del grupo debe cumplir todos los filtros activos
    const tieneAlgunaLinea = g.lineas.some(l => {
      if (filterAccion && l.accion_2026 !== filterAccion) return false;
      if (filterEstado && l.estado !== filterEstado) return false;
      if (filterTipo && l.tipo !== filterTipo) return false;
      if (filterDispositivo && l.dispositivo_2026?.trim() !== filterDispositivo) return false;
      if (filterGb) { const gb = l.gb_solicitado?.trim() || l.gb_antes?.trim(); if (gb !== filterGb) return false; }
      if (filterMin) { const mn = l.min_solicitados?.trim() || l.min_antes?.trim(); if (mn !== filterMin) return false; }
      if (filterProximaAccion && l.proxima_accion !== filterProximaAccion) return false;
      if (chipSinDispositivo && l.dispositivo_2026?.trim() && l.dispositivo_2026.trim() !== "SIN CAMBIO" && l.dispositivo_2026.trim() !== "—") return false;
      if (chipSinMonto && l.monto_mensual?.trim() && parseFloat(l.monto_mensual.replace(/[^0-9.]/g, "")) > 0) return false;
      if (chipConSeguimiento && !l.seguimiento?.trim()) return false;
      if (chipSinRevisar && l.revisado_por?.trim()) return false;
      if (filterRevisadoPor && l.revisado_por?.trim() !== filterRevisadoPor) return false;
      if (filterPortabilidad && l.portabilidad !== filterPortabilidad) return false;
      return true;
    });

    if (filterAccion || filterEstado || filterTipo || filterDispositivo || filterGb || filterMin || filterProximaAccion || filterPortabilidad || chipSinDispositivo || chipSinMonto || chipConSeguimiento || chipSinRevisar || filterRevisadoPor) {
      return tieneAlgunaLinea;
    }
    return true;
  });

  const ACCIONES_ORDEN = ["BAJA", "ALTA", "CAMBIO SOLICITADO", "REVISAR", "SE MANTIENE", "NO REQUIERE FLOTA", ""];

  function sumaMontoGrupo(lineas: LineaAltice[]): number {
    return lineas.reduce((acc, r) => {
      if (!r.monto_mensual) return acc;
      const n = parseFloat(r.monto_mensual.replace(/[^0-9.]/g, ""));
      return acc + (isNaN(n) ? 0 : n);
    }, 0);
  }

  function fmtRD(n: number) {
    return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const BULK_FIELDS: { value: string; label: string; options: string[] }[] = [
    { value: "estado", label: "Estado", options: ["CONFIRMADA", "POR CONFIRMAR", "PENDIENTE", "OK", "RESPONDIÓ", "SIN RESPUESTA"] },
    { value: "accion_2026", label: "Acción 2026", options: ["BAJA", "ALTA", "CAMBIO SOLICITADO", "SE MANTIENE", "REVISAR"] },
    { value: "proxima_accion", label: "Próxima acción", options: ["", "LLAMAR", "CARTA", "COTIZAR", "CANCELAR"] },
    { value: "portabilidad", label: "Portabilidad", options: ["", "Altice", "Claro", "Nuevo", "Baja"] },
  ];
  const currentBulkOptions = BULK_FIELDS.find(f => f.value === bulkField)?.options ?? [];

  return (
    <div className="space-y-4">
      {/* Barra flotante de edición masiva */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl shadow-2xl px-4 py-3 flex flex-wrap items-center gap-3 max-w-2xl w-[calc(100%-2rem)]">
          <span className="text-sm font-bold text-blue-300 shrink-0">{selectedIds.size} seleccionada{selectedIds.size !== 1 ? "s" : ""}</span>
          <div className="flex-1 flex flex-wrap gap-2 items-center">
            <select value={bulkField} onChange={e => { setBulkField(e.target.value); setBulkValue(""); }}
              className="bg-slate-700 dark:bg-slate-600 text-white text-sm rounded-xl px-3 py-1.5 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Cambiar campo…</option>
              {BULK_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            {bulkField && (
              <select value={bulkValue} onChange={e => setBulkValue(e.target.value)}
                className="bg-slate-700 dark:bg-slate-600 text-white text-sm rounded-xl px-3 py-1.5 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Valor…</option>
                {currentBulkOptions.map(o => <option key={o} value={o}>{o || "(vacío)"}</option>)}
              </select>
            )}
            {bulkField && bulkValue !== undefined && bulkValue !== "" && (
              <button onClick={applyBulk} disabled={applyingBulk}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-1.5 rounded-xl transition-colors">
                {applyingBulk ? "Aplicando…" : "Aplicar"}
              </button>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={bulkArchivar} disabled={applyingBulk}
              className="text-amber-300 hover:text-amber-200 disabled:opacity-50 text-xs font-semibold flex items-center gap-1 border border-amber-700 rounded-lg px-2 py-1 hover:bg-amber-900/30 transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l1 11a2 2 0 002 2h12a2 2 0 002-2L21 9"/><path d="M21 3H3v6h18V3z"/><path d="M10 14h4"/></svg> Archivar
            </button>
            <button onClick={bulkEliminar} disabled={applyingBulk}
              className="text-rose-400 hover:text-rose-300 disabled:opacity-50 text-xs font-semibold flex items-center gap-1 border border-rose-800 rounded-lg px-2 py-1 hover:bg-rose-900/30 transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg> Eliminar
            </button>
            <button onClick={() => setSelectedIds(new Set())}
              className="text-slate-400 hover:text-white text-xs flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      )}

      {editingLinea && (
        <EditModal
          linea={editingLinea}
          onClose={() => setEditingLinea(null)}
          onSave={(updated) => upsertLocal(updated)}
          onDelete={(id) => removeLocal(id)}
          session={session}
          upsertLocal={upsertLocal}
        />
      )}

      {nuevaLineaTitular !== null && (
        <NuevaLineaModal
          titularInicial={nuevaLineaTitular}
          onClose={() => setNuevaLineaTitular(null)}
          onCreate={handleCreada}
        />
      )}

      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Perfiles por Titular</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {gruposFiltrados.length} titulares · {allActivas.length} líneas
            {totalArchivadas > 0 && <span className="ml-2 text-amber-600 dark:text-amber-400">· {totalArchivadas} archivadas</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {totalArchivadas > 0 && (
            <button onClick={() => setShowArchivadas(v => !v)}
              className={`text-sm px-4 py-2 rounded-xl font-semibold transition-colors flex items-center gap-1.5 border ${showArchivadas ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600"}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l1 11a2 2 0 002 2h12a2 2 0 002-2L21 9"/><path d="M21 3H3v6h18V3z"/><path d="M10 14h4"/></svg>
              {showArchivadas ? `Ocultar archivadas (${totalArchivadas})` : `Ver archivadas (${totalArchivadas})`}
            </button>
          )}
          <button onClick={exportarPerfiles}
            className="text-sm bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-xl font-semibold transition-colors flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Exportar Excel
          </button>
          <button onClick={() => setNuevaLineaTitular("")}
            className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-semibold transition-colors flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo Perfil
          </button>
        </div>
      </div>

      {/* Barra de filtros */}
      {(() => {
        const ACCIONES_LIST = ["BAJA", "ALTA", "CAMBIO SOLICITADO", "SE MANTIENE", "REVISAR", "NO REQUIERE FLOTA"];
        const ESTADOS_LIST = ["CONFIRMADA", "POR CONFIRMAR", "PENDIENTE", "OK", "RESPONDIÓ", "SIN RESPUESTA"];
        const TIPOS_LIST = ["EMPLEADO", "EMPLEADO 2", "FAMILIAR", "PASTORES", "DEPARTAMENTAL", "INSTITUCION", "JUBILADO", "EXTERNO", "UD", "DESVINCULAR", "N/D", "CONFLICTO"];
        const selCls = "border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
        const chipCls = (active: boolean) => `text-xs font-semibold px-3 py-1.5 rounded-full border cursor-pointer transition-all select-none ${active ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:text-blue-600"}`;
        const limpiarTodo = () => {
          setSearch(""); setFilterDispositivo(""); setFilterGb(""); setFilterMin("");
          setFilterProximaAccion(""); setFilterAccion(""); setFilterEstado(""); setFilterTipo("");
          setChipSinDispositivo(false); setChipSinMonto(false); setChipConSeguimiento(false); setChipSinRevisar(false); setFilterRevisadoPor("");
        };

        return (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
            {/* Fila 1 */}
            <div className="flex flex-wrap gap-2">
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar titular, usuario, teléfono o notas..."
                className={`flex-1 min-w-48 ${selCls}`} />
              <select value={filterAccion} onChange={e => setFilterAccion(e.target.value)} className={selCls}>
                <option value="">Todas las acciones</option>
                {ACCIONES_LIST.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} className={selCls}>
                <option value="">Todos los estados</option>
                {ESTADOS_LIST.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={filterProximaAccion} onChange={e => setFilterProximaAccion(e.target.value)} className={selCls}>
                <option value="">▶ Próxima acción</option>
                {["LLAMAR", "CARTA", "COTIZAR", "CANCELAR"].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {/* Fila 2 */}
            <div className="flex flex-wrap gap-2">
              <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className={selCls}>
                <option value="">Todos los tipos</option>
                {TIPOS_LIST.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={filterDispositivo} onChange={e => setFilterDispositivo(e.target.value)} className={selCls}>
                <option value="">Todos los equipos</option>
                {opcionesDispositivo.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={filterGb} onChange={e => setFilterGb(e.target.value)} className={selCls}>
                <option value="">Todos los GB</option>
                {opcionesGb.map(g => <option key={g} value={g}>{g} GB</option>)}
              </select>
              <select value={filterMin} onChange={e => setFilterMin(e.target.value)} className={selCls}>
                <option value="">Todos los min</option>
                {opcionesMin.map(m => <option key={m} value={m}>{m} min</option>)}
              </select>
              <select value={filterPortabilidad} onChange={e => setFilterPortabilidad(e.target.value)} className={selCls}>
                <option value="">Portabilidad</option>
                {PORTABILIDAD_OPTIONS.filter(Boolean).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={filterRevisadoPor} onChange={e => setFilterRevisadoPor(e.target.value)} className={selCls}>
                <option value="">Revisor — todos</option>
                <option value="Francis">Francis</option>
                <option value="Carlos">Carlos</option>
                <option value="Soto">Soto</option>
              </select>
            </div>

            {/* Chips rápidos */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Rápido:</span>
              <button className={chipCls(chipSinRevisar)} onClick={() => setChipSinRevisar(v => !v)}><span className="flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg> Sin revisar</span></button>
              <button className={chipCls(chipSinDispositivo)} onClick={() => setChipSinDispositivo(v => !v)}><span className="flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> Sin dispositivo</span></button>
              <button className={chipCls(chipSinMonto)} onClick={() => setChipSinMonto(v => !v)}><span className="flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> Sin monto</span></button>
              <button className={chipCls(chipConSeguimiento)} onClick={() => setChipConSeguimiento(v => !v)}><span className="flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Con notas</span></button>
              {["LLAMAR", "CARTA", "COTIZAR", "CANCELAR"].map(a => (
                <button key={a} className={chipCls(filterProximaAccion === a)}
                  onClick={() => setFilterProximaAccion(v => v === a ? "" : a)}>
                  <span className="flex items-center gap-1">
                    {a === "LLAMAR" ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg> : a === "CARTA" ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> : a === "COTIZAR" ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>} {a}
                  </span>
                </button>
              ))}
              {hayFiltros && (
                <button onClick={limpiarTodo} className="text-xs text-slate-400 hover:text-rose-500 underline ml-auto whitespace-nowrap flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Limpiar todo
                </button>
              )}
            </div>
          </div>
        );
      })()}

      <div className="space-y-3">
        {gruposFiltrados.map(g => {
          const isOpen = expandedTitular === g.nombre;
          const tieneProblema = !g.nombre || g.nombre === "Sin titular identificado";
          const acciones = g.lineas.map(l => l.accion_2026).filter(Boolean);
          const vinculadoNombre = g.lineas[0]?.titular_vinculado;
          const lineasVinculadas = vinculadoNombre
            ? all.filter(r => r.titular_responsable === vinculadoNombre)
            : [];
          const montoGrupo = sumaMontoGrupo(g.lineas);
          const tieneMontos = g.lineas.some(l => l.monto_mensual && parseFloat(l.monto_mensual.replace(/[^0-9.]/g, "")) > 0);

          return (
            <div key={g.nombre}
              className={`bg-white dark:bg-slate-800 rounded-2xl border transition-all ${tieneProblema ? "border-amber-300 dark:border-amber-700" : "border-slate-200 dark:border-slate-700"}`}>

              <div className="p-4 flex items-center gap-2">
                {/* Checkbox de grupo */}
                {(() => {
                  const ids = g.lineas.map(l => l.id);
                  const allSel = ids.every(id => selectedIds.has(id));
                  const someSel = ids.some(id => selectedIds.has(id));
                  return (
                    <button onClick={e => { e.stopPropagation(); selectGroup(ids); }}
                      className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${allSel ? "bg-blue-600 border-blue-600" : someSel ? "bg-blue-300 border-blue-400" : "border-slate-300 dark:border-slate-500 hover:border-blue-400"}`}>
                      {(allSel || someSel) && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>}
                    </button>
                  );
                })()}
                <button className="flex items-center gap-3 flex-1 text-left min-w-0"
                  onClick={() => setExpandedTitular(isOpen ? null : g.nombre)}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${tieneProblema ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                    {tieneProblema ? "?" : g.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm truncate ${tieneProblema ? "text-amber-700 dark:text-amber-400" : "text-slate-800 dark:text-white"}`}>
                      {g.nombre}
                    </p>
                    <p className="text-xs text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>{g.lineas.length} línea{g.lineas.length !== 1 ? "s" : ""}</span>
                      {tieneMontos && (
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> {fmtRD(montoGrupo)}/mes
                        </span>
                      )}
                      {vinculadoNombre && <span className="text-purple-500 font-semibold flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg> {vinculadoNombre}</span>}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-wrap shrink-0">
                    {acciones.includes("BAJA") && <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 font-semibold">BAJA</span>}
                    {acciones.includes("ALTA") && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-semibold">ALTA</span>}
                    {acciones.includes("CAMBIO SOLICITADO") && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-semibold">CAMBIO</span>}
                    {acciones.includes("REVISAR") && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 font-semibold">REVISAR</span>}
                  </div>
                  <span className="text-slate-400 text-sm ml-1 shrink-0">{isOpen ? "▲" : "▼"}</span>
                </button>

                {/* Botón agregar línea al titular */}
                {!tieneProblema && (
                  <button
                    onClick={() => { setNuevaLineaTitular(g.nombre); }}
                    title="Agregar línea a este titular"
                    className="text-xs px-2 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 font-semibold shrink-0 transition-colors flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                )}

                {!tieneProblema && (
                  <div className="relative shrink-0">
                    {vinculadoNombre ? (
                      <button onClick={() => quitarVinculo(g.nombre, vinculadoNombre)}
                        className="text-xs px-2 py-1.5 rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 hover:bg-purple-200 font-semibold flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg> Desvincular
                      </button>
                    ) : (
                      <button onClick={() => setVinculandoTitular(vinculandoTitular === g.nombre ? null : g.nombre)}
                        className="text-xs px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-purple-100 hover:text-purple-600 font-semibold flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg> Vincular
                      </button>
                    )}
                    {vinculandoTitular === g.nombre && (
                      <div className="absolute right-0 top-9 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl p-2 min-w-[220px]">
                        <p className="text-[11px] font-bold text-slate-400 uppercase px-2 pb-2">Vincular con:</p>
                        <div className="max-h-48 overflow-y-auto">
                          {todosLosTitulares.filter(t => t !== g.nombre).map(t => (
                            <button key={t} onClick={() => guardarVinculo(g.nombre, t)}
                              className="w-full text-left text-xs px-3 py-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg text-slate-700 dark:text-slate-300">
                              {t}
                            </button>
                          ))}
                        </div>
                        <button onClick={() => setVinculandoTitular(null)}
                          className="w-full mt-1 text-xs py-1.5 text-slate-400 hover:text-slate-600 text-center">
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isOpen && (
                <div className="border-t border-slate-100 dark:border-slate-700">
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {g.lineas
                      .sort((a, b) => ACCIONES_ORDEN.indexOf(a.accion_2026) - ACCIONES_ORDEN.indexOf(b.accion_2026))
                      .map(linea => (
                        <LineaRow key={linea.id} linea={linea} onEdit={() => setEditingLinea(linea)} onMutate={mutate} selected={selectedIds.has(linea.id)} onToggleSelect={toggleSelect} />
                      ))}
                  </div>

                  {/* Botón agregar línea dentro del grupo expandido */}
                  {!tieneProblema && (
                    <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700">
                      <button onClick={() => setNuevaLineaTitular(g.nombre)}
                        className="w-full py-2 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-600 text-slate-400 hover:border-blue-400 hover:text-blue-500 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Agregar línea a {g.nombre.split(" ")[0]}
                      </button>
                    </div>
                  )}

                  {lineasVinculadas.length > 0 && (
                    <div className="border-t-2 border-purple-200 dark:border-purple-800">
                      <div className="px-4 py-2.5 bg-purple-50 dark:bg-purple-900/20 flex items-center gap-2">
                        <p className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg> Dispositivos vinculados — {vinculadoNombre}
                        </p>
                        <span className="text-xs text-purple-400 ml-auto">{lineasVinculadas.length} línea{lineasVinculadas.length !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {lineasVinculadas
                          .sort((a, b) => ACCIONES_ORDEN.indexOf(a.accion_2026) - ACCIONES_ORDEN.indexOf(b.accion_2026))
                          .map(linea => (
                            <LineaRow key={linea.id} linea={linea} onEdit={() => setEditingLinea(linea)} dimmed onMutate={mutate} selected={selectedIds.has(linea.id)} onToggleSelect={toggleSelect} />
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {gruposFiltrados.length === 0 && (
        <div className="py-16 text-center text-slate-400">
          <div className="flex justify-center mb-2"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg></div>
          <p>No hay titulares con esa búsqueda</p>
        </div>
      )}
    </div>
  );
}
