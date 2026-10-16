import { MetricaKpi } from '../entities/metrica-kpi.entity';
import { RangoKpi } from '../entities/rango-kpi.entity';
import { MetaKpiEmpleado } from '../entities/meta-kpi-empleado.entity';
import { VentasSap } from '../../integrations/sap/interfaces/ventas-sap.interface';
import { aporte, dec, porcentaje, texto, VENTAS } from './ventas-reglas';
import { KpiVentasRegla } from '../entities/kpi-ventas-regla.entity';
export function calcularVentas(sap: VentasSap, mes: number, metas: MetaKpiEmpleado[], clientes: bigint,
  metricas: MetricaKpi[], rangos: RangoKpi[], configuradas?: KpiVentasRegla[]) {
  const mensual = metas.find(m => m.periodoMes === mes)?.metaObjetivo ?? null;
  const faltantes = Array.from({ length: mes }, (_, i) => i + 1).filter(m => !metas.some(x => x.periodoMes === m && dec(x.metaObjetivo) > 0n));
  const acumulada = faltantes.length ? null : texto(metas.filter(m => m.periodoMes <= mes).reduce((a, m) => a + dec(m.metaObjetivo), 0n), 2);
  const facturacion = dec(sap.facturacionPeriodoConIVA), nc = dec(sap.notasCreditoPeriodoConIVA);
  const cartera = dec(sap.carteraDeudora);
  const valores: Record<string, bigint | null> = {
    VEN_META_MENSUAL: facturacion - nc,
    VEN_META_ACUMULADA: dec(sap.ventasNetasAcumuladasConIVA),
    VEN_NUEVOS_CLIENTES: clientes,
    VEN_NOTAS_CREDITO: facturacion > 0n ? porcentaje(nc, facturacion) : null,
    VEN_CARTERA_SANA: cartera > 0n ? porcentaje(dec(sap.carteraMenor60), cartera) : null,
  };
  let total = 0n;
  const resultados = Object.entries(VENTAS).map(([codigo, peso]) => {
    const metrica = metricas.find(m => m.codigoKpi === codigo)!;
    const meta = codigo === 'VEN_META_MENSUAL' ? mensual : codigo === 'VEN_META_ACUMULADA' ? acumulada :
      codigo === 'VEN_NUEVOS_CLIENTES' ? metrica.metaObjetivo ?? '4' : codigo === 'VEN_NOTAS_CREDITO' ? String(configuradas?.find(r => r.idMetrica === metrica.idMetrica)?.configuracion.umbral ?? '0.45') : null;
    const valor = valores[codigo];
    let estado = 'OK', cumplimiento: bigint | null = null, puntos: bigint | null = null;
    const reglas = rangos.filter(r => r.idMetrica === metrica.idMetrica && r.isActive);
    const configurada = configuradas?.find(r => r.idMetrica === metrica.idMetrica);
    if (metrica.isActive === false) estado = 'REGLA_PENDIENTE';
    else if (valor === null) estado = 'SIN_DENOMINADOR';
    else if (codigo === 'VEN_META_ACUMULADA' && faltantes.length) estado = 'META_INCOMPLETA';
    else if (['VEN_META_MENSUAL', 'VEN_META_ACUMULADA', 'VEN_NUEVOS_CLIENTES'].includes(codigo)) {
      if (!meta || dec(meta) <= 0n) estado = 'SIN_META';
      else { const real = porcentaje(valor, dec(meta)); cumplimiento = real < 0n ? 0n : real > dec(100) ? dec(100) : real; puntos = aporte(cumplimiento, dec(peso)); }
    } else if (codigo === 'VEN_NOTAS_CREDITO' && nc < 0n) {
      estado = 'REVISION_NC_NEGATIVAS';
    } else if (configuradas !== undefined) {
      // Ausencia/configuracion invalida nunca se traduce en un cero oficial.
      try {
        const regla = configurada?.configuracion;
        if (!regla || !Number.isSafeInteger(configurada?.version) || configurada!.version < 1) throw new Error();
        if (codigo === 'VEN_NOTAS_CREDITO' && regla.tipo === 'UMBRAL_MAXIMO') {
          const umbral = dec(regla.umbral), dentro = dec(regla.cumplimientoHastaUmbral), fuera = dec(regla.cumplimientoSobreUmbral);
          if (umbral < 0n || dentro < 0n || dentro > dec(100) || fuera < 0n || fuera > dec(100)) throw new Error();
          // Comparacion racional exacta: no truncar el porcentaje a 4/6 decimales.
          cumplimiento = nc * 100n * dec(1) <= facturacion * umbral ? dentro : fuera;
        } else if (codigo === 'VEN_CARTERA_SANA' && regla.tipo === 'PROPORCIONAL') {
          const base = dec(regla.base), maximo = dec(regla.cumplimientoMaximo);
          if (base <= 0n || maximo <= 0n || maximo > dec(100)) throw new Error();
          if (dec(sap.carteraMenor60) < 0n) { estado = 'REVISION_CARTERA_NEGATIVA'; }
          else {
            const real = porcentaje(valor, base);
            cumplimiento = real > maximo ? maximo : real;
          }
        } else throw new Error();
        if (cumplimiento !== null) puntos = aporte(cumplimiento, dec(peso));
      } catch { estado = 'REGLA_PENDIENTE'; cumplimiento = null; puntos = null; }
    } else {
      // Las bandas son inclusivas. Solapamientos o huecos no inventan una calificacion.
      const banda = reglas.filter(r => valor >= dec(r.valorMinimo) && valor <= dec(r.valorMaximo));
      if (banda.length !== 1 || dec(banda[0].puntosOtorgados) < 0n || dec(banda[0].puntosOtorgados) > dec(peso) || dec(banda[0].porcentajeCumplimiento) < 0n || dec(banda[0].porcentajeCumplimiento) > dec(100)) estado = 'REGLA_PENDIENTE';
      else { cumplimiento = dec(banda[0].porcentajeCumplimiento); puntos = dec(banda[0].puntosOtorgados); }
    }
    if (puntos !== null) total += puntos;
    return { idMetrica: metrica.idMetrica, codigo, pesoPorcentaje: peso, valorObtenido: valor === null ? null : texto(valor, 6),
      metaAplicada: meta, estado, porcentajeCumplimiento: cumplimiento === null ? null : texto(cumplimiento),
      puntos: puntos === null ? null : texto(puntos), mesesFaltantes: codigo === 'VEN_META_ACUMULADA' ? faltantes : [],
      explicacion: estado === 'SIN_DENOMINADOR' ? (codigo === 'VEN_NOTAS_CREDITO' ? 'Sin facturacion positiva' : 'Sin cartera deudora positiva') : null,
      reglaAplicada: configurada ? { tipo: String(configurada.configuracion.tipo), version: configurada.version,
        configuracion: configurada.configuracion, negativos: 'REVISION', sinDenominador: 'PENDIENTE' } :
        { tipo: codigo === 'VEN_NOTAS_CREDITO' || codigo === 'VEN_CARTERA_SANA' ? 'RANGOS' : 'PROPORCIONAL_LIMITADO_100', rangos: reglas },
    };
  });
  const completa = resultados.every(r => r.estado === 'OK');
  return { estado: completa ? 'COMPLETA' : 'INCOMPLETA', notaFinal: completa ? texto(total, 2) : null, resultados };
}
