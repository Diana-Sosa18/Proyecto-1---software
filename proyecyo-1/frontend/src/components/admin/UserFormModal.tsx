import { useEffect, useMemo, useState, type FormEvent } from "react";
import { X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { UserFormValues, UserRecord, UserTypeOption } from "@/types/users";

type UserFormModalProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  userTypes: UserTypeOption[];
  editingUser: UserRecord | null;
  onClose: () => void;
  onSubmit: (values: UserFormValues) => Promise<void>;
};

type FormErrors = Partial<Record<keyof UserFormValues, string>>;

const emptyValues: UserFormValues = {
  nombre: "",
  correo: "",
  password: "",
  telefono: "",
  id_tipo_usuario: "",
};

export function UserFormModal({
  isOpen,
  isSubmitting,
  userTypes,
  editingUser,
  onClose,
  onSubmit,
}: UserFormModalProps) {
  const [values, setValues] = useState<UserFormValues>(emptyValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setValues(emptyValues);
      setErrors({});
      setServerError("");
      return;
    }

    if (editingUser) {
      setValues({
        nombre: editingUser.nombre,
        correo: editingUser.correo,
        password: "",
        telefono: editingUser.telefono ?? "",
        id_tipo_usuario: String(editingUser.id_tipo_usuario),
      });
      return;
    }

    setValues(emptyValues);
  }, [editingUser, isOpen]);

  const title = useMemo(
    () => (editingUser ? "Editar usuario" : "Crear usuario"),
    [editingUser],
  );

  if (!isOpen) {
    return null;
  }

  const validate = () => {
    const nextErrors: FormErrors = {};

    if (!values.nombre.trim()) {
      nextErrors.nombre = "El nombre es obligatorio.";
    }

    if (!values.correo.trim()) {
      nextErrors.correo = "El correo es obligatorio.";
    } else if (!/\S+@\S+\.\S+/.test(values.correo)) {
      nextErrors.correo = "Ingrese un correo valido.";
    }

    if (!editingUser && !values.password.trim()) {
      nextErrors.password = "La contrasena es obligatoria.";
    } else if (values.password && values.password.trim().length < 4) {
      nextErrors.password = "La contrasena debe tener al menos 4 caracteres.";
    }

    if (!values.id_tipo_usuario) {
      nextErrors.id_tipo_usuario = "Seleccione un rol.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (field: keyof UserFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError("");

    if (!validate()) {
      return;
    }

    try {
      await onSubmit({
        ...values,
        nombre: values.nombre.trim(),
        correo: values.correo.trim().toLowerCase(),
        telefono: values.telefono.trim(),
        password: values.password.trim(),
      });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "No fue posible guardar el usuario.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-2xl border-slate-200 shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>{title}</CardTitle>
          <button type="button" className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="size-5" />
          </button>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            {serverError ? (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-slate-700">Nombre</label>
                <Input value={values.nombre} onChange={(event) => handleChange("nombre", event.target.value)} />
                {errors.nombre ? <p className="mt-2 text-sm text-red-600">{errors.nombre}</p> : null}
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-700">Correo</label>
                <Input type="email" value={values.correo} onChange={(event) => handleChange("correo", event.target.value)} />
                {errors.correo ? <p className="mt-2 text-sm text-red-600">{errors.correo}</p> : null}
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-700">
                  {editingUser ? "Nueva contrasena (opcional)" : "Contrasena"}
                </label>
                <Input
                  type="password"
                  value={values.password}
                  onChange={(event) => handleChange("password", event.target.value)}
                />
                {errors.password ? <p className="mt-2 text-sm text-red-600">{errors.password}</p> : null}
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-700">Telefono</label>
                <Input value={values.telefono} onChange={(event) => handleChange("telefono", event.target.value)} />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm text-slate-700">Tipo de usuario</label>
                <select
                  value={values.id_tipo_usuario}
                  onChange={(event) => handleChange("id_tipo_usuario", event.target.value)}
                  className="flex h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                >
                  <option value="">Seleccione un rol</option>
                  {userTypes.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.nombre}
                    </option>
                  ))}
                </select>
                {errors.id_tipo_usuario ? <p className="mt-2 text-sm text-red-600">{errors.id_tipo_usuario}</p> : null}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Guardando..." : editingUser ? "Actualizar usuario" : "Crear usuario"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
