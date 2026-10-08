import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type StatCardProps = {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  onClick?: () => void;
};

// Mismo lenguaje que los KPI del dashboard de administración: icono en recuadro
// con el color de acento del panel y valor grande. La animación de entrada y la
// elevación al pasar el cursor las aporta .nd-content (adminTheme.css).
export function StatCard({ label, value, helper, icon: Icon, onClick }: StatCardProps) {
  return (
    <Card className={`nd-kpi gap-0 border-slate-200 bg-white ${onClick ? "cursor-pointer" : ""}`} onClick={onClick}>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-[13.5px] font-semibold text-slate-500">{label}</p>
          <p className="nd-stat-value">{value}</p>
          <p className="text-[12.5px] text-slate-500">{helper}</p>
        </div>
        <span className="nd-kico flex size-[46px] flex-none items-center justify-center rounded-[14px] bg-[color-mix(in_srgb,var(--nd-accent,#2563EB)_12%,#FFFFFF)] text-[var(--nd-accent,#2563EB)]">
          <Icon className="size-[22px]" aria-hidden="true" />
        </span>
      </CardContent>
    </Card>
  );
}
