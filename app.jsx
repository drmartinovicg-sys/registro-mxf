const { useState, useEffect, useRef, useMemo } = React;

/* ============================================================
   Registro Clínico — Cirugía Maxilofacial
   Aplicación autónoma (PWA). Datos en el dispositivo (IndexedDB).
   Google Drive vía API directa.
   ============================================================ */

const CATS = [
  { id: "trauma", label: "Trauma facial", color: "#B3402A" },
  { id: "ortognatica", label: "Cirugía ortognática", color: "#16606B" },
  { id: "patologia", label: "Patología / Tumores", color: "#6B2D5C" },
  { id: "dentoalveolar", label: "Dentoalveolar / Incluidos", color: "#2F6B3A" },
  { id: "implantes", label: "Implantes / Reconstrucción", color: "#8A6D1F" },
  { id: "atm", label: "ATM / TTM", color: "#3B4E8C" },
  { id: "infeccion", label: "Infecciones", color: "#A34A00" },
  { id: "glandulas", label: "Glándulas salivales", color: "#4E6E58" },
  { id: "otro", label: "Otro", color: "#5C5C5C" },
];
const catById = (id) => CATS.find((c) => c.id === id) || CATS[CATS.length - 1];
window.MXF_CATS = CATS;

const EVO_TYPES = [
  "Control clínico",
  "Control imagenológico",
  "Curación",
  "Retiro de suturas",
  "Complicación",
  "Indicaciones",
  "Otro",
];

const PHOTO_TAGS = ["Pre-op", "Intra-op", "Post-op", "RX / Imagen"];
const TAG_COLORS = {
  "Pre-op": "#16606B",
  "Intra-op": "#B3402A",
  "Post-op": "#2F6B3A",
  "RX / Imagen": "#B4690E",
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
};
const age = (iso) => {
  if (!iso) return null;
  const b = new Date(iso), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
};

/* ---------- almacenamiento local (IndexedDB) ---------- */
const sGet = (k) => DB.get(k);
const sSet = (k, v) => DB.set(k, v);
const sDel = (k) => DB.del(k);

/* ---------- compresión de imágenes ---------- */
function compressImage(file, maxDim = 1000, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const r = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * r); height = Math.round(height * r);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
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
  catDx: "dentoalveolar",
  diagnostico: "",
  cirugia: "",
  fechaCirugia: "",
  notas: "",
  evoluciones: [],
  photoIds: [],
  driveFolder: null,
  creado: todayISO(),
});

