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
import { AdminRemindersView } from "@/views/AdminRemindersView";
import { AdminReportsView } from "@/views/AdminReportsView";
import { AdminMonthlyFinancialReportView } from "@/views/AdminMonthlyFinancialReportView";
import { AdminProvidersView } from "@/views/AdminProvidersView";
import { AdminSanctionsView } from "@/views/AdminSanctionsView";
import { AdminSanctionHistoryView } from "@/views/AdminSanctionHistoryView";
import { AdminSettingsView } from "@/views/AdminSettingsView";
import { AdminSpecialAccessView } from "@/views/AdminSpecialAccessView";
import { AdminView } from "@/views/AdminView";
import { GuardiaView } from "@/views/GuardiaView";
import { InquilinoView } from "@/views/InquilinoView";
import { InquilinoAccountView } from "@/views/InquilinoAccountView";
import { LoginView } from "@/views/LoginView";
import { ResidenteAmenitiesView } from "@/views/ResidenteAmenitiesView";
import { ResidenteUnifiedAmenitiesAvailabilityView } from "@/views/ResidenteUnifiedAmenitiesAvailabilityView";
import { ResidenteRegulationsView } from "@/views/ResidenteRegulationsView";
import { ResidenteUnifiedView } from "@/views/ResidenteUnifiedView";
import { ResidenteView } from "@/views/ResidenteView";
import { ResidenteAccountView } from "@/views/ResidenteAccountView";
import { ResidentePaymentReturnView } from "@/views/ResidentePaymentReturnView";
import { ResidentePaymentReceiptView } from "@/views/ResidentePaymentReceiptView";
import { ResidenteVisitsView } from "@/views/ResidenteVisitsView";
import { ResidentMonthlySummaryView } from "@/views/ResidentMonthlySummaryView";
import { ResidenteFinancialDetailView } from "@/views/ResidenteFinancialDetailView";
import { ResidentNotificationsView } from "@/views/ResidentNotificationsView";
import { LandingView } from "@/views/LandingView";
import { PrivacyView } from "@/views/PrivacyView";
import { AdminDemoRequestsView } from "@/views/AdminDemoRequestsView";
import { ActiveSessionsView } from "@/views/ActiveSessionsView";
import { ForgotPasswordView } from "@/views/ForgotPasswordView";
import { ResetPasswordView } from "@/views/ResetPasswordView";
import { AdminAuditView } from "@/views/AdminAuditView";

function FallbackRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? rolePaths[user.role] : "/"} replace />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingView />} />
        <Route path="/privacidad" element={<PrivacyView />} />
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginView />} />
          <Route path="/olvide-contrasena" element={<ForgotPasswordView />} />
          <Route path="/restablecer-contrasena" element={<ResetPasswordView />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
          <Route path="/admin" element={<AdminView />} />
          <Route path="/admin/accesos" element={<AdminAccessesView />} />
          <Route path="/admin/usuarios-autorizados" element={<AdminAuthorizedUsersView />} />
          <Route path="/admin/proveedores" element={<AdminProvidersView />} />
          <Route path="/admin/accesos-especiales" element={<AdminSpecialAccessView />} />
          <Route path="/admin/comunicados" element={<AdminCommunicationsView />} />
          <Route path="/admin/pagos" element={<AdminPaymentsView />} />
          <Route path="/admin/recordatorios" element={<AdminRemindersView />} />
          <Route path="/admin/sanciones" element={<AdminSanctionsView />} />
          <Route path="/admin/sanciones/historial-completo" element={<AdminSanctionHistoryView />} />
          <Route path="/admin/amenidades" element={<AdminAmenitiesReservationsView />} />
          <Route path="/admin/reportes" element={<AdminReportsView />} />
          <Route path="/admin/reportes-financieros" element={<AdminMonthlyFinancialReportView />} />
          <Route path="/admin/configuracion" element={<AdminSettingsView />} />
          <Route path="/admin/solicitudes-demo" element={<AdminDemoRequestsView />} />
          <Route path="/admin/auditoria" element={<AdminAuditView />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["guardia"]} />}>
          <Route path="/guardia" element={<GuardiaView />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["residente"]} />}>
          <Route path="/residente" element={<ResidenteView />} />
          <Route path="/residente/estado-cuenta" element={<ResidenteAccountView />} />
          <Route path="/residente/pagos/retorno" element={<ResidentePaymentReturnView />} />
          <Route path="/residente/pagos/:paymentId/comprobante" element={<ResidentePaymentReceiptView />} />
          <Route path="/residente/unificado" element={<ResidenteUnifiedView />} />
          <Route path="/residente/reglamentos" element={<ResidenteRegulationsView />} />
          <Route path="/residente/visitas" element={<ResidenteVisitsView />} />
          <Route path="/residente/amenidades" element={<ResidenteAmenitiesView />} />
          <Route path="/residente/amenidades/disponibilidad-general" element={<ResidenteUnifiedAmenitiesAvailabilityView />} />
          <Route path="/residente/resumen-mensual" element={<ResidentMonthlySummaryView />} />
          <Route path="/residente/detalle-financiero" element={<ResidenteFinancialDetailView />} />
          <Route path="/residente/notificaciones" element={<ResidentNotificationsView />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["inquilino"]} />}>
          <Route path="/inquilino" element={<InquilinoView />} />
          <Route path="/inquilino/estado-cuenta" element={<InquilinoAccountView />} />
          <Route path="/inquilino/historial-financiero" element={<InquilinoAccountView />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["admin", "guardia", "residente", "inquilino"]} />}>
          <Route path="/cuenta/sesiones" element={<ActiveSessionsView />} />
        </Route>

        <Route path="*" element={<FallbackRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
