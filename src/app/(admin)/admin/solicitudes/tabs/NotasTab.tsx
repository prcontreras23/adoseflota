"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useLineas } from "@/lib/LineasContext";
import toast from "react-hot-toast";

// ── Tipos ────────────────────────────────────────────────────────────────────
interface Nota {
    id: string;
    titular_responsable: string;
    telefono: string | null;
    texto: string;
    autor: string;
    created_at: string;
    updated_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fechaCorta(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" });
}
function horaCorta(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" });
}

// ── Color avatar por titular ──────────────────────────────────────────────────
const COLORS = [
    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
    "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
    "bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300",
];
const titularColorMap: Record<string, string> = {};
let colorIdx = 0;
function titularColor(t: string) {
    if (!titularColorMap[t]) {
        titularColorMap[t] = COLORS[colorIdx % COLORS.length];
        colorIdx++;
    }
    return titularColorMap[t];
}
function initials(name: string) {
    return name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");
}

// ── Modal Nueva / Editar nota ─────────────────────────────────────────────────
interface ModalProps {
    nota?: Nota | null;
    titulares: string[];
    autor: string;
    onClose: () => void;
    onSaved: (nota: Nota) => void;
}
function NotaModal({ nota, titulares, autor, onClose, onSaved }: ModalProps) {
    const [titular, setTitular] = useState(nota?.titular_responsable ?? "");
    const [titularCustom, setTitularCustom] = useState("");
    const [telefono, setTelefono] = useState(nota?.telefono ?? "");
    const [texto, setTexto] = useState(nota?.texto ?? "");
    const [saving, setSaving] = useState(false);
    const textRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => { textRef.current?.focus(); }, []);

    const titularFinal = titular === "__OTRO__" ? titularCustom : titular;

