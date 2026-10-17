import { BadGatewayException, GatewayTimeoutException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';

describe('AiService gateway', () => {
  const actor = { idUsuario: 7, idEmpleado: 3, nivelJerarquico: 2 };
  const dto = { anio: 2026, mes: 8, pregunta: 'Analiza mi equipo' };
  const originalFetch = global.fetch;
  const config = (extra = {}) => new ConfigService({ N8N_AI_WEBHOOK: 'https://n8n.example/webhook/rrhh-ai',
    N8N_INTERNAL_TOKEN: 'test-secret', ...extra });
  afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });
  it('envía contexto controlado e ignora períodos devueltos por el modelo', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, respuesta: 'Datos de KPI', periodo: { anio: 1999, mes: 1 } }) });
    const response = await new AiService(config()).analizar(dto, actor);
    const request = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(JSON.parse(request.body)).toEqual({ tipo: 'ANALISIS_KPI', usuario: actor, periodo: { anio: 2026, mes: 8 }, pregunta: dto.pregunta });
    expect(request.headers.Authorization).toBeUndefined();
    expect(request.redirect).toBe('error');
    expect(response.periodo).toEqual({ anio: 2026, mes: 8 });
  });
  it.each([{ ok: false }, { ok: true, respuesta: '' }, { ok: true, respuesta: {} }])('rechaza cuerpo inválido %j', async data => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => data });
    await expect(new AiService(config()).analizar(dto, actor)).rejects.toBeInstanceOf(BadGatewayException);
  });
  it('no expone el cuerpo de un error de n8n', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
    await expect(new AiService(config()).analizar(dto, actor)).rejects.toThrow('El servicio de IA no pudo completar');
  });
  it('aborta la llamada al superar el tiempo límite', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockImplementation((_url, init) => new Promise((_resolve, reject) =>
      init.signal.addEventListener('abort', () => reject(new Error('abort')))));
    const result = new AiService(config({ N8N_AI_TIMEOUT_MS: 1000 })).analizar(dto, actor);
    const assertion = expect(result).rejects.toBeInstanceOf(GatewayTimeoutException);
    await jest.advanceTimersByTimeAsync(1001);
    await assertion;
  });
});