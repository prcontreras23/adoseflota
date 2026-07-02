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
        .replace(/{monto}/g, monto > 0 ? `RD$ ${monto.toLocaleString("es-DO", { minimumFractionDigits: 2 })}` : "Libre de costo");
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

    // Modo envío uno por uno
    const [modoEnvio, setModoEnvio] = useState(false);
    const [indiceActual, setIndiceActual] = useState(0);
    const [enviados, setEnviados] = useState<Set<string>>(new Set());
    const [waAbierto, setWaAbierto] = useState(false);

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

    const cola = filtradas.filter(l => seleccionados.has(l.id));

    function toggleSeleccion(id: string) {
        setSeleccionados(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
    }

    function iniciarEnvio() {
        if (cola.length === 0) return;
        setIndiceActual(0);
        setEnviados(new Set());
        setWaAbierto(false);
        setModoEnvio(true);
    }

    function abrirWAActual() {
        const linea = cola[indiceActual];
        if (!linea) return;
        const num = numeroWA(linea);
        const msg = personalizarMensaje(plantilla, linea);
        window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank");
        setEnviados(prev => new Set(prev).add(linea.id));
        setWaAbierto(true);
    }

    function siguiente() {
        if (indiceActual < cola.length - 1) {
            setIndiceActual(i => i + 1);
            setWaAbierto(false);
        }
    }

    function anterior() {
        if (indiceActual > 0) {
            setIndiceActual(i => i - 1);
            setWaAbierto(false);
        }
    }

    function salirModoEnvio() {
        setModoEnvio(false);
        setWaAbierto(false);
    }

    if (loading) return (
        <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    // ── MODO ENVÍO ────────────────────────────────────────────────────────────
    if (modoEnvio) {
        const lineaActual = cola[indiceActual];
        const esUltimo = indiceActual === cola.length - 1;
        const yaEnviado = lineaActual && enviados.has(lineaActual.id);
        const terminado = indiceActual >= cola.length;

        if (terminado) return (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.1 9 11.1"/></svg>
                </div>
                <p className="text-xl font-bold text-slate-800 dark:text-white">¡Envío completado!</p>
                <p className="text-sm text-slate-500">Se enviaron mensajes a {enviados.size} persona{enviados.size !== 1 ? "s" : ""}.</p>
                <button onClick={salirModoEnvio}
                    className="mt-2 px-6 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-200 transition-colors">
                    Volver
                </button>
            </div>
        );

        return (
            <div className="max-w-lg mx-auto space-y-4 py-4">

                {/* Barra de progreso */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>{indiceActual + 1} de {cola.length}</span>
                        <span>{enviados.size} enviados</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full transition-all duration-300"
                            style={{ width: `${((indiceActual) / cola.length) * 100}%` }} />
                    </div>
                </div>

                {/* Tarjeta persona actual */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-green-200 dark:border-green-800 p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-base font-bold text-slate-800 dark:text-white">{lineaActual.usuario_linea || "—"}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{lineaActual.telefono} · {lineaActual.gb_solicitado?.replace(/\s*\(RD\$[^)]+\)/g, "") || "Sin plan"}</p>
                        </div>
                        {yaEnviado && (
                            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 flex-shrink-0">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.1 9 11.1"/></svg>
                                Enviado
                            </span>
                        )}
                    </div>

                    {/* Mensaje personalizado */}
                    <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl p-4 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                        {personalizarMensaje(plantilla, lineaActual)}
                    </div>

                    <p className="text-xs text-slate-400">
                        Enviará a: <span className="font-mono text-slate-600 dark:text-slate-300">{numeroWA(lineaActual)}</span>
                    </p>

                    {/* Botón abrir WhatsApp */}
                    <button onClick={abrirWAActual}
                        className={`w-full py-3 rounded-xl text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 ${yaEnviado ? "bg-slate-400 hover:bg-slate-500" : "bg-green-600 hover:bg-green-500"}`}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                        {yaEnviado ? "Reenviar en WhatsApp" : "Abrir en WhatsApp"}
                    </button>
                </div>

                {/* Navegación */}
                <div className="flex gap-2">
                    <button onClick={anterior} disabled={indiceActual === 0}
                        className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-semibold disabled:opacity-30 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                        Anterior
                    </button>
                    {esUltimo ? (
                        <button onClick={() => setIndiceActual(cola.length)}
                            className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold transition-colors flex items-center justify-center gap-1.5">
                            Finalizar
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.1 9 11.1"/></svg>
                        </button>
                    ) : (
                        <button onClick={siguiente}
                            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 dark:bg-slate-600 dark:hover:bg-slate-500 text-white text-sm font-bold transition-colors flex items-center justify-center gap-1.5">
                            Siguiente
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                    )}
                </div>

                <button onClick={salirModoEnvio}
                    className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors">
                    Cancelar envío
                </button>
            </div>
        );
    }

    // ── VISTA NORMAL ──────────────────────────────────────────────────────────
    return (
        <div className="space-y-5">

            {/* Header */}
            <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    Mensajes WhatsApp
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Prepara y envía mensajes personalizados a los beneficiarios</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Panel izquierdo: editor + filtros */}
                <div className="space-y-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">✏️ Redactar mensaje</p>
                        <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Variables disponibles — clic para insertar:</p>
                            <div className="flex flex-wrap gap-1.5">
                                {VARIABLES.map(v => (
                                    <button key={v.clave} onClick={() => setPlantilla(p => p + v.clave)}
                                        title={v.desc}
                                        className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 font-mono border border-blue-200 dark:border-blue-800 transition-colors">
                                        {v.clave}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <textarea value={plantilla} onChange={e => setPlantilla(e.target.value)} rows={10}
                            className="w-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-mono resize-none"
                            placeholder="Escribe tu mensaje aquí..." />
                        <p className="text-xs text-slate-400">
                            Usa <span className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded">*texto*</span> para negrita y <span className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded">_texto_</span> para cursiva en WhatsApp.
                        </p>
                    </div>

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
                            <button onClick={() => setSeleccionados(new Set(filtradas.map(l => l.id)))}
                                className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 transition-colors">
                                Seleccionar todos ({filtradas.length})
                            </button>
                            <button onClick={() => setSeleccionados(new Set())}
                                className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 transition-colors">
                                Deseleccionar
                            </button>
                        </div>
                        {cola.length > 0 && (
                            <button onClick={iniciarEnvio}
                                className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                                Iniciar envío a {cola.length} persona{cola.length !== 1 ? "s" : ""}
                            </button>
                        )}
                    </div>
                </div>

                {/* Panel derecho: lista */}
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
                            const sel = seleccionados.has(linea.id);
                            return (
                                <div key={linea.id}
                                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${sel ? "bg-green-50 dark:bg-green-900/10" : "hover:bg-slate-50 dark:hover:bg-slate-700/30"}`}>
                                    <input type="checkbox" checked={sel} onChange={() => toggleSeleccion(linea.id)}
                                        className="w-4 h-4 accent-green-600 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{linea.usuario_linea || "—"}</p>
                                        <p className="text-xs text-slate-400 truncate">{linea.telefono} · {linea.gb_solicitado?.replace(/\s*\(RD\$[^)]+\)/g, "") || "Sin plan"}</p>
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
