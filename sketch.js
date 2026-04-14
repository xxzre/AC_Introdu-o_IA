// Global Variables
let engine, world;
let debris = [];
let portal;
let score = 0;
let integrity = 100;
let gameState = 'INTRO'; // INTRO, LOADING, PLAYING

// IA Variables
let video;
let classifier;
let label = "Carregando...";
let gestureState = 'NEUTRAL';
let poses = [];
let modelURL = 'https://teachablemachine.withgoogle.com/models/H9p9-G4C0/';
let debrisModelURL = 'https://teachablemachine.withgoogle.com/models/vDY9Hja2j/';
let debrisClassifier;
let currentDebrisClass = "Buscando...";
let useMouseMode = false;

// Asset Variables
let bgImg;
let debrisImages = [];

// Matter.js Aliases
const { Engine, World, Bodies, Body, Vector, Composite } = Matter;

function preload() {
    // Add success/error callbacks to prevent the game from freezing if an image fails to load
    bgImg = loadImage('assets/Fundo_Jogo.avif',
        () => console.log('Background loaded'),
        () => console.warn('Background failed to load, using fallback color')
    );

    const assets = [
        'assets/Satelite2.0.png',
        'assets/Meteoro_PNG.png',
        'assets/Ferramenta_PNG.png',
        'assets/Pedaço de lata png.png'
    ];

    assets.forEach(path => {
        debrisImages.push(loadImage(path,
            () => console.log(`Loaded: ${path}`),
            () => console.error(`Failed to load: ${path}`)
        ));
    });
}

function setup() {
    let canvas = createCanvas(800, 600);
    canvas.parent('game-container');

    // Physics Setup
    engine = Engine.create();
    world = engine.world;
    world.gravity.y = 1;

    // Portal setup (Top of screen)
    portal = {
        x: width / 2,
        y: 40,
        radius: 60
    };

    // UI Listeners
    document.getElementById('start-btn').addEventListener('click', startSequence);
}

async function startSequence() {
    gameState = 'LOADING';
    document.getElementById('loading-msg').style.display = 'block';

    try {
        // Setup Video
        video = createCapture(VIDEO, (stream) => {
            useMouseMode = false;
        });
        video.size(320, 240);
        video.hide();

        // Load Pose Model
        classifier = await ml5.poseNet(video, modelLoaded);
    } catch (e) {
        console.warn("Webcam not detected, switching to Mouse Mode");
        useMouseMode = true;
    }

    // Load Debris Model
    try {
        debrisClassifier = await ml5.imageClassifier(debrisModelURL + 'model.json', () => {
            console.log('Debris Model Loaded Successfully');
            classifyDebris();
        });
    } catch (e) {
        console.error("Erro ao carregar modelo de detritos:", e);
    }

    gameState = 'PLAYING';
    document.getElementById('intro-overlay').style.display = 'none';
}

function modelLoaded() {
    console.log('Model Ready');
    classifier.on('pose', (results) => {
        poses = results;
    });
}

function classifyDebris() {
    if (debrisClassifier && gameState === 'PLAYING') {
        let canvasElement = document.querySelector('canvas');
        if (canvasElement) {
            debrisClassifier.classify(canvasElement, gotDebrisResult);
        } else {
            debrisClassifier.classify(get(), gotDebrisResult);
        }
    } else {
        setTimeout(classifyDebris, 1000);
    }
}

function gotDebrisResult(error, results) {
    if (error) {
        console.error(error);
        return;
    }
    if (results && results.length > 0) {
        currentDebrisClass = results[0].label;
        let mon = document.getElementById('identified-obj');
        if (mon) mon.innerText = currentDebrisClass;
    }
    setTimeout(classifyDebris, 500);
}

function draw() {
    if (bgImg) {
        image(bgImg, 0, 0, width, height);
    } else {
        background(10, 10, 18);
    }

    if (gameState === 'PLAYING') {
        Engine.update(engine);
        drawPortal();
        handleInput();

        if (frameCount % 120 === 0) {
            spawnDebris();
        }

        for (let i = debris.length - 1; i >= 0; i--) {
            let item = debris[i];
            let d = dist(item.body.position.x, item.body.position.y, portal.x, portal.y);
            if (d < portal.radius) {
                World.remove(world, item.body);
                debris.splice(i, 1);
                score += 10;
                updateUI();
                continue;
            }

            if (item.body.position.y > height + 50) {
                World.remove(world, item.body);
                debris.splice(i, 1);
                integrity -= 10; // Increased damage from 5 to 10
                updateUI();
                continue;
            }

            applyForces(item);
            drawDebris(item);
        }
    }
}

