import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type StatCardProps = {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  onClick?: () => void;
};

export function StatCard({ label, value, helper, icon: Icon, onClick }: StatCardProps) {
  return (
    <Card
      className={`border-slate-200 bg-white/95 ${onClick ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md" : ""}`}
      onClick={onClick}
    >
      <CardContent className="flex items-start justify-between gap-4 p-6">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-3xl text-slate-900">{value}</p>
          <p className="mt-2 text-sm text-slate-500">{helper}</p>
        </div>
        <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
          <Icon className="size-6" />
        </div>
      </CardContent>
    </Card>
  );
}
