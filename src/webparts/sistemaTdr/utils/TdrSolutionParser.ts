import { IParsedTdrSolution, ITdrRecommendation } from '../models/TdrSolutionModels';

const START = '[[SISTEMATDR:XENTIC:V1:INICIO]]';
const END = '[[SISTEMATDR:XENTIC:V1:FIN]]';
const ITEM = /^---\s*RECOMENDACI(?:Ó|O)N\s*---$/i;
type Fields = { [key: string]: string };

export default class TdrSolutionParser {
  public static parse(storedValue?: string): IParsedTdrSolution {
    const value = storedValue || '';
    const start = value.indexOf(START);
    const end = start >= 0 ? value.indexOf(END, start + START.length) : -1;
    if (start < 0) return { solucionSolicitada: this.removeMarkers(value).trim(), recomendaciones: [], bloqueIncompleto: value.indexOf(END) >= 0 };
    const requested = this.removeMarkers(value.substring(0, start)).trim();
    if (end < 0) return { solucionSolicitada: requested, recomendaciones: [], mensaje: 'La recomendación almacenada está incompleta y no se puede mostrar de forma segura.', bloqueIncompleto: true };
    const sections = this.splitSections(value.substring(start + START.length, end).replace(/\r/g, ''));
    const header = this.readFields(sections[0] || '');
    const classification = this.field(header, ['clasificacion']);
    const recommendations = sections.slice(1).map(section => this.parseItem(section)).filter(item => !!(item.marca || item.productoSolucion || item.requerimiento));
    return { solucionSolicitada: requested, recomendaciones: recommendations, clasificacion: classification === 'B' || classification === 'C' ? classification : undefined, mensaje: this.field(header, ['mensaje']) || undefined, bloqueIncompleto: false };
  }
  public static safeHttpUrl(value?: string): string | undefined {
    if (!value || !/^https?:\/\//i.test(value.trim())) return undefined;
    try { const parsed = new URL(value.trim()); return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : undefined; } catch { return undefined; }
  }
  private static splitSections(block: string): string[] { const result: string[] = ['']; block.split('\n').forEach(line => { if (ITEM.test(line.trim())) result.push(''); else result[result.length - 1] += `${line}\n`; }); return result; }
  private static parseItem(section: string): ITdrRecommendation {
    const f = this.readFields(section); const list = (keys: string[]): string[] => this.field(f, keys).split('|').map(v => v.trim()).filter(Boolean);
    return { requerimiento: this.field(f, ['requerimiento', 'requisito']), marca: this.field(f, ['marca', 'fabricante']), productoSolucion: this.field(f, ['producto/solucion', 'producto', 'solucion', 'nombre del producto']), cantidad: this.field(f, ['cantidad', 'cantidad y unidad']), caracteristicas: this.field(f, ['caracteristicas', 'caracteristicas principales']), urlOficial: this.safeHttpUrl(this.field(f, ['url oficial', 'url', 'enlace oficial'])), esFichaTecnica: this.normalize(this.field(f, ['tipo de enlace'])) === 'ficha tecnica', validacionTecnica: this.field(f, ['validacion tecnica', 'estado de validacion']), justificacion: this.field(f, ['justificacion', 'justificacion tecnica']), requisitosConfirmados: list(['requisitos confirmados', 'confirmados']), requisitosNoConfirmados: list(['requisitos no confirmados', 'no confirmados']), requisitosNoCumplidos: list(['requisitos no cumplidos', 'no cumplidos']) };
  }
  private static readFields(value: string): Fields { const fields: Fields = {}; value.split('\n').forEach(line => { const separator = line.indexOf(':'); if (separator < 1) return; const key = this.normalize(line.substring(0, separator)); if (key) fields[key] = line.substring(separator + 1).trim(); }); return fields; }
  private static field(fields: Fields, aliases: string[]): string { for (const alias of aliases) { const value = fields[this.normalize(alias)]; if (value) return value; } return ''; }
  private static normalize(value: string): string { return value.toLowerCase().replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i').replace(/[óòöô]/g, 'o').replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n').trim(); }
  private static removeMarkers(value: string): string { return value.split(START).join('').split(END).join(''); }
}
