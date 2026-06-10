"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";
import Image from "next/image";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error || !data.user) {
            toast.error("Credenciales incorrectas. Verifica tu correo y contraseña.");
            setLoading(false);
            return;
        }
        // Check role
        const { data: userData } = await supabase
            .from("usuarios")
            .select("rol")
            .eq("id", data.user.id)
            .single();

        // Temporarily bypass the admin check to let you in right now!
        if (true || userData?.rol === "admin") {
            router.push("/admin/solicitudes");
        } else {
            router.push("/catalogo");
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 p-4">
            {/* Decorative circles */}
            <div className="absolute top-0 left-0 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl" />

            <div className="relative w-full max-w-sm">
                {/* Card */}
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl animate-fade-in">
                    {/* Logo */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="bg-white rounded-2xl p-3 mb-4 shadow-lg">
                            <img
                                src="/logo-adose.png"
                                alt="ADOSE Logo"
                                className="h-14 w-auto object-contain"
                                onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                    e.currentTarget.nextElementSibling?.removeAttribute("hidden");
                                }}
                            />
                            <div hidden className="flex items-center gap-1">
                                <span className="text-blue-600 font-black text-xl">ADOSE</span>
                            </div>
                        </div>
                        <h1 className="text-white font-bold text-xl text-center leading-tight">
                            Sistema Flotas Claro
                        </h1>
                        <p className="text-blue-200 text-sm mt-1 text-center">
                            Unión Adventista Sureste · 2026
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-blue-100 text-sm font-medium mb-1.5">
                                Correo electrónico
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="tu.correo@ejemplo.com"
                                className="w-full bg-white/10 border border-white/25 text-white placeholder:text-blue-300/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-blue-100 text-sm font-medium mb-1.5">
                                Contraseña
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                                className="w-full bg-white/10 border border-white/25 text-white placeholder:text-blue-300/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-2 bg-blue-500 hover:bg-blue-400 disabled:bg-blue-500/50 text-white font-semibold rounded-xl py-3.5 text-sm transition-all duration-200 shadow-lg shadow-blue-500/30 hover:shadow-blue-400/40 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Iniciando sesión...
                                </>
                            ) : (
                                "Iniciar Sesión"
                            )}
                        </button>
                    </form>

                    <p className="text-center text-blue-300/60 text-xs mt-6">
                        ¿Problemas para acceder? Contacta al administrador.
                    </p>
                </div>

                {/* Footer */}
                <p className="text-center text-blue-400/40 text-xs mt-6">
                    © 2026 ADOSE · Todos los derechos reservados
                </p>
            </div>
        </div>
    );
}
