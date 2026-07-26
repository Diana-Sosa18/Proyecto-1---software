import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight, BarChart3, Building2, CalendarCheck, Check, ChevronRight, Clock3,
  DatabaseBackup, FileSpreadsheet, KeyRound, Menu, MessageSquareText, ShieldCheck,
  UsersRound, WalletCards, X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { createDemoRequest, type DemoRequestPayload } from "@/services/demoRequestsService";

const nav = [
  ["Inicio", "inicio"], ["Funcionalidades", "funcionalidades"], ["Beneficios", "beneficios"],
  ["Roles", "roles"], ["Demostración", "demostracion"],
];

const features = [
  [KeyRound, "Accesos y visitas", "Autorizaciones, QR, horarios, tipos de visitante y observaciones desde un solo flujo."],
  [UsersRound, "Residentes e inquilinos", "Información de viviendas, usuarios y permisos vigentes con acceso según el rol."],
  [CalendarCheck, "Reservas de amenidades", "Disponibilidad, límites y prevención de reservas superpuestas."],
  [WalletCards, "Pagos y morosidad", "Cuotas, fechas límite, recargos automáticos y seguimiento de saldos pendientes."],
  [ShieldCheck, "Sanciones e historial", "Generación automática, trazabilidad, filtros y detalle de cada sanción."],
  [FileSpreadsheet, "Reportes PDF y Excel", "Exportaciones seguras de accesos, reservas, morosos y sanciones."],
  [DatabaseBackup, "Respaldos y restauración", "Programación, historial, descarga y recuperación controlada de información."],
  [Clock3, "Horarios configurables", "Reglas generales de visita aplicadas directamente desde el backend."],
  [BarChart3, "Paneles por rol", "Experiencias enfocadas para administración, residentes, inquilinos y guardias."],
];

const roles = [
  ["Administrador", "Gestiona residentes, pagos, morosos, recargos, sanciones, reservas, reportes, horarios y respaldos."],
  ["Residente", "Autoriza visitas y consulta accesos, amenidades, reservas y su resumen mensual."],
  ["Inquilino", "Gestiona permisos, proveedores y autorizaciones vinculadas a su vivienda."],
  ["Guardia", "Consulta autorizaciones, tipos de visitante, observaciones y registra ingresos."],
];

const initialForm: DemoRequestPayload = {
  nombre: "", correo: "", telefono: "", residencial: "", cantidadViviendas: 0,
  mensaje: "", aceptaContacto: false, sitioWeb: "",
};

function Brand() {
  return <span className="inline-flex items-center gap-2 font-semibold tracking-tight text-slate-950"><span className="grid size-9 place-items-center rounded-xl bg-blue-700 text-white"><Building2 className="size-5" /></span>NexusResidencial</span>;
}

