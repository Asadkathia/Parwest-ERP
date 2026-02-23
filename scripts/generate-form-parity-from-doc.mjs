import fs from 'fs/promises'
import path from 'path'

const src = await fs.readFile('docs/erp-form-fields-from-screens.md', 'utf8')

const directMap = new Map([
  ['/map', '/dashboard'], ['/user/onlineUsers', '/dashboard/online-users'], ['/guard/create', '/guards/new'], ['/guard/search', '/guards/search'], ['/guard/blackListedGuards', '/guards/blacklist'], ['/guard/softDeletedGuardList', '/guards/inactive'], ['/guard/GuardDeployment', '/guards/deploy'], ['/guard/GuardDeploymentRate', '/guards/deployments-rate'], ['/guard/attendance', '/guards/attendance'], ['/guard/clientAttendance', '/guards/client-attendance'], ['/guard/residences', '/guards/residences'], ['/guard/residences/assign', '/guards/assign-residence'], ['/guard/onjob-trainings', '/guards/trainings'], ['/guard/onjob-trainings-v2', '/guards/trainings'], ['/searchByDataTable', '/guards/export'], ['/guard/mergedOptions', '/guards/prerequisites'],
  ['/client/create', '/clients/new'], ['/client/searchResult', '/clients/search'], ['/client/v2/search', '/clients/search-v2'], ['/client/typeList', '/clients/types-locations'], ['/client/blackListedClients', '/clients/blacklist'], ['/client/exportClientBranches', '/clients/export-branches'], ['/client/invoicePrerequisites', '/clients/invoice-prerequisites'], ['/client/invoicedBillings', '/clients/invoiced-billings'],
])

function norm(s) { return String(s||'').toLowerCase().replace(/\([^)]*\)/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim() }
function setFrom(arr){ const m=new Map(); for(const a of arr){const n=norm(a); if(n&&!m.has(n)) m.set(n,a)} return m }

