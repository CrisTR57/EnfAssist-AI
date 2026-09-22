const loginScreen = document.querySelector('#login-screen');
const dashboardScreen = document.querySelector('#dashboard-screen');
const toast = document.querySelector('#toast');
const scannerScreen = document.querySelector('#scanner-screen');
const cameraVideo = document.querySelector('#camera-video');
const patientCard = document.querySelector('#patient-card');
const careScreen = document.querySelector('#care-screen');
const fuaScreen = document.querySelector('#fua-screen');
const qrManagementScreen = document.querySelector('#qr-management-screen');
const qrDetailScreen = document.querySelector('#qr-detail-screen');
const qrScanScreen = document.querySelector('#qr-scan-screen');
const patientProfileScreen = document.querySelector('#patient-profile-screen');
const patientDashboardScreen = document.querySelector('#patient-dashboard-screen');
const adminDashboardScreen = document.querySelector('#admin-dashboard-screen');
const rolePanelScreen = document.querySelector('#role-panel-screen');
const qrPatientsKey = 'enfassist-qr-patients-v1';
const clinicalRecordsKey = 'enfassist-clinical-records-v1';
const fuaDraftsKey = 'enfassist-fua-drafts-v1';
const usersKey = 'enfassist-users-v1';
const defaultUsers = [
  { id: 'USR-0001', dni: '00000001', password: 'admin123', name: 'Ana Torres', role: 'admin', active: true },
  { id: 'USR-0002', dni: '12345678', password: 'salud123', name: 'María Fernández', role: 'health', active: true },
  { id: 'USR-0003', dni: '87654321', password: 'paciente123', name: 'María López García', role: 'patient', active: true, patientId: 'PAT-3M7P-X92K-4LQD' }
];
function normalizeUser(user, index) {
  return { ...user, id: user.id || `USR-${String(index + 1).padStart(4, '0')}`, active: user.active !== false };
}
let users = (JSON.parse(localStorage.getItem(usersKey) || 'null') || defaultUsers).map(normalizeUser);
let currentUser = null;
const authTokenKey = 'enfassist-jwt';
const apiBaseUrl = window.ENFASSIST_API_URL || (window.location.port === '4174' ? 'http://localhost:3000' : '');

