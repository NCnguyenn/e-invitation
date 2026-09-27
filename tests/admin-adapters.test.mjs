import test from 'node:test';
import assert from 'node:assert/strict';
import { bounceTotal, fetchBrevoMetrics } from '../src/features/admin/metrics/brevo.ts';
import { fetchSupabaseMgmtMetrics } from '../src/features/admin/metrics/supabase-mgmt.ts';

async function withFetch(fn, run) { const original=globalThis.fetch; globalThis.fetch=fn; try{return await run();}finally{globalThis.fetch=original;} }
const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});

test('Brevo does not classify SMS credits as email credits', async()=>{
 const rows=await withFetch(async(url)=>response(String(url).includes('/account')?{plan:[{type:'sms',credits:1000}]}:{requests:0,delivered:0,hardBounces:0,softBounces:0}),()=>fetchBrevoMetrics('key-a'));
 const credits=rows.find(x=>x.metric_key==='brevo-credits'); assert.equal(credits.status,'invalid_response');assert.equal(credits.value,null);assert.equal(credits.remaining_value,null);
});
test('Brevo uses one credential scope for successful and failed endpoints',async()=>{
 const rows=await withFetch(async(url)=>String(url).includes('/account')?response({plan:[{type:'free',creditsType:'sendLimit',credits:5}]}):response({},403),()=>fetchBrevoMetrics('key-a'));
 assert.equal(new Set(rows.map(x=>x.scope_id)).size,1);assert.notEqual(rows[0].scope_id,'primary');assert.equal(rows[0].remaining_value,null);
});
test('Brevo rejects nonfinite and negative SMTP counts',async()=>{
 const rows=await withFetch(async(url)=>response(String(url).includes('/account')?{plan:[{type:'free',creditsType:'sendLimit',credits:5}]}:{requests:NaN,delivered:-1,hardBounces:Infinity,softBounces:1}),()=>fetchBrevoMetrics('key-a'));
 for(const row of rows.slice(1)){assert.equal(row.status,'invalid_response');assert.equal(row.value,null);}
});

test('Brevo rejects an overflowing bounce total', () => {
 assert.equal(bounceTotal(Number.MAX_VALUE, Number.MAX_VALUE), null);
});

test('Brevo reporting period ends at the next midnight', async () => {
 const rows = await withFetch(async () => response({ requests: 0, delivered: 0, hardBounces: 0, softBounces: 0 }), () => fetchBrevoMetrics('key-a'));
 const report = rows.find(row => row.metric_key === 'brevo-smtp-requests');
 assert.equal(Date.parse(report.period_end) - Date.parse(report.period_start), 24 * 60 * 60 * 1000);
});
test('Supabase rejects ambiguous usage rows rather than choosing the first',async()=>{
 const rows=await withFetch(async(url)=>response(String(url).includes('/disk/util')?{metrics:{fs_size_bytes:100,fs_used_bytes:10,fs_avail_bytes:90}}:{result:[{total_auth_requests:1},{total_auth_requests:2}]}),()=>fetchSupabaseMgmtMetrics('token','ref'));
 for(const row of rows.filter(x=>x.metric_key.startsWith('supabase-api-'))){assert.equal(row.status,'invalid_response');assert.equal(row.value,null);}
});
test('explicit empty credentials never fall back to environment',async()=>{
 const old=process.env.BREVO_API_KEY;process.env.BREVO_API_KEY='ambient';try{const rows=await fetchBrevoMetrics('');assert.ok(rows.every(x=>x.status==='not_connected'));}finally{if(old===undefined)delete process.env.BREVO_API_KEY;else process.env.BREVO_API_KEY=old;}
});
