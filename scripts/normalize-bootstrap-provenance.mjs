// Migration de compatibilité : aucune restauration du stock tiers.
import { purgeIndirectSources } from './purge-indirect-sources.mjs';
await purgeIndirectSources();
