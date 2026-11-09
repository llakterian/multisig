import React, { useState } from "react";
import { motion } from "motion/react";
import { cn } from "../lib/utils";

const themes = {
  black: { backFill:"black", backInsetColor:"0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.37 0", backInsetShadow:"inset 0 0 6px 2px rgba(255,255,255,0.37)", flapFill:"#292929", flapFillOpacity:0.25, flapStroke:"#979797", flapInsetColor:"0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.08 0", cardFill:"#F1F1F1", cardStroke:"#E0E0E0", cardLineFill:"#D4D4D4", cardInsetColor:"0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0" },
  white: { backFill:"#ffffff", backInsetColor:"0 0 0 0 0.7 0 0 0 0 0.7 0 0 0 0 0.7 0 0 0 0.25 0", backInsetShadow:"inset 0 0 6px 2px rgba(178,178,178,0.25)", flapFill:"#f5f5f5", flapFillOpacity:0.85, flapStroke:"#d4d4d4", flapInsetColor:"0 0 0 0 0.6 0 0 0 0 0.6 0 0 0 0 0.6 0 0 0 0.15 0", cardFill:"#262626", cardStroke:"#404040", cardLineFill:"#737373", cardInsetColor:"0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.15 0" },
  blue:  { backFill:"#50B1FD", backInsetColor:"0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.35 0", backInsetShadow:"inset 0 0 6px 2px rgba(255,255,255,0.35)", flapFill:"#3a9ae8", flapFillOpacity:0.45, flapStroke:"#7ec8ff", flapInsetColor:"0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.12 0", cardFill:"#F1F1F1", cardStroke:"#E0E0E0", cardLineFill:"#D4D4D4", cardInsetColor:"0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0" },
  dossier:{ backFill:"#1f4d45", backInsetColor:"0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.22 0", backInsetShadow:"inset 0 0 8px 2px rgba(255,255,255,0.18)", flapFill:"#173d36", flapFillOpacity:0.55, flapStroke:"#6f9b92", flapInsetColor:"0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.10 0", cardFill:"#fffdfa", cardStroke:"#d8d1c7", cardLineFill:"#ddd6cb", cardInsetColor:"0 0 0 0 0.5 0 0 0 0 0.45 0 0 0 0 0.4 0 0 0 0.18 0" },
};
const sizeScales = { sm:0.45, md:0.72, lg:1 };
const BASE_WIDTH = 321, BASE_HEIGHT = 270;
const FLAP_PATH = "M0 25C0 11.1929 11.1929 0 25 0H136.084C143.044 0 149.689 2.90139 154.42 8.00608L178.08 33.5343C182.811 38.639 189.456 41.5404 196.416 41.5404H296C309.807 41.5404 321 52.7333 321 66.5404V216C321 229.807 309.807 241 296 241H25C11.1929 241 0 229.807 0 216V25Z";

const Card = ({ id, theme }) => {
  const filterId = `filter0_i_card_${id}`;
  return (
    <div data-slot="folder-card">
      <svg width="164" height="214" viewBox="0 0 164 214" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g filter={`url(#${filterId})`}><rect width="163.078" height="213.262" rx="20" fill={theme.cardFill}/></g>
        <rect x="0.5" y="0.5" width="162.078" height="212.262" rx="19.5" stroke={theme.cardStroke}/>
        <rect x="14.1193" y="31.2091" width="134.84" height="11.8892" rx="5.94459" fill={theme.cardLineFill}/>
        {[60.99,75.11,89.23,103.35,117.47,131.59,145.7,159.82,173.94].flatMap((y,i)=>[
          <rect key={`${id}-${i}-l`} width="64.5183" height="5.88276" rx="2.94138" transform={`matrix(1 -0.000409158 0.00201956 0.999998 14.8253 ${y})`} fill={theme.cardLineFill}/>,
          <rect key={`${id}-${i}-r`} width="64.5183" height="5.88276" rx="2.94138" transform={`matrix(1 -0.000461045 0.00179228 0.999998 84.4303 ${y-0.032})`} fill={theme.cardLineFill}/>,
        ])}
        <defs>
          <filter id={filterId} x="0" y="0" width="166.078" height="218.262" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feFlood floodOpacity="0" result="BackgroundImageFix"/><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
            <feMorphology radius="2" operator="erode" in="SourceAlpha" result={`e-${id}`}/><feOffset dx="3" dy="5"/><feGaussianBlur stdDeviation="3.05"/>
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/><feColorMatrix type="matrix" values={theme.cardInsetColor}/>
            <feBlend mode="normal" in2="shape" result={`e-${id}`}/>
          </filter>
        </defs>
      </svg>
    </div>
  );
};

