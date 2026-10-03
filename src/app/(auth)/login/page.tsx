"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { cargarSesion, cerrarSesion } from "@/lib/sesion";
import LogoSiga from "@/components/LogoSiga";

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
        <div className="min-h-screen flex items-center justify-center bg-[#fbfbfd] p-5">
            <div className="w-full max-w-sm">
                <div className="overflow-hidden rounded border border-slate-200 bg-white">
                    <div className="flex items-center gap-3 bg-[#02365e] px-8 py-5">
                        <LogoSiga alto={22} />
                        <span className="h-5 w-px bg-white/25" />
                        <span className="text-[15px] font-semibold text-white">Flota Móvil</span>
                    </div>
                    <div className="p-8">
                        {sinAcceso ? (
                            <div className="space-y-4">
                                <p className="text-[13.5px] leading-relaxed text-slate-600">
                                    {sinAcceso} entró a SGA, pero no tiene acceso a Flota. Pídalo a la Secretaría Ejecutiva.
                                </p>
                                <button onClick={usarOtraCuenta} disabled={loading}
                                    className="w-full py-2.5 rounded border border-[#858fa3] bg-white text-[13px] font-medium text-slate-800 hover:bg-[#f3f6f9] disabled:opacity-50">
                                    Entrar con otra cuenta
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit}>
                                <p className="mb-5 text-[13px] leading-relaxed text-slate-600">
                                    Entre con el mismo correo y contraseña de SGA.
                                </p>
                                <label className="mb-3 block">
                                    <span className="mb-1 block text-[12px] font-semibold text-slate-800">Correo</span>
                                    <input
                                        type="email" autoComplete="username" value={email} autoFocus
                                        onChange={e => { setEmail(e.target.value); setError(""); }}
                                        className="w-full rounded border border-[#858fa3] bg-white px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-[#02365e] focus:ring-2 focus:ring-[#02365e]/15"
                                    />
                                </label>
                                <label className="mb-4 block">
                                    <span className="mb-1 block text-[12px] font-semibold text-slate-800">Contraseña</span>
                                    <input
                                        type="password" autoComplete="current-password" value={password}
                                        onChange={e => { setPassword(e.target.value); setError(""); }}
                                        className="w-full rounded border border-[#858fa3] bg-white px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-[#02365e] focus:ring-2 focus:ring-[#02365e]/15"
                                    />
                                </label>
                                {error && <p className="mb-3 text-[13px] text-[#a3324a]">{error}</p>}
                                <button type="submit" disabled={loading || !email.trim() || !password}
                                    className="w-full py-2.5 rounded bg-[#02365e] hover:bg-[#0a4a7d] text-white text-[13px] font-semibold transition-colors disabled:opacity-50">
                                    {loading ? "Entrando…" : "Entrar"}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
                {/* El restablecimiento de contraseña vive en SGA (raíz del dominio) */}
                <a href="/" className="block w-full text-center text-[12.5px] text-slate-600 hover:text-[#02365e] mt-4">
                    ¿Olvidó su contraseña? Cámbiela desde la entrada de SGA
                </a>
            </div>
        </div>
    );
}
