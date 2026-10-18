import {defineConfig,loadEnv} from 'vite';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createAnalyzeHandler} from './server/analyze.js';
import {createIdentifyHandler} from './server/identify.js';

// Version for cached body meshes: a hash of every file that shapes them, so the
// browser cache is invalidated whenever body-building code changes.
const characterDir=resolve('src/character').replaceAll('\\','/');
function bodyMeshVersion(){
 const plugin={name:'body-mesh-version',resolveId:id=>id==='virtual:body-mesh-version'?'\0body-mesh-version':null,load(id){
  if(id!=='\0body-mesh-version')return null;
  const hash=createHash('sha1');
  for(const file of readdirSync(characterDir).filter(name=>/\.(js|ts)$/.test(name)).sort()){const path=join(characterDir,file);this.addWatchFile(path);hash.update(file).update(readFileSync(path));}
  return `export default ${JSON.stringify(hash.digest('hex').slice(0,12))};`;
 },handleHotUpdate({file,server}){
  if(!file.startsWith(characterDir))return;
  const module=server.moduleGraph.getModuleById('\0body-mesh-version');
  if(module)server.moduleGraph.invalidateModule(module);
 }};
 return plugin;
}

export default defineConfig(({mode})=>{
 const env={...loadEnv(mode,process.cwd(),''),...process.env};
 const mount=server=>{const handler=createAnalyzeHandler({env}),identify=createIdentifyHandler({env});server.middlewares.use((req,res,next)=>{const path=req.url?.split('?')[0];if(path==='/api/analyze')return handler(req,res);if(path==='/api/identify')return identify(req,res);next();});};
 return {plugins:[bodyMeshVersion(),{name:'rethread-analysis-api',configureServer:mount,configurePreviewServer:mount}]};
});
