const $ = id => document.getElementById(id);
const MAX = 3;
let stream = null, loop = null;
let pending = null;                 // uploaded photo waiting to be added
let samples = [];                   // [{ img, pose }]
let q = { face:false, light:false };

/* ---------- Tabs ---------- */
document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === t));
  $('pane-cam').hidden = t.dataset.tab !== 'cam';
  $('pane-up').hidden  = t.dataset.tab !== 'up';
  stopCam(); clearUpload(); resetChips();
  refresh();
});

/* ---------- Quality chips ---------- */
function chip(id, state, label, value){
  const c = $(id);
  c.className = 'chip ' + state;
  c.lastElementChild.textContent = label + ': ' + value;
}
function resetChips(){
  chip('cFace','','Face detected','—'); chip('cLight','','Lighting','—'); chip('cPose','','Pose angle','—');
  q = { face:false, light:false };
  $('oval').classList.remove('good');
}

/* Look at one frame: brightness is measured for real; face + pose use
   the browser's FaceDetector if it exists (Chrome), else a placeholder. */
async function analyse(src, w, h){
  const c = document.createElement('canvas'); c.width = 64; c.height = 48;
  const x = c.getContext('2d'); x.drawImage(src, 0, 0, 64, 48);
  const d = x.getImageData(0, 0, 64, 48).data; let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
  const b = sum / (d.length / 4);
  if (b < 60)       { chip('cLight','bad','Lighting','Too dark');   q.light = false; }
  else if (b > 210) { chip('cLight','warn','Lighting','Too bright'); q.light = false; }
  else              { chip('cLight','ok','Lighting','Good');         q.light = true;  }

  if ('FaceDetector' in window) {
    try {
      const faces = await new FaceDetector({ fastMode:true, maxDetectedFaces:2 }).detect(src);
      if (faces.length === 1) {
        q.face = true; chip('cFace','ok','Face detected','Yes');
        const bb = faces[0].boundingBox;
        const centered = Math.abs((bb.x + bb.width/2)/w - .5) < .15 && Math.abs((bb.y + bb.height/2)/h - .5) < .2;
        chip('cPose', centered ? 'ok' : 'warn', 'Pose angle', centered ? 'Centered' : 'Move to center');
      } else {
        q.face = false; chip('cFace','bad','Face detected', faces.length ? 'Multiple faces' : 'No'); chip('cPose','','Pose angle','—');
      }
    } catch(e){ placeholder(); }
  } else placeholder();
  $('oval').classList.toggle('good', q.face && q.light);
  refresh();
}
/* TODO: swap for real face detection (face-api.js or your backend) */
function placeholder(){ q.face = true; chip('cFace','ok','Face detected','Yes'); chip('cPose','ok','Pose angle','Centered'); }

/* ---------- Camera ---------- */
async function startCam(){
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user' }, audio:false });
    $('video').srcObject = stream;
    $('video').hidden = $('oval').hidden = $('stageHint').hidden = false;
    $('stageMsg').hidden = true;
    $('startBtn').textContent = 'Stop camera';
    clearInterval(loop);
    loop = setInterval(() => { const v = $('video'); if (v.videoWidth) analyse(v, v.videoWidth, v.videoHeight); }, 700);
  } catch(e) {
    $('stageMsg').innerHTML = 'Could not open the camera.<br>Allow camera access in your browser, or use “Upload photo”.';
  }
  refresh();
}
function stopCam(){
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  clearInterval(loop);
  $('video').hidden = $('oval').hidden = $('stageHint').hidden = true;
  $('stageMsg').hidden = false;
  $('stageMsg').innerHTML = 'Camera is off.<br>Press “Start camera” to begin.';
  $('startBtn').textContent = 'Start camera';
  resetChips();
}
$('startBtn').onclick = () => stream ? (stopCam(), refresh()) : startCam();

