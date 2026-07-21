const {
  useState,
  useEffect,
  useRef,
  useMemo
} = React;

/* ============================================================
   Registro Clínico — Cirugía Maxilofacial
   Aplicación autónoma (PWA). Datos en el dispositivo (IndexedDB).
   Google Drive vía API directa.
   ============================================================ */

const CATS = [{
  id: "trauma",
  label: "Trauma facial",
  color: "#B3402A"
}, {
  id: "ortognatica",
  label: "Cirugía ortognática",
  color: "#16606B"
}, {
  id: "patologia",
  label: "Patología / Tumores",
  color: "#6B2D5C"
}, {
  id: "dentoalveolar",
  label: "Dentoalveolar / Incluidos",
  color: "#2F6B3A"
}, {
  id: "implantes",
  label: "Implantes / Reconstrucción",
  color: "#8A6D1F"
}, {
  id: "atm",
  label: "ATM / TTM",
  color: "#3B4E8C"
}, {
  id: "infeccion",
  label: "Infecciones",
  color: "#A34A00"
}, {
  id: "glandulas",
  label: "Glándulas salivales",
  color: "#4E6E58"
}, {
  id: "otro",
  label: "Otro",
  color: "#5C5C5C"
}];
const catById = id => CATS.find(c => c.id === id) || CATS[CATS.length - 1];
window.MXF_CATS = CATS;
const PROCS = [{
  id: "hosmil",
  label: "Pacientes HOSMIL",
  corto: "HOSMIL",
  color: "#16606B"
}, {
  id: "consulta",
  label: "Pacientes Consulta Dr. Martinovic",
  corto: "Consulta",
  color: "#6B2D5C"
}];
// las fichas antiguas, sin este campo, se consideran de consulta
const procById = id => PROCS.find(x => x.id === id) || PROCS[1];
window.MXF_PROCS = PROCS;
const CONSENT = [{
  id: "no",
  label: "Sin consentimiento de imagen"
}, {
  id: "clinico",
  label: "Solo uso clínico interno"
}, {
  id: "docencia",
  label: "Docencia y congresos"
}, {
  id: "difusion",
  label: "Docencia y difusión pública"
}];
const EVO_TYPES = ["Control clínico", "Control imagenológico", "Curación", "Retiro de suturas", "Complicación", "Indicaciones", "Otro"];
const PHOTO_TAGS = ["Pre-op", "Intra-op", "Post-op", "RX / Imagen"];
const TAG_COLORS = {
  "Pre-op": "#16606B",
  "Intra-op": "#B3402A",
  "Post-op": "#2F6B3A",
  "RX / Imagen": "#B4690E"
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = iso => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
};
const age = iso => {
  if (!iso) return null;
  const b = new Date(iso),
    n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || n.getMonth() === b.getMonth() && n.getDate() < b.getDate()) a--;
  return a;
};

/* ---------- almacenamiento local (IndexedDB) ---------- */
const sGet = k => DB.get(k);
const sSet = (k, v) => DB.set(k, v);
const sDel = k => DB.del(k);

/* ---------- compresión de imágenes ---------- */
function compressImage(file, maxDim = 1000, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let {
          width,
          height
        } = img;
        if (width > maxDim || height > maxDim) {
          const r = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * r);
          height = Math.round(height * r);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------- ficha vacía ---------- */
const emptyPatient = () => ({
  id: uid(),
  folio: "",
  nombre: "",
  rut: "",
  nacimiento: "",
  sexo: "",
  telefono: "",
  prevision: "",
  antecedentes: "",
  alergias: "",
  medicamentos: "",
  procedencia: "hosmil",
  consentImg: "no",
  consentFecha: "",
  catDx: "dentoalveolar",
  diagnostico: "",
  cirugia: "",
  fechaCirugia: "",
  notas: "",
  evoluciones: [],
  photoIds: [],
  driveFolder: null,
  creado: todayISO()
});

/* ============================================================ */
function App() {
  const [drive, setDrive] = useState(Drive.status());
  const [screen, setScreen] = useState("list"); // list | form | patient | panel
  const [filterProc, setFilterProc] = useState(null);
  const [index, setIndex] = useState([]);
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState(null);
  const [groupByDx, setGroupByDx] = useState(false);
  const [toast, setToast] = useState(null);
  const notify = msg => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };
  useEffect(() => {
    (async () => {
      const idx = await sGet("mxf-index");
      setIndex(idx || []);
      setLoading(false);
      Drive.onChange(setDrive);
      const ds = await Drive.init();
      if (ds.state === "ready") await Drive.ensureAllCategories(false);
      Drive.flush(notify);
    })();
  }, []);
  const saveIndex = async next => {
    setIndex(next);
    await sSet("mxf-index", next);
  };
  const indexEntry = p => ({
    id: p.id,
    folio: p.folio,
    nombre: p.nombre,
    rut: p.rut,
    procedencia: p.procedencia || "consulta",
    catDx: p.catDx,
    consentImg: p.consentImg || "no",
    diagnostico: p.diagnostico,
    cirugia: p.cirugia,
    fechaCirugia: p.fechaCirugia,
    nFotos: p.photoIds.length,
    nEvo: p.evoluciones.length
  });
  const savePatient = async p => {
    await sSet(`mxf-p:${p.id}`, p);
    setIndex(prev => {
      const next = [indexEntry(p), ...prev.filter(e => e.id !== p.id)];
      sSet("mxf-index", next);
      return next;
    });
  };
  const openPatient = async id => {
    setLoading(true);
    const p = await sGet(`mxf-p:${id}`);
    if (p) {
      setPatient(p);
      setScreen("patient");
    } else notify("No se pudo cargar la ficha");
    setLoading(false);
  };
  const deletePatient = async p => {
    if (!window.confirm(`¿Eliminar la ficha de ${p.nombre}? Esta acción es permanente.`)) return;
    for (const pid of p.photoIds) await sDel(`mxf-ph:${p.id}:${pid}`);
    await sDel(`mxf-p:${p.id}`);
    await saveIndex(index.filter(e => e.id !== p.id));
    setScreen("list");
    setPatient(null);
    notify("Ficha eliminada");
  };

  /* ---------- filtrado ---------- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return index.filter(e => {
      if (filterProc && (e.procedencia || "consulta") !== filterProc) return false;
      if (filterCat && e.catDx !== filterCat) return false;
      if (!q) return true;
      return [e.nombre, e.rut, e.folio, e.diagnostico, e.cirugia].some(v => (v || "").toLowerCase().includes(q));
    });
  }, [index, search, filterCat, filterProc]);
  const grouped = useMemo(() => {
    if (!groupByDx) return null;
    const g = {};
    filtered.forEach(e => {
      (g[e.catDx] = g[e.catDx] || []).push(e);
    });
    return CATS.filter(c => g[c.id]?.length).map(c => ({
      cat: c,
      items: g[c.id]
    }));
  }, [filtered, groupByDx]);

  /* ---------- respaldo ---------- */
  const backupAll = async () => {
    notify("Generando respaldo…");
    const out = {
      app: "RegistroMXF",
      version: 1,
      fecha: todayISO(),
      patients: []
    };
    for (const e of index) {
      const p = await sGet(`mxf-p:${e.id}`);
      if (!p) continue;
      const photos = [];
      for (const pid of p.photoIds) {
        const ph = await sGet(`mxf-ph:${p.id}:${pid}`);
        if (ph) photos.push(ph);
      }
      out.patients.push({
        ...p,
        _photos: photos
      });
    }
    const blob = new Blob([JSON.stringify(out)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RegistroMXF_respaldo_${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
    notify(`Respaldo descargado (${out.patients.length} pacientes)`);
  };
  const importBackup = async file => {
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.patients)) throw new Error("formato");
      setLoading(true);
      let idx = [...index];
      for (const p of data.patients) {
        const photos = p._photos || [];
        const rec = {
          ...p
        };
        delete rec._photos;
        rec.photoIds = photos.map(ph => ph.id);
        for (const ph of photos) await sSet(`mxf-ph:${rec.id}:${ph.id}`, ph);
        await sSet(`mxf-p:${rec.id}`, rec);
        idx = [indexEntry(rec), ...idx.filter(e => e.id !== rec.id)];
      }
      await sSet("mxf-index", idx);
      setIndex(idx);
      setLoading(false);
      notify(`Respaldo restaurado: ${data.patients.length} pacientes`);
    } catch {
      setLoading(false);
      notify("Archivo de respaldo no válido");
    }
  };

  /* ============================================================ */
  return /*#__PURE__*/React.createElement("div", {
    style: S.app
  }, /*#__PURE__*/React.createElement("style", null, CSS), /*#__PURE__*/React.createElement("header", {
    style: S.header
  }, /*#__PURE__*/React.createElement("div", {
    style: S.headerInner
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: S.brandTop
  }, "CIRUGÍA MAXILOFACIAL"), /*#__PURE__*/React.createElement("div", {
    style: S.brandMain
  }, "Dr. Gonzalo Martinovic")), screen === "list" && /*#__PURE__*/React.createElement("button", {
    className: "btn-primary",
    onClick: () => {
      setEditDraft(emptyPatient());
      setScreen("form");
    }
  }, "+ Nueva ficha"), screen === "list" && /*#__PURE__*/React.createElement("button", {
    className: "btn-ghost",
    style: {
      marginLeft: 8
    },
    onClick: () => setScreen("panel")
  }, "Panel"), screen !== "list" && /*#__PURE__*/React.createElement("button", {
    className: "btn-ghost",
    onClick: () => {
      setScreen("list");
      setPatient(null);
      setEditDraft(null);
    }
  }, "← Pacientes"))), /*#__PURE__*/React.createElement(DriveBar, {
    drive: drive,
    notify: notify
  }), /*#__PURE__*/React.createElement("main", {
    style: S.main
  }, loading && /*#__PURE__*/React.createElement("div", {
    style: S.loading
  }, "Cargando…"), !loading && screen === "list" && /*#__PURE__*/React.createElement(ListScreen, {
    index: index,
    filtered: filtered,
    grouped: grouped,
    search: search,
    setSearch: setSearch,
    filterCat: filterCat,
    setFilterCat: setFilterCat,
    filterProc: filterProc,
    setFilterProc: setFilterProc,
    groupByDx: groupByDx,
    setGroupByDx: setGroupByDx,
    onOpen: openPatient,
    onBackup: backupAll,
    onImport: importBackup
  }), !loading && screen === "form" && editDraft && /*#__PURE__*/React.createElement(PatientForm, {
    draft: editDraft,
    onCancel: () => {
      setScreen(patient ? "patient" : "list");
      setEditDraft(null);
    },
    onSave: async p => {
      if (!p.nombre.trim()) {
        notify("El nombre es obligatorio");
        return;
      }
      await savePatient(p);
      setPatient(p);
      setEditDraft(null);
      setScreen("patient");
      notify("Ficha guardada");
      if (!p.driveFolder) {
        createDriveFolderFor(p).then(async df => {
          if (df) {
            const upd = {
              ...p,
              driveFolder: df
            };
            await savePatient(upd);
            setPatient(cur => cur && cur.id === p.id ? upd : cur);
            notify("📁 Carpeta creada en tu Drive");
          }
        });
      }
    }
  }), !loading && screen === "patient" && patient && /*#__PURE__*/React.createElement(PatientView, {
    patient: patient,
    onEdit: () => {
      setEditDraft({
        ...patient
      });
      setScreen("form");
    },
    onDelete: () => deletePatient(patient),
    onUpdate: async p => {
      setPatient(p);
      await savePatient(p);
    },
    notify: notify
  }), !loading && screen === "panel" && /*#__PURE__*/React.createElement(PanelComercial, {
    index: index,
    notify: notify
  })), toast && /*#__PURE__*/React.createElement("div", {
    style: S.toast
  }, toast));
}

