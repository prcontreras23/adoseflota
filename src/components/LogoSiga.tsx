// Logo de SIGA en blanco, para la barra azul. Lo sirve SIGA desde la raíz del
// dominio (/flota llega por un rewrite); en desarrollo, localhost no lo tiene y
// se toma de producción.
const LOGO = process.env.NODE_ENV === "development"
    ? "https://siga.adventistassureste.org/logo-siga-encabezado.png"
    : "/logo-siga-encabezado.png";

export default function LogoSiga({ alto = 20 }: { alto?: number }) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={LOGO} alt="SGA" style={{ height: alto, width: "auto", filter: "brightness(0) invert(1)" }} />;
}
