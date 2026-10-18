import { paintedItemFragment } from './paintedArt.js';
import { escapeHtml as esc } from '../ui/rankCrest.js';
export function ItemArt(item,size=112) { return `<svg class="item-art painted-item-art" width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="${esc(item.accessibleDescription)}"><title>${esc(item.name)}</title>${paintedItemFragment(item,120)}</svg>`; }
