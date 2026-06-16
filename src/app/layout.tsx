import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "ADOSE Flota 2026",
    description: "Gestión de flota móvil corporativa - Unión Adventista Sureste",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="es" suppressHydrationWarning>
            <body className={inter.className}>
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
