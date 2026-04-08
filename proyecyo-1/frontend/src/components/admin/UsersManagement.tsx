import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createUserRequest,
  deleteUserRequest,
  getUserTypesRequest,
  getUsersRequest,
  updateUserRequest,
} from "@/services/usersService";
import type { UserFormValues, UserRecord, UserTypeOption } from "@/types/users";
import { UserFormModal } from "@/components/admin/UserFormModal";

export function UsersManagement() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [userTypes, setUserTypes] = useState<UserTypeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);

  const roleStyles = useMemo(
    () => ({
      admin: "bg-slate-900 text-white",
      guardia: "bg-amber-100 text-amber-800",
      residente: "bg-emerald-100 text-emerald-800",
      inquilino: "bg-blue-100 text-blue-800",
    }),
    [],
  );

  const loadData = async () => {
    setIsLoading(true);
    setError("");

    try {
      const [usersResponse, typesResponse] = await Promise.all([
        getUsersRequest(),
        getUserTypesRequest(),
      ]);

      setUsers(usersResponse);
      setUserTypes(typesResponse);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible cargar usuarios.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleCreate = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleEdit = (user: UserRecord) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleDelete = async (user: UserRecord) => {
    const confirmed = window.confirm(`¿Desea eliminar a ${user.nombre}? Esta acción no se puede deshacer.`);

    if (!confirmed) {
      return;
    }

    setError("");
    setFeedback("");
    setIsSubmitting(true);

    try {
      await deleteUserRequest(user.id_usuario);
      setFeedback("Usuario eliminado correctamente.");
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible eliminar el usuario.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (values: UserFormValues) => {
    setError("");
    setFeedback("");
    setIsSubmitting(true);

    try {
      if (editingUser) {
        await updateUserRequest(editingUser.id_usuario, values);
        setFeedback("Usuario actualizado correctamente.");
      } else {
        await createUserRequest(values);
        setFeedback("Usuario creado correctamente.");
      }

      setIsModalOpen(false);
      setEditingUser(null);
      await loadData();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Gestion de Usuarios</CardTitle>
            <CardDescription>Administre altas, ediciones y bajas de usuarios del sistema.</CardDescription>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="size-4" />
            Crear usuario
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {feedback ? (
            <Alert>
              <AlertTitle>Operacion completada</AlertTitle>
              <AlertDescription>{feedback}</AlertDescription>
            </Alert>
          ) : null}

          {isLoading ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
              Cargando usuarios...
            </div>
          ) : users.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <Users className="mx-auto size-10 text-slate-400" />
              <p className="mt-4 text-slate-600">No hay usuarios registrados.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Correo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Telefono</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Rol</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {users.map((user) => (
                      <tr key={user.id_usuario}>
                        <td className="px-4 py-4 text-sm text-slate-900">{user.nombre}</td>
                        <td className="px-4 py-4 text-sm text-slate-600">{user.correo}</td>
                        <td className="px-4 py-4 text-sm text-slate-600">{user.telefono || "-"}</td>
                        <td className="px-4 py-4 text-sm">
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${roleStyles[user.rol]}`}>
                            {user.rol}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleEdit(user)} disabled={isSubmitting}>
                              <Pencil className="size-4" />
                              Editar
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDelete(user)} disabled={isSubmitting}>
                              <Trash2 className="size-4" />
                              Eliminar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <UserFormModal
        isOpen={isModalOpen}
        isSubmitting={isSubmitting}
        userTypes={userTypes}
        editingUser={editingUser}
        onClose={() => {
          if (!isSubmitting) {
            setIsModalOpen(false);
            setEditingUser(null);
          }
        }}
        onSubmit={handleSubmit}
      />
    </>
  );
}