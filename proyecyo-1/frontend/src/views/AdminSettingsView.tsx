import { Bell, LockKeyhole, Palette, ShieldCheck } from "lucide-react";

import { AdminLayout } from "@/components/admin/AdminLayout";

const settingsGroups = [
  {
    title: "Seguridad",
    icon: LockKeyhole,
    items: ["Politicas de acceso", "Sesiones activas", "Permisos administrativos"],
  },
  {
    title: "Notificaciones",
    icon: Bell,
    items: ["Alertas internas", "Correos autom\u00e1ticos", "Recordatorios visuales"],
  },
  {
    title: "Interfaz",
    icon: Palette,
    items: ["Preferencias del panel", "Jerarquia visual", "Componentes base"],
  },
  {
    title: "Control",
    icon: ShieldCheck,
    items: ["Estados operativos", "Etiquetas visibles", "Validaciones del modulo"],
  },
];

export function AdminSettingsView() {
  return (
    <AdminLayout
      title="Configuraci\u00f3n"
      subtitle="Secciones visuales para ajustes generales del panel administrativo."
    >
      <section className="grid gap-6 md:grid-cols-2">
        {settingsGroups.map(({ title, icon: Icon, items }) => (
          <article
            key={title}
            className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_10px_30px_rgba(15,23,42,0.05)]"
          >
            <div className="flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Icon className="size-7" />
            </div>
            <h2 className="mt-6 text-[1.7rem] font-semibold text-slate-950">{title}</h2>
            <div className="mt-5 grid gap-3">
              {items.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-base text-slate-600"
                >
                  {item}
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </AdminLayout>
  );
}
