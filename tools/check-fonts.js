const fs=require('fs');
const strip=s=>s.replace(/\/\*[\s\S]*?\*\//g,'');

// parse file into rules, accounting for @media
function parse(css){
  css=strip(css);
  const out=[]; // {sel, decls, bp}
  function walk(text,bp){
    const re=/([^{}]+)\{([^{}]*)\}/g; let m;
    while((m=re.exec(text))){
      const sel=m[1].trim();
      if(sel.startsWith('@')) continue;
      out.push({sel, body:m[2], bp});
    }
  }
  // extract media blocks with brace balancing
  const spans=[]; const mre=/@media([^{]+)\{/g; let m;
  while((m=mre.exec(css))){
    let d=1,i=mre.lastIndex;
    while(i<css.length&&d>0){ if(css[i]==='{')d++; else if(css[i]==='}')d--; i++; }
    spans.push({cond:m[1],from:m.index,bodyFrom:mre.lastIndex,to:i}); mre.lastIndex=i;
  }
  let rest='',cur=0;
  spans.forEach(s=>{rest+=css.slice(cur,s.from);cur=s.to;});
  rest+=css.slice(cur);
  walk(rest,'base');
  spans.forEach(s=>{
    const body=css.slice(s.bodyFrom,s.to-1);
    const bp=/min-width\s*:\s*901/.test(s.cond)?'D':(/max-width\s*:\s*900/.test(s.cond)?'M':null);
    if(bp) walk(body,bp);
  });
  return out;
}

function vars(rules){
  const v={base:{},M:{},D:{}};
  rules.forEach(r=>{ if(!/(^|,)\s*:root\s*$/.test(r.sel))return;
    const re=/(--[\w-]+)\s*:\s*([^;]+);/g; let m;
    while((m=re.exec(r.body))) v[r.bp==='base'?'base':r.bp][m[1]]=m[2].trim(); });
  return v;
}
function resolve(val,v,bp,depth){
  depth=depth||0; if(depth>8) return val;
  return val.replace(/var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)/g,(_,n)=>{
    const x=(bp==='M'? (v.M[n]!==undefined?v.M[n]:v.base[n]) : (v.D[n]!==undefined?v.D[n]:v.base[n]));
    return x===undefined?'?':resolve(x,v,bp,depth+1);
  }).trim();
}
// property value for selector: last declaration, base then breakpoint
function prop(rules,v,selRe,name,bp){
  let val=null;
  ['base',bp].forEach(b=>{
    rules.filter(r=>r.bp===b && r.sel.split(',').some(s=>selRe.test(s.trim()))).forEach(r=>{
      const re=new RegExp('(?:^|;)\\s*'+name+'\\s*:\\s*([^;]+)','g'); let m;
      while((m=re.exec(r.body))) val=m[1].trim();
    });
  });
  return val===null?null:resolve(val,v,bp);
}

/* Typography cross-check: sdm.css + tokens.css vs production styles.css.
   Run:  node check-fonts.js   (from Design system folder) */
/* Path to site markup — pass as argument: the design-system repo no longer
   sits next to the site, and a hardcoded '../ui2026' would mean the package
   only works on one machine. This is a migration cross-check "DS ↔ site",
   a separate job, not a gate: it will shrink and die when the site moves.

   Run:  node check-fonts.js <path to styles.css> */
const path=require('path');
/* Script lives in tools/, tokens in the brand folder: build path from repo
   root, not from script location. */
const here=path.resolve(__dirname,'..','brands','sdm');
const sitePath=process.argv[2];
if(!sitePath){
  console.error('need path to site styles.css:\n  node tools/check-fonts.js ../sdm/ui2026/app/styles.css');
  process.exit(2);
}
if(!fs.existsSync(sitePath)){
  console.error('file not found: '+sitePath);
  process.exit(2);
}
const site=parse(fs.readFileSync(sitePath,'utf8'));
const ds=parse(fs.readFileSync(path.join(here,'tokens.css'),'utf8')+'\n'+
               fs.readFileSync(path.join(here,'sdm.css'),'utf8'));
const vSite=vars(site), vDs=vars(ds);

const targets=[
  ['.hero h1','^\\.hero h1$'],
  ['.hero-lead','^\\.hero-lead'],
  ['.btn','^\\.btn$'],
  ['.btn-lg','^\\.btn-lg$'],
  ['.badge','^\\.badge$'],
  ['.check','^\\.check$'],
  ['.step h3','^\\.step h3$'],
  ['.step p','^\\.step p$'],
  ['.step-badge','^\\.step-badge$'],
  ['.icon-tile.num','^\\.icon-tile\\.num$'],
  ['.product h3','^\\.product h3$'],
  ['.price-name','^\\.price-name$'],
  ['.price-amount','^\\.price-amount$'],
  ['.price-card h4','^\\.price-card h4$'],
  ['.service h3','^\\.service h3$'],
  ['.service p','^\\.service p$'],
  ['.news h3','^\\.news h3$'],
  ['.feature h3','^\\.feature h3$'],
  ['.perk h3','^\\.perk h3$'],
  ['.perk p','^\\.perk p$'],
  ['.cta-band h3','^\\.cta-band h3$'],
  ['.cta-band p','^\\.cta-band p$'],
  ['.docs-acc__title','^\\.docs-acc__title$'],
  ['.docs-acc__line','^\\.docs-acc__line$'],
  ['.toggle','^\\.toggle$'],
  ['.section-head h2','^\\.section-head h2$'],
];
const props=['font-size','font-weight','line-height'];

/* Intentional mismatches — not bugs, but DS decisions.
   Key: 'breakpoint|selector|property'. */
const ALLOW = {
  'D|.feature h3|font-size':
    'code has 15px in @media (min-width:901) and (max-height:900) — height condition, not desktop',
  'D|.feature h3|line-height': 'same height condition',
  'M|.feature h3|font-size':
    'in styles.css:4080 .features block is hidden on mobile, no mobile value; use Figma 16/600',
  'M|.feature h3|line-height': 'see above'
};
let bad=0;
console.log('mismatch | selector | property | DS → code');
targets.forEach(([name,re])=>{
  const R=new RegExp(re);
  ['M','D'].forEach(bp=>{
    props.forEach(p=>{
      const a=prop(ds,vDs,R,p,bp), b=prop(site,vSite,R,p,bp);
      if(a===null||b===null) return;
      const norm=x=>String(x).replace(/\s+/g,'').toLowerCase();
      if(norm(a)===norm(b)) return;
      const key=bp+'|'+name+'|'+p;
      if(ALLOW[key]){ console.log('  (ok) '+key+' — '+ALLOW[key]); return; }
      bad++; console.log(bp+' | '+name+' | '+p+' | '+a+' → '+b);
    });
  });
});
console.log('\ntotal mismatches: '+bad);
