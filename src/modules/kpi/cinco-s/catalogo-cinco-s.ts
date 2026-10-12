// Fuente: Copia de 5s Inter Tornillo.xlsx, FORMATO!B9:E28.
export const CATEGORIAS_CINCO_S = [
  {
    "id": 1,
    "nombre": "Clasificación",
    "criterios": [
      {
        "id": 1,
        "concepto": "Cosas innecesarias en el área de trabajo.",
        "pregunta": "¿Existen elementos no asociados al trabajo o innecesarios en el área? \nVerificar pisos, mesas de trabajo, compartimentos, cielos y equipos."
      },
      {
        "id": 2,
        "concepto": "Cosas innecesarias en el área de trabajo.",
        "pregunta": "¿Existen elementos personales innecesarios en el puesto de trabajo? \nVerificar pisos, mesas de trabajo, compartimentos, cielos y equipos."
      },
      {
        "id": 3,
        "concepto": "Decidir sobre lo inutil.",
        "pregunta": "¿Cuentan con recipientes para disponer adecuadamente los materiales no útiles que puedan generarse en el área?"
      },
      {
        "id": 4,
        "concepto": "Descartar de la manera más adecuada.",
        "pregunta": "¿Separan adecuadamente aquellos desechos que se puedan generar en el área? \nPapel, aluminio, plástico, biodegradables, entre otros."
      }
    ]
  },
  {
    "id": 2,
    "nombre": "Organización",
    "criterios": [
      {
        "id": 5,
        "concepto": "Ordenar lo que es útil.",
        "pregunta": "¿Todos los recursos que son útiles para el área están dispuestos de manera ordenada?\nVerificar pisos, mesas de trabajo, compartimentos, cielos y equipos. Confrontar con estándar."
      },
      {
        "id": 6,
        "concepto": "Un lugar para cada cosa.",
        "pregunta": "¿Existen indicios de que los recursos útiles están siendo colocados según una posición determinada?"
      },
      {
        "id": 7,
        "concepto": "Demarcación.",
        "pregunta": "¿Existen líneas que delimitan claramente las áreas de trabajo y las zonas de tránsito? ¿Existen pasillos obstruidos? Para el caso de oficinas aplica únicamente la obstrucción de pasillos."
      },
      {
        "id": 8,
        "concepto": "Rotulación.",
        "pregunta": "¿Existen indicios de que los recursos útiles están siendo identificados por medio de rótulos? \nPor ejemplo: Secciones de un equipo, botoneras en tableros de control, archiveros en oficinas."
      }
    ]
  },
  {
    "id": 3,
    "nombre": "Limpieza",
    "criterios": [
      {
        "id": 9,
        "concepto": "Un espacio limpio y no ensuciar",
        "pregunta": "¿Se mantiene el piso limpio? Verificar ausencia de derrames, polvo en cantidades obvias, materiales superfluos distribuidos aleatoriamente."
      },
      {
        "id": 10,
        "concepto": "Un espacio limpio y no ensuciar",
        "pregunta": "¿Las máquinas y equipos del área se conservan limpios, libres de polvo, derrames, desperdicios, basura?"
      },
      {
        "id": 11,
        "concepto": "Un espacio limpio y no ensuciar",
        "pregunta": "¿Las paredes del área se conservan limpias y adecuadamente pintadas? \nIncluir los equipos instalados en paredes como por ejemplo A/C o ventiladores de pared."
      },
      {
        "id": 12,
        "concepto": "Un espacio limpio y no ensuciar",
        "pregunta": "¿Los techos y/o cielos falsos se conservan limpios y en buenas condiciones? Telas de araña visibles?"
      }
    ]
  },
  {
    "id": 4,
    "nombre": "Estandarización",
    "criterios": [
      {
        "id": 13,
        "concepto": "Responsabilidad.",
        "pregunta": "¿Existe un listado de responsables por sector para efectos de orden y limpieza?"
      },
      {
        "id": 14,
        "concepto": "Estándares.",
        "pregunta": "¿Existen Estandares de orden y limpieza en el área? Se cumplen?"
      },
      {
        "id": 15,
        "concepto": "Seguridad.",
        "pregunta": "¿Están los empleados utilizando el uniforme y el EPP de acuerdo a la tarea?"
      },
      {
        "id": 16,
        "concepto": "Control visual",
        "pregunta": "¿Se auxilian de controles visuales para facilitar la comunicación de reglas o controles en el área?"
      }
    ]
  },
  {
    "id": 5,
    "nombre": "Disciplina",
    "criterios": [
      {
        "id": 17,
        "concepto": "Entrenamiento.",
        "pregunta": "¿Está todo el personal entrenado en el estándar y en los conceptos de 5S's? Cumplen las reglas y el estándar?"
      },
      {
        "id": 18,
        "concepto": "Condiciones normales de operación.",
        "pregunta": "¿Se observan condiciones anormales de operación o situaciones improvisadas?"
      },
      {
        "id": 19,
        "concepto": "Auditorias.",
        "pregunta": "¿Las auditorias se realizan de acuerdo al plan? Existe evidencia que se realizó la auditoria anterior? Cuál fue la calificación?"
      },
      {
        "id": 20,
        "concepto": "Reconocimiento.",
        "pregunta": "¿Están siendo reconocidos los diferentes equipos por su esfuerzo en pro del orden, la limpieza y la mejora continua?"
      }
    ]
  }
] as const;
export const ESCALA_CINCO_S = [
  "Muy deficiente", "Deficiente", "Regular", "Bueno", "Excelente", "Supera expectativas",
] as const;
