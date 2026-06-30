"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Image from "next/image";
import toast from "react-hot-toast";
import DashboardTab from "./tabs/DashboardTab";
import PerfilesTab from "./tabs/PerfilesTab";
import TareasTab from "./tabs/TareasTab";
import UsuariosTab from "./tabs/UsuariosTab";
import AlmacenTab from "./tabs/AlmacenTab";
import EntregasLineasTab from "./tabs/EntregasLineasTab";
import NotasTab from "./tabs/NotasTab";
import ConfiguracionTab from "./tabs/ConfiguracionTab";
import DocumentosTab from "./tabs/DocumentosTab";
import AlticeTab from "./tabs/AlticeTab";
import SimuladorTab from "./tabs/SimuladorTab";
import MensajesWATab from "./tabs/MensajesWATab";
import { LineasProvider } from "@/lib/LineasContext";
import { ConfigListasProvider } from "@/lib/ConfigListasContext";
import { NavProvider } from "@/lib/NavContext";

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const Icon = {
    dashboard: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    perfiles:  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
    tareas:    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
    altice:    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.82 19.79 19.79 0 01.13 1.2 2 2 0 012.11 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.09a16 16 0 006 6l.56-.56a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>,
    simulador: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>,
    notas:     <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    almacen:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
    entregas:  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
    usuarios:  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
    documentos:<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
    mensajeswa:<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
    config:    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
    sun:       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
    moon:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
    logout:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    gear:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
    menu:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
    close:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
};

// Separadores visuales en el sidebar
const TABS = [
    { id: "dashboard",  label: "Resumen",       icon: Icon.dashboard,  component: DashboardTab,        group: "principal" },
    { id: "perfiles",   label: "Perfiles",       icon: Icon.perfiles,   component: PerfilesTab,         group: "principal" },
    { id: "tareas",     label: "Tareas",         icon: Icon.tareas,     component: TareasTab,           group: "principal" },
    { id: "altice",     label: "Proceso Altice", icon: Icon.altice,     component: AlticeTab,           group: "altice" },
    { id: "simulador",  label: "Simulador",      icon: Icon.simulador,  component: SimuladorTab,        group: "altice" },
    { id: "notas",      label: "Notas",          icon: Icon.notas,      component: NotasTab,            group: "gestion" },
    { id: "almacen",    label: "Almacén",        icon: Icon.almacen,    component: AlmacenTab,          group: "gestion" },
    { id: "entregas",   label: "Entregas",       icon: Icon.entregas,   component: EntregasLineasTab,   group: "gestion" },
    { id: "mensajeswa", label: "Mensajes WA",    icon: Icon.mensajeswa, component: MensajesWATab,       group: "gestion" },
    { id: "usuarios",   label: "Usuarios",       icon: Icon.usuarios,   component: UsuariosTab,         group: "sistema" },
    { id: "documentos", label: "Documentos",     icon: Icon.documentos, component: DocumentosTab,       group: "sistema" },
    { id: "config",     label: "Configuración",  icon: Icon.config,     component: ConfiguracionTab,    group: "sistema" },
];

const GROUP_LABELS: Record<string, string> = {
    principal: "Principal",
    altice:    "Negociación",
    gestion:   "Gestión",
    sistema:   "Sistema",
};

