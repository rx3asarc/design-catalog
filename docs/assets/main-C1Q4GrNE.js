import{r as e}from"./rolldown-runtime-XKyaHtl9.js";import{i as t,n}from"./index-DpjrnHJa.js";import{n as r,t as i}from"./sun-Dhcefti6.js";import{t as a}from"./use-reduced-motion-ChkLaFGy.js";import{i as o}from"./ease-CIW3z5WL.js";import{t as s}from"./utils-D0T3A-kS.js";import{n as c}from"./action-swap-De5hWbDZ.js";import{t as l}from"./dist-DClb_mH5.js";var u=e(t(),1),d=n(),f=`beui-theme-toggle-vt`,p=`
html[data-beui-vt="rect"]::view-transition-old(root) {
  animation: none;
  mix-blend-mode: normal;
}
html[data-beui-vt="rect"]::view-transition-new(root) {
  mix-blend-mode: normal;
  animation: beui-rect-reveal 400ms ease-out;
}
html[data-beui-vt="circle"]::view-transition-old(root),
html[data-beui-vt="circle-blur"]::view-transition-old(root) {
  animation: none;
  mix-blend-mode: normal;
}
html[data-beui-vt="circle"]::view-transition-new(root) {
  mix-blend-mode: normal;
  animation: beui-circle-reveal 700ms cubic-bezier(0.4, 0, 0.2, 1);
}
html[data-beui-vt="circle-blur"]::view-transition-new(root) {
  mix-blend-mode: normal;
  animation: beui-circle-blur-reveal 700ms cubic-bezier(0.4, 0, 0.2, 1);
}
html[data-beui-vt="blinds"]::view-transition-old(root) {
  animation: none;
  mix-blend-mode: normal;
}
/* Slats: a masked band widens inside every 72px tile, so the new theme opens
   across the page like a shutter. The band edge has to be a registered custom
   property — mask-image itself is not animatable, but it re-resolves every
   frame the property ticks. mask-size fixes the tile at 72px rather than
   letting a repeating gradient's last stop define it, which is what keeps the
   20px soft edge from dragging the tile wider than the slat and leaving a
   feathered gap that never closes; it also means both ends land clean, fully
   transparent at -20px and fully opaque at 72px. Falling back to no mask
   (unregistered property, so the var is invalid) reveals the page in one
   step. */
@property --beui-vt-slat {
  syntax: "<length>";
  inherits: false;
  initial-value: 72px;
}
html[data-beui-vt="blinds"]::view-transition-new(root) {
  mix-blend-mode: normal;
  mask-image: linear-gradient(
    90deg,
    #000 0 var(--beui-vt-slat),
    transparent calc(var(--beui-vt-slat) + 20px)
  );
  mask-size: 72px 100%;
  mask-repeat: repeat;
  animation: beui-blinds-reveal 700ms ${o};
}
@keyframes beui-rect-reveal {
  from { clip-path: var(--beui-vt-from, inset(100% 0 0 0)); }
  to   { clip-path: inset(0 0 0 0); }
}
@keyframes beui-circle-reveal {
  from { clip-path: circle(0% at var(--beui-vt-origin, 50% 100%)); }
  to   { clip-path: circle(150% at var(--beui-vt-origin, 50% 100%)); }
}
@keyframes beui-circle-blur-reveal {
  from { clip-path: circle(0% at var(--beui-vt-origin, 50% 100%)); filter: blur(8px); }
  to   { clip-path: circle(150% at var(--beui-vt-origin, 50% 100%)); filter: blur(0px); }
}
@keyframes beui-blinds-reveal {
  from { --beui-vt-slat: -20px; }
  to   { --beui-vt-slat: 72px; }
}
`,m={"top-left":`inset(0 100% 100% 0)`,"top-right":`inset(0 0 100% 100%)`,"bottom-left":`inset(100% 100% 0 0)`,"bottom-right":`inset(100% 0 0 100%)`,center:`inset(50% 50% 50% 50%)`,"bottom-up":`inset(100% 0 0 0)`},h={"top-left":`0% 0%`,"top-right":`100% 0%`,"bottom-left":`0% 100%`,"bottom-right":`100% 100%`,center:`50% 50%`,"bottom-up":`50% 100%`};function g({variant:e=`rectangle`,start:t=`bottom-up`}={}){let{setTheme:n,resolvedTheme:r}=l(),i=a()??!1,[o,s]=(0,u.useState)(!1);(0,u.useEffect)(()=>s(!0),[]),(0,u.useEffect)(()=>{if(document.getElementById(f))return;let e=document.createElement(`style`);e.id=f,e.textContent=p,document.head.appendChild(e)},[]);let c=o&&r===`dark`;return{isDark:c,mounted:o,toggle:()=>{let r=c?`light`:`dark`;if(i||!(`startViewTransition`in document)){n(r);return}let a=document.documentElement;e===`rectangle`?(a.style.setProperty(`--beui-vt-from`,m[t]),a.dataset.beuiVt=`rect`):e===`blinds`?a.dataset.beuiVt=`blinds`:(a.style.setProperty(`--beui-vt-origin`,h[t]),a.dataset.beuiVt=e),document.startViewTransition(()=>n(r)).finished.finally(()=>{delete a.dataset.beuiVt})}}}function _({variant:e=`rectangle`,start:t=`bottom-up`,className:n,iconClassName:a,...o}){let{isDark:l,mounted:u,toggle:f}=g({variant:e,start:t});return(0,d.jsx)(`button`,{type:`button`,"aria-label":u&&l?`Switch to light mode`:`Switch to dark mode`,onClick:f,className:s(`flex items-center justify-center`,n),...o,children:u?(0,d.jsx)(c,{value:l?`dark`:`light`,animation:`blur`,className:a,children:l?(0,d.jsx)(i,{className:a}):(0,d.jsx)(r,{className:a})}):(0,d.jsx)(`span`,{className:a,"aria-hidden":`true`})})}var v=[{variant:`rectangle`,label:`Rectangle`},{variant:`circle`,label:`Circle`},{variant:`circle-blur`,label:`Circle blur`},{variant:`blinds`,label:`Blinds`}];function y(){return(0,d.jsx)(`div`,{className:`flex h-full w-full items-center justify-center gap-5`,children:v.map(({variant:e,label:t})=>(0,d.jsxs)(`div`,{className:`flex flex-col items-center gap-2`,children:[(0,d.jsx)(_,{variant:e,start:`bottom-up`,className:`rounded-xl border border-border bg-background p-2.5`,iconClassName:`h-5 w-5`}),(0,d.jsx)(`span`,{className:`text-[11px] text-muted-foreground`,children:t})]},e))})}function b(){return(0,d.jsx)(y,{})}export{b as default};