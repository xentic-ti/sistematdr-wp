import * as React from 'react';
import { DirectionalHint, Icon, IconButton, Link, MessageBar, MessageBarType, TooltipHost } from '@fluentui/react';
import { IParsedTdrSolution, ITdrRecommendation } from '../models/TdrSolutionModels';
import styles from './SistemaTdr.module.scss';

interface IProps { result: IParsedTdrSolution; }
const status = (item: ITdrRecommendation): { label: string; className: string; icon: string } => {
  if (item.validacionTecnica === 'Verificado') return { label: 'Verificado', className: styles.xenticStatusConfirmed, icon: 'CompletedSolid' };
  if (item.validacionTecnica === 'NoCumple') return { label: 'No cumple', className: styles.xenticStatusFailed, icon: 'StatusErrorFull' };
  if (item.validacionTecnica === 'SinAlternativaVerificada') return { label: 'Sin alternativa verificada', className: styles.xenticStatusPending, icon: 'WarningSolid' };
  return { label: item.validacionTecnica === 'PendienteDeVerificar' ? 'Pendiente de verificar' : (item.validacionTecnica || 'Sin validación informada'), className: styles.xenticStatusPending, icon: 'StatusCircleQuestionMark' };
};
const requirementList = (title: string, values: string[], className: string): React.ReactNode => values.length ? <section className={`${styles.xenticRequirements} ${className}`}><h5>{title}</h5><ul>{values.map((value, index) => <li key={index}>{value}</li>)}</ul></section> : null;
const ClassificationInfo: React.FC = () => <TooltipHost
  content={<div className={styles.classificationTooltip}><strong>Clasificación A/B/C</strong><span><b>A:</b> El TDR especifica una marca o producto concreto.</span><span><b>B:</b> El TDR describe la necesidad, pero no especifica un producto.</span><span><b>C:</b> El TDR especifica una solución y requiere recomendar componentes adicionales.</span></div>}
  directionalHint={DirectionalHint.bottomRightEdge}
  calloutProps={{ gapSpace: 6 }}
>
  <IconButton className={styles.classificationInfoButton} iconProps={{ iconName: 'Info' }} ariaLabel="Ver significado de las clasificaciones A, B y C" title="Información sobre la clasificación"/>
</TooltipHost>;
const RecommendationCard: React.FC<{ item: ITdrRecommendation; classification?: string }> = ({ item, classification }) => { const state = status(item); return <article className={styles.xenticCard}>
  <header className={styles.xenticCardHeader}><div><span>{item.marca || 'Fabricante no indicado'}</span><h4>{item.productoSolucion || item.requerimiento || 'Producto no indicado'}</h4></div><div className={styles.xenticBadges}>{classification && <div className={styles.xenticClassificationGroup}><span className={styles.xenticClassification}>Clasificación {classification}</span><ClassificationInfo/></div>}<span className={state.className}><Icon iconName={state.icon}/> {state.label}</span></div></header>
  <dl className={styles.xenticFacts}>{item.requerimiento && <div><dt>Requerimiento</dt><dd>{item.requerimiento}</dd></div>}{item.cantidad && <div><dt>Cantidad y unidad</dt><dd>{item.cantidad}</dd></div>}{item.caracteristicas && <div className={styles.xenticFactWide}><dt>Características principales</dt><dd>{item.caracteristicas}</dd></div>}</dl>
  <div className={styles.xenticRequirementGrid}>{requirementList('Requisitos confirmados', item.requisitosConfirmados, styles.xenticConfirmed)}{requirementList('No existe evidencia suficiente', item.requisitosNoConfirmados, styles.xenticPending)}{requirementList('Requisitos no cumplidos', item.requisitosNoCumplidos, styles.xenticFailed)}</div>
  {(item.justificacion || item.urlOficial) && <footer className={styles.xenticCardFooter}>{item.justificacion && <details><summary>Ver justificación técnica</summary><p>{item.justificacion}</p></details>}{item.urlOficial && <Link href={item.urlOficial} target="_blank" rel="noopener noreferrer">{item.esFichaTecnica ? 'Abrir ficha técnica oficial' : 'Abrir documentación oficial'} <Icon iconName="OpenInNewWindow"/></Link>}</footer>}
  </article>; };
const XenticRecommendation: React.FC<IProps> = ({ result }) => {
  if (!result.recomendaciones.length && !result.mensaje && !result.bloqueIncompleto) return null;
  return <section className={styles.xenticRecommendation} aria-labelledby="xentic-recommendation-title"><div className={styles.xenticTitle}><Icon iconName="Lightbulb"/><div><h3 id="xentic-recommendation-title">Solución recomendada por Xentic</h3><p>Resultado técnico asociado a la solución solicitada.</p></div></div>{result.mensaje && <MessageBar messageBarType={result.bloqueIncompleto ? MessageBarType.warning : MessageBarType.info} isMultiline>{result.mensaje}</MessageBar>}<div className={styles.xenticCards}>{result.recomendaciones.map((item, index) => <RecommendationCard key={`${item.productoSolucion}-${index}`} item={item} classification={result.clasificacion}/>)}</div></section>;
};
export default XenticRecommendation;