$('capBtn').onclick = () => {
  if (!stream || samples.length >= MAX || !(q.face && q.light)) return;
  const v = $('video'), c = document.createElement('canvas');
  c.width = v.videoWidth; c.height = v.videoHeight;
  const x = c.getContext('2d'); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(v, 0, 0); // un-mirror
  addSample(c.toDataURL('image/jpeg', .9));
  const f = $('flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
};

/* ---------- Upload ---------- */
const drop = $('drop');
['dragenter','dragover'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.add('over'); }));
['dragleave','drop'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => handleFile(e.dataTransfer.files[0]));
$('file').onchange = e => handleFile(e.target.files[0]);
$('clearUp').onclick = () => { clearUpload(); resetChips(); refresh(); };
$('addUp').onclick = () => {
  if (!pending || samples.length >= MAX || !(q.face && q.light)) return;
  addSample(pending); clearUpload(); resetChips(); refresh();
};
function handleFile(f){
  $('upMsg').textContent = '';
  if (!f) return;
  if (!['image/jpeg','image/png'].includes(f.type)) { $('upMsg').textContent = 'Please choose a JPG or PNG image.'; return; }
  if (f.size > 5 * 1024 * 1024) { $('upMsg').textContent = 'That file is larger than 5MB.'; return; }
  const r = new FileReader();
  r.onload = () => {
    pending = r.result;
    const p = $('prev');
    p.onload = () => analyse(p, p.naturalWidth, p.naturalHeight);
    p.src = pending; p.hidden = $('clearUp').hidden = $('addUp').hidden = false; $('dropTxt').hidden = true;
  };
  r.readAsDataURL(f);
}
function clearUpload(){
  pending = null;
  $('prev').hidden = $('clearUp').hidden = $('addUp').hidden = true;
  $('dropTxt').hidden = false; $('file').value = ''; $('upMsg').textContent = '';
}

/* ---------- Samples ---------- */
function addSample(img){
  if (samples.length >= MAX) return;
  samples.push({ img, pose: $('cPose').lastElementChild.textContent.replace('Pose angle: ','') });
  renderSamples(); refresh();
}
function renderSamples(){
  const box = $('samples');
  if (!samples.length) { box.innerHTML = '<div class="sample-empty">No face samples captured yet.</div>'; return; }
  box.innerHTML = samples.map((s, i) => `
    <div class="sample">
      <img src="${s.img}" alt="Sample ${i+1}">
      <div><strong>Sample ${i+1}</strong><small>Quality check passed</small></div>
      <button type="button" data-i="${i}" aria-label="Remove sample ${i+1}"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>`).join('');
  box.querySelectorAll('button').forEach(b => b.onclick = () => { samples.splice(+b.dataset.i, 1); renderSamples(); refresh(); });
}

/* ---------- State ---------- */
function refresh(){
  const n = samples.length, full = n >= MAX, ok = q.face && q.light;
  $('capBtn').textContent = 'Capture sample (' + n + '/' + MAX + ')';
  $('addUp').textContent  = 'Add as sample (' + n + '/' + MAX + ')';
  $('capBtn').disabled = !(stream && ok && !full);
  $('addUp').disabled  = !(pending && ok && !full);
  $('sampleCount').textContent = n + '/' + MAX;
  $('sampleCount').classList.toggle('full', full);
  $('headStatus').lastElementChild.textContent = n ? n + ' of ' + MAX + ' samples captured' : 'Not enrolled yet';
  $('enrollBtn').disabled = !full;
}

$('enrollBtn').onclick = async () => {
  const payload = { samples: samples.map(s => s.img) };   // identity comes from the signed-in account
  $('enrollBtn').disabled = true; $('enrollBtn').textContent = 'Enrolling…';
  stopCam();
  /* TODO: send to your backend, for example:
     await fetch('/api/enroll-face', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) }); */
  await new Promise(r => setTimeout(r, 900));
  $('done').hidden = false;
};
renderSamples(); resetChips(); refresh();