import wall from '../data/wall.json';
import { wallSettings } from '../lib/desk-wall.js';
export function GET() {
  return new Response(JSON.stringify(wallSettings(wall)), {headers: {'Content-Type': 'application/json'}});
}
