import { Miniflare } from 'miniflare';
import { readFileSync,readdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
const modules=['index.js',...readdirSync('dist/server',{recursive:true}).filter(name=>name!=='index.js'&&/\.(m?js)$/.test(name))].map(name=>({type:'ESModule',path:'dist/server/'+name}));
const worker=new Miniflare({modules,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{AUTH_PEPPER:randomBytes(32).toString('hex')}});
try{
 const db=await worker.getD1Database('DB');for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())for(const sql of readFileSync('drizzle/'+name,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
 const origin='https://minehost.test',password=randomBytes(24).toString('hex');const post=(path,data,headers={})=>worker.dispatchFetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
 const response=await post('/api/enroll',{username:'catalog_test',password,register:true});assert.equal(response.status,200);const phone=await response.json();const login=await post('/api/auth/login',{username:'catalog_test',password});const cookie=login.headers.get('set-cookie').split(';')[0];
 await post('/api/device',{snapshot:{phase:'stopped',console:'',software:{software:'fabric',version:'26.1.2'},managementVersion:4}},{Authorization:'Bearer '+phone.deviceToken});
 const endpoint='/api/catalog?server='+phone.serverId+'&type=mods&source=modrinth';const search=await worker.dispatchFetch(origin+endpoint+'&q=fabric%20api',{headers:{Cookie:cookie}});assert.equal(search.status,200,await search.clone().text());assert.ok((await search.json()).items.some(item=>item.id==='P7dR8mSH'));
 const plan=await post(endpoint,{id:'P7dR8mSH'},{Cookie:cookie});assert.equal(plan.status,200,await plan.clone().text());const result=await plan.json();assert.equal(result.gameVersion,'26.1.2');assert.ok(result.files.length>0);assert.match(result.files[0].url,/^https:\/\/cdn\.modrinth\.com\//);assert.ok(result.files[0].hash.length>=40);
 const unavailable=await worker.dispatchFetch(origin+endpoint.replace('source=modrinth','source=curseforge')+'&q=test',{headers:{Cookie:cookie}});assert.equal(unavailable.status,400);assert.match((await unavailable.json()).error,/API-Zugang/);
 console.log('PASS: live Modrinth search and compatible download plan, official CDN hashes, CurseForge missing-access handling');
}finally{await worker.dispose();}