export default function Folder({ color="dossier", size="md", label, className, ...props }) {
  const theme = themes[color] ?? themes.dossier;
  const scale = sizeScales[size] ?? 0.72;
  const [isHovered, setIsHovered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div data-slot="folder" className={cn("relative w-full h-full flex flex-col items-center justify-center", className)} {...props}>
      <div className="relative cursor-pointer select-none" style={{ width: BASE_WIDTH*scale, height: BASE_HEIGHT*scale, touchAction:"manipulation", WebkitTapHighlightColor:"transparent" }}
        onMouseEnter={()=>setIsHovered(true)} onMouseLeave={()=>{setIsHovered(false); setIsOpen(false)}} onClick={()=>setIsOpen(o=>!o)}>
        <div className="absolute top-1/2 left-1/2" style={{ width:BASE_WIDTH, height:BASE_HEIGHT, transform:`translate(-50%, -50%) scale(${scale})`, perspective:800*scale }}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"><div style={{ width:BASE_WIDTH, height:BASE_HEIGHT, borderRadius:25, backgroundColor:theme.backFill, boxShadow:theme.backInsetShadow }}/></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
            <motion.div className="absolute" animate={{ y:isOpen?-160:isHovered?-30:-10, x:isOpen?70:40, rotate:isOpen?18:isHovered?14:10 }} transition={{ type:"spring", stiffness:120, damping:13, delay:isOpen?0.1:isHovered?0.12:0 }}><Card id={`${label}-1`} theme={theme}/></motion.div>
            <motion.div className="absolute" animate={{ y:isOpen?-180:isHovered?-35:-20, x:isOpen?0:3, rotate:isOpen?-3:isHovered?-1:2 }} transition={{ type:"spring", stiffness:120, damping:13, delay:isOpen?0.05:isHovered?0.06:0 }}><Card id={`${label}-2`} theme={theme}/></motion.div>
            <motion.div className="absolute" animate={{ y:isOpen?-170:isHovered?-44:-22, x:isOpen?-65:-40, rotate:isOpen?-14:isHovered?-9:-5 }} transition={{ type:"spring", stiffness:120, damping:13, delay:0 }}><Card id={`${label}-3`} theme={theme}/></motion.div>
          </div>
          <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-4" style={{ transformOrigin:"bottom center", transformStyle:"preserve-3d", width:321, height:241 }} animate={{ rotateX:isOpen?-55:isHovered?-45:-15 }} transition={{ type:"spring", stiffness:120, damping:14 }}>
            <div className="absolute inset-0" style={{ backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)", clipPath:`path('${FLAP_PATH}')`, WebkitClipPath:`path('${FLAP_PATH}')`, transform:"translateZ(0)" }}/>
            <svg className="absolute inset-0" width="321" height="241" viewBox="0 0 321 241" fill="none"><g><path d={FLAP_PATH} fill={theme.flapFill} fillOpacity={theme.flapFillOpacity}/><path d="M25 0.5H136.084C142.905 0.5 149.417 3.3431 154.054 8.3457L177.713 33.874C182.539 39.0808 189.317 42.04 196.416 42.04H296C309.531 42.04 320.5 53.0092 320.5 66.54V216C320.5 229.531 309.531 240.5 296 240.5H25C11.469 240.5 0.5 229.531 0.5 216V25C0.5 11.469 11.469 0.5 25 0.5Z" stroke={theme.flapStroke}/></g></svg>
          </motion.div>
        </div>
      </div>
      {label && <div style={{marginTop:8, fontFamily:'ui-sans-serif,system-ui,sans-serif', fontSize:13, color:'#5f5a54'}}>{label}</div>}
    </div>
  );
}
