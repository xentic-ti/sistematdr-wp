import { AadHttpClient, AadHttpClientFactory, HttpClientResponse } from '@microsoft/sp-http';
import { ITdrAnalysisResult } from '../models/TdrModels';

const API_RESOURCE = 'api://b02153e0-a22d-4fef-8ed1-7fa0d3769a57';
const NOT_SPECIFIED = 'No especificado';
const AUTH_ERROR = 'No fue posible autenticar la solicitud contra SistemaTDR. Verifique que el permiso SistemaTDR API / access_as_user esté aprobado en el Centro de administración de SharePoint.';

export class TdrApiError extends Error {
  public constructor(message: string, public readonly status?: number) { super(message); this.name = 'TdrApiError'; }
}

export default class TdrApiService {
  private readonly apiBaseUrl: string;
  public constructor(private readonly aadHttpClientFactory: AadHttpClientFactory, apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl.trim().replace(/\/+$/, '');
  }

  public async analyze(file: File): Promise<ITdrAnalysisResult> {
    if (!this.apiBaseUrl) throw new TdrApiError('Configure la URL base de la API en las propiedades del Web Part.');
    let client: AadHttpClient;
    try { client = await this.aadHttpClientFactory.getClient(API_RESOURCE); } catch { throw new TdrApiError(AUTH_ERROR); }
    const body = new FormData(); body.append('archivo', file, file.name);
    let response: HttpClientResponse;
    try { response = await client.post(`${this.apiBaseUrl}/api/tdr/analizar`, AadHttpClient.configurations.v1, { body }); }
    catch (error) { throw new TdrApiError(TdrApiService.connectionErrorMessage(error)); }
    const text = await response.text();
    if (!response.ok) throw new TdrApiError(TdrApiService.httpErrorMessage(response.status, text), response.status);
    let payload: unknown;
    try { payload = JSON.parse(text); } catch { throw new TdrApiError('La API respondió correctamente, pero el contenido no es JSON válido.'); }
    TdrApiService.ensureSuccessfulPayload(payload);
    const result = TdrApiService.normalizeResult(payload);
    if (!result.tdrItemId) throw new TdrApiError('El documento fue analizado, pero el backend no confirmó el guardado en TDR_analisis ni devolvió un ID. Publique la versión actualizada de la API.');
    return result;
  }