    async function handleSave() {
        if (!texto.trim()) { toast.error("Escribe el contenido de la nota"); return; }
        setSaving(true);
        const payload = {
            titular_responsable: titularFinal.trim() || "General",
            telefono: telefono.trim() || null,
            texto: texto.trim(),
            autor: autor || "Admin",
            updated_at: new Date().toISOString(),
        };
        if (nota) {
            const { data, error } = await supabase
                .from("notas_perfil")
                .update(payload)
                .eq("id", nota.id)
                .select()
                .single();
            if (error) { toast.error("Error al guardar"); setSaving(false); return; }
            toast.success("Nota actualizada");
            onSaved(data as Nota);
        } else {
            const { data, error } = await supabase
                .from("notas_perfil")
                .insert(payload)
                .select()
                .single();
            if (error) { toast.error("Error al guardar"); setSaving(false); return; }
            toast.success("Nota guardada");
            onSaved(data as Nota);
        }
        setSaving(false);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                        {nota ? "Editar nota" : "Nueva nota"}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors text-xl leading-none">×</button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                    {/* Titular */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Titular / Perfil</label>
                        <select
                            value={titular}
                            onChange={e => setTitular(e.target.value)}
                            className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">— General (sin titular) —</option>
                            {titulares.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                            <option value="__OTRO__">Otro (escribir)…</option>
                        </select>
                        {titular === "__OTRO__" && (
                            <input
                                type="text"
                                value={titularCustom}
                                onChange={e => setTitularCustom(e.target.value)}
                                placeholder="Nombre del titular"
                                className="mt-2 w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        )}
                    </div>

                    {/* Teléfono (opcional) */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Teléfono asociado <span className="font-normal normal-case">(opcional)</span></label>
                        <input
                            type="text"
                            value={telefono}
                            onChange={e => setTelefono(e.target.value)}
                            placeholder="Ej. 829-521-5430"
                            className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Contenido */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Nota</label>
                        <textarea
                            ref={textRef}
                            value={texto}
                            onChange={e => setTexto(e.target.value)}
                            rows={5}
                            placeholder="Escribe la nota aquí…"
                            className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex gap-3 justify-end">
                    <button onClick={onClose} disabled={saving}
                        className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50">
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={saving || !texto.trim()}
                        className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all disabled:opacity-50 flex items-center gap-2">
                        {saving ? (
                            <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Guardando…</>
                        ) : nota ? "Actualizar" : "Guardar nota"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Tarjeta de nota ───────────────────────────────────────────────────────────
interface CardProps {
    nota: Nota;
    onEdit: () => void;
    onDelete: () => void;
}
function NotaCard({ nota, onEdit, onDelete }: CardProps) {
    const [confirmDel, setConfirmDel] = useState(false);
    const avatarClass = titularColor(nota.titular_responsable || "General");

    return (
        <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
            {/* Header de la tarjeta */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${avatarClass}`}>
                        {initials(nota.titular_responsable || "GE")}
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white leading-tight">
                            {nota.titular_responsable || <span className="italic text-slate-400">General</span>}
                        </p>
                        {nota.telefono && (
                            <p className="text-[11px] text-slate-400 font-mono mt-0.5">{nota.telefono}</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <button onClick={onEdit}
                        className="w-7 h-7 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all flex items-center justify-center text-xs"
                        title="Editar">
                        ✏️
                    </button>
                    {confirmDel ? (
                        <div className="flex items-center gap-1">
                            <button onClick={onDelete}
                                className="px-2 py-1 rounded-lg text-[11px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-all">
                                Eliminar
                            </button>
                            <button onClick={() => setConfirmDel(false)}
                                className="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all">
                                No
                            </button>
                        </div>
                    ) : (
                        <button onClick={() => setConfirmDel(true)}
                            className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all flex items-center justify-center text-xs"
                            title="Eliminar">
                            🗑️
                        </button>
                    )}
                </div>
            </div>

            {/* Texto */}
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{nota.texto}</p>

            {/* Footer */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700">
                <span className="text-[11px] text-slate-400">
                    {nota.autor && <span className="font-medium text-slate-500 dark:text-slate-400">{nota.autor} · </span>}
                    {fechaCorta(nota.created_at)} a las {horaCorta(nota.created_at)}
                </span>
                {nota.updated_at !== nota.created_at && (
                    <span className="text-[10px] text-slate-300 dark:text-slate-600 italic">editada</span>
                )}
            </div>
        </div>
    );
}

// ── Tab principal ─────────────────────────────────────────────────────────────
export default function NotasTab() {
    const { lineas } = useLineas();
    const [notas, setNotas] = useState<Nota[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterTitular, setFilterTitular] = useState("");
    const [filterAutor, setFilterAutor] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editingNota, setEditingNota] = useState<Nota | null>(null);
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    // Sesión del usuario
    const [autorSesion, setAutorSesion] = useState("Admin");
    useEffect(() => {
        const raw = typeof window !== "undefined" ? localStorage.getItem("flota_session") : null;
        if (raw) {
            try { setAutorSesion(JSON.parse(raw).nombre ?? "Admin"); } catch { /* noop */ }
        }
    }, []);

    // Carga inicial
    async function fetchNotas() {
        setLoading(true);
        const { data, error } = await supabase
            .from("notas_perfil")
            .select("*")
            .order("created_at", { ascending: false });
        if (!error && data) setNotas(data as Nota[]);
        setLoading(false);
    }
    useEffect(() => { fetchNotas(); }, []);

    // Suscripción Realtime
    useEffect(() => {
        const channel = supabase
            .channel("notas-tab-realtime")
            .on("postgres_changes", { event: "*", schema: "public", table: "notas_perfil" }, () => {
                fetchNotas();
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    // Listas únicas — titulares vienen de lineas_altice para que el dropdown esté siempre completo
    const titulares = useMemo(() => {
        const fromLineas = lineas.map(l => l.titular_responsable).filter(Boolean);
        const fromNotas = notas.map(n => n.titular_responsable).filter(Boolean);
        const set = new Set([...fromLineas, ...fromNotas]);
        return Array.from(set).sort() as string[];
    }, [lineas, notas]);

    const autores = useMemo(() => {
        const set = new Set(notas.map(n => n.autor).filter(Boolean));
        return Array.from(set).sort();
    }, [notas]);

    // Filtrado
    const filtered = useMemo(() => {
        return notas.filter(n => {
            if (filterTitular && n.titular_responsable !== filterTitular) return false;
            if (filterAutor && n.autor !== filterAutor) return false;
            if (search) {
                const q = search.toLowerCase();
                if (
                    !n.texto?.toLowerCase().includes(q) &&
                    !n.titular_responsable?.toLowerCase().includes(q) &&
                    !n.telefono?.toLowerCase().includes(q) &&
                    !n.autor?.toLowerCase().includes(q)
                ) return false;
            }
            return true;
        });
    }, [notas, search, filterTitular, filterAutor]);

    // CRUD
    function handleSaved(nota: Nota) {
        setNotas(prev => {
            const idx = prev.findIndex(n => n.id === nota.id);
            if (idx >= 0) { const arr = [...prev]; arr[idx] = nota; return arr; }
            return [nota, ...prev];
        });
        setShowModal(false);
        setEditingNota(null);
    }

    async function handleDelete(id: string) {
        const { error } = await supabase.from("notas_perfil").delete().eq("id", id);
        if (error) { toast.error("Error al eliminar"); return; }
        setNotas(prev => prev.filter(n => n.id !== id));
        toast.success("Nota eliminada");
    }

    function openEdit(nota: Nota) {
        setEditingNota(nota);
        setShowModal(true);
    }
    function openNew() {
        setEditingNota(null);
        setShowModal(true);
    }
    function closeModal() {
        setShowModal(false);
        setEditingNota(null);
    }

    // KPIs rápidos
    const totalNotas = notas.length;
    const totalTitulares = titulares.length;
    const hoy = new Date().toDateString();
    const notasHoy = notas.filter(n => new Date(n.created_at).toDateString() === hoy).length;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white">Notas</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        Registro de observaciones, llamadas y decisiones por perfil
                    </p>
                </div>
                <button
                    onClick={openNew}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-sm shadow-blue-200 dark:shadow-none shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nueva nota
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: "Total notas", value: totalNotas, color: "text-blue-600 dark:text-blue-400" },
                    { label: "Perfiles con notas", value: totalTitulares, color: "text-violet-600 dark:text-violet-400" },
                    { label: "Notas hoy", value: notasHoy, color: "text-emerald-600 dark:text-emerald-400" },
                ].map(k => (
                    <div key={k.label} className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3.5">
                        <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{k.label}</p>
                    </div>
                ))}
            </div>

            {/* Filtros */}
            <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3.5 flex flex-wrap gap-3 items-center">
                {/* Búsqueda */}
                <div className="relative flex-1 min-w-[200px]">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar en notas…"
                        className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Titular */}
                <select
                    value={filterTitular}
                    onChange={e => setFilterTitular(e.target.value)}
                    className="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Todos los perfiles</option>
                    {titulares.map(t => <option key={t} value={t}>{t}</option>)}
                </select>

                {/* Autor */}
                {autores.length > 1 && (
                    <select
                        value={filterAutor}
                        onChange={e => setFilterAutor(e.target.value)}
                        className="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Todos los autores</option>
                        {autores.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                )}

                {/* Vista */}
                <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                    <button
                        onClick={() => setViewMode("grid")}
                        className={`p-1.5 rounded-lg transition-all ${viewMode === "grid" ? "bg-white dark:bg-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}
                        title="Vista cuadrícula">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                    </button>
                    <button
                        onClick={() => setViewMode("list")}
                        className={`p-1.5 rounded-lg transition-all ${viewMode === "list" ? "bg-white dark:bg-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}
                        title="Vista lista">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                    </button>
                </div>

                {/* Reset */}
                {(search || filterTitular || filterAutor) && (
                    <button
                        onClick={() => { setSearch(""); setFilterTitular(""); setFilterAutor(""); }}
                        className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline transition-colors">
                        Limpiar filtros
                    </button>
                )}

                <span className="text-xs text-slate-400 ml-auto">
                    {filtered.length} nota{filtered.length !== 1 ? "s" : ""}
                </span>
            </div>

            {/* Contenido */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl mb-4">📝</div>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">
                        {notas.length === 0 ? "Aún no hay notas" : "No hay notas con esos filtros"}
                    </p>
                    {notas.length === 0 && (
                        <button onClick={openNew}
                            className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all">
                            Crear la primera nota
                        </button>
                    )}
                </div>
            ) : (
                <div className={viewMode === "grid"
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                    : "flex flex-col gap-3"}>
                    {filtered.map(nota => (
                        <NotaCard
                            key={nota.id}
                            nota={nota}
                            onEdit={() => openEdit(nota)}
                            onDelete={() => handleDelete(nota.id)}
                        />
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <NotaModal
                    nota={editingNota}
                    titulares={titulares}
                    autor={autorSesion}
                    onClose={closeModal}
                    onSaved={handleSaved}
                />
            )}
        </div>
    );
}
