document.addEventListener('DOMContentLoaded', async () => {

    // --- AUTHENTICACIÓN LOCAL (cliente-only) ---
    const authOverlay = document.getElementById('auth-overlay');
    const authMsg = document.getElementById('auth-message');
    const authUsername = document.getElementById('auth-username');
    const authPassword = document.getElementById('auth-password');
    const authLoginBtn = document.getElementById('auth-login');
    const authRegisterBtn = document.getElementById('auth-register');
    const authControls = document.getElementById('auth-controls');
    const btnLogout = document.getElementById('btn-logout');
    const btnAdmin = document.getElementById('btn-admin');

    const USERS_KEY = 'uptbal_users_v1';
    const CURRENT_KEY = 'uptbal_current_user';

    function showAuthOverlay(show){ if(show) authOverlay.style.display = 'flex'; else authOverlay.style.display = 'none'; }

    function getUsersLocal(){ try{ return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch(e){ return []; } }
    function saveUsersLocal(list){ localStorage.setItem(USERS_KEY, JSON.stringify(list)); }
    function getCurrentUser(){ return localStorage.getItem(CURRENT_KEY); }
    function setCurrentUser(u){ if(u) localStorage.setItem(CURRENT_KEY, u); else localStorage.removeItem(CURRENT_KEY); }

    async function generateSalt(){ const buf = crypto.getRandomValues(new Uint8Array(16)); return btoa(String.fromCharCode(...buf)); }
    async function hashPassword(password, salt){
        const enc = new TextEncoder();
        const pw = enc.encode(password);
        const saltBytes = Uint8Array.from(atob(salt), c=>c.charCodeAt(0));
        const key = await crypto.subtle.importKey('raw', pw, {name:'PBKDF2'}, false, ['deriveBits']);
        const derived = await crypto.subtle.deriveBits({name:'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256'}, key, 256);
        const hashArray = Array.from(new Uint8Array(derived));
        return btoa(String.fromCharCode(...hashArray));
    }

    async function findUser(username){ return getUsersLocal().find(u => u.username === username); }
    async function createUserLocal(username, password, isAdmin=false){
        const users = getUsersLocal(); if(users.find(u=>u.username===username)) return { ok:false, message:'Usuario ya existe' };
        const salt = await generateSalt(); const hash = await hashPassword(password, salt);
        users.push({ username, hash, salt, blocked: false, admin: isAdmin?true:false, created_at: new Date().toISOString() });
        saveUsersLocal(users); return { ok:true };
    }

    async function verifyPasswordLocal(username, password){
        const user = await findUser(username); if(!user) return false; if(user.blocked) return 'blocked';
        const h = await hashPassword(password, user.salt);
        return h === user.hash;
    }

    async function ensureMaster(){ const users = getUsersLocal(); if(!users.find(u=>u.username==='master')){ await createUserLocal('master','admin', true); }
    }

    async function login(username, password){
        try{
            const v = await verifyPasswordLocal(username, password);
            if(v === 'blocked'){ authMsg.textContent = 'Usuario bloqueado.'; return; }
            if(!v){ authMsg.textContent = 'Usuario o contraseña incorrectos.'; return; }
            setCurrentUser(username); authMsg.textContent = ''; showAuthOverlay(false); updateAuthControls();
        } catch(e){ authMsg.textContent = 'Error al procesar credenciales'; }
    }

    async function registerUser(username, password){
        try{
            const r = await createUserLocal(username, password, false);
            if(!r.ok){ authMsg.textContent = r.message || 'Error registro'; return; }
            authMsg.textContent = 'Usuario registrado. Ingresa ahora.';
        } catch(e){ authMsg.textContent = 'Error interno al registrar'; }
    }

    authLoginBtn && authLoginBtn.addEventListener('click', () => { login(authUsername.value.trim(), authPassword.value); });
    authRegisterBtn && authRegisterBtn.addEventListener('click', () => { registerUser(authUsername.value.trim(), authPassword.value); });

    btnLogout && btnLogout.addEventListener('click', async () => {
        setCurrentUser(null); showAuthOverlay(true); updateAuthControls();
    });

    // Admin modal elements (will use API)
    const adminModal = document.getElementById('admin-modal');
    const adminUserListEl = document.getElementById('admin-user-list');
    const adminCreateBtn = document.getElementById('admin-create-btn');
    const adminNewUser = document.getElementById('admin-new-username');
    const adminNewPass = document.getElementById('admin-new-password');
    const adminCloseBtn = document.getElementById('admin-close');
    const adminChangeAdminPw = document.getElementById('admin-change-admin-pw');

    function openAdminModal(){ renderAdminUsers(); adminModal.style.display = 'flex'; }
    function closeAdminModal(){ adminModal.style.display = 'none'; }
    btnAdmin && btnAdmin.addEventListener('click', () => { openAdminModal(); });
    adminCloseBtn && adminCloseBtn.addEventListener('click', closeAdminModal);

    // apiFetch replaced by local operations; network not required in client-only mode
    function apiFetch(){ return Promise.reject(new Error('No API in client-only mode')); }

    async function renderAdminUsers(){
        adminUserListEl.innerHTML = '';
        try{
            const users = getUsersLocal();
            users.forEach(u => {
                const tr = document.createElement('tr');
                if(u.blocked) tr.classList.add('blocked');
                const tdUser = document.createElement('td'); tdUser.textContent = u.username;
                const tdState = document.createElement('td'); tdState.textContent = u.blocked ? 'BLOQUEADO' : 'ACTIVO';
                const tdActions = document.createElement('td');
                const btnToggle = document.createElement('button'); btnToggle.className = 'btn-secondary'; btnToggle.textContent = u.blocked ? 'Desbloquear' : 'Bloquear';
                btnToggle.addEventListener('click', async () => {
                    const users = getUsersLocal(); const found = users.find(x=>x.username===u.username); if(found){ found.blocked = !found.blocked; saveUsersLocal(users); renderAdminUsers(); }
                });
                const btnChangePw = document.createElement('button'); btnChangePw.className = 'btn-primary'; btnChangePw.textContent = 'Cambiar contraseña';
                btnChangePw.addEventListener('click', async () => {
                    const npw = prompt('Nueva contraseña para ' + u.username + ':'); if(!npw) return; const users = getUsersLocal(); const found = users.find(x=>x.username===u.username); if(found){ found.salt = await generateSalt(); found.hash = await hashPassword(npw, found.salt); saveUsersLocal(users); alert('Contraseña actualizada.'); renderAdminUsers(); }
                });
                const btnDelete = document.createElement('button'); btnDelete.className = 'btn-danger'; btnDelete.textContent = 'Eliminar';
                btnDelete.addEventListener('click', async () => { if(!confirm('Eliminar usuario '+u.username+'?')) return; const users = getUsersLocal(); const idx = users.findIndex(x=>x.username===u.username); if(idx>=0){ users.splice(idx,1); saveUsersLocal(users); renderAdminUsers(); } });
                tdActions.appendChild(btnToggle); tdActions.appendChild(document.createTextNode(' ')); tdActions.appendChild(btnChangePw); tdActions.appendChild(document.createTextNode(' ')); tdActions.appendChild(btnDelete);
                tr.appendChild(tdUser); tr.appendChild(tdState); tr.appendChild(tdActions);
                adminUserListEl.appendChild(tr);
            });
        } catch(e){ alert('Error al conectar con servidor'); }
    }

    adminCreateBtn && adminCreateBtn.addEventListener('click', async () => {
        const u = (adminNewUser.value || '').trim();
        const p = adminNewPass.value || '';
        if(!u || !p){ alert('Usuario y contraseña requeridos.'); return; }
        try{
            const r = await createUserLocal(u, p, false);
            if(r.ok){ adminNewUser.value=''; adminNewPass.value=''; renderAdminUsers(); } else { alert(r.message || 'Error'); }
        } catch(e){ alert('Error al conectar con servidor'); }
    });

    adminChangeAdminPw && adminChangeAdminPw.addEventListener('click', async () => {
        const npw = prompt('Nueva contraseña admin:');
        if(!npw) return;
        const users = getUsersLocal(); const adm = users.find(x=>x.username==='master');
        if(!adm){ alert('No existe usuario master'); return; }
        adm.salt = await generateSalt(); adm.hash = await hashPassword(npw, adm.salt); saveUsersLocal(users); alert('Contraseña admin actualizada.');
    });

    // Ensure master exists and show overlay if not logged
    await ensureMaster();
    if(!getCurrentUser()) showAuthOverlay(true); else showAuthOverlay(false);
    function updateAuthControls(){ const cur = getCurrentUser(); if(cur){ authControls.style.display = 'flex'; btnAdmin.style.display = (cur==='master') ? 'inline-flex' : 'none'; } else { authControls.style.display = 'none'; btnAdmin.style.display = 'none'; } }
    updateAuthControls();

    // --- DOM Elements ---
    const inputs = {
        nombres: document.getElementById('nombres'),
        apellidos: document.getElementById('apellidos'),
        fechaNac: document.getElementById('fecha-nac'),
        rol: document.getElementById('rol'),
        encabezadoFront: document.getElementById('encabezado-front'),
        infoBack: document.getElementById('info-back'),
        contactoEmergencia: document.getElementById('contacto-emergencia'),
        alergico: document.getElementById('alergico'),
        cedula: document.getElementById('cedula'),
        jerarquia: document.getElementById('jerarquia')
    };

    const previews = {
        nombres: document.getElementById('preview-nombres'),
        apellidos: document.getElementById('preview-apellidos'),
        fechaNac: document.getElementById('preview-fecha'),
        rol: document.getElementById('preview-rol'),
        encabezadoFront: document.getElementById('preview-encabezado'),
        infoBack: document.getElementById('preview-info-back'),
        foto: document.getElementById('preview-foto'),
        logo: document.getElementById('preview-logo'),
        firma: document.getElementById('preview-firma'),
        cedula: document.getElementById('preview-cedula'),
        jerarquia: document.getElementById('preview-jerarquia')
    };

    // --- 1. Real-time Text Binding ---
    function updatePreviews() {
        previews.nombres.textContent = inputs.nombres.value || 'Nombres';
        previews.apellidos.textContent = inputs.apellidos.value || 'Apellidos';
        
        // Format Date
        let dateVal = inputs.fechaNac.value;
        if(dateVal){
            const [y, m, d] = dateVal.split('-');
            previews.fechaNac.textContent = `${d}/${m}/${y}`;
        } else {
            previews.fechaNac.textContent = '-';
        }

        previews.rol.textContent = inputs.rol.value || 'Estudiante';
        previews.cedula.textContent = inputs.cedula.value || '-';
        previews.jerarquia.textContent = inputs.jerarquia.value || 'N/A';
        previews.encabezadoFront.textContent = inputs.encabezadoFront.value || 'REPUBLICA BOLIVARIANA DE VENEZUELA';
        previews.infoBack.textContent = inputs.infoBack.value || 'Este carnet es personal e intransferible. Identifica al portador como miembro activo de la institución. En caso de emergencia favor contactarse al número escaneable en el código QR.';
        
        generateQR();
    }

    Object.values(inputs).forEach(input => {
        input.addEventListener('input', updatePreviews);
    });

    // --- 2. QR Code Generator ---
    let qrcode = new QRCode(document.getElementById("qrcode"), {
        text: "Sin datos",
        width: 64,
        height: 64,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.L
    });

    function generateQR() {
        const contact = inputs.contactoEmergencia.value || 'N/A';
        const allergy = inputs.alergico.value || 'N/A';
        const name = inputs.nombres.value + " " + inputs.apellidos.value;
        const qrData = `Nombre: ${name}\nEmergencia: ${contact}\nAlergias: ${allergy}`;
        
        qrcode.clear(); 
        qrcode.makeCode(qrData);
    }
    generateQR(); // Init Default

    // --- 3. Image Uploads (Logo & User Photo) ---
    function handleImageUpload(inputEl, previewEl) {
        inputEl.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    previewEl.src = e.target.result;
                    previewEl.style.display = 'block';
                }
                reader.readAsDataURL(file);
            }
        });
    }

    handleImageUpload(document.getElementById('foto-upload'), previews.foto);
    handleImageUpload(document.getElementById('logo-upload'), previews.logo);
    handleImageUpload(document.getElementById('firma-upload'), previews.firma);

    // --- 4. Camera Implementation ---
    const btnCamara = document.getElementById('btn-camara');
    const cameraModal = document.getElementById('camera-modal');
    const closeCameraBtn = document.getElementById('close-camera');
    const captureBtn = document.getElementById('capture-btn');
    const videoStream = document.getElementById('video-stream');
    let stream = null;

    btnCamara.addEventListener('click', async () => {
        cameraModal.style.display = 'flex';
        try {
            // Intentar primero la cámara trasera (environment). Si falla, usar la frontal.
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
            } catch (errEnv) {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            }
            videoStream.srcObject = stream;
        } catch (err) {
            alert("No se pudo acceder a la cámara. Asegúrate de dar los permisos correspondientes.");
            cameraModal.style.display = 'none';
        }
    });

    function closeCamera() {
        cameraModal.style.display = 'none';
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
    }

    closeCameraBtn.addEventListener('click', closeCamera);

    captureBtn.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = videoStream.videoWidth;
        canvas.height = videoStream.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoStream, 0, 0, canvas.width, canvas.height);
        
        previews.foto.src = canvas.toDataURL('image/png');
        closeCamera();
    });

    // --- 5. Signature Canvas Impl ---
    const canvasSig = document.getElementById('signature-pad');
    const ctxSig = canvasSig.getContext('2d');
    let isDrawing = false;
    let lastX = 0; let lastY = 0;

    // Set line styles
    ctxSig.strokeStyle = '#000000';
    ctxSig.lineWidth = 2;
    ctxSig.lineJoin = 'round';
    ctxSig.lineCap = 'round';

    function draw(e) {
        if (!isDrawing) return;
        e.preventDefault(); // prevent scrolling on touch
        
        // Get correct coords for mouse or touch
        const rect = canvasSig.getBoundingClientRect();
        let clientX = e.clientX || e.touches[0].clientX;
        let clientY = e.clientY || e.touches[0].clientY;
        
        const currentX = clientX - rect.left;
        const currentY = clientY - rect.top;

        ctxSig.beginPath();
        ctxSig.moveTo(lastX, lastY);
        ctxSig.lineTo(currentX, currentY);
        ctxSig.stroke();

        lastX = currentX;
        lastY = currentY;
    }

    // Mouse Events
    canvasSig.addEventListener('mousedown', (e) => {
        isDrawing = true;
        const rect = canvasSig.getBoundingClientRect();
        lastX = e.clientX - rect.left;
        lastY = e.clientY - rect.top;
    });
    canvasSig.addEventListener('mousemove', draw);
    canvasSig.addEventListener('mouseup', () => isDrawing = false);
    canvasSig.addEventListener('mouseout', () => isDrawing = false);

    // Touch Events
    canvasSig.addEventListener('touchstart', (e) => {
        if(e.target === canvasSig) e.preventDefault();
        isDrawing = true;
        const rect = canvasSig.getBoundingClientRect();
        lastX = e.touches[0].clientX - rect.left;
        lastY = e.touches[0].clientY - rect.top;
    });
    canvasSig.addEventListener('touchmove', draw);
    canvasSig.addEventListener('touchend', () => isDrawing = false);
    canvasSig.addEventListener('touchcancel', () => isDrawing = false);

    document.getElementById('clear-sig').addEventListener('click', () => {
        ctxSig.clearRect(0, 0, canvasSig.width, canvasSig.height);
        previews.firma.style.display = 'none';
        previews.firma.src = '';
    });

    document.getElementById('save-sig').addEventListener('click', () => {
        const dataURL = canvasSig.toDataURL('image/png');
        previews.firma.src = dataURL;
        previews.firma.style.display = 'block';
        alert("Firma aplicada al carnet.");
    });

    // --- 6. Tabs Logic ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.style.display = 'none');
            // Add active
            btn.classList.add('active');
            document.getElementById('tab-' + btn.dataset.tab).style.display = 'block';
        });
    });

    // --- 7. Export / Download Carnet ---
    const exportBtn = document.getElementById('export-btn');
    
    exportBtn.addEventListener('click', async () => {
        exportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
        exportBtn.disabled = true;

        try {
            // We capture Front and Back cards
            const cardFront = document.getElementById('card-front');
            const cardBack = document.getElementById('card-back');

            // Render Front
            const canvasFront = await html2canvas(cardFront, { 
                scale: 3, // High quality 
                useCORS: true,
                backgroundColor: null
            });
            
            // Render Back
            const canvasBack = await html2canvas(cardBack, { 
                scale: 3,
                useCORS: true,
                backgroundColor: null
            });

            // Create a Combined Canvas (Side by Side or Top/Bottom)
            const padding = 40;
            const combined = document.createElement('canvas');
            combined.width = (canvasFront.width * 2) + (padding * 3);
            combined.height = canvasFront.height + (padding * 2);
            const ctxComb = combined.getContext('2d');
            
            // White Background for final image
            ctxComb.fillStyle = '#FFFFFF';
            ctxComb.fillRect(0, 0, combined.width, combined.height);

            // Draw Front
            ctxComb.drawImage(canvasFront, padding, padding);
            // Draw Back
            ctxComb.drawImage(canvasBack, canvasFront.width + (padding*2), padding);

            // Generate Data URL
            const dataUrl = combined.toDataURL('image/png', 1.0);
            const fileName = `Carnet_UPTBAL_${inputs.nombres.value || 'Nuevo'}.png`;

            // Trigger Download
            if (window.Android && window.Android.saveImageToDownloads) {
                window.Android.saveImageToDownloads(dataUrl, fileName);
            } else {
                const link = document.createElement('a');
                link.download = fileName;
                link.href = dataUrl;
                link.click();
            }

        } catch (error) {
            console.error("Error generating image:", error);
            alert("Hubo un error al generar el carnet. Intente nuevamente.");
        } finally {
            exportBtn.innerHTML = '<i class="fa-solid fa-download"></i> Exportar Carnet';
            exportBtn.disabled = false;
        }
    });

});
