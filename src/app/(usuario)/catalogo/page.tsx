"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase, formatRD, AREAS, type Dispositivo, type PlanClaro, type Usuario, type Area, getNextSolicitudId } from "@/lib/supabase";
import { PROPOSAL_DATA } from "@/lib/proposalData";
import toast from "react-hot-toast";

const CLARO_PDF_URL = "/Cotización Soluciones Móviles Claro Febrero.pdf";

export default function CatalogoPage() {
    const router = useRouter();
    const [user, setUser] = useState<Usuario | null>(null);
    const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
    const [planes, setPlanes] = useState<PlanClaro[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [selected, setSelected] = useState<Dispositivo | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

    // Form state
    const [form, setForm] = useState({
        nombre: "",
        cargo: "",
        area: "" as Area,
        plan_id: "",
        justificacion: "",
        acepto: false,
    });

    const loadData = useCallback(async () => {
        // BYPASS COMPLETELY: Force user role unconditionally
        const mockUser = {
            id: "user-test-idx",
            nombre: "Usuario de Prueba",
            cargo: "Pastor",
            area: "Pastores" as Area,
            rol: "usuario"
        };
        setUser(mockUser as any);
        setForm(f => ({ ...f, nombre: mockUser.nombre, cargo: mockUser.cargo, area: mockUser.area }));

        const [{ data: devs }, { data: pls }] = await Promise.all([
            supabase.from("catalogo_dispositivos").select("*").eq("disponible", true).eq("destacado", true).order("precio_rd"),
            supabase.from("planes_claro").select("*").eq("activo", true).order("precio_mensual"),
        ]);
        setDispositivos(devs ?? []);
        setPlanes(pls ?? []);
        setLoading(false);
        return;

        /*
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) { router.push("/login"); return; }

        const { data: userData } = await supabase.from("usuarios").select("*").eq("id", authUser.id).single();
        if (!userData) { router.push("/login"); return; }
        if (userData.rol === "admin") { router.push("/admin/solicitudes"); return; }
        setUser(userData);
        setForm(f => ({ ...f, nombre: userData.nombre, cargo: userData.cargo, area: userData.area }));

        const [{ data: devs }, { data: pls }] = await Promise.all([
            supabase.from("catalogo_dispositivos").select("*").eq("disponible", true).eq("destacado", true).order("precio_rd"),
            supabase.from("planes_claro").select("*").eq("activo", true).order("precio_mensual"),
        ]);
        setDispositivos(devs ?? []);
        setPlanes(pls ?? []);
        setLoading(false);
        */
    }, [router]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleSelect = (d: Dispositivo) => {
        setSelected(d);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.acepto) { toast.error("Debes aceptar las políticas de uso institucional."); return; }
        if (!form.plan_id) { toast.error("Selecciona un plan."); return; }
        if (!selected) { toast.error("Selecciona un dispositivo."); return; }
        setSubmitting(true);

        const id = await getNextSolicitudId();
        const plan = planes.find(p => p.id === parseInt(form.plan_id));

        const { error } = await supabase.from("solicitudes").insert({
            id,
            usuario_id: user!.id,
            nombre: form.nombre,
            cargo: form.cargo,
            area: form.area,
            plan_id: parseInt(form.plan_id),
            dispositivo_id: selected.id,
            precio_equipo: selected.precio_rd,
            justificacion: form.justificacion,
            estado: "pendiente",
        });

        if (error) {
            toast.error("Error al enviar la solicitud. Intenta de nuevo.");
            console.error(error);
        } else {
            toast.success(`✅ Solicitud ${id} enviada exitosamente`);
            setShowForm(false);
            setSelected(null);
            setForm(f => ({ ...f, plan_id: "", justificacion: "", acepto: false }));
        }
        setSubmitting(false);
    }

    async function handleLogout() {
        await supabase.auth.signOut();
        router.push("/login");
    }

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-500 text-sm">Cargando catálogo...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            {/* Header */}
            <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src="/logo-adose.png" alt="ADOSE" className="h-8 w-auto"
                            onError={e => { e.currentTarget.style.display = "none"; }} />
                        <div>
                            <h1 className="font-bold text-slate-800 dark:text-white text-sm leading-tight">Sistema Flotas 2026</h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Hola, {user?.nombre?.split(" ")[0]}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <a href="/mis-solicitudes" className="text-xs text-blue-600 dark:text-blue-400 hover:underline hidden sm:block">
                            Mis Solicitudes
                        </a>
                        <button onClick={handleLogout}
                            className="text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg transition-colors">
                            Salir
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {/* Form Modal */}
                {showForm && selected && (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 animate-fade-in">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="font-bold text-slate-800 dark:text-white text-lg">Nueva Solicitud</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">Dispositivo: <strong>{selected.modelo}</strong> · {formatRD(selected.precio_rd)}</p>
                            </div>
                            <button onClick={() => setShowForm(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-2xl leading-none">&times;</button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre completo *</label>
                                    <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required
                                        className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cargo *</label>
                                    <input value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} required
                                        className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Área *</label>
                                    <select value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value as Area }))} required
                                        className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                        <option value="">Selecciona área...</option>
                                        {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Plan Claro *</label>
                                    <select value={form.plan_id} onChange={e => setForm(f => ({ ...f, plan_id: e.target.value }))} required
                                        className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                        <option value="">Selecciona plan...</option>
                                        {planes.map(p => (
                                            <option key={p.id} value={p.id}>{p.nombre} — {formatRD(p.precio_mensual)}/mes</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Justificación <span className="text-slate-400">(max. 250 caracteres)</span>
                                </label>
                                <textarea value={form.justificacion} onChange={e => setForm(f => ({ ...f, justificacion: e.target.value.slice(0, 250) }))}
                                    rows={3} placeholder="¿Por qué necesitas este dispositivo o plan?"
                                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                                <p className="text-xs text-slate-400 text-right mt-1">{form.justificacion.length}/250</p>
                            </div>

                            <label className="flex items-start gap-3 cursor-pointer group">
                                <input type="checkbox" checked={form.acepto} onChange={e => setForm(f => ({ ...f, acepto: e.target.checked }))}
                                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                                <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors">
                                    Acepto las políticas de uso institucional del dispositivo y me comprometo a su uso exclusivo para labores ministeriales.
                                </span>
                            </label>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowForm(false)}
                                    className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl py-3 text-sm font-medium transition-colors">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={submitting}
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white rounded-xl py-3 text-sm font-semibold transition-all shadow-lg shadow-blue-500/30 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                    {submitting ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Enviando...</> : "📤 Enviar Solicitud"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Page Header */}
                {!showForm && (
                    <div className="text-center py-4">
                        <h2 className="text-2xl font-black text-slate-800 dark:text-white">📱 Catálogo Claro 2026</h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Selecciona el dispositivo de tu solicitud</p>
                    </div>
                )}

                {/* Ver Presentación PDF link */}
                <div className="flex justify-center flex-col items-center gap-4">
                    <a href={CLARO_PDF_URL} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Ver Cotización Soluciones Claro Febrero 2026 (PDF completo)
                    </a>

                    {/* View mode toggle */}
                    <div className="bg-slate-200 dark:bg-slate-700 p-1 rounded-xl inline-flex shadow-inner">
                        <button onClick={() => setViewMode("cards")}
                            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${viewMode === "cards" ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}>
                            💳 Tarjetas (Solicitar)
                        </button>
                        <button onClick={() => setViewMode("table")}
                            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${viewMode === "table" ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}>
                            📊 Tabla Detallada
                        </button>
                    </div>
                </div>

                {/* Main Content View */}
                {viewMode === "cards" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {dispositivos.map(d => (
                            <DeviceCard key={d.id} device={d} onSelect={handleSelect} />
                        ))}
                    </div>
                ) : (
                    <ProposalTableView />
                )}
            </div>

            {dispositivos.length === 0 && (
                <div className="text-center py-16 text-slate-400 dark:text-slate-500">
                    <p className="text-5xl mb-3">📱</p>
                    <p className="text-lg font-medium">Catálogo sin dispositivos disponibles</p>
                    <p className="text-sm mt-1">Contacta al administrador para más información.</p>
                </div>
            )}

            {/* Bottom nav for mobile */}
            <div className="sm:hidden border-t border-slate-200 dark:border-slate-700 pt-4 flex justify-center">
                <a href="/mis-solicitudes" className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline">
                    Ver mis solicitudes →
                </a>
            </div>
        </div>
    );
}


function DeviceCard({ device, onSelect }: { device: Dispositivo; onSelect: (d: Dispositivo) => void }) {
    const catColor = {
        Basico: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        "Mid-range": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        Premium: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    }[device.categoria];

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 flex flex-col hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 hover:-translate-y-1 transition-all duration-200 group cursor-pointer"
            onClick={() => onSelect(device)}>
            {/* Category badge */}
            <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${catColor}`}>{device.categoria}</span>
                <svg className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </div>

            {/* Device icon placeholder */}
            <div className="flex-1 flex items-center justify-center py-4">
                <div className="text-5xl">📱</div>
            </div>

            {/* Info */}
            <div className="mt-3">
                <h3 className="font-bold text-slate-800 dark:text-white text-sm leading-tight">{device.modelo}</h3>
                <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-slate-500 dark:text-slate-400">
                    {device.pantalla && <span>🖥 {device.pantalla}</span>}
                    {device.ram && <span>💾 {device.ram}</span>}
                    {device.camara && <span>📷 {device.camara}</span>}
                    {device.bateria && <span>🔋 {device.bateria}</span>}
                </div>
                <div className="mt-3 flex items-center justify-between">
                    <span className="text-lg font-black text-blue-600 dark:text-blue-400">{formatRD(device.precio_rd)}</span>
                    <button
                        onClick={(e) => { e.stopPropagation(); onSelect(device); }}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-sm shadow-blue-500/30">
                        Solicitar
                    </button>
                </div>
            </div>
        </div>
    );
}

function ProposalTableView() {
    return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                        <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Cant.</th>
                        <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Equipo</th>
                        <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Datos</th>
                        <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Costo Unit. Base</th>
                        <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Total Base</th>
                        <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Aplicabilidad</th>
                        <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Precio Unit. Aplic.</th>
                        <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">% Desc.</th>
                        <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Precio Unit. Desc.</th>
                        <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Monto Total RD$</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {PROPOSAL_DATA.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.cant}</td>
                            <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{row.equipo}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.datos}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{formatRD(row.costoUnitarioBase)}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{formatRD(row.totalCostoBase)}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400"><span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-md text-xs">{row.aplicabilidad}</span></td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{formatRD(row.precioUnitarioAplic)}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.descuentoPct}%</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{formatRD(row.precioUnitarioDesc)}</td>
                            <td className="px-4 py-3 font-bold text-blue-600 dark:text-blue-400">{formatRD(row.montoTotalRd)}</td>
                        </tr>
                    ))}
                    {/* Totals Row */}
                    <tr className="bg-slate-50 dark:bg-slate-900/50 font-bold border-t-2 border-slate-200 dark:border-slate-700">
                        <td className="px-4 py-3 text-slate-800 dark:text-white" colSpan={3}>Totales</td>
                        <td className="px-4 py-3 text-slate-800 dark:text-white" colSpan={1}>{formatRD(PROPOSAL_DATA.reduce((acc, r) => acc + r.costoUnitarioBase, 0))}</td>
                        <td className="px-4 py-3 text-slate-800 dark:text-white" colSpan={4}>{formatRD(PROPOSAL_DATA.reduce((acc, r) => acc + r.totalCostoBase, 0))}</td>
                        <td className="px-4 py-3 text-slate-800 dark:text-white" colSpan={1}>—</td>
                        <td className="px-4 py-3 text-blue-600 dark:text-blue-400">{formatRD(PROPOSAL_DATA.reduce((acc, r) => acc + r.montoTotalRd, 0))}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
