"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { cargarSesion, cerrarSesion } from "@/lib/sesion";

// Flota entra con el mismo usuario y contraseña de SIGA. Si ya hay sesión de
// SIGA en este navegador, entra directo sin pedir nada.
export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [sinAcceso, setSinAcceso] = useState<string | null>(null);

    async function revisarSesion() {
        const r = await cargarSesion();
        if (r.estado === "ok") { router.push("/admin/solicitudes"); return; }
        setSinAcceso(r.estado === "sin-acceso" ? (r.nombre || "Su usuario") : null);
        setLoading(false);
    }

    useEffect(() => { revisarSesion(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!email.trim() || !password) return;
        setLoading(true);
        setError("");
        const { error: authError } = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password,
        });
        if (authError) {
            setLoading(false);
            setError("Correo o contraseña incorrectos");
            return;
        }
        await revisarSesion();
    }

    async function usarOtraCuenta() {
        setLoading(true);
        await cerrarSesion();
        setSinAcceso(null);
        setLoading(false);
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 p-4">
            <div className="absolute top-0 left-0 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative w-full max-w-xs">
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">
                    <div className="flex flex-col items-center mb-7">
                        <div className="bg-white rounded-2xl p-3 mb-4 shadow-lg">
                            <img src="/flota/logo-adose.png" alt="ADOSE Logo" className="h-14 w-auto object-contain" />
                        </div>
                        <h1 className="text-white font-bold text-xl text-center leading-tight">ADOSE Flota 2026</h1>
                        <p className="text-blue-200 text-sm mt-1 text-center">
                            {sinAcceso ? "Sin acceso a Flota" : "Entre con su usuario de SIGA"}
                        </p>
                    </div>

                    {sinAcceso ? (
                        <div className="space-y-4 text-center">
                            <p className="text-white/80 text-sm">
                                {sinAcceso} entró a SIGA, pero no tiene acceso a Flota. Pídalo a la Secretaría Ejecutiva.
                            </p>
                            <button onClick={usarOtraCuenta} disabled={loading}
                                className="w-full py-2.5 rounded-xl border border-white/20 text-white/80 hover:text-white text-sm transition-colors disabled:opacity-50">
                                Entrar con otra cuenta
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-3">
                            <input
                                type="email" autoComplete="username" value={email}
                                onChange={e => { setEmail(e.target.value); setError(""); }}
                                placeholder="Correo"
                                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                            <input
                                type="password" autoComplete="current-password" value={password}
                                onChange={e => { setPassword(e.target.value); setError(""); }}
                                placeholder="Contraseña"
                                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                            <div className="h-5 text-center">
                                {error && <p className="text-red-400 text-sm font-medium">{error}</p>}
                            </div>
                            <button type="submit" disabled={loading || !email.trim() || !password}
                                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                                {loading ? "Entrando…" : "Entrar"}
                            </button>
                        </form>
                    )}
                </div>

                {/* El restablecimiento de contraseña vive en SIGA (raíz del dominio) */}
                <a href="/" className="block w-full text-center text-blue-300/60 hover:text-blue-300 text-xs mt-4 transition-colors">
                    ¿Olvidó su contraseña? Use «¿Olvidó su contraseña?» en SIGA
                </a>
                <p className="text-center text-blue-400/40 text-xs mt-6">
                    © 2026 ADOSE · Todos los derechos reservados
                </p>
            </div>
        </div>
    );
}
