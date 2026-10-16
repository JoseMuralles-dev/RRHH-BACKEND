import { ResultadoKpi } from '../../performance/entities/resultado-kpi.entity';
import { DetalleResultadoKpi } from '../../performance/entities/detalle-resultado-kpi.entity';
import { KpiVentasSnapshot } from '../../performance/entities/kpi-ventas-snapshot.entity';
import { VentasService } from './ventas.service';
import { VENTAS } from '../../performance/services/ventas-reglas';
import { Empleado } from '../../organization/empleados/entities/empleado.entity';
import { Usuario } from '../../user/entities/user.entity';
import { Departamento } from '../../organization/departamentos/entities/departamento.entity';
import { MetricaKpi } from '../../performance/entities/metrica-kpi.entity';
import { MetricaKpiDiaria } from '../../performance/entities/metrica-kpi-diaria.entity';
import { MetaKpiEmpleado } from '../../performance/entities/meta-kpi-empleado.entity';
import { RangoKpi } from '../../performance/entities/rango-kpi.entity';
import { EvaluacionDesempeno } from '../../performance/entities/evaluacion-desempeno.entity';
import { KpiCambio } from '../../performance/entities/kpi-cambio.entity';
describe('Ventas acceso y escritura', () => {
  let service: VentasService, repos: Map<any, any>, sap: any, db: any;
  beforeEach(() => {
    repos = new Map();
    for (const t of [Empleado, Usuario, Departamento, MetricaKpi, MetricaKpiDiaria, MetaKpiEmpleado, RangoKpi, EvaluacionDesempeno, KpiCambio, KpiVentasSnapshot, ResultadoKpi, DetalleResultadoKpi])
      repos.set(t, { find: jest.fn().mockResolvedValue([]), findOne: jest.fn().mockResolvedValue(null), existsBy: jest.fn().mockResolvedValue(true), delete: jest.fn(), create: (x: any) => x, save: jest.fn(async x => x) });
    repos.get(Usuario).findOne.mockResolvedValue({ idUsuario: 1, idEmpleado: 10, rol: { isActive: true, nivelJerarquico: 2 } });
    repos.get(MetricaKpi).find.mockResolvedValue(Object.entries(VENTAS).map(([codigoKpi,p],i) => ({ idMetrica:i+1, codigoKpi, pesoPorcentaje: String(p), idDepartamento: 2 })));
    repos.get(Empleado).find.mockResolvedValue([{idEmpleado:21,idJefeDirecto:10,codigoSapEmpleado:5,primerNombre:'Ana',primerApellido:'Perez'}]);
    db = { manager: { getRepository: (t: any) => repos.get(t) }, getRepository: (t: any) => repos.get(t), transaction: (fn: any) => fn(db.manager) };
    sap = { obtenerKpiVentas: jest.fn().mockResolvedValue([]) };
    service = new VentasService(db, sap, { get: () => 'America/Guatemala' } as any);
  });
  it('filtra empleados activos por departamento 2 sin filtros por nombres y consulta SAP una vez', async () => {
    await service.dashboard(1,2026,1,true);
    expect(repos.get(Empleado).find.mock.calls[0][0].where).toEqual({isActive:true,puesto:{idDepartamento:2}});
    expect(sap.obtenerKpiVentas).toHaveBeenCalledTimes(1);
  });
  it('distingue codigo sin correspondencia', async () => {
    expect((await service.dashboard(1,2026,1,true)).empleados[0].estado).toBe('SIN_CORRESPONDENCIA');
  });
  it('detecta codigos duplicados incluso fuera de subordinados', async () => {
    repos.get(Empleado).find.mockResolvedValue([{idEmpleado:21,idJefeDirecto:10,codigoSapEmpleado:5},{idEmpleado:22,idJefeDirecto:99,codigoSapEmpleado:5}]);
    expect((await service.dashboard(1,2026,1,true)).empleados[0].estado).toBe('CONFLICTO_CODIGO_SAP');
  });
  it('no permite consultar otro empleado usando el ID del cliente', async () => {
    await expect(service.dashboard(1,2026,1,false,99)).rejects.toThrow();
    expect(sap.obtenerKpiVentas).not.toHaveBeenCalled();
  });
  it('empleado solo puede consultar su informacion, no equipos', async () => {
    repos.get(Usuario).findOne.mockResolvedValue({idUsuario:1,idEmpleado:21,rol:{isActive:true,nivelJerarquico:1}});
    await service.dashboard(1,2026,1);
    await expect(service.dashboard(1,2026,1,true)).rejects.toThrow();
    await expect(service.clientes(1,{idEmpleado:21,fecha:'2026-01-01',cantidad:2})).rejects.toThrow();
  });
  it('propaga falla SAP sin ventas cero', async () => {
    sap.obtenerKpiVentas.mockRejectedValue(new Error('SAP no disponible'));
    await expect(service.dashboard(1,2026,1,true)).rejects.toThrow('SAP no disponible');
  });
  it('reemplaza total diario sin sumarlo y audita', async () => {
    const diario = repos.get(MetricaKpiDiaria);
    diario.find.mockResolvedValue([{idRegistro:7,valor:'2'}]);
    await service.clientes(1,{idEmpleado:21,fecha:'2026-01-01',cantidad:3});
    await service.clientes(1,{idEmpleado:21,fecha:'2026-01-01',cantidad:3});
    expect(diario.save.mock.calls.map(([r]) => [r.idRegistro,r.valor])).toEqual([[7,'3'],[7,'3']]);
    expect(repos.get(KpiCambio).save).toHaveBeenCalledTimes(2);
  });
  it('bloquea periodos cerrados', async () => {
    repos.get(EvaluacionDesempeno).find.mockResolvedValue([{estado:'CERRADA'}]);
    await expect(service.clientes(1,{idEmpleado:21,fecha:'2026-01-01',cantidad:3})).rejects.toThrow('PERIODO_CERRADO');
    expect(repos.get(MetricaKpiDiaria).save).not.toHaveBeenCalled();
  });

  it('excluye Bodega aunque comparta SlpCode', async () => {
    const empleados = [{idEmpleado:21,idJefeDirecto:10,codigoSapEmpleado:5,departamento:2}, {idEmpleado:88,idJefeDirecto:10,codigoSapEmpleado:5,departamento:3}];
    repos.get(Empleado).find.mockImplementation(async q => empleados.filter(e => e.departamento === q.where.puesto.idDepartamento));
    const result = await service.dashboard(1,2026,1,true);
    expect(result.empleados.map(e => e.idEmpleado)).toEqual([21]);
    expect(result.empleados[0].estado).not.toBe('CONFLICTO_CODIGO_SAP');
  });
  it('no guarda una evaluacion incompleta', async () => {
    expect((await service.guardar(1,21,2026,1)).guardado).toBe(false);
    expect(repos.get(EvaluacionDesempeno).save).not.toHaveBeenCalled();
  });
  it('devuelve snapshot cerrado sin consultar SAP ni recalcular', async () => {
    repos.get(EvaluacionDesempeno).find.mockResolvedValue([{idEvaluacionDesempeno:3,idEmpleado:21,estado:'CERRADA'}]);
    repos.get(KpiVentasSnapshot).find.mockResolvedValue([{idEvaluacionDesempeno:3,datos:{idEmpleado:21,notaFinal:'85.75',resultados:[]}}]);
    const result = await service.dashboard(1,2026,1,true);
    expect(result.empleados[0].notaFinal).toBe('85.75');
    expect(sap.obtenerKpiVentas).not.toHaveBeenCalled();
  });
  it('meta de enero no cambia si afecta un acumulado cerrado posterior', async () => {
    repos.get(Usuario).findOne.mockResolvedValue({idUsuario:1,rol:{isActive:true,nivelJerarquico:3}});
    repos.get(EvaluacionDesempeno).find.mockResolvedValue([{estado:'CERRADA'}]);
    await expect(service.guardarMeta(1,{idEmpleado:21,anio:2026,mes:1,metaObjetivo:'50000'})).rejects.toThrow('PERIODO_CERRADO');
    expect(repos.get(MetaKpiEmpleado).save).not.toHaveBeenCalled();
  });

  it('guarda una evaluacion completa con metas, pesos y reglas historicas', async () => {
    sap.obtenerKpiVentas.mockResolvedValue([{slpCode:5,facturacionPeriodoConIVA:'10000',notasCreditoPeriodoConIVA:'0',ventasNetasAcumuladasConIVA:'10000',carteraDeudora:'1000',carteraMenor60:'1000'}]);
    repos.get(MetaKpiEmpleado).find.mockResolvedValue([{idEmpleado:21,periodoMes:1,metaObjetivo:'10000'}]);
    repos.get(MetricaKpiDiaria).find.mockResolvedValue([{idEmpleado:21,fecha:'2026-01-01',valor:'4'}]);
    repos.get(RangoKpi).find.mockResolvedValue([
      {idMetrica:4,isActive:true,valorMinimo:'0',valorMaximo:'0.45',porcentajeCumplimiento:'100',puntosOtorgados:'5'},
      {idMetrica:5,isActive:true,valorMinimo:'100',valorMaximo:'100',porcentajeCumplimiento:'100',puntosOtorgados:'35'},
    ]);
    repos.get(EvaluacionDesempeno).save.mockImplementation(async x => ({...x,idEvaluacionDesempeno:9}));
    repos.get(ResultadoKpi).save.mockImplementation(async x => ({...x,idResultado:x.idMetrica}));
    const r = await service.guardar(1,21,2026,1);
    expect(r.guardado).toBe(true);
    expect(repos.get(EvaluacionDesempeno).save).toHaveBeenCalledWith(expect.objectContaining({notaFinal:'100.00',metaGlobal:'100'}));
    expect(repos.get(ResultadoKpi).save).toHaveBeenCalledTimes(5);
    expect(repos.get(ResultadoKpi).save.mock.calls[0][0].metaAplicada).toBe('10000');
    expect(repos.get(KpiVentasSnapshot).save.mock.calls[0][0].datos.resultados[0].pesoPorcentaje).toBe(35);
  });

  it('lista solo subordinados autorizados sin consultar SAP', async () => {
    repos.get(Empleado).find.mockResolvedValue([{idEmpleado:21,idJefeDirecto:10,primerNombre:'Ana',primerApellido:'Perez'}, {idEmpleado:22,idJefeDirecto:99}]);
    expect(await service.empleadosDisponibles(1)).toEqual([{idEmpleado:21,nombre:'Ana Perez'}]);
    expect(sap.obtenerKpiVentas).not.toHaveBeenCalled();
  });
  it('consulta el total diario existente y bloquea empleados ajenos', async () => {
    repos.get(MetricaKpiDiaria).find.mockResolvedValue([{valor:'2'}]);
    expect((await service.clientesDia(1,21,'2026-01-01')).cantidad).toBe(2);
    await expect(service.clientesDia(1,99,'2026-01-01')).rejects.toThrow();
    expect(sap.obtenerKpiVentas).not.toHaveBeenCalled();
  });

  it('rechaza configurar Ventas sobre otro departamento', async () => {
    repos.get(MetricaKpi).find.mockResolvedValue(Object.entries(VENTAS).map(([codigoKpi,p],i) => ({idMetrica:i+1,codigoKpi,pesoPorcentaje:String(p),idDepartamento:3})));
    await expect(service.contexto(1)).rejects.toThrow('CONFIGURACION_VENTAS_INCOMPLETA');
  });
});