  private static normalizeResult(payload: unknown): ITdrAnalysisResult {
    const root = TdrApiService.asRecord(payload);
    const nested = root.resultado || root.Resultado || root.result || root.Result || root.data || root.Data;
    const value = TdrApiService.isRecord(nested) ? nested : root;
    return {
      tdrItemId: TdrApiService.readOptional(value, root, 'tdrItemId', 'TdrItemId', 'itemId', 'ItemId', 'sharePointItemId', 'SharePointItemId'),
      numeroTdr: TdrApiService.readOptional(value, root, 'numeroTdr', 'NumeroTdr', 'nroTdr', 'NroTdr', 'Nro_tdr'),
      entidad: TdrApiService.read(value, 'entidad', 'Entidad'), areaUsuaria: TdrApiService.read(value, 'area_usuaria', 'areaUsuaria', 'AreaUsuaria', 'área_usuaria', 'ÁreaUsuaria'),
      requisitosMinimos: TdrApiService.read(value, 'requisitos_minimos', 'requisitosMinimos', 'RequisitosMinimos'), anexosObligatorios: TdrApiService.read(value, 'anexos_obligatorios', 'anexosObligatorios', 'AnexosObligatorios'),
      solucion: TdrApiService.read(value, 'solucion', 'Solucion'), consultasTi: TdrApiService.read(value, 'consultas_ti', 'consultasTi', 'ConsultasTi'),
      experienciaProveedor: TdrApiService.read(value, 'experiencia_proveedor', 'experienciaProveedor', 'ExperienciaProveedor'), personalClave: TdrApiService.read(value, 'personal_clave', 'personalClave', 'PersonalClave'),
      formaPago: TdrApiService.read(value, 'forma_pago', 'formaPago', 'FormaPago'), penalidades: TdrApiService.read(value, 'penalidades', 'Penalidades'), plazo: TdrApiService.read(value, 'plazo', 'Plazo')
    };
  }
  private static ensureSuccessfulPayload(value: unknown): void { if (TdrApiService.isRecord(value) && (value.success === false || value.Success === false)) { const m = value.message || value.Message || value.detail || value.title; throw new TdrApiError(typeof m === 'string' && m.trim() ? m.trim() : 'SistemaTDR indicó que no fue posible analizar el documento.'); } }
  private static read(record: Record<string, unknown>, ...keys: string[]): string { for (const key of keys) if (Object.prototype.hasOwnProperty.call(record, key)) return TdrApiService.format(record[key]); return NOT_SPECIFIED; }
  private static readOptional(first: Record<string, unknown>, second: Record<string, unknown>, ...keys: string[]): string | undefined { for (const record of [first, second]) for (const key of keys) { const v = record[key]; if (typeof v === 'string' && v.trim()) return v.trim(); if (typeof v === 'number') return String(v); } return undefined; }
  private static format(value: unknown): string { if (value === null || value === undefined || value === '') return NOT_SPECIFIED; if (typeof value === 'string') return value.trim() || NOT_SPECIFIED; if (typeof value === 'number') return value.toLocaleString('es-PE'); if (typeof value === 'boolean') return value ? 'Sí' : 'No'; if (Array.isArray(value)) { const a = value.map(TdrApiService.format).filter(v => v !== NOT_SPECIFIED); return a.length ? a.join('\n') : NOT_SPECIFIED; } if (TdrApiService.isRecord(value)) return Object.keys(value).map(k => `${k}: ${TdrApiService.format(value[k])}`).join('\n') || NOT_SPECIFIED; return String(value); }
  private static asRecord(value: unknown): Record<string, unknown> { if (!TdrApiService.isRecord(value)) throw new TdrApiError('La respuesta de la API no contiene un objeto de resultado válido.'); return value; }
  private static isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
  private static httpErrorMessage(status: number, text: string): string { if (status === 400) return `El backend rechazó el documento. ${TdrApiService.extract(text)}`; if (status === 401 || status === 403) return AUTH_ERROR; if (status === 404) return 'No se encontró el endpoint de análisis. Verifique que la API /api/tdr/analizar esté publicada en el backend.'; if (status === 413) return 'El archivo supera el tamaño máximo permitido por SistemaTDR.'; if (status === 500) return `SistemaTDR tuvo un error al analizar o guardar el documento. ${TdrApiService.extract(text)}`; return status >= 500 ? 'SistemaTDR tuvo un error al procesar el documento. Intente nuevamente o revise los registros del backend.' : `La solicitud no pudo completarse (HTTP ${status}). ${TdrApiService.extract(text)}`; }
  private static extract(text: string): string { if (!text.trim()) return 'Revise que el PDF cumpla con los requisitos de la API.'; try { const p: unknown = JSON.parse(text); if (TdrApiService.isRecord(p)) { const m = p.message || p.Message || p.detail || p.title; if (typeof m === 'string' && m.trim()) return m; } } catch { /* use text */ } return text.trim().substring(0, 240); }
  private static connectionErrorMessage(error: unknown): string { const m = error instanceof Error ? error.message.trim() : ''; const lower = m.toLowerCase(); if (lower.indexOf('cors') !== -1 || lower.indexOf('cross-origin') !== -1 || lower.indexOf('failed to fetch') !== -1) return 'El navegador bloqueó la conexión con SistemaTDR. Verifique la configuración CORS del backend para el origen de SharePoint.'; return m ? `No fue posible conectar con SistemaTDR por un error de red. ${m}` : 'No fue posible conectar con SistemaTDR por un error de red. Verifique la conectividad y vuelva a intentarlo.'; }
}
