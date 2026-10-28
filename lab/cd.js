/* lab/cd.js: bench 02, THE CD. A diffraction grating that happens to hold music.
 *
 * Ported whole from the lab's earlier three.js disc: the surface solves the
 * grating equation per fragment, d (sin i - sin r) = m lambda, with the
 * grating vector radial because the tracks are concentric; the zoom is a
 * real camera dive onto displaced pit geometry; the wave sheet at the bottom
 * of the dive sums nine cylindrical wavelets per pixel and the beams appear
 * where the sum says so. New on the ship: the track pitch d is a control.
 * A CD is 1.6 µm, a DVD 0.74, a Blu-ray 0.32, and the slider runs on to
 * 10 µm so the visitor can watch a coarse grating wash its rainbow out.
 */
import { ship } from '../ship/ship.js';
import { HDRLoader } from '../vendor/three/HDRLoader.js';
import { THREE, P, TAU, DEG, clamp, sm, rgb01, GLSL_WL, octave, dial, chips, readouts, voice, chase, fmtUm } from './bench.js';

export const question = {
  id: 'cd', title: 'Bench 02 · The CD',
  text: 'A CD has no coloured pigment. Where does its rainbow come from?',
  choices: ['Microscopic coloured material', 'Reflection from the room', 'A tiny repeating structure', 'Magic, obviously'], answer: 2,
  reveal: 'A tiny repeating structure. The data track spirals around the disc with a spacing of 1.6 micrometres, a few wavelengths of light, and that regular spacing reflects each wavelength constructively at a slightly different angle. The disc is a diffraction grating that happens to hold music.',
};

const FG = 0.92;                                  // the geometric dive stops here; the rest fades the waves in
function zoomText(f) {
  if (f < 0.01) return 'full disc';
  const fg = Math.min(f, FG), s = Math.pow(10, fg * 5), p = Math.pow(10, Math.floor(Math.log10(s)));
  const v = Math.round(Math.round(s / p * 10) / 10 * p);
  return '×' + v.toLocaleString('en-US') + (f > 0.95 ? ' · the pits, and the light' : f > 0.78 ? ' · the pits' : '');
}