/* ============================================================
   Lista de pacientes
   ============================================================ */
function ListScreen({
  index,
  filtered,
  grouped,
  search,
  setSearch,
  filterCat,
  setFilterCat,
  filterProc,
  setFilterProc,
  groupByDx,
  setGroupByDx,
  onOpen,
  onBackup,
  onImport
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: S.toolbar
  }, /*#__PURE__*/React.createElement("input", {
    style: S.search,
    placeholder: "Buscar por nombre, RUT, folio o diagnóstico…",
    value: search,
    onChange: e => setSearch(e.target.value)
  }), /*#__PURE__*/React.createElement("button", {
    className: groupByDx ? "seg seg-on" : "seg",
    onClick: () => setGroupByDx(false)
  }, "Por paciente"), /*#__PURE__*/React.createElement("button", {
    className: groupByDx ? "seg" : "seg seg-on",
    onClick: () => setGroupByDx(true),
    style: {
      marginLeft: -1
    }
  }, "Por diagnóstico")), /*#__PURE__*/React.createElement("div", {
    style: S.chipRow
  }, PROCS.map(x => {
    const n = index.filter(e => (e.procedencia || "consulta") === x.id).length;
    const on = filterProc === x.id;
    return /*#__PURE__*/React.createElement("button", {
      key: x.id,
      className: "chip",
      style: {
        borderColor: x.color,
        color: on ? "#fff" : x.color,
        background: on ? x.color : "transparent",
        fontWeight: 600
      },
      onClick: () => setFilterProc(on ? null : x.id)
    }, x.corto, " · ", n);
  })), /*#__PURE__*/React.createElement("div", {
    style: S.chipRow
  }, CATS.map(c => {
    const n = index.filter(e => e.catDx === c.id).length;
    if (!n) return null;
    const on = filterCat === c.id;
    return /*#__PURE__*/React.createElement("button", {
      key: c.id,
      className: "chip",
      style: {
        borderColor: c.color,
        color: on ? "#fff" : c.color,
        background: on ? c.color : "transparent"
      },
      onClick: () => setFilterCat(on ? null : c.id)
    }, c.label, " · ", n);
  })), index.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: S.empty
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      marginBottom: 6
    }
  }, "Sin pacientes registrados"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#66716F"
    }
  }, "Crea la primera ficha con el botón «+ Nueva ficha».")), index.length > 0 && filtered.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: S.empty
  }, "Sin resultados para esta búsqueda."), !groupByDx && filtered.map(e => /*#__PURE__*/React.createElement(PatientRow, {
    key: e.id,
    e: e,
    onOpen: onOpen
  })), groupByDx && grouped && grouped.map(({
    cat,
    items
  }) => /*#__PURE__*/React.createElement("div", {
    key: cat.id,
    style: {
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.groupHead,
      borderLeft: `4px solid ${cat.color}`
    }
  }, cat.label, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#8A9491",
      fontWeight: 400
    }
  }, "· ", items.length)), items.map(e => /*#__PURE__*/React.createElement(PatientRow, {
    key: e.id,
    e: e,
    onOpen: onOpen
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginTop: 26,
      justifyContent: "center",
      flexWrap: "wrap"
    }
  }, index.length > 0 && /*#__PURE__*/React.createElement("button", {
    className: "btn-ghost",
    onClick: onBackup
  }, "⇩ Respaldo completo"), /*#__PURE__*/React.createElement("label", {
    className: "btn-ghost",
    style: {
      cursor: "pointer"
    }
  }, "Restaurar respaldo", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "application/json,.json",
    style: {
      display: "none"
    },
    onChange: e => e.target.files[0] && onImport(e.target.files[0])
  }))));
}
function PatientRow({
  e,
  onOpen
}) {
  const cat = catById(e.catDx);
  return /*#__PURE__*/React.createElement("button", {
    className: "row",
    onClick: () => onOpen(e.id),
    style: {
      borderLeft: `4px solid ${cat.color}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 8,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: S.rowName
  }, e.nombre), e.folio && /*#__PURE__*/React.createElement("span", {
    style: S.folio
  }, "#", e.folio), e.rut && /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#66716F",
      fontSize: 13
    }
  }, e.rut)), /*#__PURE__*/React.createElement("div", {
    style: S.rowSub
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: cat.color,
      fontWeight: 600
    }
  }, cat.label), e.diagnostico ? ` — ${e.diagnostico}` : "", e.fechaCirugia ? ` · Qx ${fmtDate(e.fechaCirugia)}` : "")), /*#__PURE__*/React.createElement("div", {
    style: S.rowMeta
  }, /*#__PURE__*/React.createElement("span", {
    title: "Evoluciones"
  }, e.nEvo || 0, " evo"), /*#__PURE__*/React.createElement("span", {
    title: "Fotos"
  }, e.nFotos || 0, " 📷")));
}

/* ============================================================
   Formulario ficha
   ============================================================ */
function PatientForm({
  draft,
  onSave,
  onCancel
}) {
  const [p, setP] = useState(draft);
  const set = k => e => setP({
    ...p,
    [k]: e.target.value
  });
  return /*#__PURE__*/React.createElement("div", {
    style: S.card
  }, /*#__PURE__*/React.createElement("div", {
    style: S.cardTitle
  }, draft.nombre ? "Editar ficha" : "Nueva ficha"), /*#__PURE__*/React.createElement(Section, {
    label: "Identificación"
  }, /*#__PURE__*/React.createElement(Grid, null, /*#__PURE__*/React.createElement(Field, {
    label: "Nombre completo *"
  }, /*#__PURE__*/React.createElement("input", {
    style: S.input,
    value: p.nombre,
    onChange: set("nombre")
  })), /*#__PURE__*/React.createElement(Field, {
    label: "RUT"
  }, /*#__PURE__*/React.createElement("input", {
    style: S.input,
    value: p.rut,
    onChange: set("rut"),
    placeholder: "12.345.678-9"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "N° ficha / folio"
  }, /*#__PURE__*/React.createElement("input", {
    style: S.input,
    value: p.folio,
    onChange: set("folio")
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Fecha de nacimiento"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    style: S.input,
    value: p.nacimiento,
    onChange: set("nacimiento")
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Sexo"
  }, /*#__PURE__*/React.createElement("select", {
    style: S.input,
    value: p.sexo,
    onChange: set("sexo")
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "—"), /*#__PURE__*/React.createElement("option", null, "Masculino"), /*#__PURE__*/React.createElement("option", null, "Femenino"), /*#__PURE__*/React.createElement("option", null, "Otro"))), /*#__PURE__*/React.createElement(Field, {
    label: "Teléfono"
  }, /*#__PURE__*/React.createElement("input", {
    style: S.input,
    value: p.telefono,
    onChange: set("telefono")
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Previsión"
  }, /*#__PURE__*/React.createElement("input", {
    style: S.input,
    value: p.prevision,
    onChange: set("prevision"),
    placeholder: "Fonasa / Isapre / Institucional"
  })))), /*#__PURE__*/React.createElement(Section, {
    label: "Antecedentes"
  }, /*#__PURE__*/React.createElement(Grid, null, /*#__PURE__*/React.createElement(Field, {
    label: "Antecedentes mórbidos",
    full: true
  }, /*#__PURE__*/React.createElement("textarea", {
    style: S.textarea,
    rows: 2,
    value: p.antecedentes,
    onChange: set("antecedentes")
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Alergias"
  }, /*#__PURE__*/React.createElement("input", {
    style: S.input,
    value: p.alergias,
    onChange: set("alergias"),
    placeholder: "Sin alergias conocidas"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Medicamentos"
  }, /*#__PURE__*/React.createElement("input", {
    style: S.input,
    value: p.medicamentos,
    onChange: set("medicamentos")
  })))), /*#__PURE__*/React.createElement(Section, {
    label: "Diagnóstico y cirugía"
  }, /*#__PURE__*/React.createElement(Grid, null, /*#__PURE__*/React.createElement(Field, {
    label: "Procedencia *"
  }, /*#__PURE__*/React.createElement("select", {
    style: S.input,
    value: p.procedencia || "hosmil",
    onChange: set("procedencia")
  }, PROCS.map(x => /*#__PURE__*/React.createElement("option", {
    key: x.id,
    value: x.id
  }, x.label)))), /*#__PURE__*/React.createElement(Field, {
    label: "Categoría diagnóstica *"
  }, /*#__PURE__*/React.createElement("select", {
    style: S.input,
    value: p.catDx,
    onChange: set("catDx")
  }, CATS.map(c => /*#__PURE__*/React.createElement("option", {
    key: c.id,
    value: c.id
  }, c.label)))), /*#__PURE__*/React.createElement(Field, {
    label: "Diagnóstico específico"
  }, /*#__PURE__*/React.createElement("input", {
    style: S.input,
    value: p.diagnostico,
    onChange: set("diagnostico"),
    placeholder: "Ej: Fractura mandibular parasinfisiaria izq."
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Cirugía / procedimiento"
  }, /*#__PURE__*/React.createElement("input", {
    style: S.input,
    value: p.cirugia,
    onChange: set("cirugia"),
    placeholder: "Ej: RAFI con placas 2.0"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Fecha de cirugía"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    style: S.input,
    value: p.fechaCirugia,
    onChange: set("fechaCirugia")
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Notas / plan",
    full: true
  }, /*#__PURE__*/React.createElement("textarea", {
    style: S.textarea,
    rows: 3,
    value: p.notas,
    onChange: set("notas")
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Consentimiento de imagen"
  }, /*#__PURE__*/React.createElement("select", {
    style: S.input,
    value: p.consentImg || "no",
    onChange: set("consentImg")
  }, CONSENT.map(c => /*#__PURE__*/React.createElement("option", {
    key: c.id,
    value: c.id
  }, c.label)))), /*#__PURE__*/React.createElement(Field, {
    label: "Fecha del consentimiento"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    style: S.input,
    value: p.consentFecha || "",
    onChange: set("consentFecha")
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn-primary",
    onClick: () => onSave(p)
  }, "Guardar ficha"), /*#__PURE__*/React.createElement("button", {
    className: "btn-ghost",
    onClick: onCancel
  }, "Cancelar")));
}

/* ============================================================
   Vista paciente: Ficha | Evoluciones | Fotos
   ============================================================ */
function PatientView({
  patient,
  onEdit,
  onDelete,
  onUpdate,
  notify
}) {
  const [tab, setTab] = useState("ficha");
  const cat = catById(patient.catDx);
  const a = age(patient.nacimiento);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.card,
      borderTop: `4px solid ${cat.color}`,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      gap: 10,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "baseline",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20,
      fontWeight: 700
    }
  }, patient.nombre), patient.folio && /*#__PURE__*/React.createElement("span", {
    style: S.folio
  }, "#", patient.folio)), /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#66716F",
      fontSize: 13,
      marginTop: 3
    }
  }, patient.rut || "RUT —", a != null ? ` · ${a} años` : "", patient.prevision ? ` · ${patient.prevision}` : ""), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: cat.color,
      fontWeight: 700
    }
  }, cat.label), patient.diagnostico && /*#__PURE__*/React.createElement("span", null, " — ", patient.diagnostico)), (patient.cirugia || patient.fechaCirugia) && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "#3A4442",
      marginTop: 2
    }
  }, "Qx: ", patient.cirugia || "—", " ", patient.fechaCirugia && `· ${fmtDate(patient.fechaCirugia)}`), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, patient.driveFolder ? /*#__PURE__*/React.createElement("a", {
    className: "drive-link",
    href: patient.driveFolder.url,
    target: "_blank",
    rel: "noreferrer"
  }, "📁 Carpeta en Drive ↗") : /*#__PURE__*/React.createElement("button", {
    className: "btn-ghost",
    style: {
      padding: "5px 12px",
      fontSize: 12.5
    },
    onClick: async () => {
      notify("Creando carpeta en Drive…");
      const df = await createDriveFolderFor(patient);
      if (df) {
        onUpdate({
          ...patient,
          driveFolder: df
        });
        notify("📁 Carpeta creada en tu Drive");
      } else notify("No se pudo crear la carpeta — reintenta");
    }
  }, "📁 Crear carpeta en Drive"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "flex-start",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn-ghost",
    onClick: async () => {
      if (!patient.photoIds.length) {
        notify("Esta ficha no tiene fotos");
        return;
      }
      notify("Reenviando fotos a Drive…");
      for (const pid of patient.photoIds) await Drive.enqueue(patient.id, pid);
      Drive.flush(notify);
    }
  }, "↻ Reenviar fotos"), /*#__PURE__*/React.createElement("button", {
    className: "btn-ghost",
    onClick: () => exportPatientHTML(patient, notify)
  }, "⇩ Exportar"), /*#__PURE__*/React.createElement("button", {
    className: "btn-ghost",
    onClick: onEdit
  }, "Editar"), /*#__PURE__*/React.createElement("button", {
    className: "btn-danger",
    onClick: onDelete
  }, "Eliminar"))), (patient.alergias || patient.antecedentes) && /*#__PURE__*/React.createElement("div", {
    style: S.alertBox
  }, patient.alergias && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("b", null, "Alergias:"), " ", patient.alergias), patient.antecedentes && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("b", null, "Antecedentes:"), " ", patient.antecedentes), patient.medicamentos && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("b", null, "Fármacos:"), " ", patient.medicamentos))), /*#__PURE__*/React.createElement("div", {
    style: S.tabRow
  }, [["ficha", "Ficha"], ["evo", `Evoluciones (${patient.evoluciones.length})`], ["fotos", `Fotos e imágenes (${patient.photoIds.length})`]].map(([id, label]) => /*#__PURE__*/React.createElement("button", {
    key: id,
    className: tab === id ? "tab tab-on" : "tab",
    onClick: () => setTab(id)
  }, label))), tab === "ficha" && /*#__PURE__*/React.createElement(FichaTab, {
    patient: patient
  }), tab === "evo" && /*#__PURE__*/React.createElement(EvoTab, {
    patient: patient,
    onUpdate: onUpdate
  }), tab === "fotos" && /*#__PURE__*/React.createElement(FotosTab, {
    patient: patient,
    onUpdate: onUpdate,
    notify: notify
  }));
}
function FichaTab({
  patient
}) {
  const rows = [["Nacimiento", patient.nacimiento ? `${fmtDate(patient.nacimiento)} (${age(patient.nacimiento)} años)` : "—"], ["Sexo", patient.sexo || "—"], ["Teléfono", patient.telefono || "—"], ["Previsión", patient.prevision || "—"], ["Antecedentes", patient.antecedentes || "—"], ["Alergias", patient.alergias || "—"], ["Medicamentos", patient.medicamentos || "—"], ["Diagnóstico", patient.diagnostico || "—"], ["Cirugía", patient.cirugia || "—"], ["Fecha Qx", patient.fechaCirugia ? fmtDate(patient.fechaCirugia) : "—"], ["Notas / plan", patient.notas || "—"], ["Ficha creada", fmtDate(patient.creado)]];
  return /*#__PURE__*/React.createElement("div", {
    style: S.card
  }, rows.map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: S.defRow
  }, /*#__PURE__*/React.createElement("div", {
    style: S.defKey
  }, k), /*#__PURE__*/React.createElement("div", {
    style: S.defVal
  }, v))));
}

/* ---------- Evoluciones ---------- */
function EvoTab({
  patient,
  onUpdate
}) {
  const [tipo, setTipo] = useState(EVO_TYPES[0]);
  const [fecha, setFecha] = useState(todayISO());
  const [nota, setNota] = useState("");
  const add = () => {
    if (!nota.trim()) return;
    const evo = {
      id: uid(),
      tipo,
      fecha,
      nota: nota.trim()
    };
    const next = {
      ...patient,
      evoluciones: [evo, ...patient.evoluciones]
    };
    onUpdate(next);
    setNota("");
  };
  const remove = id => {
    if (!window.confirm("¿Eliminar esta evolución?")) return;
    onUpdate({
      ...patient,
      evoluciones: patient.evoluciones.filter(e => e.id !== id)
    });
  };
  const sorted = [...patient.evoluciones].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.card,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: S.cardTitle
  }, "Nueva evolución"), /*#__PURE__*/React.createElement(Grid, null, /*#__PURE__*/React.createElement(Field, {
    label: "Tipo"
  }, /*#__PURE__*/React.createElement("select", {
    style: S.input,
    value: tipo,
    onChange: e => setTipo(e.target.value)
  }, EVO_TYPES.map(t => /*#__PURE__*/React.createElement("option", {
    key: t
  }, t)))), /*#__PURE__*/React.createElement(Field, {
    label: "Fecha"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    style: S.input,
    value: fecha,
    onChange: e => setFecha(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Evolución",
    full: true
  }, /*#__PURE__*/React.createElement("textarea", {
    style: S.textarea,
    rows: 3,
    value: nota,
    onChange: e => setNota(e.target.value),
    placeholder: "Hallazgos, indicaciones, hallazgos radiográficos, próximos controles…"
  }))), /*#__PURE__*/React.createElement("button", {
    className: "btn-primary",
    style: {
      marginTop: 10
    },
    onClick: add,
    disabled: !nota.trim()
  }, "Agregar evolución")), sorted.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: S.empty
  }, "Sin evoluciones registradas."), sorted.map(e => /*#__PURE__*/React.createElement("div", {
    key: e.id,
    style: {
      ...S.card,
      marginBottom: 10,
      padding: "14px 18px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: e.tipo === "Control imagenológico" ? "#B4690E" : e.tipo === "Complicación" ? "#B3402A" : "#16606B"
    }
  }, e.tipo), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#8A9491"
    }
  }, " · ", fmtDate(e.fecha))), /*#__PURE__*/React.createElement("button", {
    className: "link-danger",
    onClick: () => remove(e.id)
  }, "eliminar")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      fontSize: 14,
      whiteSpace: "pre-wrap"
    }
  }, e.nota))));
}

/* ---------- Fotos ---------- */
function FotosTab({
  patient,
  onUpdate,
  notify
}) {
  const [photos, setPhotos] = useState({});
  const [tag, setTag] = useState(PHOTO_TAGS[0]);
  const [filterTag, setFilterTag] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const fileRef = useRef(null);
  const camRef = useRef(null);
  useEffect(() => {
    (async () => {
      const loaded = {};
      for (const pid of patient.photoIds) {
        const ph = await sGet(`mxf-ph:${patient.id}:${pid}`);
        if (ph) loaded[pid] = ph;
      }
      setPhotos(loaded);
    })();
  }, [patient.id, patient.photoIds.length]);
  const upload = async files => {
    setUploading(true);
    try {
      let ids = [...patient.photoIds];
      const added = {};
      for (const file of files) {
        const dataUrl = await compressImage(file);
        const pid = uid();
        const ph = {
          id: pid,
          tag,
          fecha: todayISO(),
          nombre: file.name,
          data: dataUrl
        };
        const ok = await sSet(`mxf-ph:${patient.id}:${pid}`, ph);
        if (ok) {
          ids = [pid, ...ids];
          added[pid] = ph;
          await Drive.enqueue(patient.id, pid);
        } else notify("Error al guardar una imagen (¿muy pesada?)");
      }
      setPhotos({
        ...photos,
        ...added
      });
      onUpdate({
        ...patient,
        photoIds: ids
      });
      Drive.flush(notify);
    } catch {
      notify("Error al procesar la imagen");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };
  const remove = async pid => {
    if (!window.confirm("¿Eliminar esta imagen?")) return;
    await sDel(`mxf-ph:${patient.id}:${pid}`);
    const next = {
      ...photos
    };
    delete next[pid];
    setPhotos(next);
    onUpdate({
      ...patient,
      photoIds: patient.photoIds.filter(x => x !== pid)
    });
    setLightbox(null);
  };
  const visible = patient.photoIds.map(pid => photos[pid]).filter(Boolean).filter(ph => !filterTag || ph.tag === filterTag);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.card,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: S.cardTitle
  }, "Subir imágenes"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      alignItems: "flex-end"
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Etiqueta"
  }, /*#__PURE__*/React.createElement("select", {
    style: S.input,
    value: tag,
    onChange: e => setTag(e.target.value)
  }, PHOTO_TAGS.map(t => /*#__PURE__*/React.createElement("option", {
    key: t
  }, t)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("input", {
    ref: fileRef,
    type: "file",
    accept: "image/*",
    multiple: true,
    style: {
      display: "none"
    },
    onChange: e => e.target.files.length && upload([...e.target.files])
  }), /*#__PURE__*/React.createElement("input", {
    ref: camRef,
    type: "file",
    accept: "image/*",
    capture: "environment",
    style: {
      display: "none"
    },
    onChange: e => e.target.files.length && upload([...e.target.files])
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn-primary",
    disabled: uploading,
    onClick: () => camRef.current.click()
  }, uploading ? "Procesando…" : "📷 Tomar foto"), /*#__PURE__*/React.createElement("button", {
    className: "btn-ghost",
    disabled: uploading,
    onClick: () => fileRef.current.click()
  }, "Elegir de galería"))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#8A9491",
      marginTop: 8
    }
  }, "Las imágenes se comprimen automáticamente. En iPhone puedes tomar la foto directamente con la cámara. Para llevarlas a Drive usa «⇩ guardar» en cada imagen o «⇩ Exportar» en la ficha (todo en un solo archivo).")), /*#__PURE__*/React.createElement("div", {
    style: S.chipRow
  }, PHOTO_TAGS.map(t => {
    const n = patient.photoIds.map(pid => photos[pid]).filter(p => p && p.tag === t).length;
    if (!n) return null;
    const on = filterTag === t;
    return /*#__PURE__*/React.createElement("button", {
      key: t,
      className: "chip",
      style: {
        borderColor: TAG_COLORS[t],
        color: on ? "#fff" : TAG_COLORS[t],
        background: on ? TAG_COLORS[t] : "transparent"
      },
      onClick: () => setFilterTag(on ? null : t)
    }, t, " · ", n);
  })), patient.photoIds.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: S.empty
  }, "Sin imágenes. Sube fotos pre-op, intra-op, post-op o controles radiográficos."), /*#__PURE__*/React.createElement("div", {
    style: S.photoGrid
  }, visible.map(ph => /*#__PURE__*/React.createElement("button", {
    key: ph.id,
    className: "photo",
    onClick: () => setLightbox(ph)
  }, /*#__PURE__*/React.createElement("img", {
    src: ph.data,
    alt: ph.nombre,
    style: S.photoImg
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.photoTag,
      background: TAG_COLORS[ph.tag]
    }
  }, ph.tag), /*#__PURE__*/React.createElement("div", {
    style: S.photoDate
  }, fmtDate(ph.fecha))))), lightbox && /*#__PURE__*/React.createElement("div", {
    style: S.lightbox,
    onClick: () => setLightbox(null)
  }, /*#__PURE__*/React.createElement("div", {
    style: S.lightboxInner,
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("img", {
    src: lightbox.data,
    alt: "",
    style: {
      maxWidth: "100%",
      maxHeight: "70vh",
      borderRadius: 6
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 10,
      color: "#fff",
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", {
    style: {
      color: TAG_COLORS[lightbox.tag]
    }
  }, lightbox.tag), " · ", fmtDate(lightbox.fecha), " · ", lightbox.nombre), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "link-light",
    onClick: () => downloadPhoto(lightbox, patient)
  }, "⇩ guardar"), /*#__PURE__*/React.createElement("button", {
    className: "link-danger",
    onClick: () => remove(lightbox.id)
  }, "eliminar"), /*#__PURE__*/React.createElement("button", {
    className: "link-light",
    onClick: () => setLightbox(null)
  }, "cerrar ✕"))))));
}

/* ---------- Google Drive (API directa, scope drive.file) ---------- */
async function createDriveFolderFor(patient) {
  try {
    const cat = catById(patient.catDx);
    const proc = procById(patient.procedencia);
    const mes = (patient.fechaCirugia || patient.creado || todayISO()).slice(0, 7);
    const nombre = `${patient.nombre}${patient.cirugia ? " — " + patient.cirugia : ""} (${mes})`;
    return await Drive.folderForPatient(proc.id, proc.label, cat.id, cat.label, nombre);
  } catch (e) {
    console.error("Drive folder", e);
    return null;
  }
}

/* ============================================================
   Exportación (para guardar en Google Drive vía hoja de compartir)
   ============================================================ */
function downloadPhoto(ph, patient) {
  const a = document.createElement("a");
  a.href = ph.data;
  const base = (patient.nombre || "paciente").trim().split(/\s+/)[0];
  a.download = `${base}_${ph.tag.replace(/[^A-Za-zÁÉÍÓÚáéíóú]/g, "")}_${ph.fecha}.jpg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
async function exportPatientHTML(patient, notify) {
  notify("Generando ficha exportable…");
  const photos = [];
  for (const pid of patient.photoIds) {
    const ph = await sGet(`mxf-ph:${patient.id}:${pid}`);
    if (ph) photos.push(ph);
  }
  const cat = catById(patient.catDx);
  const esc = s => String(s || "—").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const evoSorted = [...patient.evoluciones].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  const rows = [["RUT", patient.rut], ["Folio", patient.folio], ["Nacimiento", patient.nacimiento ? `${fmtDate(patient.nacimiento)} (${age(patient.nacimiento)} años)` : ""], ["Sexo", patient.sexo], ["Teléfono", patient.telefono], ["Previsión", patient.prevision], ["Antecedentes", patient.antecedentes], ["Alergias", patient.alergias], ["Medicamentos", patient.medicamentos], ["Categoría Dx", cat.label], ["Diagnóstico", patient.diagnostico], ["Cirugía", patient.cirugia], ["Fecha Qx", patient.fechaCirugia ? fmtDate(patient.fechaCirugia) : ""], ["Notas / plan", patient.notas]];
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ficha ${esc(patient.nombre)}</title>
<style>
body{font-family:-apple-system,'Segoe UI',sans-serif;color:#1B2A2F;max-width:800px;margin:0 auto;padding:24px 16px;background:#fff}
h1{font-size:22px;margin:0}h2{font-size:15px;color:#16606B;border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:28px;text-transform:uppercase;letter-spacing:.08em}
.sub{color:#66716F;font-size:13px;margin-top:4px}
table{border-collapse:collapse;width:100%;margin-top:10px}td{padding:6px 8px;font-size:14px;border-bottom:1px solid #f0f0f0;vertical-align:top;white-space:pre-wrap}
td:first-child{width:150px;color:#66716F;font-weight:600;font-size:13px}
.evo{border:1px solid #e5e5e5;border-radius:8px;padding:10px 14px;margin-top:10px;font-size:14px}
.evo b{color:#16606B}.evo .d{color:#8A9491;font-size:12px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-top:12px}
figure{margin:0}img{width:100%;border-radius:8px;border:1px solid #ddd}
figcaption{font-size:12px;color:#66716F;margin-top:4px}
.badge{display:inline-block;background:${cat.color};color:#fff;font-size:12px;font-weight:700;padding:2px 10px;border-radius:999px}
@media print{.grid{grid-template-columns:repeat(2,1fr)}}
</style></head><body>
<h1>${esc(patient.nombre)}</h1>
<div class="sub">${esc(patient.rut)}${patient.folio ? " · Folio #" + esc(patient.folio) : ""} · Exportado ${fmtDate(todayISO())}</div>
<div style="margin-top:10px"><span class="badge">${esc(cat.label)}</span> ${esc(patient.diagnostico)}</div>
<h2>Ficha clínica</h2>
<table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>
<h2>Evoluciones (${evoSorted.length})</h2>
${evoSorted.map(e => `<div class="evo"><b>${esc(e.tipo)}</b> <span class="d">· ${fmtDate(e.fecha)}</span><div>${esc(e.nota)}</div></div>`).join("") || "<p>—</p>"}
<h2>Fotos e imágenes (${photos.length})</h2>
<div class="grid">${photos.map(p => `<figure><img src="${p.data}" alt=""><figcaption><b>${esc(p.tag)}</b> · ${fmtDate(p.fecha)}</figcaption></figure>`).join("") || "<p>—</p>"}</div>
</body></html>`;
  const blob = new Blob([html], {
    type: "text/html"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const base = (patient.nombre || "paciente").trim().replace(/\s+/g, "_");
  a.href = url;
  a.download = `Ficha_${base}${patient.folio ? "_" + patient.folio : ""}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
  notify("Ficha exportada — guárdala en Drive desde Compartir");
}

/* ============================================================
   UI helpers
   ============================================================ */
const Section = ({
  label,
  children
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    marginBottom: 18
  }
}, /*#__PURE__*/React.createElement("div", {
  style: S.sectionLabel
}, label), children);
const Grid = ({
  children
}) => /*#__PURE__*/React.createElement("div", {
  className: "grid"
}, children);
const Field = ({
  label,
  children,
  full
}) => /*#__PURE__*/React.createElement("label", {
  style: {
    display: "block",
    gridColumn: full ? "1 / -1" : "auto"
  }
}, /*#__PURE__*/React.createElement("div", {
  style: S.fieldLabel
}, label), children);

/* ============================================================
   Estilos
   ============================================================ */
const S = {
  app: {
    minHeight: "100vh",
    background: "#F4F6F5",
    color: "#1B2A2F",
    fontFamily: "'IBM Plex Sans', -apple-system, 'Segoe UI', sans-serif"
  },
  header: {
    background: "#10393F",
    color: "#fff",
    padding: "0 16px"
  },
  headerInner: {
    maxWidth: 860,
    margin: "0 auto",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 0",
    gap: 10,
    flexWrap: "wrap"
  },
  brandTop: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.18em",
    color: "#7FB5AE"
  },
  brandMain: {
    fontSize: 19,
    fontWeight: 700,
    letterSpacing: "-0.01em"
  },
  main: {
    maxWidth: 860,
    margin: "0 auto",
    padding: "20px 16px 60px"
  },
  loading: {
    textAlign: "center",
    padding: 40,
    color: "#66716F"
  },
  toolbar: {
    display: "flex",
    gap: 0,
    flexWrap: "wrap",
    marginBottom: 12,
    alignItems: "center"
  },
  search: {
    flex: 1,
    minWidth: 220,
    padding: "10px 14px",
    border: "1px solid #C9D2D0",
    borderRadius: 8,
    fontSize: 14,
    background: "#fff",
    marginRight: 10,
    outline: "none"
  },
  chipRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 16
  },
  groupHead: {
    fontSize: 14,
    fontWeight: 700,
    padding: "6px 10px",
    marginBottom: 8,
    background: "#fff",
    borderRadius: 6
  },
  rowName: {
    fontSize: 15,
    fontWeight: 650
  },
  rowSub: {
    fontSize: 13,
    color: "#4A5654",
    marginTop: 3
  },
  rowMeta: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    fontSize: 12,
    color: "#8A9491",
    textAlign: "right",
    fontFamily: "'IBM Plex Mono', monospace"
  },
  folio: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 12,
    color: "#16606B",
    background: "#E4EEEC",
    padding: "1px 7px",
    borderRadius: 4
  },
  card: {
    background: "#fff",
    border: "1px solid #E1E7E5",
    borderRadius: 10,
    padding: "18px 20px"
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 14
  },
  sectionLabel: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#16606B",
    marginBottom: 8,
    borderBottom: "1px solid #E1E7E5",
    paddingBottom: 5
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#4A5654",
    marginBottom: 4
  },
  input: {
    width: "100%",
    padding: "9px 11px",
    border: "1px solid #C9D2D0",
    borderRadius: 7,
    fontSize: 14,
    background: "#FCFDFC",
    boxSizing: "border-box",
    fontFamily: "inherit"
  },
  textarea: {
    width: "100%",
    padding: "9px 11px",
    border: "1px solid #C9D2D0",
    borderRadius: 7,
    fontSize: 14,
    background: "#FCFDFC",
    boxSizing: "border-box",
    fontFamily: "inherit",
    resize: "vertical"
  },
  alertBox: {
    marginTop: 12,
    background: "#FBF4E8",
    border: "1px solid #EAD9B8",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    display: "flex",
    flexDirection: "column",
    gap: 3
  },
  tabRow: {
    display: "flex",
    gap: 6,
    marginBottom: 14,
    flexWrap: "wrap"
  },
  defRow: {
    display: "flex",
    gap: 14,
    padding: "8px 0",
    borderBottom: "1px solid #F0F3F2"
  },
  defKey: {
    width: 140,
    minWidth: 140,
    fontSize: 13,
    color: "#66716F",
    fontWeight: 600
  },
  defVal: {
    fontSize: 14,
    whiteSpace: "pre-wrap"
  },
  empty: {
    background: "#fff",
    border: "1px dashed #C9D2D0",
    borderRadius: 10,
    padding: "28px 20px",
    textAlign: "center",
    color: "#4A5654",
    fontSize: 14,
    marginBottom: 14
  },
  photoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
    gap: 10
  },
  photoImg: {
    width: "100%",
    height: 140,
    objectFit: "cover",
    display: "block"
  },
  photoTag: {
    position: "absolute",
    top: 6,
    left: 6,
    color: "#fff",
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 7px",
    borderRadius: 4
  },
  photoDate: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    background: "rgba(16,57,63,0.75)",
    color: "#fff",
    fontSize: 11,
    padding: "3px 8px",
    fontFamily: "'IBM Plex Mono', monospace"
  },
  lightbox: {
    position: "fixed",
    inset: 0,
    background: "rgba(10,20,22,0.88)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    padding: 20
  },
  lightboxInner: {
    maxWidth: 900,
    width: "100%"
  },
  toast: {
    position: "fixed",
    bottom: 24,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#10393F",
    color: "#fff",
    padding: "10px 20px",
    borderRadius: 8,
    fontSize: 14,
    zIndex: 200,
    boxShadow: "0 4px 16px rgba(0,0,0,0.25)"
  }
};
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
* { box-sizing: border-box; }
button { font-family: inherit; cursor: pointer; }
.btn-primary { background:#16606B; color:#fff; border:none; padding:10px 18px; border-radius:8px; font-size:14px; font-weight:600; }
.btn-primary:hover { background:#124E57; }
.btn-primary:disabled { opacity:0.5; cursor:default; }
.btn-ghost { background:transparent; color:inherit; border:1px solid #C9D2D0; padding:9px 16px; border-radius:8px; font-size:14px; font-weight:500; }
header .btn-ghost { color:#fff; border-color:rgba(255,255,255,0.35); }
.btn-ghost:hover { background:rgba(0,0,0,0.05); }
header .btn-ghost:hover { background:rgba(255,255,255,0.1); }
.btn-danger { background:transparent; color:#B3402A; border:1px solid #E0BBB2; padding:9px 16px; border-radius:8px; font-size:14px; font-weight:500; }
.btn-danger:hover { background:#FBEFEC; }
.link-danger { background:none; border:none; color:#B3402A; font-size:12px; padding:0; text-decoration:underline; }
.link-light { background:none; border:none; color:#fff; font-size:12px; padding:0; text-decoration:underline; }
.drive-link { display:inline-block; background:#E4EEEC; color:#124E57; font-size:12.5px; font-weight:600; padding:5px 12px; border-radius:8px; text-decoration:none; border:1px solid #BFD6D2; }
.drive-link:hover { background:#D3E5E2; }
.seg { background:#fff; border:1px solid #C9D2D0; padding:10px 14px; font-size:13px; font-weight:600; color:#4A5654; }
.seg:first-of-type { border-radius:8px 0 0 8px; }
.seg:last-of-type { border-radius:0 8px 8px 0; }
.seg-on { background:#16606B; color:#fff; border-color:#16606B; }
.chip { border:1.5px solid; background:transparent; padding:5px 12px; border-radius:999px; font-size:12.5px; font-weight:600; }
.row { display:flex; align-items:center; gap:12px; width:100%; text-align:left; background:#fff; border:1px solid #E1E7E5; border-radius:10px; padding:13px 16px; margin-bottom:8px; }
.row:hover { border-color:#9FB4B0; box-shadow:0 1px 6px rgba(16,57,63,0.08); }
.tab { background:#fff; border:1px solid #C9D2D0; padding:8px 16px; border-radius:8px; font-size:13.5px; font-weight:600; color:#4A5654; }
.tab-on { background:#10393F; color:#fff; border-color:#10393F; }
.photo { position:relative; border:1px solid #E1E7E5; border-radius:8px; overflow:hidden; padding:0; background:#000; }
.photo:hover { box-shadow:0 2px 10px rgba(0,0,0,0.2); }
.grid { display:grid; grid-template-columns:repeat(2, 1fr); gap:12px; }
@media (max-width: 560px) { .grid { grid-template-columns:1fr; } }
input:focus, textarea:focus, select:focus { outline:2px solid #16606B33; border-color:#16606B; }
`;

/* ============================================================
   Barra de conexión con Google Drive
   ============================================================ */
const APP_VERSION = "v10";
function DriveBar({
  drive,
  notify
}) {
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState(false);
  const [cid, setCid] = useState("");
  const [informe, setInforme] = useState(null);
  const revisar = async () => {
    setBusy(true);
    setInforme("Revisando…");
    setInforme(await Drive.diagnose());
    setBusy(false);
  };
  const panel = informe && /*#__PURE__*/React.createElement("pre", {
    style: S.informe
  }, informe, /*#__PURE__*/React.createElement("button", {
    className: "link-drive",
    style: {
      display: "block",
      marginTop: 8
    },
    onClick: () => setInforme(null)
  }, "cerrar"));
  if (drive.state === "ready" && !drive.pending) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...S.driveBar,
        display: "block"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: S.driveOk
    }, "●"), " Drive conectado — las fotos se suben solas", /*#__PURE__*/React.createElement("button", {
      className: "link-drive",
      disabled: busy,
      onClick: revisar
    }, "revisar"), /*#__PURE__*/React.createElement("button", {
      className: "link-drive",
      onClick: () => Drive.disconnect()
    }, "desconectar"), /*#__PURE__*/React.createElement("span", {
      style: S.ver
    }, APP_VERSION)), panel);
  }
  if (drive.state === "ready" && drive.pending) {
    return /*#__PURE__*/React.createElement("div", {
      style: S.driveBar
    }, /*#__PURE__*/React.createElement("span", {
      style: S.driveWait
    }, "●"), " Subiendo ", drive.pending, " ", drive.pending === 1 ? "imagen" : "imágenes", " a Drive…");
  }
  if (drive.state === "nosetup" || setup) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...S.driveBar,
        ...S.driveBarWarn,
        display: "block"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("b", null, "Conectar Google Drive."), " Pega aquí el ID de cliente que creaste en Google Cloud.", /*#__PURE__*/React.createElement("span", {
      style: S.ver
    }, APP_VERSION)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("input", {
      style: {
        ...S.input,
        flex: 1,
        minWidth: 240
      },
      placeholder: "000000-xxxxx.apps.googleusercontent.com",
      value: cid,
      onChange: e => setCid(e.target.value)
    }), /*#__PURE__*/React.createElement("button", {
      className: "btn-primary",
      disabled: busy || !cid.trim(),
      onClick: async () => {
        setBusy(true);
        const ok = await Drive.saveClientId(cid.trim());
        setBusy(false);
        setSetup(false);
        notify(ok ? "ID guardado — ahora autoriza el acceso" : "Ese ID no parece válido");
      }
    }, "Guardar")));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.driveBar,
      ...S.driveBarWarn
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: S.driveOff
  }, "●"), "Drive desconectado", drive.pending ? ` — ${drive.pending} pendientes` : "", /*#__PURE__*/React.createElement("span", {
    style: S.ver
  }, APP_VERSION), /*#__PURE__*/React.createElement("button", {
    className: "btn-primary",
    style: {
      padding: "5px 12px",
      fontSize: 12.5,
      marginLeft: 10
    },
    disabled: busy,
    onClick: async () => {
      setBusy(true);
      const ok = await Drive.connect();
      setBusy(false);
      if (ok) {
        notify("Drive conectado — preparando carpetas…");
        const n = await Drive.ensureAllCategories(true);
        notify(n ? `Drive conectado — ${n} carpetas listas` : "Drive conectado");
        Drive.flush(notify);
      } else notify("No se pudo conectar. Si Safari bloqueó la ventana, permítela y reintenta");
    }
  }, busy ? "Conectando…" : "Conectar"), /*#__PURE__*/React.createElement("button", {
    className: "link-drive",
    onClick: () => setSetup(true)
  }, "cambiar ID"));
}
Object.assign(S, {
  driveBar: {
    maxWidth: 860,
    margin: "0 auto",
    padding: "9px 16px",
    fontSize: 13,
    color: "#2A3B40",
    background: "#E4EDEB",
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap"
  },
  driveBarWarn: {
    background: "#FBF0DC"
  },
  driveOk: {
    color: "#2F6B3A",
    fontSize: 15
  },
  driveOff: {
    color: "#B3402A",
    fontSize: 15
  },
  driveWait: {
    color: "#B4690E",
    fontSize: 15
  },
  ver: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10.5,
    color: "#8A9491",
    marginLeft: "auto",
    letterSpacing: ".06em"
  },
  informe: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11.5,
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    background: "#fff",
    border: "1px solid #C9D2D0",
    borderRadius: 6,
    padding: "10px 12px",
    marginTop: 10,
    marginBottom: 0,
    color: "#1B2A2F"
  }
});

/* ============================================================ */

/* ============================================================
   Panel comercial
   Solo estadística agregada. No expone datos de pacientes.
   ============================================================ */
function PanelComercial({
  index,
  notify
}) {
  const [proc, setProc] = useState("consulta");
  const C = window.MXF_COMERCIAL;
  const stats = useMemo(() => C.estadisticas(index, proc || null), [index, proc]);
  const publicables = useMemo(() => index.filter(e => (!proc || (e.procedencia || "consulta") === proc) && e.consentImg === "difusion" && (e.nFotos || 0) > 0).length, [index, proc]);
  const maxCat = stats.cats.length ? stats.cats[0].n : 1;
  const procLabel = proc ? procById(proc).label : "Todas las procedencias";
  const bajar = (texto, nombre) => {
    const blob = new Blob([texto], {
      type: "text/markdown;charset=utf-8"
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  const descargarFocos = () => {
    bajar(C.briefFocos(index), `plan-focos-${todayISO()}.md`);
    notify("Plan de focos generado");
  };
  const descargarBrief = () => {
    const md = C.brief(stats, id => catById(id).label, procLabel);
    const blob = new Blob([md], {
      type: "text/markdown;charset=utf-8"
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `brief-comercial-${todayISO()}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    notify("Brief generado");
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: S.panelHead
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: S.brandTop
  }, "INTELIGENCIA COMERCIAL"), /*#__PURE__*/React.createElement("div", {
    style: S.panelTitle
  }, "Qué dice tu registro"))), /*#__PURE__*/React.createElement("div", {
    style: S.chipRow
  }, PROCS.map(x => /*#__PURE__*/React.createElement("button", {
    key: x.id,
    className: "chip",
    style: {
      borderColor: x.color,
      color: proc === x.id ? "#fff" : x.color,
      background: proc === x.id ? x.color : "transparent",
      fontWeight: 600
    },
    onClick: () => setProc(x.id)
  }, x.corto)), /*#__PURE__*/React.createElement("button", {
    className: "chip",
    style: {
      borderColor: "#5C5C5C",
      color: proc === null ? "#fff" : "#5C5C5C",
      background: proc === null ? "#5C5C5C" : "transparent"
    },
    onClick: () => setProc(null)
  }, "Todas")), proc === "hosmil" && /*#__PURE__*/React.createElement("div", {
    style: S.aviso
  }, "Los pacientes del hospital son datos institucionales. Sirven para orientar contenido clínico, no para uso comercial ni para material publicitario."), /*#__PURE__*/React.createElement("div", {
    style: S.kpiRow
  }, /*#__PURE__*/React.createElement("div", {
    style: S.kpi
  }, /*#__PURE__*/React.createElement("div", {
    style: S.kpiN
  }, stats.total), /*#__PURE__*/React.createElement("div", {
    style: S.kpiL
  }, "casos")), /*#__PURE__*/React.createElement("div", {
    style: S.kpi
  }, /*#__PURE__*/React.createElement("div", {
    style: S.kpiN
  }, stats.cats.length), /*#__PURE__*/React.createElement("div", {
    style: S.kpiL
  }, "áreas activas")), /*#__PURE__*/React.createElement("div", {
    style: S.kpi
  }, /*#__PURE__*/React.createElement("div", {
    style: S.kpiN
  }, publicables), /*#__PURE__*/React.createElement("div", {
    style: S.kpiL
  }, "casos publicables"))), !stats.total ? /*#__PURE__*/React.createElement("div", {
    style: S.empty
  }, /*#__PURE__*/React.createElement("b", null, "Sin casos en esta base"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, "El panel se activa a medida que cargues fichas.")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Section, {
    label: "Mezcla de casos"
  }, stats.cats.map(c => {
    const cat = catById(c.id);
    return /*#__PURE__*/React.createElement("div", {
      key: c.id,
      style: S.barRow
    }, /*#__PURE__*/React.createElement("div", {
      style: S.barLabel
    }, cat.label), /*#__PURE__*/React.createElement("div", {
      style: S.barTrack
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        ...S.barFill,
        width: `${c.n / maxCat * 100}%`,
        background: cat.color
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: S.barN
    }, c.n, " · ", c.pct, "%"));
  })), stats.top.length > 0 && /*#__PURE__*/React.createElement(Section, {
    label: "Procedimientos más frecuentes"
  }, stats.top.map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: S.listRow
  }, /*#__PURE__*/React.createElement("span", null, p.nombre), /*#__PURE__*/React.createElement("b", null, p.n)))), /*#__PURE__*/React.createElement(Section, {
    label: "Prioridad de contenidos"
  }, stats.cats.slice(0, 3).map(c => {
    const v = C.VOCAB[c.id];
    if (!v) return null;
    return /*#__PURE__*/React.createElement("div", {
      key: c.id,
      style: {
        marginBottom: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: S.temaTit
    }, v.tema, " · ", c.pct, "%"), v.contenidos.slice(0, 3).map((t, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: S.temaItem
    }, "— ", t)));
  }))), /*#__PURE__*/React.createElement(Section, {
    label: "Focos comerciales"
  }, /*#__PURE__*/React.createElement("div", {
    style: S.nota2
  }, "Tres procedimientos electivos donde el paciente investiga y decide. Los cuadros de urgencia quedan fuera: no responden a publicidad."), C.FOCO_IDS.map(id => {
    const f = C.FOCOS[id];
    const cat = catById(f.cat || id);
    const rx = f.texto ? new RegExp(f.texto, "i") : null;
    const casos = index.filter(e => (e.procedencia || "consulta") === "consulta" && e.catDx === (f.cat || id) && (!rx || rx.test(e.cirugia || "")));
    const pub = casos.filter(e => e.consentImg === "difusion" && (e.nFotos || 0) > 0).length;
    return /*#__PURE__*/React.createElement("div", {
      key: id,
      style: {
        ...S.focoCard,
        borderLeftColor: cat.color
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: S.focoTit
    }, f.tema), /*#__PURE__*/React.createElement("div", {
      style: S.focoDatos
    }, casos.length, " ", casos.length === 1 ? "caso" : "casos", " · ", pub, " publicable", pub === 1 ? "" : "s"), /*#__PURE__*/React.createElement("div", {
      style: S.focoTexto
    }, f.porque));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginTop: 18,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn-primary",
    onClick: descargarFocos
  }, "⇩ Plan de los tres focos"), /*#__PURE__*/React.createElement("button", {
    className: "btn-ghost",
    onClick: descargarBrief,
    disabled: !stats.total
  }, "⇩ Brief general")), /*#__PURE__*/React.createElement("div", {
    style: S.nota
  }, "El brief incluye calendario editorial, palabras clave por intención, negativas y las restricciones de plataforma. Se genera con estadística agregada: ningún dato de paciente sale de este dispositivo."));
}
Object.assign(S, {
  panelHead: {
    marginBottom: 14
  },
  panelTitle: {
    fontSize: 21,
    fontWeight: 700,
    color: "#10393F",
    letterSpacing: "-.01em"
  },
  kpiRow: {
    display: "flex",
    gap: 10,
    marginBottom: 18,
    flexWrap: "wrap"
  },
  kpi: {
    flex: "1 1 90px",
    background: "#fff",
    border: "1px solid #DCE3E1",
    borderRadius: 8,
    padding: "12px 14px"
  },
  kpiN: {
    fontSize: 24,
    fontWeight: 700,
    color: "#10393F",
    lineHeight: 1.1
  },
  kpiL: {
    fontSize: 11.5,
    color: "#66716F",
    marginTop: 3,
    letterSpacing: ".02em"
  },
  barRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 8
  },
  barLabel: {
    flex: "0 0 42%",
    fontSize: 12.5,
    color: "#2A3B40"
  },
  barTrack: {
    flex: 1,
    height: 8,
    background: "#EDF1F0",
    borderRadius: 4,
    overflow: "hidden"
  },
  barFill: {
    height: "100%",
    borderRadius: 4
  },
  barN: {
    flex: "0 0 62px",
    textAlign: "right",
    fontSize: 11.5,
    fontFamily: "'IBM Plex Mono', monospace",
    color: "#66716F"
  },
  listRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    padding: "6px 0",
    borderBottom: "1px solid #EDF1F0",
    fontSize: 13
  },
  temaTit: {
    fontSize: 13.5,
    fontWeight: 600,
    color: "#10393F",
    marginBottom: 5
  },
  temaItem: {
    fontSize: 12.5,
    color: "#4A5654",
    lineHeight: 1.7
  },
  aviso: {
    background: "#FBF0DC",
    border: "1px solid #E8D5A8",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 12.5,
    color: "#6B4E13",
    marginBottom: 14
  },
  nota: {
    fontSize: 11.5,
    color: "#8A9491",
    lineHeight: 1.7,
    marginTop: 14
  },
  nota2: {
    fontSize: 12,
    color: "#66716F",
    lineHeight: 1.65,
    marginBottom: 12
  },
  focoCard: {
    borderLeft: "3px solid",
    background: "#fff",
    border: "1px solid #DCE3E1",
    borderRadius: 8,
    padding: "11px 13px",
    marginBottom: 9
  },
  focoTit: {
    fontSize: 14,
    fontWeight: 700,
    color: "#10393F"
  },
  focoDatos: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    color: "#66716F",
    margin: "3px 0 6px"
  },
  focoTexto: {
    fontSize: 12.5,
    color: "#4A5654",
    lineHeight: 1.6
  }
});

/* ============================================================ */
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));