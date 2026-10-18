// What a photo scan reports for each garment it can see. Shared by the server
// (structured output from the vision model) and the browser (validation).
import {z} from 'zod';
import {GARMENT_TYPES,PATTERNS,MATERIALS} from '../garments.js';

export const FITS=['fitted','regular','relaxed','oversized'];
export const LENGTHS=['cropped','short','regular','long'];
export const SLEEVES=['none','short','three-quarter','long'];
export const MAX_SCANNED=6;

export const ScannedGarmentSchema=z.object({
 type:z.enum(Object.keys(GARMENT_TYPES)),
 name:z.string().min(1).max(60),
 color:z.string().min(1).max(20),
 color2:z.string().min(1).max(20),
 pattern:z.enum(PATTERNS),
 material:z.enum(Object.keys(MATERIALS)),
 fit:z.enum(FITS),
 length:z.enum(LENGTHS),
 sleeves:z.enum(SLEEVES),
 stains:z.boolean(),
 holes:z.boolean(),
}).strict();
export const IdentifySchema=z.object({garments:z.array(ScannedGarmentSchema).max(MAX_SCANNED),notes:z.string().max(400)}).strict();
export const IdentifyResultSchema=z.object({mode:z.enum(['demo','live']),notice:z.string().max(400),garments:z.array(ScannedGarmentSchema).max(MAX_SCANNED)}).strict();

const HEX=/^#[0-9a-f]{6}$/i;
// Models occasionally answer "#FFF" or a colour word; keep only usable hex values.
export function normalizeHex(value,fallback='#808080'){
 const v=String(value||'').trim();
 if(HEX.test(v))return v.toLowerCase();
 const short=/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v);
 return short?`#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase():fallback;
}