const blocks = src.split(/^### /m).slice(1).map((b)=>'### '+b)
const entries=[]
for(const b of blocks){
  const title = (b.match(/^###\s+(.+)$/m)||[])[1]||''
  const routeRaw = (b.match(/- Route:\s+`([^`]+)`/)||[])[1]
  if(!routeRaw) continue
  let p=''
  try{ p=new URL(routeRaw).pathname }catch{}

  let fields=[]
  const start = b.indexOf('- Fields observed:')
  if(start!==-1){
    const endCandidates = ['- Primary actions:', '\n### '].map((k)=>b.indexOf(k,start+1)).filter((x)=>x!==-1)
    const end = endCandidates.length ? Math.min(...endCandidates) : b.length
    const chunk = b.slice(start, end)
    const re = /`([^`]+)`/g
    let m
    while((m=re.exec(chunk))!==null){
      const val = m[1].trim()
      if(val && !/^none detected$/i.test(val)) fields.push(val)
    }
  }

  entries.push({title, legacyRoute:p, fields})
}

async function listTsxFiles(dir) {
  const out=[]
  async function walk(d){let ents=[]; try{ents=await fs.readdir(d,{withFileTypes:true})}catch{return}; for(const e of ents){const p=path.join(d,e.name); if(e.isDirectory()) await walk(p); else if(e.isFile() && (p.endsWith('.ts')||p.endsWith('.tsx'))) out.push(p)} }
  await walk(dir); return out
}

function extractLabels(src){
  const vals=[]
  for(const re of [/label\s*:\s*["'`]([^"'`]{1,140})["'`]/g,/placeholder\s*=\s*["'`]([^"'`]{1,140})["'`]/g,/placeholder\s*:\s*["'`]([^"'`]{1,140})["'`]/g,/<label[^>]*>([^<]{1,140})<\/label>/g]){ let m; while((m=re.exec(src))!==null) vals.push(m[1])}
  return vals
}

async function currentFields(route){
  const sc = await fs.readFile('src/lib/parity/screenConfigs.ts','utf8')
  if(route.startsWith('/payroll/operations/')){ const k=route.split('/').pop(); const i=sc.indexOf(`\"${k}\":`); if(i!==-1){const j=sc.indexOf('\n  },\n',i); return setFrom(extractLabels(sc.slice(i,j===-1?undefined:j)))}}
  if(route.startsWith('/inventory/')&&route!=='/inventory'){ const k=route.split('/').pop(); const i=sc.indexOf(`\"${k}\":`); if(i!==-1){const j=sc.indexOf('\n  },\n',i); return setFrom(extractLabels(sc.slice(i,j===-1?undefined:j)))}}
  if(route.startsWith('/reports/')&&route!=='/reports'){ const k=route.split('/').pop(); const i=sc.indexOf(`\"${k}\":`); if(i!==-1){const j=sc.indexOf('\n  },\n',i); return setFrom(extractLabels(sc.slice(i,j===-1?undefined:j)))}}

  const dir=path.join('src','app','(dashboard)',route)
  const files=await listTsxFiles(dir)
  const arr=[]
  for(const f of files){arr.push(...extractLabels(await fs.readFile(f,'utf8')))}
  return setFrom(arr)
}

const rows=[]
for(const e of entries){
  const mapped=directMap.get(e.legacyRoute)||''
  const legacySet=setFrom(e.fields)
  const currentSet = mapped?await currentFields(mapped):new Map()
  let matched=0; const missing=[]
  for(const [k,v] of legacySet){ if(currentSet.has(k)) matched++; else missing.push(v) }
  const score = legacySet.size? Number(((matched/legacySet.size)*100).toFixed(1)):100
  const status = !mapped ? 'MISSING_ROUTE' : legacySet.size===0 ? 'NO_FIELDS' : score>=70?'MATCHED':score>=35?'PARTIAL':'LOW'
  rows.push({title:e.title, legacyRoute:e.legacyRoute, mappedCurrentRoute:mapped, legacyFields:legacySet.size, currentFields:currentSet.size, matchedFields:matched, matchPercent:score, status, missing:missing.slice(0,30)})
}

const csv=['title,legacy_route,mapped_current_route,legacy_fields,current_fields,matched_fields,match_percent,status,missing_sample',...rows.map(r=>[r.title,r.legacyRoute,r.mappedCurrentRoute,r.legacyFields,r.currentFields,r.matchedFields,r.matchPercent,r.status,r.missing.join(' | ')].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','))].join('\n')
await fs.writeFile('docs/legacy-vs-current-form-parity-from-ui-doc.csv',csv)

const mapped = rows.filter(r=>r.mappedCurrentRoute)
const withFields = mapped.filter(r=>r.legacyFields>0)
const avg = withFields.length ? (withFields.reduce((a,b)=>a+b.matchPercent,0)/withFields.length).toFixed(1) : '0.0'
let md='# Form Parity (Using UI Fields Doc vs Current Code)\n\n'
md += `- Legacy form entries parsed: **${rows.length}**\n`
md += `- Entries with mapped current route: **${mapped.length}**\n`
md += `- Entries with legacy fields: **${withFields.length}**\n`
md += `- Average match: **${avg}%**\n\n`
md += '## Entries Not Fully Matched\n'
for(const r of withFields.filter(r=>r.matchPercent<70).sort((a,b)=>a.matchPercent-b.matchPercent)){
  md += `- ${r.title}: ${r.legacyRoute} -> ${r.mappedCurrentRoute} : ${r.matchPercent}% (${r.matchedFields}/${r.legacyFields})\n`
  if(r.missing.length) md += `  missing sample: ${r.missing.slice(0,10).join(', ')}\n`
}
md += '\n## Missing Route Mappings\n'
for(const r of rows.filter(r=>!r.mappedCurrentRoute)) md += `- ${r.title}: ${r.legacyRoute}\n`

await fs.writeFile('docs/legacy-vs-current-form-parity-from-ui-doc.md',md)
console.log({total:rows.length,mapped:mapped.length,withFields:withFields.length,avg})
