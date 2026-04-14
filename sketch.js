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
let poses = []; // Keeping for potential dual modes
let modelURL = 'https://teachablemachine.withgoogle.com/models/H9p9-G4C0/';
let debrisModelURL = 'https://teachablemachine.withgoogle.com/models/vDY9Hja2j/'; // Updated model URL
let debrisClassifier;
let currentDebrisClass = "Buscando...";
let useMouseMode = false;

// Asset Variables
let bgImg;
let debrisImages = [];

// Matter.js Aliases
const { Engine, World, Bodies, Body, Vector, Composite } = Matter;

function preload() {
    bgImg = loadImage('assets/Fundo_Jogo.avif');
    debrisImages.push(loadImage('assets/Satelite2.0.png'));
    debrisImages.push(loadImage('assets/Meteoro_PNG.png'));
    debrisImages.push(loadImage('assets/Ferramenta_PNG.png'));
    debrisImages.push(loadImage('assets/Pedaço de lata png.png'));
}

function setup() {
    let canvas = createCanvas(800, 600);
    canvas.parent('game-container');

    // Physics Setup
    engine = Engine.create();
    world = engine.world;
    world.gravity.y = 1; // Normal earth-like gravity initially

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

        // Load Pose Model (Only if webcam works)
        classifier = await ml5.poseNet(video, modelLoaded);
    } catch (e) {
        console.warn("Webcam not detected, switching to Mouse Mode");
        useMouseMode = true;
    }

    // Load Debris Model (Always, because it reads the canvas)
    try {
        debrisClassifier = await ml5.imageClassifier(debrisModelURL + 'model.json', modelLoadedDebris);
    } catch (e) {
        console.error("Erro ao carregar modelo de detritos:", e);
    }

    gameState = 'PLAYING';
    document.getElementById('intro-overlay').style.display = 'none';
    classifyDebris(); // Start recognition loop
}

function modelLoaded() {
    console.log('Model Ready');
    classifier.on('pose', (results) => {
        poses = results;
    });
}

function modelLoadedDebris() {
    console.log('Debris Model Ready');
}

function classifyDebris() {
    if (debrisClassifier) {
        // Use get() to capture the current frame of the p5 canvas
        // This allows the IA to "see" the same screen as the player
        debrisClassifier.classify(get(), gotDebrisResult);
    }
}

function gotDebrisResult(error, results) {
    if (error) {
        console.error(error);
        return;
    }
    // Update the identified class
    if (results && results.length > 0) {
        currentDebrisClass = results[0].label;
        let mon = document.getElementById('identified-obj');
        if (mon) mon.innerText = currentDebrisClass;
    }
    // Loop
    setTimeout(classifyDebris, 500);
}

function draw() {
    // Draw Background
    if (bgImg) {
        image(bgImg, 0, 0, width, height);
    } else {
        background(10, 10, 18);
    }

    if (gameState === 'PLAYING') {
        Engine.update(engine);

        // Draw Portal
        drawPortal();

        // Handle Input (Simulation for now, will integrate Pose data)
        handleInput();

        // Add Debris randomly
        if (frameCount % 120 === 0) {
            spawnDebris();
        }

        // Update and Draw Debris
        for (let i = debris.length - 1; i >= 0; i--) {
            let item = debris[i];

            // Check if collected
            let d = dist(item.body.position.x, item.body.position.y, portal.x, portal.y);
            if (d < portal.radius) {
                World.remove(world, item.body);
                debris.splice(i, 1);
                score += 10;
                updateUI();
                continue;
            }

            // Check if fallen (Accumulation/Integrity)
            if (item.body.position.y > height + 50) {
                World.remove(world, item.body);
                debris.splice(i, 1);
                integrity -= 5;
                updateUI();
                continue;
            }

            // Apply forces based on gesture
            applyForces(item);

            // Draw
            drawDebris(item);
        }

        // Draw IA Preview in the panel
        drawIAPreview();
    }
}

function drawPortal() {
    push();
    noFill();
    strokeWeight(4);
    let pulse = sin(frameCount * 0.1) * 10;
    stroke(0, 242, 255, 150 + pulse * 10);
    ellipse(portal.x, portal.y, portal.radius * 2 + pulse);

    // Suction effect
    stroke(188, 19, 254, 100);
    ellipse(portal.x, portal.y, portal.radius * 1.5 - pulse);
    pop();
}

