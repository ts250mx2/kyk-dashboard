import { query } from '@/lib/db';

/** Datos de conexión de un NVR registrado en tblNVR. */
export interface NvrConnection {
    idNvr: number;
    ip: string;
    user: string;
    pass: string;
}

interface NvrRow {
    IdNVR: number;
    IP: string | null;
    Usuario: string | null;
    Passwd: string | null;
}

/** Carga la conexión del NVR o lanza un Error con mensaje para el usuario. */
export async function getNvrConnection(idNvr: number): Promise<NvrConnection> {
    if (!Number.isFinite(idNvr) || idNvr <= 0) {
        throw new Error('id de NVR inválido');
    }
    const rows = (await query(
        'SELECT IdNVR, IP, Usuario, Passwd FROM dbo.tblNVR WHERE IdNVR = ?',
        [idNvr]
    )) as NvrRow[];
    const nvr = rows[0];
    if (!nvr) throw new Error('NVR no encontrado');
    if (!nvr.IP?.trim()) throw new Error('El NVR no tiene IP registrada');
    return {
        idNvr: nvr.IdNVR,
        ip: nvr.IP.trim(),
        user: nvr.Usuario ?? '',
        pass: nvr.Passwd ?? '',
    };
}
