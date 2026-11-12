/* Luminous memory. Canvas atmosphere and semantic interaction feedback. */
(() => {
  'use strict';
  const body=document.body,$=s=>document.querySelector(s);
  body.classList.add('luminous');
  $('.goal-card').insertAdjacentHTML('afterbegin','<span class="lumen-caption" aria-hidden="true">A LITTLE MORE. A LITTLE BRIGHTER.</span><span class="lumen-orbit-label" aria-hidden="true">MEMORY / IN MOTION</span>');
  const strengthLabel=document.createElement('label');strengthLabel.className='settings-row';strengthLabel.innerHTML='反馈强度<select id="lumen-intensity"><option value="gentle">柔和 · 安静陪伴</option><option value="balanced">适中 · 层次反馈</option><option value="vivid">鲜明 · 更有成就感</option></select>';$('#space-motion-toggle').closest('label').after(strengthLabel);
  let intensity='balanced';try{intensity=localStorage.getItem('word-accumulator.lumen-intensity')||'balanced';}catch{}if(!['gentle','balanced','vivid'].includes(intensity))intensity='balanced';$('#lumen-intensity').value=intensity;
  $('#lumen-intensity').onchange=e=>{intensity=e.target.value;try{localStorage.setItem('word-accumulator.lumen-intensity',intensity);}catch{}};
  const strength=()=>({gentle:.45,balanced:1,vivid:1.55}[intensity]);
  const qualityLabel=document.createElement('label');qualityLabel.className='settings-row';qualityLabel.innerHTML='光流与粒子<select id="lumen-quality"><option value="full">完整 · 流动光场</option><option value="calm">轻量 · 少量粒子</option><option value="off">静态 · 无粒子运动</option></select>';
  $('#ambient-toggle').closest('label').before(qualityLabel);
  $('#space-motion-toggle').closest('label').firstChild.textContent='界面过渡与交互动画';
  $('#ambient-toggle').closest('label').hidden=true;
  $('#ambient-toggle').checked=false;body.classList.remove('ambient-enabled');
  $('#ambient-toggle').closest('label').nextElementSibling.textContent='首页滑动时光带会散开再聚合，附近的光点会跟随鼠标或手指。轻量模式减少粒子，静态模式停止光场运动。';
  const extra=document.createElement('p');extra.textContent='反馈分层：普通按钮轻压响应；翻卡像展开一页；认识时微光向上归入进度；配对成功，两端光点相遇；完成一轮才绽放光晕。设置可分别调整反馈强度和运行画质。';$('#studio-help form').before(extra);
  let quality='full';try{quality=localStorage.getItem('word-accumulator.lumen-quality')||'full';}catch{}if(!['full','calm','off'].includes(quality))quality='full';$('#lumen-quality').value=quality;
  const bg=document.createElement('canvas'),fx=document.createElement('canvas');bg.id='lumen-field';fx.id='lumen-effects';for(const c of [bg,fx]){c.setAttribute('aria-hidden','true');body.append(c);}const ctx=bg.getContext('2d',{alpha:true}),ink=fx.getContext('2d',{alpha:true});if(!ctx||!ink)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let width=innerWidth,height=innerHeight,dpr=1,raf=0,previous=0,t=0,view=body.dataset.view||'home',ambient=[],bursts=[],links=[],ripples=[],blooms=[],frameCount=0,frameCost=0,adaptive=1;
  let current=[130,229,196],desired=[130,229,196],art={x:width*.75,y:270,rx:170,ry:120},artTarget={x:width*.75,y:270,rx:170,ry:120},pointer={x:width*.5,y:height*.4,active:false},pull={x:0,y:0},drag=null;
  const palettes={home:[130,229,196],study:[132,226,204],browse:[126,204,223],practice:[173,189,239],mistakes:[226,197,152]};
  const sprites=[[142,239,207],[193,209,255],[245,204,154]].map(rgb=>{const c=document.createElement('canvas');c.width=c.height=32;const g=c.getContext('2d'),r=g.createRadialGradient(16,16,0,16,16,16);r.addColorStop(0,`rgba(${rgb},1)`);r.addColorStop(.12,`rgba(${rgb},.85)`);r.addColorStop(.35,`rgba(${rgb},.19)`);r.addColorStop(1,`rgba(${rgb},0)`);g.fillStyle=r;g.fillRect(0,0,32,32);return c;});
  const moving=()=>quality!=='off'&&!reduced.matches&&!body.classList.contains('no-motion');
  const center=el=>{const r=el.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height};};
  const goalRing = $('.goal-ring');
  const orbitPoint = {x: 0, y: 0};
  let orbitParticles = [];
  let goalDocumentY = 0;
  let previousScroll = scrollY;
  let separation = 0;
  let scrollMomentum = 0;
  let effectPainted = false;

  function layout() {
    width = innerWidth;
    height = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, quality === 'calm' ? 1.5 : 2);
    const canvasWidth = Math.round(width * dpr);
    const canvasHeight = Math.round(height * dpr);
    for (const canvas of [bg, fx]) {
      if (canvas.width !== canvasWidth) canvas.width = canvasWidth;
      if (canvas.height !== canvasHeight) canvas.height = canvasHeight;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ink.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (view === 'home') {
      const goal = center(goalRing);
      goalDocumentY = goal.y + scrollY;
      artTarget = {
        x: goal.x,
        y: goal.y,
        rx: Math.min(width * .37, width < 560 ? 139 : width < 800 ? 145 : 188),
        ry: width < 560 ? 92 : 122
      };
    } else {
      artTarget = {x: width * .88, y: height * .66, rx: width * .35, ry: height * .28};
    }

    const nav = $('.space-dock');
    const active = nav.querySelector('[aria-current=page]');
    if (active) {
      const a = active.getBoundingClientRect();
      const b = nav.getBoundingClientRect();
      nav.style.setProperty('--nav-x', (a.left - b.left + a.width / 2 - (width < 800 ? 15 : 24)) + 'px');
    }
  }

  function seed() {
    const mobile = width < 650;
    const ambientCount = mobile ? 155 : 260;
    ambient = Array.from({length: ambientCount}, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      offsetX: 0,
      offsetY: 0,
      gathered: 0,
      z: .2 + Math.random() * .8,
      phase: Math.random() * Math.PI * 2
    }));
    const count = mobile ? 230 : 370;
    orbitParticles = Array.from({length: count}, (_, i) => ({
      phase: (i * .61803398875) % 1,
      strand: Math.random() * 25,
      rate: 3.8 + Math.random() * 9,
      drift: .018 + Math.random() * .029,
      scatterX: (Math.random() - .5) * 126,
      scatterY: (Math.random() - .5) * 116,
      wave: Math.random() * Math.PI * 2,
      size: i % 14 === 0 ? 8 : 2.9 + Math.random() * 2.5,
      x: null,
      y: null
    }));
  }

  function reset() {
    cancelAnimationFrame(raf);
    raf = 0;
    previous = 0;
    previousScroll = scrollY;
    separation = 0;
    scrollMomentum = 0;
    pointer.active = false;
    layout();
    art = {...artTarget};
    seed();
    draw(0);
    if (moving() && !document.hidden) raf = requestAnimationFrame(frame);
  }

  function point(shape, strand, phase) {
    const angle = phase * Math.PI * 2;
    const twist = Math.sin(angle * 2 + t * .22 + strand * .052);
    const radius = 1 + strand * .007 + Math.sin(angle * 3 - t * .19) * .055;
    orbitPoint.x = shape.x + Math.cos(angle) * shape.rx * radius + twist * 12 + pull.x * .06;
    orbitPoint.y = shape.y + Math.sin(angle) * shape.ry * (.65 + strand * .012)
      + Math.cos(angle * 2 + t * .2 + strand * .11) * 23 + pull.y * .035;
  }

  function drawRibbon(shape, opacity, rgb) {
    if (opacity < .008 || shape.y + shape.ry + 30 < 0 || shape.y - shape.ry - 30 > height) return;
    const lines = Math.round((quality === 'calm' ? 12 : 25) * adaptive);
    const segments = quality === 'calm' ? 44 : 64;
    for (let j = 0; j < lines; j++) {
      ctx.beginPath();
      for (let k = 0; k <= segments; k++) {
        point(shape, j * 25 / lines, k / segments);
        if (k === 0) ctx.moveTo(orbitPoint.x, orbitPoint.y);
        else ctx.lineTo(orbitPoint.x, orbitPoint.y);
      }
      ctx.strokeStyle = `rgba(${rgb},${(.045 + Math.sin(j / lines * Math.PI) * .13) * opacity})`;
      ctx.lineWidth = j % 8 === 0 ? .85 : .58;
      ctx.stroke();
    }
  }

  function drawOrbit(dt, alpha, rgb) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (view !== 'home') {
      drawRibbon(art, .13 * alpha, rgb);
      ctx.restore();
      return;
    }

    const spread = separation;
    drawRibbon(artTarget, (1 - spread) ** 2 * alpha, rgb);
    const count = Math.round(orbitParticles.length * (quality === 'calm' ? .42 : 1) * adaptive);
    for (let i = 0; i < count; i++) {
      const particle = orbitParticles[i];
      point(artTarget, particle.strand, (particle.phase + t * particle.drift) % 1);
      const x = orbitPoint.x + (particle.scatterX + Math.sin(t * 2.8 + particle.wave) * 18) * spread;
      const y = orbitPoint.y + particle.scatterY * spread + scrollMomentum * (1.25 - particle.rate / 16);
      const follow = 1 - Math.exp(-particle.rate * dt);
      particle.x = particle.x === null || !dt ? x : particle.x + (x - particle.x) * follow;
      particle.y = particle.y === null || !dt ? y : particle.y + (y - particle.y) * follow;
      const size = particle.size * (1 + spread * .24);
      if (particle.y < -size || particle.y > height + size) continue;
      const glint = .75 + Math.sin(t * 1.4 + particle.wave) * .25;
      ctx.globalAlpha = (.23 + spread * .58) * glint * alpha;
      ctx.drawImage(sprites[i % 17 === 0 ? 1 : 0], particle.x - size / 2, particle.y - size / 2, size, size);
    }
    ctx.restore();
  }

  function drawAmbient(dt, alpha) {
    const gather = dt > 0 && pointer.active && view === 'home';
    const radius = width < 650 ? 170 : 235;
    const count = Math.round(ambient.length * (quality === 'calm' ? .54 : 1) * adaptive);
    const attraction = 1 - Math.exp(-4.5 * dt);
    for (let i = 0; i < count; i++) {
      const particle = ambient[i];
      particle.x += Math.sin(particle.phase + t * .08) * dt * 4;
      particle.y -= dt * (3 + particle.z * 7);
      if (particle.y < -8) {
        particle.y = height + 8;
        particle.x = Math.random() * width;
      }
      if (particle.x < -8) particle.x = width + 8;
      if (particle.x > width + 8) particle.x = -8;

      let targetX = 0;
      let targetY = 0;
      let influence = 0;
      if (gather) {
        const dx = pointer.x - particle.x;
        const dy = pointer.y - particle.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < radius * radius) {
          influence = 1 - Math.sqrt(distanceSquared) / radius;
          const pullIn = Math.min(.88, influence * 1.5);
          const swirl = particle.phase + t * (.42 + particle.z * .36);
          targetX = (dx + Math.cos(swirl) * 32) * pullIn;
          targetY = (dy + Math.sin(swirl) * 24) * pullIn;
        }
      }
      particle.offsetX += (targetX - particle.offsetX) * attraction;
      particle.offsetY += (targetY - particle.offsetY) * attraction;
      particle.gathered += (influence - particle.gathered) * attraction;

      const size = 2.5 + particle.z * 3 + particle.gathered * 5;
      const x = particle.x + particle.offsetX;
      const y = particle.y + particle.offsetY;
      const twinkle = .22 + .15 * Math.sin(t * .55 + particle.phase);
      ctx.globalAlpha = (twinkle + particle.gathered * .64) * alpha;
      ctx.drawImage(sprites[i % 13 === 0 ? 1 : 0], x - size / 2, y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function draw(dt) {
    ctx.clearRect(0, 0, width, height);
    const hasFeedback = links.length || bursts.length || blooms.length || ripples.length;
    if (hasFeedback || effectPainted) ink.clearRect(0, 0, width, height);
    effectPainted = Boolean(hasFeedback && moving());
    const alpha = moving() ? 1 : .72;
    const rgb = current.map(Math.round).join(',');
    const haze = ctx.createRadialGradient(width * .72 + pull.x, height * .45 + pull.y, 0, width * .72, height * .5, width * .65);
    haze.addColorStop(0, `rgba(${rgb},.045)`);
    haze.addColorStop(.5, `rgba(${rgb},.018)`);
    haze.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, width, height);
    drawOrbit(dt, alpha, rgb);
    drawAmbient(dt, alpha);
    if(!moving())return;ink.globalCompositeOperation='lighter';
    links=links.filter(l=>{const q=(t-l.start)/l.life;if(q>=1)return false;
      // Two streams meet between the actual pair; no line drawn across the page.
      for(let side=0;side<2;side++)for(let i=0;i<14;i++){const v=Math.max(0,Math.min(1,q*1.8-i*.025));const a=side?l.b:l.a;const x=a.x+(l.mid.x-a.x)*v,y=a.y+(l.mid.y-a.y)*v+Math.sin(v*Math.PI)*(side?18:-18);ink.globalAlpha=Math.sin(q*Math.PI)*(1-i/15)*strength();const size=5+(1-i/14)*5;ink.drawImage(sprites[0],x-size/2,y-size/2,size,size);}ink.globalAlpha=1;return true;});
    blooms=blooms.filter(b=>{const q=(t-b.start)/b.life;if(q>=1)return false;ink.save();ink.translate(b.x,b.y);ink.strokeStyle=`rgba(${rgb},${Math.sin(q*Math.PI)*.2*strength()})`;for(let j=0;j<5;j++){ink.beginPath();for(let k=0;k<=80;k++){const a=k/80*Math.PI*2,r=(30+q*180)*(1+Math.sin(a*3+j*.7+q*2)*.13)+j*8;const x=Math.cos(a)*r,y=Math.sin(a)*r*.65;k?ink.lineTo(x,y):ink.moveTo(x,y);}ink.stroke();}ink.restore();return true;});
    bursts=bursts.filter(p=>{const age=t-p.start,q=age/p.life;if(q>=1)return false;const ease=1-(1-q)**3;const x=p.to?p.x+(p.to.x-p.x)*ease+Math.sin(q*Math.PI)*p.vx:p.x+p.vx*age;const y=p.to?p.y+(p.to.y-p.y)*ease+Math.sin(q*Math.PI)*p.vy:p.y+p.vy*age+age*age*8;ink.globalAlpha=(1-q)*.8;const s=p.size*(.7+Math.sin(q*Math.PI));ink.drawImage(sprites[p.sprite],x-s/2,y-s/2,s,s);return true;});ink.globalAlpha=1;
    ripples=ripples.filter(r=>{const q=(t-r.start)/r.life;if(q>=1)return false;ink.strokeStyle=`rgba(${r.color},${(1-q)*.38})`;ink.lineWidth=.8;ink.beginPath();ink.ellipse(r.x,r.y,8+q*r.radius,8+q*r.radius*.45,-.25,0,Math.PI*2);ink.stroke();return true;});ink.globalCompositeOperation='source-over';
  }
  function frame(now) {
    raf = 0;
    if (document.hidden || !moving()) return;
    const elapsed = previous ? now - previous : 16.7;
    const dt = Math.min(.04, elapsed / 1000);
    previous = now;
    t += dt;
    const scroll = scrollY;
    if (view === 'home') {
      artTarget.y = goalDocumentY - scroll;
      const delta = scroll - previousScroll;
      const energy = Math.min(1, Math.abs(delta) / (dt * 520 || 1));
      separation = Math.max(separation, Math.min(1, Math.abs(delta) / 36) * .86);
      const response = energy > separation ? 25 : 4.4;
      separation += (energy - separation) * (1 - Math.exp(-response * dt));
      const wake = Math.max(-90, Math.min(90, delta * 7));
      scrollMomentum += (wake - scrollMomentum) * (1 - Math.exp(-9 * dt));
    }
    previousScroll = scroll;
    for (const key of ['x', 'y', 'rx', 'ry']) {
      art[key] += (artTarget[key] - art[key]) * Math.min(1, dt * 4);
    }
    for (let i = 0; i < 3; i++) current[i] += (desired[i] - current[i]) * .025;
    pull.x += ((pointer.active ? (pointer.x - width / 2) * .3 : 0) - pull.x) * .035;
    pull.y += ((pointer.active ? (pointer.y - height / 2) * .2 : 0) - pull.y) * .035;
    draw(dt);
    frameCost += elapsed;
    frameCount++;
    if (frameCount === 120) {
      if (frameCost / 120 > 25 && adaptive === 1) {
        adaptive = .6;
        body.dataset.particleQuality = 'adaptive';
      }
      body.dataset.lumenFrameMs = (frameCost / 120).toFixed(1);
      frameCost = 0;
      frameCount = 0;
    }
    raf = requestAnimationFrame(frame);
  }
  function burst(p,{to=null,color=0,count=24}={}){if(!moving())return;const n=Math.round(count*(quality==='calm'?.5:1)*strength());for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=25+Math.random()*90;bursts.push({x:p.x,y:p.y,to,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1+Math.random()*.7,start:t,size:4+Math.random()*8,sprite:color});}if(bursts.length>220)bursts.splice(0,bursts.length-220);}
  function ripple(p,color='172,239,205',radius=90){if(!moving())return;ripples.push({...p,color,radius,start:t,life:1.05});if(ripples.length>8)ripples.shift();}
  function connect(a,b,color=0){if(!moving())return;links.push({a,b,mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},color:color===2?'245,204,154':'164,240,210',sprite:color,start:t,life:1.1});if(links.length>8)links.shift();}
  function animate(node,frames,options){if(moving()&&node?.animate)node.animate(frames,options).finished.catch(()=>{});}
  let shineFrame=0;const face=$('#study-face');face.addEventListener('pointermove',e=>{if(shineFrame||!moving())return;const x=e.clientX,y=e.clientY;shineFrame=requestAnimationFrame(()=>{const r=face.getBoundingClientRect();face.style.setProperty('--light-x',((x-r.left)/r.width*100)+'%');face.style.setProperty('--light-y',((y-r.top)/r.height*100)+'%');shineFrame=0;});},{passive:true});
  addEventListener('resize', () => {
    if (innerWidth !== width || !moving()) reset();
    else layout(); // Mobile browser bars may change the height during a swipe.
  });
  addEventListener('scroll', () => {
    if (moving() || view !== 'home') return;
    artTarget.y = goalDocumentY - scrollY;
    draw(0);
  }, {passive: true});

  function movePointer(x, y) {
    pointer.x = x;
    pointer.y = y;
    pointer.active = true;
  }
  function releasePointer() {
    pointer.active = false;
  }
  document.addEventListener('pointermove', event => {
    if (event.pointerType !== 'touch') movePointer(event.clientX, event.clientY);
    if (drag) {
      pull.x += (event.clientX - drag.x) * .03;
      pull.y += (event.clientY - drag.y) * .02;
    }
  }, {passive: true});
  document.addEventListener('pointerleave', releasePointer);
  addEventListener('blur', releasePointer);

  // Touch events keep reporting contact during native scrolling, when pointer events may be cancelled.
  function followTouch(event) {
    if (event.touches.length !== 1) {
      releasePointer();
      return;
    }
    const touch = event.touches[0];
    movePointer(touch.clientX, touch.clientY);
  }
  document.addEventListener('touchstart', followTouch, {passive: true});
  document.addEventListener('touchmove', followTouch, {passive: true});
  document.addEventListener('touchend', releasePointer, {passive: true});
  document.addEventListener('touchcancel', releasePointer, {passive: true});
  $('#study-face').addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};},{passive:true});document.addEventListener('pointerup',()=>drag=null,{passive:true});document.addEventListener('pointercancel',()=>drag=null,{passive:true});
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled||!moving())return;
    // Everyday controls stay tactile, without launching the celebration system.
    if(!b.closest('#english,#chinese,.study-ratings')&&b.id!=='study-flip')animate(b,[{transform:'scale(.97)'},{transform:'scale(1)'}],{duration:190,easing:'ease-out'});
    if(b.id==='study-flip'&&!$('#study-details').hidden){animate($('#study-details'),[{opacity:0,transform:'perspective(700px) rotateX(-16deg)',transformOrigin:'top'},{opacity:1,transform:'perspective(700px) rotateX(0deg)',transformOrigin:'top'}],{duration:420,easing:'cubic-bezier(.2,.8,.2,1)'});animate(face,[{boxShadow:'inset 0 1px 0 #cdf9df88'},{boxShadow:'inset 0 1px 0 #cdf9df18'}],{duration:650});}
    if(b.closest('.words'))animate($('.detail'),[{opacity:.25,transform:'translateX(8px)'},{opacity:1,transform:'translateX(0)'}],{duration:240,easing:'ease-out'});
  });
  document.addEventListener('lumen-recall',e=>{const p=center(face),known=e.detail===3;if(known)burst({x:p.x,y:p.y-30},{to:center($('#study-progress')),count:22});else animate(face,[{borderColor:'#cfb28e80'},{borderColor:'#b6e6cd30'}],{duration:500});});
  document.addEventListener('lumen-match',e=>{connect(center(e.detail.from),center(e.detail.to));for(const el of [e.detail.from,e.detail.to])animate(el,[{boxShadow:'inset 0 0 28px #9be0c536',transform:'scale(1.02)'},{boxShadow:'inset 0 0 0 #9be0c500',transform:'scale(1)'}],{duration:600});});
  document.addEventListener('spelling-answered',e=>{const el=$('#spell-form');if(e.detail.correct){document.querySelectorAll('#typed-letters .letter').forEach((letter,i)=>animate(letter,[{transform:'translateY(0)',color:'#eaffdc'},{transform:'translateY(-5px)',color:'#b9f1cc'},{transform:'translateY(0)'}],{duration:310,delay:i*28}));}else animate(el,[{transform:'translateX(0)'},{transform:'translateX(-3px)'},{transform:'translateX(3px)'},{transform:'translateX(0)'}],{duration:230});});
  let sceneAnimation=null,lastView=view;
  document.addEventListener('studio-view-changed',()=>{view=body.dataset.view;desired=palettes[view]||palettes.home;if(view!==lastView){separation=0;scrollMomentum=0;previousScroll=scrollY;if(view==='home')for(const particle of orbitParticles)particle.x=particle.y=null;}layout();const order=['home','study','practice','translate','collection','browse','mistakes'],direction=order.indexOf(view)>=order.indexOf(lastView)?1:-1;lastView=view;const next=$('#exercise-layout:not([hidden])')||$('#learning-home:not([hidden])')||$('#practice-hub:not([hidden])')||$('#mistake-workspace:not([hidden])')||$('#translation:not([hidden])')||$('#personal-collection:not([hidden])');sceneAnimation?.cancel();if(moving()&&next)sceneAnimation=next.animate([{opacity:.15,transform:`translateX(${direction*20}px)`},{opacity:1,transform:'translateX(0)'}],{duration:380,easing:'cubic-bezier(.2,.8,.2,1)'});if(!moving()){art={...artTarget};draw(0);}});
  function celebrate(el){if(!moving())return;const p=center(el);blooms.push({...p,start:t,life:2.4});if(blooms.length>2)blooms.shift();burst(p,{count:65});}
  for(const el of [$('#session-summary'),$('.practice-summary')].filter(Boolean))new MutationObserver(()=>{if(!el.hidden)celebrate(el);}).observe(el,{attributes:true,attributeFilter:['hidden']});
  const observer=new MutationObserver(()=>{layout();if(!moving())draw(0);});observer.observe($('#study-details'),{attributes:true,attributeFilter:['hidden']});
  document.addEventListener('visibilitychange',reset);reduced.addEventListener('change',reset);$('#space-motion-toggle').addEventListener('change',reset);$('#lumen-quality').onchange=e=>{quality=e.target.value;adaptive=1;try{localStorage.setItem('word-accumulator.lumen-quality',quality);}catch{}reset();};

  document.querySelectorAll('dialog').forEach(d=>new MutationObserver(()=>{if(d.open&&d.id==='match-celebration')celebrate(d);if(d.open)animate(d,[{opacity:0,transform:'translateY(22px) scale(.97)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:400,easing:'cubic-bezier(.16,1,.3,1)'});}).observe(d,{attributes:true,attributeFilter:['open']}));
  reset();
})();
