"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

// Accesos a Flota con el usuario de SIGA (antes: PIN en access_pins).
// Las cuentas se crean en SIGA → Configuración → Usuarios; aquí solo se decide
// quién entra a Flota y qué pestañas ve. Administrador = gestionar_usuarios en
// SIGA. La base hace cumplir las pestañas (políticas RLS de flota).

interface Perfil {
    id: string;
    nombre: string;
    email: string | null;
    activo: boolean | null;
    permisos: Record<string, unknown> | null;
}

interface Acceso {
    user_id: string;
    pestanas: string[];
    activo: boolean;
}

interface Fila {
    perfil: Perfil;
    acceso: Acceso | null;
    es_admin: boolean;
}

const ALL_TABS = [
    { id: "dashboard",  label: "Resumen",        desc: "Panel y propuesta Altice" },
    { id: "perfiles",   label: "Perfiles",        desc: "Editar perfiles de cada línea" },
    { id: "lineas",     label: "Líneas",          desc: "Tabla completa de líneas" },
    { id: "tareas",     label: "Tareas",          desc: "Gestionar tareas del proyecto" },
    { id: "altice",     label: "Proceso Altice",  desc: "Pasos de la negociación" },
    { id: "simulador",  label: "Simulador",       desc: "Simulador de planes y equipos" },
    { id: "notas",      label: "Notas",           desc: "Notas y comunicaciones internas" },
    { id: "almacen",    label: "Almacén",         desc: "Stock de dispositivos" },
    { id: "entregas",   label: "Entregas",        desc: "Registrar entregas de equipos" },
    { id: "mensajeswa", label: "Mensajes WA",     desc: "Mensajes de WhatsApp a titulares" },
    { id: "usuarios",   label: "Usuarios",        desc: "Ver quién tiene acceso" },
    { id: "documentos", label: "Documentos",      desc: "Documentos y archivos del proyecto" },
    { id: "config",     label: "Configuración",   desc: "Listas y ajustes de la aplicación" },
];

const IcoPlus = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IcoEdit = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IcoShield = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IcoUser = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>;
const IcoX = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

