export const PROJECT_THEMES=['R&D / Innovation','Investissement productif','Transition numérique','Transition écologique'];
export const CONCEPTS={
  'R&D / Innovation':['r&d','recherche industrielle','développement expérimental','innovation','prototype','preuve de concept','poc','démonstrateur','pilote','expérimentation','faisabilité','technologie','deeptech','laboratoire'],
  'Investissement productif':['investissement productif','machine','équipement','ligne de production','industrialisation','première usine','capacité de production','modernisation','outil de production','relocalisation','extension de site','site industriel'],
  'Transition numérique':['numérique','digital','intelligence artificielle',' ia ','cybersécurité','robotique','automatisation','data','données','cloud','iot','jumeau numérique','industrie 4.0','logiciel','système d information'],
  'Transition écologique':['décarbonation','transition écologique','efficacité énergétique','énergie','électrification','chaleur','économie circulaire','recyclage','réemploi','écoconception','déchets','eau','biodiversité','climat','sobriété','mobilité','bas carbone'],
  'Emploi / compétences':['emploi','recrutement','compétences','formation','ressources humaines'],
  'Export / international':['export','internationalisation','international']
};
export function inferThemes(text=''){const t=(' '+String(text).toLowerCase()+' ');return Object.entries(CONCEPTS).filter(([,xs])=>xs.some(x=>t.includes(String(x).toLowerCase()))).map(([k])=>k)}
export function inProjectScope(a={}){const themes=new Set([...(a.themes||[]),...inferThemes([a.title,a.objective,a.beneficiaries,a.eligibleExpenses,a.prerequisites,...(a.projectsExpected||[]),...(a.projectLabels||[])].filter(Boolean).join(' '))]);return PROJECT_THEMES.some(t=>themes.has(t))}
