"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface Documento {
    id: string;
    nombre: string;
    descripcion: string;
    categoria: string;
    storage_path: string;
    mime_type: string;
    tamano_bytes: number;
    subido_por: string;
    created_at: string;
}

const CATEGORIAS = [
    "Contrato Altice",
    "Contrato Claro",
    "Cotización",
    "Carta formal",
    "Levantamiento",
    "Informe",
    "Otro",
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatFecha(iso: string): string {
    return new Date(iso).toLocaleDateString("es-DO", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

function iconForMime(mime: string) {
    if (mime.includes("pdf")) return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
        </svg>
    );
    if (mime.includes("sheet") || mime.includes("excel") || mime.includes("xlsx") || mime.includes("csv")) return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>
        </svg>
    );
    if (mime.includes("word") || mime.includes("docx") || mime.includes("doc")) return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
    );
    if (mime.includes("image")) return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
        </svg>
    );
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
        </svg>
    );
}

// ── Modal de subir archivo ─────────────────────────────────────────────────────
function SubirModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [nombre, setNombre] = useState("");
    const [descripcion, setDescripcion] = useState("");
    const [categoria, setCategoria] = useState("Contrato Altice");
    const [subidoPor, setSubidoPor] = useState("");
    const [uploading, setUploading] = useState(false);
    const [drag, setDrag] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const raw = typeof window !== "undefined" ? localStorage.getItem("flota_session") : null;
        if (raw) {
            try { setSubidoPor(JSON.parse(raw).nombre ?? ""); } catch { /* noop */ }
        }
    }, []);

    const handleFile = (f: File) => {
        setFile(f);
        if (!nombre) setNombre(f.name.replace(/\.[^.]+$/, ""));
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); setDrag(false);
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    };

    async function handleUpload() {
        if (!file || !nombre.trim()) { toast.error("Selecciona un archivo y escribe un nombre"); return; }
        setUploading(true);
        try {
            const ext = file.name.split(".").pop() ?? "";
            const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

            const { error: storageErr } = await supabase.storage
                .from("documentos-flota")
                .upload(path, file, { contentType: file.type, upsert: false });

            if (storageErr) throw storageErr;

            const { error: dbErr } = await supabase.from("documentos").insert({
                nombre: nombre.trim(),
                descripcion: descripcion.trim(),
                categoria,
                storage_path: path,
                mime_type: file.type,
                tamano_bytes: file.size,
                subido_por: subidoPor,
            });

            if (dbErr) { await supabase.storage.from("documentos-flota").remove([path]); throw dbErr; }

            toast.success("Archivo subido");
            onSuccess();
            onClose();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            toast.error("Error al subir: " + msg);
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700">
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Subir documento</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                    {/* Drop zone */}
                    <div
                        onDragOver={e => { e.preventDefault(); setDrag(true); }}
                        onDragLeave={() => setDrag(false)}
                        onDrop={handleDrop}
                        onClick={() => inputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${drag ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" : "border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}>
                        <input ref={inputRef} type="file" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                        {file ? (
                            <div className="flex items-center justify-center gap-3">
                                {iconForMime(file.type)}
                                <div className="text-left">
                                    <p className="font-semibold text-slate-800 dark:text-white text-sm">{file.name}</p>
                                    <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-slate-400 mb-2">
                                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                                </svg>
                                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Arrastra un archivo o haz clic</p>
                                <p className="text-xs text-slate-400 mt-1">PDF, Excel, Word, imagen — máx. 50 MB</p>
                            </>
                        )}
                    </div>

                    {/* Nombre */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Nombre del documento *</label>
                        <input
                            value={nombre}
                            onChange={e => setNombre(e.target.value)}
                            placeholder="Ej: Contrato Renovación Altice 2026"
                            className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Categoría */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Categoría</label>
                        <select
                            value={categoria}
                            onChange={e => setCategoria(e.target.value)}
                            className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                            {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                        </select>
                    </div>

                    {/* Descripción */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Descripción (opcional)</label>
                        <textarea
                            rows={2}
                            value={descripcion}
                            onChange={e => setDescripcion(e.target.value)}
                            placeholder="Breve descripción del contenido..."
                            className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex gap-3 justify-end">
                    <button onClick={onClose} disabled={uploading} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50">
                        Cancelar
                    </button>
                    <button
                        onClick={handleUpload}
                        disabled={uploading || !file}
                        className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                        {uploading ? (
                            <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Subiendo...</>
                        ) : (
                            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Subir</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Modal visor PDF ────────────────────────────────────────────────────────────
function VisorPDF({ doc, onClose }: { doc: Documento; onClose: () => void }) {
    const [url, setUrl] = useState<string | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        supabase.storage
            .from("documentos-flota")
            .createSignedUrl(doc.storage_path, 3600)
            .then(({ data, error }) => {
                if (error || !data?.signedUrl) setError(true);
                else setUrl(data.signedUrl);
            });
    }, [doc.storage_path]);

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm">
            {/* Barra superior */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-700 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400 shrink-0">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span className="text-white font-semibold text-sm truncate">{doc.nombre}</span>
                    <span className="text-slate-400 text-xs shrink-0">{formatBytes(doc.tamano_bytes)}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {url && (
                        <a
                            href={url}
                            download={doc.nombre}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 transition-colors">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            Descargar
                        </a>
                    )}
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-white transition-colors">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            </div>

            {/* Visor */}
            <div className="flex-1 min-h-0">
                {error ? (
                    <div className="flex items-center justify-center h-full text-slate-400">
                        <p>No se pudo cargar el documento.</p>
                    </div>
                ) : !url ? (
                    <div className="flex items-center justify-center h-full">
                        <svg className="animate-spin h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                    </div>
                ) : (
                    <iframe
                        src={url}
                        title={doc.nombre}
                        className="w-full h-full border-0"
                    />
                )}
            </div>
        </div>
    );
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function DocumentosTab() {
    const [docs, setDocs] = useState<Documento[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [search, setSearch] = useState("");
    const [catFiltro, setCatFiltro] = useState("Todos");
    const [eliminando, setEliminando] = useState<string | null>(null);
    const [visor, setVisor] = useState<Documento | null>(null);

    const cargar = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("documentos")
            .select("*")
            .order("created_at", { ascending: false });
        if (!error && data) setDocs(data as Documento[]);
        setLoading(false);
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    async function descargar(doc: Documento) {
        const { data, error } = await supabase.storage
            .from("documentos-flota")
            .createSignedUrl(doc.storage_path, 60);
        if (error || !data?.signedUrl) { toast.error("No se pudo generar el enlace"); return; }
        const a = document.createElement("a");
        a.href = data.signedUrl;
        a.download = doc.nombre;
        a.click();
    }

    async function eliminar(doc: Documento) {
        if (!confirm(`¿Eliminar "${doc.nombre}"? Esta acción no se puede deshacer.`)) return;
        setEliminando(doc.id);
        const { error: stErr } = await supabase.storage.from("documentos-flota").remove([doc.storage_path]);
        if (stErr) { toast.error("Error al eliminar el archivo del almacenamiento"); setEliminando(null); return; }
        const { error: dbErr } = await supabase.from("documentos").delete().eq("id", doc.id);
        if (dbErr) { toast.error("Archivo eliminado del storage pero no de la base de datos"); setEliminando(null); return; }
        toast.success("Documento eliminado");
        setDocs(prev => prev.filter(d => d.id !== doc.id));
        setEliminando(null);
    }

    const categorias = ["Todos", ...Array.from(new Set(docs.map(d => d.categoria))).sort()];

    const filtrados = docs.filter(d => {
        const matchCat = catFiltro === "Todos" || d.categoria === catFiltro;
        const q = search.toLowerCase();
        const matchSearch = !q || d.nombre.toLowerCase().includes(q) || d.descripcion.toLowerCase().includes(q) || d.subido_por.toLowerCase().includes(q);
        return matchCat && matchSearch;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Documentos</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {docs.length} archivo{docs.length !== 1 ? "s" : ""} · contratos, cotizaciones y documentos importantes
                    </p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all shadow-sm shadow-blue-200 dark:shadow-none">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Subir documento
                </button>
            </div>

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por nombre, descripción o autor..."
                        className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <select
                    value={catFiltro}
                    onChange={e => setCatFiltro(e.target.value)}
                    className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {categorias.map(c => <option key={c}>{c}</option>)}
                </select>
            </div>

            {/* Lista */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                </div>
            ) : filtrados.length === 0 ? (
                <div className="text-center py-20">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-slate-300 dark:text-slate-600 mb-3">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">
                        {docs.length === 0 ? "Aún no hay documentos subidos" : "Sin resultados para los filtros aplicados"}
                    </p>
                    {docs.length === 0 && (
                        <button onClick={() => setShowModal(true)} className="mt-3 text-sm text-blue-500 hover:underline font-medium">
                            Subir el primer documento →
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-2">
                    {filtrados.map(doc => (
                        <div key={doc.id} className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
                            {/* Icono */}
                            <div className="shrink-0 w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-700/50 flex items-center justify-center">
                                {iconForMime(doc.mime_type)}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{doc.nombre}</p>
                                    <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400">
                                        {doc.categoria}
                                    </span>
                                </div>
                                {doc.descripcion && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{doc.descripcion}</p>
                                )}
                                <p className="text-xs text-slate-400 mt-1">
                                    {formatBytes(doc.tamano_bytes)} · {doc.subido_por || "Desconocido"} · {formatFecha(doc.created_at)}
                                </p>
                            </div>

                            {/* Acciones */}
                            <div className="flex items-center gap-1 shrink-0">
                                {doc.mime_type.includes("pdf") && (
                                    <button
                                        onClick={() => setVisor(doc)}
                                        title="Ver en línea"
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-purple-50 dark:hover:bg-purple-950/30 hover:text-purple-600 transition-all">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                    </button>
                                )}
                                <button
                                    onClick={() => descargar(doc)}
                                    title="Descargar"
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-600 transition-all">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                </button>
                                <button
                                    onClick={() => eliminar(doc)}
                                    disabled={eliminando === doc.id}
                                    title="Eliminar"
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 transition-all disabled:opacity-50">
                                    {eliminando === doc.id
                                        ? <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                                    }
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && <SubirModal onClose={() => setShowModal(false)} onSuccess={cargar} />}
            {visor && <VisorPDF doc={visor} onClose={() => setVisor(null)} />}
        </div>
    );
}
