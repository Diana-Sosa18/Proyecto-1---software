import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function ResidentePaymentReturnView() {
  const navigate = useNavigate();
  return (
    <AppShell role="residente" title="Pago pendiente de verificación" subtitle="Consulta el estado de tu cuota.">
      <Alert>
        <AlertTitle>Tu pago está pendiente de verificación</AlertTitle>
        <AlertDescription>El regreso desde el checkout no confirma el pago. Consulta tu estado de cuenta para conocer el saldo registrado.</AlertDescription>
      </Alert>
      <Button type="button" onClick={() => navigate("/residente/estado-cuenta")}>Volver al estado de cuenta</Button>
    </AppShell>
  );
}
