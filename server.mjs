import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const allowed=new Set(['index.html','styles.css','app.js','domain.js','nutrition.js','nutrition-ui.js','icon.svg','apple-touch-icon.png','manifest.webmanifest','sw.js']);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{
  try{
    const pathname=new URL(req.url,'http://localhost').pathname;
    const file=pathname==='/'?'index.html':decodeURIComponent(pathname.slice(1));
    if(!allowed.has(file)){res.writeHead(404);return res.end('Not found');}
    const content=await readFile(path.join(root,file));
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(content);
  }catch{res.writeHead(500);res.end('Server error');}
});
server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log(`FORM is listening on port ${server.address().port}`));
