"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useConfigListas, LISTA_LABELS, type ConfigItem } from "@/lib/ConfigListasContext";
import toast from "react-hot-toast";

// ── Mapeo lista → columna en lineas_altice ────────────────────────────────────
const LISTA_COLUMNA: Record<string, string> = {
    accion_2026:    "accion_2026",
    estado_linea:   "estado",
    tipo_linea:     "tipo",
    portabilidad:   "portabilidad",
    proxima_accion: "proxima_accion",
    plan_datos:     "gb_solicitado",
};

// ── Orden fijo de secciones ───────────────────────────────────────────────────
const LISTAS_ORDEN = [
    "accion_2026",
    "estado_linea",
    "tipo_linea",
    "portabilidad",
    "proxima_accion",
    "plan_datos",
    "revisor",
];

// ── Colores de sección ────────────────────────────────────────────────────────
const SECTION_COLORS: Record<string, string> = {
    accion_2026:    "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
    estado_linea:   "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800",
    tipo_linea:     "bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800",
    portabilidad:   "bg-cyan-50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-800",
    proxima_accion: "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800",
    plan_datos:     "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800",
    revisor:        "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700",
};
const BADGE_COLORS: Record<string, string> = {
    accion_2026:    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    estado_linea:   "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    tipo_linea:     "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    portabilidad:   "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
    proxima_accion: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    plan_datos:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    revisor:        "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

// ── Modal de reemplazo antes de eliminar ──────────────────────────────────────
interface ReemplazarModalProps {
    valor: string;
    afectados: number;
    opciones: string[];
    onConfirm: (reemplazo: string | null) => void;
    onCancel: () => void;
}
function ReemplazarModal({ valor, afectados, opciones, onConfirm, onCancel }: ReemplazarModalProps) {
    const [seleccion, setSeleccion] = useState("");

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700">
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="text-amber-500">⚠️</span> Valor en uso
                    </h2>
                </div>
                <div className="px-6 py-5 space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        El valor <span className="font-bold text-slate-900 dark:text-white">«{valor}»</span> está asignado a{" "}
                        <span className="font-bold text-amber-600">{afectados} línea{afectados !== 1 ? "s" : ""}</span>.
                        Antes de eliminarlo, elige por cuál reemplazarlo.
                    </p>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                            Reemplazar por
                        </label>
                        <select
                            value={seleccion}
                            onChange={e => setSeleccion(e.target.value)}
                            className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">— Dejar en blanco —</option>
                            {opciones.filter(o => o !== valor).map(o => (
                                <option key={o} value={o}>{o}</option>
                            ))}
                        </select>
                        {!seleccion && (
                            <p className="text-[11px] text-slate-400 mt-1">
                                Si no eliges reemplazo, las líneas quedarán con ese campo vacío.
                            </p>
                        )}
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex gap-3 justify-end">
                    <button onClick={onCancel}
                        className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                        Cancelar
                    </button>
                    <button onClick={() => onConfirm(seleccion || null)}
                        className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-all">
                        Reemplazar y eliminar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Fila de un ítem ───────────────────────────────────────────────────────────
function ItemRow({
    item, lista, onDeleteRequest, onUpdate,
}: {
    item: ConfigItem;
    lista: string;
    onDeleteRequest: (item: ConfigItem) => void;
    onUpdate: (id: string, valor: string) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(item.valor);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

    function cancelEdit() { setDraft(item.valor); setEditing(false); }

    async function saveEdit() {
        const val = draft.trim();
        if (!val) { toast.error("El valor no puede estar vacío"); return; }
        if (val === item.valor) { setEditing(false); return; }
        await onUpdate(item.id, val);
        setEditing(false);
    }

    return (
        <div className="flex items-center gap-2 group py-1.5 px-2 rounded-xl hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors">
            <span className="text-slate-300 dark:text-slate-600 select-none text-sm">⠿</span>

            {editing ? (
                <>
                    <input
                        ref={inputRef}
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                        className="flex-1 border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button onClick={saveEdit} className="text-xs px-2.5 py-1 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors">
                        Guardar
                    </button>
                    <button onClick={cancelEdit} className="text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        Cancelar
                    </button>
                </>
            ) : (
                <>
                    <span className={`flex-1 text-sm font-medium px-2 py-0.5 rounded-lg ${BADGE_COLORS[lista] ?? "bg-slate-100 text-slate-700"}`}>
                        {item.valor}
                    </span>
                    <button
                        onClick={() => setEditing(true)}
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all flex items-center justify-center text-xs"
                        title="Editar">
                        ✏️
                    </button>
                    <button
                        onClick={() => onDeleteRequest(item)}
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all flex items-center justify-center text-xs"
                        title="Eliminar">
                        🗑️
                    </button>
                </>
            )}
        </div>
    );
}

// ── Sección de una lista ──────────────────────────────────────────────────────
function ListaSection({ lista, items, onAdd, onDeleteRequest, onUpdate }: {
    lista: string;
    items: ConfigItem[];
    onAdd: (lista: string, valor: string) => Promise<void>;
    onDeleteRequest: (item: ConfigItem, lista: string) => void;
    onUpdate: (id: string, valor: string) => void;
}) {
    const [newVal, setNewVal] = useState("");
    const [adding, setAdding] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

    async function handleAdd() {
        const val = newVal.trim();
        if (!val) return;
        await onAdd(lista, val);
        setNewVal("");
        setAdding(false);
    }

    return (
        <div className={`rounded-2xl border p-4 space-y-2 ${SECTION_COLORS[lista] ?? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}>
            <div className="flex items-center justify-between mb-1">
                <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                        {LISTA_LABELS[lista] ?? lista}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono">{lista}</p>
                </div>
                <span className="text-xs text-slate-400">{items.length} valores</span>
            </div>

            {items.length === 0 && (
                <p className="text-xs text-slate-400 italic px-2">Sin valores. Agrega el primero.</p>
            )}
            {items.map(item => (
                <ItemRow
                    key={item.id}
                    item={item}
                    lista={lista}
                    onDeleteRequest={i => onDeleteRequest(i, lista)}
                    onUpdate={onUpdate}
                />
            ))}

            {adding ? (
                <div className="flex items-center gap-2 pt-1">
                    <input
                        ref={inputRef}
                        value={newVal}
                        onChange={e => setNewVal(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setAdding(false); setNewVal(""); } }}
                        placeholder="Nuevo valor…"
                        className="flex-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button onClick={handleAdd} className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors">
                        Agregar
                    </button>
                    <button onClick={() => { setAdding(false); setNewVal(""); }} className="text-xs px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        Cancelar
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => setAdding(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors px-2 pt-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Agregar valor
                </button>
            )}
        </div>
    );
}

// ── Tab principal ─────────────────────────────────────────────────────────────
export default function ConfiguracionTab() {
    const { items, loading, reload } = useConfigListas();

    // Estado del modal de reemplazo
    const [pendingDelete, setPendingDelete] = useState<{
        item: ConfigItem;
        lista: string;
        afectados: number;
        opciones: string[];
    } | null>(null);

    const listas = [
        ...LISTAS_ORDEN,
        ...Array.from(new Set(items.map(i => i.lista))).filter(l => !LISTAS_ORDEN.includes(l)),
    ];

    // ── Agregar ───────────────────────────────────────────────────────────────
    async function handleAdd(lista: string, valor: string) {
        const existing = items.filter(i => i.lista === lista);
        const maxOrden = existing.length > 0 ? Math.max(...existing.map(i => i.orden)) : 0;
        const { error } = await supabase
            .from("config_listas")
            .insert({ lista, valor, orden: maxOrden + 1, activo: true });
        if (error) { toast.error("Error al agregar"); return; }
        toast.success("Valor agregado");
        await reload();
    }

    // ── Editar — propaga el renombre a lineas_altice ──────────────────────────
    async function handleUpdate(id: string, valorNuevo: string) {
        // Valor anterior
        const item = items.find(i => i.id === id);
        const valorAnterior = item?.valor;
        const lista = item?.lista;

        const { error } = await supabase.from("config_listas").update({ valor: valorNuevo }).eq("id", id);
        if (error) { toast.error("Error al actualizar"); return; }

        // Propagar a lineas_altice si la lista tiene columna mapeada
        if (valorAnterior && lista && LISTA_COLUMNA[lista]) {
            const columna = LISTA_COLUMNA[lista];
            const { count } = await supabase
                .from("lineas_altice")
                .select("id", { count: "exact", head: true })
                .eq(columna, valorAnterior);
            if (count && count > 0) {
                await supabase
                    .from("lineas_altice")
                    .update({ [columna]: valorNuevo })
                    .eq(columna, valorAnterior);
                toast.success(`Actualizado y propagado a ${count} línea${count !== 1 ? "s" : ""}`);
            } else {
                toast.success("Actualizado");
            }
        } else {
            toast.success("Actualizado");
        }
        await reload();
    }

    // ── Solicitud de eliminación — verificar si está en uso ───────────────────
    async function handleDeleteRequest(item: ConfigItem, lista: string) {
        const columna = LISTA_COLUMNA[lista];

        if (!columna) {
            // Lista sin columna mapeada (ej. revisor) → eliminar directo
            await ejecutarDelete(item.id, null, null);
            return;
        }

        // Contar cuántas líneas usan este valor
        const { count } = await supabase
            .from("lineas_altice")
            .select("id", { count: "exact", head: true })
            .eq(columna, item.valor);

        if (!count || count === 0) {
            // Nadie usa este valor → eliminar directo sin confirmar
            await ejecutarDelete(item.id, null, null);
            return;
        }

        // Hay líneas afectadas → mostrar modal de reemplazo
        const opciones = items.filter(i => i.lista === lista).map(i => i.valor);
        setPendingDelete({ item, lista, afectados: count, opciones });
    }

    // ── Ejecutar eliminación (con reemplazo opcional) ─────────────────────────
    async function ejecutarDelete(id: string, columna: string | null, reemplazo: string | null) {
        if (columna) {
            // Obtener el valor del ítem que se elimina
            const item = items.find(i => i.id === id);
            if (item) {
                await supabase
                    .from("lineas_altice")
                    .update({ [columna]: reemplazo ?? "" })
                    .eq(columna, item.valor);
            }
        }
        const { error } = await supabase.from("config_listas").delete().eq("id", id);
        if (error) { toast.error("Error al eliminar"); return; }
        toast.success(columna && reemplazo
            ? `Valor eliminado y reemplazado por «${reemplazo}»`
            : "Valor eliminado");
        await reload();
    }

    // ── Confirmar reemplazo desde modal ───────────────────────────────────────
    async function handleConfirmReplace(reemplazo: string | null) {
        if (!pendingDelete) return;
        const columna = LISTA_COLUMNA[pendingDelete.lista] ?? null;
        await ejecutarDelete(pendingDelete.item.id, columna, reemplazo);
        setPendingDelete(null);
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white">Configuración</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        Edita los valores de los menús desplegables. Los cambios se aplican de inmediato.
                    </p>
                </div>
            </div>

            {/* Aviso */}
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl px-4 py-3 flex items-start gap-3">
                <span className="text-blue-500 text-lg shrink-0">ℹ️</span>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                    Si eliminas un valor que ya tiene líneas asignadas, la aplicación te pedirá elegir un reemplazo antes de proceder.
                </p>
            </div>

            {/* Cuadrícula de listas */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {listas.map(lista => (
                        <ListaSection
                            key={lista}
                            lista={lista}
                            items={items.filter(i => i.lista === lista)}
                            onAdd={handleAdd}
                            onDeleteRequest={handleDeleteRequest}
                            onUpdate={handleUpdate}
                        />
                    ))}
                </div>
            )}

            {/* ── CAMBIOS MASIVOS ─────────────────────────────────────── */}
            <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">Cambios masivos</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                    Activa los campos que quieres poder modificar en bloque al seleccionar varias líneas.
                </p>
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
                    {[
                        { valor: "estado",           label: "Estado",           desc: "Confirmada, Por confirmar, Pendiente…" },
                        { valor: "accion_2026",      label: "Acción 2026",      desc: "Baja, Alta, Cambio solicitado…" },
                        { valor: "proxima_accion",   label: "Próxima acción",   desc: "Llamar, Carta, Cotizar, Cancelar" },
                        { valor: "portabilidad",     label: "Portabilidad",     desc: "Altice, Claro, Nuevo, Baja…" },
                        { valor: "gb_solicitado",    label: "Datos (GB)",       desc: "Plan de datos solicitado" },
                        { valor: "dispositivo_2026", label: "Dispositivo",      desc: "Equipo asignado para 2026" },
                        { valor: "tipo",             label: "Tipo de línea",    desc: "Titular, Familiar, Flota…" },
                    ].map(campo => {
                        const item = items.find(i => i.lista === "bulk_campos" && i.valor === campo.valor);
                        const activo = item?.activo ?? false;
                        async function toggle() {
                            if (!item) {
                                // Crear el registro
                                const { data } = await supabase.from("config_listas")
                                    .insert({ lista: "bulk_campos", valor: campo.valor, orden: 99, activo: true })
                                    .select().single();
                                if (data) await reload();
                            } else {
                                await supabase.from("config_listas").update({ activo: !activo }).eq("id", item.id);
                                await reload();
                            }
                        }
                        return (
                            <div key={campo.valor} className="flex items-center justify-between px-4 py-3 gap-4">
                                <div>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{campo.label}</p>
                                    <p className="text-xs text-slate-400">{campo.desc}</p>
                                </div>
                                <button type="button" onClick={toggle}
                                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${activo ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"}`}>
                                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${activo ? "translate-x-5" : "translate-x-0"}`} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Modal de reemplazo */}
            {pendingDelete && (
                <ReemplazarModal
                    valor={pendingDelete.item.valor}
                    afectados={pendingDelete.afectados}
                    opciones={pendingDelete.opciones}
                    onConfirm={handleConfirmReplace}
                    onCancel={() => setPendingDelete(null)}
                />
            )}
        </div>
    );
}
