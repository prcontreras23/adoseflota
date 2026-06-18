"use client";
import { useState, useMemo } from "react";
import respuestas from "@/data/respuestas_formulario.json";

interface Respuesta {
  marca_temporal: string | null;
  nombre: string | null;
  mantener_todos: string | null;
  quitar_numeros: string | null;
  gb_solicitado: string | null;
  min_solicitados: string | null;
  familiar_dispositivo: string | null;
  familiar_detalle: string | null;
  cambio_dispositivo: string | null;
  modelo_preferido: string | null;
  notas_lineas_adicionales: string | null;
}

const DATA = respuestas as Respuesta[];

function normalizar(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

function coincide(nombreForm: string, nombreBuscar: string): boolean {
  const a = normalizar(nombreForm);
  const b = normalizar(nombreBuscar);
  if (!a || !b) return false;
  if (a === b) return true;
  // Verifica si al menos 2 palabras del nombre de la app aparecen en el nombre del formulario
  const palabrasB = b.split(" ").filter(p => p.length > 2);
  const matches = palabrasB.filter(p => a.includes(p));
  return matches.length >= 2;
}

function buscarRespuestas(titular: string, usuario: string): Respuesta[] {
  const candidatos = new Set<Respuesta>();
  for (const r of DATA) {
    if (!r.nombre) continue;
    if (coincide(r.nombre, titular) || coincide(r.nombre, usuario)) {
      candidatos.add(r);
    }
  }
  return Array.from(candidatos);
}

function Campo({ label, valor }: { label: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <div className="py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{valor}</p>
    </div>
  );
}

export default function FormularioPanel({
  titular,
  usuario,
}: {
  titular: string;
  usuario: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [indice, setIndice] = useState(0);

  const encontradas = useMemo(
    () => buscarRespuestas(titular, usuario),
    [titular, usuario]
  );

  if (encontradas.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        <span>Sin respuesta de formulario para <strong>{titular || usuario}</strong></span>
      </div>
    );
  }

  const r = encontradas[indice];
  const fecha = r.marca_temporal
    ? new Date(r.marca_temporal).toLocaleDateString("es-DO", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : null;

  return (
    <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 overflow-hidden">
      <button
        onClick={() => setAbierto(!abierto)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          <span>
            Respuesta del formulario
            {encontradas.length > 1 && (
              <span className="ml-2 text-xs bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                {encontradas.length} respuestas
              </span>
            )}
          </span>
        </span>
        <span className="text-slate-400">{abierto ? "▲" : "▼"}</span>
      </button>

      {abierto && (
        <div className="px-4 pb-4">
          {encontradas.length > 1 && (
            <div className="flex gap-1.5 mb-3 flex-wrap">
              {encontradas.map((resp, i) => (
                <button
                  key={i}
                  onClick={() => setIndice(i)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    i === indice
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-blue-400"
                  }`}
                >
                  {resp.nombre} {fecha && i === indice ? `· ${new Date(resp.marca_temporal!).toLocaleDateString("es-DO")}` : ""}
                </button>
              ))}
            </div>
          )}

          <div className="text-[11px] text-slate-400 mb-3">
            <span className="font-medium text-blue-600 dark:text-blue-400">{r.nombre}</span>
            {fecha && <span> · {fecha}</span>}
          </div>

          <div className="space-y-0">
            <Campo label="¿Mantener todos los números?" valor={r.mantener_todos} />
            <Campo label="Números a quitar" valor={r.quitar_numeros} />
            <Campo label="GB solicitados" valor={r.gb_solicitado} />
            <Campo label="Minutos solicitados" valor={r.min_solicitados} />
            <Campo label="¿Familiar necesita dispositivo?" valor={r.familiar_dispositivo} />
            <Campo label="Familiar – nombre y parentesco" valor={r.familiar_detalle} />
            <Campo label="¿Desea cambio de dispositivo?" valor={r.cambio_dispositivo} />
            <Campo label="Modelo preferido" valor={r.modelo_preferido} />
            <Campo label="Notas líneas adicionales" valor={r.notas_lineas_adicionales} />
          </div>
        </div>
      )}
    </div>
  );
}