export default function UsuariosTab() {
    const [filas, setFilas] = useState<Fila[]>([]);
    const [loading, setLoading] = useState(true);
    const [soyAdmin, setSoyAdmin] = useState(false);
    const [editando, setEditando] = useState<Fila | null>(null);
    const [form, setForm] = useState<{ user_id: string; permisos: string[] }>({ user_id: "", permisos: ["entregas"] });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const raw = localStorage.getItem("flota_session");
        if (raw) try { setSoyAdmin(!!JSON.parse(raw).es_admin); } catch { /* ignore */ }
        loadUsers();
    }, []);

    async function loadUsers() {
        setLoading(true);
        const [{ data: perfiles }, { data: accesos }] = await Promise.all([
            supabase.schema("public").from("profiles").select("id, nombre, email, activo, permisos").order("nombre"),
            supabase.from("accesos").select("user_id, pestanas, activo"),
        ]);
        const porId = new Map((accesos ?? []).map((a: Acceso) => [a.user_id, a]));
        setFilas(((perfiles ?? []) as Perfil[]).map(p => ({
            perfil: p,
            acceso: porId.get(p.id) ?? null,
            es_admin: !!p.permisos?.gestionar_usuarios,
        })));
        setLoading(false);
    }

    const conAcceso = filas.filter(f => f.es_admin || f.acceso);
    const sinAcceso = filas.filter(f => !f.es_admin && !f.acceso && f.perfil.activo !== false);

    function openCreate() {
        setEditando(null);
        setForm({ user_id: sinAcceso[0]?.perfil.id ?? "", permisos: ["entregas"] });
    }

    function openEdit(f: Fila) {
        setEditando(f);
        setForm({ user_id: f.perfil.id, permisos: [...(f.acceso?.pestanas ?? [])] });
    }

    function togglePermiso(id: string) {
        setForm(prev => ({
            ...prev,
            permisos: prev.permisos.includes(id)
                ? prev.permisos.filter(p => p !== id)
                : [...prev.permisos, id],
        }));
    }

    async function handleSave() {
        if (!form.user_id) { toast.error("Elige la persona"); return; }
        if (form.permisos.length === 0) { toast.error("Selecciona al menos una sección"); return; }
        setSaving(true);
        const { error } = await supabase.from("accesos").upsert({
            user_id: form.user_id,
            pestanas: form.permisos,
            activo: editando?.acceso?.activo ?? true,
        });
        setSaving(false);
        if (error) { toast.error("No se pudo guardar. Solo el administrador asigna accesos."); return; }
        toast.success(editando ? "Acceso actualizado" : "Acceso asignado");
        setEditando(null);
        setForm({ user_id: "", permisos: [] });
        loadUsers();
    }

    async function toggleActivo(f: Fila) {
        if (!f.acceso) return;
        const { error } = await supabase.from("accesos").update({ activo: !f.acceso.activo }).eq("user_id", f.perfil.id);
        if (error) { toast.error("No se pudo cambiar"); return; }
        toast.success(f.acceso.activo ? "Acceso desactivado" : "Acceso activado");
        loadUsers();
    }

    const showModal = form.user_id !== "" || editando !== null;
    const inputCls = "w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Accesos a Flota</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        Se entra con el usuario de SIGA. Las cuentas nuevas se crean en SIGA → Configuración → Usuarios.
                    </p>
                </div>
                {soyAdmin && sinAcceso.length > 0 && (
                    <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm">
                        <IcoPlus /> Dar acceso
                    </button>
                )}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : conAcceso.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 text-sm">Nadie tiene acceso todavía</div>
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
                            {conAcceso.map(f => { const u = { id: f.perfil.id, nombre: f.perfil.nombre ?? "", email: f.perfil.email, es_admin: f.es_admin, permisos: f.acceso?.pestanas ?? [], activo: f.es_admin || !!f.acceso?.activo }; return (
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
                                                <span className="text-xs text-slate-500 italic">Todas (gestionar_usuarios en SIGA)</span>
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
                                        {soyAdmin && !f.es_admin && (
                                        <div className="flex items-center gap-1.5">
                                            <button onClick={() => openEdit(f)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 transition-colors">
                                                <IcoEdit /> Editar
                                            </button>
                                            <button
                                                onClick={() => toggleActivo(f)}
                                                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${u.activo ? "bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-rose-50 hover:text-rose-600" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"}`}>
                                                {u.activo ? "Desactivar" : "Activar"}
                                            </button>
                                        </div>
                                        )}
                                    </td>
                                </tr>
                            ); })}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setEditando(null); setForm({ user_id: "", permisos: [] }); }} />
                    <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                            <h3 className="font-bold text-slate-800 dark:text-white text-base">
                                {editando ? `Acceso de ${editando.perfil.nombre}` : "Dar acceso a Flota"}
                            </h3>
                            <button onClick={() => { setEditando(null); setForm({ user_id: "", permisos: [] }); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                <IcoX />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                            {!editando && (
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Persona (usuario de SIGA)</label>
                                <select value={form.user_id} onChange={e => setForm(p => ({ ...p, user_id: e.target.value }))} className={inputCls}>
                                    {sinAcceso.map(f => (
                                        <option key={f.perfil.id} value={f.perfil.id}>{f.perfil.nombre} · {f.perfil.email}</option>
                                    ))}
                                </select>
                            </div>
                            )}
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
                        </div>

                        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-700 flex gap-2.5 justify-end">
                            <button onClick={() => { setEditando(null); setForm({ user_id: "", permisos: [] }); }} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
                                {saving ? "Guardando..." : editando ? "Guardar cambios" : "Dar acceso"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
