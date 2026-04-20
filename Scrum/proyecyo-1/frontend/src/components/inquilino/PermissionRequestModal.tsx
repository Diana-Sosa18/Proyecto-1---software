import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  CreatePermissionRequestPayload,
  PermissionRequestType,
} from "@/types/permissionRequests";

type PermissionRequestModalProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: CreatePermissionRequestPayload) => Promise<void>;
};

type FormState = {
  tipo_permiso: PermissionRequestType | "";
  motivo: string;
  fecha_inicio: string;
  fecha_fin: string;
  observaciones: string;
};

const initialState: FormState = {
  tipo_permiso: "",
  motivo: "",
  fecha_inicio: "",
  fecha_fin: "",
  observaciones: "",
};

export function PermissionRequestModal({
  isOpen,
  isSubmitting,
  onClose,
  onSubmit,
}: PermissionRequestModalProps) {
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setForm(initialState);
      setError("");
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!form.tipo_permiso || !form.motivo.trim() || !form.fecha_inicio || !form.fecha_fin) {
      setError("Completa todos los campos obligatorios.");
      return;
    }

    if (form.fecha_fin < form.fecha_inicio) {
      setError("La fecha de fin no puede ser menor que la fecha de inicio.");
      return;
    }

    await onSubmit({
      tipo_permiso: form.tipo_permiso,
      motivo: form.motivo.trim(),
      fecha_inicio: form.fecha_inicio,
      fecha_fin: form.fecha_fin,
      observaciones: form.observaciones.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Solicitar permiso</CardTitle>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800"
          >
            <X className="size-5" />
          </button>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Tipo de permiso
                </label>
                <select
                  value={form.tipo_permiso}
                  onChange={(event) => handleChange("tipo_permiso", event.target.value)}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Selecciona una opción</option>
                  <option value="VISITA">Visita</option>
                  <option value="PROVEEDOR">Proveedor</option>
                  <option value="DELIVERY">Delivery</option>
                  <option value="AMENIDAD">Amenidad</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Motivo
                </label>
                <Input
                  value={form.motivo}
                  onChange={(event) => handleChange("motivo", event.target.value)}
                  placeholder="Ej. permiso para proveedor"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Fecha de inicio
                </label>
                <Input
                  type="date"
                  value={form.fecha_inicio}
                  onChange={(event) => handleChange("fecha_inicio", event.target.value)}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Fecha de fin
                </label>
                <Input
                  type="date"
                  value={form.fecha_fin}
                  onChange={(event) => handleChange("fecha_fin", event.target.value)}
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Observaciones
                </label>
                <textarea
                  value={form.observaciones}
                  onChange={(event) => handleChange("observaciones", event.target.value)}
                  className="min-h-[110px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  placeholder="Detalles adicionales"
                />
              </div>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cerrar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Enviando..." : "Enviar solicitud"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}