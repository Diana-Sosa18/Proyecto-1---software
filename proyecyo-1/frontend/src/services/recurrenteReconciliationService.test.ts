import { beforeEach, expect, it, vi } from 'vitest';
import { apiRequest } from './api';
import { listRecurrenteTransactions, verifyRecurrenteTransactions } from './recurrenteReconciliationService';
vi.mock('./api',()=>({apiRequest:vi.fn(),ApiError:class extends Error{}}));
beforeEach(()=>vi.clearAllMocks());
it('GET local serializa solo filtros y no llama endpoint de pago',async()=>{await listRecurrenteTransactions({referencia:'NXR-00000395',residente:'1',hasta:''});expect(apiRequest).toHaveBeenCalledWith('/admin/pagos/recurrente/transacciones?referencia=NXR-00000395&residente=1');});
it('POST verifica con selección de filtros, sin valores financieros ni secretos',async()=>{await verifyRecurrenteTransactions({estado_local:'FALLIDA'},false);expect(apiRequest).toHaveBeenCalledWith('/admin/pagos/recurrente/conciliacion',{method:'POST',body:{filtros:{estado_local:'FALLIDA'},descubrir_externas:false}});});
