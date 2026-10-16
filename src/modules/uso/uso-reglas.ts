export const MODULOS_USO = ['INICIO','KPI','KPI_VENTAS','CINCO_S','EXPEDIENTES','EMPLEADOS','SOLICITUDES','VACACIONES','USUARIOS','DEPARTAMENTOS','PUESTOS','ROLES','IA','NOTIFICACIONES','PERFIL','AUTENTICACION'] as const;
export function clasificarUso(metodo: string, ruta: string): {modulo: string; accion: string} | null {
  // Solo plantilla de ruta del router, nunca originalUrl/query/body.
  const p = ruta.replace(/^\/api(?=\/)/, '').replace(/\/$/, '');
  if (p.startsWith('/uso') || p.startsWith('/ai-tools') || p.startsWith('/ia/tools') || p.startsWith('/sap')) return null;
  if (p === '/auth/me' || p === '/notificaciones/no-leidas/count') return null; // llamadas automaticas del layout
  if (p === '/auth/login' && metodo === 'POST') return {modulo:'AUTENTICACION',accion:'INICIO_SESION'};
  const raiz=p.split('/')[1];
  const modulos: Record<string,string> = {kpi:'KPI',performance:'KPI',expedientes:'EXPEDIENTES',empleados:'EMPLEADOS',solicitudes:'SOLICITUDES',vacaciones:'VACACIONES',user:'USUARIOS',departamentos:'DEPARTAMENTOS',puestos:'PUESTOS',roles:'ROLES',ia:'IA',notificaciones:'NOTIFICACIONES',auth:'PERFIL'};
  let modulo=modulos[raiz]; if (!modulo) return null;
  if (p.startsWith('/kpi/ventas')) modulo='KPI_VENTAS';
  if (p.startsWith('/kpi/cinco-s')) modulo='CINCO_S';
  if (metodo==='GET') {
    if (/^\/kpi(?:\/ventas)?\/(mi-equipo|equipo)$/.test(p)) return {modulo,accion:'CONSULTA_KPI_GLOBAL'};
    if (/^\/kpi(?:\/ventas)?\/mi-dashboard$/.test(p)) return {modulo,accion:'CONSULTA_KPI_INDIVIDUAL'};
    if (modulo==='EXPEDIENTES') {
      if (p.endsWith('/descargar')) return {modulo,accion:'DESCARGA_DOCUMENTO'};
      if (p.endsWith('/previsualizar')) return {modulo,accion:'PREVISUALIZACION_DOCUMENTO'};
      if (p.includes('/empleado/:')) return {modulo,accion:'CONSULTA_EXPEDIENTE'};
    }
    return {modulo,accion:'CONSULTA'};
  }
  if (modulo==='IA' && metodo==='POST') return {modulo,accion:'CONSULTA_IA'};
  if (raiz==='performance' || p.endsWith('/recalcular') || p==='/kpi/ventas/evaluaciones') return {modulo,accion:'PROCESO_EJECUTADO'};
  if (metodo==='POST') return {modulo,accion:'REGISTRO_CREADO'};
  if (metodo==='PUT') return {modulo,accion:'REGISTRO_GUARDADO'};
  if (metodo==='PATCH') return {modulo,accion:p.endsWith('/desactivar')?'REGISTRO_DESACTIVADO':'REGISTRO_ACTUALIZADO'};
  if (metodo==='DELETE') return {modulo,accion:'REGISTRO_DESACTIVADO'};
  return null;
}
export const fechaUtcTexto = (date = new Date()) => date.toISOString().replace('T',' ').slice(0,23);
