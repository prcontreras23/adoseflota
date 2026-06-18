"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Image from "next/image";
import toast from "react-hot-toast";
import DashboardTab from "./tabs/DashboardTab";
import PerfilesTab from "./tabs/PerfilesTab";
import AccionesTab from "./tabs/AccionesTab";
import TareasTab from "./tabs/TareasTab";
import UsuariosTab from "./tabs/UsuariosTab";
import AlmacenTab from "./tabs/AlmacenTab";
import EntregasLineasTab from "./tabs/EntregasLineasTab";
import NotasTab from "./tabs/NotasTab";
import ConfiguracionTab from "./tabs/ConfiguracionTab";
import DocumentosTab from "./tabs/DocumentosTab";
import { LineasProvider } from "@/lib/LineasContext";
import { ConfigListasProvider } from "@/lib/ConfigListasContext";
import { NavProvider } from "@/lib/NavContext";

// ── SVG Icons ──────────────────────────────────────────────────────────────────
const Icon = {
    dashboard: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
    ),
    lineas: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>
        </svg>
    ),
    perfiles: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
    ),
    acciones: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
        </svg>
    ),
    almacen: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
    ),
    entregas: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/>
            <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
    ),
    usuarios: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
        </svg>
    ),
    sun: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
    ),
    moon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
        </svg>
    ),
    logout: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
    ),
    gear: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
        </svg>
    ),
    tareas: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
        </svg>
    ),
    notas: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
        </svg>
    ),
    documentos: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
        </svg>
    ),
    config: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
        </svg>
    ),
};

const TABS = [
    { id: "dashboard", label: "Resumen",  icon: Icon.dashboard,  component: DashboardTab },
    { id: "perfiles",  label: "Perfiles", icon: Icon.perfiles,   component: PerfilesTab },
    { id: "tareas",    label: "Tareas",   icon: Icon.tareas,     component: TareasTab },
    { id: "notas",     label: "Notas",         icon: Icon.notas,    component: NotasTab },
    { id: "almacen",   label: "Almacén",       icon: Icon.almacen,  component: AlmacenTab },
    { id: "entregas",  label: "Entregas",      icon: Icon.entregas, component: EntregasLineasTab },
    { id: "usuarios",  label: "Usuarios",      icon: Icon.usuarios, component: UsuariosTab },
    { id: "documentos", label: "Documentos",    icon: Icon.documentos, component: DocumentosTab },
    { id: "config",    label: "Configuración", icon: Icon.config,   component: ConfiguracionTab },
];

