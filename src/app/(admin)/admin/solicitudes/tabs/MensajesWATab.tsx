"use client";
import { useState, useMemo } from "react";
import { useLineas } from "@/lib/LineasContext";
import type { LineaAltice } from "@/lib/supabase";

const VARIABLES = [
    { clave: "{nombre}", desc: "Nombre del beneficiario" },
    { clave: "{titular}", desc: "Titular responsable" },
    { clave: "{dispositivo}", desc: "Dispositivo asignado" },
    { clave: "{linea}", desc: "Número de línea" },
    { clave: "{altice}", desc: "N.° Altice (temporal)" },
    { clave: "{datos}", desc: "Plan de datos" },
    { clave: "{monto}", desc: "Pago único por el equipo" },
];

function personalizarMensaje(plantilla: string, linea: LineaAltice): string {
    const datos = linea.gb_solicitado?.replace(/\s*\(RD\$[^)]+\)/g, "").trim() || "—";
    const monto = parseFloat(linea.monto_mensual || "0");
    return plantilla
        .replace(/{nombre}/g, linea.usuario_linea || "")
        .replace(/{titular}/g, linea.titular_responsable || "")
        .replace(/{dispositivo}/g, linea.dispositivo_2026 || "—")
        .replace(/{linea}/g, linea.telefono || "")
        .replace(/{altice}/g, linea.numero_altice || "—")
        .replace(/{datos}/g, datos)
        .replace(/{monto}/g, monto > 0 ? `RD$ ${monto.toLocaleString("es-DO", { minimumFractionDigits: 2 })}` : "—");
}

function numeroWA(linea: LineaAltice): string {
    const esNueva = linea.accion_2026 === "ALTA";
    const raw = esNueva ? (linea.numero_altice || linea.telefono) : linea.telefono;
    const limpio = raw?.replace(/\D/g, "") ?? "";
    return limpio.length === 10 ? `1${limpio}` : limpio;
}

const FILTROS_GB = [
    { label: "Todos", value: "" },
    { label: "No desean internet", value: "No deseo internet" },
    { label: "Con plan de datos", value: "con_datos" },
    { label: "No aplica", value: "No aplica" },
];

const FILTROS_ENTREGA = [
    { label: "Todos", value: "" },
    { label: "Pendientes", value: "pendiente" },
    { label: "Entregados", value: "entregado" },
];

