import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { ACTIVITY_THROTTLE_MS, LOGOUT_EVENT_KEY, SESSION_TIMEOUT_MS, SESSION_WARNING_MS } from "@/config/session";
export function SessionTimeout(){
 const{isAuthenticated,logout}=useAuth(),[remaining,setRemaining]=useState(0),[warning,setWarning]=useState(false),last=useRef(0),warningTimer=useRef<number>(),logoutTimer=useRef<number>(),interval=useRef<number>();
 const clear=useCallback(()=>{window.clearTimeout(warningTimer.current);window.clearTimeout(logoutTimer.current);window.clearInterval(interval.current)},[]);
 const end=useCallback(()=>{clear();localStorage.setItem(LOGOUT_EVENT_KEY,String(Date.now()));logout();},[clear,logout]);
 const reset=useCallback(()=>{if(!isAuthenticated)return;clear();setWarning(false);warningTimer.current=window.setTimeout(()=>{setWarning(true);setRemaining(Math.ceil(SESSION_WARNING_MS/1000));interval.current=window.setInterval(()=>setRemaining(v=>Math.max(0,v-1)),1000)},Math.max(0,SESSION_TIMEOUT_MS-SESSION_WARNING_MS));logoutTimer.current=window.setTimeout(end,SESSION_TIMEOUT_MS)},[clear,end,isAuthenticated]);
 useEffect(()=>{if(!isAuthenticated){clear();return}reset();const activity=()=>{const now=Date.now();if(now-last.current>=ACTIVITY_THROTTLE_MS){last.current=now;reset()}};const sync=(e:StorageEvent)=>{if(e.key===LOGOUT_EVENT_KEY)logout()};["click","keydown","pointermove","popstate"].forEach(e=>window.addEventListener(e,activity));window.addEventListener("storage",sync);return()=>{clear();["click","keydown","pointermove","popstate"].forEach(e=>window.removeEventListener(e,activity));window.removeEventListener("storage",sync)}},[clear,isAuthenticated,logout,reset]);
 if(!warning)return null;return <div role="dialog" aria-label="Sesión próxima a expirar" className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/50"><div className="rounded-2xl bg-white p-6 shadow-xl"><h2 className="text-lg font-semibold">Sesión próxima a expirar</h2><p className="mt-2">Se cerrará en {remaining} segundos por inactividad.</p><div className="mt-5 flex gap-3"><Button onClick={reset}>Continuar sesión</Button><Button variant="outline" onClick={end}>Cerrar sesión</Button></div></div></div>;
}
