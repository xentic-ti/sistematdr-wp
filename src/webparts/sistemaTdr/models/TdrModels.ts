export interface ITdrAnalysisResult {
  tdrItemId?: string;
  numeroTdr?: string;
  entidad: string;
  areaUsuaria: string;
  requisitosMinimos: string;
  anexosObligatorios: string;
  solucion: string;
  consultasTi: string;
  experienciaProveedor: string;
  personalClave: string;
  formaPago: string;
  penalidades: string;
  plazo: string;
}

export interface IDetectedField { internalName: string; title: string; type: string; }

export interface IDetectedFields {
  id: IDetectedField;
  created?: IDetectedField;
  modified?: IDetectedField;
  author?: IDetectedField;
  numeroTdr?: IDetectedField;
  entidad?: IDetectedField;
  areaUsuaria?: IDetectedField;
  objetoContratacion?: IDetectedField;
  estado?: IDetectedField;
  plazo?: IDetectedField;
  pdf?: IDetectedField;
  resumen?: IDetectedField;
  requisitosMinimos?: IDetectedField;
  anexosObligatorios?: IDetectedField;
  solucion?: IDetectedField;
  experienciaProveedor?: IDetectedField;
  personalClave?: IDetectedField;
  formaPago?: IDetectedField;
  penalidades?: IDetectedField;
  consultasTi?: IDetectedField;
}

export interface ITdrItem {
  id: number;
  numeroTdr?: string;
  created?: string;
  modified?: string;
  author?: string;
  entidad?: string;
  areaUsuaria?: string;
  objetoContratacion?: string;
  estado?: string;
  plazo?: string;
  pdfUrl?: string;
  resumen?: string;
}

export interface ITdrSection { key: string; title: string; value: string; }

export interface ITdrDetail extends ITdrItem {
  linkTdr?: string;
  requisitosMinimos?: string;
  anexosObligatorios?: string;
  solucion?: string;
  experienciaProveedor?: string;
  personalClave?: string;
  formaPago?: string;
  penalidades?: string;
  consultasTi?: string;
  sections: ITdrSection[];
}

export interface ITdrPage { items: ITdrItem[]; fields: IDetectedFields; nextLink?: string; }

export interface IChatSource { id?: string; title?: string; fileName?: string; url?: string; snippet?: string; score?: number; }
export type ChatRole = 'user' | 'assistant' | 'system';
export interface IChatMessage { messageId: string; sessionId: string; role: ChatRole; content: string; createdAt?: string; order: number; azureResponseId?: string; sources: IChatSource[]; }
export interface IChatSession { sessionId: string; tdrItemId: string; numeroTdr?: string; title?: string; status: string; createdAt?: string; lastMessageAt?: string; azureResponseId?: string; }
export interface IChatBootstrap { session: IChatSession; messages: IChatMessage[]; }
export interface IChatSendResult { success: boolean; sessionId?: string; userMessage?: IChatMessage; assistantMessage?: IChatMessage; errorMessage?: string; }
export interface IChatTarget { tdrItemId: string; title?: string; entidad?: string; }

export const TDR_STATUSES: string[] = ['Nuevo', 'Aprobado', 'En Evaluación', 'No aplicable', 'Enviado a Entidad'];
