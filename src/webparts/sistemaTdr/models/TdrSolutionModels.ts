export type TdrValidationStatus = 'Verificado' | 'PendienteDeVerificar' | 'NoCumple' | 'SinAlternativaVerificada' | string;

export interface ITdrRecommendation {
  requerimiento: string; marca: string; productoSolucion: string; cantidad: string;
  caracteristicas: string; urlOficial?: string; esFichaTecnica: boolean;
  validacionTecnica: TdrValidationStatus; justificacion: string;
  requisitosConfirmados: string[]; requisitosNoConfirmados: string[]; requisitosNoCumplidos: string[];
}

export interface IParsedTdrSolution {
  solucionSolicitada: string; recomendaciones: ITdrRecommendation[];
  clasificacion?: 'B' | 'C'; mensaje?: string; bloqueIncompleto: boolean;
}
