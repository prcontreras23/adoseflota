"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase, AREAS, type Usuario, type Area } from "@/lib/supabase";
import toast from "react-hot-toast";

function generatePassword(nombre: string): string {
    const base = nombre.split(" ")[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "adose";
    return `${base.charAt(0).toUpperCase()}${base.slice(1)}2026!`;
}

export default function UsuariosTab() {
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNew, setShowNew] = useState(false);
    const [saving, setSaving] = useState(false);
    const [newUser, setNewUser] = useState({ nombre: "", email: "", cargo: "", area: "Empleados CEADIC" as Area, rol: "usuario" as "admin" | "usuario" });

    const loadData = useCallback(async () => {
        const { data } = await supabase.from("usuarios").select("*").order("nombre");
        setUsuarios(data ?? []);
        setLoading(false);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    async function handleCreate() {
        if (!newUser.nombre || !newUser.email) { toast.error("Nombre y correo son requeridos"); return; }
        setSaving(true);

        const password = generatePassword(newUser.nombre);

        // Create auth user via Supabase Admin API — using service role is needed on backend
        // For now, create via signUp (will send confirmation email)
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: newUser.email, password,
            options: { data: { nombre: newUser.nombre } }
        });

        if (authError || !authData.user) {
            toast.error(authError?.message ?? "Error al crear usuario");
            setSaving(false); return;
        }

        const { error: dbError } = await supabase.from("usuarios").upsert({
            id: authData.user.id, email: newUser.email, nombre: newUser.nombre,
            cargo: newUser.cargo, area: newUser.area, rol: newUser.rol,
        });

        if (dbError) toast.error("Error al guardar perfil");
        else {
            toast.success(
                `✅ Usuario creado\n📧 ${newUser.email}\n🔑 Contraseña: ${password}`,
                { duration: 8000, style: { whiteSpace: "pre-line" } }
            );
            setShowNew(false);
            setNewUser({ nombre: "", email: "", cargo: "", area: "Empleados CEADIC", rol: "usuario" });
            loadData();
        }
        setSaving(false);
    }

    async function toggleActivo(id: string, current: boolean) {
        await supabase.from("usuarios").update({ activo: !current }).eq("id", id);
        setUsuarios(prev => prev.map(u => u.id === id ? { ...u, activo: !current } : u));
        toast.success(current ? "Usuario desactivado" : "Usuario activado");
    }

    async function deleteUser(id: string, nombre: string) {
        if (!confirm(`¿Eliminar el usuario ${nombre}? Esta acción no se puede deshacer.`)) return;
        await supabase.from("usuarios").delete().eq("id", id);
        toast.success("Usuario eliminado");
        loadData();
    }

    if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Gestión de Usuarios</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{usuarios.length} usuarios registrados</p>
                </div>
                <button onClick={() => setShowNew(v => !v)}
                    className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-semibold transition-colors">
                    ＋ Nuevo Usuario
                </button>
            </div>

            {showNew && (
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-5 animate-fade-in">
                    <h3 className="font-semibold text-slate-800 dark:text-white mb-1">Crear Usuario</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                        La contraseña se genera automáticamente como: <strong>{newUser.nombre ? generatePassword(newUser.nombre) : "NombreXXXX!"}</strong>
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                            { label: "Nombre completo *", field: "nombre", type: "text", placeholder: "Ej: Juan García" },
                            { label: "Correo electrónico *", field: "email", type: "email", placeholder: "juan@iglesiaadose.org" },
                            { label: "Cargo", field: "cargo", type: "text", placeholder: "Ej: Pastor Distrital" },
                        ].map(({ label, field, type, placeholder }) => (
                            <div key={field}>
                                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">{label}</label>
                                <input type={type} value={(newUser as any)[field]} onChange={e => setNewUser(n => ({ ...n, [field]: e.target.value }))}
                                    placeholder={placeholder}
                                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                        ))}
                        <div>
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Área</label>
                            <select value={newUser.area} onChange={e => setNewUser(n => ({ ...n, area: e.target.value as Area }))}
                                className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Rol</label>
                            <select value={newUser.rol} onChange={e => setNewUser(n => ({ ...n, rol: e.target.value as "admin" | "usuario" }))}
                                className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="usuario">Usuario (empleado/pastor)</option>
                                <option value="admin">Administrador</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                        <button onClick={() => setShowNew(false)} className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                        <button onClick={handleCreate} disabled={saving}
                            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                            {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creando...</> : "👤 Crear Usuario"}
                        </button>
                    </div>
                </div>
            )}

            {/* User list */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                            <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-300">Nombre</th>
                            <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-300 hidden sm:table-cell">Correo</th>
                            <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-300 hidden md:table-cell">Área</th>
                            <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-300">Rol</th>
                            <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-300">Estado</th>
                            <th className="p-3 text-left font-semibold text-slate-600 dark:text-slate-300">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {usuarios.map(u => (
                            <tr key={u.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${!u.activo ? "opacity-50" : ""}`}>
                                <td className="p-3">
                                    <p className="font-medium text-slate-800 dark:text-white">{u.nombre}</p>
                                    <p className="text-xs text-slate-400">{u.cargo}</p>
                                </td>
                                <td className="p-3 hidden sm:table-cell text-slate-500 dark:text-slate-400 text-xs">{u.email}</td>
                                <td className="p-3 hidden md:table-cell text-slate-600 dark:text-slate-300">{u.area}</td>
                                <td className="p-3">
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.rol === "admin" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                                        {u.rol === "admin" ? "Admin" : "Usuario"}
                                    </span>
                                </td>
                                <td className="p-3">
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.activo ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"}`}>
                                        {u.activo ? "Activo" : "Inactivo"}
                                    </span>
                                </td>
                                <td className="p-3">
                                    <div className="flex gap-1">
                                        <button onClick={() => toggleActivo(u.id, u.activo)}
                                            className="text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-lg transition-colors">
                                            {u.activo ? "Desactivar" : "Activar"}
                                        </button>
                                        <button onClick={() => deleteUser(u.id, u.nombre)}
                                            className="text-xs bg-red-50 dark:bg-red-950/30 text-red-500 hover:bg-red-100 px-2 py-1 rounded-lg transition-colors">
                                            🗑️
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {usuarios.length === 0 && (
                    <div className="py-16 text-center text-slate-400">
                        <p className="text-4xl mb-2">👥</p>
                        <p>No hay usuarios registrados</p>
                    </div>
                )}
            </div>
        </div>
    );
}
