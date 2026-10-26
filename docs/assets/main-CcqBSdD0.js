import{i as e,t}from"./jsx-runtime-EIAPxkjE.js";import{t as n}from"./react-BPk_wmJm.js";import{dt as r,ft as i,j as a,n as o,t as s}from"./use-reduced-motion-apJt7Tao.js";import{t as c}from"./use-transform-Dgn_qW5E.js";import{t as l}from"./use-spring-ESK6oQgi.js";import{t as u}from"./use-motion-value-ClE-0i30.js";import{t as d}from"./react-Bainpy4A.js";import{a as f}from"./ease-CIW3z5WL.js";import{t as p}from"./utils-D0T3A-kS.js";var m=e(n(),1);function h(e){let t=(0,m.useRef)(0),{isStatic:n}=(0,m.useContext)(o);(0,m.useEffect)(()=>{if(n)return;let a=({timestamp:n,delta:r})=>{t.current||=n,e(n-t.current,r)};return i.update(a,!0),()=>r(a)},[e])}var g=`
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`,_=`
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_activity;
uniform vec3 u_base;
uniform vec3 u_light;
uniform vec3 u_dark;

float hash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                 mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                 mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  return noise(p) * 0.57 + noise(p * 2.03 + 7.2) * 0.28 + noise(p * 4.07 + 3.1) * 0.15;
}
void main() {
  vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.38;
  float angle = atan(p.y, p.x);
  float breath = sin(u_time * 1.4) * 0.008;
  float ripple = sin(angle * 3.0 + t * 2.1) * 0.55
               + sin(angle * 5.0 - t * 1.7) * 0.30
               + sin(angle * 2.0 + t) * 0.15;
  p /= 0.91 + breath + u_activity * 0.025
       + ripple * (0.004 + u_activity * 0.024);
  float r2 = dot(p, p);
  float aa = 3.0 / min(u_resolution.x, u_resolution.y);
  float alpha = 1.0 - smoothstep(1.0 - aa, 1.0, r2);
  if (alpha <= 0.0) { gl_FragColor = vec4(0.0); return; }
  vec3 normal = vec3(p, sqrt(max(0.0, 1.0 - r2)));
  vec3 flow = vec3(normal.xy * 1.65, normal.z * 1.4);
  flow.xy += vec2(sin(normal.y * 2.6 + t), cos(normal.x * 2.3 - t * 0.8))
             * (0.25 + u_activity * 0.22);
  vec3 warp = vec3(noise(flow + vec3(0.0, t, t * 0.3)),
                   noise(flow + vec3(4.7, -t * 0.7, t)),
                   noise(flow + vec3(t * 0.5, 9.2, -t))) - 0.5;
  float pigment = fbm(flow + warp * 1.4 + vec3(t * 0.3, -t * 0.2, t * 0.4));
  float fold = normal.x * 0.50 + normal.y * 0.32
             + sin(normal.y * 2.6 - t) * 0.30 + (pigment - 0.5) * 0.65;
  float shadow = smoothstep(-0.30, 0.42, fold);
  vec3 color = mix(u_dark, u_base, shadow);
  color = mix(color, u_light, smoothstep(0.40, 0.82, pigment) * 0.34);
  float diffuse = max(0.0, dot(normal, normalize(vec3(-0.4, 0.65, 1.0))));
  color *= 0.64 + 0.46 * diffuse;
  float shine = exp(-pow((fold + 0.06) * 8.0, 2.0)) * pow(normal.z, 0.65);
  float innerLight = exp(-pow((fold - 0.28) * 4.0, 2.0)) * normal.z;
  color = mix(color, u_light, innerLight * (0.18 + u_activity * 0.16));
  color = mix(color, mix(u_light, vec3(1.0), 0.55), shine * 0.78);
  float gleam = pow(max(0.0, dot(normal, normalize(vec3(-0.45, 0.55, 1.0)))), 24.0);
  color += gleam * 0.16;
  float rim = pow(1.0 - normal.z, 3.0);
  color = mix(color, u_light, rim * (0.36 + 0.25 * max(0.0, -normal.x)));
  float grain = hash(vec3(gl_FragCoord.xy, 1.0)) - 0.5;
  color += grain * 0.032;
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), alpha);
}
`;function v(e){let t=/^#([\da-f])([\da-f])([\da-f])$/i.exec(e),n=t?`#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`:e;if(!/^#[\da-f]{6}$/i.test(n))throw Error(`VoiceOrb colors must be #RGB or #RRGGBB hex colors.`);let r=Number.parseInt(n.slice(1),16);return[(r>>16&255)/255,(r>>8&255)/255,(r&255)/255]}function y(e,t,n){let r=e.getContext(`webgl`,{alpha:!0,antialias:!1,premultipliedAlpha:!1,powerPreference:`low-power`});if(!r)throw Error(`WebGL is unavailable in this browser.`);let i=!1,a=0,o=0,s=0,c=!0,l=!1,u=!1,d=null,f=null,p=[],m={},h=null,y={width:e.clientWidth,height:e.clientHeight},b=()=>{f&&r.deleteBuffer(f),d&&r.deleteProgram(d);for(let e of p)r.deleteShader(e);f=null,d=null,p=[]},x=()=>{let e=(e,t)=>{let n=r.createShader(e);if(!n)throw Error(`Could not allocate an orb shader.`);if(p.push(n),r.shaderSource(n,t),r.compileShader(n),!r.getShaderParameter(n,r.COMPILE_STATUS))throw Error(r.getShaderInfoLog(n)||`Could not compile the orb shader.`);return n},t=e(r.VERTEX_SHADER,g),n=e(r.FRAGMENT_SHADER,_);if(d=r.createProgram(),!d)throw Error(`Could not allocate the orb program.`);if(r.attachShader(d,t),r.attachShader(d,n),r.linkProgram(d),!r.getProgramParameter(d,r.LINK_STATUS))throw Error(r.getProgramInfoLog(d)||`Could not link the orb program.`);if(r.useProgram(d),f=r.createBuffer(),!f)throw Error(`Could not allocate the orb buffer.`);r.bindBuffer(r.ARRAY_BUFFER,f),r.bufferData(r.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),r.STATIC_DRAW);let i=r.getAttribLocation(d,`a_position`);r.enableVertexAttribArray(i),r.vertexAttribPointer(i,2,r.FLOAT,!1,0,0),m=Object.fromEntries([`u_resolution`,`u_time`,`u_activity`,`u_base`,`u_light`,`u_dark`].map(e=>[e,r.getUniformLocation(d,e)])),h=null},S=()=>{cancelAnimationFrame(a),a=0,s=0},C=d=>{if(a=0,i||l||!c||document.hidden)s=0;else try{let n=t();n.animated&&s&&(o+=Math.min(.05,(d-s)/1e3)*n.speed*(1+n.activity*.6)),s=n.animated?d:0;let i=Math.min(window.devicePixelRatio||1,2),c=Math.max(1,Math.round(y.width*i)),l=Math.max(1,Math.round(y.height*i));if((e.width!==c||e.height!==l)&&(e.width=c,e.height=l),r.viewport(0,0,c,l),r.uniform2f(m.u_resolution??null,c,l),r.uniform1f(m.u_time??null,o),r.uniform1f(m.u_activity??null,n.activity),!h||h.some((e,t)=>e!==n.colors[t])){let e=n.colors.map(v);r.uniform3fv(m.u_base??null,e[0]),r.uniform3fv(m.u_light??null,e[1]),r.uniform3fv(m.u_dark??null,e[2]),h=n.colors}r.drawArrays(r.TRIANGLES,0,6),n.animated&&(a=requestAnimationFrame(C))}catch(e){u=!0,S(),n(e instanceof Error?e:Error(String(e)))}},w=()=>{i||l||u||!c||document.hidden||a||(a=requestAnimationFrame(C))},T=()=>{document.hidden?S():w()},E=e=>{e.preventDefault(),l=!0,S()},D=()=>{try{b(),x(),l=!1,w()}catch(e){n(e instanceof Error?e:Error(String(e)))}};try{x()}catch(e){throw b(),e}let O=new ResizeObserver(([e])=>{e&&(y={width:e.contentRect.width,height:e.contentRect.height}),w()});O.observe(e);let k=new IntersectionObserver(([e])=>{c=e?.isIntersecting??!0,c?w():S()});return k.observe(e),e.addEventListener(`webglcontextlost`,E),e.addEventListener(`webglcontextrestored`,D),document.addEventListener(`visibilitychange`,T),w(),{requestDraw:w,dispose:()=>{i=!0,S(),O.disconnect(),k.disconnect(),e.removeEventListener(`webglcontextlost`,E),e.removeEventListener(`webglcontextrestored`,D),document.removeEventListener(`visibilitychange`,T),b()}}}var b=t(),x=[`#e8754d`,`#ffe0ac`,`#346b52`],S=e=>Number.isFinite(e)?Math.max(0,Math.min(1,e)):0;function C({activity:e=0,analyser:t=null,colors:n=x,active:r=!0,speed:i=1,onError:o,className:h,style:g,"aria-label":_,...v}){let C=s(),w=(0,m.useRef)(null),T=(0,m.useRef)(null),[E,D]=(0,m.useState)(null),O=u(0),k=l(O,f),A=c(k,e=>`translate3d(0, ${-e*2}px, 0) scale(${1+e*.04}, ${1-e*.018})`),j=(0,m.useRef)({activity:e,analyser:t,colors:n,active:r,speed:i,reducedMotion:C,onError:o});return(0,m.useLayoutEffect)(()=>{j.current={activity:e,analyser:t,colors:n,active:r,speed:i,reducedMotion:C,onError:o};let s=r&&!C?S(a(e)?e.get():e):0;C?(k.jump(0),O.set(0)):O.set(s),T.current?.requestDraw()}),(0,m.useEffect)(()=>{if(a(e))return e.on(`change`,e=>{j.current.active&&!j.current.reducedMotion&&O.set(S(e)),T.current?.requestDraw()})},[e,O]),(0,m.useEffect)(()=>k.on(`change`,()=>T.current?.requestDraw()),[k]),(0,m.useEffect)(()=>{let e=w.current;if(!e)return;let t=null,n=null,r=e=>{D(e),j.current.onError?.(e)};try{T.current=y(e,()=>{let e=j.current;if(e.analyser&&e.active&&!e.reducedMotion&&((n!==e.analyser||t?.length!==e.analyser.fftSize)&&(n=e.analyser,t=new Uint8Array(new ArrayBuffer(e.analyser.fftSize))),t)){e.analyser.getByteTimeDomainData(t);let n=0;for(let e of t)n+=((e-128)/128)**2;O.set(S(Math.sqrt(n/t.length)*3))}return{activity:e.active&&!e.reducedMotion?S(k.get()):0,colors:e.colors,speed:Number.isFinite(e.speed)?Math.max(0,e.speed):1,animated:e.active&&!e.reducedMotion&&(e.speed>0||!!e.analyser)}},r)}catch(e){r(e instanceof Error?e:Error(String(e)))}return()=>{T.current?.dispose(),T.current=null}},[k,O]),(0,b.jsx)(`div`,{...v,role:`img`,"aria-label":_,"aria-hidden":!_||void 0,"data-slot":`voice-orb`,"data-render-state":E?`error`:`ready`,className:p(`relative aspect-square w-64 shrink-0`,h),style:g,children:E?(0,b.jsx)(`div`,{className:`flex size-full items-center justify-center rounded-full border border-border bg-card p-8 text-center text-xs text-muted-foreground`,children:`Orb rendering unavailable`}):(0,b.jsx)(d.div,{className:`size-full`,style:{transform:C?`none`:A},children:(0,b.jsx)(`canvas`,{ref:w,className:`block size-full`})})})}function w(){let e=u(0),t=s();return h(n=>{if(t){e.set(0);return}let r=n/1e3,i=Math.max(0,Math.sin(r*.85)),a=Math.max(0,Math.sin(r*9.3+Math.sin(r*2.1)));e.set(i*(.12+a**2*.72))}),(0,b.jsx)(C,{activity:e,"aria-label":`Voice visualization`,className:`w-64 sm:w-72`})}function T(){return(0,b.jsx)(w,{})}export{T as default};