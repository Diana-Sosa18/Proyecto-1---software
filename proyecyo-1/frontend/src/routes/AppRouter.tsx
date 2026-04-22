import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PublicRoute } from "@/components/auth/PublicRoute";
import { useAuth } from "@/hooks/useAuth";
import { rolePaths } from "@/routes/rolePaths";
import { AdminAmenitiesReservationsView } from "@/views/AdminAmenitiesReservationsView";
import { AdminAccessesView } from "@/views/AdminAccessesView";
import { AdminPaymentsView } from "@/views/AdminPaymentsView";
import { AdminReportsView } from "@/views/AdminReportsView";
import { AdminSettingsView } from "@/views/AdminSettingsView";
import { AdminView } from "@/views/AdminView";
import { GuardiaView } from "@/views/GuardiaView";
import { InquilinoView } from "@/views/InquilinoView";
import { LoginView } from "@/views/LoginView";
import { ResidenteAmenitiesView } from "@/views/ResidenteAmenitiesView";
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
          <Route path="/admin/pagos" element={<AdminPaymentsView />} />
          <Route path="/admin/amenidades" element={<AdminAmenitiesReservationsView />} />
          <Route path="/admin/reportes" element={<AdminReportsView />} />
          <Route path="/admin/configuracion" element={<AdminSettingsView />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["guardia"]} />}>
          <Route path="/guardia" element={<GuardiaView />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["residente"]} />}>
          <Route path="/residente" element={<ResidenteView />} />
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