export default function MensajesWATab() {
    const { lineas: all, loading } = useLineas();
    const [plantilla, setPlantilla] = useState(
        "Hola *{nombre}*, te escribimos desde la ADOSE para informarte sobre tu dispositivo asignado.\n\n📱 *Dispositivo:* {dispositivo}\n📞 *Línea:* {linea}\n\n_Francis Contreras_"
    );
    const [filtroGB, setFiltroGB] = useState("");
    const [filtroEntrega, setFiltroEntrega] = useState("");
    const [busqueda, setBusqueda] = useState("");
    const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
    const [previsualizando, setPrevisualizando] = useState<LineaAltice | null>(null);
    const [delaySegundos, setDelaySegundos] = useState(8);

    const lineas = useMemo(() => all.filter(l =>
        ["CAMBIO SOLICITADO", "ALTA", "SE MANTIENE"].includes(l.accion_2026)
    ), [all]);

    const filtradas = useMemo(() => lineas.filter(l => {
        if (filtroGB === "con_datos") {
            if (!l.gb_solicitado?.trim() || l.gb_solicitado === "No aplica" || l.gb_solicitado === "No deseo internet") return false;
        } else if (filtroGB) {
            if (l.gb_solicitado?.trim() !== filtroGB) return false;
        }
        if (filtroEntrega === "pendiente" && l.entregado) return false;
        if (filtroEntrega === "entregado" && !l.entregado) return false;
        if (busqueda) {
            const q = busqueda.toLowerCase();
            return l.usuario_linea?.toLowerCase().includes(q) || l.telefono?.includes(q) || l.titular_responsable?.toLowerCase().includes(q);
        }
        return true;
    }), [lineas, filtroGB, filtroEntrega, busqueda]);

    function toggleSeleccion(id: string) {
        setSeleccionados(prev => {
            const s = new Set(prev);
            s.has(id) ? s.delete(id) : s.add(id);
            return s;
        });
    }

    function seleccionarTodos() {
        setSeleccionados(new Set(filtradas.map(l => l.id)));
    }

    function deseleccionarTodos() {
        setSeleccionados(new Set());
    }

    function insertarVariable(v: string) {
        setPlantilla(prev => prev + v);
    }

    function abrirWA(linea: LineaAltice) {
        const num = numeroWA(linea);
        const msg = personalizarMensaje(plantilla, linea);
        window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank");
    }

    function enviarATodos() {
        const dest = filtradas.filter(l => seleccionados.has(l.id));
        dest.forEach((linea, i) => {
            setTimeout(() => abrirWA(linea), i * delaySegundos * 1000);
        });
    }

    const destinatariosSeleccionados = filtradas.filter(l => seleccionados.has(l.id));

    if (loading) return (
        <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="space-y-5">

            {/* Modal previsualización */}
            {previsualizando && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setPrevisualizando(null)} />
                    <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="font-bold text-slate-800 dark:text-white">Vista previa — {previsualizando.usuario_linea}</p>
                            <button onClick={() => setPrevisualizando(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap font-sans leading-relaxed border border-green-200 dark:border-green-800">
                            {personalizarMensaje(plantilla, previsualizando)}
                        </div>
                        <div className="text-xs text-slate-400">Enviará al número: <span className="font-mono">{numeroWA(previsualizando)}</span></div>
                        <button onClick={() => { abrirWA(previsualizando); setPrevisualizando(null); }}
                            className="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-semibold flex items-center justify-center gap-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                            Abrir en WhatsApp
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    Mensajes WhatsApp
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Prepara y envía mensajes personalizados a los beneficiarios</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Panel izquierdo: editor */}
                <div className="space-y-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">✏️ Redactar mensaje</p>

                        {/* Variables */}
                        <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Variables disponibles — clic para insertar:</p>
                            <div className="flex flex-wrap gap-1.5">
                                {VARIABLES.map(v => (
                                    <button key={v.clave} onClick={() => insertarVariable(v.clave)}
                                        title={v.desc}
                                        className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 font-mono border border-blue-200 dark:border-blue-800 transition-colors">
                                        {v.clave}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <textarea
                            value={plantilla}
                            onChange={e => setPlantilla(e.target.value)}
                            rows={10}
                            className="w-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-mono resize-none"
                            placeholder="Escribe tu mensaje aquí..."
                        />

                        <p className="text-xs text-slate-400">
                            Usa <span className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded">*texto*</span> para negrita y <span className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded">_texto_</span> para cursiva en WhatsApp.
                        </p>
                    </div>

                    {/* Filtros */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">🎯 Filtrar destinatarios</p>

                        <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                            placeholder="Buscar por nombre o teléfono..."
                            className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <p className="text-xs text-slate-500 mb-1">Plan de datos</p>
                                <select value={filtroGB} onChange={e => setFiltroGB(e.target.value)}
                                    className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                                    {FILTROS_GB.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 mb-1">Estado entrega</p>
                                <select value={filtroEntrega} onChange={e => setFiltroEntrega(e.target.value)}
                                    className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                                    {FILTROS_ENTREGA.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button onClick={seleccionarTodos}
                                className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 transition-colors">
                                Seleccionar todos ({filtradas.length})
                            </button>
                            <button onClick={deseleccionarTodos}
                                className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 transition-colors">
                                Deseleccionar
                            </button>
                        </div>

                        <div>
                            <p className="text-xs text-slate-500 mb-1">Segundos entre mensaje y mensaje</p>
                            <div className="flex items-center gap-3">
                                <input type="range" min={3} max={60} step={1} value={delaySegundos}
                                    onChange={e => setDelaySegundos(Number(e.target.value))}
                                    className="flex-1 accent-green-600" />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 w-14 text-right">{delaySegundos} seg</span>
                            </div>
                        </div>

                        {destinatariosSeleccionados.length > 0 && (
                            <button onClick={enviarATodos}
                                className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                                Enviar a {destinatariosSeleccionados.length} persona{destinatariosSeleccionados.length !== 1 ? "s" : ""} · {delaySegundos}s entre c/u
                            </button>
                        )}
                    </div>
                </div>

                {/* Panel derecho: lista de destinatarios */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                            Destinatarios <span className="text-slate-400 font-normal">({filtradas.length})</span>
                        </p>
                        {seleccionados.size > 0 && (
                            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-semibold px-2 py-0.5 rounded-full">
                                {seleccionados.size} seleccionados
                            </span>
                        )}
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[600px] overflow-y-auto">
                        {filtradas.length === 0 ? (
                            <div className="py-16 text-center text-slate-400 text-sm">No hay destinatarios con ese filtro</div>
                        ) : filtradas.map(linea => {
                            const seleccionado = seleccionados.has(linea.id);
                            return (
                                <div key={linea.id}
                                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${seleccionado ? "bg-green-50 dark:bg-green-900/10" : "hover:bg-slate-50 dark:hover:bg-slate-700/30"}`}>
                                    <input type="checkbox" checked={seleccionado} onChange={() => toggleSeleccion(linea.id)}
                                        className="w-4 h-4 accent-green-600 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{linea.usuario_linea || "—"}</p>
                                        <p className="text-xs text-slate-400 truncate">{linea.telefono} · {linea.gb_solicitado?.replace(/\s*\(RD\$[^)]+\)/g, "") || "Sin plan"}</p>
                                    </div>
                                    <div className="flex gap-1.5 flex-shrink-0">
                                        <button onClick={() => setPrevisualizando(linea)}
                                            title="Ver mensaje personalizado"
                                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200 transition-colors">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                        </button>
                                        <button onClick={() => abrirWA(linea)}
                                            title="Enviar WhatsApp"
                                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 transition-colors">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
