// Isolated fixture importing the production shell; no production auth bypass.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE || 'C:/Users/CHI NGUYEN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const fixture = 'test-results/admin-resources-fixture';
await mkdir(`${fixture}/app`, { recursive: true });
const now = Date.now();
const metric = { provider: 'brevo', scope_type: 'account', scope_id: 'test-account', metric_key: 'brevo-credits', display_name: 'Brevo Email Credits', environment: 'production', value: 0, unit: 'credit', limit_value: null, remaining_value: null, period_start: null, period_end: null, period_timezone: null, provider_updated_at: null, fetched_at: new Date(now).toISOString(), source_kind: 'api', source_url: null, endpoint: '/account', field_path: 'plan.credits', status: 'fresh', last_attempt_at: new Date(now).toISOString(), error_code: null, mapping_version: '2.0', source_checked_at: '2026-09-27' };
const snapshots = [metric, { ...metric, metric_key: 'brevo-requests', display_name: 'Brevo Requests', value: null, status: 'invalid_response' }, { ...metric, provider: 'supabase', scope_type: 'project', metric_key: 'supabase-disk-fs-used', display_name: 'Filesystem', value: 120, limit_value: 100, unit: 'byte' }, { ...metric, provider: 'supabase', metric_key: 'stale-quota', display_name: 'Stale quota', value: 90, limit_value: 100, status: 'stale' }];
const internal = { status: 'ok', totalHosts: 0, totalEvents: 0, totalInvitations: 0, rsvpBreakdown: { accepted: 0, declined: 0, pending: 0, responded: 0, total: 0 }, dailyEmailBudget: { budgetDate: new Date(now).toISOString().slice(0,10), cap: 300, reservedAttempts: 0, acceptedAttempts: 0, rejectedAttempts: 0, unknownAttempts: 0 } };
const result = { snapshots, internalMetrics: internal, lastSyncedAt: metric.fetched_at, syncBlockedReason: null };
await Promise.all([
  writeFile(`${fixture}/package.json`, JSON.stringify({ name: 'admin-resources-fixture', private: true, type: 'module' })),
  writeFile(`${fixture}/tsconfig.json`, JSON.stringify({ extends: '../../tsconfig.json', compilerOptions: { paths: { '@/*': ['../../src/*'] } }, include: ['app/**/*.tsx', '.next/types/**/*.ts'], exclude: ['node_modules'] })),
  writeFile(`${fixture}/app/layout.tsx`, `export default function Layout({children}: {children: React.ReactNode}) { return <html lang="vi"><body style={{margin:0}}>{children}</body></html>; }`),
  writeFile(`${fixture}/app/page.tsx`, `import { AdminShell } from '@/features/admin/components/AdminShell'; export default function Page() { return <AdminShell developerEmail="admin@example.com" initialSnapshots={${JSON.stringify(snapshots)}} initialInternalMetrics={${JSON.stringify(internal)}} initialSyncedAt=${JSON.stringify(metric.fetched_at)} initialHosts={[]} initialEvents={[]} availableTemplates={[]} initialAttempts={[]} initialJobs={[]} />; }`),
]);
const probe = createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; await new Promise(r => probe.close(r));
let log = ''; const server = spawn(process.execPath, ['-e', `const http=require('node:http');const app=require('next')({dev:true,dir:${JSON.stringify(fixture)}});const handle=app.getRequestHandler();app.prepare().then(()=>http.createServer((req,res)=>handle(req,res)).listen(${port},()=>console.log('FIXTURE_READY')));`], { windowsHide: true, stdio: ['ignore','pipe','pipe'] });
server.stdout.on('data', d => { log += d; }); server.stderr.on('data', d => { log += d; });
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); const errors=[]; page.on('pageerror', e=>errors.push(e.message));
let requests=0, mode='normal';
await page.route('**/api/admin/metrics*', async route => { requests++; if(mode==='timeout') return; await route.fulfill(mode==='error' ? {status:500,json:{message:'Test sync failed'}} : {json:result}); });
async function advance(ms) { await page.clock.fastForward(ms); await page.waitForTimeout(100); }
try {
 for(let i=0;i<120&&!log.includes('FIXTURE_READY');i++) { if(server.exitCode!==null) throw Error(log); await new Promise(r=>setTimeout(r,250)); }
 assert.ok(log.includes('FIXTURE_READY'),log);
 await page.goto(`http://localhost:${port}`); await page.getByRole('heading',{name:'Tổng quan hệ thống'}).waitFor();
 const brevoOverview=page.locator('article').filter({hasText:'Số đo email từ API tài khoản'});
 assert.match(await brevoOverview.innerText(), /1\/2/,'Partial provider must disclose denominator');
 await page.getByRole('button',{name:'Tài nguyên',exact:true}).click();
 await page.getByText('Supabase uncached egress',{exact:true}).waitFor({timeout:5000}); await page.getByText('Supabase cached egress',{exact:true}).waitFor();
 const credit=page.locator('article').filter({has:page.getByRole('heading',{name:'Brevo Email Credits',exact:true})});
 assert.match(await credit.innerText(), /0/); assert.match(await credit.innerText(), /Còn lại:.*Chưa/);
 assert.equal(await page.locator('article').filter({has:page.getByRole('heading',{name:'Stale quota',exact:true})}).getByLabel(/Mức dùng/).count(),0);
 assert.match(await page.locator('article').filter({has:page.getByRole('heading',{name:'Filesystem',exact:true})}).innerText(),/120\.0%/);
 for(const width of [1440,360]) { await page.setViewportSize({width,height:1000}); assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}`); await page.screenshot({path:`test-results/admin-resources-${width}.png`,fullPage:true}); }
 await page.clock.install({time:now});
 await page.getByRole('button',{name:'Làm mới số đo',exact:true}).click(); await page.waitForTimeout(200); assert.equal(requests,1,'manual refresh performs one request');
 await page.getByRole('button',{name:'Tổng quan',exact:true}).click(); await advance(301000);
 assert.match(await brevoOverview.innerText(),/0\/2/,'overview expires without fetching'); assert.equal(requests,1);
 await page.getByRole('button',{name:'Tài nguyên',exact:true}).click();
 mode='error'; await page.getByRole('button',{name:'Làm mới số đo',exact:true}).click(); await page.getByText('Test sync failed',{exact:true}).waitFor(); assert.match(await credit.innerText(),/Số đo đã cũ/);
 await page.getByRole('button',{name:'Tổng quan',exact:true}).click(); assert.match(await page.locator('article').filter({hasText:'Khách hàng (Host)'}).innerText(),/—/);
 await page.getByRole('button',{name:'Tài nguyên',exact:true}).click(); mode='normal';
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));}); const before=requests; await advance(301000); assert.equal(requests,before,'hidden pauses network');
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));}); await page.waitForTimeout(200); assert.equal(requests,before+1,'resume refreshes overdue exactly once');
 await advance(1000); assert.equal(requests,before+1);
 mode='timeout'; await advance(60000); await page.getByRole('button',{name:'Làm mới số đo',exact:true}).click(); await advance(31000); await page.getByText('Đồng bộ quá thời gian chờ.',{exact:true}).waitFor(); assert.match(await page.getByText('Đồng bộ quá thời gian chờ.',{exact:true}).innerText(),/quá thời gian/);
 assert.deepEqual(errors,[]); console.log('PASS resources: missing/zero, references, honest percentages, partial/TTL summary, single manual fetch, failure retained stale, hidden/resume, timeout, mobile/desktop');
} finally { await browser.close(); server.kill(); }
