import {z} from 'zod';
import {MAX_SCANNED} from '../scan/schema.js';
export const MAX_UPLOAD_BYTES=5*1024*1024;
export const IMAGE_TYPES=['image/jpeg','image/png','image/webp'];
export const CONDITIONS=['Good condition','Minor wear','Stained','Small holes or tears','Heavily worn'];
export const MATERIALS=['Unknown','Cotton','Denim','Linen','Wool','Silk','Polyester','Knit / blend','Other'];
const text=z.string().min(1).max(1200);
const list=z.array(text).min(1).max(15);
// Ideas cover the whole outfit a photo scan found: at least one per piece,
// never fewer than three.
export const MIN_IDEAS=3,MAX_IDEAS=MAX_SCANNED;
export const ideaCount=pieces=>Math.min(MAX_IDEAS,Math.max(MIN_IDEAS,pieces));
const piece=z.number().int().min(0).max(MAX_SCANNED-1);
// `piece`: index of the scanned piece the idea remakes (optional for projects saved before outfits).
export const ProjectSchema=z.object({
 piece:piece.optional(),
 title:z.string().min(1).max(120),description:text,difficulty:z.enum(['Beginner','Intermediate','Advanced']),estimatedTime:z.string().min(1).max(100),tools:list,materials:list,aestheticTags:z.array(z.string().min(1).max(60)).min(1).max(8),instructions:z.array(text).min(3).max(12),safetyNotes:list,
}).strict();
const IdeaSchema=ProjectSchema.extend({piece});
export const AnalysisSchema=z.object({garmentType:text,visibleColors:z.array(text).max(12),estimatedFabric:text,fabricConfidence:z.enum(['Low','Medium','Unknown']),visibleCondition:text,warnings:list,projects:z.array(IdeaSchema).min(MIN_IDEAS).max(MAX_IDEAS)}).strict();
export const ResultSchema=z.object({mode:z.enum(['demo','live']),notice:text,analysis:AnalysisSchema}).strict();
export function validateUpload(file){
 if(!file)return 'Choose a garment photo first.';
 if(!IMAGE_TYPES.includes(file.type))return 'Choose a JPEG, PNG, or WebP image.';
 if(file.size===0)return 'This image is empty. Choose another photo.';
 if(file.size>MAX_UPLOAD_BYTES)return 'Your image must be 5 MB or smaller.';
 return '';
}
