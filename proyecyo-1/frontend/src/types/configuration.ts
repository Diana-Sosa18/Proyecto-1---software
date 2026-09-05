export type VisitScheduleConfig = {
  hora_apertura: string;
  hora_cierre: string;
  duracion_maxima_horas: number;
  activo: boolean;
  dias_habilitados: number[];
};

export type UpdateVisitSchedulePayload = {
  hora_apertura: string;
  hora_cierre: string;
  duracion_maxima_horas: number;
  activo: boolean;
  dias_habilitados: number[];
};
