"use client";
import React, { createContext, useContext, useState } from "react";

export interface NavFilter {
    proximaAccion?: string;
    accion?: string;
    estado?: string;
    titular?: string;
    search?: string;
}

interface NavContextValue {
    goToPerfiles: (filter?: NavFilter) => void;
    consumeFilter: () => NavFilter | null;
}

const NavContext = createContext<NavContextValue>({
    goToPerfiles: () => {},
    consumeFilter: () => null,
});

export function NavProvider({ children, onNavigate }: { children: React.ReactNode; onNavigate: (tab: string) => void }) {
    const [pendingFilter, setPendingFilter] = useState<NavFilter | null>(null);

    function goToPerfiles(filter?: NavFilter) {
        if (filter) setPendingFilter(filter);
        onNavigate("perfiles");
    }

    function consumeFilter() {
        const f = pendingFilter;
        setPendingFilter(null);
        return f;
    }

    return (
        <NavContext.Provider value={{ goToPerfiles, consumeFilter }}>
            {children}
        </NavContext.Provider>
    );
}

export function useNav() {
    return useContext(NavContext);
}
