document.addEventListener('DOMContentLoaded', async () => {

    const authOverlay = document.getElementById('auth-overlay');
    const authMsg = document.getElementById('auth-message');
    const authUsername = document.getElementById('auth-username');
    const authPassword = document.getElementById('auth-password');
    const authLoginBtn = document.getElementById('auth-login');
    const authControls = document.getElementById('auth-controls');
    const btnLogout = document.getElementById('btn-logout');
    const btnAdmin = document.getElementById('btn-admin');

    const config = window.UPTBAL_SUPABASE_CONFIG;
    const hasSupabaseConfig = config
        && typeof config.url === 'string'
        && typeof config.anonKey === 'string'
        && config.url.startsWith('https://')
        && config.anonKey.length > 20
        && !config.anonKey.startsWith('REPLACE_')
        && window.supabase?.createClient;
    const supabase = hasSupabaseConfig
        ? window.supabase.createClient(config.url, config.anonKey)
        : null;
    let currentSession = null;

    function showAuthOverlay(show) {
        authOverlay.style.display = show ? 'flex' : 'none';
    }

    function updateAuthControls() {
        const isSignedIn = Boolean(currentSession);
        const isAdmin = currentSession?.user?.app_metadata?.role === 'admin';
        authControls.style.display = isSignedIn ? 'flex' : 'none';
        btnAdmin.style.display = isAdmin ? 'inline-flex' : 'none';
    }

    function setAuthState(session) {
        currentSession = session;
        showAuthOverlay(!session);
        updateAuthControls();
    }

    function getErrorMessage(error) {
        return error?.message || 'Ocurrió un error inesperado.';
    }

    async function signIn() {
        if (!supabase) {
            authMsg.textContent = 'Falta configurar la clave pública de Supabase en supabase-config.js.';
            return;
        }
        authLoginBtn.disabled = true;
        authMsg.textContent = '';
        const { error } = await supabase.auth.signInWithPassword({
            email: authUsername.value.trim(),
            password: authPassword.value
        });
        authLoginBtn.disabled = false;
        if (error) {
            authMsg.textContent = getErrorMessage(error);
            return;
        }
        authPassword.value = '';
    }

    authLoginBtn.addEventListener('click', signIn);
    authPassword.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') signIn();
    });

    btnLogout.addEventListener('click', async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            alert(`No se pudo cerrar la sesión: ${getErrorMessage(error)}`);
        }
    });

    const adminModal = document.getElementById('admin-modal');
    const adminUserListEl = document.getElementById('admin-user-list');
    const adminCreateBtn = document.getElementById('admin-create-btn');
    const adminNewUser = document.getElementById('admin-new-username');
    const adminNewPass = document.getElementById('admin-new-password');
    const adminCloseBtn = document.getElementById('admin-close');
    const adminChangeAdminPw = document.getElementById('admin-change-admin-pw');

    async function callAdminFunction(payload) {
        if (!supabase || !currentSession) {
            throw new Error('Inicia sesión para usar la administración.');
        }
        const { data, error } = await supabase.functions.invoke('admin-users', { body: payload });
        if (error) {
            throw new Error(error.message || 'No se pudo conectar con la función administrativa.');
        }
        if (data?.error) {
            throw new Error(data.error);
        }
        return data;
    }

    async function renderAdminUsers() {
        adminUserListEl.replaceChildren();
        const loadingRow = adminUserListEl.insertRow();
        const loadingCell = loadingRow.insertCell();
        loadingCell.colSpan = 3;
        loadingCell.textContent = 'Cargando cuentas…';

        try {
            const { users } = await callAdminFunction({ action: 'list' });
            adminUserListEl.replaceChildren();
            users.forEach((user) => {
                const row = adminUserListEl.insertRow();
                if (user.blocked) row.classList.add('blocked');
                row.insertCell().textContent = user.email || '(sin correo)';
                row.insertCell().textContent = user.role === 'admin'
                    ? 'ADMINISTRADOR'
                    : user.blocked ? 'BLOQUEADO' : 'ACTIVO';

                const actions = row.insertCell();
                const addButton = (label, className, handler, disabled = false) => {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = className;
                    button.textContent = label;
                    button.disabled = disabled;
                    button.addEventListener('click', handler);
                    actions.append(button, document.createTextNode(' '));
                };
                const runAction = async (action, confirmation) => {
                    if (confirmation && !confirm(confirmation)) return;
                    try {
                        await action();
                        await renderAdminUsers();
                    } catch (error) {
                        alert(`Error administrativo: ${getErrorMessage(error)}`);
                    }
                };

                addButton(
                    user.blocked ? 'Desbloquear' : 'Bloquear',
                    'btn-secondary',
                    () => runAction(
                        () => callAdminFunction({ action: 'set-blocked', userId: user.id, blocked: !user.blocked }),
                        `${user.blocked ? '¿Desbloquear' : '¿Bloquear'} a ${user.email}?`
                    ),
                    user.role === 'admin'
                );
                addButton('Cambiar contraseña', 'btn-primary', () => runAction(async () => {
                    const password = prompt(`Nueva contraseña para ${user.email} (mínimo 10 caracteres):`);
                    if (password === null) return;
                    await callAdminFunction({ action: 'update-password', userId: user.id, password });
                    alert('Contraseña actualizada en Supabase.');
                }));
                addButton(
                    'Eliminar',
                    'btn-danger',
                    () => runAction(
                        () => callAdminFunction({ action: 'delete', userId: user.id }),
                        `¿Eliminar permanentemente la cuenta ${user.email}?`
                    ),
                    user.role === 'admin'
                );
            });
            if (!users.length) {
                const row = adminUserListEl.insertRow();
                const cell = row.insertCell();
                cell.colSpan = 3;
                cell.textContent = 'No hay cuentas registradas.';
            }
        } catch (error) {
            adminUserListEl.replaceChildren();
            const row = adminUserListEl.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 3;
            cell.textContent = `No se pudieron cargar las cuentas: ${getErrorMessage(error)}`;
        }
    }

    function openAdminModal() {
        adminModal.style.display = 'flex';
        renderAdminUsers();
    }

    btnAdmin.addEventListener('click', openAdminModal);
    adminCloseBtn.addEventListener('click', () => { adminModal.style.display = 'none'; });

    adminCreateBtn.addEventListener('click', async () => {
        const email = adminNewUser.value.trim();
        const password = adminNewPass.value;
        if (!email || !password) {
            alert('Ingresa el correo y la contraseña inicial.');
            return;
        }
        adminCreateBtn.disabled = true;
        try {
            await callAdminFunction({ action: 'create', email, password });
            adminNewUser.value = '';
            adminNewPass.value = '';
            await renderAdminUsers();
        } catch (error) {
            alert(`No se pudo crear la cuenta: ${getErrorMessage(error)}`);
        } finally {
            adminCreateBtn.disabled = false;
        }
    });

    adminChangeAdminPw.addEventListener('click', async () => {
        const password = prompt('Nueva contraseña (mínimo 10 caracteres):');
        if (password === null) return;
        if (password.length < 10) {
            alert('La contraseña debe tener al menos 10 caracteres.');
            return;
        }
        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            alert('Tu contraseña se actualizó en Supabase.');
        } catch (error) {
            alert(`No se pudo cambiar la contraseña: ${getErrorMessage(error)}`);
        }
    });

    if (!supabase) {
        authMsg.textContent = 'Falta configurar la clave pública de Supabase en supabase-config.js.';
        authLoginBtn.disabled = true;
        setAuthState(null);
    } else {
        supabase.auth.onAuthStateChange((_event, session) => setAuthState(session));
        const { data, error } = await supabase.auth.getSession();
        if (error) {
            authMsg.textContent = `No se pudo comprobar la sesión: ${getErrorMessage(error)}`;
            setAuthState(null);
        } else {
            setAuthState(data.session);
        }
    }

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
