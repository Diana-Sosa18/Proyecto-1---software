export type ReconciliationResult = 'CONCILIADA' | 'DIFERENCIA' | 'PENDIENTE' | 'ERROR_DE_VERIFICACION';
export type ReconciliationFilters = { desde?: string; hasta?: string; estado_local?: string; resultado?: string; residente?: string; referencia?: string };
export type ReconciliationOperation = {
  clave: string; id_transaccion: number | null; id_checkout: number; id_cuota: number; id_pago: number | null; id_residente: number;
  residente: string; unidad: string; concepto: string; referencia_local: string; numero_comprobante: string | null;
  fecha_operacion: string | null; sin_fecha_verificable: boolean; clasificacion: ReconciliationResult; motivo: string | null;
  diferencias: { codigo: string; campo: string; interno: unknown; externo: unknown }[]; faltantes: string[];
  comprobaciones: { campo: string; coincide: boolean | null }[];
  interno: { intent_id: string | null; checkout_id: string | null; pago_externo: string | null; estado_transaccion: string | null;
    estado_checkout: string; estado_proveedor: string | null; monto_centavos: number; moneda: string; ambiente: string; fecha_pago: string | null };
  externo: { intent_id: string | null; checkout_id: string | null; pago_externo: string | null; estado_intento: string | null;
    estado_checkout: string | null; monto_centavos: number | null; moneda: string | null; ambiente: string | null; fecha_original: string | null;
    motivo_codigo: string | null; motivo: string | null } | null;
  saldo_actual_centavos: number; sobrepago_centavos: number;
  eventos: { id: number; svix_id: string; tipo: string; estado: string; intentos: number; codigo: string | null }[];
};
export type ReconciliationResponse = {
  ambiente: 'sandbox'; alcance: string; verificado: boolean; completo: boolean; limite_operaciones: number;
  resumen: { evaluadas: number; conciliadas: number; diferencias: number; pendientes: number; errores_verificacion: number; sin_fecha: number };
  operaciones: ReconciliationOperation[];
  exploracion_externa: { solicitada: boolean; completa: boolean | null; motivo: string | null; paginas_intents?: number; paginas_checkouts?: number };
  externas_sin_asociacion: { tipo: string; id_externo: string; checkout_id: string | null; estado: string | null; monto_centavos: number | null;
    moneda: string | null; fecha_operacion: string | null; clasificacion: 'PENDIENTE'; motivo: string }[];
};
