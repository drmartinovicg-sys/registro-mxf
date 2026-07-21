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

  return { VOCAB, NEGATIVAS, estadisticas, brief };
})();
