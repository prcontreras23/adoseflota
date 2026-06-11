"use client";
import { useState, useEffect } from "react";
import { supabase, type LineaAltice } from "@/lib/supabase";
import toast from "react-hot-toast";

const ACCIONES = ["", "BAJA", "ALTA", "CAMBIO SOLICITADO", "SE MANTIENE", "REVISAR", "NO REQUIERE FLOTA"];
const ESTADOS = ["", "CONFIRMADA", "POR CONFIRMAR", "PENDIENTE", "OK", "RESPONDIÓ", "SIN RESPUESTA"];
const TIPOS = ["", "EMPLEADO", "EMPLEADO 2", "FAMILIAR", "PASTORES", "DEPARTAMENTAL", "INSTITUCION", "JUBILADO", "EXTERNO", "UD", "DESVINCULAR", "N/D", "CONFLICTO"];
const PROXIMAS = ["", "LLAMAR", "CARTA", "COTIZAR", "CANCELAR"];
const PLANES_DATA = [
  "",
  "Data 5GB + Bono 2GB (RD$711.00)",
  "Data 10GB + Bono 5GB (RD$1,161.00)",
  "Data 15GB + Bono 5GB (RD$1,251.00)",
  "Data 25GB + Bono 5GB (RD$1,791.00)",
  "Data 50GB + Bono 50GB (RD$3,681.00)",
  "No deseo internet",
];

interface Dispositivo {
  dispositivo: string;
  disponibles: number;
}

const VACIO: LineaAltice = {
  id: "",
  telefono: "",
  usuario_linea: "",
  titular_responsable: "",
  tipo: "",
  accion_2026: "",
  detalle_origen: "",
  gb_antes: "",
  gb_solicitado: "",
  min_antes: "",
  min_solicitados: "",
  dispositivo_2026: "",
  estado: "",
  proxima_accion: "",
  observaciones: "",
  seguimiento: "",
  nota_resolucion: "",
  monto_mensual: "",
  cotizacion: "",
  titular_vinculado: "",
  revisado_por: "",
};

interface Props {
  titularInicial?: string;
  onClose: () => void;
  onCreate: (linea: LineaAltice) => void;
}

