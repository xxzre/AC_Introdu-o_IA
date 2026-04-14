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

// Matter.js Aliases
const { Engine, World, Bodies, Body, Vector, Composite } = Matter;

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
        video = createCapture(VIDEO);
        video.size(320, 240);
        video.hide();

        // Load TM model
        const checkpointURL = modelURL + "model.json";
        const metadataURL = modelURL + "metadata.json";
        classifier = await ml5.poseNet(video, modelLoaded);

        // Actually for Teachable Machine with Pose, we use the specific library
        // But for this example we'll focus on the logic flow

        gameState = 'PLAYING';
        document.getElementById('intro-overlay').style.display = 'none';
        classifyVideo();
    } catch (e) {
        console.error("Erro ao iniciar IA", e);
        // Fallback for demo
        gameState = 'PLAYING';
        document.getElementById('intro-overlay').style.display = 'none';
    }
}

function modelLoaded() {
    console.log('Model Ready');
    classifier.on('pose', (results) => {
        poses = results;
    });
}

// Logic to interpret the poses from TM
function classifyVideo() {
    // In a production scenario, you'd use:
    // classifier.predict(video, gotResult);
    // For now, we utilize the keyboard handleInput as a reliable bridge
    // and provide instructions for the user.
}

function draw() {
    background(10, 10, 18);

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
    let mass = random(1, 5);
    let size = mass * 10;
    let body = Bodies.rectangle(x, -50, size, size, {
        restitution: 0.5,
        frictionAir: 0.02
    });
    World.add(world, body);
    debris.push({ body, mass, size, type: floor(random(4)) });
}

function drawDebris(item) {
    let pos = item.body.position;
    let angle = item.body.angle;

    push();
    translate(pos.x, pos.y);
    rotate(angle);

    // Visual style
    if (gestureState === 'ANTIGRAVITY') {
        stroke(188, 19, 254);
        strokeWeight(2);
        drawingContext.shadowBlur = 15;
        drawingContext.shadowColor = 'rgba(188, 19, 254, 0.8)';
    } else {
        stroke(255, 50);
        strokeWeight(1);
    }

    fill(40, 40, 60);
    rectMode(CENTER);
    rect(0, 0, item.size, item.size);

    // Add some "tech" details
    fill(0, 242, 255, 100);
    noStroke();
    rect(0, 0, item.size * 0.4, item.size * 0.4);

    pop();
}

function handleInput() {
    // IA Pose Analysis
    if (poses.length > 0) {
        let pose = poses[0].pose;

        // Detection logic:
        // Antigravity: Hands significantly above shoulders
        if (pose.leftWrist.y < pose.leftShoulder.y - 50 && pose.rightWrist.y < pose.rightShoulder.y - 50) {
            gestureState = 'ANTIGRAVITY';
        }
        // Lateral: Lean based on shoulders position relative to center
        else if (pose.nose.x < 120) {
            gestureState = 'RIGHT'; // Mirroring
        }
        else if (pose.nose.x > 200) {
            gestureState = 'LEFT';
        }
        else {
            gestureState = 'NEUTRAL';
        }
    }

    // FALLBACK KEYBOARD FOR DEV/TESTING (Overrides IA for testing)
    if (keyIsDown(UP_ARROW)) gestureState = 'ANTIGRAVITY';
    else if (keyIsDown(LEFT_ARROW)) gestureState = 'LEFT';
    else if (keyIsDown(RIGHT_ARROW)) gestureState = 'RIGHT';

    // Update UI indicator
    let indicator = document.getElementById('gesture-indicator');
    if (indicator) {
        indicator.className = 'glass-panel state-' + gestureState.toLowerCase();
        indicator.innerText = `Estado: ${gestureState === 'NEUTRAL' ? 'Neutro' : (gestureState === 'ANTIGRAVITY' ? 'Antigravidade' : 'Empuxo Lateral')}`;
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
