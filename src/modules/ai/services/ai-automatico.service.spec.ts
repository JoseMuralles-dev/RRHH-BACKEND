import { ConfigService } from '@nestjs/config';
import { AiAutomaticoService, validarResumen } from './ai-automatico.service';

describe('Informes automáticos', () => {
  const resumen = { datosSuficientes: true, resumen: 'Hay registros disponibles.', puntosClave: ['Datos del período'],
    recomendaciones: ['Revisar contexto'], fuentes: ['resumen-equipo'] };
  it('rechaza texto libre, listas inválidas y éxito sin fuente', () => {
    expect(() => validarResumen('La herramienta falló', 'resumen-equipo')).toThrow();
    expect(() => validarResumen(JSON.stringify({ ...resumen, fuentes: [] }), 'resumen-equipo')).toThrow();
    expect(() => validarResumen(JSON.stringify({ ...resumen, puntosClave: [3] }), 'resumen-equipo')).toThrow();
  });
  let repo: any, ia: any, tools: any, notificaciones: any, manager: any, service: AiAutomaticoService;
  beforeEach(() => {
    repo = { existsBy: jest.fn().mockResolvedValue(false), create: (x: any) => x, save: jest.fn().mockResolvedValue({ idInforme: 8 }) };
    manager = { getRepository: () => repo, transaction: jest.fn(async fn => fn(manager)) };
    ia = { analizar: jest.fn().mockResolvedValue({ respuesta: JSON.stringify(resumen) }) };
    tools = { obtenerResumenEquipo: jest.fn().mockResolvedValue({ empleados: [{ tieneDatos: true }] }) };
    notificaciones = { crear: jest.fn() };
    service = new AiAutomaticoService(
      { getRepository: () => ({ find: async () => [{ idUsuario: 7, idEmpleado: 3 }] }) } as any,
      new ConfigService({ AI_NOTIFICACIONES_ENABLED: 'true' }),
      { obtener: async () => ({ idUsuario: 7, idEmpleado: 3, nivelJerarquico: 2 }), alcance: async () => 'scope' } as any,
      { exclusivo: async (_id: number, fn: any) => fn(manager) } as any, tools, ia, notificaciones);
  });
  it('crea informe y aviso en una misma transacción', async () => {
    expect((await service.ejecutar(2026, 8)).creados).toBe(1);
    expect(manager.transaction).toHaveBeenCalledTimes(1);
    expect(notificaciones.crear).toHaveBeenCalledWith(expect.objectContaining({
      idUsuarioDestinatario: 7, referenciaTipo: 'IA_INFORME', referenciaId: 8,
    }), manager);
  });
  it('no notifica ni consume IA sin registros', async () => {
    tools.obtenerResumenEquipo.mockResolvedValue({ empleados: [{ tieneDatos: false }] });
    expect((await service.ejecutar(2026, 8)).creados).toBe(0);
    expect(ia.analizar).not.toHaveBeenCalled();
    expect(notificaciones.crear).not.toHaveBeenCalled();
  });
  it('omite datos ya notificados antes de llamar IA', async () => {
    repo.existsBy.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await service.ejecutar(2026, 8);
    expect(ia.analizar).not.toHaveBeenCalled();
  });
  it.each(['fallo', JSON.stringify({ ...resumen, datosSuficientes: false, puntosClave: [], fuentes: [] })])('no notifica una respuesta insuficiente: %s', async respuesta => {
    ia.analizar.mockResolvedValue({ respuesta });
    await service.ejecutar(2026, 8);
    expect(repo.save).not.toHaveBeenCalled();
    expect(notificaciones.crear).not.toHaveBeenCalled();
  });
  it('queda desactivado sin configuración explícita', async () => {
    const disabled = new AiAutomaticoService({} as any, new ConfigService(), {} as any, {} as any, {} as any, {} as any, {} as any);
    expect((await disabled.ejecutar(2026, 8)).habilitado).toBe(false);
  });
});