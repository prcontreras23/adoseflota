"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
    const router = useRouter();
    const [pin, setPin] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [shake, setShake] = useState(false);

    // Recuperación de PIN
    const [showRecovery, setShowRecovery] = useState(false);
    const [recoveryEmail, setRecoveryEmail] = useState("");
    const [recoveryLoading, setRecoveryLoading] = useState(false);
    const [recoveredPin, setRecoveredPin] = useState<string | null>(null);
    const [recoveryError, setRecoveryError] = useState("");

    async function handleRecovery() {
        if (!recoveryEmail.trim()) return;
        setRecoveryLoading(true);
        setRecoveryError("");
        setRecoveredPin(null);
        const { data } = await supabase
            .from("access_pins")
            .select("pin, nombre")
            .eq("email", recoveryEmail.trim().toLowerCase())
            .eq("activo", true)
            .single();
        setRecoveryLoading(false);
        if (!data) {
            setRecoveryError("No se encontró ningún usuario con ese correo.");
        } else {
            setRecoveredPin(data.pin);
        }
    }

    async function handlePinSubmit(currentPin: string) {
        if (currentPin.length !== 6) return;
        setLoading(true);
        setError("");

        const { data, error: dbError } = await supabase
            .from("access_pins")
            .select("id, nombre, es_admin, permisos")
            .eq("pin", currentPin)
            .eq("activo", true)
            .single();

        if (dbError || !data) {
            setLoading(false);
            setError("PIN incorrecto");
            setShake(true);
            setPin("");
            setTimeout(() => setShake(false), 600);
            return;
        }

        localStorage.setItem("flota_session", JSON.stringify({
            id: data.id,
            nombre: data.nombre,
            es_admin: data.es_admin,
            permisos: data.permisos ?? [],
        }));
        router.push("/admin/solicitudes");
    }

    function handleDigit(digit: string) {
        if (loading) return;
        if (pin.length >= 6) return;
        const newPin = pin + digit;
        setPin(newPin);
        setError("");
        if (newPin.length === 6) {
            handlePinSubmit(newPin);
        }
    }

    function handleBackspace() {
        if (loading) return;
        setPin(prev => prev.slice(0, -1));
        setError("");
    }

    function handleClear() {
        if (loading) return;
        setPin("");
        setError("");
    }

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (loading) return;
            if (/^\d$/.test(e.key)) handleDigit(e.key);
            else if (e.key === "Backspace") handleBackspace();
            else if (e.key === "Escape") handleClear();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 p-4">
            {/* Decorative blurs */}
            <div className="absolute top-0 left-0 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative w-full max-w-xs">
                {/* Card */}
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">

                    {/* Logo + Heading */}
                    <div className="flex flex-col items-center mb-7">
                        <div className="bg-white rounded-2xl p-3 mb-4 shadow-lg">
                            <img
                                src="/logo-adose.png"
                                alt="ADOSE Logo"
                                className="h-14 w-auto object-contain"
                                onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                    const next = e.currentTarget.nextElementSibling as HTMLElement | null;
                                    if (next) next.removeAttribute("hidden");
                                }}
                            />
                            <div hidden className="flex items-center gap-1">
                                <span className="text-blue-600 font-black text-xl">ADOSE</span>
                            </div>
                        </div>
                        <h1 className="text-white font-bold text-xl text-center leading-tight">
                            ADOSE Flota 2026
                        </h1>
                        <p className="text-blue-200 text-sm mt-1 text-center">
                            Ingresa tu PIN de acceso
                        </p>
                    </div>

                    {/* PIN Dots */}
                    <div className={`flex justify-center gap-3 mb-6 ${shake ? "animate-[shake_0.5s_ease-in-out]" : ""}`}>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div
                                key={i}
                                className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                                    i < pin.length
                                        ? "bg-blue-400 border-blue-400 scale-110"
                                        : "bg-transparent border-white/40"
                                }`}
                            />
                        ))}
                    </div>

                    {/* Error */}
                    <div className="h-5 mb-3 text-center">
                        {error && (
                            <p className="text-red-400 text-sm font-medium">{error}</p>
                        )}
                    </div>

                    {/* Number Pad */}
                    <div className="grid grid-cols-3 gap-2.5">
                        {["1","2","3","4","5","6","7","8","9"].map(digit => (
                            <button
                                key={digit}
                                onClick={() => handleDigit(digit)}
                                disabled={loading}
                                className="h-14 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/30 border border-white/15 text-white font-semibold text-xl transition-all duration-100 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {digit}
                            </button>
                        ))}
                        {/* Clear */}
                        <button
                            onClick={handleClear}
                            disabled={loading}
                            className="h-14 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/10 text-blue-300 font-medium text-xs transition-all duration-100 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            C
                        </button>
                        {/* 0 */}
                        <button
                            onClick={() => handleDigit("0")}
                            disabled={loading}
                            className="h-14 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/30 border border-white/15 text-white font-semibold text-xl transition-all duration-100 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            0
                        </button>
                        {/* Backspace */}
                        <button
                            onClick={handleBackspace}
                            disabled={loading}
                            className="h-14 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/10 text-blue-300 flex items-center justify-center transition-all duration-100 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <svg className="animate-spin h-5 w-5 text-blue-300" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z"/>
                                    <line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>
                                </svg>
                            )}
                        </button>
                    </div>
                </div>

                {/* Recuperar PIN */}
                {!showRecovery ? (
                    <button
                        onClick={() => { setShowRecovery(true); setRecoveredPin(null); setRecoveryError(""); setRecoveryEmail(""); }}
                        className="w-full text-center text-blue-300/60 hover:text-blue-300 text-xs mt-4 transition-colors"
                    >
                        ¿Olvidaste tu PIN?
                    </button>
                ) : (
                    <div className="mt-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 space-y-3">
                        <p className="text-white/80 text-xs font-semibold text-center">Recuperar PIN</p>
                        {recoveredPin ? (
                            <div className="text-center space-y-2">
                                <p className="text-blue-200 text-xs">Tu PIN de acceso es:</p>
                                <p className="text-white font-black text-3xl tracking-[0.4em] font-mono">{recoveredPin}</p>
                                <button onClick={() => { setShowRecovery(false); setRecoveredPin(null); }} className="text-blue-300 text-xs hover:text-white transition-colors">
                                    Volver al login
                                </button>
                            </div>
                        ) : (
                            <>
                                <input
                                    type="email"
                                    value={recoveryEmail}
                                    onChange={e => { setRecoveryEmail(e.target.value); setRecoveryError(""); }}
                                    placeholder="Tu correo electrónico"
                                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    onKeyDown={e => e.key === "Enter" && handleRecovery()}
                                />
                                {recoveryError && <p className="text-red-400 text-xs text-center">{recoveryError}</p>}
                                <div className="flex gap-2">
                                    <button onClick={() => setShowRecovery(false)} className="flex-1 py-2 rounded-xl border border-white/20 text-white/60 hover:text-white text-xs transition-colors">
                                        Cancelar
                                    </button>
                                    <button onClick={handleRecovery} disabled={recoveryLoading || !recoveryEmail.trim()} className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors disabled:opacity-50">
                                        {recoveryLoading ? "Buscando..." : "Mostrar PIN"}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
                {/* Footer */}
                <p className="text-center text-blue-400/40 text-xs mt-6">
                    © 2026 ADOSE · Todos los derechos reservados
                </p>
            </div>
            <style jsx global>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    15% { transform: translateX(-8px); }
                    30% { transform: translateX(8px); }
                    45% { transform: translateX(-6px); }
                    60% { transform: translateX(6px); }
                    75% { transform: translateX(-3px); }
                    90% { transform: translateX(3px); }
                }
            `}</style>
        </div>
    );
}
