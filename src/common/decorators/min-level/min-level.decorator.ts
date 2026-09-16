import { SetMetadata } from '@nestjs/common';

//export const MinLevel = (...args: string[]) => SetMetadata('min-level', args);

export const MIN_LEVEL_KEY = 'minLevel';
// Define el nivel jerárquico mínimo requerido: ADMIN=4, RRHH=3, JEFE_AREA=2, EMPLEADO=1
export const MinLevel = (level: number) => SetMetadata(MIN_LEVEL_KEY, level);