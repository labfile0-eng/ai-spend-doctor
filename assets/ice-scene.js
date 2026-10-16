import * as THREE from './vendor/three.module.min.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';

/* An original, procedural data core. No external assets or network calls. */
const canvas = document.querySelector('#ice-scene');
const host = document.querySelector('#landscape');
const toggle = document.querySelector('#motion-toggle');
if (canvas && host) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  } catch {
    // The static illustration and the full CSV tool remain available without WebGL.
    if (toggle) toggle.hidden = true;
  }
  if (renderer) init(renderer);
}

function init(renderer) {
  let seed = 1947;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 700px)');
  let paused = reduced.matches;
  let visible = true;
  let frame = 0;
  let last = 0;
  let elapsed = 0;
  let pointerX = 0;
  let pointerY = 0;
  let scroll = 0;
  let contextLost = false;
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile.matches ? 1.3 : 1.7));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#aebdce');
  scene.fog = new THREE.FogExp2('#aebdce', 0.034);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 130);
  scene.add(new THREE.HemisphereLight('#eff6ff', '#5d6c81', 1.65));
  const key = new THREE.DirectionalLight('#f1f7ff', 3.1);
  key.position.set(-6, 12, 7);scene.add(key);
  const rim = new THREE.DirectionalLight('#bddaff', 2.8);
  rim.position.set(7, 5, -7);scene.add(rim);
  const fill = new THREE.DirectionalLight('#e6edff', 0.6);
  fill.position.set(2, 1, 10);scene.add(fill);

  // A repeatable frost texture is generated entirely in memory.
  const tex = document.createElement('canvas');tex.width = tex.height = 256;
  const ctx = tex.getContext('2d');
  const image = ctx.createImageData(256, 256);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = 164 + random() * 88;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const frost = new THREE.CanvasTexture(tex);
  frost.wrapS = frost.wrapT = THREE.RepeatWrapping;
  frost.repeat.set(3, 3);
  const material = new THREE.MeshStandardMaterial({color:'#9fadc0',roughness:0.53,metalness:0.13,bumpMap:frost,bumpScale:0.055});
  const geometry = new RoundedBoxGeometry(0.96, 0.96, 0.96, 4, 0.065);
  const core = new THREE.Group();
  const blocks = [];
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) {
    if (x === 1 && z === 1 && y === 1) continue;
    const mesh = new THREE.Mesh(geometry, material);
    const base = new THREE.Vector3((x - 1) * 1.075, (y - 1) * 1.075, (z - 1) * 1.075);
    const direction = base.clone().normalize();
    let separation = 0;
    if (y === 2) separation = 0.17 + random() * 0.38;
    if (x === 2 && z === 2) separation += 0.11;
    const rot = new THREE.Euler((random() - .5) * .12,(random() - .5) * .14,(random() - .5) * .13);
    mesh.position.copy(base).addScaledVector(direction, separation);
    mesh.rotation.copy(rot);
    core.add(mesh);
    blocks.push({mesh, base:mesh.position.clone(), direction, rot, phase:random() * Math.PI * 2});
  }
  const heart = new THREE.Mesh(new RoundedBoxGeometry(2.92,2.92,2.92,3,.08),new THREE.MeshBasicMaterial({color:'#e6f4ff'}));
  core.add(heart);
  core.rotation.set(.12, -.48, -.075);
  scene.add(core);
  const innerLight = new THREE.PointLight('#e6f6ff', 30, 7, 2);
  innerLight.position.set(3.25, 3.7, 2);scene.add(innerLight);

  // Terrain: layered sine noise produces a glacier with a valley around the core.
  const terrainGeometry = new THREE.PlaneGeometry(100, 100, 200, 200);
  terrainGeometry.rotateX(-Math.PI / 2);
  const pos = terrainGeometry.attributes.position;
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const n = Math.sin(x * .23 + z * .12) * .7 + Math.sin(x * .56 - z * .36) * .25 + Math.cos(z * .83 + x * .34) * .11 + Math.sin(x * 2.3 + z * 1.6) * .07 + Math.cos(x * 4.9 - z * 2.3) * .024;
    const back = Math.max(0, -z - 6);
    const ridge = Math.sin(x * .21 + .7) * Math.cos(z * .1) * back * .16;
    const height = n * (1 + Math.min(2.4, Math.abs(z) * .09)) + Math.max(0,ridge) - 1.1;
    pos.setY(i, height);
    const c = new THREE.Color().setHSL(.6, .13, .47 + random() * .09 + n * .045);
    colors.push(c.r,c.g,c.b);
  }
  terrainGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  terrainGeometry.computeVertexNormals();
  const terrainMaterial = new THREE.MeshStandardMaterial({vertexColors:true,roughness:.93,metalness:.02,bumpMap:frost,bumpScale:.095});
  const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
  scene.add(terrain);

  // Broad, soft contact shadow without expensive per-frame shadow maps.
  const shadowCanvas = document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;
  const sc=shadowCanvas.getContext('2d'),grad=sc.createRadialGradient(64,64,4,64,64,64);
  grad.addColorStop(0,'rgba(40,55,78,.45)');grad.addColorStop(.5,'rgba(40,55,78,.20)');grad.addColorStop(1,'rgba(40,55,78,0)');
  sc.fillStyle=grad;sc.fillRect(0,0,128,128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(7.4,7.4),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.set(3.25,-.48,0);scene.add(shadow);

  // Tiny stationary frost particles catch the light as the camera moves.
  const snowPositions=[];
  for(let i=0;i<100;i++)snowPositions.push((random()-.5)*35,random()*13-1,(random()-.5)*28);
  const snowGeometry=new THREE.BufferGeometry();snowGeometry.setAttribute('position',new THREE.Float32BufferAttribute(snowPositions,3));
  const snow=new THREE.Points(snowGeometry,new THREE.PointsMaterial({color:'#f1f8ff',size:.022,transparent:true,opacity:.5,depthWrite:false}));scene.add(snow);

  function resize() {
    const w=host.clientWidth,h=host.clientHeight;
    renderer.setSize(w,h,false);camera.aspect=w/h;
    if(mobile.matches){camera.fov=44;camera.position.set(0,4.1,16.4);camera.lookAt(0,2.8,0);core.position.set(.45,-.55,0);core.scale.setScalar(.95);shadow.position.x=.45;}
    else{camera.fov=40;camera.position.set(0,5.0,14.8);camera.lookAt(0,1.5,0);core.position.set(3.65,2.1,0);core.scale.setScalar(1.28);shadow.position.x=3.65;}
    camera.updateProjectionMatrix();
    innerLight.position.set(core.position.x,core.position.y+1,2);
    draw(0);
  }
  function draw(dt) {
    if(contextLost)return;
    if(!paused)elapsed+=dt;
    const t=elapsed;
    core.rotation.y=-.48 + (paused?0:Math.sin(t*.12)*.12) + pointerX*.09;
    core.rotation.x=.12+pointerY*.04;
    const expand=paused?0:scroll*.7;
    blocks.forEach(b=>{
      b.mesh.position.copy(b.base).addScaledVector(b.direction,expand);
      if(!paused)b.mesh.position.y+=Math.sin(t*.6+b.phase)*.026;
      b.mesh.rotation.x=b.rot.x+expand*.11;
      b.mesh.rotation.z=b.rot.z+expand*.08;
    });
    renderer.render(scene,camera);
  }
  function animate(now){frame=0;if(!visible||document.hidden||contextLost)return;const dt=last?Math.min((now-last)/1000,.05):0;last=now;draw(dt);if(!paused)frame=requestAnimationFrame(animate);}
  function schedule(){if(!frame&&visible&&!document.hidden&&!contextLost){last=0;frame=requestAnimationFrame(animate);}}
  function syncToggle(){if(toggle){toggle.setAttribute('aria-pressed',String(paused));toggle.innerHTML=paused?'Resume motion <span aria-hidden="true">▷</span>':'Pause motion <span aria-hidden="true">Ⅱ</span>';}}
  if(toggle)toggle.addEventListener('click',()=>{paused=!paused;syncToggle();schedule();});
  reduced.addEventListener('change',()=>{paused=reduced.matches;pointerX=pointerY=0;syncToggle();schedule();});
  window.addEventListener('pointermove',event=>{if(paused||mobile.matches||!visible)return;pointerX=event.clientX/innerWidth-.5;pointerY=event.clientY/innerHeight-.5;},{passive:true});
  window.addEventListener('scroll',()=>{scroll=Math.min(1,Math.max(0,window.scrollY/host.clientHeight));},{passive:true});
  window.addEventListener('resize',resize,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else schedule();});
  if('IntersectionObserver'in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)schedule();else{cancelAnimationFrame(frame);frame=0;}},{rootMargin:'60px'}).observe(host);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;cancelAnimationFrame(frame);frame=0;host.classList.remove('scene-ready');if(toggle)toggle.hidden=true;});
  canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;resize();host.classList.add('scene-ready');if(toggle)toggle.hidden=false;schedule();});
  resize();syncToggle();host.classList.add('scene-ready');schedule();
}
