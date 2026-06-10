export interface ProposalRow {
    cant: number;
    equipo: string;
    datos: string;
    costoUnitarioBase: number;
    totalCostoBase: number;
    aplicabilidad: string;
    precioUnitarioAplic: number;
    descuentoPct: number;
    precioUnitarioDesc: number;
    montoTotalRd: number;
}

export const PROPOSAL_DATA: ProposalRow[] = [
    { cant: 1, equipo: "iPhone 17 Pro Max 256GB", datos: "50GB", costoUnitarioBase: 108495, totalCostoBase: 108495, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 85595, descuentoPct: 100, precioUnitarioDesc: 0, montoTotalRd: 0 },
    { cant: 4, equipo: "iPhone 17 Pro Max 256GB", datos: "25GB", costoUnitarioBase: 108495, totalCostoBase: 433980, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 88695, descuentoPct: 70, precioUnitarioDesc: 26608.5, montoTotalRd: 106434 },
    { cant: 1, equipo: "Samsung S25 Ultra 512GB", datos: "15GB Apps", costoUnitarioBase: 93095, totalCostoBase: 93095, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 93295, descuentoPct: 70, precioUnitarioDesc: 27988.5, montoTotalRd: 27988.5 },
    { cant: 3, equipo: "iPhone 17 256GB", datos: "15GB Apps", costoUnitarioBase: 72395, totalCostoBase: 217185, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 59795, descuentoPct: 70, precioUnitarioDesc: 17938.5, montoTotalRd: 53815.5 },
    { cant: 1, equipo: "Motorola G56 256GB", datos: "15GB Apps", costoUnitarioBase: 17995, totalCostoBase: 17995, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 8495, descuentoPct: 100, precioUnitarioDesc: 0, montoTotalRd: 0 },
    { cant: 1, equipo: "Honor 90 smart 5G 256GB", datos: "15GB Apps", costoUnitarioBase: 18045, totalCostoBase: 18045, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 8495, descuentoPct: 100, precioUnitarioDesc: 0, montoTotalRd: 0 },
    { cant: 1, equipo: "Samsung A07 128GB", datos: "15GB Apps", costoUnitarioBase: 8395, totalCostoBase: 8395, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 95, descuentoPct: 100, precioUnitarioDesc: 0, montoTotalRd: 0 },
    { cant: 2, equipo: "iPhone 17 Pro 256GB", datos: "15GB Apps", costoUnitarioBase: 99445, totalCostoBase: 198890, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 84895, descuentoPct: 70, precioUnitarioDesc: 25468.5, montoTotalRd: 50937 },
    { cant: 2, equipo: "iPhone 17 Pro Max 256GB", datos: "15GB Apps", costoUnitarioBase: 108495, totalCostoBase: 216990, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 93295, descuentoPct: 70, precioUnitarioDesc: 27988.5, montoTotalRd: 55977 },
    { cant: 3, equipo: "Samaung A07 128GB", datos: "15GB Libre", costoUnitarioBase: 8395, totalCostoBase: 25185, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 0, descuentoPct: 100, precioUnitarioDesc: 0, montoTotalRd: 0 },
    { cant: 1, equipo: "Motorola G06 128GB", datos: "10GB Apps", costoUnitarioBase: 6495, totalCostoBase: 6495, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 0, descuentoPct: 100, precioUnitarioDesc: 0, montoTotalRd: 0 },
    { cant: 2, equipo: "iPhone 17 Pro Max 256GB", datos: "10GB Apps", costoUnitarioBase: 108495, totalCostoBase: 216990, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 94495, descuentoPct: 60, precioUnitarioDesc: 37798, montoTotalRd: 75596 },
    { cant: 4, equipo: "iPhone 17 256GB", datos: "10GB Apps", costoUnitarioBase: 72395, totalCostoBase: 289580, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 60995, descuentoPct: 60, precioUnitarioDesc: 24398, montoTotalRd: 97592 },
    { cant: 3, equipo: "Motorola G56 256GB", datos: "10GB Apps", costoUnitarioBase: 17995, totalCostoBase: 53985, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 9695, descuentoPct: 60, precioUnitarioDesc: 3878, montoTotalRd: 11634 },
    { cant: 2, equipo: "Honor 400 5G", datos: "10GB Apps", costoUnitarioBase: 16095, totalCostoBase: 32190, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 7995, descuentoPct: 60, precioUnitarioDesc: 3198, montoTotalRd: 6396 },
    { cant: 3, equipo: "Honor 400 5G 512GB", datos: "10GB Apps", costoUnitarioBase: 37745, totalCostoBase: 113235, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 25895, descuentoPct: 60, precioUnitarioDesc: 10358, montoTotalRd: 31074 },
    { cant: 15, equipo: "Samsung A07 128GB", datos: "10GB Apps", costoUnitarioBase: 8395, totalCostoBase: 125925, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 495, descuentoPct: 100, precioUnitarioDesc: 0, montoTotalRd: 0 },
    { cant: 1, equipo: "Samsung S25 Ultra 512GB", datos: "10GB Apps", costoUnitarioBase: 93095, totalCostoBase: 93095, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 74995, descuentoPct: 60, precioUnitarioDesc: 29998, montoTotalRd: 29998 },
    { cant: 4, equipo: "Samsung A56 256GB", datos: "10GB Apps", costoUnitarioBase: 32395, totalCostoBase: 129580, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 22195, descuentoPct: 60, precioUnitarioDesc: 8878, montoTotalRd: 35512 },
    { cant: 2, equipo: "Samsung A26 5G 256GB", datos: "10GB Apps", costoUnitarioBase: 20445, totalCostoBase: 40890, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 11795, descuentoPct: 60, precioUnitarioDesc: 4718, montoTotalRd: 9436 },
    { cant: 1, equipo: "Motorola G85 256GB", datos: "10GB Apps", costoUnitarioBase: 21895, totalCostoBase: 21895, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 12995, descuentoPct: 60, precioUnitarioDesc: 5198, montoTotalRd: 5198 },
    { cant: 3, equipo: "Iphone 17 Pro 256GB", datos: "10GB Apps", costoUnitarioBase: 99445, totalCostoBase: 298335, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 86095, descuentoPct: 60, precioUnitarioDesc: 34438, montoTotalRd: 103314 },
    { cant: 5, equipo: "Samsung A07 128GB", datos: "10GB", costoUnitarioBase: 8395, totalCostoBase: 41975, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 1295, descuentoPct: 100, precioUnitarioDesc: 0, montoTotalRd: 0 },
    { cant: 1, equipo: "Motorola G06 128GB", datos: "5GB", costoUnitarioBase: 6495, totalCostoBase: 6495, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 795, descuentoPct: 100, precioUnitarioDesc: 0, montoTotalRd: 0 },
    { cant: 4, equipo: "Motorola G06 128GB", datos: "5GB Apps", costoUnitarioBase: 6495, totalCostoBase: 25980, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 795, descuentoPct: 100, precioUnitarioDesc: 0, montoTotalRd: 0 },
    { cant: 4, equipo: "Samsung A26 5G 256GB", datos: "5GB Apps", costoUnitarioBase: 20445, totalCostoBase: 81780, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 12995, descuentoPct: 50, precioUnitarioDesc: 6497.5, montoTotalRd: 25990 },
    { cant: 1, equipo: "Motorola G85 256GB", datos: "5GB Apps", costoUnitarioBase: 21895, totalCostoBase: 21895, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 14195, descuentoPct: 50, precioUnitarioDesc: 7097.5, montoTotalRd: 7097.5 },
    { cant: 2, equipo: "Motola G56 256GB", datos: "5GB Apps", costoUnitarioBase: 17995, totalCostoBase: 35990, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 10895, descuentoPct: 50, precioUnitarioDesc: 5447.5, montoTotalRd: 10895 },
    { cant: 2, equipo: "Honor 400 5G 512GB", datos: "5GB Apps", costoUnitarioBase: 37745, totalCostoBase: 75490, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 27995, descuentoPct: 50, precioUnitarioDesc: 13997.5, montoTotalRd: 27995 },
    { cant: 1, equipo: "Honor 400 Lite 256GB", datos: "5GB Apps", costoUnitarioBase: 16095, totalCostoBase: 16095, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 14595, descuentoPct: 50, precioUnitarioDesc: 7297.5, montoTotalRd: 7297.5 },
    { cant: 1, equipo: "Samsung A56 256GB", datos: "5GB Apps", costoUnitarioBase: 32395, totalCostoBase: 32395, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 23295, descuentoPct: 50, precioUnitarioDesc: 11647.5, montoTotalRd: 11647.5 },
    { cant: 4, equipo: "Samsung A07 128GB", datos: "5GB Apps", costoUnitarioBase: 8395, totalCostoBase: 33580, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 2495, descuentoPct: 100, precioUnitarioDesc: 0, montoTotalRd: 0 },
    { cant: 5, equipo: "Motorola G06 128GB", datos: "2GB", costoUnitarioBase: 6495, totalCostoBase: 32475, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 1995, descuentoPct: 100, precioUnitarioDesc: 0, montoTotalRd: 0 },
    { cant: 69, equipo: "TCL ONE TOUCH", datos: "N/A", costoUnitarioBase: 1845, totalCostoBase: 127305, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 0, descuentoPct: 0, precioUnitarioDesc: 0, montoTotalRd: 0 },
    { cant: 1, equipo: "Samsung A26 5G 256GB", datos: "N/A", costoUnitarioBase: 20445, totalCostoBase: 20445, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 15795, descuentoPct: 0, precioUnitarioDesc: 15795, montoTotalRd: 15795 },
    { cant: 1, equipo: "Xiaomi Redmi A5", datos: "N/A", costoUnitarioBase: 6745, totalCostoBase: 6745, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 3595, descuentoPct: 0, precioUnitarioDesc: 3595, montoTotalRd: 3595 },
    { cant: 1, equipo: "Honor X5B 128GB", datos: "N/A", costoUnitarioBase: 6945, totalCostoBase: 6945, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 3795, descuentoPct: 0, precioUnitarioDesc: 3795, montoTotalRd: 3795 },
    { cant: 1, equipo: "Mororola G06 4G 128GB", datos: "N/A", costoUnitarioBase: 6495, totalCostoBase: 6495, aplicabilidad: "Cambiazo 18", precioUnitarioAplic: 3595, descuentoPct: 0, precioUnitarioDesc: 3595, montoTotalRd: 3595 }
];
