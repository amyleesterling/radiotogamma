import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html = fs.readFileSync(new URL('../gamma.html', import.meta.url), 'utf8');
const physics = fs.readFileSync(new URL('../ship/physics.js', import.meta.url), 'utf8');
const P = await import('data:text/javascript;base64,' + Buffer.from(physics).toString('base64'));
class Element {
  constructor() { this.handlers = {}; this.attrs = {}; this.style = {}; this.children = []; this.dataset = {}; this.classList = {add(){},remove(){}}; }
  addEventListener(k, fn) { this.handlers[k] = fn; }
  setAttribute(k, v) { this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k] ?? null; }
  appendChild(c) { this.children.push(c); }
  querySelector() { return this.thumb ??= new Element(); }
  querySelectorAll() { return this.children; }
  getBoundingClientRect() { return {top:26,height:400}; }
  setPointerCapture() {}
  contains() { return false; }
}
const els = new Map();
const document = {getElementById(id){ if (!els.has(id)) els.set(id,new Element()); return els.get(id); }, createElement(){return new Element();}};
const ctx = vm.createContext({P, document, Math, console});
const start = html.indexOf('const EUX');
const end = html.indexOf('function makeBatch');
vm.runInContext(html.slice(start,end),ctx);
const run = s => vm.runInContext(s,ctx);
const lift = document.getElementById('lift');
function key(key,shiftKey=false) {lift.handlers.keydown({key,shiftKey,preventDefault(){}});}
key('Home'); assert.equal(run('truth'),1e5);
key('End'); assert.equal(run('truth'),1e16);
assert.equal(lift.attrs['aria-valuetext'].split(',')[0],'10.0 PeV');
for (const attr of ['min','max']) {
  const value = +html.match(new RegExp('aria-value'+attr+'="([^"]+)"'))[1];
  key(attr === 'min' ? 'Home' : 'End');
  assert.equal(+lift.attrs['aria-valuenow'],value);
}
key('Home');key('ArrowUp'); assert.ok(Math.abs(run('P.log10(truth)')-5.1)<1e-10);
key('ArrowRight',true);key('PageUp');key('PageDown');key('ArrowLeft',true);key('ArrowDown');assert.ok(Math.abs(run('truth')-1e5)<1e-8);
for (const pointerType of ['mouse','touch']) {
 lift.handlers.pointerdown({clientY:426,pointerId:1,pointerType,preventDefault(){}}); assert.equal(run('truth'),1e5);
 lift.handlers.pointermove({clientY:26,pointerType}); assert.equal(run('truth'),1e16);
 lift.handlers.pointerup(); lift.handlers.pointercancel();
 lift.handlers.pointermove({clientY:426}); assert.equal(run('truth'),1e16);
}
for (const e of [2.5e15,3.7e15]) {
 run(`setTruth(${e})`);assert.equal(document.getElementById('lmE').textContent, e===2.5e15?'2.50 PeV':'3.70 PeV');
 assert.ok(Math.abs(+lift.attrs['aria-valuenow']-Math.log10(P.freqOfEV(e)))<0.00051);
 assert.ok(document.getElementById('rL').innerHTML.includes('-22'));
 assert.equal(document.getElementById('chips').children.filter(c=>c.attrs['aria-pressed']==='true').length,1);
}
const wheelStart = html.indexOf("document.getElementById('vpClimb').addEventListener('wheel'");
vm.runInContext(html.slice(wheelStart,html.indexOf('/* ---- break it:',wheelStart)),ctx);
const wheel = document.getElementById('vpClimb').handlers.wheel;
for(const deltaMode of [0,1,2]) {key('Home');let prevented=false;wheel({deltaY:1,deltaMode,preventDefault(){prevented=true;}});assert.ok(prevented);assert.ok(run('truth')>1e5);}
key('End');let prevented=false;wheel({deltaY:100,deltaMode:0,preventDefault(){prevented=true;}});assert.equal(prevented,false);
key('Home');wheel({deltaY:-100,deltaMode:0,preventDefault(){prevented=true;}});assert.equal(prevented,false);
// Exercise the actual viewport drag callback without requiring WebGL.
vm.runInContext('const climb = {camZ:10.5,hits:[]}; const liftTarget = lift;',ctx);
const pointerStart = html.indexOf('  pointer(ev, vp) {');
const pointerEnd = html.indexOf('\n});',pointerStart);
vm.runInContext('const controller = ({'+html.slice(pointerStart,pointerEnd)+'});',ctx);
run("setTruth(3.7e15); controller.pointer({type:'pointerdown',target:{},clientY:100,pointerId:2},{el:document.getElementById('vpClimb')})");
run("controller.pointer({type:'pointermove',target:{},clientY:200},{el:document.getElementById('vpClimb'),camera:{fov:40},size:{h:500}})");assert.ok(run('truth')>3.7e15);
run("controller.pointer({type:'pointercancel',target:{}},{el:document.getElementById('vpClimb')})");assert.equal(run('climb.drag'),null);
assert.match(html,/const lit = X\(RECORD\), rec = lit/);
console.log('PASS: keyboard, endpoint ARIA, mouse/touch lift handlers, cancellation, landmarks/readouts, wheel modes/boundary release, viewport drag, measured boundary.');
// A tap selects the actual hit landmark; cancellation must never select a hit.
run("controller.pointer({type:'pointerdown',target:{},clientY:100,pointerId:3},{el:document.getElementById('vpClimb')})");
run("controller.pointer({type:'pointerup',target:{}},{el:document.getElementById('vpClimb'),ray:{intersectObjects:()=>[{object:{userData:{l:LM[LM.length-1]}}}]}})");assert.equal(run('truth'),3.7e15);
const verdictStart=html.indexOf('function verdict(e)');
const verdictEnd=html.indexOf('\nfunction ',verdictStart+1);
vm.runInContext(html.slice(verdictStart,verdictEnd),ctx);
run('verdict(3.7e15)');assert.equal(document.getElementById('vState').textContent,'The CMB itself can stop it');
run('verdict(3.71e15)');assert.match(document.getElementById('vText').textContent,/extrapolating/);
assert.ok(Math.abs(Math.log2(3.7e15/1e5)-35.1068)<0.001);
assert.ok(Math.abs(Math.log10(1.220890e28/3.7e15)-12.5185)<0.001);
assert.ok(Math.abs(3.7e15*P.EV-5.928e-4)<1e-7);
console.log('PASS: rung tap, 3.7 PeV verdict transition, octave/Planck gap/joule calculations.');
