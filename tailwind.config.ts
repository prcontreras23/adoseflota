import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            // Estilo de SIGA (tokens --siga-* del index.html de padron-de-iglesias):
            // slate pasa a los grises azulados de SIGA, blue e indigo al azul
            // institucional #02365e. Así las ~2,000 clases de la app toman la
            // paleta sin reescribir cada pantalla.
            fontFamily: { sans: ["var(--font-dm-sans)", "DM Sans", "system-ui", "sans-serif"] },
            boxShadow: { sm: "none", DEFAULT: "none", md: "none" },
            colors: {
                slate: {
                    50: "#f7f8fb", 100: "#f3f6f9", 200: "#e3e7f0", 300: "#c9cfdb",
                    400: "#737d94", 500: "#616b86", 600: "#5a6785", 700: "#3d4866",
                    800: "#14203c", 900: "#0e1830", 950: "#0a1222",
                },
                blue: {
                    50: "#ecf2f7", 100: "#dce7f1", 200: "#b9cfe2", 300: "#8fb0cc",
                    400: "#3b6a8f", 500: "#0a4a7d", 600: "#02365e", 700: "#022b4b",
                    800: "#01223b", 900: "#011a2e", 950: "#011222",
                },
                indigo: {
                    50: "#ecf2f7", 100: "#dce7f1", 200: "#b9cfe2", 300: "#8fb0cc",
                    400: "#3b6a8f", 500: "#0a4a7d", 600: "#02365e", 700: "#022b4b",
                    800: "#01223b", 900: "#011a2e", 950: "#011222",
                },
                // Los demás tonos se llevan a la familia de SIGA: morados al azul,
                // verdes apagados, ámbar y naranja al oro, rojos al rojo de SIGA.
                purple: {
                    50: "#ecf2f7", 100: "#dce7f1", 200: "#b9cfe2", 300: "#8fb0cc",
                    400: "#3b6a8f", 500: "#0a4a7d", 600: "#02365e", 700: "#022b4b",
                    800: "#01223b", 900: "#011a2e", 950: "#011222",
                },
                violet: {
                    50: "#ecf2f7", 100: "#dce7f1", 200: "#b9cfe2", 300: "#8fb0cc",
                    400: "#3b6a8f", 500: "#0a4a7d", 600: "#02365e", 700: "#022b4b",
                    800: "#01223b", 900: "#011a2e", 950: "#011222",
                },
                fuchsia: {
                    50: "#ecf2f7", 100: "#dce7f1", 200: "#b9cfe2", 300: "#8fb0cc",
                    400: "#3b6a8f", 500: "#0a4a7d", 600: "#02365e", 700: "#022b4b",
                    800: "#01223b", 900: "#011a2e", 950: "#011222",
                },
                sky: {
                    50: "#ecf2f7", 100: "#dce7f1", 200: "#b9cfe2", 300: "#8fb0cc",
                    400: "#3b6a8f", 500: "#0a4a7d", 600: "#02365e", 700: "#022b4b",
                    800: "#01223b", 900: "#011a2e", 950: "#011222",
                },
                cyan: {
                    50: "#ecf2f7", 100: "#dce7f1", 200: "#b9cfe2", 300: "#8fb0cc",
                    400: "#3b6a8f", 500: "#0a4a7d", 600: "#02365e", 700: "#022b4b",
                    800: "#01223b", 900: "#011a2e", 950: "#011222",
                },
                emerald: {
                    50: "#eef5f1", 100: "#dcebe2", 200: "#b8d6c4", 300: "#8dbaa0",
                    400: "#5e9a78", 500: "#3d7d5a", 600: "#2f6b4f", 700: "#255840",
                    800: "#1c4632", 900: "#143424", 950: "#0c2217",
                },
                green: {
                    50: "#eef5f1", 100: "#dcebe2", 200: "#b8d6c4", 300: "#8dbaa0",
                    400: "#5e9a78", 500: "#3d7d5a", 600: "#2f6b4f", 700: "#255840",
                    800: "#1c4632", 900: "#143424", 950: "#0c2217",
                },
                teal: {
                    50: "#eef5f1", 100: "#dcebe2", 200: "#b8d6c4", 300: "#8dbaa0",
                    400: "#5e9a78", 500: "#3d7d5a", 600: "#2f6b4f", 700: "#255840",
                    800: "#1c4632", 900: "#143424", 950: "#0c2217",
                },
                amber: {
                    50: "#fbf6ea", 100: "#f6ecd2", 200: "#ecd9a5", 300: "#dfc078",
                    400: "#cfa34a", 500: "#b8860b", 600: "#9a7009", 700: "#8a6508",
                    800: "#6b4f06", 900: "#4d3904", 950: "#332602",
                },
                yellow: {
                    50: "#fbf6ea", 100: "#f6ecd2", 200: "#ecd9a5", 300: "#dfc078",
                    400: "#cfa34a", 500: "#b8860b", 600: "#9a7009", 700: "#8a6508",
                    800: "#6b4f06", 900: "#4d3904", 950: "#332602",
                },
                orange: {
                    50: "#fbf6ea", 100: "#f6ecd2", 200: "#ecd9a5", 300: "#dfc078",
                    400: "#cfa34a", 500: "#b8860b", 600: "#9a7009", 700: "#8a6508",
                    800: "#6b4f06", 900: "#4d3904", 950: "#332602",
                },
                red: {
                    50: "#fbf2f4", 100: "#f6e3e8", 200: "#ecc5cf", 300: "#dc9eae",
                    400: "#c46c83", 500: "#b04a64", 600: "#a3324a", 700: "#8a2a3f",
                    800: "#6f2233", 900: "#541a27", 950: "#38111a",
                },
                rose: {
                    50: "#fbf2f4", 100: "#f6e3e8", 200: "#ecc5cf", 300: "#dc9eae",
                    400: "#c46c83", 500: "#b04a64", 600: "#a3324a", 700: "#8a2a3f",
                    800: "#6f2233", 900: "#541a27", 950: "#38111a",
                },
                pink: {
                    50: "#fbf2f4", 100: "#f6e3e8", 200: "#ecc5cf", 300: "#dc9eae",
                    400: "#c46c83", 500: "#b04a64", 600: "#a3324a", 700: "#8a2a3f",
                    800: "#6f2233", 900: "#541a27", 950: "#38111a",
                },
                siga: { azul: "#02365e", "azul-claro": "#ecf2f7", oro: "#b8860b", "oro-texto": "#8a6508", rojo: "#a3324a", fondo: "#fbfbfd" },
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                claro: {
                    blue: "#007BFF",
                    red: "#E30613",
                },
            },
            // Radio de 4 px en todo lo que no es circular, como SIGA.
            borderRadius: {
                sm: "2px", md: "4px", lg: "4px", xl: "4px", "2xl": "4px", "3xl": "4px",
            },
            keyframes: {
                "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
                "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
                "slide-in": { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(0)" } },
                "fade-in": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                "slide-in": "slide-in 0.3s ease-out",
                "fade-in": "fade-in 0.3s ease-out",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
};

export default config;
