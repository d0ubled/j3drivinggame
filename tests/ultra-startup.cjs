const fs=require('fs'),assert=require('node:assert/strict');
const html=fs.readFileSync('ultra.html','utf8');
const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
const run=new (Object.getPrototypeOf(async function(){}).constructor)('document','location','console','loadGame',source.replace(/await import\([^)]*\)/,'await loadGame()'));
function dom(){const ids=['start','ultra-retry','ultra-error','ultra-error-detail'];const nodes=Object.fromEntries(ids.map(id=>[id,{hidden:true,disabled:false,textContent:''}]));return{nodes,document:{getElementById(id){assert.ok(nodes[id],id);return nodes[id]}}}}
(async()=>{
 const ok=dom();let resolve;const pending=run(ok.document,{reload(){}},{error(){}},()=>new Promise(r=>resolve=r));assert.equal(ok.nodes.start.disabled,true);resolve();await pending;assert.equal(ok.nodes.start.disabled,false);assert.equal(ok.nodes['ultra-error'].hidden,true);
 for(const reason of ['Failed to fetch dynamically imported module','Error creating WebGL context.','Unexpected startup failure']){const d=dom();let retried=false;await run(d.document,{reload(){retried=true}},{error(){}},async()=>{throw Error(reason)});assert.equal(d.nodes['ultra-error'].hidden,false);assert.equal(d.nodes.start.disabled,true);assert.ok(d.nodes['ultra-error-detail'].textContent.includes(reason));d.nodes['ultra-retry'].onclick();assert.equal(retried,true)}
 const game=fs.readFileSync('ultra/game.js','utf8'),renderer=fs.readFileSync('ultra/renderer.js','utf8'),vendor=fs.readFileSync('ultra/vendor/three.module.js','utf8');
 assert.match(game,/from '\.\/renderer\.js\?v=/);assert.match(renderer,/from '\.\/vendor\/three\.module\.js'/);assert.ok(!/from ['"]https?:/.test(renderer));assert.ok(vendor.includes("const REVISION = '170'"));assert.ok(fs.existsSync('ultra/vendor/THREE-LICENSE.txt'));
 console.log('PASS: same-origin Three.js 170 dependency, loading state, successful startup, useful network/WebGL/other errors and retry.');
})().catch(e=>{console.error(e);process.exitCode=1});
