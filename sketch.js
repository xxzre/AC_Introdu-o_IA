// IA Image Upload Logic
const fileInput = document.getElementById('file-input');
const uploadBtn = document.getElementById('upload-button');
const imagePreview = document.getElementById('image-preview');
const uploadPrompt = document.getElementById('upload-prompt');
const dropZone = document.getElementById('drop-zone');

const resultLabel = document.getElementById('result-label');
const confidenceBar = document.getElementById('confidence-bar');
const confidenceText = document.getElementById('confidence-text');
const loader = document.getElementById('loader');
const errorMsg = document.getElementById('error-msg');

let classifier;
let isModelReady = false;

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

// 3. Handle File Selection
uploadBtn.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
});

// Drag and drop logic
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "#bc13fe";
});

dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = "rgba(0, 242, 255, 0.3)";
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "rgba(0, 242, 255, 0.3)";
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
});

function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        alert("Por favor, selecione um arquivo de imagem.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreview.style.display = 'block';
        uploadPrompt.style.display = 'none';

        // When image is loaded, classify it
        imagePreview.onload = () => classify();
    };
    reader.readAsDataURL(file);
}

// 4. Run the Classifier
async function classify() {
    if (!isModelReady) return;

    try {
        const results = await classifier.classify(imagePreview);
        displayResults(results);
    } catch (error) {
        console.error("Erro na predição:", error);
        errorMsg.style.display = 'block';
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

        // Highlight high confidence
        if (confidence > 80) {
            resultLabel.style.color = "#00f2ff";
        } else {
            resultLabel.style.color = "#fff";
        }
    }
}
