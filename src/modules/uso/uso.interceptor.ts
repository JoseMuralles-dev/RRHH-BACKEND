import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { performance } from 'node:perf_hooks';
import { UsoService } from './uso.service';
import { clasificarUso } from './uso-reglas';
@Injectable()
export class UsoInterceptor implements NestInterceptor {
  constructor(private readonly uso:UsoService) {}
  intercept(context:ExecutionContext,next:CallHandler):Observable<unknown> {
    if (context.getType()!=='http' || !this.uso.habilitado()) return next.handle();
    const req=context.switchToHttp().getRequest();
    const res=context.switchToHttp().getResponse();
    const ruta=req.route?.path;
    if (typeof ruta!=='string' || ruta.length>180) return next.handle();
    const clasificacion=clasificarUso(req.method,ruta);
    if (!clasificacion) return next.handle();
    let idUsuario=req.user?.idUsuario;
    let nivelRol=req.user?.nivelJerarquico;
    let negocioExitoso=true;
    const inicio=performance.now();
    // finish ocurre despues de la respuesta HTTP, incluidos errores de pipes/handlers.
    res.once('finish',()=>{
      if (!Number.isSafeInteger(idUsuario) || idUsuario<1) return;
      void this.uso.registrar({idUsuario,nivelRol:[1,2,3,4].includes(nivelRol)?nivelRol:null,
        ...clasificacion,origen:'API',metodo:req.method,ruta,estadoHttp:res.statusCode,
        exito:res.statusCode>=200 && res.statusCode<400 && negocioExitoso,
        duracionMs:Math.min(4294967295,Math.max(0,Math.round(performance.now()-inicio))),eventoCliente:null});
    });
    return next.handle().pipe(tap(data=>{
      if (clasificacion.accion==='INICIO_SESION') {
        idUsuario=data?.usuario?.idUsuario; nivelRol=data?.usuario?.nivel;
      }
      if (data?.guardado===false || (Array.isArray(data?.errores) && data.errores.length>0)) negocioExitoso=false;
    }));
  }
}
