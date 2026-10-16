import { Body, Controller, Get, Post, UseGuards, ValidationPipe, BadRequestException } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { JwtAuthGuard } from '../../common/guards/jwt/jwt-auth.guard';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { Usuario } from '../user/entities/user.entity';
import { UsoEvento } from './uso-evento.entity';
import { UsoController } from './uso.controller';
import { UsoService, rangoUso } from './uso.service';
import { UsoInterceptor } from './uso.interceptor';
import { clasificarUso } from './uso-reglas';
@Controller()
@UseGuards(JwtAuthGuard)
class ActividadPrueba {
  @Get('kpi/mi-dashboard') kpi() {return {nota:80};}
  @Get('kpi/mi-equipo') equipo() {return [];}
  @Get('expedientes/empleado/:idEmpleado') expediente() {return {nombre:'privado'};}
  @Post('solicitudes') crear(@Body() body:unknown) {return {id:5};}
  @Get('empleados/error') error() {throw new BadRequestException('detalle privado');}
  @Get('auth/me') navbar() {return {};}
}
describe('Uso HTTP, privacidad y permisos',()=>{
  let app:any,jwt:JwtService;
  const eventos={insert:jest.fn(),query:jest.fn()};
  const usuarios={findOne:jest.fn()};
  beforeAll(async()=>{
    const m=await Test.createTestingModule({imports:[PassportModule,JwtModule.register({secret:'test-only-uso'})],controllers:[UsoController,ActividadPrueba],providers:[
      UsoService,JwtStrategy,{provide:APP_INTERCEPTOR,useClass:UsoInterceptor},
      {provide:ConfigService,useValue:{get:(k:string)=>k==='JWT_SECRET'?'test-only-uso':undefined}},
      {provide:getRepositoryToken(UsoEvento),useValue:eventos},{provide:getRepositoryToken(Usuario),useValue:usuarios},
    ]}).compile();
    app=m.createNestApplication();app.setGlobalPrefix('api');app.useGlobalPipes(new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true}));
    jwt=m.get(JwtService);await app.init();
  });
  beforeEach(()=>{jest.clearAllMocks();eventos.insert.mockResolvedValue({});eventos.query.mockResolvedValue([]);usuarios.findOne.mockResolvedValue({rol:{isActive:true,nivelJerarquico:4}});});
  afterAll(()=>app.close());
  const token=(nivel=1)=>jwt.sign({sub:7,nivelJerarquico:nivel,idEmpleado:21});
  it.each([['/kpi/mi-dashboard','CONSULTA_KPI_INDIVIDUAL'],['/kpi/mi-equipo','CONSULTA_KPI_GLOBAL'],['/expedientes/empleado/21','CONSULTA_EXPEDIENTE']])('registra %s con actor de JWT',async(ruta,accion)=>{
    await request(app.getHttpServer()).get('/api'+ruta).auth(token(),{type:'bearer'}).expect(200);
    expect(eventos.insert).toHaveBeenCalledTimes(1);
    expect(eventos.insert).toHaveBeenCalledWith(expect.objectContaining({idUsuario:7,accion,exito:true,origen:'API'}));
  });
  it('no captura cuerpos ni query, y guarda la ruta parametrizada',async()=>{
    await request(app.getHttpServer()).get('/api/expedientes/empleado/21?secreto=privado').auth(token(),{type:'bearer'}).expect(200);
    const e=eventos.insert.mock.calls[0][0];
    expect(e.ruta).toBe('/api/expedientes/empleado/:idEmpleado');expect(JSON.stringify(e)).not.toContain('privado');
    eventos.insert.mockClear();
    await request(app.getHttpServer()).post('/api/solicitudes').auth(token(),{type:'bearer'}).send({motivo:'muy privado',password:'secreto'}).expect(201);
    expect(eventos.insert.mock.calls[0][0].accion).toBe('REGISTRO_CREADO');expect(JSON.stringify(eventos.insert.mock.calls)).not.toContain('muy privado');
  });
  it('separa errores de operaciones exitosas',async()=>{
    await request(app.getHttpServer()).get('/api/empleados/error').auth(token(),{type:'bearer'}).expect(400);
    expect(eventos.insert).toHaveBeenCalledWith(expect.objectContaining({exito:false,estadoHttp:400}));
  });
  it('no altera respuesta de negocio si falla la tabla analitica',async()=>{
    eventos.insert.mockRejectedValue(new Error('tabla ausente'));
    await request(app.getHttpServer()).get('/api/kpi/mi-dashboard').auth(token(),{type:'bearer'}).expect(200,{nota:80});
  });
  it('excluye polling del layout sin dejar que un header omita la medicion',async()=>{
    await request(app.getHttpServer()).get('/api/auth/me').auth(token(),{type:'bearer'}).expect(200);
    await request(app.getHttpServer()).get('/api/kpi/mi-dashboard').set('X-Internal-Token','interno').auth(token(),{type:'bearer'}).expect(200);
    expect(eventos.insert).toHaveBeenCalledTimes(1);
    expect(clasificarUso('POST','/ai-tools/resumen-equipo')).toBeNull();
  });
  it('requiere autenticacion para entradas y no permite suplantar idUsuario',async()=>{
    const body={modulo:'KPI',eventoId:'3dc1dff9-19cb-4416-bebd-9e5d9167921a'};
    await request(app.getHttpServer()).post('/api/uso/entradas').send(body).expect(401);
    await request(app.getHttpServer()).post('/api/uso/entradas').auth(token(),{type:'bearer'}).send({...body,idUsuario:99}).expect(400);
    await request(app.getHttpServer()).post('/api/uso/entradas').auth(token(),{type:'bearer'}).send(body).expect(200,{registrado:true});
    expect(eventos.insert).toHaveBeenCalledTimes(1);expect(eventos.insert).toHaveBeenCalledWith(expect.objectContaining({idUsuario:7,origen:'NAVEGACION'}));
  });
  it('reintento con UUID repetido es idempotente',async()=>{
    eventos.insert.mockRejectedValue({code:'ER_DUP_ENTRY'});
    await request(app.getHttpServer()).post('/api/uso/entradas').auth(token(),{type:'bearer'}).send({modulo:'KPI',eventoId:'3dc1dff9-19cb-4416-bebd-9e5d9167921a'}).expect(200);
  });
  it.each([1,2,3])('rol %s no consulta resumen ni recurrencia',async nivel=>{
    for(const ruta of ['resumen','recurrencia']) await request(app.getHttpServer()).get('/api/uso/'+ruta+'?desde=2026-10-01&hasta=2026-10-16').auth(token(nivel),{type:'bearer'}).expect(403);
    expect(eventos.query).not.toHaveBeenCalled();
  });
  it('valida rol actual en base, no solo JWT',async()=>{
    usuarios.findOne.mockResolvedValue({rol:{isActive:true,nivelJerarquico:3}});
    await request(app.getHttpServer()).get('/api/uso/resumen?desde=2026-10-01&hasta=2026-10-16').auth(token(4),{type:'bearer'}).expect(403);
  });
  it('resume con parametros y no registra su propia consulta',async()=>{
    eventos.query.mockResolvedValue([{}]);
    await request(app.getHttpServer()).get('/api/uso/resumen?desde=2026-10-01&hasta=2026-10-16&modulo=KPI&idUsuario=7').auth(token(4),{type:'bearer'}).expect(200);
    expect(eventos.query).toHaveBeenCalledTimes(3);
    expect(eventos.query.mock.calls[0][1]).toEqual(['2026-10-01 06:00:00.000','2026-10-17 06:00:00.000','KPI',7]);
    expect(eventos.insert).not.toHaveBeenCalled();
  });
  it('rechaza rangos invalidos antes de consultar',async()=>{
    await request(app.getHttpServer()).get('/api/uso/resumen?desde=2026-02-30&hasta=2026-03-01').auth(token(4),{type:'bearer'}).expect(400);
    expect(eventos.query).not.toHaveBeenCalled();
  });
});
describe('Reglas de medicion',()=>{
  it('fecha local incluye el dia completo y limita amplitud',()=>{
    expect(rangoUso({desde:'2026-10-16',hasta:'2026-10-16'}).dias).toBe(1);
    expect(()=>rangoUso({desde:'2025-01-01',hasta:'2026-10-16'})).toThrow();
  });
  it('distingue IA/procesos/actualizaciones de altas',()=>{
    expect(clasificarUso('POST','/ia/analizar')?.accion).toBe('CONSULTA_IA');
    expect(clasificarUso('POST','/performance/etl/bodega')?.accion).toBe('PROCESO_EJECUTADO');
    expect(clasificarUso('PUT','/kpi/ventas/metas')?.accion).toBe('REGISTRO_GUARDADO');
    expect(clasificarUso('GET','/expedientes/:idExpediente/documentos/:idDocumento/descargar')?.accion).toBe('DESCARGA_DOCUMENTO');
  });
});