function spawnDebris() {
    let x = random(100, width - 100);
    let mass = random(2, 6);
    let size = Math.max(80, mass * 25); // Minimum size of 80 pixels for better visibility
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

    // Visual style: Image-based Debris
    let img = debrisImages[item.type];
    if (img) {
        // Antigravity Glow Effect
        if (gestureState === 'ANTIGRAVITY') {
            drawingContext.shadowBlur = 20;
            drawingContext.shadowColor = 'rgba(188, 19, 254, 0.9)';
            tint(255, 200, 255); // Slight purple tint
        }

        imageMode(CENTER);
        image(img, 0, 0, item.size, item.size);

        noTint();
        drawingContext.shadowBlur = 0;
    } else {
        // Fallback drawing if image fails
        fill(40, 40, 60);
        rectMode(CENTER);
        rect(0, 0, item.size, item.size);
    }

    pop();
}

function handleInput() {
    // 1. IA Pose Analysis (Priority if active)
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
    }
    // 2. Mouse/Keyboard Simulation Mode (When no webcam or as override)
    else {
        // Space or Click for Antigravity
        if ((keyIsPressed && key === ' ') || mouseIsPressed) {
            gestureState = 'ANTIGRAVITY';
        }
        // Mouse X position for Lateral thrust
        else if (mouseX < width * 0.3 && mouseX > 0) {
            gestureState = 'LEFT';
        }
        else if (mouseX > width * 0.7 && mouseX < width) {
            gestureState = 'RIGHT';
        }
        else {
            gestureState = 'NEUTRAL';
        }
    }

    // Manual overrides (always available)
    if (keyIsDown(UP_ARROW)) gestureState = 'ANTIGRAVITY';
    if (keyIsDown(LEFT_ARROW)) gestureState = 'LEFT';
    if (keyIsDown(RIGHT_ARROW)) gestureState = 'RIGHT';

    // Update UI indicator
    let indicator = document.getElementById('gesture-indicator');
    if (indicator) {
        let msg = `Estado: ${gestureState === 'NEUTRAL' ? 'Neutro' : (gestureState === 'ANTIGRAVITY' ? 'Antigravidade' : 'Empuxo Lateral')}`;
        if (useMouseMode) msg += " (Modo Mouse)";

        // ADDED: Display the identified debris class from the classification model
        msg += ` | IA Identificou: ${currentDebrisClass}`;

        indicator.className = 'glass-panel state-' + gestureState.toLowerCase();
        indicator.innerText = msg;
    }
}

function applyForces(item) {
    if (gestureState === 'ANTIGRAVITY') {
        // Reverse gravity force
        Body.applyForce(item.body, item.body.position, { x: 0, y: -0.005 * item.mass });
    } else if (gestureState === 'LEFT') {
        Body.applyForce(item.body, item.body.position, { x: -0.002 * item.mass, y: -0.002 * item.mass });
    } else if (gestureState === 'RIGHT') {
        Body.applyForce(item.body, item.body.position, { x: 0.002 * item.mass, y: -0.002 * item.mass });
    }
}

function drawIAPreview() {
    if (video) {
        // Draw video feed scaled down in the panel
        push();
        let previewX = 20;
        let previewY = height - 170;

        // Draw a simple representation of the detected pose
        if (poses.length > 0) {
            let pose = poses[0].pose;
            fill(0, 242, 255);
            noStroke();
            // Draw points
            for (let i = 0; i < pose.keypoints.length; i++) {
                let kp = pose.keypoints[i];
                if (kp.score > 0.5) {
                    ellipse(map(kp.position.x, 0, 320, 20, 220), map(kp.position.y, 0, 240, height - 150, height - 20), 5);
                }
            }
        }
        pop();
    }
}

function updateUI() {
    document.getElementById('score').innerText = score;
    document.getElementById('integrity').innerText = integrity + '%';

    if (integrity <= 0) {
        alert("Setor Crítico! A estação foi sobrecarregada por detritos.");
        location.reload();
    }
}
