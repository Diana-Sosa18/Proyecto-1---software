import { AdminLayout } from "@/components/admin/AdminLayout";
import { UsersManagement } from "@/components/admin/UsersManagement";

// Gestion de usuarios como pagina propia (antes vivia dentro del Dashboard).
export function AdminUsersView() {
  return (
    <AdminLayout title="Usuarios" subtitle="Cuentas del residencial: administradores, guardias, residentes e inquilinos.">
      <UsersManagement />
    </AdminLayout>
  );
}
