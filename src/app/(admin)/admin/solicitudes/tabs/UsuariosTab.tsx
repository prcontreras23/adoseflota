"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

interface AccessPin {
    id: string;
    nombre: string;
    pin: string;
    email: string;
    es_admin: boolean;
    permisos: string[];
    activo: boolean;
    created_at: string;
}

const ALL_TABS = [
    { id: "dashboard",  label: "Resumen",        desc: "Panel de estadísticas generales" },
    { id: "perfiles",   label: "Perfiles",        desc: "Editar perfiles de cada línea" },
    { id: "tareas",     label: "Tareas",          desc: "Gestionar tareas del proyecto" },
    { id: "notas",      label: "Notas",           desc: "Notas y comunicaciones internas" },
    { id: "almacen",    label: "Almacén",         desc: "Stock de dispositivos" },
    { id: "entregas",   label: "Entregas",        desc: "Registrar entregas de equipos" },
    { id: "usuarios",   label: "Usuarios",        desc: "Gestionar usuarios y accesos" },
    { id: "documentos", label: "Documentos",      desc: "Documentos y archivos del proyecto" },
    { id: "config",     label: "Configuración",   desc: "Ajustes generales de la aplicación" },
];

const VACIO = { nombre: "", pin: "", email: "", es_admin: false, permisos: ["entregas"] as string[], activo: true };

const IcoPlus = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IcoEdit = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IcoShield = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IcoUser = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>;
const IcoEye = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IcoEyeOff = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
const IcoX = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

