"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Image from "next/image";
import DashboardTab from "./tabs/DashboardTab";
import LineasTab from "./tabs/LineasTab";
import PerfilesTab from "./tabs/PerfilesTab";
import AccionesTab from "./tabs/AccionesTab";
import MaestroTab from "./tabs/MaestroTab";
import UsuariosTab from "./tabs/UsuariosTab";
import toast from "react-hot-toast";

const TABS = [
    { id: "dashboard", label: "📊 Resumen", component: DashboardTab },
    { id: "lineas", label: "📱 Líneas", component: LineasTab },
    { id: "perfiles", label: "👤 Perfiles", component: PerfilesTab },
    { id: "acciones", label: "✅ Acciones", component: AccionesTab },
    { id: "maestro", label: "📋 Flota Maestra", component: MaestroTab },
    { id: "usuarios", label: "👥 Usuarios", component: UsuariosTab },
];

export default function AdminDashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("dashboard");
    const [user, setUser] = useState<{ nombre: string; rol: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [darkMode, setDarkMode] = useState(false);

    useEffect(() => {
        // Check dark mode preference
        if (typeof window !== "undefined") {
            const isDark = document.documentElement.classList.contains("dark") || window.matchMedia("(prefers-color-scheme: dark)").matches;
            setDarkMode(isDark);
            if (isDark) document.documentElement.classList.add("dark");
        }
        async function checkAuth() {
            // BYPASS COMPLETELY: Force admin role unconditionally
            setUser({ nombre: "Admin Temporal", rol: "admin" } as any);
            setLoading(false);
            return;

            /* Original code:
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.push("/login"); return; }
            const { data: userData } = await supabase.from("usuarios").select("nombre, rol").eq("id", session.user.id).single();
            if (userData?.rol !== "admin") { router.push("/catalogo"); return; }
            setUser(userData as any);
            setLoading(false);
            */
        }
        checkAuth();
    }, [router]);

    async function handleLogout() {
        await supabase.auth.signOut();
        router.push("/login");
    }

    function toggleDarkMode() {
        const isDark = !darkMode;
        setDarkMode(isDark);
        if (isDark) document.documentElement.classList.add("dark");
        else document.documentElement.classList.remove("dark");
    }

    if (loading) return <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-900 flex items-center justify-center"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;

    const ActiveComponent = TABS.find(t => t.id === activeTab)?.component || TABS[0].component;

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-900 flex flex-col transition-colors duration-300">
            {/* Header */}
            <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50">
                <div className="max-w-[1400px] mx-auto w-full px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Image src="/logo-adose.png" alt="ADOSE Logo" width={32} height={32} className="rounded-md object-contain" />
                        <h1 className="font-black text-xl text-slate-800 dark:text-white tracking-tight hidden sm:block">ADOSE <span className="text-blue-600 dark:text-blue-400">Flota 2026</span></h1>
                    </div>

                    {/* Desktop Tabs Navigation */}
                    <nav className="hidden md:flex items-center gap-1 mx-4">
                        {TABS.map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${activeTab === tab.id ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"}`}>
                                {tab.label}
                            </button>
                        ))}
                    </nav>

                    <div className="flex items-center gap-3">
                        <div className="hidden lg:block text-right mr-2">
                            <p className="text-sm font-bold text-slate-800 dark:text-white leading-tight">{user?.nombre}</p>
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider">Admin</p>
                        </div>
                        <button onClick={toggleDarkMode} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                            {darkMode ? "☀️" : "🌙"}
                        </button>
                        <button onClick={handleLogout} className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors" title="Cerrar sesión">
                            🚪
                        </button>
                    </div>
                </div>

                {/* Mobile Tabs Dropdown */}
                <div className="md:hidden px-4 py-2 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-x-auto">
                    <div className="flex gap-1 min-w-max">
                        {TABS.map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${activeTab === tab.id ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"}`}>
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 py-6 md:py-8">
                <ActiveComponent />
            </main>
        </div>
    );
}