function authHeaders() {
  const token = sessionStorage.getItem(authTokenKey);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function mapApiUser(user) {
  const roleMap = { ADMIN: 'admin', ENFERMERO: 'health', PACIENTE: 'patient' };
  return {
    ...user,
    id: user.id,
    name: [user.nombres, user.apellidos].filter(Boolean).join(' '),
    dni: user.dni,
    correo: user.correo,
    role: roleMap[user.rol] || 'patient',
    active: user.activo !== false
  };
}

function showAuthError(message) {
  const feedback = document.querySelector('#login-feedback');
  feedback.textContent = message;
  feedback.hidden = false;
}

async function restoreSession() {
  const token = sessionStorage.getItem(authTokenKey);
  if (!token) return;

  try {
    const response = await fetch(`${apiBaseUrl}/api/auth/me`, { headers: authHeaders() });
    if (!response.ok) throw new Error('session_expired');
    const payload = await response.json();
    currentUser = mapApiUser(payload.user);
    document.querySelector('#login-feedback').hidden = true;
    if (currentUser.role === 'admin') return showAdminDashboard();
    if (currentUser.role === 'patient') return showPatientDashboard();
    showDashboard();
  } catch (_error) {
    sessionStorage.removeItem(authTokenKey);
    currentUser = null;
  }
}
const defaultQrPatients = [
  { id: 'PAT-8F4K-29XM-7QPL', name: 'Juan Pérez Ramírez', dni: '12345678', qrStatus: 'Activo', age: '65 años', sex: 'Masculino', bloodType: 'O+', address: 'Jr. Los Sauces 123, Tingo María', phone: '987 654 321', allergies: 'Penicilina', chronicConditions: 'Hipertensión arterial', regularMedications: 'Losartán 50 mg · una vez al día' },
  { id: 'PAT-3M7P-X92K-4LQD', name: 'María López García', dni: '87654321', qrStatus: 'Activo', age: '42 años', sex: 'Femenino', bloodType: 'A+', address: 'Av. Perú 450, Tingo María', phone: '912 456 781', allergies: 'Sin alergias registradas', chronicConditions: 'Diabetes mellitus tipo 2', regularMedications: 'Metformina 850 mg · cada 12 horas' },
  { id: 'PAT-6R8A-15NK-9WTC', name: 'Rosa Isuiza Flores', dni: '45678912', qrStatus: 'Activo', age: '58 años', sex: 'Femenino', bloodType: 'B+', address: 'Jr. Amazonas 89, Tingo María', phone: '945 830 265', allergies: 'AINEs', chronicConditions: 'Asma bronquial', regularMedications: 'Salbutamol inhalador · según indicación' }
];
const storedQrPatients = JSON.parse(localStorage.getItem(qrPatientsKey) || 'null');
let qrPatients = (storedQrPatients || defaultQrPatients).map((patient) => ({ ...defaultQrPatients.find((item) => item.id === patient.id), ...patient }));
let selectedQrPatient = qrPatients[0];
let clinicalRecords = JSON.parse(localStorage.getItem(clinicalRecordsKey) || '[]');
let qrScanStream;
let qrDetectorTimer;
let qrDetectionLocked = false;
let isQrDetecting = false;
let qrFallbackCanvas;
let cameraStream;
let detectorTimer;
let clinicalRecognition;
let isClinicalRecording = false;
const guidedQuestions = [
  { category: 'Datos del paciente', question: '¿Confirmas la identidad del paciente seleccionado?', help: 'Verifica nombre y DNI antes de continuar.', field: 'draft-identity', placeholder: 'Escribe: Confirmado' },
  { category: 'Datos del paciente', question: '¿Cuál es la edad del paciente?', field: 'draft-age', placeholder: 'Ej. 65 años' },
  { category: 'Datos del paciente', question: '¿Cuál es el sexo registrado?', field: 'draft-sex', placeholder: 'Ej. Masculino, Femenino' },
  { category: 'Datos del paciente', question: '¿Qué antecedentes importantes presenta?', field: 'draft-background', placeholder: 'Antecedentes relevantes' },
  { category: 'Datos del paciente', question: '¿Qué enfermedades crónicas presenta?', field: 'draft-conditions', placeholder: 'Ej. Hipertensión arterial' },
  { category: 'Datos del paciente', question: '¿Tiene alergias conocidas?', field: 'draft-allergies', placeholder: 'Ej. Penicilina o Sin alergias' },
  { category: 'Datos de la atención', question: '¿Cuál es el motivo de atención?', field: 'draft-reason', placeholder: 'Motivo de consulta' },
  { category: 'Datos de la atención', question: 'Indica fecha y hora de la atención.', field: 'draft-date', placeholder: '', type: 'datetime-local' },
  { category: 'Datos de la atención', question: '¿Cuál es el tipo de atención?', field: 'draft-care-type', placeholder: 'Ej. Consulta externa, triaje' },
  { category: 'Datos de la atención', question: '¿Qué servicio o área brinda la atención?', field: 'draft-service', placeholder: 'Ej. Enfermería' },
  { category: 'Signos vitales', question: '¿Cuál es la presión arterial?', field: 'draft-bp', placeholder: 'Ej. 120/80' },
  { category: 'Signos vitales', question: '¿Cuál es la frecuencia cardíaca?', field: 'draft-heart-rate', placeholder: 'Ej. 72 lpm' },
  { category: 'Signos vitales', question: '¿Cuál es la temperatura?', field: 'draft-temp', placeholder: 'Ej. 36.5 °C' },
  { category: 'Signos vitales', question: '¿Cuál es la saturación de oxígeno?', field: 'draft-o2', placeholder: 'Ej. 98 %' },
  { category: 'Signos vitales', question: '¿Cuál es el peso?', field: 'draft-weight', placeholder: 'Ej. 70 kg' },
  { category: 'Signos vitales', question: '¿Cuál es la talla?', field: 'draft-height', placeholder: 'Ej. 165 cm' },
  { category: 'Diagnóstico', question: '¿Cuál es el diagnóstico principal?', field: 'draft-diagnosis-main', placeholder: 'Diagnóstico principal' },
  { category: 'Diagnóstico', question: '¿Existen diagnósticos secundarios?', field: 'draft-diagnosis-secondary', placeholder: 'Diagnósticos secundarios' },
  { category: 'Diagnóstico', question: '¿Cuenta con código CIE-10?', field: 'draft-icd10', placeholder: 'Opcional' },
  { category: 'Procedimientos', question: '¿Qué procedimientos se realizaron?', field: 'draft-procedures', placeholder: 'Procedimientos realizados' },
  { category: 'Procedimientos', question: '¿Qué actividades de enfermería se realizaron?', field: 'draft-activities', placeholder: 'Actividades realizadas' },
  { category: 'Medicamentos', question: '¿Qué medicamento se administró?', field: 'draft-medication-name', placeholder: 'Nombre del medicamento' },
  { category: 'Medicamentos', question: '¿Cuál fue la dosis?', field: 'draft-medication-dose', placeholder: 'Ej. 500 mg' },
  { category: 'Medicamentos', question: '¿Cuál fue la vía de administración?', field: 'draft-medication-route', placeholder: 'Ej. Oral, EV, IM' },
  { category: 'Medicamentos', question: '¿Cuál fue la frecuencia?', field: 'draft-medication-frequency', placeholder: 'Ej. Dosis única, cada 8 h' },
  { category: 'Observaciones', question: 'Describe la evolución y las observaciones del paciente.', field: 'draft-observations', placeholder: 'Evolución y observaciones relevantes' }
];
let guidedQuestionIndex = 0;

function hideRoleDashboards() {
  patientDashboardScreen.hidden = true;
  adminDashboardScreen.hidden = true;
  rolePanelScreen.hidden = true;
}

function showDashboard() {
  if (currentUser?.role === 'patient') return showPatientDashboard();
  if (currentUser?.role === 'admin') return showAdminDashboard();
  stopCamera();
  stopVoiceRecognition();
  loginScreen.hidden = true;
  dashboardScreen.hidden = false;
  scannerScreen.hidden = true;
  careScreen.hidden = true;
  fuaScreen.hidden = true;
  qrManagementScreen.hidden = true;
  qrDetailScreen.hidden = true;
  qrScanScreen.hidden = true;
  patientProfileScreen.hidden = true;
  hideRoleDashboards();
  window.scrollTo(0, 0);
}

function hideHealthScreens() {
  [loginScreen, dashboardScreen, scannerScreen, careScreen, fuaScreen, qrManagementScreen, qrDetailScreen, qrScanScreen, patientProfileScreen].forEach((screen) => { screen.hidden = true; });
}

function patientForCurrentUser() {
  return qrPatients.find((patient) => patient.id === currentUser?.patientId) || qrPatients[0];
}

function showPatientDashboard() {
  if (currentUser?.role !== 'patient') return showDashboard();
  stopCamera(); stopQrScanner(); stopVoiceRecognition();
  hideHealthScreens();
  adminDashboardScreen.hidden = true;
  rolePanelScreen.hidden = true;
  patientDashboardScreen.hidden = false;
  const patient = patientForCurrentUser();
  selectedQrPatient = patient;
  document.querySelector('#patient-dashboard-avatar').textContent = patient.name.split(' ').map((part) => part[0]).slice(0, 2).join('');
  document.querySelector('#patient-dashboard-name').textContent = patient.name;
  document.querySelector('#patient-first-name').textContent = patient.name.split(' ')[0];
  const alerts = [patient.allergies && !/sin alergias/i.test(patient.allergies) ? `Alergia: ${patient.allergies}` : '', patient.chronicConditions && !/sin antecedentes/i.test(patient.chronicConditions) ? `Antecedente: ${patient.chronicConditions}` : ''].filter(Boolean);
  document.querySelector('#patient-alert-summary').textContent = `${alerts.length} alerta${alerts.length === 1 ? '' : 's'}`;
  document.querySelector('#patient-alert-detail').textContent = alerts.join(' · ') || 'Sin alertas registradas';
  const record = clinicalRecords.find((item) => recordPatientId(item) === patient.id);
  document.querySelector('#patient-last-info').textContent = record ? 'Tienes un registro clínico IA disponible para revisión por el personal de salud.' : 'No hay registros clínicos nuevos.';
  window.scrollTo(0, 0);
}

function showAdminDashboard() {
  if (currentUser?.role !== 'admin') return showDashboard();
  stopCamera(); stopQrScanner(); stopVoiceRecognition();
  hideHealthScreens();
  patientDashboardScreen.hidden = true;
  rolePanelScreen.hidden = true;
  adminDashboardScreen.hidden = false;
  document.querySelector('#admin-dashboard-name').textContent = currentUser.name;
  document.querySelector('#admin-user-count').textContent = String(users.length);
  showAdminPanel('Usuarios');
  window.scrollTo(0, 0);
}

function showRolePanel(title, subtitle, content) {
  hideHealthScreens();
  patientDashboardScreen.hidden = true;
  adminDashboardScreen.hidden = true;
  rolePanelScreen.hidden = false;
  document.querySelector('#role-panel-title').textContent = title;
  document.querySelector('#role-panel-subtitle').textContent = subtitle;
  document.querySelector('#role-panel-content').innerHTML = content;
  window.scrollTo(0, 0);
}

function showPatientAction(action) {
  const patient = patientForCurrentUser();
  if (action === 'Inicio') return showPatientDashboard();
  if (action === 'Código QR') return showRolePanel('Mi código QR', 'Identificador seguro', `<section class="qr-detail-card"><div class="detail-avatar">${escapeHtml(patient.name.split(' ').map((part) => part[0]).slice(0, 2).join(''))}</div><h2>${escapeHtml(patient.name)}</h2><p>DNI: ${escapeHtml(patient.dni)}</p><div class="qr-code-wrap"><img src="${qrImageUrl(patient.id)}" alt="Código QR personal" /><small>Este código contiene solamente tu identificador.</small></div><div class="qr-id"><span>Código único</span><strong>${escapeHtml(patient.id)}</strong></div></section>`);
  if (action === 'Perfil') return showRolePanel('Mi perfil', 'Información personal y clínica', `<section class="profile-card"><h2>Datos personales</h2><dl><div><dt>DNI</dt><dd>${escapeHtml(patient.dni)}</dd></div><div><dt>Tipo de sangre</dt><dd>${escapeHtml(patient.bloodType || 'No registrado')}</dd></div><div class="profile-wide"><dt>Alergias</dt><dd>${escapeHtml(patient.allergies || 'Sin alergias registradas')}</dd></div><div class="profile-wide"><dt>Enfermedades crónicas</dt><dd>${escapeHtml(patient.chronicConditions || 'Sin antecedentes registrados')}</dd></div></dl></section>`);
  if (action === 'Recetas') return showRolePanel('Mis recetas', 'Medicamentos habituales', `<section class="profile-card"><h2>Medicamentos habituales</h2><p>${escapeHtml(patient.regularMedications || 'No hay recetas registradas.')}</p></section>`);
  return showRolePanel('Signos vitales', 'Registros disponibles', `<section class="profile-card"><h2>Mis signos vitales</h2><p>Los signos vitales registrados por el personal de salud estarán disponibles aquí cuando sean publicados.</p></section>`);
}

function showAdminPanel(action) {
  if (currentUser?.role !== 'admin') return showDashboard();
  const panel = document.querySelector('#admin-panel-content');
  if (action === 'Usuarios') {
    renderUserManagement();
    return;
  }
  if (action === 'Configuración') {
    panel.innerHTML = '<h3>Configuración</h3><p>Parámetros de la aplicación, seguridad, establecimiento y notificaciones. Esta vista mantiene la configuración como borrador local.</p>';
    return;
  }
  panel.innerHTML = `<h3>Reportes</h3><p>Usuarios activos: ${users.length}. Los reportes clínicos consolidados estarán disponibles cuando la aplicación cuente con base de datos central.</p>`;
}

function userRoleLabel(role) {
  if (role === 'admin') return 'Administrador';
  if (role === 'health') return 'Enfermero';
  return 'Paciente';
}

function persistUsers() {
  localStorage.setItem(usersKey, JSON.stringify(users));
  document.querySelector('#admin-user-count').textContent = String(users.length);
}

function nextUserId() {
  const highest = users.reduce((maximum, user) => Math.max(maximum, Number(String(user.id || '').replace(/\D/g, '')) || 0), 0);
  return `USR-${String(highest + 1).padStart(4, '0')}`;
}

function renderUserManagement(query = '') {
  const panel = document.querySelector('#admin-panel-content');
  const term = query.trim().toLowerCase();
  const visibleUsers = users.filter((user) => [user.id, user.name, user.dni, userRoleLabel(user.role)].join(' ').toLowerCase().includes(term));
  panel.innerHTML = `<div class="user-management-heading"><div><h3>Gestión de usuarios</h3><p>Administra accesos, roles y estado de cada cuenta.</p></div><button type="button" class="save-care user-create" data-user-action="create">＋ Nuevo usuario</button></div><label class="user-search">⌕<input id="user-search-input" type="search" value="${escapeHtml(query)}" placeholder="Buscar por nombre, DNI, ID o rol" /></label><p class="user-count">${visibleUsers.length} de ${users.length} usuarios</p><section class="user-list">${visibleUsers.length ? visibleUsers.map((user) => `<article class="user-row"><div class="user-row-main"><span class="user-initials">${escapeHtml(user.name.split(' ').map((part) => part[0]).slice(0, 2).join('') || 'US')}</span><div><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.id)} · DNI: ${escapeHtml(user.dni)}</small><span class="user-role">${userRoleLabel(user.role)}</span></div></div><div class="user-row-actions"><em class="user-status ${user.active ? 'is-active' : 'is-inactive'}">${user.active ? 'Activo' : 'Inactivo'}</em><button type="button" class="draft-button" data-user-action="edit" data-user-id="${escapeHtml(user.id)}">Editar</button><button type="button" class="user-toggle" data-user-action="toggle" data-user-id="${escapeHtml(user.id)}">${user.active ? 'Desactivar' : 'Activar'}</button><button type="button" class="user-delete" data-user-action="delete" data-user-id="${escapeHtml(user.id)}">Eliminar</button></div></article>`).join('') : '<p class="user-empty">No se encontraron usuarios.</p>'}</section>`;
}

