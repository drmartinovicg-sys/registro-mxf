/* ============================================================
   Google Drive — conexión directa desde la aplicación
   Ámbito: drive.file (solo los archivos que crea esta app).
   Estructura creada automáticamente:
     Registro Clínico MXF /
       Trauma facial /
         Juan Pérez — LeFort I (2026-07) /
            fotos…
   ============================================================ */
window.Drive = (function () {
  const SCOPE = "https://www.googleapis.com/auth/drive.file";
  const ROOT_NAME = "Registro Clínico MXF";
  const FOLDER_MIME = "application/vnd.google-apps.folder";

  let clientId = null;
  let tokenClient = null;
  let token = null;
  let tokenExp = 0;
  let pending = 0;
  let flushing = false;
  let listener = null;

  const emit = () => listener && listener(status());

  function status() {
    if (!clientId) return { state: "nosetup", pending };
    if (token && Date.now() < tokenExp) return { state: "ready", pending };
    return { state: "off", pending };
  }

  function onChange(cb) { listener = cb; }

  /* ---------- carga del SDK de Google ---------- */
  function gisReady() {
    return new Promise((res, rej) => {
      if (window.google?.accounts?.oauth2) return res();
      let t = 0;
      const iv = setInterval(() => {
        if (window.google?.accounts?.oauth2) { clearInterval(iv); res(); }
        else if (++t > 100) { clearInterval(iv); rej(new Error("Google SDK no disponible")); }
      }, 100);
    });
  }

  function buildClient() {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: () => {},
    });
  }

  /* ---------- token ---------- */
  function requestToken(interactive) {
    return new Promise((res) => {
      if (!tokenClient) return res(null);
      tokenClient.callback = (r) => {
        if (r.error || !r.access_token) return res(null);
        token = r.access_token;
        tokenExp = Date.now() + (r.expires_in ? r.expires_in * 1000 : 3600000) - 60000;
        DB.set("mxf-drive-token", { token, tokenExp });
        emit();
        res(token);
      };
      try {
        tokenClient.requestAccessToken({ prompt: interactive ? "" : "none" });
      } catch { res(null); }
    });
  }

  async function getToken(interactive) {
    if (token && Date.now() < tokenExp) return token;
    if (!tokenClient) return null;
    let t = await requestToken(false);
    if (!t && interactive) t = await requestToken(true);
    if (!t) { token = null; tokenExp = 0; emit(); }
    return t;
  }

  /* ---------- arranque ---------- */
  async function init() {
    clientId = await DB.get("mxf-drive-clientid");
    const saved = await DB.get("mxf-drive-token");
    if (saved && saved.tokenExp > Date.now()) { token = saved.token; tokenExp = saved.tokenExp; }
    const q = (await DB.get("mxf-drive-queue")) || [];
    pending = q.length;
    if (clientId) {
      try { await gisReady(); buildClient(); await getToken(false); }
      catch (e) { console.error("Drive init", e); }
    }
    emit();
    return status();
  }

  async function saveClientId(id) {
    if (!/\.apps\.googleusercontent\.com$/.test(id)) return false;
    clientId = id;
    await DB.set("mxf-drive-clientid", id);
    try { await gisReady(); buildClient(); } catch { /* ok */ }
    emit();
    return true;
  }

  async function connect() {
    if (!clientId) return false;
    if (!tokenClient) { try { await gisReady(); buildClient(); } catch { return false; } }
    const t = await getToken(true);
    return !!t;
  }

  function disconnect() {
    if (token) { try { google.accounts.oauth2.revoke(token); } catch { /* ok */ } }
    token = null; tokenExp = 0;
    DB.del("mxf-drive-token");
    emit();
  }

  /* ---------- llamadas a la API ---------- */
  async function api(url, opts = {}) {
    const t = await getToken(false);
    if (!t) throw new Error("sin token");
    const r = await fetch(url, {
      ...opts,
      headers: { Authorization: "Bearer " + t, ...(opts.headers || {}) },
    });
    if (r.status === 401) { token = null; tokenExp = 0; emit(); throw new Error("token vencido"); }
    if (!r.ok) throw new Error("Drive " + r.status);
    return r.json();
  }

  async function findFolder(name, parentId) {
    const q = [
      `mimeType='${FOLDER_MIME}'`,
      `name='${name.replace(/'/g, "\\'")}'`,
      "trashed=false",
      parentId ? `'${parentId}' in parents` : "'root' in parents",
    ].join(" and ");
    const r = await api(
      "https://www.googleapis.com/drive/v3/files?q=" +
        encodeURIComponent(q) + "&fields=files(id,webViewLink)&pageSize=1"
    );
    return r.files && r.files[0] ? r.files[0] : null;
  }

  async function makeFolder(name, parentId) {
    return api("https://www.googleapis.com/drive/v3/files?fields=id,webViewLink", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        mimeType: FOLDER_MIME,
        ...(parentId ? { parents: [parentId] } : {}),
      }),
    });
  }

  async function ensureFolder(cacheKey, name, parentId) {
    const cached = await DB.get(cacheKey);
    if (cached) {
      try {
        await api(`https://www.googleapis.com/drive/v3/files/${cached.id}?fields=id,trashed`);
        return cached;
      } catch { /* se recrea abajo */ }
    }
    const found = (await findFolder(name, parentId)) || (await makeFolder(name, parentId));
    const rec = {
      id: found.id,
      url: found.webViewLink || `https://drive.google.com/drive/folders/${found.id}`,
      nombre: name,
    };
    await DB.set(cacheKey, rec);
    return rec;
  }

  const ensureRoot = () => ensureFolder("mxf-drive-root", ROOT_NAME, null);

  async function ensureCategory(catId, catLabel) {
    const root = await ensureRoot();
    return ensureFolder(`mxf-drive-cat:${catId}`, catLabel, root.id);
  }

  async function folderForPatient(catId, catLabel, nombre) {
    const cat = await ensureCategory(catId, catLabel);
    const found = (await findFolder(nombre, cat.id)) || (await makeFolder(nombre, cat.id));
    return {
      id: found.id,
      url: found.webViewLink || `https://drive.google.com/drive/folders/${found.id}`,
      nombre,
    };
  }

  async function uploadImage(folderId, name, dataUrl) {
    const t = await getToken(false);
    if (!t) throw new Error("sin token");
    const mime = (dataUrl.match(/^data:([^;]+);/) || [])[1] || "image/jpeg";
    const base64 = dataUrl.split(",")[1];
    const boundary = "mxf" + Math.random().toString(36).slice(2);
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ name, parents: [folderId] }) +
      `\r\n--${boundary}\r\nContent-Type: ${mime}\r\n` +
      `Content-Transfer-Encoding: base64\r\n\r\n${base64}\r\n--${boundary}--`;
    const r = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + t,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );
    if (r.status === 401) { token = null; tokenExp = 0; emit(); throw new Error("token vencido"); }
    if (!r.ok) throw new Error("subida " + r.status);
    return r.json();
  }

  /* ---------- cola de subida ---------- */
  async function enqueue(patientId, photoId) {
    const q = (await DB.get("mxf-drive-queue")) || [];
    if (!q.some((x) => x.photoId === photoId)) q.push({ patientId, photoId });
    await DB.set("mxf-drive-queue", q);
    pending = q.length;
    emit();
  }

  async function flush(notify) {
    if (flushing) return;
    let q = (await DB.get("mxf-drive-queue")) || [];
    if (!q.length) { pending = 0; emit(); return; }
    if (status().state !== "ready") { pending = q.length; emit(); return; }

    flushing = true;
    let subidas = 0;
    try {
      while (q.length) {
        const job = q[0];
        const patient = await DB.get(`mxf-p:${job.patientId}`);
        const photo = await DB.get(`mxf-ph:${job.patientId}:${job.photoId}`);
        if (!patient || !photo) { q.shift(); continue; }

        let folder = patient.driveFolder;
        if (!folder) {
          const cats = window.MXF_CATS || [];
          const cat = cats.find((c) => c.id === patient.catDx) || { id: "otro", label: "Otro" };
          const mes = (patient.fechaCirugia || patient.creado || "").slice(0, 7);
          const nombre = `${patient.nombre}${patient.cirugia ? " — " + patient.cirugia : ""} (${mes})`;
          folder = await folderForPatient(cat.id, cat.label, nombre);
          await DB.set(`mxf-p:${job.patientId}`, { ...patient, driveFolder: folder });
        }

        const stamp = (photo.fecha || "").replace(/-/g, "");
        const ext = (photo.nombre || "").split(".").pop() || "jpg";
        const nombreArchivo = `${stamp}_${photo.tag.replace(/[^\wáéíóúñ-]/gi, "")}_${photo.id}.${ext}`;
        await uploadImage(folder.id, nombreArchivo, photo.data);

        q.shift();
        subidas++;
        await DB.set("mxf-drive-queue", q);
        pending = q.length;
        emit();
      }
      if (subidas && notify) notify(`${subidas} ${subidas === 1 ? "imagen subida" : "imágenes subidas"} a Drive`);
    } catch (e) {
      console.error("Drive flush", e);
      await DB.set("mxf-drive-queue", q);
      pending = q.length;
      emit();
    }
    flushing = false;
  }

  return {
    init, status, onChange, saveClientId, connect, disconnect,
    folderForPatient, enqueue, flush,
  };
})();
