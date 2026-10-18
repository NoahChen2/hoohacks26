// What a photo scan reports for each garment it can see. Shared by the server
// (structured output from the vision model) and the browser (validation).
import {z} from 'zod';
import {GARMENT_TYPES,PATTERNS,MATERIALS} from '../garments.js';
import {SKIN_TONES,HAIR_STYLES,HAIR_COLORS} from '../character/appearance.js';

export const FITS=['fitted','regular','relaxed','oversized'];
export const LENGTHS=['cropped','short','regular','long'];
export const SLEEVES=['none','short','three-quarter','long'];
export const MAX_SCANNED=6;
// The wearer's body, when a person is wearing the clothes: enough to pick a
// ready-to-wear starting point that src/scan/bodyEstimate.js turns into
// measurements for the 3D body, plus the closest skin tone and hair options.
export const FRAMES=['female','neutral','male'];
export const BUILDS=['slim','average','athletic','muscular','curvy','plus'];
export const SIZES=['XS','S','M','L','XL','2XL','3XL','4XL','5XL','6XL'];
export const HEIGHT_RANGE=[140,205];

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
export const BodyEstimateSchema=z.object({
 visible:z.boolean(),
 frame:z.enum(FRAMES),
 build:z.enum(BUILDS),
 size:z.enum(SIZES),
 height:z.number(),
 skin:z.enum(SKIN_TONES.map(t=>t.id)),
 hair:z.enum(HAIR_STYLES.map(h=>h.id)),
 hairColor:z.enum(HAIR_COLORS.map(c=>c.id)),
}).strict();
// A usable estimate, as the browser receives and stores it.
export const WearerSchema=BodyEstimateSchema.omit({visible:true}).extend({height:z.number().min(HEIGHT_RANGE[0]).max(HEIGHT_RANGE[1])});
export const IdentifySchema=z.object({garments:z.array(ScannedGarmentSchema).max(MAX_SCANNED),body:BodyEstimateSchema,notes:z.string().max(400)}).strict();
// `body` is null when nobody is wearing the clothes (flat lays, hangers) or the
// scan ran on the device.
export const IdentifyResultSchema=z.object({mode:z.enum(['demo','live']),notice:z.string().max(400),garments:z.array(ScannedGarmentSchema).max(MAX_SCANNED),body:WearerSchema.nullable().optional()}).strict();

const HEX=/^#[0-9a-f]{6}$/i;
// Models occasionally answer "#FFF" or a colour word; keep only usable hex values.
export function normalizeHex(value,fallback='#808080'){
 const v=String(value||'').trim();
 if(HEX.test(v))return v.toLowerCase();
 const short=/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v);
 return short?`#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase():fallback;
}
