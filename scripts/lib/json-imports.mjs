// Lets plain Node load the site's modules, which import JSON the way Vite does
// (`import data from './x.json'`, without `with { type: 'json' }`).
// Used as: node --import ./scripts/lib/json-imports.mjs <script>
import { register } from 'node:module';

register('./json-hooks.mjs', import.meta.url);
