import { X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./alert";
import { Button } from "./button";

type ErrorAlertProps = {
  message: string;
  title?: string;
  onDismiss?: () => void;
  onRetry?: () => void;
  retrying?: boolean;
};

export function ErrorAlert({ message, title = "No se pudo completar la operación", onDismiss, onRetry, retrying }: ErrorAlertProps) {
  if (!message) return null;
  return (
    <Alert variant="destructive" className="relative" data-testid="error-alert">
      {onDismiss ? (
        <button type="button" aria-label="Cerrar mensaje de error" onClick={onDismiss} className="absolute right-3 top-3 rounded p-1 hover:bg-red-100">
          <X className="size-4" />
        </button>
      ) : null}
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="mt-1 pr-7">{message}</AlertDescription>
      {onRetry ? <Button type="button" variant="outline" size="sm" className="mt-3" disabled={retrying} onClick={onRetry}>{retrying ? "Reintentando..." : "Reintentar"}</Button> : null}
    </Alert>
  );
}