/* ---- shaders --------------------------------------------------------------- */
const VERT = 'varying vec3 vPos;void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const FRAG = `
varying vec3 vPos;
uniform vec3 uLp, uCp; uniform sampler2D uEnv, uLabel;
uniform float uEnvOn, uLabelOn, uPitch, uStripe, uFlat, uD;   // uPitch: pitch in disc units, uD: pitch in nm
uniform mat3 uNorm;
${GLSL_WL}
void main(){
  float r=length(vPos.xy); vec2 rad=vPos.xy/max(r,1e-4);
  vec3 N=gl_FrontFacing?vec3(0.,0.,1.):vec3(0.,0.,-1.);
  vec3 L=normalize(uLp-vPos), V=normalize(uCp-vPos);
  if(!gl_FrontFacing&&uLabelOn>.5){
    vec3 alb=texture2D(uLabel,vPos.xy*.5+.5).rgb; vec3 Hb=normalize(L+V);
    float nl=.35+.65*max(dot(N,L),0.);
    vec3 lc=alb*nl+vec3(.9,.94,1.)*pow(max(dot(N,Hb),0.),30.)*.06;
    vec3 Rb=uNorm*reflect(-V,N);
    vec2 buv=vec2(atan(Rb.z,Rb.x)/6.2831853+.5,acos(clamp(Rb.y,-1.,1.))/3.14159265);
    vec3 eb=texture2D(uEnv,buv).rgb; lc+=uEnvOn*(eb/(1.+eb))*.05;
    gl_FragColor=vec4(pow(max(lc,0.),vec3(.4545)),1.);return;}
  float sinI=dot(L,vec3(rad,0.)), sinR=dot(V,vec3(rad,0.));
  float ang=atan(vPos.y,vPos.x);
  float grain=.9+.1*hash1(floor(ang*700.)+floor(r*40.)*7.);
  float ndl=max(dot(N,L),0.), ndv=max(dot(N,V),0.);
  vec3 col=vec3(.052,.056,.066);
  float lab=smoothstep(.475,.44,r); vec3 lrc=vec3(.13,.135,.15);
  if(uLabelOn>.5&&lab>0.){ float ar=mix(.5,.82,clamp((r-.32)/.155,0.,1.)); vec3 art=texture2D(uLabel,rad*ar*.5+.5).rgb; lrc=mix(lrc,pow(art,vec3(.4545)),.5);}
  col=mix(col,lrc,lab);
  vec3 Hv=normalize(L+V); float ndh=max(dot(N,Hv),0.);
  col+=vec3(.9,.94,1.)*(pow(ndh,220.)*.9+pow(ndh,14.)*.10)*grain*(1.-.5*lab)*(1.-.5*uStripe);
  float fres=.25+.75*pow(1.-ndv,2.);
  vec3 Rw=uNorm*reflect(-V,N);
  vec2 euv=vec2(atan(Rw.z,Rw.x)/6.2831853+.5,acos(clamp(Rw.y,-1.,1.))/3.14159265);
  vec3 env=texture2D(uEnv,euv).rgb;
  col+=uEnvOn*(env/(1.+env))*(.05+.45*fres)*(1.-.55*lab)*(1.-.6*uStripe);
  float s=abs(sinI-sinR);
  for(int m=1;m<=12;m++){                        // every order that lands in the visible band
    float lam=uD*s/float(m);
    if(lam<380.)break;
    float win=smoothstep(380.,425.,lam)*(1.-smoothstep(690.,750.,lam));
    if(win>0.001) col+=wl2rgb(lam)*win*(.85/float(m))*fres*ndl*grain*(1.-lab)*(1.-.75*uStripe);
  }
  float tr=(mix(r,vPos.x,uFlat)-.68)/uPitch;
  float wfr=max(fwidth(tr),1e-3); float lineF=abs(fract(tr+.5)-.5);
  float groove=(1.-smoothstep(.22-wfr,.22+wfr,lineF))*step(.001,uStripe);
  col=mix(col,vec3(.028,.032,.04),groove*uStripe*.85);
  col+=vec3(.30,.34,.42)*(1.-groove)*uStripe*.18*(.4+.6*ndl);
  col*=.55+.45*grain;
  gl_FragColor=vec4(col,1.);}`;
const VERT2 = 'varying vec3 vPos;varying vec3 vNrm;void main(){vPos=position;vNrm=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const FRAG2 = `
varying vec3 vPos; varying vec3 vNrm;
uniform vec3 uLp, uCp; uniform sampler2D uEnv; uniform float uEnvOn, uFade, uD; uniform mat3 uNorm;
${GLSL_WL}
void main(){
  vec3 N=normalize(vNrm); if(!gl_FrontFacing)N=-N;
  vec3 L=normalize(uLp-vPos), V=normalize(uCp-vPos);
  float ndl=max(dot(N,L),0.), ndv=max(dot(N,V),0.);
  vec3 Hv=normalize(L+V); float ndh=max(dot(N,Hv),0.);
  float fres=.25+.75*pow(1.-ndv,2.);
  vec3 col=vec3(.05,.054,.064)+vec3(.07,.075,.09)*ndl;
  col+=vec3(.95,.97,1.)*pow(ndh,110.)*.9;
  vec3 Rw=normalize(uNorm*reflect(-V,N));
  vec2 euv=vec2(atan(Rw.z,Rw.x)/6.2831853+.5,acos(clamp(Rw.y,-1.,1.))/3.14159265);
  vec3 env=texture2D(uEnv,euv).rgb;
  col+=uEnvOn*(env/(1.+env))*(.07+.45*fres);
  float s=abs(dot(L,vec3(1.,0.,0.))-dot(V,vec3(1.,0.,0.)));
  float lam=uD*s; float win=smoothstep(380.,425.,lam)*(1.-smoothstep(690.,750.,lam));
  col+=wl2rgb(lam)*win*.10*fres;
  gl_FragColor=vec4(col,uFade);}`;
/* the wave sheet, in patch micrometres: tracks 1.6 apart in the patch's own
   units; a different real pitch rescales the wavelengths instead (uLam) */
const SVERT = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const SFRAG = `
varying vec2 vUv; uniform float uSinI,uCosI,uT,uFade,uW,uH; uniform vec3 uLam, uLamTrue;
${GLSL_WL}
void main(){
  float x=(vUv.x-.5)*uW, z=vUv.y*uH;
  float edge=smoothstep(0.,.05,vUv.x)*(1.-smoothstep(.95,1.,vUv.x))*(1.-smoothstep(.8,1.,vUv.y));
  float band=1.-smoothstep(2.,3.1,abs(x*uCosI-z*uSinI));
  vec3 col=vec3(0.);
  float ki=6.2831853/(uLam.y*1e-3);
  float inc=cos(ki*(-uSinI*x-uCosI*z)-uT*ki*.5);
  col+=vec3(.7,.76,.86)*pow(max(inc,0.),12.)*band*.4;
  for(int i=0;i<3;i++){
    float lam=(i==0?uLam.x:i==1?uLam.y:uLam.z)*1e-3;
    float k=6.2831853/lam, w=k*.5;
    vec3 c=wl2rgb(i==0?uLamTrue.x:i==1?uLamTrue.y:uLamTrue.z);
    float A=0.,S=0.;
    for(int n=-4;n<=4;n++){
      float xn=float(n)*1.6; float wn=1.-smoothstep(2.,3.1,abs(xn*uCosI));
      float r=length(vec2(x-xn,z)), g=wn/sqrt(max(r,.35));
      A+=g*cos(k*r-k*uSinI*xn-uT*w); S+=g;}
    float b=pow(max(A/max(S,1e-3),0.),3.);
    col+=c*b*.8;}
  gl_FragColor=vec4(col*edge*uFade,1.);}`;
const BVERT = 'varying vec2 vUv;varying vec3 vN,vW;void main(){vUv=uv;vN=normalMatrix*normal;vec4 mv=modelViewMatrix*vec4(position,1.);vW=mv.xyz;gl_Position=projectionMatrix*mv;}';
const BFRAG = `
varying vec2 vUv;varying vec3 vN,vW; uniform vec3 uCol;uniform float uA,uT,uRip,uF1;
void main(){
  float core=pow(abs(dot(normalize(vN),normalize(-vW))),1.7);
  float env=smoothstep(0.,.045,vUv.y)*(1.-smoothstep(.3*uF1,uF1,vUv.y)); env*=1.+1.7*exp(-vUv.y*7.);
  float rip=1.-uRip*.22*(.5+.5*sin(vUv.y*34.-uT*6.));
  gl_FragColor=vec4(uCol*(uA*core*env*rip),1.);}`;

/* seeded pit landscape in micrometres, built once for a 1.6 µm pitch; every
   pit dimension scales with the pitch, so another pitch is a uniform scale */
const PIT_SEED = 7.31;
function prand(n) { const v = Math.sin(n * 12.9898 + PIT_SEED) * 43758.5453; return v - Math.floor(v); }
function pitHeight(x, y, soft) {
  const ti = Math.round(x / 1.6), dx = x - ti * 1.6;
  const ax = 1 - sm((Math.abs(dx) - 0.17) / (0.08 + soft));
  if (ax <= 0.001) return 0;
  const C = 2.4, ci = Math.floor(y / C), u = y - ci * C;
  const h1 = prand(ti * 3.7 + ci * 11.93), h2 = prand(ti * 7.31 + ci * 5.17 + 99.7);
  const len = 0.83 + h1 * 1.05, start = 0.15 + (C - len - 0.3) * h2;
  const ay = sm((u - start) / (0.09 + soft)) * (1 - sm((u - start - len) / (0.09 + soft)));
  return -0.11 * ax * ay;
}

export function mount({ el, hud, ctrl, out, solved }) {
  const T = { pitch: 1.6, zoom: 0, beams: true, waves: true };   // pitch in µm
  const strip = octave(hud);
  const say = voice(out);
  let done = false;

  const blackTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); blackTex.needsUpdate = true;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uLp: { value: new THREE.Vector3() }, uCp: { value: new THREE.Vector3() }, uEnv: { value: blackTex }, uEnvOn: { value: 0 }, uLabel: { value: blackTex }, uLabelOn: { value: 0 }, uPitch: { value: 1 }, uStripe: { value: 0 }, uFlat: { value: 0 }, uD: { value: 1600 }, uNorm: { value: new THREE.Matrix3() } },
    vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide,
  });
  const patchMat = new THREE.ShaderMaterial({
    uniforms: { uLp: { value: new THREE.Vector3() }, uCp: { value: new THREE.Vector3() }, uEnv: { value: blackTex }, uEnvOn: { value: 0 }, uFade: { value: 0 }, uD: { value: 1600 }, uNorm: { value: new THREE.Matrix3() } },
    vertexShader: VERT2, fragmentShader: FRAG2, side: THREE.DoubleSide, transparent: true, polygonOffset: true, polygonOffsetFactor: -1,
  });
  const SHEET_W = 12, SHEET_H = 7;
  const sheetMat = new THREE.ShaderMaterial({
    uniforms: { uSinI: { value: 0 }, uCosI: { value: 1 }, uT: { value: 0 }, uFade: { value: 0 }, uW: { value: SHEET_W }, uH: { value: SHEET_H }, uLam: { value: new THREE.Vector3(640, 532, 450) }, uLamTrue: { value: new THREE.Vector3(640, 532, 450) } },
    vertexShader: SVERT, fragmentShader: SFRAG, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  });
  const group = new THREE.Group(); group.rotation.order = 'YXZ'; group.rotation.x = -0.62;
  const disc = new THREE.Mesh(new THREE.RingGeometry(0.32, 1, 160, 1), mat); group.add(disc);
  group.add(new THREE.Mesh(new THREE.RingGeometry(1.0, 1.022, 160, 1), new THREE.MeshBasicMaterial({ color: 0x1d2733, side: THREE.DoubleSide })));
  let patches = null;
  function buildPatch(extentUm, seg) {
    const geo = new THREE.PlaneGeometry(extentUm, extentUm, seg, seg), pos = geo.attributes.position, soft = extentUm / seg * 0.9;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, pitHeight(pos.getX(i), pos.getY(i), soft));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, patchMat); mesh.visible = false; group.add(mesh); return mesh;
  }
  const ensurePatches = () => patches || (patches = [[0, buildPatch(128, 224)], [0.84, buildPatch(48, 224)], [0.905, buildPatch(32, 224)]]);
  const micro = new THREE.Group(); micro.visible = false; group.add(micro);
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(SHEET_W, SHEET_H), sheetMat);
  sheet.rotation.x = Math.PI / 2; sheet.position.set(0, 0, SHEET_H / 2); sheet.renderOrder = 4; micro.add(sheet);

  // the little light on its hemisphere
  const spr = document.createElement('canvas'); spr.width = spr.height = 64; const sctx = spr.getContext('2d');
  const g = sctx.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(255,251,240,1)'); g.addColorStop(0.25, 'rgba(255,246,222,.8)'); g.addColorStop(1, 'rgba(255,246,222,0)');
  sctx.fillStyle = g; sctx.fillRect(0, 0, 64, 64);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(spr), transparent: true, depthTest: false })); sprite.scale.set(0.34, 0.34, 1);
  let lightAz = 0.9, lightEl = 0.42; const LR = 1.3;
  const lightPos = () => new THREE.Vector3(LR * Math.cos(lightEl) * Math.sin(lightAz), LR * Math.sin(lightEl), LR * Math.cos(lightEl) * Math.cos(lightAz));

  // the fan of diffracted beams
  const uTShared = { value: 0 };
  const fan = new THREE.Group(); group.add(fan);
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).translate(0, 0.5, 0);
  const coneGeo = new THREE.CylinderGeometry(0.4, 1, 1, 10, 1, true).translate(0, 0.5, 0);
  function makeBeam(geo, f1) {
    const m = new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Vector3(1, 1, 1) }, uA: { value: 0 }, uT: uTShared, uRip: { value: ship.motion ? 1 : 0 }, uF1: { value: f1 } }, vertexShader: BVERT, fragmentShader: BFRAG, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(geo, m); mesh.renderOrder = 3; mesh.visible = false; fan.add(mesh); return mesh;
  }
  const inBeam = makeBeam(coneGeo, 1.04), m0Beam = makeBeam(beamGeo, 0.95);
  const BEAM_WLS = [640, 612, 584, 556, 528, 500, 470, 442];
  const orderBeams = []; for (let nb = 0; nb < BEAM_WLS.length * 2; nb++) orderBeams.push(makeBeam(beamGeo, 0.95));
  const bloom = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprite.material.map, blending: THREE.AdditiveBlending, depthTest: false, opacity: 0.7 })); bloom.scale.set(0.17, 0.17, 1); fan.add(bloom);
  const YUP = new THREE.Vector3(0, 1, 0), bdir = new THREE.Vector3();
  function aim(mesh, x, y, z2, len, rad, col, amp) {
    mesh.visible = amp > 0.004; if (!mesh.visible) return;
    mesh.quaternion.setFromUnitVectors(YUP, bdir.set(x, y, z2).normalize()); mesh.scale.set(rad, len, rad);
    mesh.material.uniforms.uCol.value.set(col[0], col[1], col[2]); mesh.material.uniforms.uA.value = amp;
  }
  let camera, H = 400;
  const DIR0 = new THREE.Vector3(0, 0.55, 3.1).normalize();
  const pitchDisc = () => T.pitch * 1e-6 / 0.06;      // pitch in disc units, disc radius 60 mm
  function zoomState() {
    const f = T.zoom, fg = Math.min(f, FG);
    const dolly = 3.2 * Math.pow(0.04, fg);
    const pitchU = pitchDisc() * Math.pow(10, 4.55 * fg) * dolly / 3.2;
    const pitchPx = pitchU * H / (2 * dolly * Math.tan(camera.fov * Math.PI / 360));
    const stripe = pitchPx < 1.5 ? 0 : sm((Math.log10(pitchPx) - 0.25) / 0.65);
    return { f, dolly, pitchU, pitchPx, stripe, wave: sm((f - 0.9) / 0.1) };
  }
  function updateBeams(z, t) {
    fan.visible = T.beams; uTShared.value = t;
    const Lp = mat.uniforms.uLp.value, dive = sm(Math.min(1, z.f * 1.6));
    const phi = Math.atan2(Lp.y, Lp.x) * (1 - dive), cr = Math.cos(phi), sr = Math.sin(phi);
    fan.position.set(0.68 * cr, 0.68 * sr, 0);
    const k = Math.max(0.02, z.dolly / 3.2); fan.scale.setScalar(k);
    const lx = Lp.x - fan.position.x, ly = Lp.y - fan.position.y, lz = Lp.z, ln = Math.hypot(lx, ly, lz) || 1;
    const Lr = (lx * cr + ly * sr) / ln, Lt = (-lx * sr + ly * cr) / ln, Lz = lz / ln;
    const side = Lz >= 0 ? 1 : -1, up = Math.abs(Lz);
    sheetMat.uniforms.uSinI.value = Lr; sheetMat.uniforms.uCosI.value = Math.sqrt(Math.max(0, 1 - Lr * Lr));
    sheetMat.uniforms.uFade.value = side > 0 ? z.wave : 0; sheetMat.uniforms.uT.value = ship.motion ? t % 600 : 0;
    if (!T.beams) return;
    aim(inBeam, lx / ln, ly / ln, lz / ln, Math.min(ln / k, 60), 0.055, [1, 0.98, 0.9], 0.55);
    const d0 = [(-Lr) * cr - (-Lt) * sr, (-Lr) * sr + (-Lt) * cr, Lz];
    const dim = 1 - 0.7 * z.wave * (sheetMat.uniforms.uFade.value > 0 ? 1 : 0);
    aim(m0Beam, d0[0], d0[1], d0[2], 1.5, 0.034, [1, 1, 1], 0.26 * Math.pow(up, 0.35) * dim);
    const D = T.pitch * 1000; let n = 0;
    for (let m2 = 1; m2 <= 2; m2++) for (let w = 0; w < BEAM_WLS.length; w++) {
      const lam = BEAM_WLS[w], mesh = orderBeams[n++];
      const ur = Lr - m2 * lam / D, ut = -Lt, uz2 = 1 - ur * ur - ut * ut;
      if (uz2 < 0.004) { mesh.visible = false; continue; }
      aim(mesh, ur * cr - ut * sr, ur * sr + ut * cr, side * Math.sqrt(uz2), 1.65, 0.028, rgb01(lam), (m2 === 1 ? 0.8 : 0.28) * Math.pow(up, 0.35) * dim);
    }
    bloom.material.opacity = 0.25 + 0.5 * up;
  }
  const inv = new THREE.Matrix4(), tgt = new THREE.Vector3(), tmp = new THREE.Vector3();
  function update(t) {
    sprite.position.copy(lightPos());
    const z = zoomState(), pf = sm((z.f - 0.74) / 0.08); let active = null;
    if (pf > 0.001) {
      const ps = ensurePatches(), s = z.pitchU / 1.6;
      for (const p of ps) { p[1].visible = false; if (z.f >= p[0]) active = p[1]; }
      active.visible = true; active.scale.set(s, s, s); active.position.set(0.68, 0, 0.05 * s);
      patchMat.uniforms.uFade.value = pf; micro.position.copy(active.position); micro.scale.copy(active.scale);
    } else if (patches) for (const p of patches) p[1].visible = false;
    micro.visible = !!active && T.waves && z.wave > 0.001;
    group.updateMatrixWorld(true);
    const lift = active ? 1.8 * z.wave * z.pitchU / 1.6 : 0;
    tgt.set(0.68, 0, lift).applyMatrix4(group.matrixWorld).multiplyScalar(sm(Math.min(1, z.f * 1.6)));
    camera.position.copy(tgt).addScaledVector(DIR0, z.dolly); camera.lookAt(tgt);
    sprite.material.opacity = 1 - sm((z.f - 0.45) / 0.25);
    mat.uniforms.uPitch.value = z.pitchU; mat.uniforms.uStripe.value = z.stripe; mat.uniforms.uFlat.value = pf;
    mat.uniforms.uNorm.value.setFromMatrix4(group.matrixWorld);
    inv.copy(group.matrixWorld).invert();
    mat.uniforms.uLp.value.copy(sprite.position).applyMatrix4(inv); mat.uniforms.uCp.value.copy(camera.position).applyMatrix4(inv);
    if (active) {
      inv.copy(active.matrixWorld).invert();
      patchMat.uniforms.uLp.value.copy(sprite.position).applyMatrix4(inv); patchMat.uniforms.uCp.value.copy(camera.position).applyMatrix4(inv);
      patchMat.uniforms.uNorm.value.setFromMatrix4(active.matrixWorld);
    }
    updateBeams(z, t);
    ruler(z);
  }
  // the one real measurement at the bottom of the dive: one track pitch, on the HUD
  const rulerEl = document.createElement('div'); rulerEl.className = 'ruler'; rulerEl.innerHTML = '<svg><line x1="0" y1="0" x2="0" y2="0"/><line class="c" x1="0" y1="0" x2="0" y2="0"/><line class="c" x1="0" y1="0" x2="0" y2="0"/></svg><span></span>';
  hud.appendChild(rulerEl);
  const rl = rulerEl.querySelectorAll('line'), rs = rulerEl.querySelector('span');
  function proj(v, size) { tmp.copy(v).project(camera); return [(tmp.x * 0.5 + 0.5) * size.w, (-tmp.y * 0.5 + 0.5) * size.h]; }
  let vpSize = { w: 1, h: 1 };
  function ruler(z) {
    const a = sm((z.f - 0.82) / 0.13); rulerEl.style.opacity = a.toFixed(3);
    if (a < 0.01) return;
    const s0 = proj(tgt.set(0.68, 0, 0).applyMatrix4(group.matrixWorld), vpSize), s1 = proj(tgt.set(0.68 + z.pitchU, 0, 0).applyMatrix4(group.matrixWorld), vpSize);
    const dx = s1[0] - s0[0], dy = s1[1] - s0[1], len = Math.hypot(dx, dy);
    if (len < 10 || len > vpSize.w) { rulerEl.style.opacity = 0; return; }
    const px = -dy / len, py = dx / len;
    const set = (l, x1, y1, x2, y2) => { l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2); };
    set(rl[0], s0[0], s0[1], s1[0], s1[1]); set(rl[1], s0[0] + px * 9, s0[1] + py * 9, s0[0] - px * 9, s0[1] - py * 9); set(rl[2], s1[0] + px * 9, s1[1] + py * 9, s1[0] - px * 9, s1[1] - py * 9);
    rs.textContent = T.pitch.toFixed(2) + ' µm'; rs.style.left = ((s0[0] + s1[0]) / 2 + px * 16) + 'px'; rs.style.top = ((s0[1] + s1[1]) / 2 + py * 16) + 'px';
  }
  // JS-side physics sampling for the octave strip and the readouts: eight disc points
  function sampleLambdas() {
    const Lp = mat.uniforms.uLp.value, Cp = mat.uniforms.uCp.value, outL = [], D = T.pitch * 1000;
    for (let k = 0; k < 8; k++) {
      const a = k * TAU / 8, px = 0.68 * Math.cos(a), py = 0.68 * Math.sin(a);
      const Lx = Lp.x - px, Ly = Lp.y - py, Lz = Lp.z, Ln = Math.hypot(Lx, Ly, Lz);
      const Vx = Cp.x - px, Vy = Cp.y - py, Vz = Cp.z, Vn = Math.hypot(Vx, Vy, Vz);
      const sinI = (Lx * Math.cos(a) + Ly * Math.sin(a)) / Ln, sinR = (Vx * Math.cos(a) + Vy * Math.sin(a)) / Vn;
      const facing = (Lz / Ln) * (Vz / Vn), s = Math.abs(sinI - sinR);
      for (let m = 1; m <= 12; m++) { const lam = D * s / m; if (lam < 380) break; if (lam < 750 && facing > 0.02) outL.push(lam); }
    }
    return outL;
  }
  function updateStrip() {
    if (zoomState().stripe > 0.5) { strip.light(() => 0.55); return; }
    const lams = sampleLambdas();
    if (!lams.length) { strip.light(null); return; }
    if (!done) { done = true; solved(); }
    strip.light(nm => { let w = 0.15; for (const l of lams) { const d = nm - l; w = Math.max(w, 0.15 + 0.9 * Math.exp(-d * d / 1800)); } return Math.min(0.95, w); });
  }

  /* ---- readouts and the voice ---- */
  const R = readouts(out, [
    { id: 'd', k: 'track pitch d', d: 'the grating spacing; one spiral groove, this far between turns' },
    { id: 'eq', k: 'first order, red 650 nm', d: 'sin i − sin r = λ / d: the angle difference that lights up red' },
    { id: 'zoom', k: 'magnification', d: 'the dive, from the whole disc to the pits' },
  ]);
  function report() {
    const D = T.pitch * 1000;
    R.set('d', fmtUm(T.pitch) + (Math.abs(T.pitch - 1.6) < 0.01 ? ' <span class="u">CD</span>' : Math.abs(T.pitch - 0.74) < 0.01 ? ' <span class="u">DVD</span>' : Math.abs(T.pitch - 0.32) < 0.01 ? ' <span class="u">Blu-ray</span>' : ''));
    const s1 = 650 / D;
    R.set('eq', s1 > 2 ? '<span class="u">no solution</span>' : s1.toFixed(3), s1 > 2 ? 'λ / d exceeds 2: no geometry at all sends red back' : s1 > 1 ? 'λ / d exceeds 1: only grazing geometry can light red' : `at normal incidence red leaves ${(Math.asin(s1) / DEG).toFixed(1)}° off the mirror bounce; violet 380 nm, ${(Math.asin(380 / D) / DEG).toFixed(1)}°`);
    R.set('zoom', zoomText(T.zoom));
    if (T.pitch < 0.4) say(`At ${T.pitch.toFixed(2)} µm the pitch is shorter than any visible wavelength: the first order can only leave at grazing angles, and only the violet end. A Blu-ray disc looks bluish for exactly this reason.`);
    else if (T.pitch < 1) say(`At ${T.pitch.toFixed(2)} µm the colours spread wide: red 650 nm needs a sine difference of ${s1.toFixed(2)}, most of the way to grazing. A DVD throws its rainbow much wider than a CD.`);
    else if (T.pitch > 4) say(`At ${T.pitch.toFixed(1)} µm there are ${Math.floor(D / 380)} visible orders inside a sine difference of one; they overlap, the colours add back toward white, and the rainbow washes out. A coarse grating is a poor rainbow.`);
    else say(`At ${T.pitch.toFixed(2)} µm the first order spans ${(Math.asin(380 / D) / DEG).toFixed(0)}° to ${(Math.asin(650 / D) / DEG).toFixed(0)}° from the mirror bounce: one clean rainbow, red on the outside. The CD was built for data, and got this for free.`);
  }

  /* ---- controls ---- */
  const dZ = dial(ctrl, { label: 'zoom into the surface', min: 0, max: 1000, step: 1, value: 0, fmt: v => zoomText(v / 1000), onInput: v => { T.zoom = v / 1000; setWhy(); report(); updateStrip(); waveChip.hidden = zoomState().wave < 0.001; } });
  const dP = dial(ctrl, { label: 'track pitch d', min: 0.2, max: 10, step: 0.01, value: 1.6, fmt: v => v.toFixed(2) + ' µm', onInput: v => { setPitch(v); } });
  const pitchChips = chips(ctrl, [{ id: '0.32', name: 'Blu-ray', b: '0.32 µm' }, { id: '0.74', name: 'DVD', b: '0.74 µm' }, { id: '1.6', name: 'CD', b: '1.6 µm', on: true }, { id: '10', name: 'coarse', b: '10 µm' }], { onPick: it => { dP.set(+it.id); setPitch(+it.id); } });
  function setPitch(v) {
    T.pitch = v; const D = v * 1000;
    mat.uniforms.uD.value = D; patchMat.uniforms.uD.value = D;
    sheetMat.uniforms.uLam.value.set(640, 532, 450).multiplyScalar(1.6 / v);
    pitchChips.mark(String(v)); report(); updateStrip();
  }
  const togg = chips(ctrl, [{ id: 'beams', name: 'show the beam', on: true }, { id: 'waves', name: 'show the waves', on: true }], { radio: false, onPick: (it, b) => { T[it.id] = !T[it.id]; b.setAttribute('aria-pressed', String(T[it.id])); } });
  const waveChip = togg.get('waves'); waveChip.hidden = true;
  // the why, in three beats under the stage, as the dive reaches the pits
  const why = document.createElement('div'); why.className = 'cdwhy'; why.hidden = true;
  why.innerHTML = '<p>The lamp’s light arrives as a train of crests, <b>0.4 to 0.7 µm</b> apart depending on colour, and lands on several rows of pits at once.</p>' +
    '<p>Every row sends back a ripple of its own. In most directions the ripples from neighbouring rows arrive out of step and cancel. Where they arrive <b>crest on crest</b>, they add up into a beam.</p>' +
    '<p>The rows are <b class="pitchword">1.6 µm</b> apart, so the crest-on-crest angle depends on how long the wave is: red lines up at a wider angle than blue. The bounce sorts white light into a rainbow. <span class="num">d·(sin i − sin r) = mλ</span></p>';
  out.appendChild(why);
  function setWhy() { why.hidden = T.zoom < 0.84; [...why.children].forEach((p, i) => p.classList.toggle('on', T.zoom >= 0.84 + i * 0.05)); why.querySelector('.pitchword').textContent = T.pitch.toFixed(2) + ' µm'; }

  /* ---- interaction: drag tilts the disc, or grabs the light ---- */
  let dragging = 0, lastX = 0, lastY = 0, vx = 0, vy = 0;
  function lightScreenXY(vp) { tmp.copy(sprite.position).project(camera); return { x: (tmp.x * 0.5 + 0.5) * vp.size.w, y: (-tmp.y * 0.5 + 0.5) * vp.size.h }; }

  ship.viewport(el, {
    fov: 34,
    setup(vp) {
      camera = vp.camera; camera.near = 0.01; camera.far = 30; camera.position.set(0, 0.55, 3.1); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
      vp.scene.add(group, sprite);
      try {
        new HDRLoader().load('env/studio_small_03_1k.hdr', tex => { tex.mapping = THREE.EquirectangularReflectionMapping; mat.uniforms.uEnv.value = tex; mat.uniforms.uEnvOn.value = 1; patchMat.uniforms.uEnv.value = tex; patchMat.uniforms.uEnvOn.value = 1; }, undefined, () => {});
      } catch (e) { /* analytic lighting stays */ }
      try {
        const ltex = new THREE.TextureLoader().load('cd-label.jpg', () => { mat.uniforms.uLabelOn.value = 1; }, undefined, () => {});
        ltex.colorSpace = THREE.SRGBColorSpace; if (ship.renderer) ltex.anisotropy = ship.renderer.capabilities.getMaxAnisotropy();
        mat.uniforms.uLabel.value = ltex;
      } catch (e) { /* plain label stays */ }
      report(); setWhy(); update(0); updateStrip();
    },
    resize(vp) { vpSize = vp.size; H = vp.size.h; },
    frame(vp) {
      if (!dragging && ship.motion && (Math.abs(vx) + Math.abs(vy)) > 0.02) {
        group.rotation.y += vx * vp.dt; group.rotation.x = clamp(group.rotation.x + vy * vp.dt, -2.62, 2.62);
        vx *= Math.exp(-vp.dt * 6); vy *= Math.exp(-vp.dt * 6);
      }
      update(vp.t);
    },
    pointer(ev, vp) {
      const r = el.getBoundingClientRect(), p = { x: ev.clientX - r.left, y: ev.clientY - r.top };
      if (ev.type === 'pointerdown') {
        const ls = lightScreenXY(vp);
        dragging = (T.zoom < 0.5 && Math.hypot(p.x - ls.x, p.y - ls.y) < 30) ? 2 : 1;
        lastX = p.x; lastY = p.y; vx = vy = 0; el.setPointerCapture(ev.pointerId); el.classList.add('is-grabbing');
      } else if (ev.type === 'pointermove' && dragging) {
        const dx = p.x - lastX, dy = p.y - lastY; lastX = p.x; lastY = p.y;
        if (dragging === 2) { lightAz += dx * 0.012; lightEl = clamp(lightEl - dy * 0.006, 0.1, 0.62); }
        else { group.rotation.y += dx * 0.008; vx = dx * 0.5; group.rotation.x = clamp(group.rotation.x + dy * 0.008, -2.62, 2.62); vy = dy * 0.5; }
        update(vp.t); updateStrip();
      } else if (ev.type === 'pointerup' || ev.type === 'pointercancel') { dragging = 0; el.classList.remove('is-grabbing'); if (!ship.motion) vx = vy = 0; }
    },
  });
}
