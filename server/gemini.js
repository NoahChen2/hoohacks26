// One structured-output request to Google Gemini with a photo, shared by the
// photo scan (identify.js) and the garment analysis (analyze.js).
import {StudioError} from './errors.js';

const GEMINI_API='https://generativelanguage.googleapis.com/v1beta/models';
// All on the Gemini API free tier, each with its own quota: when one is rate
// limited (429) or unavailable to the key (404), the request retries on the next.
// (Gemini 2.5 models are closed to new API keys.)
export const GEMINI_DEFAULT_MODELS=['gemini-3.8-flash','gemini-3.5-flash-lite','gemini-flash-latest'];
// These tasks need little reasoning: keep thinking low for speed and free quota.
export function geminiThinking(model){
 if(/^gemini-2\.5-flash/.test(model))return {thinkingBudget:0};
 if(/^gemini-3[\d.]*-flash-lite/.test(model))return {thinkingLevel:'minimal'};
 if(/^gemini-3/.test(model))return {thinkingLevel:'low'};
 return null;
}
export function geminiModels(env){
 return [...new Set([env.GEMINI_MODEL?.trim(),...GEMINI_DEFAULT_MODELS].filter(Boolean))];
}

/**
 * Ask Gemini about a photo and return its parsed JSON answer. `task` words the
 * errors: { verb: 'scan this photo', noun: 'scan' }.
 */
export async function askGemini({instructions,prompt,imageDataUrl,schema,maxOutputTokens=4096,timeout=45000,task},{env=process.env,fetchImpl=globalThis.fetch}={}){
 const [,mime,data]=/^data:([^;]+);base64,(.+)$/.exec(imageDataUrl);
 let lastStatus=0;
 const request=async(model,thinking)=>{
  const body={
   systemInstruction:{parts:[{text:instructions}]},
   contents:[{role:'user',parts:[{text:prompt},{inline_data:{mime_type:mime,data}}]}],
   generationConfig:{responseMimeType:'application/json',responseSchema:schema,temperature:0.2,maxOutputTokens,...(thinking&&{thinkingConfig:thinking})},
  };
  try{
   const response=await fetchImpl(`${GEMINI_API}/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY.trim()},body:JSON.stringify(body),signal:globalThis.AbortSignal.timeout(timeout)});
   return {response,payload:await response.json().catch(()=>null)};
  }catch(error){
   throw new StudioError(error.name==='TimeoutError'?`Gemini took too long to ${task.verb}. Please retry.`:'Gemini could not be reached. Check the server’s internet connection.',504);
  }
 };
 for(const model of geminiModels(env)){
  const thinking=geminiThinking(model);
  let {response,payload}=await request(model,thinking);
  // A model that rejects the thinking setting is retried without one.
  if(thinking&&response.status===400&&/thinking/i.test(payload?.error?.message||''))({response,payload}=await request(model,null));
  if(!response.ok){
   lastStatus=response.status;
   // Rate limited or model unavailable on this key: try the next free model.
   if(response.status===429||response.status===404||response.status===503)continue;
   const reason=payload?.error?.details?.find?.(d=>d.reason)?.reason||payload?.error?.status||'';
   if(/API_KEY|PERMISSION_DENIED|UNAUTHENTICATED/.test(reason)||response.status===401||response.status===403)throw new StudioError('Gemini rejected the server’s API key. Check GEMINI_API_KEY.',502);
   throw new StudioError(`Gemini could not ${task.verb}. Please retry.`,502);
  }
  if(payload?.promptFeedback?.blockReason)throw new StudioError(`Gemini declined to ${task.verb}. Try a different photo of the garment.`,422);
  const candidate=payload?.candidates?.[0];
  const raw=candidate?.content?.parts?.map(p=>p.text||'').join('')||'';
  try{return JSON.parse(raw);}catch{throw new StudioError(candidate?.finishReason&&candidate.finishReason!=='STOP'?`Gemini stopped before finishing the ${task.noun}. Please retry.`:`Gemini returned an unreadable ${task.noun}. Please retry.`,502);}
 }
 if(lastStatus===429)throw new StudioError('The free Gemini quota is used up for now. Wait a minute and retry.',429);
 throw new StudioError('No Gemini model is available for this API key. Set GEMINI_MODEL to a model your key can use.',503);
}
