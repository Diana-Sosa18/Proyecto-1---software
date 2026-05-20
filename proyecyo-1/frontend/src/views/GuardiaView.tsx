import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import jsQR from "jsqr";
import {
  Bell,
  BellRing,
  Camera,
  CheckCheck,
  CircleAlert,
  QrCode,
  ScanLine,
  Shield,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/layout/StatCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getGuardVisitsRequest,
  registerQrEntryRequest,
  validateQrRequest,
} from "@/services/visitsService";
import {
  getGuardNotificationsRequest,
  markAllGuardNotificationsAsReadRequest,
  markGuardNotificationAsReadRequest,
} from "@/services/notificationsService";
import type { NotificationRecord } from "@/types/notifications";
import type { VisitRecord } from "@/types/visits";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-GT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function extractQrToken(rawValue: string) {
  return rawValue.startsWith("NEXUSVISIT:") ? rawValue.slice("NEXUSVISIT:".length) : rawValue;
}

function canUseCamera() {
  const isLocalhost =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

  return Boolean(navigator.mediaDevices?.getUserMedia) && (window.isSecureContext || isLocalhost);
}

function getVisitBadge(visit: VisitRecord): { label: string; className: string } {
  // SCRUM-180: Mostrar badge "Cancelado" cuando el acceso fue cancelado
  if (visit.estado_acceso === "CANCELADA" || visit.qr_status === "CANCELLED") {
    return {
      label: "Cancelado",
      className: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
    };
  }

  if (visit.qr_status === "EXPIRED") {
    return {
      label: "QR expirado",
      className: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
    };
  }

  if (visit.qr_status === "USED" || visit.estado_acceso === "INGRESO_REGISTRADO") {
    return {
      label: "Ingreso registrado",
      className: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
    };
  }

  return {
    label: "Autorizada",
    className: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
  };
}

