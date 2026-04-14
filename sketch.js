// IA Classification Logic
const videoElement = document.getElementById('video-element');
const startBtn = document.getElementById('start-button');
const resultLabel = document.getElementById('result-label');
const confidenceBar = document.getElementById('confidence-bar');
const confidenceText = document.getElementById('confidence-text');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const loader = document.getElementById('loader');
const errorMsg = document.getElementById('error-msg');

let classifier;
let isModelReady = false;
let isPredicting = false;

// The Teachable Machine Image Model URL
const modelURL = 'https://teachablemachine.withgoogle.com/models/vDY9Hja2j/';

// 1. Initialize logic
window.onload = () => {
    loadModel();
};

// 2. Load the Teachable Machine Model
async function loadModel() {
    try {
        console.log("Carregando modelo...");
        classifier = await ml5.imageClassifier(modelURL + 'model.json');
        isModelReady = true;
        loader.style.display = 'none';
        console.log("Modelo carregado com sucesso!");
    } catch (error) {
        console.error("Erro ao carregar o modelo:", error);
        loader.querySelector('p').innerText = "Erro ao carregar arquivos da IA.";
        loader.querySelector('.loader').style.borderTopColor = "#ff4444";
    }
}

// 3. Setup Webcam and Control Button
startBtn.addEventListener('click', async () => {
    if (!isPredicting) {
        startWebcam();
    } else {
        stopWebcam();
    }
});

async function startWebcam() {
    try {
        // Standard Browser Webcam API
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoElement.srcObject = stream;

        isPredicting = true;
        startBtn.innerText = "Interromper Identificação";
        startBtn.style.background = "#ff4444";
        statusDot.classList.add('active');
        statusText.innerText = "Status: Online";
        errorMsg.style.display = 'none';

        classify(); // Start identification loop
    } catch (err) {
        console.error("Erro ao acessar webcam:", err);
        errorMsg.innerText = "Erro: Webcam não encontrada ou acesso negado.";
        errorMsg.style.display = 'block';
    }
}

function stopWebcam() {
    let stream = videoElement.srcObject;
    if (stream) {
        let tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
    }
    videoElement.srcObject = null;
    isPredicting = false;
    startBtn.innerText = "Iniciar Identificação";
    startBtn.style.background = "linear-gradient(45deg, #00f2ff, #bc13fe)";
    statusDot.classList.remove('active');
    statusText.innerText = "Status: Off";
    resultLabel.innerText = "Aguardando...";
    confidenceBar.style.width = "0%";
    confidenceText.innerText = "Confiança: 0%";
}

// 4. Run the Classifier
async function classify() {
    if (!isPredicting || !isModelReady) return;

    try {
        const results = await classifier.classify(videoElement);
        displayResults(results);

        // Loop after a short delay
        if (isPredicting) {
            requestAnimationFrame(classify);
        }
    } catch (error) {
        console.error("Erro na predição:", error);
    }
}

// 5. Update the UI
function displayResults(results) {
    if (results && results.length > 0) {
        const topResult = results[0];
        const label = topResult.label;
        const confidence = (topResult.confidence * 100).toFixed(1);

        resultLabel.innerText = label;
        confidenceText.innerText = `Confiança: ${confidence}%`;
        confidenceBar.style.width = `${confidence}%`;

        // Pulse effect on high confidence
        if (confidence > 80) {
            resultLabel.style.color = "#00f2ff";
        } else {
            resultLabel.style.color = "#fff";
        }
    }
}
