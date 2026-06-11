"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase, type LineaAltice, ACCION_COLORS, ESTADO_LINEA_COLORS } from "@/lib/supabase";
import toast from "react-hot-toast";
import NuevaLineaModal from "./NuevaLineaModal";

interface TitularGroup {
  nombre: string;
  lineas: LineaAltice[];
}

function EditModal({ linea, onClose, onSave, onDelete }: {
  linea: LineaAltice;
  onClose: () => void;
  onSave: (updated: LineaAltice) => void;
  onDelete: (id: string) => void;
}) {
  const [form, setForm] = useState<LineaAltice>({ ...linea });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const { error } = await supabase.from("lineas_altice").delete().eq("id", linea.id);
    setDeleting(false);
    if (error) { toast.error("Error al eliminar"); return; }
    toast.success("Línea eliminada");
    onDelete(linea.id);
    onClose();
  }

  async function handleSave() {
    setSaving(true);
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
    }).eq("id", linea.id);
    setSaving(false);
    if (error) { toast.error("Error al guardar"); return; }
    onSave(form);
    toast.success("Guardado ✓");
    onClose();
  }

  function set(field: keyof LineaAltice, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  const inputCls = "w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelCls = "text-xs text-slate-500 mb-1 block font-medium";
  const sectionTitleCls = "text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3";

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 h-full overflow-y-auto flex flex-col shadow-2xl">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div>
            <p className="font-bold text-slate-800 dark:text-white text-base">Editar línea</p>
            <p className="text-xs text-slate-400">{linea.telefono} · {linea.usuario_linea}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-800 text-lg">✕</button>
        </div>

        <div className="p-4 space-y-6 flex-1">
          <section>
            <p className={sectionTitleCls}>👤 Identificación</p>
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
          </section>

          <section>
            <p className={sectionTitleCls}>📶 Plan</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Data actual (GB)</label>
                <input value={form.gb_antes} onChange={e => set("gb_antes", e.target.value)} className={inputCls} placeholder="Ej: 5" />
              </div>
              <div>
                <label className={labelCls}>Data solicitada (GB)</label>
                <input value={form.gb_solicitado} onChange={e => set("gb_solicitado", e.target.value)} className={inputCls} placeholder="Ej: 10" />
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
            <p className={sectionTitleCls}>📱 Dispositivo y Costo</p>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Dispositivo 2026</label>
                <input value={form.dispositivo_2026} onChange={e => set("dispositivo_2026", e.target.value)}
                  placeholder="Ej: Samsung A56, iPhone 17 Pro Max..." className={inputCls} />
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

          <section>
            <p className={sectionTitleCls}>📋 Estatus</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Acción 2026</label>
                <select value={form.accion_2026} onChange={e => set("accion_2026", e.target.value)} className={inputCls}>
                  {["", "BAJA", "ALTA", "CAMBIO SOLICITADO", "SE MANTIENE", "REVISAR"].map(v => (
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
            </div>
          </section>

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
            <button onClick={() => setConfirmDelete(true)}
              disabled={confirmDelete}
              className="py-2.5 px-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-sm font-semibold hover:bg-rose-100 dark:hover:bg-rose-950/40 disabled:opacity-40 transition-colors border border-rose-200 dark:border-rose-800">
              🗑 Eliminar
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

function LineaRow({ linea, onEdit, dimmed }: { linea: LineaAltice; onEdit: () => void; dimmed?: boolean }) {
  return (
    <div className={`p-4 ${dimmed ? "opacity-80 bg-purple-50/30 dark:bg-purple-900/10" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-slate-800 dark:text-white">{linea.usuario_linea || "Sin nombre"}</span>
            <span className="font-mono text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 rounded">{linea.telefono}</span>
            {linea.tipo && <span className="text-xs text-slate-400">{linea.tipo}</span>}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span>📶 <strong>{linea.gb_antes || "—"}</strong> → <strong className="text-blue-600 dark:text-blue-400">{linea.gb_solicitado || "—"}</strong> GB</span>
            <span>📞 <strong>{linea.min_antes || "—"}</strong> → <strong className="text-blue-600 dark:text-blue-400">{linea.min_solicitados || "—"}</strong> min</span>
            {linea.dispositivo_2026 && <span>📱 {linea.dispositivo_2026}</span>}
            {linea.monto_mensual && <span className="text-green-600 dark:text-green-400 font-semibold">💰 {linea.monto_mensual}</span>}
            {linea.cotizacion && <span className="text-amber-600 dark:text-amber-400">📋 {linea.cotizacion}</span>}
          </div>
          {linea.seguimiento && (
            <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500 italic line-clamp-1">💬 {linea.seguimiento}</p>
          )}
          {linea.proxima_accion && (
            <span className="mt-1.5 inline-block text-[11px] bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded px-2 py-0.5 font-semibold">
              ▶ {linea.proxima_accion}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5 items-end shrink-0">
          <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${ACCION_COLORS[linea.accion_2026] ?? "bg-slate-100 text-slate-500"}`}>
            {linea.accion_2026 || "—"}
          </span>
          {linea.estado && (
            <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${ESTADO_LINEA_COLORS[linea.estado] ?? "bg-slate-100 text-slate-500"}`}>
              {linea.estado}
            </span>
          )}
          <button onClick={onEdit}
            className="mt-1 text-xs px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 font-semibold transition-colors">
            ✏️ Editar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PerfilesTab() {
  const [all, setAll] = useState<LineaAltice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedTitular, setExpandedTitular] = useState<string | null>(null);
  const [editingLinea, setEditingLinea] = useState<LineaAltice | null>(null);
  const [vinculandoTitular, setVinculandoTitular] = useState<string | null>(null);
  // Modal nueva línea: null = cerrado, string = titular pre-llenado (puede ser "")
  const [nuevaLineaTitular, setNuevaLineaTitular] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("lineas_altice").select("*").order("usuario_linea");
    setAll((data ?? []) as LineaAltice[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const todosLosTitulares = [...new Set(all.map(r => r.titular_responsable).filter(Boolean))].sort();

  async function guardarVinculo(titularOrigen: string, titularDestino: string) {
    const [r1, r2] = await Promise.all([
      supabase.from("lineas_altice").update({ titular_vinculado: titularDestino }).eq("titular_responsable", titularOrigen),
      supabase.from("lineas_altice").update({ titular_vinculado: titularOrigen }).eq("titular_responsable", titularDestino),
    ]);
    if (r1.error || r2.error) { toast.error("Error al vincular"); return; }
    setAll(prev => prev.map(r => {
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
    setAll(prev => prev.map(r =>
      r.titular_responsable === titular || r.titular_responsable === vinculado
        ? { ...r, titular_vinculado: "" } : r
    ));
    toast.success("Vínculo eliminado");
  }

  function handleCreada(linea: LineaAltice) {
    setAll(prev => [...prev, linea]);
    // Expandir el grupo del titular recién creado
    if (linea.titular_responsable) setExpandedTitular(linea.titular_responsable);
  }

  const grupos: TitularGroup[] = Object.values(
    all.reduce((acc, r) => {
      const key = r.titular_responsable || "Sin titular identificado";
      if (!acc[key]) acc[key] = { nombre: key, lineas: [] };
      acc[key].lineas.push(r);
      return acc;
    }, {} as Record<string, TitularGroup>)
  ).sort((a, b) => a.nombre.localeCompare(b.nombre));

  const gruposFiltrados = grupos.filter(g => {
    if (!search) return true;
    const q = search.toLowerCase();
    return g.nombre.toLowerCase().includes(q) ||
      g.lineas.some(l => l.usuario_linea.toLowerCase().includes(q) || l.telefono.includes(q));
  });

  const ACCIONES_ORDEN = ["BAJA", "ALTA", "CAMBIO SOLICITADO", "REVISAR", "SE MANTIENE", ""];

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

  return (
    <div className="space-y-4">
      {editingLinea && (
        <EditModal
          linea={editingLinea}
          onClose={() => setEditingLinea(null)}
          onSave={(updated) => setAll(prev => prev.map(r => r.id === updated.id ? updated : r))}
          onDelete={(id) => setAll(prev => prev.filter(r => r.id !== id))}
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
          <p className="text-sm text-slate-500 dark:text-slate-400">{gruposFiltrados.length} titulares · {all.length} líneas totales</p>
        </div>
        <button onClick={() => setNuevaLineaTitular("")}
          className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-semibold transition-colors">
          ➕ Nuevo Perfil
        </button>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Buscar titular, usuario o teléfono..."
        className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />

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
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          💰 {fmtRD(montoGrupo)}/mes
                        </span>
                      )}
                      {vinculadoNombre && <span className="text-purple-500 font-semibold">🔗 {vinculadoNombre}</span>}
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
                    className="text-xs px-2 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 font-semibold shrink-0 transition-colors">
                    ➕
                  </button>
                )}

                {!tieneProblema && (
                  <div className="relative shrink-0">
                    {vinculadoNombre ? (
                      <button onClick={() => quitarVinculo(g.nombre, vinculadoNombre)}
                        className="text-xs px-2 py-1.5 rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 hover:bg-purple-200 font-semibold">
                        🔗 Desvincular
                      </button>
                    ) : (
                      <button onClick={() => setVinculandoTitular(vinculandoTitular === g.nombre ? null : g.nombre)}
                        className="text-xs px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-purple-100 hover:text-purple-600 font-semibold">
                        🔗 Vincular
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
                        <LineaRow key={linea.id} linea={linea} onEdit={() => setEditingLinea(linea)} />
                      ))}
                  </div>

                  {/* Botón agregar línea dentro del grupo expandido */}
                  {!tieneProblema && (
                    <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700">
                      <button onClick={() => setNuevaLineaTitular(g.nombre)}
                        className="w-full py-2 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-600 text-slate-400 hover:border-blue-400 hover:text-blue-500 text-sm font-semibold transition-colors">
                        ➕ Agregar línea a {g.nombre.split(" ")[0]}
                      </button>
                    </div>
                  )}

                  {lineasVinculadas.length > 0 && (
                    <div className="border-t-2 border-purple-200 dark:border-purple-800">
                      <div className="px-4 py-2.5 bg-purple-50 dark:bg-purple-900/20 flex items-center gap-2">
                        <p className="text-xs font-bold text-purple-600 dark:text-purple-400">
                          🔗 Dispositivos vinculados — {vinculadoNombre}
                        </p>
                        <span className="text-xs text-purple-400 ml-auto">{lineasVinculadas.length} línea{lineasVinculadas.length !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {lineasVinculadas
                          .sort((a, b) => ACCIONES_ORDEN.indexOf(a.accion_2026) - ACCIONES_ORDEN.indexOf(b.accion_2026))
                          .map(linea => (
                            <LineaRow key={linea.id} linea={linea} onEdit={() => setEditingLinea(linea)} dimmed />
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
          <p className="text-4xl mb-2">👥</p>
          <p>No hay titulares con esa búsqueda</p>
        </div>
      )}
    </div>
  );
}