function toProperCase(str: string): string {
    if (!str) return str;
    const particles = new Set(["de", "del", "la", "las", "los", "el", "y"]);
    return str.toLowerCase().split(" ").map((w, i) =>
        i === 0 || !particles.has(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w
    ).join(" ");
}

export default function AdminDashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("dashboard");
    const [user, setUser] = useState<{ nombre: string; es_admin: boolean; permisos: string[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [darkMode, setDarkMode] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Settings modal
    const [showSettings, setShowSettings] = useState(false);
    const [pinActual, setPinActual] = useState("");
    const [pinNuevo, setPinNuevo] = useState("");
    const [pinConfirm, setPinConfirm] = useState("");
    const [savingPin, setSavingPin] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            document.documentElement.classList.add("dark");
            setDarkMode(true);
        }
        const raw = typeof window !== "undefined" ? localStorage.getItem("flota_session") : null;
        if (!raw) { router.push("/login"); return; }
        try {
            const session = JSON.parse(raw);
            const esAdmin = session.es_admin ?? false;
            const permisos: string[] = session.permisos ?? [];
            setUser({ nombre: session.nombre, es_admin: esAdmin, permisos });
            const allTabIds = TABS.map(t => t.id);
            const savedTab = localStorage.getItem("flota_active_tab");
            if (savedTab && allTabIds.includes(savedTab) && (esAdmin || permisos.includes(savedTab))) {
                setActiveTab(savedTab);
            } else if (!esAdmin && permisos.length > 0) {
                setActiveTab(permisos[0]);
            }
        } catch { router.push("/login"); return; }
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

    async function handleSavePin() {
        if (pinNuevo.length !== 6 || !/^\d{6}$/.test(pinNuevo)) { toast.error("El PIN nuevo debe ser exactamente 6 dígitos"); return; }
        if (pinNuevo !== pinConfirm) { toast.error("Los PINs nuevos no coinciden"); return; }
        setSavingPin(true);
        const raw = localStorage.getItem("flota_session");
        if (!raw) { router.push("/login"); return; }
        const session = JSON.parse(raw);
        const { data: pinData, error: verifyError } = await supabase.from("access_pins").select("id").eq("id", session.id).eq("pin", pinActual).eq("activo", true).single();
        if (verifyError || !pinData) { toast.error("PIN actual incorrecto"); setSavingPin(false); return; }
        const { error: updateError } = await supabase.from("access_pins").update({ pin: pinNuevo }).eq("id", session.id);
        if (updateError) { toast.error("Error al actualizar el PIN"); setSavingPin(false); return; }
        toast.success("PIN actualizado");
        setSavingPin(false);
        setShowSettings(false);
    }

    if (loading) return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
            <div className="w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    const visibleTabs = user?.es_admin ? TABS : TABS.filter(t => (user?.permisos ?? []).includes(t.id));
    const ActiveComponent = visibleTabs.find(t => t.id === activeTab)?.component || visibleTabs[0]?.component || DashboardTab;
    const activeTabLabel = visibleTabs.find(t => t.id === activeTab)?.label ?? "";

    // Group tabs for sidebar rendering
    const groupOrder = ["principal", "altice", "gestion", "sistema"];
    const grouped = groupOrder.map(g => ({
        group: g,
        label: GROUP_LABELS[g],
        tabs: visibleTabs.filter(t => t.group === g),
    })).filter(g => g.tabs.length > 0);

    function navigate(tabId: string) {
        setActiveTab(tabId);
        localStorage.setItem("flota_active_tab", tabId);
        setSidebarOpen(false);
    }

    // ── Sidebar content (shared between desktop fixed + mobile overlay) ────────
    const SidebarContent = () => (
        <div className="flex flex-col h-full">
            {/* Brand */}
            <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm overflow-hidden shrink-0">
                    <Image src="/logo-adose.png" alt="ADOSE" width={28} height={28} className="object-contain" />
                </div>
                <div className="flex flex-col leading-none">
                    <span className="font-bold text-[14px] text-slate-900 dark:text-white tracking-tight">
                        ADOSE <span className="text-blue-600">Flota</span>
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 tracking-widest uppercase">2026</span>
                </div>
            </div>

            {/* Nav groups */}
            <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
                {grouped.map(g => (
                    <div key={g.group}>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2 mb-1">{g.label}</p>
                        <div className="space-y-0.5">
                            {g.tabs.map(tab => {
                                const active = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => navigate(tab.id)}
                                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 text-left ${
                                            active
                                                ? "bg-blue-600 text-white shadow-sm shadow-blue-200 dark:shadow-none"
                                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                                        }`}>
                                        <span className={active ? "text-white/90" : "text-slate-400 dark:text-slate-500"}>
                                            {tab.icon}
                                        </span>
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Bottom: user info + actions */}
            <div className="border-t border-slate-100 dark:border-slate-800 p-3 space-y-2">
                {/* User row */}
                <div className="flex items-center gap-2.5 px-2 py-1.5">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                        {user?.nombre?.charAt(0) ?? "A"}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-slate-800 dark:text-white truncate">{toProperCase(user?.nombre ?? "")}</p>
                        <p className="text-[10px] text-slate-400">{user?.es_admin ? "Administrador" : "Usuario"}</p>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-1.5">
                    <button onClick={() => { setShowSettings(true); setPinActual(""); setPinNuevo(""); setPinConfirm(""); }}
                        title="Cambiar PIN"
                        className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-medium transition-colors">
                        {Icon.gear}
                        <span className="hidden sm:inline">PIN</span>
                    </button>
                    <button onClick={toggleDarkMode}
                        title={darkMode ? "Modo claro" : "Modo oscuro"}
                        className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-medium transition-colors">
                        {darkMode ? Icon.sun : Icon.moon}
                        <span className="hidden sm:inline">{darkMode ? "Claro" : "Oscuro"}</span>
                    </button>
                    <button onClick={handleLogout}
                        title="Cerrar sesión"
                        className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 text-xs font-medium transition-colors">
                        {Icon.logout}
                        <span className="hidden sm:inline">Salir</span>
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <ConfigListasProvider>
        <LineasProvider>
        <NavProvider onNavigate={setActiveTab}>
        <div className="min-h-screen bg-[#F4F6FA] dark:bg-[#0F1117] transition-colors duration-300 flex">

            {/* ── DESKTOP SIDEBAR (fixed left) ──────────────────────────────── */}
            <aside className="hidden lg:flex w-56 flex-col fixed left-0 top-0 h-screen bg-white dark:bg-[#181C27] border-r border-slate-200 dark:border-slate-800 z-30">
                <SidebarContent />
            </aside>

            {/* ── MOBILE OVERLAY SIDEBAR ────────────────────────────────────── */}
            {sidebarOpen && (
                <div className="lg:hidden fixed inset-0 z-50 flex">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
                    <aside className="relative w-64 h-full bg-white dark:bg-[#181C27] border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl">
                        <div className="absolute top-3 right-3">
                            <button onClick={() => setSidebarOpen(false)} className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 flex items-center justify-center">
                                {Icon.close}
                            </button>
                        </div>
                        <SidebarContent />
                    </aside>
                </div>
            )}

            {/* ── MAIN AREA ─────────────────────────────────────────────────── */}
            <div className="flex-1 lg:ml-56 flex flex-col min-h-screen">

                {/* Top bar (mobile: has hamburger; desktop: just title) */}
                <header className="sticky top-0 z-20 bg-white/90 dark:bg-[#181C27]/90 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
                    {/* Blue accent line */}
                    <div className="h-[2px] bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500" />
                    <div className="flex items-center gap-3 px-4 sm:px-6 h-14">
                        {/* Hamburger (mobile only) */}
                        <button onClick={() => setSidebarOpen(true)}
                            className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            {Icon.menu}
                        </button>

                        {/* Page title */}
                        <div className="flex-1">
                            <h1 className="text-base font-bold text-slate-800 dark:text-white">{activeTabLabel}</h1>
                        </div>

                        {/* Mobile: logo brand */}
                        <div className="lg:hidden flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center overflow-hidden">
                                <Image src="/logo-adose.png" alt="ADOSE" width={24} height={24} className="object-contain" />
                            </div>
                        </div>

                        {/* Mobile quick actions */}
                        <div className="lg:hidden flex items-center gap-1">
                            <button onClick={toggleDarkMode}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                {darkMode ? Icon.sun : Icon.moon}
                            </button>
                        </div>
                    </div>
                </header>

                {/* Content */}
                <main className="flex-1 px-4 sm:px-6 py-6 max-w-[1400px] w-full mx-auto">
                    <ActiveComponent />
                </main>
            </div>

            {/* ── SETTINGS MODAL ────────────────────────────────────────────── */}
            {showSettings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-700">
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Cambiar PIN</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                {user?.nombre} &middot; <span className="text-blue-500">{user?.es_admin ? "Administrador" : "Usuario"}</span>
                            </p>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            {[
                                { label: "PIN actual", value: pinActual, setter: setPinActual },
                                { label: "PIN nuevo", value: pinNuevo, setter: setPinNuevo },
                                { label: "Confirmar PIN nuevo", value: pinConfirm, setter: setPinConfirm },
                            ].map(f => (
                                <div key={f.label}>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{f.label}</label>
                                    <input type="password" maxLength={6} value={f.value}
                                        onChange={e => f.setter(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                        placeholder="••••••"
                                        className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                                </div>
                            ))}
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex gap-3 justify-end">
                            <button onClick={() => setShowSettings(false)} disabled={savingPin}
                                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50">
                                Cancelar
                            </button>
                            <button onClick={handleSavePin}
                                disabled={savingPin || !pinActual || !pinNuevo || !pinConfirm}
                                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all disabled:opacity-50 flex items-center gap-2">
                                {savingPin ? <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Guardando...</> : "Guardar"}
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
