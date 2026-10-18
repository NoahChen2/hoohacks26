import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createAnalyzeHandler} from './analyze.js';
import {createIdentifyHandler} from './identify.js';
for(const path of ['.env','.env.local'])try{process.loadEnvFile(path);}catch(error){if(error.code!=='ENOENT')throw error;}
const root=resolve('dist'),handler=createAnalyzeHandler(),identify=createIdentifyHandler();
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/analyze')return handler(req,res);
  if(url.pathname==='/api/identify')return identify(req,res);
  if(url.pathname.startsWith('/api/')){res.writeHead(404);res.end('Not found');return;}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const path=resolve(root,'.'+decodeURIComponent(url.pathname));if(!path.startsWith(root+sep)&&path!==root){res.writeHead(403);res.end();return;}
  let file=path;try{if(!(await stat(file)).isFile())throw Error();}catch{if(extname(url.pathname)){res.writeHead(404);res.end('Not found');return;}file=resolve(root,'index.html');}
  const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
 }catch{res.writeHead(500);res.end('Unable to serve this request.');}
}).listen(Number(process.env.PORT)||3000,()=>console.log('ReThread server ready'));
