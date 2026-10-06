import type { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { ResidentNotificationsView } from './ResidentNotificationsView';
import { notificationAction } from '@/components/notifications/notificationActions';
import { notifySidebarCountersChanged } from '@/components/layout/sidebarCounters';
import { getNotificationsPageRequest, getUnreadNotificationsRequest, markNotificationAsReadRequest, markAllNotificationsAsReadRequest } from '@/services/notificationsService';
import type { NotificationRecord } from '@/types/notifications';

vi.mock('@/components/layout/AppShell', () => ({ AppShell: ({children,actions}: {children:ReactNode,actions:ReactNode}) => <main>{actions}{children}</main> }));
vi.mock('@/services/notificationsService', () => ({ getNotificationsPageRequest:vi.fn(),getUnreadNotificationsRequest:vi.fn(),markNotificationAsReadRequest:vi.fn(),markAllNotificationsAsReadRequest:vi.fn() }));
const page = (items: NotificationRecord[]) => ({ items, next_cursor: null });
const notice: NotificationRecord = { id_notificacion:1,id_usuario:3,id_acceso:null,tipo:'PAGO_CONFIRMADO',
  titulo:'Se confirmó el pago TEST',mensaje:'Q5.00. NXR-00000395',leido:false,creado_en:'2026-10-04 12:00:00',leido_en:null,
  accion_codigo:'COMPROBANTE_PAGO',id_pago:395 };
beforeEach(() => { vi.resetAllMocks(); vi.mocked(getNotificationsPageRequest).mockResolvedValue(page([notice])); vi.mocked(getUnreadNotificationsRequest).mockResolvedValue({unread:35}); });
it.each(['residente','inquilino'] as const)('comprobante usa ruta local y rol %s', async role => {
  render(<MemoryRouter><ResidentNotificationsView role={role}/></MemoryRouter>);
  expect(await screen.findByRole('link',{name:'Ver comprobante'})).toHaveAttribute('href',`/${role}/pagos/395/comprobante`);
  expect(screen.getByLabelText('35 pendientes')).toBeInTheDocument();
});
it.each([
  ['PAGO_NO_COMPLETADO','Pago no completado'],['PAGO_CANCELADO','Intento cancelado'],['REEMBOLSO_CONFIRMADO','Reembolso'],
  ['CUOTA_PROXIMA','Cuota próxima'],['CUOTA_HOY','Vence hoy'],['CUOTA_VENCIDA','Cuota vencida'],
])('etiqueta %s dentro del centro existente',async(tipo,label)=>{
  vi.mocked(getNotificationsPageRequest).mockResolvedValue(page([{...notice,tipo,accion_codigo:'ESTADO_CUENTA'}]));
  render(<MemoryRouter><ResidentNotificationsView/></MemoryRouter>);
  expect(await screen.findByText(label)).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'Ver estado de cuenta'})).toHaveAttribute('href','/residente/estado-cuenta');
});
it.each([null,-1,0,1.5,Number.MAX_SAFE_INTEGER+1])('comprobante rechaza id %s',id_pago=>expect(notificationAction({...notice,id_pago},'residente')).toBeNull());
it('código desconocido/URL externa nunca produce enlace',()=>{
  expect(notificationAction({...notice,accion_codigo:'https://evil.invalid' as never},'residente')).toBeNull();
  expect(notificationAction({...notice,accion_codigo:'javascript:alert(1)' as never},'residente')).toBeNull();
});
it('llegada nueva actualiza lista y total real sin depender de límite 20',async()=>{
  render(<MemoryRouter><ResidentNotificationsView/></MemoryRouter>); await screen.findByText(notice.titulo);
  vi.mocked(getNotificationsPageRequest).mockResolvedValue(page([{...notice,id_notificacion:2,titulo:'Refund nuevo TEST',tipo:'REEMBOLSO_CONFIRMADO'}]));
  vi.mocked(getUnreadNotificationsRequest).mockResolvedValue({unread:36}); notifySidebarCountersChanged();
  expect(await screen.findByText('Refund nuevo TEST')).toBeInTheDocument(); expect(screen.getByLabelText('36 pendientes')).toBeInTheDocument();
});
it('marcar individual recarga contador: nuevo aviso simultáneo no se pierde',async()=>{
  render(<MemoryRouter><ResidentNotificationsView/></MemoryRouter>); await screen.findByText(notice.titulo);
  vi.mocked(markNotificationAsReadRequest).mockResolvedValue({...notice,leido:true});
  vi.mocked(getNotificationsPageRequest).mockResolvedValue(page([{...notice,leido:true},{...notice,id_notificacion:2,titulo:'Nuevo durante lectura'}]));
  vi.mocked(getUnreadNotificationsRequest).mockResolvedValue({unread:35});
  fireEvent.click(screen.getByRole('button',{name:'Marcar como leida'}));
  expect(await screen.findByText('Nuevo durante lectura')).toBeInTheDocument(); expect(screen.getByLabelText('35 pendientes')).toBeInTheDocument();
});
it('marcar todas conserva aviso que llegó después del UPDATE',async()=>{
  render(<MemoryRouter><ResidentNotificationsView/></MemoryRouter>); await screen.findByText(notice.titulo);
  vi.mocked(markAllNotificationsAsReadRequest).mockResolvedValue({unread:1});
  vi.mocked(getNotificationsPageRequest).mockResolvedValue(page([{...notice,leido:true},{...notice,id_notificacion:2,titulo:'Nuevo después de marcar'}]));
  vi.mocked(getUnreadNotificationsRequest).mockResolvedValue({unread:1});
  fireEvent.click(screen.getByRole('button',{name:'Marcar todas como leidas'}));
  expect(await screen.findByText('Nuevo después de marcar')).toBeInTheDocument(); expect(screen.getByLabelText('1 pendientes')).toBeInTheDocument();
});
it('retomar pestaña refresca avisos del servidor',async()=>{
  render(<MemoryRouter><ResidentNotificationsView/></MemoryRouter>); await screen.findByText(notice.titulo);
  vi.mocked(getUnreadNotificationsRequest).mockResolvedValue({unread:40}); fireEvent(window,new Event('focus'));
  await waitFor(()=>expect(screen.getByLabelText('40 pendientes')).toBeInTheDocument());
});
