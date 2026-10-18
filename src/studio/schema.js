import {z} from 'zod';
export const MAX_UPLOAD_BYTES=5*1024*1024;
export const IMAGE_TYPES=['image/jpeg','image/png','image/webp'];
export const CONDITIONS=['Good condition','Minor wear','Stained','Small holes or tears','Heavily worn'];
export const MATERIALS=['Unknown','Cotton','Denim','Linen','Wool','Silk','Polyester','Knit / blend','Other'];
const text=z.string().min(1).max(1200);
const list=z.array(text).min(1).max(15);
export const ProjectSchema=z.object({
 title:z.string().min(1).max(120),description:text,difficulty:z.enum(['Beginner','Intermediate','Advanced']),estimatedTime:z.string().min(1).max(100),tools:list,materials:list,aestheticTags:z.array(z.string().min(1).max(60)).min(1).max(8),instructions:z.array(text).min(3).max(12),safetyNotes:list,
}).strict();
export const AnalysisSchema=z.object({garmentType:text,visibleColors:z.array(text).max(12),estimatedFabric:text,fabricConfidence:z.enum(['Low','Medium','Unknown']),visibleCondition:text,warnings:list,projects:z.array(ProjectSchema).length(3)}).strict();
export const ResultSchema=z.object({mode:z.enum(['demo','live']),notice:text,analysis:AnalysisSchema}).strict();
export function validateUpload(file){
 if(!file)return 'Choose a garment photo first.';
 if(!IMAGE_TYPES.includes(file.type))return 'Choose a JPEG, PNG, or WebP image.';
 if(file.size===0)return 'This image is empty. Choose another photo.';
 if(file.size>MAX_UPLOAD_BYTES)return 'Your image must be 5 MB or smaller.';
 return '';
}
