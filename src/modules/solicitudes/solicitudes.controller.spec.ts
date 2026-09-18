import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';
import { PATH_METADATA } from '@nestjs/common/constants';

describe('SolicitudesController', () => {
  it('exposes the authenticated incidence catalog on a static route', () => {
    const findTiposIncidencia = jest.fn().mockResolvedValue([]);
    const controller = new SolicitudesController({ findTiposIncidencia } as unknown as SolicitudesService);
    expect(Reflect.getMetadata(PATH_METADATA, controller.findTiposIncidencia)).toBe('tipos-incidencia');
    controller.findTiposIncidencia();
    expect(findTiposIncidencia).toHaveBeenCalledTimes(1);
  });
});
