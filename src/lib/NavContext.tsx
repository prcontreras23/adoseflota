"use client";
import React, { createContext, useContext, useState } from "react";

export interface NavFilter {
    proximaAccion?: string;
    accion?: string;
    estado?: string;
    estadoIn?: string[];      // múltiples estados a la vez (OR)
    titular?: string;
    search?: string;
    sinMonto?: boolean;
    sinPortabilidad?: boolean;
    dispositivoContains?: string;
    tipo?: string;
    portabilidad?: string;    // filtra por campo portabilidad exacto
    gbContains?: string;      // filtra por gb_solicitado que contenga este string
    sinGb?: boolean;          // filtra líneas sin gb_solicitado
    sinTitular?: boolean;     // filtra líneas sin titular (null o "SIN TITULAR")
    sinTipo?: boolean;        // filtra líneas sin tipo
}

interface NavContextValue {
    goToPerfiles: (filter?: NavFilter) => void;
    goToAlmacen: () => void;
    goToSimulador: () => void;
    consumeFilter: () => NavFilter | null;
}

const NavContext = createContext<NavContextValue>({
    goToPerfiles: () => {},
    goToAlmacen: () => {},
    goToSimulador: () => {},
    consumeFilter: () => null,
});

export function NavProvider({ children, onNavigate }: { children: React.ReactNode; onNavigate: (tab: string) => void }) {
    const [pendingFilter, setPendingFilter] = useState<NavFilter | null>(null);

    function goToPerfiles(filter?: NavFilter) {
        if (filter) setPendingFilter(filter);
        onNavigate("perfiles");
    }

    function goToAlmacen() {
        onNavigate("almacen");
    }

    function goToSimulador() {
        onNavigate("simulador");
    }

    function consumeFilter() {
        const f = pendingFilter;
        setPendingFilter(null);
        return f;
    }

    return (
        <NavContext.Provider value={{ goToPerfiles, goToAlmacen, goToSimulador, consumeFilter }}>
            {children}
        </NavContext.Provider>
    );
}

export function useNav() {
    return useContext(NavContext);
}
