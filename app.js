const loginScreen = document.querySelector('#login-screen');
const dashboardScreen = document.querySelector('#dashboard-screen');
const toast = document.querySelector('#toast');
const scannerScreen = document.querySelector('#scanner-screen');
const cameraVideo = document.querySelector('#camera-video');
const patientCard = document.querySelector('#patient-card');
let cameraStream;
let detectorTimer;

function showDashboard() {
  stopCamera();
  loginScreen.hidden = true;
  dashboardScreen.hidden = false;
  scannerScreen.hidden = true;
  window.scrollTo(0, 0);
}

async function showScanner() {
  loginScreen.hidden = true;
  dashboardScreen.hidden = true;
  scannerScreen.hidden = false;
  patientCard.hidden = true;
  window.scrollTo(0, 0);
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    cameraVideo.srcObject = cameraStream;
    document.querySelector('.camera-stage').classList.add('camera-live');
    startDetection();
  } catch (error) {
    notify('No fue posible acceder a la cámara. Usa Galería o permite el acceso');
  }
}

function stopCamera() {
  window.clearInterval(detectorTimer);
  if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
  cameraStream = undefined;
  if (cameraVideo) cameraVideo.srcObject = null;
}

function showPatient() {
  patientCard.hidden = false;
  patientCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function startDetection() {
  if (!('BarcodeDetector' in window)) return;
  const detector = new BarcodeDetector({ formats: ['qr_code'] });
  detectorTimer = window.setInterval(async () => {
    if (!cameraVideo.videoWidth) return;
    try {
      const codes = await detector.detect(cameraVideo);
      if (codes.length) { window.clearInterval(detectorTimer); showPatient(); }
    } catch (_) { /* keep scanning */ }
  }, 650);
}

function notify(message) {
  toast.textContent = `${message} estará disponible próximamente.`;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2800);
}

document.querySelector('#login-form').addEventListener('submit', (event) => {
  event.preventDefault();
  showDashboard();
});

document.querySelector('.quick-access').addEventListener('click', showDashboard);
document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', () => button.dataset.action === 'Escanear QR de paciente' ? showScanner() : notify(button.dataset.action));
});

document.querySelector('#scanner-back').addEventListener('click', showDashboard);
document.querySelector('#scanner-home').addEventListener('click', showDashboard);
document.querySelector('#gallery-input').addEventListener('change', async (event) => {
  const image = event.target.files[0];
  if (!image) return;
  if ('BarcodeDetector' in window) {
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    const codes = await detector.detect(image);
    if (codes.length) return showPatient();
  }
  notify('No se pudo leer el QR de la imagen');
});
