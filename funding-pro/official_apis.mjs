/**
 * Official open-data discovery adapters only.
 * Search results are NOT proof of grant eligibility.
 * No secrets, no paid APIs, no LLM and no persistent client data.
 */
const API = Object.freeze({
  companies: 'https://recherche-entreprises.api.gouv.fr/search',
  datasets: 'https://www.data.gouv.fr/api/1/datasets/'
});
const safeTerm = value => {
  if (typeof value !== 'string' || value.trim().length < 2 || value.trim().length > 120) {
    throw new TypeError('Terme de recherche requis, longueur 2 à 120');
  }
  return value.trim();
};
async function requestJson(url, fetcher) {
  const response = await fetcher(url.toString(), { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Source officielle indisponible : HTTP ' + response.status);
  return response.json();
}
export async function rechercherEntreprise(query, fetcher = fetch) {
  const url = new URL(API.companies);
  url.searchParams.set('q', safeTerm(query));
  url.searchParams.set('per_page', '10');
  const payload = await requestJson(url, fetcher);
  const results = Array.isArray(payload.results) ? payload.results : [];
  return {
    source: API.companies,
    verified_at: new Date().toISOString(),
    eligibility_determined: false,
    companies: results.slice(0, 10).map(r => ({
      siren: r.siren || null,
      name: r.nom_complet || r.nom_raison_sociale || null,
      activity_code: r.activite_principale || null,
      municipality: r.siege?.libelle_commune || null
    }))
  };
}
export async function rechercherJeuxDeDonnees(query, fetcher = fetch) {
  const url = new URL(API.datasets);
  url.searchParams.set('q', safeTerm(query));
  url.searchParams.set('page_size', '10');
  const payload = await requestJson(url, fetcher);
  const entries = Array.isArray(payload.data) ? payload.data : [];
  return {
    source: API.datasets,
    verified_at: new Date().toISOString(),
    eligibility_determined: false,
    notice: 'Métadonnées ouvertes à confirmer auprès du financeur officiel ; aucune éligibilité ne découle de cette API.',
    datasets: entries.slice(0, 10).map(d => ({
      id: d.id || null,
      title: d.title || null,
      updated_at: d.last_update || null,
      official_catalogue_url: d.page || null
    }))
  };
}