export function GuardiaView() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [validatedVisit, setValidatedVisit] = useState<VisitRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [validationResult, setValidationResult] = useState<{
    status: "approved" | "rejected";
    title: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    let active = true;

    async function loadVisits(options: { silent?: boolean } = {}) {
      try {
        const response = await getGuardVisitsRequest();
        if (!active) {
          return;
        }
        setVisits(response);
      } catch (error) {
        if (!active || options.silent) {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : "No fue posible cargar las visitas.");
      } finally {
        if (active && !options.silent) {
          setIsLoading(false);
        }
      }
    }

    async function loadNotifications() {
      try {
        const data = await getGuardNotificationsRequest();
        if (active) {
          setNotifications(data);
        }
      } catch {
        // No bloquear la vista por errores de notificaciones
      }
    }

    void loadVisits();
    void loadNotifications();

    // SCRUM-181 + SCRUM-182: Polling silencioso cada 10s para detectar cambios
    // en accesos y nuevas notificaciones (cancelaciones, etc.)
    const intervalId = window.setInterval(() => {
      void loadVisits({ silent: true });
      void loadNotifications();
    }, 10000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  // SCRUM-182: Filtra solo alertas de cancelacion no leidas para el panel
  const cancellationAlerts = useMemo(
    () => notifications.filter((n) => n.tipo === "ACCESO_CANCELADO" && !n.leido),
    [notifications],
  );

  async function handleMarkAlertRead(notificationId: number) {
    try {
      await markGuardNotificationAsReadRequest(notificationId);
      setNotifications((current) =>
        current.map((n) =>
          n.id_notificacion === notificationId ? { ...n, leido: true } : n,
        ),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No fue posible marcar la alerta como leida.",
      );
    }
  }

  async function handleMarkAllAlertsRead() {
    try {
      await markAllGuardNotificationsAsReadRequest();
      setNotifications((current) => current.map((n) => ({ ...n, leido: true })));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No fue posible marcar las alertas como leidas.",
      );
    }
  }

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const pendingCount = useMemo(
    () => visits.filter((visit) => visit.qr_status === "VALID").length,
    [visits],
  );

  const registeredCount = useMemo(
    () => visits.filter((visit) => visit.qr_status === "USED").length,
    [visits],
  );

  function updateVisitCollection(visit: VisitRecord) {
    setVisits((current) => {
      const found = current.some((item) => item.id_acceso === visit.id_acceso);
      return found
        ? current.map((item) => (item.id_acceso === visit.id_acceso ? visit : item))
        : [visit, ...current];
    });
  }

  function stopScanner() {
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsScanning(false);
  }

  async function handleValidateToken(qrToken: string) {
    try {
      setErrorMessage("");
      setSuccessMessage("");
      const visit = await validateQrRequest({ qrToken });
      setValidatedVisit(visit);
      setValidationResult({
        status: "approved",
        title: "Visita autorizada",
        message: "QR valido. El ingreso fue registrado y este QR ya no funcionara una segunda vez.",
      });
      updateVisitCollection(visit);
      setSuccessMessage("Visita autorizada e ingreso registrado.");
    } catch (error) {
      setValidatedVisit(null);
      const apiError = error as { status?: number; message?: string; payload?: { code?: string } };
      const message = apiError?.message || "No fue posible validar el QR.";

      // SCRUM-183: Detectar especificamente cancelaciones para mensaje destacado
      const isCancelled =
        apiError?.status === 410 &&
        (message.toLowerCase().includes("cancelado") ||
          apiError?.payload?.code === "ACCESS_CANCELLED");

      setValidationResult({
        status: "rejected",
        title: isCancelled ? "ACCESO CANCELADO - NO AUTORIZAR" : "Acceso rechazado",
        message,
      });
      setErrorMessage(message);

      // Refresca las notificaciones para que el guardia vea la alerta asociada
      if (isCancelled) {
        try {
          const updatedNotifications = await getGuardNotificationsRequest();
          setNotifications(updatedNotifications);
        } catch {
          // silencioso
        }
      }
    }
  }

  async function scanFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState < 2) {
      frameRef.current = window.requestAnimationFrame(() => {
        void scanFrame();
      });
      return;
    }

    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) {
      setErrorMessage("No fue posible inicializar el lector QR.");
      stopScanner();
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(imageData.data, imageData.width, imageData.height);

    if (result?.data) {
      stopScanner();
      await handleValidateToken(extractQrToken(result.data));
      return;
    }

    frameRef.current = window.requestAnimationFrame(() => {
      void scanFrame();
    });
  }

  async function handleStartScanner() {
    if (!canUseCamera()) {
      setErrorMessage(
        "La camara necesita HTTPS o localhost y permisos del navegador. En telefono y compu funciona, pero fuera de localhost debe abrirse en HTTPS.",
      );
      return;
    }

    try {
      setErrorMessage("");
      setSuccessMessage("");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsScanning(true);
      frameRef.current = window.requestAnimationFrame(() => {
        void scanFrame();
      });
    } catch (error) {
      stopScanner();
      setErrorMessage(error instanceof Error ? error.message : "No fue posible iniciar la camara.");
    }
  }

  async function decodeQrFromImageBitmap(bitmap: ImageBitmap) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) {
      throw new Error("No fue posible procesar la imagen del QR.");
    }

    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    context.drawImage(bitmap, 0, 0);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(imageData.data, imageData.width, imageData.height);

    if (!result?.data) {
      throw new Error("No se detecto ningun QR en la imagen.");
    }

    return result.data;
  }

  async function handleImageScan(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setErrorMessage("");
      setSuccessMessage("");
      const bitmap = await createImageBitmap(file);
      const qrValue = await decodeQrFromImageBitmap(bitmap);
      await handleValidateToken(extractQrToken(qrValue));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No fue posible leer la imagen.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleManualValidation() {
    if (!manualCode.trim()) {
      setErrorMessage("Ingresa un codigo QR valido.");
      return;
    }

    await handleValidateToken(manualCode);
  }

  async function handleRegisterEntry() {
    if (!validatedVisit?.token_qr) {
      return;
    }

    try {
      setErrorMessage("");
      setSuccessMessage("");
      const visit = await registerQrEntryRequest({ qrToken: validatedVisit.token_qr });
      setValidatedVisit(visit);
      setValidationResult({
        status: "approved",
        title: "Ingreso autorizado",
        message: "El QR fue usado correctamente y ya no funcionara una segunda vez.",
      });
      updateVisitCollection(visit);
      setSuccessMessage("Ingreso registrado correctamente.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible registrar el ingreso.";
      setValidationResult({
        status: "rejected",
        title: "Acceso rechazado",
        message,
      });
      setErrorMessage(message);
    }
  }

  return (
    <AppShell
      role="guardia"
      title="Panel de Guardia"
      subtitle="Control de accesos, registro de visitas y operacion del puesto de seguridad."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Visitas del turno" value={String(visits.length)} helper={`${pendingCount} pendientes de ingreso`} icon={Users} />
        <StatCard label="Escaneos QR" value={String(registeredCount)} helper="Ingresos ya registrados" icon={QrCode} />
        <StatCard label="Validaciones" value={validatedVisit ? "OK" : "Lista"} helper="Control con QR en tiempo real" icon={UserCheck} />
        <StatCard label="Seguridad" value="Alta" helper="Monitoreo estable" icon={Shield} />
      </div>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {successMessage ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-700">
          <AlertTitle>Operacion exitosa</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      {/* SCRUM-182: Panel de notificacion visual para alertas de cancelacion */}
      {cancellationAlerts.length > 0 ? (
        <Card className="border-rose-200 bg-rose-50/60 shadow-[0_10px_30px_rgba(244,63,94,0.08)]">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                  <BellRing className="size-5 animate-pulse" />
                </div>
                <div>
                  <CardTitle className="text-rose-900">
                    {cancellationAlerts.length} alerta{cancellationAlerts.length !== 1 ? "s" : ""} de cancelacion
                  </CardTitle>
                  <CardDescription className="text-rose-700">
                    Accesos cancelados por residentes/inquilinos. Verifica que el QR ya no sea valido.
                  </CardDescription>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleMarkAllAlertsRead}
                className="border-rose-200 bg-white text-rose-700 hover:bg-rose-100"
              >
                <CheckCheck className="size-4" />
                Marcar todas
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {cancellationAlerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id_notificacion}
                className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-white px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  <XCircle className="mt-0.5 size-4 shrink-0 text-rose-600" />
                  <div className="text-sm">
                    <p className="font-medium text-slate-900">{alert.titulo}</p>
                    <p className="text-slate-600">{alert.mensaje}</p>
                    <p className="mt-1 text-xs text-slate-400">{alert.creado_en}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleMarkAlertRead(alert.id_notificacion)}
                  className="text-xs font-medium text-rose-600 hover:underline"
                  aria-label="Marcar como leida"
                >
                  Leida
                </button>
              </div>
            ))}
            {cancellationAlerts.length > 5 ? (
              <p className="px-1 text-xs text-rose-700">
                +{cancellationAlerts.length - 5} alertas mas pendientes.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Escanear QR</CardTitle>
            <CardDescription>Lee el QR del visitante para validar acceso en garita.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <video ref={videoRef} className="h-72 w-full rounded-2xl bg-slate-900 object-cover" muted playsInline />
              <canvas ref={canvasRef} className="hidden" />
              <div className="mt-4 flex flex-wrap gap-3">
                <Button type="button" onClick={() => void handleStartScanner()} className="rounded-2xl">
                  <Camera className="size-4" />
                  Iniciar camara
                </Button>
                <Button type="button" variant="outline" onClick={stopScanner} className="rounded-2xl">
                  <ScanLine className="size-4" />
                  Detener
                </Button>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
                  <QrCode className="size-4" />
                  Leer desde imagen
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageScan} />
                </label>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {isScanning
                  ? "Escaneando QR en tiempo real..."
                  : "Funciona en compu y telefono. Para usar camara fuera de localhost, la web debe abrirse con HTTPS."}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-medium text-slate-900">Codigo manual</p>
              <div className="mt-3 flex flex-col gap-3 md:flex-row">
                <input
                  value={manualCode}
                  onChange={(event) => setManualCode(event.target.value)}
                  placeholder="NEXUSVISIT:token o token"
                  className="h-11 flex-1 rounded-2xl border border-slate-200 px-4 outline-none focus:border-blue-300"
                />
                <Button type="button" onClick={() => void handleManualValidation()} className="rounded-2xl">
                  Validar QR
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Resultado de validacion</CardTitle>
            <CardDescription>Si el QR es valido, aqui aparece la visita autorizada.</CardDescription>
          </CardHeader>
          <CardContent>
            {validatedVisit ? (
              <div className="space-y-4 rounded-3xl bg-emerald-50 p-5">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-600">
                    Visita autorizada
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{validatedVisit.nombre}</p>
                </div>
                <div className="space-y-2 text-slate-700">
                  <p>DPI: {validatedVisit.dpi}</p>
                  <p>Placa: {validatedVisit.placa}</p>
                  <p>Casa: {validatedVisit.casa}</p>
                  <p>Fecha: {formatDate(validatedVisit.fecha)}</p>
                  <p>Hora: {validatedVisit.hora_inicio} - {validatedVisit.hora_fin}</p>
                  <p>Tipo: {validatedVisit.tipo_visita}</p>
                  <p>Estado: {validatedVisit.estado_acceso}</p>
                </div>
                <Button
                  type="button"
                  onClick={() => void handleRegisterEntry()}
                  disabled
                  className="rounded-2xl"
                >
                  Ingreso ya registrado
                </Button>
              </div>
            ) : validationResult?.status === "rejected" ? (
              <div className="space-y-3 rounded-3xl bg-rose-50 p-5 text-rose-700">
                <div className="flex items-center gap-2">
                  <CircleAlert className="size-5" />
                  <p className="font-semibold">{validationResult.title}</p>
                </div>
                <p>{validationResult.message}</p>
              </div>
            ) : (
              <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-500">
                Aun no se ha validado un QR.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Control de ingresos</CardTitle>
          <CardDescription>Listado operativo para revision rapida desde garita.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">
              Cargando visitas del turno...
            </div>
          ) : (
            visits.map((visitor) => (
              <div
                key={visitor.id_acceso}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-slate-900">{visitor.nombre}</p>
                  <p className="text-sm text-slate-500">
                    {visitor.casa} • {formatDate(visitor.fecha)} • {visitor.hora_inicio} - {visitor.hora_fin}
                  </p>
                </div>
                {(() => {
                  const badge = getVisitBadge(visitor);
                  return (
                    <span className={`rounded-full px-3 py-1 text-sm ${badge.className}`}>
                      {badge.label}
                    </span>
                  );
                })()}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
