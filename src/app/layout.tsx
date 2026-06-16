import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });

export const metadata: Metadata = {
    title: "ADOSE Flota 2026",
    description: "Gestión de flota móvil corporativa - Unión Adventista Sureste",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="es" suppressHydrationWarning>
            <body className={montserrat.className}>
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