function renderUserForm(userId = '') {
  const panel = document.querySelector('#admin-panel-content');
  const user = users.find((item) => item.id === userId);
  const isEditing = Boolean(user);
  const values = user || { id: nextUserId(), name: '', dni: '', password: '', role: 'health', active: true };
  panel.innerHTML = `<div class="user-form-heading"><button class="link" type="button" data-user-action="list">← Volver a usuarios</button><h3>${isEditing ? 'Editar usuario' : 'Nuevo usuario'}</h3><p>${isEditing ? 'Actualiza la información y guarda los cambios.' : 'Completa los datos para crear una cuenta.'}</p></div><form id="user-form" class="user-form"><label>ID de usuario<input name="id" readonly value="${escapeHtml(values.id)}" /></label><label>Nombre completo<input name="name" required value="${escapeHtml(values.name)}" placeholder="Nombres y apellidos" /></label><label>DNI<input name="dni" required inputmode="numeric" pattern="[0-9]{8}" value="${escapeHtml(values.dni)}" placeholder="8 dígitos" /></label><label>Contraseña<input name="password" required minlength="6" type="password" value="${escapeHtml(values.password)}" placeholder="Mínimo 6 caracteres" /></label><label>Rol<select name="role"><option value="admin" ${values.role === 'admin' ? 'selected' : ''}>Administrador</option><option value="health" ${values.role === 'health' ? 'selected' : ''}>Enfermero</option><option value="patient" ${values.role === 'patient' ? 'selected' : ''}>Paciente</option></select></label><label>Estado<select name="active"><option value="true" ${values.active ? 'selected' : ''}>Activo</option><option value="false" ${!values.active ? 'selected' : ''}>Inactivo</option></select></label><p id="user-form-feedback" class="user-form-feedback" hidden></p><div class="user-form-actions"><button class="draft-button" type="button" data-user-action="list">Cancelar</button><button class="save-care" type="submit">${isEditing ? 'Guardar cambios' : 'Crear usuario'}</button></div></form>`;
  panel.querySelector('#user-form').addEventListener('submit', submitUserForm);
}

function submitUserForm(event) {
  event.preventDefault();
  if (currentUser?.role === 'admin') saveManagedUser(event.currentTarget);
}

