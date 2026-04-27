import { NextResponse } from 'next/server';
import { sapQuery } from '@/lib/sap-db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
        return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    try {
        const query = `
            SELECT distinct  (CASE WHEN T0.BANKCODE = '0072' THEN '02' ELSE '04' END) as Operacion, T0.MandateId as Clave_ID, T0.DflIBAN as Cuenta_Destino, T3.DocTotal as Importe, 
            T3.DocNum as Referencia,
            (CASE WHEN T0.iNSTRUCKEY IS NULL THEN 'QUESOS Y CARNES FRIAS' ELSE T0.INSTRUCKEY END) as Descripcion , '1' as Mon_Origen,'1' as Moneda_Des,T0.LicTradNum as RFC,  '0' as IVA,  
            T10.E_MailL as Mail, (CASE WHEN T0.BANKCODE = '0072' THEN SUBSTRING(Convert(nvarchar,T3.DocDate,112),7,2)+SUBSTRING(Convert(nvarchar,T3.DocDate,112),5,2)+SUBSTRING(Convert(nvarchar,T3.DocDate,112),1,4) ELSE '' END) as Fecha_Aplicacion, 
            (CASE WHEN T0.iNSTRUCKEY IS NULL THEN 'QUESOS Y CARNES FRIAS' ELSE T0.INSTRUCKEY END) as Instruccion_de_Pago 
            FROM   
            VPM2 T2 
            INNER JOIN OVPM T3 ON T2.DocNum = T3.DocEntry
            INNER JOIN OCRD T0 ON T0.CArdCode = T3.CardCode
            LEFT JOIN VPM1 T5 ON T3.DocEntry = T5.DocNum
            LEFT JOIN OACT T6 ON T3.CashAcct = T6.AcctCode
            LEFT JOIN OACT T7 ON T5.CheckAct = T7.AcctCode
            LEFT JOIN OACT T8 ON T3.TrsfrAcct = T8.AcctCode
            LEFT JOIN OPCH T9 ON T9.DocEntry = T2.DocEntry
            LEFT JOIN OCPR T10 ON T10.CardCode = T0.CardCode
            WHERE
            T3.Canceled = 'N' 
            AND (T3.U_Cobrado = 'Y' OR T3.U_Cobrado is null) 
            AND T3.DocDate BETWEEN ? AND ?
            AND Status = 'Y'
            GROUP BY
            T3.DocNum,
            T3.U_Fecha,
            T3.DocDate,
            T3.DocTotal,
            T9.U_UUID,
            T0.BANKCODE,
            T0.MandateId,
            T0.DflIBAN,
            T0.iNSTRUCKEY,
            T10.E_MailL,
            Case
            WHEN T3.CashSum = 0 AND T3.CheckSum = 0 AND T3.TrsfrSum <> 0 THEN T8.AcctName
            WHEN T3.CashSum = 0 AND T3.CheckSum <> 0 AND T3.TrsfrSum = 0 THEN T7.AcctName
            WHEN T3.CashSum <> 0 AND T3.CheckSum = 0 AND T3.TrsfrSum = 0 THEN T6.AcctName
            ELSE 'No Identificado'
            END,
            T5.CheckNum,
            T3.CounterRef,
            T0.CardCode,
            T0.CardName,
            T0.LicTradNum,
            Case
            WHEN T3.CashSum = 0 AND T3.CheckSum = 0 AND T3.TrsfrSum <> 0 THEN 'Transferencia'
            WHEN T3.CashSum = 0 AND T3.CheckSum <> 0 AND T3.TrsfrSum = 0 THEN 'Cheque'
            WHEN T3.CashSum <> 0 AND T3.CheckSum = 0 AND T3.TrsfrSum = 0 THEN 'Efectivo'
            ELSE 'No Identificado'
            END
            ORDER BY T3.DocNum ASC
        `;

        const result = await sapQuery(query, [startDate, endDate]);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Dispersion query error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
