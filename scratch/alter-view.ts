require('dotenv').config({path: '.env.local'});
import { query } from '../src/lib/db.ts';

const alterSql = `
ALTER VIEW dbo.Cortes
AS
SELECT        dbo.tblAperturasCierres.IdApertura, dbo.tblAperturasCierres.FechaApertura, dbo.tblAperturasCierres.EfectivoInicio, dbo.tblAperturasCierres.FechaCierre, dbo.tblAperturasCierres.VistaPrecios, dbo.tblAperturasCierres.Cancelados, 
                         dbo.tblAperturasCierres.Impresiones, dbo.tblAperturasCierres.TicketCorte, dbo.tblUsuarios.Usuario AS Cajero, dbo.tblTiendas.Tienda, dbo.tblAperturasCierres.IdTienda, dbo.tblAperturasCierres.IdComputadora AS Caja, 
                         SUM(dbo.tblVentas.Total) AS TotalVenta, MONTH(dbo.tblAperturasCierres.FechaApertura) AS Mes, YEAR(dbo.tblAperturasCierres.FechaApertura) AS Anio, dbo.tblMeses.MesTexto, dbo.tblDiasSemana.DiaSemanaTexto, 
                         dbo.tblMeses.MesTexto + ' ' + CAST(YEAR(dbo.tblAperturasCierres.FechaApertura) AS VARCHAR(4)) AS MesAnio,
                         dbo.tblAperturasCierres.Efectivo, dbo.tblAperturasCierres.Tarjeta
FROM            dbo.tblAperturasCierres INNER JOIN
                         dbo.tblUsuarios ON dbo.tblAperturasCierres.IdCajero = dbo.tblUsuarios.IdUsuario INNER JOIN
                         dbo.tblTiendas ON dbo.tblAperturasCierres.IdTienda = dbo.tblTiendas.IdTienda LEFT OUTER JOIN
                         dbo.tblVentas ON dbo.tblAperturasCierres.IdComputadora = dbo.tblVentas.IdComputadora AND dbo.tblAperturasCierres.IdTienda = dbo.tblVentas.IdTienda AND 
                         dbo.tblAperturasCierres.IdApertura = dbo.tblVentas.IdApertura INNER JOIN
                         dbo.tblMeses ON MONTH(dbo.tblAperturasCierres.FechaApertura) = dbo.tblMeses.Mes INNER JOIN
                         dbo.tblDiasSemana ON DATEPART(weekday, dbo.tblAperturasCierres.FechaApertura) = dbo.tblDiasSemana.DiaSemana
GROUP BY dbo.tblAperturasCierres.IdApertura, dbo.tblAperturasCierres.FechaApertura, dbo.tblAperturasCierres.EfectivoInicio, dbo.tblAperturasCierres.FechaCierre, dbo.tblAperturasCierres.VistaPrecios, dbo.tblAperturasCierres.Cancelados, 
                         dbo.tblAperturasCierres.Impresiones, dbo.tblAperturasCierres.TicketCorte, dbo.tblUsuarios.Usuario, dbo.tblTiendas.Tienda, dbo.tblAperturasCierres.IdTienda, dbo.tblAperturasCierres.IdComputadora, dbo.tblMeses.MesTexto, 
                         dbo.tblDiasSemana.DiaSemanaTexto, dbo.tblAperturasCierres.Efectivo, dbo.tblAperturasCierres.Tarjeta
`;

async function run() {
    try {
        console.log("Altering Cortes View...");
        await query(alterSql);
        console.log("Cortes View altered successfully!");
    } catch(e) {
        console.error("Failed to alter view:", e);
    }
    process.exit(0);
}
run();