function drawPortal() {
    push();
    noFill();
    strokeWeight(4);
    let pulse = sin(frameCount * 0.1) * 10;
    stroke(0, 242, 255, 150 + pulse * 10);
    ellipse(portal.x, portal.y, portal.radius * 2 + pulse);
    stroke(188, 19, 254, 100);
    ellipse(portal.x, portal.y, portal.radius * 1.5 - pulse);
    pop();
}

function spawnDebris() {
    let x = random(100, width - 100);
    let mass = random(3, 8); // Increased mass range
    let size = Math.max(100, mass * 30); // Increased minimum size and multiplier
    let body = Bodies.rectangle(x, -50, size, size, {
        restitution: 0.5,
        frictionAir: 0.02
    });
    World.add(world, body);
    let type = floor(random(debrisImages.length));
    debris.push({ body, mass, size, type });
}

function drawDebris(item) {
    let pos = item.body.position;
    let angle = item.body.angle;
    push();
    translate(pos.x, pos.y);
    rotate(angle);
    let img = debrisImages[item.type];
    if (img) {
        if (gestureState === 'ANTIGRAVITY') {
            drawingContext.shadowBlur = 30;
            drawingContext.shadowColor = 'rgba(188, 19, 254, 1)';
            tint(200, 150, 255);
        }
        imageMode(CENTER);
        image(img, 0, 0, item.size, item.size);
        noTint();
        drawingContext.shadowBlur = 0;
    }
    pop();
}

function handleInput() {
    if (!useMouseMode && poses.length > 0) {
        let pose = poses[0].pose;
        if (pose.leftWrist.y < pose.leftShoulder.y - 50 && pose.rightWrist.y < pose.rightShoulder.y - 50) {
            gestureState = 'ANTIGRAVITY';
        } else if (pose.nose.x < 120) {
            gestureState = 'RIGHT';
        } else if (pose.nose.x > 200) {
            gestureState = 'LEFT';
        } else {
            gestureState = 'NEUTRAL';
        }
    } else {
        if ((keyIsPressed && key === ' ') || mouseIsPressed) {
            gestureState = 'ANTIGRAVITY';
        } else if (mouseX < width * 0.3 && mouseX > 0) {
            gestureState = 'LEFT';
        } else if (mouseX > width * 0.7 && mouseX < width) {
            gestureState = 'RIGHT';
        } else {
            gestureState = 'NEUTRAL';
        }
    }

    if (keyIsDown(UP_ARROW)) gestureState = 'ANTIGRAVITY';
    if (keyIsDown(LEFT_ARROW)) gestureState = 'LEFT';
    if (keyIsDown(RIGHT_ARROW)) gestureState = 'RIGHT';

    let indicator = document.getElementById('gesture-indicator');
    if (indicator) {
        let msg = `Estado: ${gestureState === 'NEUTRAL' ? 'Neutro' : (gestureState === 'ANTIGRAVITY' ? 'Antigravidade' : 'Empuxo Lateral')}`;
        if (useMouseMode) msg += " (Modo Mouse)";
        msg += ` | IA Identificou: ${currentDebrisClass}`;
        indicator.className = 'glass-panel state-' + gestureState.toLowerCase();
        indicator.innerText = msg;
    }
}

function applyForces(item) {
    if (gestureState === 'ANTIGRAVITY') {
        Body.applyForce(item.body, item.body.position, { x: 0, y: -0.005 * item.mass });
    } else if (gestureState === 'LEFT') {
        Body.applyForce(item.body, item.body.position, { x: -0.002 * item.mass, y: -0.002 * item.mass });
    } else if (gestureState === 'RIGHT') {
        Body.applyForce(item.body, item.body.position, { x: 0.002 * item.mass, y: -0.002 * item.mass });
    }
}

function updateUI() {
    document.getElementById('score').innerText = score;
    document.getElementById('integrity').innerText = integrity + '%';
    if (integrity <= 0 && gameState === 'PLAYING') {
        alert("Setor Crítico! A estação foi sobrecarregada por detritos.");
        location.reload();
    }
}