/* ============================================================ */
function App() {
  const [drive, setDrive] = useState(Drive.status());
  const [screen, setScreen] = useState("list"); // list | form | patient
  const [index, setIndex] = useState([]);
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState(null);
  const [groupByDx, setGroupByDx] = useState(false);
  const [toast, setToast] = useState(null);

  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  useEffect(() => {
    (async () => {
      const idx = await sGet("mxf-index");
      setIndex(idx || []);
      setLoading(false);
      Drive.onChange(setDrive);
      await Drive.init();
      Drive.flush(notify);
    })();
  }, []);

  const saveIndex = async (next) => { setIndex(next); await sSet("mxf-index", next); };

  const indexEntry = (p) => ({
    id: p.id, folio: p.folio, nombre: p.nombre, rut: p.rut,
    catDx: p.catDx, diagnostico: p.diagnostico, cirugia: p.cirugia,
    fechaCirugia: p.fechaCirugia, nFotos: p.photoIds.length, nEvo: p.evoluciones.length,
  });

  const savePatient = async (p) => {
    await sSet(`mxf-p:${p.id}`, p);
    setIndex((prev) => {
      const next = [indexEntry(p), ...prev.filter((e) => e.id !== p.id)];
      sSet("mxf-index", next);
      return next;
    });
  };

  const openPatient = async (id) => {
    setLoading(true);
    const p = await sGet(`mxf-p:${id}`);
    if (p) { setPatient(p); setScreen("patient"); }
    else notify("No se pudo cargar la ficha");
    setLoading(false);
  };

  const deletePatient = async (p) => {
    if (!window.confirm(`¿Eliminar la ficha de ${p.nombre}? Esta acción es permanente.`)) return;
    for (const pid of p.photoIds) await sDel(`mxf-ph:${p.id}:${pid}`);
    await sDel(`mxf-p:${p.id}`);
    await saveIndex(index.filter((e) => e.id !== p.id));
    setScreen("list"); setPatient(null);
    notify("Ficha eliminada");
  };

  /* ---------- filtrado ---------- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return index.filter((e) => {
      if (filterCat && e.catDx !== filterCat) return false;
      if (!q) return true;
      return [e.nombre, e.rut, e.folio, e.diagnostico, e.cirugia]
        .some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [index, search, filterCat]);

  const grouped = useMemo(() => {
    if (!groupByDx) return null;
    const g = {};
    filtered.forEach((e) => { (g[e.catDx] = g[e.catDx] || []).push(e); });
    return CATS.filter((c) => g[c.id]?.length).map((c) => ({ cat: c, items: g[c.id] }));
  }, [filtered, groupByDx]);

  /* ---------- respaldo ---------- */
  const backupAll = async () => {
    notify("Generando respaldo…");
    const out = { app: "RegistroMXF", version: 1, fecha: todayISO(), patients: [] };
    for (const e of index) {
      const p = await sGet(`mxf-p:${e.id}`);
      if (!p) continue;
      const photos = [];
      for (const pid of p.photoIds) {
        const ph = await sGet(`mxf-ph:${p.id}:${pid}`);
        if (ph) photos.push(ph);
      }
      out.patients.push({ ...p, _photos: photos });
    }
    const blob = new Blob([JSON.stringify(out)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `RegistroMXF_respaldo_${todayISO()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
    notify(`Respaldo descargado (${out.patients.length} pacientes)`);
  };

  const importBackup = async (file) => {
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.patients)) throw new Error("formato");
      setLoading(true);
      let idx = [...index];
      for (const p of data.patients) {
        const photos = p._photos || [];
        const rec = { ...p };
        delete rec._photos;
        rec.photoIds = photos.map((ph) => ph.id);
        for (const ph of photos) await sSet(`mxf-ph:${rec.id}:${ph.id}`, ph);
        await sSet(`mxf-p:${rec.id}`, rec);
        idx = [indexEntry(rec), ...idx.filter((e) => e.id !== rec.id)];
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
  return (
    <div style={S.app}>
      <style>{CSS}</style>

      {/* Header */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div>
            <div style={S.brandTop}>CIRUGÍA MAXILOFACIAL</div>
            <div style={S.brandMain}>Dr. Gonzalo Martinovic</div>
          </div>
          {screen === "list" && (
            <button className="btn-primary" onClick={() => { setEditDraft(emptyPatient()); setScreen("form"); }}>
              + Nueva ficha
            </button>
          )}
          {screen !== "list" && (
            <button className="btn-ghost" onClick={() => { setScreen("list"); setPatient(null); setEditDraft(null); }}>
              ← Pacientes
            </button>
          )}
        </div>
      </header>

      <DriveBar drive={drive} notify={notify} />

      <main style={S.main}>
        {loading && <div style={S.loading}>Cargando…</div>}

        {!loading && screen === "list" && (
          <ListScreen
            index={index} filtered={filtered} grouped={grouped}
            search={search} setSearch={setSearch}
            filterCat={filterCat} setFilterCat={setFilterCat}
            groupByDx={groupByDx} setGroupByDx={setGroupByDx}
            onOpen={openPatient} onBackup={backupAll} onImport={importBackup}
          />
        )}

        {!loading && screen === "form" && editDraft && (
          <PatientForm
            draft={editDraft}
            onCancel={() => { setScreen(patient ? "patient" : "list"); setEditDraft(null); }}
            onSave={async (p) => {
              if (!p.nombre.trim()) { notify("El nombre es obligatorio"); return; }
              await savePatient(p);
              setPatient(p); setEditDraft(null); setScreen("patient");
              notify("Ficha guardada");
              if (!p.driveFolder) {
                createDriveFolderFor(p).then(async (df) => {
                  if (df) {
                    const upd = { ...p, driveFolder: df };
                    await savePatient(upd);
                    setPatient((cur) => (cur && cur.id === p.id ? upd : cur));
                    notify("📁 Carpeta creada en tu Drive");
                  }
                });
              }
            }}
          />
        )}

        {!loading && screen === "patient" && patient && (
          <PatientView
            patient={patient}
            onEdit={() => { setEditDraft({ ...patient }); setScreen("form"); }}
            onDelete={() => deletePatient(patient)}
            onUpdate={async (p) => { setPatient(p); await savePatient(p); }}
            notify={notify}
          />
        )}
      </main>

      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}

/* ============================================================
   Lista de pacientes
   ============================================================ */
function ListScreen({ index, filtered, grouped, search, setSearch, filterCat, setFilterCat, groupByDx, setGroupByDx, onOpen, onBackup, onImport }) {
  return (
    <div>
      <div style={S.toolbar}>
        <input
          style={S.search} placeholder="Buscar por nombre, RUT, folio o diagnóstico…"
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className={groupByDx ? "seg seg-on" : "seg"}
          onClick={() => setGroupByDx(false)}
        >Por paciente</button>
        <button
          className={groupByDx ? "seg" : "seg seg-on"}
          onClick={() => setGroupByDx(true)}
          style={{ marginLeft: -1 }}
        >Por diagnóstico</button>
      </div>

      <div style={S.chipRow}>
        {CATS.map((c) => {
          const n = index.filter((e) => e.catDx === c.id).length;
          if (!n) return null;
          const on = filterCat === c.id;
          return (
            <button key={c.id}
              className="chip"
              style={{ borderColor: c.color, color: on ? "#fff" : c.color, background: on ? c.color : "transparent" }}
              onClick={() => setFilterCat(on ? null : c.id)}
            >{c.label} · {n}</button>
          );
        })}
      </div>

      {index.length === 0 && (
        <div style={S.empty}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Sin pacientes registrados</div>
          <div style={{ color: "#66716F" }}>Crea la primera ficha con el botón «+ Nueva ficha».</div>
        </div>
      )}

      {index.length > 0 && filtered.length === 0 && (
        <div style={S.empty}>Sin resultados para esta búsqueda.</div>
      )}

      {!groupByDx && filtered.map((e) => <PatientRow key={e.id} e={e} onOpen={onOpen} />)}

      {groupByDx && grouped && grouped.map(({ cat, items }) => (
        <div key={cat.id} style={{ marginBottom: 22 }}>
          <div style={{ ...S.groupHead, borderLeft: `4px solid ${cat.color}` }}>
            {cat.label} <span style={{ color: "#8A9491", fontWeight: 400 }}>· {items.length}</span>
          </div>
          {items.map((e) => <PatientRow key={e.id} e={e} onOpen={onOpen} />)}
        </div>
      ))}

      <div style={{ display: "flex", gap: 10, marginTop: 26, justifyContent: "center", flexWrap: "wrap" }}>
        {index.length > 0 && (
          <button className="btn-ghost" onClick={onBackup}>⇩ Respaldo completo</button>
        )}
        <label className="btn-ghost" style={{ cursor: "pointer" }}>
          Restaurar respaldo
          <input type="file" accept="application/json,.json" style={{ display: "none" }}
            onChange={(e) => e.target.files[0] && onImport(e.target.files[0])} />
        </label>
      </div>
    </div>
  );
}

function PatientRow({ e, onOpen }) {
  const cat = catById(e.catDx);
  return (
    <button className="row" onClick={() => onOpen(e.id)} style={{ borderLeft: `4px solid ${cat.color}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={S.rowName}>{e.nombre}</span>
          {e.folio && <span style={S.folio}>#{e.folio}</span>}
          {e.rut && <span style={{ color: "#66716F", fontSize: 13 }}>{e.rut}</span>}
        </div>
        <div style={S.rowSub}>
          <span style={{ color: cat.color, fontWeight: 600 }}>{cat.label}</span>
          {e.diagnostico ? ` — ${e.diagnostico}` : ""}
          {e.fechaCirugia ? ` · Qx ${fmtDate(e.fechaCirugia)}` : ""}
        </div>
      </div>
      <div style={S.rowMeta}>
        <span title="Evoluciones">{e.nEvo || 0} evo</span>
        <span title="Fotos">{e.nFotos || 0} 📷</span>
      </div>
    </button>
  );
}

/* ============================================================
   Formulario ficha
   ============================================================ */
function PatientForm({ draft, onSave, onCancel }) {
  const [p, setP] = useState(draft);
  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>{draft.nombre ? "Editar ficha" : "Nueva ficha"}</div>

      <Section label="Identificación">
        <Grid>
          <Field label="Nombre completo *"><input style={S.input} value={p.nombre} onChange={set("nombre")} /></Field>
          <Field label="RUT"><input style={S.input} value={p.rut} onChange={set("rut")} placeholder="12.345.678-9" /></Field>
          <Field label="N° ficha / folio"><input style={S.input} value={p.folio} onChange={set("folio")} /></Field>
          <Field label="Fecha de nacimiento"><input type="date" style={S.input} value={p.nacimiento} onChange={set("nacimiento")} /></Field>
          <Field label="Sexo">
            <select style={S.input} value={p.sexo} onChange={set("sexo")}>
              <option value="">—</option><option>Masculino</option><option>Femenino</option><option>Otro</option>
            </select>
          </Field>
          <Field label="Teléfono"><input style={S.input} value={p.telefono} onChange={set("telefono")} /></Field>
          <Field label="Previsión"><input style={S.input} value={p.prevision} onChange={set("prevision")} placeholder="Fonasa / Isapre / Institucional" /></Field>
        </Grid>
      </Section>

      <Section label="Antecedentes">
        <Grid>
          <Field label="Antecedentes mórbidos" full><textarea style={S.textarea} rows={2} value={p.antecedentes} onChange={set("antecedentes")} /></Field>
          <Field label="Alergias"><input style={S.input} value={p.alergias} onChange={set("alergias")} placeholder="Sin alergias conocidas" /></Field>
          <Field label="Medicamentos"><input style={S.input} value={p.medicamentos} onChange={set("medicamentos")} /></Field>
        </Grid>
      </Section>

      <Section label="Diagnóstico y cirugía">
        <Grid>
          <Field label="Categoría diagnóstica *">
            <select style={S.input} value={p.catDx} onChange={set("catDx")}>
              {CATS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Diagnóstico específico"><input style={S.input} value={p.diagnostico} onChange={set("diagnostico")} placeholder="Ej: Fractura mandibular parasinfisiaria izq." /></Field>
          <Field label="Cirugía / procedimiento"><input style={S.input} value={p.cirugia} onChange={set("cirugia")} placeholder="Ej: RAFI con placas 2.0" /></Field>
          <Field label="Fecha de cirugía"><input type="date" style={S.input} value={p.fechaCirugia} onChange={set("fechaCirugia")} /></Field>
          <Field label="Notas / plan" full><textarea style={S.textarea} rows={3} value={p.notas} onChange={set("notas")} /></Field>
        </Grid>
      </Section>

      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button className="btn-primary" onClick={() => onSave(p)}>Guardar ficha</button>
        <button className="btn-ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

/* ============================================================
   Vista paciente: Ficha | Evoluciones | Fotos
   ============================================================ */
function PatientView({ patient, onEdit, onDelete, onUpdate, notify }) {
  const [tab, setTab] = useState("ficha");
  const cat = catById(patient.catDx);
  const a = age(patient.nacimiento);

  return (
    <div>
      <div style={{ ...S.card, borderTop: `4px solid ${cat.color}`, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
              <span style={{ fontSize: 20, fontWeight: 700 }}>{patient.nombre}</span>
              {patient.folio && <span style={S.folio}>#{patient.folio}</span>}
            </div>
            <div style={{ color: "#66716F", fontSize: 13, marginTop: 3 }}>
              {patient.rut || "RUT —"}{a != null ? ` · ${a} años` : ""}{patient.prevision ? ` · ${patient.prevision}` : ""}
            </div>
            <div style={{ marginTop: 8, fontSize: 14 }}>
              <span style={{ color: cat.color, fontWeight: 700 }}>{cat.label}</span>
              {patient.diagnostico && <span> — {patient.diagnostico}</span>}
            </div>
            {(patient.cirugia || patient.fechaCirugia) && (
              <div style={{ fontSize: 13, color: "#3A4442", marginTop: 2 }}>
                Qx: {patient.cirugia || "—"} {patient.fechaCirugia && `· ${fmtDate(patient.fechaCirugia)}`}
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              {patient.driveFolder ? (
                <a className="drive-link" href={patient.driveFolder.url} target="_blank" rel="noreferrer">
                  📁 Carpeta en Drive ↗
                </a>
              ) : (
                <button className="btn-ghost" style={{ padding: "5px 12px", fontSize: 12.5 }}
                  onClick={async () => {
                    notify("Creando carpeta en Drive…");
                    const df = await createDriveFolderFor(patient);
                    if (df) { onUpdate({ ...patient, driveFolder: df }); notify("📁 Carpeta creada en tu Drive"); }
                    else notify("No se pudo crear la carpeta — reintenta");
                  }}>
                  📁 Crear carpeta en Drive
                </button>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
            <button className="btn-ghost" onClick={() => exportPatientHTML(patient, notify)}>⇩ Exportar</button>
            <button className="btn-ghost" onClick={onEdit}>Editar</button>
            <button className="btn-danger" onClick={onDelete}>Eliminar</button>
          </div>
        </div>
        {(patient.alergias || patient.antecedentes) && (
          <div style={S.alertBox}>
            {patient.alergias && <div><b>Alergias:</b> {patient.alergias}</div>}
            {patient.antecedentes && <div><b>Antecedentes:</b> {patient.antecedentes}</div>}
            {patient.medicamentos && <div><b>Fármacos:</b> {patient.medicamentos}</div>}
          </div>
        )}
      </div>

      <div style={S.tabRow}>
        {[["ficha", "Ficha"], ["evo", `Evoluciones (${patient.evoluciones.length})`], ["fotos", `Fotos e imágenes (${patient.photoIds.length})`]].map(([id, label]) => (
          <button key={id} className={tab === id ? "tab tab-on" : "tab"} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === "ficha" && <FichaTab patient={patient} />}
      {tab === "evo" && <EvoTab patient={patient} onUpdate={onUpdate} />}
      {tab === "fotos" && <FotosTab patient={patient} onUpdate={onUpdate} notify={notify} />}
    </div>
  );
}

function FichaTab({ patient }) {
  const rows = [
    ["Nacimiento", patient.nacimiento ? `${fmtDate(patient.nacimiento)} (${age(patient.nacimiento)} años)` : "—"],
    ["Sexo", patient.sexo || "—"],
    ["Teléfono", patient.telefono || "—"],
    ["Previsión", patient.prevision || "—"],
    ["Antecedentes", patient.antecedentes || "—"],
    ["Alergias", patient.alergias || "—"],
    ["Medicamentos", patient.medicamentos || "—"],
    ["Diagnóstico", patient.diagnostico || "—"],
    ["Cirugía", patient.cirugia || "—"],
    ["Fecha Qx", patient.fechaCirugia ? fmtDate(patient.fechaCirugia) : "—"],
    ["Notas / plan", patient.notas || "—"],
    ["Ficha creada", fmtDate(patient.creado)],
  ];
  return (
    <div style={S.card}>
      {rows.map(([k, v]) => (
        <div key={k} style={S.defRow}>
          <div style={S.defKey}>{k}</div>
          <div style={S.defVal}>{v}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Evoluciones ---------- */
function EvoTab({ patient, onUpdate }) {
  const [tipo, setTipo] = useState(EVO_TYPES[0]);
  const [fecha, setFecha] = useState(todayISO());
  const [nota, setNota] = useState("");

  const add = () => {
    if (!nota.trim()) return;
    const evo = { id: uid(), tipo, fecha, nota: nota.trim() };
    const next = { ...patient, evoluciones: [evo, ...patient.evoluciones] };
    onUpdate(next);
    setNota("");
  };
  const remove = (id) => {
    if (!window.confirm("¿Eliminar esta evolución?")) return;
    onUpdate({ ...patient, evoluciones: patient.evoluciones.filter((e) => e.id !== id) });
  };

  const sorted = [...patient.evoluciones].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));

  return (
    <div>
      <div style={{ ...S.card, marginBottom: 14 }}>
        <div style={S.cardTitle}>Nueva evolución</div>
        <Grid>
          <Field label="Tipo">
            <select style={S.input} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {EVO_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Fecha"><input type="date" style={S.input} value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
          <Field label="Evolución" full>
            <textarea style={S.textarea} rows={3} value={nota} onChange={(e) => setNota(e.target.value)}
              placeholder="Hallazgos, indicaciones, hallazgos radiográficos, próximos controles…" />
          </Field>
        </Grid>
        <button className="btn-primary" style={{ marginTop: 10 }} onClick={add} disabled={!nota.trim()}>Agregar evolución</button>
      </div>

      {sorted.length === 0 && <div style={S.empty}>Sin evoluciones registradas.</div>}
      {sorted.map((e) => (
        <div key={e.id} style={{ ...S.card, marginBottom: 10, padding: "14px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontSize: 13 }}>
              <b style={{ color: e.tipo === "Control imagenológico" ? "#B4690E" : e.tipo === "Complicación" ? "#B3402A" : "#16606B" }}>{e.tipo}</b>
              <span style={{ color: "#8A9491" }}> · {fmtDate(e.fecha)}</span>
            </div>
            <button className="link-danger" onClick={() => remove(e.id)}>eliminar</button>
          </div>
          <div style={{ marginTop: 6, fontSize: 14, whiteSpace: "pre-wrap" }}>{e.nota}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Fotos ---------- */
function FotosTab({ patient, onUpdate, notify }) {
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

  const upload = async (files) => {
    setUploading(true);
    try {
      let ids = [...patient.photoIds];
      const added = {};
      for (const file of files) {
        const dataUrl = await compressImage(file);
        const pid = uid();
        const ph = { id: pid, tag, fecha: todayISO(), nombre: file.name, data: dataUrl };
        const ok = await sSet(`mxf-ph:${patient.id}:${pid}`, ph);
        if (ok) {
          ids = [pid, ...ids];
          added[pid] = ph;
          await Drive.enqueue(patient.id, pid);
        } else notify("Error al guardar una imagen (¿muy pesada?)");
      }
      setPhotos({ ...photos, ...added });
      onUpdate({ ...patient, photoIds: ids });
      Drive.flush(notify);
    } catch { notify("Error al procesar la imagen"); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const remove = async (pid) => {
    if (!window.confirm("¿Eliminar esta imagen?")) return;
    await sDel(`mxf-ph:${patient.id}:${pid}`);
    const next = { ...photos }; delete next[pid]; setPhotos(next);
    onUpdate({ ...patient, photoIds: patient.photoIds.filter((x) => x !== pid) });
    setLightbox(null);
  };

  const visible = patient.photoIds
    .map((pid) => photos[pid]).filter(Boolean)
    .filter((ph) => !filterTag || ph.tag === filterTag);

  return (
    <div>
      <div style={{ ...S.card, marginBottom: 14 }}>
        <div style={S.cardTitle}>Subir imágenes</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="Etiqueta">
            <select style={S.input} value={tag} onChange={(e) => setTag(e.target.value)}>
              {PHOTO_TAGS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }}
              onChange={(e) => e.target.files.length && upload([...e.target.files])} />
            <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
              onChange={(e) => e.target.files.length && upload([...e.target.files])} />
            <button className="btn-primary" disabled={uploading} onClick={() => camRef.current.click()}>
              {uploading ? "Procesando…" : "📷 Tomar foto"}
            </button>
            <button className="btn-ghost" disabled={uploading} onClick={() => fileRef.current.click()}>
              Elegir de galería
            </button>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#8A9491", marginTop: 8 }}>
          Las imágenes se comprimen automáticamente. En iPhone puedes tomar la foto directamente con la cámara. Para llevarlas a Drive usa «⇩ guardar» en cada imagen o «⇩ Exportar» en la ficha (todo en un solo archivo).
        </div>
      </div>

      <div style={S.chipRow}>
        {PHOTO_TAGS.map((t) => {
          const n = patient.photoIds.map((pid) => photos[pid]).filter((p) => p && p.tag === t).length;
          if (!n) return null;
          const on = filterTag === t;
          return (
            <button key={t} className="chip"
              style={{ borderColor: TAG_COLORS[t], color: on ? "#fff" : TAG_COLORS[t], background: on ? TAG_COLORS[t] : "transparent" }}
              onClick={() => setFilterTag(on ? null : t)}
            >{t} · {n}</button>
          );
        })}
      </div>

      {patient.photoIds.length === 0 && <div style={S.empty}>Sin imágenes. Sube fotos pre-op, intra-op, post-op o controles radiográficos.</div>}

      <div style={S.photoGrid}>
        {visible.map((ph) => (
          <button key={ph.id} className="photo" onClick={() => setLightbox(ph)}>
            <img src={ph.data} alt={ph.nombre} style={S.photoImg} />
            <div style={{ ...S.photoTag, background: TAG_COLORS[ph.tag] }}>{ph.tag}</div>
            <div style={S.photoDate}>{fmtDate(ph.fecha)}</div>
          </button>
        ))}
      </div>

      {lightbox && (
        <div style={S.lightbox} onClick={() => setLightbox(null)}>
          <div style={S.lightboxInner} onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.data} alt="" style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 6 }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, color: "#fff", fontSize: 13 }}>
              <span><b style={{ color: TAG_COLORS[lightbox.tag] }}>{lightbox.tag}</b> · {fmtDate(lightbox.fecha)} · {lightbox.nombre}</span>
              <span style={{ display: "flex", gap: 14 }}>
                <button className="link-light" onClick={() => downloadPhoto(lightbox, patient)}>⇩ guardar</button>
                <button className="link-danger" onClick={() => remove(lightbox.id)}>eliminar</button>
                <button className="link-light" onClick={() => setLightbox(null)}>cerrar ✕</button>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Google Drive (API directa, scope drive.file) ---------- */
async function createDriveFolderFor(patient) {
  try {
    const cat = catById(patient.catDx);
    const mes = (patient.fechaCirugia || patient.creado || todayISO()).slice(0, 7);
    const nombre = `${patient.nombre}${patient.cirugia ? " — " + patient.cirugia : ""} (${mes})`;
    return await Drive.folderForPatient(cat.id, cat.label, nombre);
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
  document.body.appendChild(a); a.click(); a.remove();
}

async function exportPatientHTML(patient, notify) {
  notify("Generando ficha exportable…");
  const photos = [];
  for (const pid of patient.photoIds) {
    const ph = await sGet(`mxf-ph:${patient.id}:${pid}`);
    if (ph) photos.push(ph);
  }
  const cat = catById(patient.catDx);
  const esc = (s) => String(s || "—").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const evoSorted = [...patient.evoluciones].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  const rows = [
    ["RUT", patient.rut], ["Folio", patient.folio],
    ["Nacimiento", patient.nacimiento ? `${fmtDate(patient.nacimiento)} (${age(patient.nacimiento)} años)` : ""],
    ["Sexo", patient.sexo], ["Teléfono", patient.telefono], ["Previsión", patient.prevision],
    ["Antecedentes", patient.antecedentes], ["Alergias", patient.alergias], ["Medicamentos", patient.medicamentos],
    ["Categoría Dx", cat.label], ["Diagnóstico", patient.diagnostico],
    ["Cirugía", patient.cirugia], ["Fecha Qx", patient.fechaCirugia ? fmtDate(patient.fechaCirugia) : ""],
    ["Notas / plan", patient.notas],
  ];
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
${evoSorted.map((e) => `<div class="evo"><b>${esc(e.tipo)}</b> <span class="d">· ${fmtDate(e.fecha)}</span><div>${esc(e.nota)}</div></div>`).join("") || "<p>—</p>"}
<h2>Fotos e imágenes (${photos.length})</h2>
<div class="grid">${photos.map((p) => `<figure><img src="${p.data}" alt=""><figcaption><b>${esc(p.tag)}</b> · ${fmtDate(p.fecha)}</figcaption></figure>`).join("") || "<p>—</p>"}</div>
</body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const base = (patient.nombre || "paciente").trim().replace(/\s+/g, "_");
  a.href = url; a.download = `Ficha_${base}${patient.folio ? "_" + patient.folio : ""}.html`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
  notify("Ficha exportada — guárdala en Drive desde Compartir");
}

/* ============================================================
   UI helpers
   ============================================================ */
const Section = ({ label, children }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={S.sectionLabel}>{label}</div>
    {children}
  </div>
);
const Grid = ({ children }) => <div className="grid">{children}</div>;
const Field = ({ label, children, full }) => (
  <label style={{ display: "block", gridColumn: full ? "1 / -1" : "auto" }}>
    <div style={S.fieldLabel}>{label}</div>
    {children}
  </label>
);

/* ============================================================
   Estilos
   ============================================================ */
const S = {
  app: { minHeight: "100vh", background: "#F4F6F5", color: "#1B2A2F", fontFamily: "'IBM Plex Sans', -apple-system, 'Segoe UI', sans-serif" },
  header: { background: "#10393F", color: "#fff", padding: "0 16px" },
  headerInner: { maxWidth: 860, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", gap: 10, flexWrap: "wrap" },
  brandTop: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.18em", color: "#7FB5AE" },
  brandMain: { fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em" },
  main: { maxWidth: 860, margin: "0 auto", padding: "20px 16px 60px" },
  loading: { textAlign: "center", padding: 40, color: "#66716F" },
  toolbar: { display: "flex", gap: 0, flexWrap: "wrap", marginBottom: 12, alignItems: "center" },
  search: { flex: 1, minWidth: 220, padding: "10px 14px", border: "1px solid #C9D2D0", borderRadius: 8, fontSize: 14, background: "#fff", marginRight: 10, outline: "none" },
  chipRow: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 },
  groupHead: { fontSize: 14, fontWeight: 700, padding: "6px 10px", marginBottom: 8, background: "#fff", borderRadius: 6 },
  rowName: { fontSize: 15, fontWeight: 650 },
  rowSub: { fontSize: 13, color: "#4A5654", marginTop: 3 },
  rowMeta: { display: "flex", flexDirection: "column", gap: 2, fontSize: 12, color: "#8A9491", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" },
  folio: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#16606B", background: "#E4EEEC", padding: "1px 7px", borderRadius: 4 },
  card: { background: "#fff", border: "1px solid #E1E7E5", borderRadius: 10, padding: "18px 20px" },
  cardTitle: { fontSize: 15, fontWeight: 700, marginBottom: 14 },
  sectionLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#16606B", marginBottom: 8, borderBottom: "1px solid #E1E7E5", paddingBottom: 5 },
  fieldLabel: { fontSize: 12, fontWeight: 600, color: "#4A5654", marginBottom: 4 },
  input: { width: "100%", padding: "9px 11px", border: "1px solid #C9D2D0", borderRadius: 7, fontSize: 14, background: "#FCFDFC", boxSizing: "border-box", fontFamily: "inherit" },
  textarea: { width: "100%", padding: "9px 11px", border: "1px solid #C9D2D0", borderRadius: 7, fontSize: 14, background: "#FCFDFC", boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" },
  alertBox: { marginTop: 12, background: "#FBF4E8", border: "1px solid #EAD9B8", borderRadius: 8, padding: "10px 14px", fontSize: 13, display: "flex", flexDirection: "column", gap: 3 },
  tabRow: { display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" },
  defRow: { display: "flex", gap: 14, padding: "8px 0", borderBottom: "1px solid #F0F3F2" },
  defKey: { width: 140, minWidth: 140, fontSize: 13, color: "#66716F", fontWeight: 600 },
  defVal: { fontSize: 14, whiteSpace: "pre-wrap" },
  empty: { background: "#fff", border: "1px dashed #C9D2D0", borderRadius: 10, padding: "28px 20px", textAlign: "center", color: "#4A5654", fontSize: 14, marginBottom: 14 },
  photoGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 },
  photoImg: { width: "100%", height: 140, objectFit: "cover", display: "block" },
  photoTag: { position: "absolute", top: 6, left: 6, color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 4 },
  photoDate: { position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(16,57,63,0.75)", color: "#fff", fontSize: 11, padding: "3px 8px", fontFamily: "'IBM Plex Mono', monospace" },
  lightbox: { position: "fixed", inset: 0, background: "rgba(10,20,22,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 },
  lightboxInner: { maxWidth: 900, width: "100%" },
  toast: { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#10393F", color: "#fff", padding: "10px 20px", borderRadius: 8, fontSize: 14, zIndex: 200, boxShadow: "0 4px 16px rgba(0,0,0,0.25)" },
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
function DriveBar({ drive, notify }) {
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState(false);
  const [cid, setCid] = useState("");

  if (drive.state === "ready" && !drive.pending) {
    return (
      <div style={S.driveBar}>
        <span style={S.driveOk}>●</span> Drive conectado — las fotos se suben solas
        <button className="link-drive" onClick={() => Drive.disconnect()}>desconectar</button>
      </div>
    );
  }

  if (drive.state === "ready" && drive.pending) {
    return (
      <div style={S.driveBar}>
        <span style={S.driveWait}>●</span> Subiendo {drive.pending} {drive.pending === 1 ? "imagen" : "imágenes"} a Drive…
      </div>
    );
  }

  if (drive.state === "nosetup" || setup) {
    return (
      <div style={{ ...S.driveBar, ...S.driveBarWarn, display: "block" }}>
        <div style={{ marginBottom: 8 }}>
          <b>Conectar Google Drive.</b> Pega aquí el ID de cliente que creaste en Google Cloud.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            style={{ ...S.input, flex: 1, minWidth: 240 }}
            placeholder="000000-xxxxx.apps.googleusercontent.com"
            value={cid}
            onChange={(e) => setCid(e.target.value)}
          />
          <button
            className="btn-primary"
            disabled={busy || !cid.trim()}
            onClick={async () => {
              setBusy(true);
              const ok = await Drive.saveClientId(cid.trim());
              setBusy(false);
              setSetup(false);
              notify(ok ? "ID guardado — ahora autoriza el acceso" : "Ese ID no parece válido");
            }}
          >
            Guardar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...S.driveBar, ...S.driveBarWarn }}>
      <span style={S.driveOff}>●</span>
      Drive desconectado{drive.pending ? ` — ${drive.pending} pendientes` : ""}
      <button
        className="btn-primary"
        style={{ padding: "5px 12px", fontSize: 12.5, marginLeft: 10 }}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const ok = await Drive.connect();
          setBusy(false);
          if (ok) { notify("Drive conectado"); Drive.flush(notify); }
          else notify("No se pudo conectar — reintenta");
        }}
      >
        {busy ? "Conectando…" : "Conectar"}
      </button>
      <button className="link-drive" onClick={() => setSetup(true)}>cambiar ID</button>
    </div>
  );
}

Object.assign(S, {
  driveBar: {
    maxWidth: 860, margin: "0 auto", padding: "9px 16px",
    fontSize: 13, color: "#2A3B40", background: "#E4EDEB",
    display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
  },
  driveBarWarn: { background: "#FBF0DC" },
  driveOk: { color: "#2F6B3A", fontSize: 15 },
  driveOff: { color: "#B3402A", fontSize: 15 },
  driveWait: { color: "#B4690E", fontSize: 15 },
});

/* ============================================================ */
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
