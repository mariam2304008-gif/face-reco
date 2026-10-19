document.addEventListener('DOMContentLoaded', () => {
    const confidenceRange = document.getElementById('confidenceRange');
    const thresholdValue = document.getElementById('thresholdValue');
    const hudConfidence = document.getElementById('hudConfidence');
    const btnTestCamera = document.getElementById('btnTestCamera');
    const liveWebcam = document.getElementById('liveWebcam');
    const mockFeed = document.getElementById('mockFeed');
    const cameraSyncBadge = document.getElementById('cameraSyncBadge');
    const settingsForm = document.getElementById('settingsForm');
    const adminToast = document.getElementById('adminToast');
    const btnResetDefaults = document.getElementById('btnResetDefaults');

    let cameraStream = null;

    confidenceRange.addEventListener('input', (e) => {
        const val = e.target.value;
        thresholdValue.textContent = `${val}%`;
        hudConfidence.textContent = `${val}.2%`;
    });

    
    btnTestCamera.addEventListener('click', async () => {
        if (!cameraStream) {
            try {
            
                cameraStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { width: 1280, height: 720 } 
                });
                liveWebcam.srcObject = cameraStream;
                liveWebcam.style.display = 'block';
                mockFeed.style.background = 'transparent';
                btnTestCamera.innerHTML = `<span>Stop Camera</span>`;
                cameraSyncBadge.innerHTML = `<span class="tiny-dot green"></span> Live Stream Active`;
                showToast("Live camera stream initialized successfully.");
            } catch (err) {
                console.warn("Webcam access denied or unavailable; keeping simulated HUD overlay.", err);
                showToast("Camera device simulated: Hardware feed online.");
            }
        } else {
           
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
            liveWebcam.style.display = 'none';
            mockFeed.style.background = '';
            btnTestCamera.innerHTML = `<span>Test Camera</span>`;
            cameraSyncBadge.innerHTML = `<span class="tiny-dot green"></span> Signal synchronized`;
            showToast("Camera feed stopped.");
        }
    });

    
    settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const config = {
            device: document.getElementById('cameraDevice').value,
            resolution: document.getElementById('camResolution').value,
            fps: document.getElementById('camFps').value,
            confidence: confidenceRange.value,
            liveness: document.getElementById('livenessToggle').checked,
            lateMinutes: document.getElementById('lateCutoff').value,
            absentMinutes: document.getElementById('absentCutoff').value,
            operatingMode: document.querySelector('input[name="operatingMode"]:checked').value
        };

       
        localStorage.setItem('campuslens_system_config', JSON.stringify(config));
        showToast("System & recognition parameters saved successfully!");
    });

    btnResetDefaults.addEventListener('click', () => {
        document.getElementById('cameraDevice').value = 'doorway-1';
        document.getElementById('camResolution').value = '1080p';
        document.getElementById('camFps').value = '30';
        confidenceRange.value = 85;
        thresholdValue.textContent = '85%';
        hudConfidence.textContent = '85.2%';
        document.getElementById('livenessToggle').checked = true;
        document.getElementById('lateCutoff').value = 10;
        document.getElementById('absentCutoff').value = 20;
        document.querySelector('input[name="operatingMode"][value="auto"]').checked = true;

        showToast("Settings reset to factory defaults.");
    });

    
    function showToast(msg) {
        if (!adminToast) return;
        adminToast.textContent = msg;
        adminToast.classList.add('show');
        setTimeout(() => adminToast.classList.remove('show'), 3200);
    }
});