import * as React from 'react';
import { Icon, MessageBar, MessageBarType, PrimaryButton } from '@fluentui/react';
import { ITdrAnalysisResult } from '../models/TdrModels';
import styles from './SistemaTdr.module.scss';

export interface IAnalysisResultProps { result: ITdrAnalysisResult; onChatRequested: () => void; }
const cards: Array<{ key: keyof ITdrAnalysisResult; label: string; icon: string; wide?: boolean }> = [
  { key: 'entidad', label: 'Entidad', icon: 'CityNext' }, { key: 'areaUsuaria', label: 'Área usuaria', icon: 'Org' },
  { key: 'requisitosMinimos', label: 'Requisitos mínimos', icon: 'CheckList', wide: true }, { key: 'anexosObligatorios', label: 'Anexos obligatorios', icon: 'Attach', wide: true },
  { key: 'solucion', label: 'Solución', icon: 'Lightbulb', wide: true }, { key: 'consultasTi', label: 'Consultas TI', icon: 'Help', wide: true },
  { key: 'experienciaProveedor', label: 'Experiencia del proveedor', icon: 'People', wide: true }, { key: 'personalClave', label: 'Personal clave', icon: 'Contact', wide: true },
  { key: 'formaPago', label: 'Forma de pago', icon: 'PaymentCard' }, { key: 'penalidades', label: 'Penalidades', icon: 'Warning', wide: true }, { key: 'plazo', label: 'Plazo', icon: 'Calendar' }
];
const AnalysisResult: React.FC<IAnalysisResultProps> = ({ result, onChatRequested }) => <section className={styles.results} aria-labelledby="analysis-result-title">
  <div className={styles.resultHeader}><Icon iconName="CompletedSolid" className={styles.successIcon}/><div><h2 id="analysis-result-title">Resultado del análisis</h2><p>Información identificada en el documento.</p></div></div>
  <div className={styles.resultChatAction}><PrimaryButton text="Conversar sobre este TDR" iconProps={{ iconName: 'Chat' }} disabled={!result.tdrItemId} title={result.tdrItemId ? 'Abrir conversación' : 'El backend debe devolver el ID del registro guardado para habilitar el chat.'} onClick={onChatRequested}/></div>
  <MessageBar messageBarType={MessageBarType.success}>Guardado automáticamente en TDR_analisis como <strong>{result.numeroTdr || `ID ${result.tdrItemId}`}</strong>{result.numeroTdr && ` (ID ${result.tdrItemId})`}.</MessageBar>
  <div className={styles.resultGrid}>{cards.map(card => <article key={card.key} className={`${styles.resultCard} ${card.wide ? styles.resultCardWide : ''}`}><div className={styles.resultLabel}><Icon iconName={card.icon}/><h3>{card.label}</h3></div><p>{String(result[card.key] || '')}</p></article>)}</div>
</section>;
export default AnalysisResult;