function saveManagedUser(form) {
  const data = new FormData(form);
  const id = String(data.get('id') || '');
  const name = String(data.get('name') || '').trim();
  const dni = String(data.get('dni') || '').trim();
  const password = String(data.get('password') || '');
  const role = String(data.get('role') || 'health');
  const active = data.get('active') === 'true';
  const feedback = document.querySelector('#user-form-feedback');
  const existingDni = users.find((user) => user.dni === dni && user.id !== id);
  if (!/^\d{8}$/.test(dni)) {
    feedback.textContent = 'El DNI debe tener exactamente 8 dígitos.';
  } else if (existingDni) {
    feedback.textContent = 'Ya existe un usuario registrado con este DNI.';
  } else if (!name || password.length < 6) {
    feedback.textContent = 'Completa el nombre y una contraseña de al menos 6 caracteres.';
  } else {
    const previous = users.find((user) => user.id === id);
    const updated = { ...previous, id, name, dni, password, role, active };
    if (previous) users = users.map((user) => user.id === id ? updated : user);
    else users.push(updated);
    if (currentUser?.id === id) currentUser = updated;
    persistUsers();
    notify(previous ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente');
    renderUserManagement();
    return;
  }
  feedback.hidden = false;
}

function toggleManagedUser(userId) {
  const user = users.find((item) => item.id === userId);
  if (!user) return;
  if (user.id === currentUser?.id) return notify('No puedes desactivar la cuenta con la que estás administrando.');
  users = users.map((item) => item.id === userId ? { ...item, active: !item.active } : item);
  persistUsers();
  notify(user.active ? 'Usuario desactivado' : 'Usuario activado');
  renderUserManagement();
}

function deleteManagedUser(userId) {
  const user = users.find((item) => item.id === userId);
  if (!user) return;
  if (user.id === currentUser?.id) return notify('No puedes eliminar la cuenta con la que estás administrando.');
  const confirmed = window.confirm(`Eliminar definitivamente a ${user.name}. Esta acción no se puede deshacer.`);
  if (!confirmed) return;
  users = users.filter((item) => item.id !== userId);
  persistUsers();
  notify('Usuario eliminado definitivamente');
  renderUserManagement();
}

function logout() {
  stopCamera(); stopQrScanner(); stopVoiceRecognition();
  sessionStorage.removeItem(authTokenKey);
  currentUser = null;
  hideHealthScreens(); hideRoleDashboards();
  loginScreen.hidden = false;
  document.querySelector('#login-form').reset();
  const feedback = document.querySelector('#login-feedback');
  feedback.hidden = true;
  window.scrollTo(0, 0);
}

function showCare() {
  stopCamera();
  stopVoiceRecognition();
  loginScreen.hidden = true;
  dashboardScreen.hidden = true;
  scannerScreen.hidden = true;
  fuaScreen.hidden = true;
  qrManagementScreen.hidden = true;
  qrDetailScreen.hidden = true;
  qrScanScreen.hidden = true;
  patientProfileScreen.hidden = true;
  hideRoleDashboards();
  careScreen.hidden = false;
  const patient = selectedQrPatient || qrPatients[0];
  document.querySelector('#care-patient-initials').textContent = patient.name.split(' ').map((name) => name[0]).slice(0, 2).join('');
  document.querySelector('#care-patient-name').textContent = patient.name;
  document.querySelector('#care-patient-summary').textContent = `${patient.id.replace('PAT-', 'PAC-')} · ${patient.age || 'Edad no registrada'} · ${patient.bloodType || 'Grupo no registrado'}`;
  const careAlerts = [];
  if (patient.allergies && !/sin alergias/i.test(patient.allergies)) careAlerts.push(`Alergia: ${patient.allergies}`);
  if (patient.chronicConditions && !/sin antecedentes/i.test(patient.chronicConditions)) careAlerts.push(`Antecedente: ${patient.chronicConditions}`);
  const careAlertContainer = document.querySelector('#care-patient-alerts');
  careAlertContainer.hidden = careAlerts.length === 0;
  careAlertContainer.textContent = careAlerts.length ? `⚠ Alertas clínicas del paciente: ${careAlerts.join(' · ')}` : '';
  seedClinicalDraft(patient);
  guidedQuestionIndex = 0;
  showGuidedQuestion();
  window.scrollTo(0, 0);
}

function localDateTimeNow() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function seedClinicalDraft(patient) {
  const seed = {
    'draft-identity': 'Confirmado',
    'draft-age': patient.age || '',
    'draft-sex': patient.sex || '',
    'draft-background': '',
    'draft-conditions': patient.chronicConditions || '',
    'draft-allergies': patient.allergies || '',
    'draft-date': localDateTimeNow(),
    'draft-care-type': '',
    'draft-service': 'Enfermería',
    'draft-reason': '',
    'draft-bp': '',
    'draft-heart-rate': '',
    'draft-temp': '',
    'draft-o2': '',
    'draft-weight': '',
    'draft-height': '',
    'draft-diagnosis-main': '',
    'draft-diagnosis-secondary': '',
    'draft-icd10': '',
    'draft-evaluation': '',
    'draft-procedures': '',
    'draft-activities': '',
    'draft-medication-name': '',
    'draft-medication-dose': '',
    'draft-medication-route': '',
    'draft-medication-frequency': '',
    'draft-observations': ''
  };
  Object.entries(seed).forEach(([id, value]) => { document.querySelector(`#${id}`).value = value; });
  document.querySelector('#voice-transcript').value = '';
  document.querySelector('#clinical-draft').hidden = true;
}

function syncGuidedAnswer() {
  const current = guidedQuestions[guidedQuestionIndex];
  const target = document.querySelector(`#${current.field}`);
  if (target) target.value = document.querySelector('#guided-answer').value;
}

function showGuidedQuestion() {
  const current = guidedQuestions[guidedQuestionIndex];
  const input = document.querySelector('#guided-answer');
  document.querySelector('#guided-category').textContent = current.category;
  document.querySelector('#guided-step-badge').textContent = String(guidedQuestionIndex + 1);
  document.querySelector('#guided-question').textContent = current.question;
  document.querySelector('#guided-help').textContent = current.help || 'Puedes escribir la respuesta o usar el dictado clínico rápido.';
  document.querySelector('#guided-progress').textContent = `${guidedQuestionIndex + 1} de ${guidedQuestions.length}`;
  input.type = current.type || 'text';
  input.placeholder = current.placeholder;
  input.value = document.querySelector(`#${current.field}`)?.value || '';
  document.querySelector('#guided-previous').disabled = guidedQuestionIndex === 0;
  document.querySelector('#guided-next').textContent = guidedQuestionIndex === guidedQuestions.length - 1 ? 'Abrir revisión' : 'Siguiente';
}

function nextGuidedQuestion() {
  syncGuidedAnswer();
  if (guidedQuestionIndex === guidedQuestions.length - 1) return openClinicalReview();
  guidedQuestionIndex += 1;
  showGuidedQuestion();
}

function previousGuidedQuestion() {
  syncGuidedAnswer();
  if (guidedQuestionIndex === 0) return;
  guidedQuestionIndex -= 1;
  showGuidedQuestion();
}

function openClinicalReview() {
  syncGuidedAnswer();
  document.querySelector('#clinical-draft').hidden = false;
  document.querySelector('#clinical-draft').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showFua() {
  stopCamera();
  stopVoiceRecognition();
  loginScreen.hidden = true;
  dashboardScreen.hidden = true;
  scannerScreen.hidden = true;
  careScreen.hidden = true;
  fuaScreen.hidden = false;
  qrManagementScreen.hidden = true;
  qrDetailScreen.hidden = true;
  qrScanScreen.hidden = true;
  patientProfileScreen.hidden = true;
  hideRoleDashboards();
  populateFuaFromClinicalRecord();
  window.scrollTo(0, 0);
}

function qrImageUrl(identifier, size = 280) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(identifier)}`;
}

function showQrManagement() {
  stopCamera(); stopQrScanner(); stopVoiceRecognition();
  hideRoleDashboards();
  [loginScreen, dashboardScreen, scannerScreen, careScreen, fuaScreen, qrDetailScreen, qrScanScreen, patientProfileScreen].forEach((screen) => screen.hidden = true);
  qrManagementScreen.hidden = false;
  renderQrPatients();
  window.scrollTo(0, 0);
}

function renderQrPatients(filter = '') {
  const matches = qrPatients.filter((patient) => [patient.name, patient.dni, patient.id].some((value) => value.toLowerCase().includes(filter.trim().toLowerCase())));
  document.querySelector('#qr-list-caption').textContent = `${matches.length} paciente${matches.length === 1 ? '' : 's'} registrado${matches.length === 1 ? '' : 's'}`;
  const list = document.querySelector('#qr-patient-list');
  list.innerHTML = matches.length ? matches.map((patient) => `<article class="qr-patient-row"><div class="qr-row-avatar">${patient.name.split(' ').map((name) => name[0]).slice(0, 2).join('')}</div><div><strong>${patient.name}</strong><span>DNI: ${patient.dni}</span><small>ID: ${patient.id}</small><em>● ${patient.qrStatus}</em></div><div class="qr-row-actions"><button type="button" data-profile-id="${patient.id}">Ver ficha</button><button type="button" data-qr-id="${patient.id}">Ver QR</button></div></article>`).join('') : '<p class="qr-empty">No se encontraron pacientes.</p>';
  list.querySelectorAll('[data-qr-id]').forEach((button) => button.addEventListener('click', () => showQrDetail(button.dataset.qrId)));
  list.querySelectorAll('[data-profile-id]').forEach((button) => button.addEventListener('click', () => showPatientProfile(button.dataset.profileId)));
}

function showQrDetail(identifier) {
  const patient = qrPatients.find((item) => item.id === identifier);
  if (!patient) return notify('Código QR no válido o paciente no encontrado.');
  selectedQrPatient = patient;
  stopQrScanner();
  hideRoleDashboards();
  qrManagementScreen.hidden = true; qrScanScreen.hidden = true; patientProfileScreen.hidden = true; qrDetailScreen.hidden = false;
  document.querySelector('#qr-detail-name').textContent = patient.name;
  document.querySelector('#qr-detail-dni').textContent = `DNI: ${patient.dni}`;
  document.querySelector('#qr-detail-id').textContent = patient.id;
  document.querySelector('#qr-detail-initials').textContent = patient.name.split(' ').map((name) => name[0]).slice(0, 2).join('');
  document.querySelector('#qr-code-image').src = qrImageUrl(patient.id);
  window.scrollTo(0, 0);
}

function showPatientProfile(identifier) {
  const patient = qrPatients.find((item) => item.id === identifier);
  if (!patient) return notify('Paciente no encontrado.');
  selectedQrPatient = patient;
  stopQrScanner();
  hideRoleDashboards();
  [qrManagementScreen, qrDetailScreen, qrScanScreen, dashboardScreen, scannerScreen, careScreen, fuaScreen].forEach((screen) => screen.hidden = true);
  patientProfileScreen.hidden = false;
  document.querySelector('#profile-name').textContent = patient.name;
  document.querySelector('#profile-dni').textContent = `DNI: ${patient.dni}`;
  document.querySelector('#profile-id').textContent = patient.id;
  document.querySelector('#profile-history').textContent = patient.id.replace('PAT-', 'PAC-');
  document.querySelector('#profile-initials').textContent = patient.name.split(' ').map((name) => name[0]).slice(0, 2).join('');
  document.querySelector('#profile-age').textContent = patient.age || 'No registrado';
  document.querySelector('#profile-sex').textContent = patient.sex || 'No registrado';
  document.querySelector('#profile-address').textContent = patient.address || 'No registrada';
  document.querySelector('#profile-phone').textContent = patient.phone || 'No registrado';
  document.querySelector('#profile-blood').textContent = patient.bloodType || 'No registrado';
  document.querySelector('#profile-allergies').textContent = patient.allergies || 'Sin alergias registradas';
  document.querySelector('#profile-conditions').textContent = patient.chronicConditions || 'Sin antecedentes registrados';
  document.querySelector('#profile-medications').textContent = patient.regularMedications || 'No registrados';
  renderPatientAlerts(patient);
  renderClinicalHistory(patient.id);
  window.scrollTo(0, 0);
}

function renderPatientAlerts(patient) {
  const alerts = [];
  if (patient.allergies && !/sin alergias/i.test(patient.allergies)) alerts.push(`Alergia registrada: ${patient.allergies}`);
  if (patient.chronicConditions && !/sin antecedentes/i.test(patient.chronicConditions)) alerts.push(`Antecedente crónico: ${patient.chronicConditions}`);
  const container = document.querySelector('#profile-alerts');
  const count = document.querySelector('#profile-alert-count');
  container.innerHTML = alerts.map((alert) => `<p>⚠ <span>${alert}</span></p>`).join('');
  container.hidden = alerts.length === 0;
  count.hidden = alerts.length === 0;
  count.textContent = `${alerts.length} alerta${alerts.length === 1 ? '' : 's'}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function renderClinicalHistory(patientId) {
  const records = clinicalRecords.filter((record) => recordPatientId(record) === patientId).sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  const history = document.querySelector('#clinical-history');
  if (!records.length) {
    history.innerHTML = '<p class="clinical-history-empty">Aún no hay registros generados por Registro Clínico IA.</p>';
    return;
  }
  history.innerHTML = records.map((record) => {
    const date = new Date(record.createdAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
    const attention = record.registroClinico || record.attention || record;
    const procedures = Array.isArray(attention.procedimientos) ? attention.procedimientos.join(', ') : attention.procedures;
    const detail = procedures || attention.motivo || attention.reason || attention.evaluacion || attention.evaluation || 'Registro clínico generado con IA';
    return `<article class="clinical-history-item"><b>${escapeHtml(date)}</b><div><strong>Registro Clínico IA</strong><span>${escapeHtml(detail)}</span></div><em>Revisado</em></article>`;
  }).join('');
}

function generateUniqueQr() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const block = () => Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  let id;
  do { id = `PAT-${block()}-${block()}-${block()}`; } while (qrPatients.some((patient) => patient.id === id));
  return id;
}

function generateQrForSelected() {
  const patient = qrPatients.find((item) => !item.id);
  if (!patient) return notify('Todos los pacientes registrados ya tienen un QR único');
  patient.id = generateUniqueQr(); patient.qrStatus = 'Activo';
  localStorage.setItem(qrPatientsKey, JSON.stringify(qrPatients));
  showQrDetail(patient.id);
}

async function showScanner() {
  loginScreen.hidden = true;
  dashboardScreen.hidden = true;
  scannerScreen.hidden = false;
  qrManagementScreen.hidden = true;
  qrDetailScreen.hidden = true;
  qrScanScreen.hidden = true;
  careScreen.hidden = true;
  fuaScreen.hidden = true;
  patientCard.hidden = true;
  hideRoleDashboards();
  window.scrollTo(0, 0);
  qrDetectionLocked = false;
  setScannerStatus('Iniciando cámara para buscar el código QR…');
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    cameraVideo.srcObject = cameraStream;
    await cameraVideo.play().catch(() => {});
    document.querySelector('.camera-stage').classList.add('camera-live');
    startDetection(cameraVideo, 'scanner-status');
  } catch (error) {
    setScannerStatus('No se pudo abrir la cámara. Ingresa el código QR manualmente desde Gestión QR.');
    notify('No fue posible acceder a la cámara. Usa Galería o permite el acceso');
  }
}