function DemoForm() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const update = (field: keyof DemoRequestPayload, value: string | number | boolean) => setForm((current) => ({ ...current, [field]: value }));
  const validate = () => {
    const next: Record<string, string> = {};
    if (form.nombre.trim().length < 2) next.nombre = "Ingresa tu nombre completo.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo.trim())) next.correo = "Ingresa un correo válido.";
    if (!/^[+\d][\d\s()-]{6,24}$/.test(form.telefono.trim())) next.telefono = "Ingresa un teléfono válido.";
    if (form.residencial.trim().length < 2) next.residencial = "Ingresa el nombre del residencial.";
    if (!Number.isInteger(Number(form.cantidadViviendas)) || Number(form.cantidadViviendas) < 1 || Number(form.cantidadViviendas) > 100000) next.cantidadViviendas = "Indica una cantidad entre 1 y 100000.";
    if (form.mensaje.length > 1000) next.mensaje = "El mensaje no puede superar 1000 caracteres.";
    if (!form.aceptaContacto) next.aceptaContacto = "Debes aceptar el contacto.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (status === "sending" || !validate()) return;
    setStatus("sending"); setMessage("");
    try {
      await createDemoRequest({ ...form, cantidadViviendas: Number(form.cantidadViviendas) });
      setStatus("success"); setMessage("¡Gracias por tu interés! Recibimos tu solicitud y nos pondremos en contacto contigo.");
      setForm(initialForm);
    } catch (error) {
      setStatus("error"); setMessage(error instanceof Error ? error.message : "No fue posible enviar la solicitud. Inténtalo nuevamente.");
    }
  };
  const fieldClass = "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100";
  return (
    <form onSubmit={submit} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl shadow-blue-950/10 sm:p-8" noValidate>
      <div className="mb-6"><p className="text-sm font-semibold uppercase tracking-[.18em] text-blue-700">Hablemos de tu comunidad</p><h3 className="mt-2 text-2xl font-semibold text-slate-950">Solicita una demostración</h3></div>
      {message && <div role="status" className={`mb-5 rounded-xl p-4 text-sm ${status === "success" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{message}</div>}
      <div className="grid gap-5 sm:grid-cols-2">
        {[
          ["nombre", "Nombre completo", "text", "María López"],
          ["correo", "Correo electrónico", "email", "maria@residencial.com"],
          ["telefono", "Teléfono", "tel", "+502 5555 5555"],
          ["residencial", "Residencial o condominio", "text", "Condominio Las Flores"],
        ].map(([name, label, type, placeholder]) => <label key={name} className="text-sm font-medium text-slate-700">{label}<input id={`demo-${name}`} className={fieldClass} type={type} placeholder={placeholder} value={String(form[name as keyof DemoRequestPayload])} onChange={(e) => update(name as keyof DemoRequestPayload, e.target.value)} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : undefined}/>{errors[name] && <span id={`${name}-error`} className="mt-1 block text-xs text-rose-600">{errors[name]}</span>}</label>)}
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">Cantidad aproximada de viviendas<input className={fieldClass} type="number" min="1" max="100000" value={form.cantidadViviendas || ""} onChange={(e) => update("cantidadViviendas", Number(e.target.value))}/>{errors.cantidadViviendas && <span className="mt-1 block text-xs text-rose-600">{errors.cantidadViviendas}</span>}</label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">Mensaje <span className="font-normal text-slate-400">(opcional)</span><textarea className={`${fieldClass} min-h-28 resize-y`} maxLength={1000} value={form.mensaje} onChange={(e) => update("mensaje", e.target.value)}/><span className="mt-1 block text-right text-xs text-slate-400">{form.mensaje.length}/1000</span></label>
        <label className="absolute -left-[10000px]" aria-hidden="true">Sitio web<input tabIndex={-1} autoComplete="off" value={form.sitioWeb} onChange={(e) => update("sitioWeb", e.target.value)}/></label>
        <label className="flex items-start gap-3 text-sm text-slate-600 sm:col-span-2"><input className="mt-1 size-4 accent-blue-700" type="checkbox" checked={form.aceptaContacto} onChange={(e) => update("aceptaContacto", e.target.checked)}/><span>Acepto que utilicen estos datos para responder mi solicitud. Consulta la <Link className="font-medium text-blue-700 underline" to="/privacidad">política de privacidad</Link>.</span></label>
        {errors.aceptaContacto && <p className="-mt-3 text-xs text-rose-600 sm:col-span-2">{errors.aceptaContacto}</p>}
      </div>
      <button disabled={status === "sending"} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3.5 font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:opacity-60">{status === "sending" ? "Enviando…" : "Solicitar demostración"}<ArrowRight className="size-4"/></button>
    </form>
  );
}

export function LandingView() {
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { document.title = "NexusResidencial | Administración inteligente para residenciales"; }, []);
  const go = (id: string) => {
    setMenuOpen(false);
    const target = document.getElementById(id);
    if (target && typeof target.scrollIntoView === "function") target.scrollIntoView({ behavior: "smooth" });
  };
  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-slate-700">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 lg:px-8"><button onClick={() => go("inicio")} aria-label="Ir al inicio"><Brand/></button>
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Navegación principal">{nav.map(([label,id]) => <button key={id} onClick={() => go(id)} className="text-sm font-medium text-slate-600 transition hover:text-blue-700">{label}</button>)}</nav>
          <Link to="/login" className="hidden rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 lg:inline-flex">Iniciar sesión</Link>
          <button className="rounded-lg p-2 text-slate-700 lg:hidden" aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X/> : <Menu/>}</button>
        </div>
        {menuOpen && <nav className="border-t bg-white px-5 py-4 lg:hidden">{nav.map(([label,id]) => <button key={id} onClick={() => go(id)} className="block w-full rounded-lg px-3 py-3 text-left hover:bg-blue-50">{label}</button>)}<Link onClick={() => setMenuOpen(false)} to="/login" className="mt-2 block rounded-xl bg-blue-700 px-4 py-3 text-center font-semibold text-white">Iniciar sesión</Link></nav>}
      </header>
      <main>
        <section id="inicio" className="relative overflow-hidden bg-[#f6f8fc] py-20 lg:py-28"><div className="absolute -right-40 -top-40 size-[34rem] rounded-full bg-blue-200/35 blur-3xl"/><div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 lg:grid-cols-[1.02fr_.98fr] lg:px-8">
          <div><span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800"><ShieldCheck className="size-4"/>Operación residencial en una sola plataforma</span><h1 className="mt-7 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-.04em] text-slate-950 sm:text-5xl lg:text-6xl">Administra tu residencial desde una sola plataforma</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">Centraliza accesos, visitas, pagos, reservas, sanciones y reportes en una solución segura y fácil de utilizar.</p><div className="mt-9 flex flex-col gap-3 sm:flex-row"><button onClick={() => go("demostracion")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 py-3.5 font-semibold text-white hover:bg-blue-800">Solicitar demostración<ArrowRight className="size-4"/></button><Link to="/login" className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3.5 font-semibold text-slate-800 hover:border-blue-300">Iniciar sesión</Link></div></div>
          <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-2xl shadow-blue-950/10"><div className="rounded-[1.4rem] bg-slate-950 p-5 text-white"><div className="flex items-center justify-between"><Brand/><span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs text-emerald-300">Sistema operativo</span></div><div className="mt-8 grid grid-cols-2 gap-3">{[["Accesos de hoy","24"],["Reservas activas","8"],["Pagos al día","Control"],["Avisos pendientes","3"]].map(([a,b])=><div key={a} className="rounded-2xl bg-white/8 p-4"><p className="text-xs text-slate-400">{a}</p><p className="mt-2 text-xl font-semibold">{b}</p></div>)}</div><div className="mt-3 rounded-2xl bg-blue-600 p-5"><p className="text-sm text-blue-100">Actividad centralizada</p><div className="mt-4 flex h-20 items-end gap-2">{[45,70,55,90,65,82,60].map((h,i)=><span key={i} className="flex-1 rounded-t bg-white/75" style={{height:`${h}%`}}/>)}</div></div></div></div>
        </div></section>
        <section className="py-20"><div className="mx-auto max-w-7xl px-5 lg:px-8"><div className="max-w-2xl"><p className="font-semibold text-blue-700">Menos dispersión, más control</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">La operación residencial no debería depender de hojas sueltas y procesos manuales</h2></div><div className="mt-10 grid gap-4 md:grid-cols-3">{["Registros manuales que dificultan el seguimiento de visitas, accesos y pagos.","Reservas duplicadas y reglas que no se aplican de forma consistente.","Reportes, sanciones y respaldos sin trazabilidad centralizada."].map((x,i)=><div key={x} className="rounded-2xl border border-slate-200 p-6"><span className="text-sm font-semibold text-blue-700">0{i+1}</span><p className="mt-4 leading-7 text-slate-700">{x}</p></div>)}</div></div></section>
        <section id="funcionalidades" className="bg-slate-950 py-20 text-white"><div className="mx-auto max-w-7xl px-5 lg:px-8"><p className="font-semibold text-blue-300">Funcionalidades reales</p><h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Todo lo necesario para coordinar una comunidad residencial</h2><div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{features.map(([Icon,title,text])=><article key={String(title)} className="rounded-2xl border border-white/10 bg-white/5 p-6"><Icon className="size-6 text-blue-300"/><h3 className="mt-5 text-lg font-semibold">{title as string}</h3><p className="mt-2 text-sm leading-6 text-slate-300">{text as string}</p></article>)}</div></div></section>
        <section id="beneficios" className="py-20"><div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-2 lg:px-8"><div><p className="font-semibold text-blue-700">Beneficios</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Información clara para tomar mejores decisiones</h2><p className="mt-5 leading-7">NexusResidencial conecta la administración diaria con la seguridad, las finanzas y la experiencia de quienes viven en la comunidad.</p></div><div className="grid gap-3 sm:grid-cols-2">{["Centralización de información","Menos trabajo manual","Control y trazabilidad de accesos","Prevención de reservas duplicadas","Seguimiento de pagos y recargos","Reportes disponibles rápidamente","Respaldo de la información","Experiencia diferenciada por rol"].map(x=><div key={x} className="flex gap-3 rounded-xl bg-slate-50 p-4"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Check className="size-4"/></span><span className="text-sm font-medium text-slate-800">{x}</span></div>)}</div></div></section>
        <section className="bg-blue-50 py-20"><div className="mx-auto max-w-7xl px-5 lg:px-8"><div className="text-center"><p className="font-semibold text-blue-700">Cómo funciona</p><h2 className="mt-3 text-3xl font-semibold text-slate-950">De la configuración al control diario</h2></div><div className="mt-10 grid gap-5 md:grid-cols-4">{["Configura el residencial","Registra usuarios, viviendas y reglas","Gestiona pagos, accesos y reservas","Consulta reportes y respaldos"].map((x,i)=><div key={x} className="relative rounded-2xl bg-white p-6 shadow-sm"><span className="text-3xl font-semibold text-blue-200">0{i+1}</span><h3 className="mt-6 font-semibold text-slate-950">{x}</h3>{i<3&&<ChevronRight className="absolute -right-4 top-1/2 hidden text-blue-300 md:block"/>}</div>)}</div></div></section>
        <section id="roles" className="py-20"><div className="mx-auto max-w-7xl px-5 lg:px-8"><p className="font-semibold text-blue-700">Roles del sistema</p><h2 className="mt-3 text-3xl font-semibold text-slate-950">Cada persona ve lo que necesita</h2><div className="mt-10 grid gap-5 md:grid-cols-2">{roles.map(([title,text],i)=><article key={title} className="rounded-2xl border border-slate-200 p-7"><div className="flex items-center gap-4"><span className="grid size-11 place-items-center rounded-xl bg-blue-50 font-semibold text-blue-700">{i+1}</span><h3 className="text-xl font-semibold text-slate-950">{title}</h3></div><p className="mt-4 leading-7">{text}</p></article>)}</div></div></section>
        <section className="bg-[#f6f8fc] py-20"><div className="mx-auto max-w-7xl px-5 lg:px-8"><div className="text-center"><p className="font-semibold text-blue-700">Conoce la plataforma</p><h2 className="mt-3 text-3xl font-semibold text-slate-950">Una operación conectada de principio a fin</h2></div><div className="mt-10 grid gap-5 md:grid-cols-3">{[["Administración","Pagos, sanciones, reportes y configuraciones con datos reales."],["Residentes","Visitas, reservas, accesos y resumen mensual en un panel simple."],["Seguridad","Autorizaciones claras para registrar ingresos con información relevante."]].map(([a,b],i)=><div key={a} className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className={`h-2 ${["bg-blue-600","bg-violet-600","bg-emerald-600"][i]}`}/><div className="p-6"><div className="mb-6 grid grid-cols-3 gap-2">{[1,2,3].map(n=><span key={n} className="h-16 rounded-lg bg-slate-100"/>)}</div><h3 className="font-semibold text-slate-950">{a}</h3><p className="mt-2 text-sm leading-6">{b}</p></div></div>)}</div></div></section>
        <section id="demostracion" className="bg-slate-950 py-20"><div className="mx-auto grid max-w-7xl items-center gap-12 px-5 lg:grid-cols-[.85fr_1.15fr] lg:px-8"><div className="text-white"><MessageSquareText className="size-10 text-blue-300"/><h2 className="mt-6 text-4xl font-semibold tracking-tight">Digitaliza la administración de tu residencial</h2><p className="mt-5 leading-7 text-slate-300">Solicita una demostración y conoce cómo NexusResidencial puede centralizar la operación de tu comunidad.</p></div><DemoForm/></div></section>
      </main>
      <footer className="border-t bg-white"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 md:grid-cols-3 lg:px-8"><div><Brand/><p className="mt-4 max-w-sm text-sm leading-6">Administración residencial, seguridad y servicio a la comunidad desde una plataforma conectada.</p></div><div><p className="font-semibold text-slate-950">Navegación</p><div className="mt-4 grid gap-2 text-sm">{nav.slice(1).map(([a,b])=><button className="text-left hover:text-blue-700" key={b} onClick={()=>go(b)}>{a}</button>)}</div></div><div><p className="font-semibold text-slate-950">Contacto</p><p className="mt-4 text-sm">contacto@nexusresidencial.com</p><div className="mt-3 flex gap-4 text-sm"><Link className="hover:text-blue-700" to="/privacidad">Privacidad</Link><Link className="hover:text-blue-700" to="/login">Iniciar sesión</Link></div></div></div><div className="border-t px-5 py-5 text-center text-xs text-slate-500">© {new Date().getFullYear()} NexusResidencial. Todos los derechos reservados.</div></footer>
    </div>
  );
}
