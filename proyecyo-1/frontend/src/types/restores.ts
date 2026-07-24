export type BackupPayload = {
  filename: string;
  content: string;
};

export type BackupValidation = {
  filename: string;
  size: number;
  total_sentencias: number;
  tablas_afectadas: string[];
  vista_previa: string[];
  valido: boolean;
  mensaje: string;
};

export type RestoreResult = {
  id_restauracion: number;
  estado: "COMPLETADA" | "FALLIDA" | "EN_PROCESO";
  total_sentencias: number;
  tablas_afectadas: string[];
  mensaje: string;
};

export type RestoreHistoryRecord = {
  id_restauracion: number;
  nombre_archivo: string;
  estado: "COMPLETADA" | "FALLIDA" | "EN_PROCESO";
  total_sentencias: number;
  tablas_afectadas: string[];
  mensaje: string;
  creado_en: string;
  finalizado_en: string | null;
};