export default function UsuariosTab() {
    const [users, setUsers] = useState<AccessPin[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ ...VACIO });
    const [saving, setSaving] = useState(false);
    const [showPin, setShowPin] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);

    useEffect(() => {
        const raw = localStorage.getItem("flota_session");
        if (raw) try { setSessionId(JSON.parse(raw).id); } catch { /* ignore */ }
        loadUsers();
    }, []);

    async function loadUsers() {
        setLoading(true);
        const { data } = await supabase.from("access_pins").select("*").order("created_at");
        setUsers((data ?? []) as AccessPin[]);
        setLoading(false);
    }

    function openCreate() {
        setEditingId(null);
        setForm({ ...VACIO });
        setShowPin(false);
        setShowModal(true);
    }

    function openEdit(u: AccessPin) {
        setEditingId(u.id);
        setForm({ nombre: u.nombre, pin: u.pin, email: u.email ?? "", es_admin: u.es_admin, permisos: [...u.permisos], activo: u.activo });
        setShowPin(false);
        setShowModal(true);
    }

    function togglePermiso(id: string) {
        setForm(prev => ({
            ...prev,
            permisos: prev.permisos.includes(id)
                ? prev.permisos.filter(p => p !== id)
                : [...prev.permisos, id],
        }));
    }

    function toggleAdmin(checked: boolean) {
        setForm(prev => ({
            ...prev,
            es_admin: checked,
            permisos: checked ? ALL_TABS.map(t => t.id) : prev.permisos,
        }));
    }

    async function handleSave() {
        if (!form.nombre.trim()) { toast.error("El nombre es obligatorio"); return; }
        if (!/^\d{6}$/.test(form.pin)) { toast.error("El PIN debe ser exactamente 6 dígitos"); return; }
        if (!form.es_admin && form.permisos.length === 0) { toast.error("Selecciona al menos una sección"); return; }

        setSaving(true);
        const payload = {
            nombre: form.nombre.trim(),
            pin: form.pin,
            email: form.email.trim().toLowerCase(),
            es_admin: form.es_admin,
            permisos: form.es_admin ? ALL_TABS.map(t => t.id) : form.permisos,
            activo: form.activo,
        };

        if (editingId) {
            const { error } = await supabase.from("access_pins").update(payload).eq("id", editingId);
            if (error) { toast.error("Error al guardar"); setSaving(false); return; }
            toast.success("Usuario actualizado");
        } else {
            const { data: existing } = await supabase.from("access_pins").select("id").eq("pin", form.pin).maybeSingle();
            if (existing) { toast.error("Ese PIN ya está en uso"); setSaving(false); return; }
            const { error } = await supabase.from("access_pins").insert(payload);
            if (error) { toast.error("Error al crear usuario"); setSaving(false); return; }
            toast.success("Usuario creado");
        }

        setSaving(false);
        setShowModal(false);
        loadUsers();
    }

    async function toggleActivo(u: AccessPin) {
        if (u.id === sessionId) { toast.error("No puedes desactivarte a ti mismo"); return; }
        await supabase.from("access_pins").update({ activo: !u.activo }).eq("id", u.id);
        setUsers(prev => prev.map(x => x.id === u.id ? { ...x, activo: !x.activo } : x));
        toast.success(u.activo ? "Usuario desactivado" : "Usuario activado");
    }

    const inputCls = "w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Gestión de usuarios</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        Crea usuarios y define qué secciones puede ver cada uno
                    </p>
                </div>
                <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm">
                    <IcoPlus /> Nuevo usuario
                </button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : users.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 text-sm">No hay usuarios</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                {["Usuario", "Tipo", "Secciones con acceso", "Estado", ""].map(h => (
                                    <th key={h} className="p-3.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                            {users.map(u => (
                                <tr key={u.id} className={`transition-colors ${u.activo ? "hover:bg-slate-50 dark:hover:bg-slate-700/20" : "opacity-50"}`}>
                                    <td className="p-3.5">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${u.es_admin ? "bg-gradient-to-br from-blue-500 to-indigo-600" : "bg-gradient-to-br from-slate-400 to-slate-500"}`}>
                                                {u.nombre.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-800 dark:text-white">{u.nombre}</p>
                                                <p className="text-xs text-slate-400">{u.email || <span className="italic">sin correo</span>}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-3.5">
                                        {u.es_admin ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                                                <IcoShield /> Administrador
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold">
                                                <IcoUser /> Usuario
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-3.5">
                                        <div className="flex flex-wrap gap-1">
                                            {u.es_admin ? (
                                                <span className="text-xs text-slate-500 italic">Todas las secciones</span>
                                            ) : u.permisos.length === 0 ? (
                                                <span className="text-xs text-red-400">Sin acceso</span>
                                            ) : u.permisos.map(p => {
                                                const tab = ALL_TABS.find(t => t.id === p);
                                                return tab ? (
                                                    <span key={p} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-xs font-medium">{tab.label}</span>
                                                ) : null;
                                            })}
                                        </div>
                                    </td>
                                    <td className="p-3.5">
                                        <span className={`inline-flex px-2 py-1 rounded-md text-xs font-semibold ${u.activo ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-700 text-slate-500"}`}>
                                            {u.activo ? "Activo" : "Inactivo"}
                                        </span>
                                    </td>
                                    <td className="p-3.5">
                                        <div className="flex items-center gap-1.5">
                                            <button onClick={() => openEdit(u)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 transition-colors">
                                                <IcoEdit /> Editar
                                            </button>
                                            <button
                                                onClick={() => toggleActivo(u)}
                                                disabled={u.id === sessionId}
                                                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${u.activo ? "bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-rose-50 hover:text-rose-600" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"}`}>
                                                {u.activo ? "Desactivar" : "Activar"}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                    <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                            <h3 className="font-bold text-slate-800 dark:text-white text-base">
                                {editingId ? "Editar usuario" : "Nuevo usuario"}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                <IcoX />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Nombre</label>
                                <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej. Juan Pérez" className={inputCls} />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Correo electrónico <span className="text-slate-400 font-normal normal-case">(para recuperar PIN)</span></label>
                                <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} type="email" placeholder="usuario@correo.com" className={inputCls} />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">PIN de acceso (6 dígitos)</label>
                                <div className="relative">
                                    <input
                                        value={form.pin}
                                        onChange={e => setForm(p => ({ ...p, pin: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                                        type={showPin ? "text" : "password"}
                                        placeholder="••••••"
                                        maxLength={6}
                                        className={`${inputCls} pr-10 font-mono tracking-[0.4em]`}
                                    />
                                    <button type="button" onClick={() => setShowPin(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        {showPin ? <IcoEyeOff /> : <IcoEye />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                                <div>
                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5"><IcoShield /> Administrador completo</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Acceso total a todas las secciones</p>
                                </div>
                                <button type="button" onClick={() => toggleAdmin(!form.es_admin)} className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${form.es_admin ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"}`}>
                                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${form.es_admin ? "translate-x-5" : "translate-x-0"}`} />
                                </button>
                            </div>

                            {!form.es_admin && (
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Secciones con acceso</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {ALL_TABS.map(tab => {
                                            const checked = form.permisos.includes(tab.id);
                                            return (
                                                <button key={tab.id} type="button" onClick={() => togglePermiso(tab.id)}
                                                    className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${checked ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600" : "border-slate-200 dark:border-slate-600 hover:border-slate-300 bg-white dark:bg-slate-800/50"}`}>
                                                    <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border-2 shrink-0 transition-colors ${checked ? "bg-blue-600 border-blue-600" : "border-slate-300 dark:border-slate-500"}`}>
                                                        {checked && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                                    </div>
                                                    <div>
                                                        <p className={`text-xs font-semibold ${checked ? "text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-200"}`}>{tab.label}</p>
                                                        <p className="text-[10px] text-slate-400 mt-0.5">{tab.desc}</p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-700 flex gap-2.5 justify-end">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
                                {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear usuario"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