async function showQrScanner() {
  stopCamera();
  qrManagementScreen.hidden = true; qrDetailScreen.hidden = true; qrScanScreen.hidden = false;
  window.scrollTo(0, 0);
  qrDetectionLocked = false;
  setScannerStatus('Iniciando cámara para buscar el código QR…', 'qr-scan-status');
  try {
    qrScanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    const video = document.querySelector('#qr-scan-video');
    video.srcObject = qrScanStream;
    await video.play().catch(() => {});
    document.querySelector('.qr-scan-stage').classList.add('camera-live');
    startDetection(video, 'qr-scan-status', true);
  } catch (_) {
    setScannerStatus('No se pudo abrir la cámara. Ingresa el código único del QR para buscar al paciente.', 'qr-scan-status');
    notify('No fue posible acceder a la cámara. Ingresa el código manualmente.');
  }
}

function stopQrScanner() {
  window.clearInterval(qrDetectorTimer);
  if (qrScanStream) qrScanStream.getTracks().forEach((track) => track.stop());
  qrScanStream = undefined;
  const video = document.querySelector('#qr-scan-video');
  if (video) video.srcObject = null;
  document.querySelector('.qr-scan-stage')?.classList.remove('camera-live');
}

function findQrPatient(rawCode) {
  if (qrDetectionLocked) return false;
  const normalizedCode = String(rawCode).trim().toUpperCase();
  const patient = qrPatients.find((item) => item.id === normalizedCode);
  if (!patient) {
    qrDetectionLocked = true;
    setScannerStatus('Código QR no válido o paciente no encontrado. Intenta nuevamente.');
    setScannerStatus('Código QR no válido o paciente no encontrado. Ingresa el código o intenta nuevamente.', 'qr-scan-status');
    notify('Código QR no válido o paciente no encontrado.');
    window.setTimeout(() => { qrDetectionLocked = false; }, 1800);
    return false;
  }
  qrDetectionLocked = true;
  stopCamera();
  stopQrScanner();
  selectedQrPatient = patient;
  showPatientProfile(patient.id);
  return true;
}

function stopCamera() {
  window.clearInterval(detectorTimer);
  if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
  cameraStream = undefined;
  if (cameraVideo) cameraVideo.srcObject = null;
  document.querySelector('.camera-stage')?.classList.remove('camera-live');
}

