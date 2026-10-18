import {defineConfig,loadEnv} from 'vite';
import {createAnalyzeHandler} from './server/analyze.js';
export default defineConfig(({mode})=>{
 const env={...loadEnv(mode,process.cwd(),''),...process.env};
 const mount=server=>{const handler=createAnalyzeHandler({env});server.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]==='/api/analyze')return handler(req,res);next();});};
 return {plugins:[{name:'rethread-analysis-api',configureServer:mount,configurePreviewServer:mount}]};
});
