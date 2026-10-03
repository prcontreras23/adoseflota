import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });

export const metadata: Metadata = {
    title: "Flota Móvil — SGA",
    description: "Flota móvil de la Asociación Dominicana del Sureste",
    // El ícono lo sirve SIGA desde la raíz del dominio.
    icons: {
        icon: "/icono-siga.png",
        apple: "/apple-touch-icon.png",
    },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="es" className={dmSans.variable} suppressHydrationWarning>
            <body className={`${dmSans.className} bg-[#fbfbfd] text-[#14203c]`}>
                {children}
                <Toaster
                    position="top-right"
                    toastOptions={{
                        className: "!bg-card !text-foreground !border !border-border !shadow-lg",
                        duration: 4000,
                    }}
                />
            </body>
        </html>
    );
}
