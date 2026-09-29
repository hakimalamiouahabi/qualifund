// Historical parser retained for fixture compatibility; collection is permanently disabled.
export function rowsFromStock(json){return Array.isArray(json)?json:(json?.data||json?.results||json?.aides||[])}
export async function collectAidesEntreprises(){throw new Error('Source Aides Entreprises supprimée définitivement du périmètre')}
