import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getResidentRegulationsRequest } from "@/services/sprintStoriesService";
import type { Regulation } from "@/types/sprintStories";

export function ResidenteRegulationsView() {
  const navigate = useNavigate();
  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    let active = true;

    getResidentRegulationsRequest({ search, category })
      .then((response) => {
        if (active) {
          setRegulations(response);
          setSelectedId((current) => current ?? response[0]?.id_reglamento ?? null);
        }
      })
      .catch(() => {
        if (active) {
          setRegulations([]);
        }
      });

    return () => {
      active = false;
    };
  }, [category, search]);

  const categories = useMemo(
    () => Array.from(new Set(regulations.map((item) => item.categoria))).sort(),
    [regulations],
  );
  const selected = regulations.find((item) => item.id_reglamento === selectedId) || regulations[0] || null;

  return (
    <AppShell role="residente" title="Panel de Residente" subtitle="Reglamentos y reglas del residencial.">
      <button
        type="button"
        onClick={() => navigate("/residente")}
        className="inline-flex items-center gap-3 text-left text-slate-700 transition hover:text-slate-950"
      >
        <ArrowLeft className="size-5" />
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Reglamentos y reglas</h2>
          <p className="text-sm text-slate-600">Categorias, busqueda y detalle del documento</p>
        </div>
      </button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="size-5 text-blue-600" />
            Biblioteca de reglamentos
          </CardTitle>
          <CardDescription>Contenido cargado desde base de datos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <label className="relative block">
              <Search className="absolute left-3 top-3 size-4 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar reglamento..."
                className="h-11 rounded-2xl border-slate-100 bg-slate-50 pl-10"
              />
            </label>
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setSelectedId(null);
              }}
              className="h-11 rounded-2xl border border-slate-100 bg-slate-50 px-4 text-sm"
            >
              <option value="">Todas las categorias</option>
              {categories.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="max-h-[460px] space-y-2 overflow-y-auto rounded-2xl bg-slate-50 p-3">
              {regulations.map((item) => (
                <button
                  key={item.id_reglamento}
                  type="button"
                  onClick={() => setSelectedId(item.id_reglamento)}
                  className={`w-full rounded-xl px-4 py-3 text-left text-sm ${
                    selected?.id_reglamento === item.id_reglamento ? "bg-blue-600 text-white" : "bg-white text-slate-700"
                  }`}
                >
                  <span className="block text-xs opacity-80">{item.categoria}</span>
                  {item.titulo}
                </button>
              ))}
            </div>

            <article className="max-h-[460px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5">
              {selected ? (
                <>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                    {selected.categoria}
                  </span>
                  <h3 className="mt-4 text-2xl font-semibold text-slate-900">{selected.titulo}</h3>
                  <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600">{selected.contenido}</p>
                  <p className="mt-6 text-xs text-slate-400">Actualizado: {selected.actualizado_en}</p>
                </>
              ) : (
                <p className="text-sm text-slate-500">Selecciona un reglamento para ver el detalle.</p>
              )}
            </article>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
