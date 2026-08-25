import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // La app vive bajo /flota para poder servirse desde el dominio de SIGA
    // (siga.adventistassureste.org/flota). Next reescribe solo los enlaces
    // internos, los assets y el router; no hay que tocar los componentes.
    basePath: "/flota",
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "**",
            },
        ],
    },
    // Quien tenga guardado el enlace viejo (la raiz) cae en la app igual.
    async redirects() {
        return [{ source: "/", destination: "/flota", basePath: false, permanent: false }];
    },
};

export default nextConfig;
