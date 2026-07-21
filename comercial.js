/* ============================================================
   Inteligencia comercial — traducción clínico → búsqueda
   Todo lo que hay acá es vocabulario, no datos de pacientes.
   El panel solo consume estadística agregada del índice.
   ============================================================ */
window.MXF_COMERCIAL = (function () {

  /* Por cada categoría diagnóstica: cómo lo nombras tú, cómo lo
     busca un paciente, y con qué intención comercial llega. */
  const VOCAB = {
    trauma: {
      tema: "Trauma facial y de urgencia",
      clinico: ["fractura mandibular", "fractura orbitaria", "fractura malar", "RAFI", "osteosíntesis"],
      paciente: [
        "me quebré la mandíbula", "fractura de mandíbula qué hacer",
        "golpe fuerte en la cara hinchazón", "me duele la mandíbula después de un golpe",
        "fractura de pómulo", "no puedo cerrar bien la boca después de un golpe",
      ],
      comercial: [
        "cirujano maxilofacial urgencia santiago",
        "traumatólogo maxilofacial santiago",
        "fractura mandibular tratamiento santiago",
      ],
      contenidos: [
        "Qué hacer en las primeras 24 horas tras un golpe en la cara",
        "Cómo se sabe si una fractura facial necesita cirugía",
        "Cuánto demora la recuperación de una fractura mandibular",
      ],
    },
    ortognatica: {
      tema: "Cirugía ortognática",
      cat: "ortognatica",
      clinico: ["clase III esquelética", "LeFort I", "osteotomía sagital", "mentoplastia", "mordida abierta"],
      paciente: [
        "cirugía de mandíbula estética", "tengo la mandíbula muy adelantada",
        "mentón muy chico solución", "mordida cruzada cirugía",
        "cirugía ortognática precio", "cuánto dura la recuperación cirugía ortognática",
        "brackets antes de cirugía de mandíbula",
      ],
      comercial: [
        "cirugía ortognática santiago",
        "cirujano ortognática precio chile",
        "cirugía ortognática isapre cobertura",
      ],
      contenidos: [
        "Cirugía ortognática: quién es candidato y quién no",
        "El recorrido completo: ortodoncia, cirugía y postoperatorio mes a mes",
        "Cuánto cuesta realmente una cirugía ortognática en Chile",
        "Antes y después: qué cambia en el perfil facial",
      ],
    },
    patologia: {
      tema: "Patología y tumores maxilofaciales",
      clinico: ["quiste dentígero", "ameloblastoma", "biopsia incisional", "enucleación", "lesión ósea"],
      paciente: [
        "quiste en la mandíbula", "bulto en la encía que no duele",
        "mancha blanca en la boca hace meses", "tumor en el maxilar es grave",
        "biopsia de boca dónde",
      ],
      comercial: [
        "biopsia oral santiago",
        "especialista lesiones bucales santiago",
        "quiste maxilar tratamiento",
      ],
      contenidos: [
        "Cuándo una lesión en la boca merece biopsia",
        "Quistes maxilares: por qué crecen sin doler",
        "Señales de alarma en la mucosa oral",
      ],
    },
    dentoalveolar: {
      tema: "Cirugía dentoalveolar",
      clinico: ["tercer molar incluido", "canino retenido", "exodoncia compleja", "alveoloplastia"],
      paciente: [
        "sacarse las muelas del juicio", "muela del juicio con anestesia general",
        "cuánto cuesta sacar las muelas del juicio", "diente retenido tratamiento",
        "recuperación muelas del juicio",
      ],
      comercial: [
        "extracción muelas del juicio santiago",
        "cirugía muelas del juicio precio",
        "sedación muelas del juicio santiago",
      ],
      contenidos: [
        "Muelas del juicio: cuándo hay que sacarlas y cuándo no",
        "Sedación o anestesia local: cómo se elige",
        "Los 7 días después de una extracción compleja",
      ],
    },
    implantes: {
      tema: "Implantes y reconstrucción",
      clinico: ["injerto óseo", "elevación de seno maxilar", "regeneración ósea guiada", "carga inmediata"],
      paciente: [
        "implante dental precio", "no tengo hueso para implante",
        "implante dental cuánto dura", "perdí un diente qué hago",
        "injerto de hueso dental duele",
      ],
      comercial: [
        "implantes dentales santiago",
        "implante dental con injerto óseo",
        "rehabilitación oral implantes santiago",
      ],
      contenidos: [
        "Por qué a veces hace falta injerto antes del implante",
        "Implante inmediato vs. diferido: qué conviene en cada caso",
        "Cuánto dura un implante bien hecho",
      ],
    },
    atm: {
      tema: "ATM y dolor orofacial",
      clinico: ["desplazamiento discal", "artrocentesis", "bruxismo", "trastorno temporomandibular"],
      paciente: [
        "me suena la mandíbula al abrir", "dolor de mandíbula al masticar",
        "no puedo abrir bien la boca", "dolor de cabeza y mandíbula",
        "aprieto los dientes en la noche", "plano de relajación sirve",
      ],
      comercial: [
        "especialista ATM santiago",
        "tratamiento dolor mandíbula santiago",
        "trastorno temporomandibular tratamiento",
      ],
      contenidos: [
        "Por qué suena la mandíbula y cuándo preocuparse",
        "Bruxismo: qué funciona de verdad",
        "Dolor facial crónico: cuándo es ATM y cuándo no",
      ],
    },
    infeccion: {
      tema: "Infecciones odontogénicas",
      clinico: ["absceso submandibular", "celulitis facial", "drenaje", "flegmón"],
      paciente: [
        "cara hinchada por muela", "absceso dental urgencia",
        "infección dental hinchazón ojo", "flemón en la cara qué hacer",
      ],
      comercial: [
        "urgencia absceso dental santiago",
        "infección facial urgencia maxilofacial",
      ],
      contenidos: [
        "Cuándo una infección dental deja de ser dental",
        "Señales de que una hinchazón facial es urgencia",
      ],
    },
    glandulas: {
      tema: "Glándulas salivales",
      clinico: ["sialolitiasis", "submaxilectomía", "parotidectomía", "mucocele"],
      paciente: [
        "hinchazón bajo la mandíbula al comer", "piedra en la glándula salival",
        "bolita en el labio transparente", "glándula salival inflamada",
      ],
      comercial: [
        "cirugía glándula salival santiago",
        "sialolitiasis tratamiento",
      ],
      contenidos: [
        "Por qué se hincha la glándula justo al comer",
        "Mucocele: la bolita del labio que vuelve a aparecer",
      ],
    },
    otro: {
      tema: "Otros procedimientos",
      clinico: [],
      paciente: ["cirujano maxilofacial qué hace", "cuándo ir a un maxilofacial"],
      comercial: ["cirujano maxilofacial santiago", "cirujano maxilofacial cerca de mí"],
      contenidos: ["Qué resuelve un cirujano maxilofacial (y qué no)"],
    },
  };


  /* ============================================================
     Focos comerciales
     Tres procedimientos electivos: el paciente investiga, compara
     y decide. Ahí la publicidad rinde; en urgencias no.
     Límites de Google Ads: títulos ≤30, descripciones ≤90.
     ============================================================ */
  const FOCOS = {
    implantes: {
      tema: "Implantes dentales",
      cat: "implantes",
      porque: "Alta intención de búsqueda y decisión económica meditada. El diferenciador es la complejidad: casos con poco hueso que otros derivan.",
      embudo: {
        descubrimiento: [
          "perdí un diente qué hago",
          "implante o puente cuál es mejor",
          "se me aflojó el puente",
          "no tengo hueso para implante",
          "cuánto dura un implante dental",
        ],
        consideracion: [
          "implante dental con injerto óseo",
          "elevación de seno maxilar qué es",
          "implante dental duele",
          "cirugía guiada implantes",
          "implante inmediato después de extracción",
        ],
        decision: [
          "implantes dentales santiago",
          "implante dental precio santiago",
          "cirujano maxilofacial implantes santiago",
          "implantes dentales providencia",
          "especialista implantes casos complejos",
        ],
      },
      titulos: [
        "Implantes Dentales Santiago",
        "Cirujano Maxilofacial",
        "Implantes con Injerto Óseo",
        "Planificación 3D Guiada",
        "Casos con Poco Hueso",
        "Agenda tu Evaluación",
      ],
      descripciones: [
        "Cirujano maxilofacial. Planificación 3D y cirugía guiada en cada caso.",
        "Resolvemos casos con pérdida ósea que requieren injerto o elevación de seno.",
        "Evaluación con escáner CBCT y plan de tratamiento por escrito.",
      ],
      landing: [
        "Encabezado: qué resuelves y para quién",
        "Los tres escenarios: diente único, varios dientes, poco hueso",
        "Cómo se planifica: CBCT, cirugía guiada, plazos reales",
        "Qué incluye el presupuesto y qué no",
        "Casos con consentimiento de difusión",
        "Formulario breve y WhatsApp directo",
      ],
      negativas: ["barato", "económico", "más barato", "turquía", "colombia", "seguro dental", "fonasa cuánto cubre"],
    },

    ortognatica: {
      tema: "Cirugía ortognática",
      cat: "ortognatica",
      porque: "Ciclo de decisión largo, de meses. El contenido educativo es el que construye la confianza, y el ortodoncista es un canal de derivación tan importante como el anuncio.",
      embudo: {
        descubrimiento: [
          "tengo la mandíbula muy adelantada",
          "mentón muy chico solución",
          "mordida abierta se puede corregir",
          "perfil facial retraído",
          "cirugía de mandíbula estética",
        ],
        consideracion: [
          "cuánto dura la recuperación cirugía ortognática",
          "cirugía ortognática antes y después",
          "brackets antes de cirugía de mandíbula",
          "cirugía ortognática riesgos",
          "cirugía ortognática cobertura isapre",
        ],
        decision: [
          "cirugía ortognática santiago",
          "cirugía ortognática precio chile",
          "cirujano ortognática santiago",
          "evaluación cirugía ortognática",
        ],
      },
      titulos: [
        "Cirugía Ortognática",
        "Cirujano Maxilofacial",
        "Planificación Virtual 3D",
        "Evaluación Ortognática",
        "Trabajo con tu Ortodoncista",
        "Agenda tu Evaluación",
      ],
      descripciones: [
        "Planificación virtual 3D y cirugía guiada. Coordinación con tu ortodoncista.",
        "Evaluación completa con escáner y simulación del resultado facial.",
        "Te explicamos plazos, etapas y costos por escrito antes de decidir.",
      ],
      landing: [
        "Encabezado: qué corrige y en quién está indicada",
        "El recorrido completo: ortodoncia, cirugía, postoperatorio mes a mes",
        "Planificación virtual: qué se puede prever y qué no",
        "Costos y cobertura: rangos honestos",
        "Casos con consentimiento de difusión",
        "Formulario y coordinación con el ortodoncista tratante",
      ],
      negativas: ["gratis", "fonasa gratis", "hospital público", "lista de espera", "sin brackets"],
    },

    atm: {
      tema: "Cirugía y trastornos de ATM",
      cat: "atm",
      porque: "Alto volumen de búsqueda y pacientes que llevan años sin diagnóstico claro. Poca competencia especializada real: la mayoría ofrece solo plano de relajación.",
      embudo: {
        descubrimiento: [
          "me suena la mandíbula al abrir",
          "dolor de mandíbula al masticar",
          "no puedo abrir bien la boca",
          "dolor de cabeza y mandíbula",
          "aprieto los dientes en la noche",
        ],
        consideracion: [
          "plano de relajación sirve",
          "artrocentesis atm qué es",
          "resonancia de atm cuándo",
          "tratamiento disfunción temporomandibular",
          "bruxismo tratamiento definitivo",
        ],
        decision: [
          "especialista atm santiago",
          "tratamiento atm santiago",
          "cirujano maxilofacial atm",
          "consulta dolor mandibular santiago",
        ],
      },
      titulos: [
        "Especialista en ATM",
        "Trastornos de ATM",
        "Cirujano Maxilofacial",
        "Evaluación ATM Santiago",
        "Diagnóstico con Imágenes",
        "Agenda tu Evaluación",
      ],
      descripciones: [
        "Evaluación especializada de la articulación temporomandibular en Santiago.",
        "Diagnóstico con imágenes y plan escalonado, desde conservador hasta cirugía.",
        "Atención por cirujano maxilofacial, no solo plano de relajación.",
      ],
      landing: [
        "Encabezado: qué es la ATM y qué se puede resolver",
        "Los cuadros más frecuentes y cómo se distinguen",
        "El plan escalonado: conservador, mínimamente invasivo, quirúrgico",
        "Qué esperar de cada etapa y en cuánto tiempo",
        "Preguntas frecuentes",
        "Formulario y agenda",
      ],
      negativas: ["ejercicios caseros", "remedio casero", "gratis", "youtube", "qué es atm significado"],
    },


    cigomaticos: {
      tema: "Implantes cigomáticos",
      cat: "implantes",
      texto: "cigom",
      porque: "El techo técnico de la implantología: resuelve el maxilar atrófico severo donde el implante convencional no tiene anclaje. Competencia mínima en Santiago y un paciente que llega derivado, no buscando. El canal profesional pesa tanto como el anuncio.",
      embudo: {
        descubrimiento: [
          "me dijeron que no tengo hueso para implantes",
          "perdí todos los dientes de arriba",
          "mi dentadura postiza se mueve",
          "el injerto de hueso no resultó",
          "no puedo usar prótesis removible",
        ],
        consideracion: [
          "implantes cigomáticos qué son",
          "implantes cigomáticos o injerto de hueso",
          "dientes fijos en un día es posible",
          "all on 4 sin hueso suficiente",
          "atrofia maxilar severa tratamiento",
          "implantes cigomáticos riesgos",
        ],
        decision: [
          "implantes cigomáticos santiago",
          "implantes cigomáticos chile precio",
          "cirujano implantes cigomáticos",
          "dientes fijos sin injerto santiago",
        ],
      },
      profesional: [
        "derivación implantes cigomáticos",
        "cuándo derivar atrofia maxilar severa",
        "alternativa a injerto de seno bilateral",
        "rehabilitación maxilar atrófico protocolo",
      ],
      titulos: [
        "Implantes Cigomáticos",
        "Dientes Fijos Sin Injerto",
        "Atrofia Maxilar Severa",
        "Cirujano Maxilofacial",
        "Planificación 3D y CBCT",
        "Evaluación Especializada",
      ],
      descripciones: [
        "Solución para maxilar atrófico sin necesidad de injertos óseos previos.",
        "Implantes anclados en hueso cigomático. Planificación 3D y carga inmediata.",
        "Cirujano maxilofacial. Evaluación con CBCT y plan de tratamiento por escrito.",
      ],
      landing: [
        "Encabezado: qué son y qué problema resuelven",
        "A quién se indican: atrofia severa, injerto fallido, prótesis inestable",
        "Comparación honesta con injerto + implante convencional: plazos y etapas",
        "Cómo se planifica: CBCT, planificación virtual, guías quirúrgicas",
        "Carga inmediata: qué significa y qué no promete",
        "Riesgos y cómo se controlan",
        "Casos con consentimiento de difusión",
        "Sección para colegas: cuándo derivar y cómo coordinar",
        "Formulario y contacto directo",
      ],
      negativas: [
        "curso", "cursos", "diplomado", "capacitación", "hands on", "workshop",
        "congreso", "brånemark curso", "gratis", "barato", "turquía", "colombia",
      ],
    },
  };

  const FOCO_IDS = ["cigomaticos", "ortognatica", "atm", "implantes"];

  /* Los anuncios de salud no deben dirigirse a la condición del usuario.
     Sirve describir el servicio; no interpelar al paciente por su dolencia. */
  const REGLA_COPY = [
    "Redactar sobre el servicio, no sobre la condición del lector.",
    "Evitar: «¿Sufres de dolor de mandíbula?», «¿Te falta un diente?».",
    "Preferir: «Especialista en ATM en Santiago», «Implantes con injerto óseo».",
    "No prometer resultados ni usar superlativos («el mejor», «garantizado»).",
    "Las imágenes de casos requieren consentimiento escrito de difusión.",
  ];

  /* Términos que atraen tráfico que nunca se convierte en paciente. */
  const NEGATIVAS = [
    "gratis", "curso", "cursos", "diplomado", "universidad", "carrera",
    "sueldo", "cuánto gana", "trabajo", "empleo", "malla curricular",
    "pdf", "ppt", "monografía", "definición", "significado", "cie 10",
    "veterinario", "veterinaria", "perro", "gato", "caballo",
    "seguro", "demanda", "negligencia", "juicio",
  ];

  /* Estadística agregada. Recibe el índice (sin nombres para el cálculo). */
  function estadisticas(index, procFiltro) {
    const base = index.filter((e) =>
      !procFiltro || (e.procedencia || "consulta") === procFiltro
    );

    const porCat = {};
    const porMes = {};
    const procedimientos = {};

    base.forEach((e) => {
      porCat[e.catDx] = (porCat[e.catDx] || 0) + 1;
      const mes = (e.fechaCirugia || "").slice(0, 7);
      if (mes) porMes[mes] = (porMes[mes] || 0) + 1;
      const c = (e.cirugia || "").trim().toLowerCase();
      if (c) procedimientos[c] = (procedimientos[c] || 0) + 1;
    });

    const cats = Object.entries(porCat)
      .map(([id, n]) => ({ id, n, pct: Math.round((n / base.length) * 100) }))
      .sort((a, b) => b.n - a.n);

    const top = Object.entries(procedimientos)
      .map(([nombre, n]) => ({ nombre, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 10);

    const meses = Object.entries(porMes)
      .map(([mes, n]) => ({ mes, n }))
      .sort((a, b) => a.mes.localeCompare(b.mes));

    return { total: base.length, cats, top, meses };
  }


  /* Brief específico de los tres focos comerciales. */
  function briefFocos(index) {
    const L = [];
    const hoy = new Date().toISOString().slice(0, 10);
    const base = index.filter((e) => (e.procedencia || "consulta") === "consulta");

    const datos = (id) => {
      const f = FOCOS[id];
      const rx = f.texto ? new RegExp(f.texto, "i") : null;
      const casos = base.filter((e) =>
        e.catDx === (f.cat || id) && (!rx || rx.test(e.cirugia || ""))
      );
      return {
        n: casos.length,
        publicables: casos.filter((e) => e.consentImg === "difusion" && (e.nFotos || 0) > 0).length,
      };
    };

    L.push(`# Plan comercial — tres focos`);
    L.push(`Consulta Dr. Gonzalo Martinovic · Cirugía maxilofacial · Santiago`);
    L.push(`Generado el ${hoy}\n`);
    L.push(`> Estadística agregada de pacientes de consulta. No contiene datos identificables.`);
    L.push(`> Los pacientes HOSMIL quedan excluidos de todo uso comercial.\n`);

    L.push(`## Resumen\n`);
    L.push(`| Foco | Casos | Publicables |`);
    L.push(`|---|---|---|`);
    FOCO_IDS.forEach((id) => {
      const d = datos(id);
      L.push(`| ${FOCOS[id].tema} | ${d.n} | ${d.publicables} |`);
    });
    L.push("");

    FOCO_IDS.forEach((id, i) => {
      const f = FOCOS[id];
      const d = datos(id);
      L.push(`---\n`);
      L.push(`# ${i + 1}. ${f.tema}\n`);
      L.push(`**Situación actual:** ${d.n} casos registrados, ${d.publicables} con consentimiento de difusión y fotografías.\n`);
      L.push(`**Por qué este foco:** ${f.porque}\n`);

      L.push(`## Palabras clave por etapa\n`);
      L.push(`**Descubrimiento** — aún no sabe que necesita cirujano. Contenido, no anuncios.\n`);
      f.embudo.descubrimiento.forEach((k) => L.push(`- ${k}`));
      L.push(`\n**Consideración** — compara opciones. Contenido profundo y remarketing no disponible en salud.\n`);
      f.embudo.consideracion.forEach((k) => L.push(`- ${k}`));
      L.push(`\n**Decisión** — busca dónde operarse. Acá va el presupuesto de Ads.\n`);
      f.embudo.decision.forEach((k) => L.push(`- ${k}`));

      if (f.profesional) {
        L.push(`\n**Canal profesional** — búsquedas de colegas que se topan con el caso.\n`);
        f.profesional.forEach((k) => L.push(`- ${k}`));
      }

      L.push(`\n## Anuncio de búsqueda\n`);
      L.push(`Títulos (máx. 30 caracteres):\n`);
      f.titulos.forEach((t) => L.push(`- ${t} \`(${t.length})\``));
      L.push(`\nDescripciones (máx. 90 caracteres):\n`);
      f.descripciones.forEach((t) => L.push(`- ${t} \`(${t.length})\``));

      L.push(`\n## Negativas propias de este foco\n`);
      L.push("```");
      f.negativas.forEach((n) => L.push(n));
      L.push("```");

      L.push(`\n## Página de destino\n`);
      f.landing.forEach((x, j) => L.push(`${j + 1}. ${x}`));
      L.push("");
    });

    L.push(`---\n`);
    L.push(`## Redacción de anuncios en salud\n`);
    REGLA_COPY.forEach((r) => L.push(`- ${r}`));

    L.push(`\n## El canal de derivación profesional\n`);
    L.push(`En procedimientos de alta complejidad —cigomáticos sobre todo— el paciente rara vez te busca directo: llega derivado por el implantólogo u odontólogo que se topó con el límite de su caso. Ese canal merece tratamiento propio.\n`);
    L.push(`**Una ventaja regulatoria concreta:** desde mayo de 2025, Google excluyó explícitamente de la política de publicidad personalizada el contenido dirigido a profesionales de la salud en su capacidad profesional. Es decir, las restricciones que te impiden usar audiencias propias para campañas a pacientes **no aplican** cuando la campaña apunta a odontólogos. Ahí sí puedes usar listas propias y remarketing.\n`);
    L.push(`Qué construir para ese canal:\n`);
    L.push(`1. Una página específica para colegas: criterios de derivación, qué recibe de vuelta el derivador, cómo se coordina el seguimiento.`);
    L.push(`2. Material técnico —casos documentados, protocolo— que un implantólogo pueda leer sin sentirse evaluado.`);
    L.push(`3. Compromiso explícito de devolver al paciente a su tratante para la rehabilitación protésica. Es lo que destraba la derivación.`);
    L.push(`4. Presencia en sociedades y actividades gremiales: en nichos de este tamaño, sigue rindiendo más que el clic.\n`);

    L.push(`\n## Negativas generales\n`);
    L.push("```");
    NEGATIVAS.forEach((n) => L.push(n));
    L.push("```\n");

    L.push(`## Orden de ejecución sugerido\n`);
    L.push(`1. **Páginas de destino** — una por foco. Sin esto, el gasto en Ads se pierde.`);
    L.push(`2. **Contenido de descubrimiento** — alimenta el orgánico, que no tiene costo por clic.`);
    L.push(`3. **Ads sobre términos de decisión** — empezar por un solo foco y presupuesto acotado.`);
    L.push(`   En cigomáticos el volumen de búsqueda es bajo por definición: el objetivo no es tráfico, es estar presente en las pocas búsquedas que ocurren.`);
    L.push(`4. **Medición** — llamadas y formularios por foco, para saber cuál sostener.\n`);
    L.push(`Contrastar los volúmenes reales en el Planificador de Palabras Clave de Google, acotado a Santiago, antes de fijar presupuesto.`);

    return L.join("\n");
  }

  /* Brief de contenidos y keywords, priorizado por la mezcla real de casos. */
  function brief(stats, catLabel, procLabel) {
    const L = [];
    const hoy = new Date().toISOString().slice(0, 10);

    L.push(`# Brief comercial — Consulta Dr. Gonzalo Martinovic`);
    L.push(`Cirugía maxilofacial · Santiago`);
    L.push(`Generado el ${hoy} · Base: ${procLabel} · ${stats.total} casos\n`);
    L.push(`> Documento derivado de estadística agregada. No contiene datos de pacientes.\n`);

    L.push(`## 1. Mezcla real de casos\n`);
    if (!stats.cats.length) {
      L.push(`Sin casos registrados en esta base todavía.\n`);
    } else {
      stats.cats.forEach((c) => L.push(`- **${catLabel(c.id)}** — ${c.n} casos (${c.pct}%)`));
      L.push("");
      L.push(`La prioridad de contenidos sigue este orden. Producir sobre lo que efectivamente operas rinde más que cubrir todo el espectro de la especialidad.\n`);
    }

    if (stats.top.length) {
      L.push(`## 2. Procedimientos más frecuentes\n`);
      stats.top.forEach((p, i) => L.push(`${i + 1}. ${p.nombre} — ${p.n}`));
      L.push("");
    }

    if (stats.meses.length >= 3) {
      L.push(`## 3. Estacionalidad\n`);
      stats.meses.forEach((m) => L.push(`- ${m.mes}: ${m.n}`));
      L.push("");
      L.push(`Conviene adelantar campaña e inventario de contenidos 4 a 6 semanas antes de los meses altos.\n`);
    }

    L.push(`## 4. Calendario editorial priorizado\n`);
    stats.cats.slice(0, 5).forEach((c, i) => {
      const v = VOCAB[c.id];
      if (!v) return;
      L.push(`### ${i + 1}. ${v.tema} — ${c.pct}% de tu volumen\n`);
      v.contenidos.forEach((t) => L.push(`- ${t}`));
      L.push("");
    });

    L.push(`## 5. Palabras clave por prioridad\n`);
    L.push(`Agrupadas por intención. Las de **intención comercial** son las que conviene poner en campañas de búsqueda; las **informativas** alimentan artículos y posicionamiento orgánico.\n`);
    stats.cats.slice(0, 5).forEach((c) => {
      const v = VOCAB[c.id];
      if (!v) return;
      L.push(`### ${v.tema}\n`);
      L.push(`**Intención comercial (Ads)**`);
      v.comercial.forEach((k) => L.push(`- ${k}`));
      L.push(`\n**Informativas (contenido)**`);
      v.paciente.forEach((k) => L.push(`- ${k}`));
      L.push("");
    });

    L.push(`## 6. Palabras clave negativas\n`);
    L.push(`Excluir en todas las campañas para no pagar por tráfico que no consulta:\n`);
    L.push("```");
    NEGATIVAS.forEach((n) => L.push(n));
    L.push("```\n");

    L.push(`## 7. Restricciones de plataforma\n`);
    L.push(`- La salud es categoría sensible en Google Ads: no se puede segmentar por condición ni tratamiento.`);
    L.push(`- No usar listas propias (Customer Match, remarketing) para promocionar estos servicios: inhabilita la campaña.`);
    L.push(`- Sí permitido: campañas de búsqueda por intención, segmentación geográfica y audiencias predefinidas de Google.`);
    L.push(`- Imágenes de casos: solo con consentimiento escrito específico y vigente.\n`);

    return L.join("\n");
  }

  return { VOCAB, NEGATIVAS, FOCOS, FOCO_IDS, REGLA_COPY, estadisticas, brief, briefFocos };
})();