export default function AdminDashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("dashboard");
    const [user, setUser] = useState<{ nombre: string; es_admin: boolean; permisos: string[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [darkMode, setDarkMode] = useState(false);

    // Settings modal state
    const [showSettings, setShowSettings] = useState(false);
    const [pinActual, setPinActual] = useState("");
    const [pinNuevo, setPinNuevo] = useState("");
    const [pinConfirm, setPinConfirm] = useState("");
    const [savingPin, setSavingPin] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const isDark = document.documentElement.classList.contains("dark") || window.matchMedia("(prefers-color-scheme: dark)").matches;
            setDarkMode(isDark);
            if (isDark) document.documentElement.classList.add("dark");
        }

        // Read session from localStorage
        const raw = typeof window !== "undefined" ? localStorage.getItem("flota_session") : null;
        if (!raw) { router.push("/login"); return; }
        try {
            const session = JSON.parse(raw);
            setUser({ nombre: session.nombre, es_admin: session.es_admin ?? false, permisos: session.permisos ?? [] });
            if (!session.es_admin && session.permisos?.length > 0) {
                setActiveTab(session.permisos[0]);
            }
        } catch {
            router.push("/login");
            return;
        }
        setLoading(false);
    }, [router]);

    async function handleLogout() {
        localStorage.removeItem("flota_session");
        router.push("/login");
    }

    function toggleDarkMode() {
        const isDark = !darkMode;
        setDarkMode(isDark);
        if (isDark) document.documentElement.classList.add("dark");
        else document.documentElement.classList.remove("dark");
    }

    function openSettings() {
        setPinActual("");
        setPinNuevo("");
        setPinConfirm("");
        setShowSettings(true);
    }

    async function handleSavePin() {
        if (pinNuevo.length !== 6 || !/^\d{6}$/.test(pinNuevo)) {
            toast.error("El PIN nuevo debe ser exactamente 6 dígitos");
            return;
        }
        if (pinNuevo !== pinConfirm) {
            toast.error("Los PINs nuevos no coinciden");
            return;
        }

        setSavingPin(true);

        // Get session id
        const raw = localStorage.getItem("flota_session");
        if (!raw) { router.push("/login"); return; }
        const session = JSON.parse(raw);

        // Verify current PIN
        const { data: pinData, error: verifyError } = await supabase
            .from("access_pins")
            .select("id")
            .eq("id", session.id)
            .eq("pin", pinActual)
            .eq("activo", true)
            .single();

        if (verifyError || !pinData) {
            toast.error("PIN actual incorrecto");
            setSavingPin(false);
            return;
        }

        // Update new PIN
        const { error: updateError } = await supabase
            .from("access_pins")
            .update({ pin: pinNuevo })
            .eq("id", session.id);

        if (updateError) {
            toast.error("Error al actualizar el PIN");
            setSavingPin(false);
            return;
        }

        toast.success("PIN actualizado");
        setSavingPin(false);
        setShowSettings(false);
    }

    if (loading) return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
            <div className="w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    const visibleTabs = user?.es_admin
        ? TABS
        : TABS.filter(t => (user?.permisos ?? []).includes(t.id));

    const ActiveComponent = visibleTabs.find(t => t.id === activeTab)?.component || visibleTabs[0].component;

    return (
        <ConfigListasProvider>
        <LineasProvider>
        <NavProvider onNavigate={setActiveTab}>
        <div className="min-h-screen bg-[#F4F6FA] dark:bg-[#0F1117] flex flex-col transition-colors duration-300">

            {/* Accent top bar */}
            <div className="h-[3px] bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500 sticky top-0 z-50" />

            {/* Header */}
            <header className="bg-white/95 dark:bg-[#181C27]/95 backdrop-blur-sm border-b border-slate-200/70 dark:border-slate-800 sticky top-[3px] z-40">
                <div className="max-w-[1440px] mx-auto w-full px-5 h-[58px] flex items-center justify-between gap-4">

                    {/* Brand */}
                    <div className="flex items-center gap-2.5 shrink-0">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm shadow-blue-200 dark:shadow-none overflow-hidden">
                            <Image src="/logo-adose.png" alt="ADOSE" width={28} height={28} className="object-contain" />
                        </div>
                        <div className="hidden sm:flex flex-col leading-none">
                            <span className="font-bold text-[15px] text-slate-900 dark:text-white tracking-tight">
                                ADOSE <span className="text-blue-600">Flota</span>
                            </span>
                            <span className="text-[10px] font-medium text-slate-400 tracking-widest uppercase">2026</span>
                        </div>
                    </div>

                    {/* Desktop Nav — underline style */}
                    <nav className="hidden md:flex items-stretch h-[58px] gap-0.5 flex-1 justify-center">
                        {visibleTabs.map(tab => {
                            const active = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                                        relative flex items-center gap-1.5 px-3.5 text-[13px] font-semibold transition-all duration-150 group
                                        ${active
                                            ? "text-blue-600 dark:text-blue-400"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                                        }
                                    `}>
                                    <span className={`transition-colors ${active ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"}`}>
                                        {tab.icon}
                                    </span>
                                    {tab.label}
                                    {/* Active indicator */}
                                    <span className={`absolute bottom-0 left-1 right-1 h-[2px] rounded-t-full transition-all duration-200 ${active ? "bg-blue-600 dark:bg-blue-400 opacity-100" : "opacity-0"}`} />
                                </button>
                            );
                        })}
                    </nav>

                    {/* Right actions */}
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="hidden lg:flex items-center gap-2 mr-1">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[11px] font-bold shadow-sm">
                                {user?.nombre?.charAt(0) ?? "A"}
                            </div>
                            <div className="flex flex-col leading-none">
                                <span className="text-[12px] font-semibold text-slate-800 dark:text-white">{user?.nombre}</span>
                                <span className="text-[10px] font-medium text-blue-500 uppercase tracking-wider">
                                    {user?.es_admin ? "Admin" : "Usuario"}
                                </span>
                            </div>
                        </div>
                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden lg:block mx-1" />
                        {/* Settings button */}
                        <button
                            onClick={openSettings}
                            className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all hover:scale-105"
                            title="Configuración">
                            {Icon.gear}
                        </button>
                        <button
                            onClick={toggleDarkMode}
                            className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all hover:scale-105">
                            {darkMode ? Icon.sun : Icon.moon}
                        </button>
                        <button
                            onClick={handleLogout}
                            className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-500 transition-all hover:scale-105"
                            title="Cerrar sesión">
                            {Icon.logout}
                        </button>
                    </div>
                </div>

                {/* Mobile Nav */}
                <div className="md:hidden px-3 pb-1.5 overflow-x-auto border-t border-slate-100 dark:border-slate-800/60">
                    <div className="flex gap-0.5 min-w-max pt-1">
                        {visibleTabs.map(tab => {
                            const active = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                                        flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold whitespace-nowrap transition-all
                                        ${active
                                            ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                                            : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                        }
                                    `}>
                                    {tab.icon}
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1 max-w-[1440px] mx-auto w-full px-4 py-6">
                <ActiveComponent />
            </main>

            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-700">
                        {/* Modal Header */}
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Cambiar PIN</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                {user?.nombre} &middot; <span className="text-blue-500">{user?.es_admin ? "Administrador" : "Usuario"}</span>
                            </p>
                        </div>

                        {/* Modal Body */}
                        <div className="px-6 py-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    PIN actual
                                </label>
                                <input
                                    type="password"
                                    maxLength={6}
                                    value={pinActual}
                                    onChange={e => setPinActual(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                    placeholder="••••••"
                                    className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    PIN nuevo
                                </label>
                                <input
                                    type="password"
                                    maxLength={6}
                                    value={pinNuevo}
                                    onChange={e => setPinNuevo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                    placeholder="••••••"
                                    className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Confirmar PIN nuevo
                                </label>
                                <input
                                    type="password"
                                    maxLength={6}
                                    value={pinConfirm}
                                    onChange={e => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                    placeholder="••••••"
                                    className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                />
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex gap-3 justify-end">
                            <button
                                onClick={() => setShowSettings(false)}
                                disabled={savingPin}
                                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50">
                                Cancelar
                            </button>
                            <button
                                onClick={handleSavePin}
                                disabled={savingPin || !pinActual || !pinNuevo || !pinConfirm}
                                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                                {savingPin ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Guardando...
                                    </>
                                ) : "Guardar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
        </NavProvider>
        </LineasProvider>
        </ConfigListasProvider>
    );
}