function showPatient() {
  patientCard.hidden = false;
  patientCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setScannerStatus(message, targetId = 'scanner-status') {
  const status = document.querySelector(`#${targetId}`);
  if (status) status.textContent = message;
}

function decodeQrFromDrawable(source, sourceWidth, sourceHeight) {
  if (typeof window.jsQR !== 'function' || !sourceWidth || !sourceHeight) return '';
  const longestSide = Math.max(sourceWidth, sourceHeight);
  const scale = Math.min(1, 960 / longestSide);
  const width = Math.max(1, Math.floor(sourceWidth * scale));
  const height = Math.max(1, Math.floor(sourceHeight * scale));
  qrFallbackCanvas ||= document.createElement('canvas');
  qrFallbackCanvas.width = width;
  qrFallbackCanvas.height = height;
  const context = qrFallbackCanvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(source, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  return window.jsQR(imageData.data, width, height, { inversionAttempts: 'dontInvert' })?.data || '';
}

function decodeQrFromVideo(video) {
  return decodeQrFromDrawable(video, video.videoWidth, video.videoHeight);
}

async function decodeQrFromImage(image) {
  if (typeof window.jsQR !== 'function' || !('createImageBitmap' in window)) return '';
  const bitmap = await createImageBitmap(image);
  try {
    return decodeQrFromDrawable(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close?.();
  }
}

function startDetection(video, statusId = 'scanner-status', isQrManagement = false) {
  const hasNativeDetector = 'BarcodeDetector' in window;
  const hasFallbackDetector = typeof window.jsQR === 'function';
  if (!hasNativeDetector && !hasFallbackDetector) {
    setScannerStatus('No se pudo cargar el lector QR. Ingresa el código manualmente o verifica tu conexión.', statusId);
    return;
  }
  setScannerStatus(hasNativeDetector ? 'Cámara activa. Coloca el código QR dentro del marco.' : 'Cámara activa. Leyendo QR con modo compatible…', statusId);
  const detector = hasNativeDetector ? new BarcodeDetector({ formats: ['qr_code'] }) : null;
  const detect = async () => {
    if (!video.videoWidth || qrDetectionLocked || isQrDetecting) return;
    isQrDetecting = true;
    let rawCode = '';
    try {
      const codes = detector ? await detector.detect(video) : [];
      rawCode = codes[0]?.rawValue || '';
    } catch (_) { /* intenta el modo compatible */ }
    try {
      if (!rawCode && hasFallbackDetector) rawCode = decodeQrFromVideo(video);
      if (rawCode) findQrPatient(rawCode);
    } finally {
      isQrDetecting = false;
    }
  };
  const timer = window.setInterval(detect, 500);
  if (isQrManagement) qrDetectorTimer = timer;
  else detectorTimer = timer;
}

function notify(message) {
  toast.textContent = `${message} estará disponible próximamente.`;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2800);
}

function sentenceContaining(text, pattern) {
  return text.split(/(?<=[.!;])\s+|\n/).find((sentence) => pattern.test(sentence))?.trim() || '';
}

function extractClinicalDraft(transcript) {
  const text = transcript.trim();
  const pressure = text.match(/(?:presi[oó]n|tensi[oó]n)(?:\s+arterial)?\s*(?:de|es)?\s*(\d{2,3})\s*(?:sobre|\/|por)\s*(\d{2,3})/i);
  const temperature = text.match(/(?:temperatura|temp\.?)(?:\s+de|\s+es)?\s*(\d{2}(?:[.,]\d)?)/i);
  const heartRate = text.match(/(?:frecuencia\s+cardiaca|pulso|fc)(?:\s+de|\s+es)?\s*(\d{2,3})/i);
  const saturation = text.match(/(?:saturaci[oó]n|sato2|spo2)(?:\s+de|\s+es)?\s*(\d{2,3})\s*%?/i);
  const weight = text.match(/(?:peso)(?:\s+de|\s+es)?\s*(\d{2,3}(?:[.,]\d+)?)/i);
  const height = text.match(/(?:talla|estatura)(?:\s+de|\s+es)?\s*(\d{2,3}(?:[.,]\d+)?)/i);
  const reason = sentenceContaining(text, /motivo|consulta|acude|por dolor|por fiebre|por control/i);
  const evaluation = sentenceContaining(text, /evaluaci[oó]n|estable|dolor|consciente|alerta|estado general/i);
  const procedures = sentenceContaining(text, /procedimiento|curaci[oó]n|control de signos|tr(?:ia|i)je|canaliz|v[ií]a|vacuna/i);
  const medications = sentenceContaining(text, /medicamento|administr[oó]|paracetamol|ibuprofeno|amoxicilina|ceftriaxona|inyecci[oó]n/i);
  const medicationName = text.match(/(?:administra(?:\w*)?|medicamento)\s+(?:de\s+)?([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)?)/i);
  const medicationDose = text.match(/\b(\d+(?:[.,]\d+)?\s*(?:mg|g|ml))\b/i);
  const medicationRoute = text.match(/v[ií]a\s+(oral|ev|iv|im|intramuscular|subcut[aá]nea)/i);

  document.querySelector('#draft-bp').value = pressure ? `${pressure[1]}/${pressure[2]}` : '';
  document.querySelector('#draft-reason').value = reason;
  document.querySelector('#draft-temp').value = temperature ? temperature[1].replace(',', '.') : '';
  document.querySelector('#draft-heart-rate').value = heartRate ? heartRate[1] : '';
  document.querySelector('#draft-o2').value = saturation ? saturation[1] : '';
  document.querySelector('#draft-weight').value = weight ? weight[1].replace(',', '.') : '';
  document.querySelector('#draft-height').value = height ? height[1].replace(',', '.') : '';
  document.querySelector('#draft-evaluation').value = evaluation;
  document.querySelector('#draft-procedures').value = procedures;
  document.querySelector('#draft-medication-name').value = medicationName ? medicationName[1] : medications;
  document.querySelector('#draft-medication-dose').value = medicationDose ? medicationDose[1] : '';
  document.querySelector('#draft-medication-route').value = medicationRoute ? medicationRoute[1] : '';
  document.querySelector('#draft-observations').value = text;
  openClinicalReview();
}

function clinicalRecordFromDraft() {
  const patient = selectedQrPatient;
  const splitValues = (value) => value.split(/[\n,;]/).map((item) => item.trim()).filter(Boolean);
  const medication = {
    name: document.querySelector('#draft-medication-name').value.trim(),
    dose: document.querySelector('#draft-medication-dose').value.trim(),
    route: document.querySelector('#draft-medication-route').value.trim(),
    frequency: document.querySelector('#draft-medication-frequency').value.trim()
  };
  const registroClinico = {
    paciente: {
      id: patient.id,
      nombre: patient.name,
      dni: patient.dni,
      historiaClinica: patient.historyId || patient.id.replace('PAT-', 'PAC-'),
      identidadConfirmada: document.querySelector('#draft-identity').value.trim(),
      edad: document.querySelector('#draft-age').value.trim(),
      sexo: document.querySelector('#draft-sex').value.trim(),
      antecedentes: document.querySelector('#draft-background').value.trim(),
      enfermedadesCronicas: document.querySelector('#draft-conditions').value.trim(),
      alergias: document.querySelector('#draft-allergies').value.trim(),
      tipoSangre: patient.bloodType || ''
    },
    motivo: document.querySelector('#draft-reason').value.trim(),
    fechaHora: document.querySelector('#draft-date').value,
    tipoAtencion: document.querySelector('#draft-care-type').value.trim(),
    servicio: document.querySelector('#draft-service').value.trim(),
    signosVitales: {
      presion: document.querySelector('#draft-bp').value.trim(),
      frecuenciaCardiaca: document.querySelector('#draft-heart-rate').value.trim(),
      temperatura: document.querySelector('#draft-temp').value.trim(),
      saturacion: document.querySelector('#draft-o2').value.trim(),
      peso: document.querySelector('#draft-weight').value.trim(),
      talla: document.querySelector('#draft-height').value.trim()
    },
    diagnostico: {
      principal: document.querySelector('#draft-diagnosis-main').value.trim(),
      secundarios: splitValues(document.querySelector('#draft-diagnosis-secondary').value),
      cie10: document.querySelector('#draft-icd10').value.trim()
    },
    evaluacion: document.querySelector('#draft-evaluation').value.trim(),
    procedimientos: splitValues(document.querySelector('#draft-procedures').value),
    actividades: splitValues(document.querySelector('#draft-activities').value),
    medicamentos: medication.name || medication.dose || medication.route || medication.frequency ? [medication] : [],
    observaciones: document.querySelector('#draft-observations').value.trim()
  };
  return {
    id: `REG-${Date.now()}`,
    patientId: patient.id,
    createdAt: new Date().toISOString(),
    registroClinico
  };
}

function saveClinicalRecord() {
  clinicalRecords = [clinicalRecordFromDraft(), ...clinicalRecords];
  localStorage.setItem(clinicalRecordsKey, JSON.stringify(clinicalRecords));
}

function recordPatientId(record) {
  return record.registroClinico?.paciente?.id || record.patient?.id || record.patientId;
}

function latestClinicalRecordForFua() {
  const selectedRecord = clinicalRecords.find((record) => recordPatientId(record) === selectedQrPatient?.id);
  return selectedRecord || clinicalRecords[0];
}

function setFuaValue(id, value = '') {
  document.querySelector(id).value = value || '';
}

function toDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function populateFuaFromClinicalRecord() {
  const record = latestClinicalRecordForFua();
  const alert = document.querySelector('#fua-alert-message');
  if (!record) {
    ['#fua-dni', '#fua-history', '#fua-patient-name', '#fua-sex', '#fua-blood', '#fua-date', '#fua-care-type', '#fua-service', '#fua-reason', '#fua-procedures', '#fua-medications', '#fua-bp', '#fua-temp', '#fua-heart-rate', '#fua-o2', '#fua-diagnosis', '#fua-icd10', '#fua-activities', '#fua-evaluation', '#fua-observations'].forEach((id) => setFuaValue(id));
    document.querySelector('#fua-source').textContent = 'Sin Registro Clínico IA disponible';
    alert.textContent = 'Genera y guarda un Registro Clínico IA para completar automáticamente este borrador FUA.';
    return;
  }
  const clinical = record.registroClinico;
  const patient = clinical?.paciente || record.patient || qrPatients.find((item) => item.id === record.patientId) || {};
  const attention = clinical || record.attention || record;
  const vitalSigns = clinical?.signosVitales || attention.vitalSigns || record.vitalSigns || {};
  const medicationText = clinical ? clinical.medicamentos.map((medication) => [medication.name, medication.dose, medication.route, medication.frequency].filter(Boolean).join(' · ')).join('; ') : attention.medications;
  const procedureText = clinical ? clinical.procedimientos.join('; ') : attention.procedures;
  setFuaValue('#fua-dni', patient.dni);
  setFuaValue('#fua-history', patient.historiaClinica || patient.historyId || patient.id?.replace('PAT-', 'PAC-'));
  setFuaValue('#fua-patient-name', patient.nombre || patient.name);
  setFuaValue('#fua-sex', patient.sexo || patient.sex);
  setFuaValue('#fua-blood', patient.tipoSangre || patient.bloodType);
  setFuaValue('#fua-date', clinical?.fechaHora || toDateTimeLocal(record.createdAt));
  setFuaValue('#fua-care-type', clinical?.tipoAtencion || '');
  setFuaValue('#fua-service', clinical?.servicio || '');
  setFuaValue('#fua-reason', clinical?.motivo || attention.reason);
  setFuaValue('#fua-procedures', procedureText);
  setFuaValue('#fua-medications', medicationText);
  setFuaValue('#fua-bp', vitalSigns.presion || vitalSigns.bloodPressure);
  setFuaValue('#fua-temp', vitalSigns.temperatura || vitalSigns.temperature);
  setFuaValue('#fua-heart-rate', vitalSigns.frecuenciaCardiaca || vitalSigns.heartRate);
  setFuaValue('#fua-o2', vitalSigns.saturacion || vitalSigns.oxygenSaturation);
  setFuaValue('#fua-diagnosis', clinical?.diagnostico?.principal || '');
  setFuaValue('#fua-icd10', clinical?.diagnostico?.cie10 || '');
  setFuaValue('#fua-activities', clinical?.actividades.join('; ') || '');
  setFuaValue('#fua-evaluation', clinical?.evaluacion || attention.evaluation);
  setFuaValue('#fua-observations', clinical?.observaciones || attention.observations);
  document.querySelector('#fua-source').textContent = `Datos del Registro Clínico IA ${new Date(record.createdAt).toLocaleDateString('es-PE')}`;
  alert.textContent = 'Los campos se completaron desde el último Registro Clínico IA. Revísalos y edítalos antes de generar el borrador FUA.';
}

function saveFuaDraft() {
  const draft = {
    id: `FUA-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    patient: { dni: document.querySelector('#fua-dni').value.trim(), historyId: document.querySelector('#fua-history').value.trim(), name: document.querySelector('#fua-patient-name').value.trim(), sex: document.querySelector('#fua-sex').value.trim(), bloodType: document.querySelector('#fua-blood').value.trim() },
    attention: { date: document.querySelector('#fua-date').value, careType: document.querySelector('#fua-care-type').value.trim(), service: document.querySelector('#fua-service').value.trim(), reason: document.querySelector('#fua-reason').value.trim(), procedures: document.querySelector('#fua-procedures').value.trim(), medications: document.querySelector('#fua-medications').value.trim(), diagnosis: document.querySelector('#fua-diagnosis').value.trim(), icd10: document.querySelector('#fua-icd10').value.trim(), activities: document.querySelector('#fua-activities').value.trim(), evaluation: document.querySelector('#fua-evaluation').value.trim(), observations: document.querySelector('#fua-observations').value.trim() },
    vitalSigns: { bloodPressure: document.querySelector('#fua-bp').value.trim(), temperature: document.querySelector('#fua-temp').value.trim(), heartRate: document.querySelector('#fua-heart-rate').value.trim(), oxygenSaturation: document.querySelector('#fua-o2').value.trim() }
  };
  const drafts = JSON.parse(localStorage.getItem(fuaDraftsKey) || '[]');
  localStorage.setItem(fuaDraftsKey, JSON.stringify([draft, ...drafts]));
}

function updateVoiceUi(recording, status) {
  const button = document.querySelector('#voice-record');
  button.setAttribute('aria-pressed', String(recording));
  button.classList.toggle('recording', recording);
  button.innerHTML = recording ? '<i>●</i> Detener dictado' : '<i>●</i> Iniciar dictado';
  document.querySelector('#voice-status').textContent = status;
}

function stopVoiceRecognition() {
  if (clinicalRecognition && isClinicalRecording) clinicalRecognition.stop();
  isClinicalRecording = false;
  const status = document.querySelector('#voice-status');
  if (status) updateVoiceUi(false, 'Listo para escuchar');
}

function toggleVoiceRecording() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return notify('El dictado por voz requiere Chrome o Edge en un dispositivo con micrófono');
  if (isClinicalRecording) return clinicalRecognition.stop();

  clinicalRecognition = new Recognition();
  clinicalRecognition.lang = 'es-PE';
  clinicalRecognition.continuous = true;
  clinicalRecognition.interimResults = true;
  let finalText = document.querySelector('#voice-transcript').value.trim();
  clinicalRecognition.onstart = () => { isClinicalRecording = true; updateVoiceUi(true, 'Escuchando…'); };
  clinicalRecognition.onresult = (event) => {
    let interimText = '';
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const spoken = event.results[index][0].transcript.trim();
      if (event.results[index].isFinal) finalText = `${finalText} ${spoken}`.trim(); else interimText = spoken;
    }
    document.querySelector('#voice-transcript').value = `${finalText} ${interimText}`.trim();
  };
  clinicalRecognition.onerror = (event) => {
    if (event.error === 'not-allowed') notify('Permite el acceso al micrófono para usar el dictado');
    else if (event.error !== 'aborted') notify('No fue posible continuar el dictado por voz');
  };
  clinicalRecognition.onend = () => { isClinicalRecording = false; updateVoiceUi(false, 'Dictado finalizado'); };
  clinicalRecognition.start();
}

document.querySelector('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const dni = String(form.get('username') || '').trim();
  const password = String(form.get('password') || '');
  const submitButton = event.currentTarget.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  try {
    const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: dni, password })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const messages = {
        400: 'Ingresa tu DNI y contraseña.',
        401: 'DNI o contraseña incorrectos.',
        403: 'Esta cuenta está desactivada.'
      };
      throw new Error(messages[response.status] || 'No fue posible iniciar sesión.');
    }

    sessionStorage.setItem(authTokenKey, payload.token);
    currentUser = mapApiUser(payload.user);
    document.querySelector('#login-feedback').hidden = true;
    if (currentUser.role === 'admin') return showAdminDashboard();
    if (currentUser.role === 'patient') return showPatientDashboard();
    showDashboard();
  } catch (error) {
    showAuthError(error.message || 'No fue posible conectar con el servidor.');
  } finally {
    submitButton.disabled = false;
  }
});

const quickAccessButton = document.querySelector('.quick-access');
quickAccessButton?.addEventListener('click', () => {
  currentUser = users.find((user) => user.role === 'health') || null;
  showDashboard();
});
document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.action;
    if (action.startsWith('Escanear')) return showScanner();
    if (action.startsWith('Registro Clínico')) return showCare();
    if (action.startsWith('Generar FUA')) return showFua();
    if (action.startsWith('Gestión de códigos QR')) return showQrManagement();
    if (action.startsWith('Ver pacientes')) return showPatientProfile(qrPatients[0].id);
    notify(action);
  });
});

document.querySelector('#scanner-back').addEventListener('click', showDashboard);
document.querySelector('#scanner-home').addEventListener('click', showDashboard);
document.querySelector('#care-back').addEventListener('click', showDashboard);
document.querySelector('#care-home').addEventListener('click', showDashboard);
document.querySelector('#fua-back').addEventListener('click', showDashboard);
document.querySelector('#fua-home').addEventListener('click', showDashboard);
document.querySelector('#menu-toggle').addEventListener('click', () => document.querySelector('#main-menu').hidden = false);
document.querySelector('#menu-close').addEventListener('click', () => document.querySelector('#main-menu').hidden = true);
document.querySelector('#qr-menu').addEventListener('click', () => document.querySelector('#main-menu').hidden = false);
document.querySelector('#qr-detail-menu').addEventListener('click', () => document.querySelector('#main-menu').hidden = false);
document.querySelector('#patient-profile-menu').addEventListener('click', () => document.querySelector('#main-menu').hidden = false);
document.querySelectorAll('[data-menu]').forEach((button) => button.addEventListener('click', () => {
  document.querySelector('#main-menu').hidden = true;
  if (button.dataset.menu === 'Inicio') return showDashboard();
  if (button.dataset.menu === 'Gestión de códigos QR') return showQrManagement();
  if (button.dataset.menu === 'Pacientes') return showPatientProfile(qrPatients[0].id);
  if (button.dataset.menu === 'Asistencia de enfermería') return showCare();
  if (button.dataset.menu === 'FUA') return showFua();
  notify(button.dataset.menu);
}));
document.querySelector('#qr-back').addEventListener('click', showDashboard);
document.querySelector('#qr-home').addEventListener('click', showDashboard);
document.querySelector('#qr-detail-back').addEventListener('click', showQrManagement);
document.querySelector('#qr-scan-back').addEventListener('click', showQrManagement);
document.querySelector('#patient-profile-back').addEventListener('click', showQrManagement);
document.querySelector('#profile-home').addEventListener('click', showDashboard);
document.querySelector('#profile-view-qr').addEventListener('click', () => showQrDetail(selectedQrPatient.id));
document.querySelector('#qr-search-input').addEventListener('input', (event) => renderQrPatients(event.target.value));
document.querySelector('#generate-qr').addEventListener('click', generateQrForSelected);
document.querySelector('#qr-scan-open').addEventListener('click', showQrScanner);
document.querySelector('#manual-qr-search').addEventListener('click', () => findQrPatient(document.querySelector('#manual-qr-input').value));
document.querySelector('#manual-qr-input').addEventListener('keydown', (event) => { if (event.key === 'Enter') findQrPatient(event.target.value); });
document.querySelector('#download-qr').addEventListener('click', () => { const link = document.createElement('a'); link.href = qrImageUrl(selectedQrPatient.id, 700); link.download = `QR-${selectedQrPatient.id}.png`; link.click(); });
document.querySelector('#print-qr').addEventListener('click', () => { const printWindow = window.open('', '_blank'); printWindow.document.write(`<title>QR ${selectedQrPatient.id}</title><main style="font-family:Arial;text-align:center;padding:30px"><h1>${selectedQrPatient.name}</h1><p>DNI: ${selectedQrPatient.dni}</p><img src="${qrImageUrl(selectedQrPatient.id, 500)}" alt="Código QR"><p>${selectedQrPatient.id}</p></main>`); printWindow.document.close(); printWindow.onload = () => printWindow.print(); });
document.querySelector('#fua-preview').addEventListener('click', () => notify('Vista previa del borrador FUA actualizada'));
document.querySelector('#fua-export').addEventListener('click', () => {
  if (!document.querySelector('#fua-patient-name').value.trim()) return notify('Completa los datos del paciente antes de generar el borrador FUA');
  saveFuaDraft();
  notify('Borrador FUA generado y guardado para revisión');
});
document.querySelector('#guided-next').addEventListener('click', nextGuidedQuestion);
document.querySelector('#guided-previous').addEventListener('click', previousGuidedQuestion);
document.querySelector('#guided-review').addEventListener('click', openClinicalReview);
document.querySelector('#guided-answer').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.target.type !== 'datetime-local') { event.preventDefault(); nextGuidedQuestion(); }
});
document.querySelector('#voice-record').addEventListener('click', toggleVoiceRecording);
document.querySelector('#generate-clinical-draft').addEventListener('click', () => {
  const transcript = document.querySelector('#voice-transcript').value.trim();
  if (!transcript) return notify('Graba o escribe la atención antes de generar la ficha');
  extractClinicalDraft(transcript);
});
document.querySelector('#save-clinical-draft').addEventListener('click', () => notify('Borrador clínico guardado localmente'));
document.querySelector('#care-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (document.querySelector('#clinical-draft').hidden) return notify('Genera y revisa la ficha clínica antes de guardar');
  saveClinicalRecord();
  notify('Registro confirmado. FUA IA se completará automáticamente');
  window.setTimeout(showFua, 1200);
});
document.querySelector('#patient-logout').addEventListener('click', logout);
document.querySelector('#admin-logout').addEventListener('click', logout);
document.querySelector('#role-panel-back').addEventListener('click', () => currentUser?.role === 'patient' ? showPatientDashboard() : showAdminDashboard());
document.querySelectorAll('[data-patient-action]').forEach((button) => button.addEventListener('click', () => showPatientAction(button.dataset.patientAction)));
document.querySelectorAll('[data-admin-action]').forEach((button) => button.addEventListener('click', () => showAdminPanel(button.dataset.adminAction)));
document.querySelector('#admin-panel-content').addEventListener('click', (event) => {
  if (currentUser?.role !== 'admin') return;
  const button = event.target.closest('[data-user-action]');
  if (!button) return;
  const action = button.dataset.userAction;
  if (action === 'create') return renderUserForm();
  if (action === 'edit') return renderUserForm(button.dataset.userId);
  if (action === 'toggle') return toggleManagedUser(button.dataset.userId);
  if (action === 'delete') return deleteManagedUser(button.dataset.userId);
  if (action === 'list') return renderUserManagement();
});
document.querySelector('#admin-panel-content').addEventListener('input', (event) => {
  if (currentUser?.role !== 'admin' || event.target.id !== 'user-search-input') return;
  const query = event.target.value;
  renderUserManagement(query);
  const searchInput = document.querySelector('#user-search-input');
  searchInput.focus();
  searchInput.setSelectionRange(query.length, query.length);
});
document.querySelector('#gallery-input').addEventListener('change', async (event) => {
  const image = event.target.files[0];
  if (!image) return;
  let rawCode = '';
  try {
    if ('BarcodeDetector' in window) {
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      const codes = await detector.detect(image);
      rawCode = codes[0]?.rawValue || '';
    }
    if (!rawCode) rawCode = await decodeQrFromImage(image);
    if (rawCode) return findQrPatient(rawCode);
  } catch (_) { /* muestra el mensaje de lectura fallida */ }
  setScannerStatus('No se pudo leer el QR de la imagen. Prueba con una imagen nítida o ingresa el código manualmente.');
  notify('No se pudo leer el QR de la imagen');
});

restoreSession();