export default function NuevaLineaModal({ titularInicial, onClose, onCreate }: Props) {
  const [form, setForm] = useState<LineaAltice>({ ...VACIO, titular_responsable: titularInicial ?? "" });
  const [saving, setSaving] = useState(false);
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);

  useEffect(() => {
    async function loadDispositivos() {
      const { data } = await supabase.from("almacen_dispositivos").select("dispositivo, disponibles");
      setDispositivos(data || []);
    }
    loadDispositivos();
  }, []);

  async function handleSave() {
    if (!form.telefono.trim()) {
      toast.error("El teléfono es obligatorio");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.from("lineas_altice").insert([form]).select().single();
    setSaving(false);
    if (error) {
      if (error.code === "23505") toast.error("Ese número ya existe en la base de datos");
      else toast.error("Error al crear: " + error.message);
      return;
    }
    onCreate(data as LineaAltice);
    toast.success("Línea creada ✓");
    onClose();
  }

  function set(field: keyof LineaAltice, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  const inputCls =
    "w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 " +
    "text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelCls = "text-xs text-slate-500 mb-1 block font-medium";
  const sectionTitleCls = "text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3";

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 h-full overflow-y-auto flex flex-col shadow-2xl">

        {/* Encabezado */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div>
            <p className="font-bold text-slate-800 dark:text-white text-base">➕ Nueva línea</p>
            <p className="text-xs text-slate-400">Completa los campos y guarda para añadir a la BD</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-800 text-lg">
            ✕
          </button>
        </div>

        <div className="p-4 space-y-6 flex-1">

          {/* Identificación */}
          <section>
            <p className={sectionTitleCls}>👤 Identificación</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Teléfono <span className="text-red-500">*</span></label>
                <input value={form.telefono} onChange={e => set("telefono", e.target.value)}
                  placeholder="829-XXX-XXXX o NUEVA" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Tipo</label>
                <select value={form.tipo} onChange={e => set("tipo", e.target.value)} className={inputCls}>
                  {TIPOS.map(v => <option key={v} value={v}>{v || "(sin tipo)"}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Usuario de la línea</label>
                <input value={form.usuario_linea} onChange={e => set("usuario_linea", e.target.value)}
                  placeholder="Nombre del usuario" className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Titular responsable</label>
                <input value={form.titular_responsable} onChange={e => set("titular_responsable", e.target.value)}
                  placeholder="Nombre del titular" className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Detalle origen</label>
                <input value={form.detalle_origen} onChange={e => set("detalle_origen", e.target.value)}
                  placeholder="Ej: Portabilidad desde Claro, Nueva solicitud..." className={inputCls} />
              </div>
            </div>
          </section>

          {/* Plan */}
          <section>
            <p className={sectionTitleCls}>📶 Plan</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Data actual (GB)</label>
                <input value={form.gb_antes} onChange={e => set("gb_antes", e.target.value)}
                  placeholder="Ej: 5" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Plan de datos solicitado</label>
                <select value={form.gb_solicitado} onChange={e => set("gb_solicitado", e.target.value)} className={inputCls}>
                  {PLANES_DATA.map(p => <option key={p} value={p}>{p || "(sin plan de datos)"}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Minutos actuales</label>
                <input value={form.min_antes} onChange={e => set("min_antes", e.target.value)}
                  placeholder="Ej: 300" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Minutos solicitados</label>
                <input value={form.min_solicitados} onChange={e => set("min_solicitados", e.target.value)}
                  placeholder="Ej: 500" className={inputCls} />
              </div>
            </div>
          </section>

          {/* Dispositivo */}
          <section>
            <p className={sectionTitleCls}>📱 Dispositivo y Costo</p>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Dispositivo 2026</label>
                <select value={form.dispositivo_2026} onChange={e => set("dispositivo_2026", e.target.value)} className={inputCls}>
                  <option value="">(sin dispositivo)</option>
                  {dispositivos.map(d => {
                    const etiqueta = d.disponibles > 0 ? `✓ ${d.disponibles}` : `⚠ ${d.disponibles}`;
                    return (
                      <option key={d.dispositivo} value={d.dispositivo}>
                        {d.dispositivo} — {etiqueta}
                      </option>
                    );
                  })}
                </select>
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

          {/* Estatus */}
          <section>
            <p className={sectionTitleCls}>📋 Estatus</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Acción 2026</label>
                <select value={form.accion_2026} onChange={e => set("accion_2026", e.target.value)} className={inputCls}>
                  {ACCIONES.map(v => <option key={v} value={v}>{v || "(sin acción)"}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Estado</label>
                <select value={form.estado} onChange={e => set("estado", e.target.value)} className={inputCls}>
                  {ESTADOS.map(v => <option key={v} value={v}>{v || "(sin estado)"}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Próxima acción</label>
                <select value={form.proxima_accion} onChange={e => set("proxima_accion", e.target.value)} className={inputCls}>
                  {PROXIMAS.map(v => <option key={v} value={v}>{v || "(sin próxima acción)"}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>💬 Nota de resolución</label>
                <textarea value={form.nota_resolucion} onChange={e => set("nota_resolucion", e.target.value)}
                  placeholder="Registra aquí qué acción tomaste, resultado de llamadas, confirmaciones, etc."
                  rows={3} className={`${inputCls} resize-none`} />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Esta nota te ayuda a documentar el seguimiento sin perder la alerta original.</p>
              </div>
            </div>
          </section>

          {/* Notas */}
          <section>
            <p className={sectionTitleCls}>📝 Notas</p>
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
          </section>

          {/* Revisión */}
          <section>
            <p className={sectionTitleCls}>✅ Revisión</p>
            <div>
              <label className={labelCls}>Revisado por</label>
              <select value={form.revisado_por} onChange={e => set("revisado_por", e.target.value)} className={inputCls}>
                <option value="">(sin revisar)</option>
                <option value="Francis">Francis</option>
                <option value="Carlos">Carlos</option>
                <option value="Soto">Soto</option>
              </select>
            </div>
          </section>
        </div>

        {/* Pie */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-3 sticky bottom-0 bg-white dark:bg-slate-900">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-50 transition-colors">
            {saving ? "Guardando..." : "Crear línea"}
          </button>
        </div>
      </div>
    </div>
  );
}
