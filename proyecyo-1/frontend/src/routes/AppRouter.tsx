import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PublicRoute } from "@/components/auth/PublicRoute";
import { useAuth } from "@/hooks/useAuth";
import { rolePaths } from "@/routes/rolePaths";
import { AdminAmenitiesReservationsView } from "@/views/AdminAmenitiesReservationsView";
import { AdminAccessesView } from "@/views/AdminAccessesView";
import { AdminAuthorizedUsersView } from "@/views/AdminAuthorizedUsersView";
import { AdminCommunicationsView } from "@/views/AdminCommunicationsView";
import { AdminPaymentsView } from "@/views/AdminPaymentsView";
import { AdminReportsView } from "@/views/AdminReportsView";
import { AdminProvidersView } from "@/views/AdminProvidersView";
import { AdminSanctionsView } from "@/views/AdminSanctionsView";
import { AdminSanctionHistoryView } from "@/views/AdminSanctionHistoryView";
import { AdminSettingsView } from "@/views/AdminSettingsView";
import { AdminSpecialAccessView } from "@/views/AdminSpecialAccessView";
import { AdminView } from "@/views/AdminView";
import { GuardiaView } from "@/views/GuardiaView";
import { InquilinoView } from "@/views/InquilinoView";
import { LoginView } from "@/views/LoginView";
import { ResidenteAmenitiesView } from "@/views/ResidenteAmenitiesView";
import { ResidenteRegulationsView } from "@/views/ResidenteRegulationsView";
import { ResidenteUnifiedView } from "@/views/ResidenteUnifiedView";
import { ResidenteView } from "@/views/ResidenteView";
import { ResidenteVisitsView } from "@/views/ResidenteVisitsView";

function FallbackRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? rolePaths[user.role] : "/"} replace />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicRoute />}>
          <Route path="/" element={<LoginView />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
          <Route path="/admin" element={<AdminView />} />
          <Route path="/admin/accesos" element={<AdminAccessesView />} />
          <Route path="/admin/usuarios-autorizados" element={<AdminAuthorizedUsersView />} />
          <Route path="/admin/proveedores" element={<AdminProvidersView />} />
          <Route path="/admin/accesos-especiales" element={<AdminSpecialAccessView />} />
          <Route path="/admin/comunicados" element={<AdminCommunicationsView />} />
          <Route path="/admin/pagos" element={<AdminPaymentsView />} />
          <Route path="/admin/sanciones" element={<AdminSanctionsView />} />
          <Route path="/admin/sanciones/historial-completo" element={<AdminSanctionHistoryView />} />
          <Route path="/admin/amenidades" element={<AdminAmenitiesReservationsView />} />
          <Route path="/admin/reportes" element={<AdminReportsView />} />
          <Route path="/admin/configuracion" element={<AdminSettingsView />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["guardia"]} />}>
          <Route path="/guardia" element={<GuardiaView />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["residente"]} />}>
          <Route path="/residente" element={<ResidenteView />} />
          <Route path="/residente/unificado" element={<ResidenteUnifiedView />} />
          <Route path="/residente/reglamentos" element={<ResidenteRegulationsView />} />
          <Route path="/residente/visitas" element={<ResidenteVisitsView />} />
          <Route path="/residente/amenidades" element={<ResidenteAmenitiesView />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["inquilino"]} />}>
          <Route path="/inquilino" element={<InquilinoView />} />
        </Route>

        <Route path="*" element={<FallbackRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
