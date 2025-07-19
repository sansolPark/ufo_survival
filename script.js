// --- 요소 가져오기 ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI 요소
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startButton = document.getElementById('startButton');
const inGameUI = document.getElementById('inGameUI');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const highScoreEl = document.getElementById('highScore');
const healthBar = document.getElementById('healthBar');
const finalScoreEl = document.getElementById('finalScore');
const finalTimeEl = document.getElementById('finalTime');
const joystickContainer = document.getElementById('joystick-container');
const joystickBase = document.getElementById('joystick-base');
const joystickStick = document.getElementById('joystick-stick');


// --- 게임 설정 ---
let canvasWidth, canvasHeight;
let player, enemies, projectiles, items, particles;
let score, startTime, elapsedTime, level;
let animationFrameId;
let isGameOver = false;
let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
let highScore = localStorage.getItem('ufoSurvivorHighScore') || 0;

// 타이머
let projectileTimer = 0;
let enemySpawnTimer = 0;
let itemSpawnTimer = 0;

// 사운드 (참고: 실제 사운드 파일 경로를 지정해야 합니다)
// const laserSound = new Audio('sounds/laser.wav');
// const hitSound = new Audio('sounds/hit.wav');
// const gameOverSound = new Audio('sounds/gameover.wav');


// --- 클래스 정의 ---

// 플레이어 (UFO)
class Player {
    constructor() {
        this.x = canvasWidth / 2;
        this.y = canvasHeight / 2;
        this.radius = 20;
        this.speed = 4;
        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.velocity = { x: 0, y: 0 };
        this.shield = { active: false, timer: 0 };
        this.autoAttack = { active: false, timer: 0 };
    }

    draw() {
        // UFO 몸체
        ctx.fillStyle = '#00ffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();

        // 조종석
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
        
        // 방어막
        if (this.shield.active) {
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.closePath();
        }
    }
    
    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;

        // 화면 경계 처리
        if (this.x - this.radius < 0) this.x = this.radius;
        if (this.x + this.radius > canvasWidth) this.x = canvasWidth - this.radius;
        if (this.y - this.radius < 0) this.y = this.radius;
        if (this.y + this.radius > canvasHeight) this.y = canvasHeight - this.radius;

        // 아이템 효과 타이머
        if (this.shield.active) {
            this.shield.timer--;
            if (this.shield.timer <= 0) this.shield.active = false;
        }
        if (this.autoAttack.active) {
            this.autoAttack.timer--;
            if (this.autoAttack.timer <= 0) this.autoAttack.active = false;
            if (this.autoAttack.timer % 10 === 0) { // 자동 공격 속도
                shootLaser(this.x, this.y, findClosestEnemy());
            }
        }

        this.draw();
    }
    
    takeDamage(amount) {
        if (this.shield.active) return;
        this.health -= amount;
        healthBar.style.width = `${(this.health / this.maxHealth) * 100}%`;
        if (this.health <= 0) {
            gameOver();
        }
    }
}

// 레이저
class Projectile {
    constructor(x, y, velocity) {
        this.x = x;
        this.y = y;
        this.radius = 5;
        this.velocity = velocity;
        this.color = '#ff4747';
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.draw();
    }
}

// 몬스터
class Enemy {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        
        switch(type) {
            case 'red':
                this.radius = 15;
                this.speed = 1.5 + level * 0.1;
                this.color = '#ff4747';
                break;
            case 'green':
                this.radius = 20;
                this.speed = 1 + level * 0.08;
                this.color = '#39ff14';
                break;
            case 'blue':
                this.radius = 10;
                this.speed = 2 + level * 0.12;
                this.color = '#1f51ff';
                break;
        }
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.fillRect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
    }
    
    update() {
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;
        this.draw();
    }
}

// 아이템
class Item {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.radius = 10;
        this.type = type;
        this.life = 300; // 5초간 유지
    }

    draw() {
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let emoji;
        switch(this.type) {
            case 'health': emoji = '❤️'; break;
            case 'shield': emoji = '🛡️'; break;
            case 'auto-attack': emoji = '⚡'; break;
        }
        ctx.fillText(emoji, this.x, this.y);
    }

    update() {
        this.life--;
        this.draw();
    }
}

// 폭발 파티클
class Particle {
     constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.radius = Math.random() * 3 + 1;
        this.color = color;
        this.velocity = {
            x: (Math.random() - 0.5) * (Math.random() * 6),
            y: (Math.random() - 0.5) * (Math.random() * 6)
        };
        this.alpha = 1;
    }
    
    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    
    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.alpha -= 0.02;
        this.draw();
    }
}

// --- 게임 로직 함수 ---

function init() {
    isGameOver = false;
    score = 0;
    level = 1;
    startTime = Date.now();
    elapsedTime = 0;
    
    player = new Player();
    enemies = [];
    projectiles = [];
    items = [];
    particles = [];

    enemySpawnTimer = 0;
    itemSpawnTimer = 0;

    highScoreEl.textContent = `HIGH SCORE: ${highScore}`;
    scoreEl.textContent = 'SCORE: 0';
    timerEl.textContent = 'TIME: 0s';
    healthBar.style.width = '100%';

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    inGameUI.classList.remove('hidden');
    if (isMobile) joystickContainer.classList.remove('hidden');

    animate();
}

function animate() {
    if (isGameOver) return;
    animationFrameId = requestAnimationFrame(animate);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 타이머 및 레벨 관리
    elapsedTime = Math.floor((Date.now() - startTime) / 1000);
    timerEl.textContent = `TIME: ${elapsedTime}s`;
    
    // 30초마다 레벨 업
    if (elapsedTime > level * 30) {
        level++;
    }

    // 객체 업데이트
    player.update();

    particles.forEach((particle, index) => {
        if (particle.alpha <= 0) {
            particles.splice(index, 1);
        } else {
            particle.update();
        }
    });

    projectiles.forEach((p, i) => {
        p.update();
        if (p.x < 0 || p.x > canvasWidth || p.y < 0 || p.y > canvasHeight) {
            projectiles.splice(i, 1);
        }
    });

    items.forEach((item, index) => {
        item.update();
        if (item.life <= 0) {
            items.splice(index, 1);
        }
        // 아이템 획득
        const dist = Math.hypot(player.x - item.x, player.y - item.y);
        if (dist - player.radius - item.radius < 1) {
            applyItemEffect(item.type);
            items.splice(index, 1);
        }
    });

    enemies.forEach((enemy, eIndex) => {
        enemy.update();
        
        // 플레이어와 충돌
        const distPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (distPlayer - player.radius - enemy.radius < 1) {
            createExplosion(player.x, player.y, '#ffffff');
            player.takeDamage(10);
            enemies.splice(eIndex, 1);
        }

        // 레이저와 충돌
        projectiles.forEach((projectile, pIndex) => {
            const distLaser = Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y);
            if (distLaser - projectile.radius - enemy.radius < 1) {
                // hitSound.play().catch(()=>{});
                createExplosion(enemy.x, enemy.y, enemy.color);
                enemies.splice(eIndex, 1);
                projectiles.splice(pIndex, 1);
                updateScore(10);
            }
        });
    });

    // 몬스터 생성
    enemySpawnTimer++;
    const spawnInterval = Math.max(10, 60 - level * 5);
    if (enemySpawnTimer % spawnInterval === 0) {
        spawnEnemy();
    }
    
    // 아이템 생성
    itemSpawnTimer++;
    if(itemSpawnTimer % 900 === 0) { // 15초 마다
        spawnItem();
    }
}

function spawnEnemy() {
    let x, y;
    if (Math.random() < 0.5) {
        x = Math.random() < 0.5 ? 0 - 20 : canvasWidth + 20;
        y = Math.random() * canvasHeight;
    } else {
        x = Math.random() * canvasWidth;
        y = Math.random() < 0.5 ? 0 - 20 : canvasHeight + 20;
    }
    
    let type = 'red';
    if(level > 2 && Math.random() < 0.3) type = 'green';
    if(level > 4 && Math.random() < 0.2) type = 'blue';

    enemies.push(new Enemy(x, y, type));
}

function spawnItem() {
    const x = Math.random() * (canvasWidth - 100) + 50;
    const y = Math.random() * (canvasHeight - 100) + 50;
    const rand = Math.random();
    let type;
    if(rand < 0.4) type = 'health';
    else if (rand < 0.7) type = 'shield';
    else type = 'auto-attack';
    
    items.push(new Item(x, y, type));
}

function applyItemEffect(type) {
    switch(type) {
        case 'health':
            player.health = Math.min(player.maxHealth, player.health + 20);
            healthBar.style.width = `${(player.health / player.maxHealth) * 100}%`;
            break;
        case 'shield':
            player.shield.active = true;
            player.shield.timer = 300; // 5초
            break;
        case 'auto-attack':
            player.autoAttack.active = true;
            player.autoAttack.timer = 480; // 8초
            break;
    }
}

function shootLaser(x, y, target) {
    // laserSound.play().catch(()=>{});
    let angle;
    if (target) {
        angle = Math.atan2(target.y - y, target.x - x);
    } else {
        // 근처에 적이 없으면 임의의 방향으로 발사 (또는 위쪽)
        angle = -Math.PI / 2; // 위쪽
    }
    const velocity = {
        x: Math.cos(angle) * 8,
        y: Math.sin(angle) * 8
    };
    projectiles.push(new Projectile(x, y, velocity));
}

function findClosestEnemy() {
    let closestEnemy = null;
    let closestDistance = Infinity;
    enemies.forEach(enemy => {
        const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (dist < closestDistance) {
            closestDistance = dist;
            closestEnemy = enemy;
        }
    });
    return closestEnemy;
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 15; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function updateScore(amount) {
    score += amount;
    scoreEl.textContent = `SCORE: ${score}`;
}

function gameOver() {
    isGameOver = true;
    cancelAnimationFrame(animationFrameId);
    // gameOverSound.play().catch(()=>{});
    
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('ufoSurvivorHighScore', highScore);
    }

    finalScoreEl.textContent = `SCORE: ${score}`;
    finalTimeEl.textContent = `SURVIVED: ${elapsedTime}s`;
    
    gameOverScreen.classList.remove('hidden');
    inGameUI.classList.add('hidden');
    if (isMobile) joystickContainer.classList.add('hidden');
}

// --- 이벤트 리스너 ---
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
};

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = true;
        updatePlayerVelocity();
    }
    if (e.code === 'Space') {
        if (isGameOver) {
            init();
        } else if (!player.autoAttack.active) {
            shootLaser(player.x, player.y, findClosestEnemy());
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = false;
        updatePlayerVelocity();
    }
});

function updatePlayerVelocity() {
    player.velocity.y = 0;
    if (keys.ArrowUp) player.velocity.y = -player.speed;
    if (keys.ArrowDown) player.velocity.y = player.speed;
    
    player.velocity.x = 0;
    if (keys.ArrowLeft) player.velocity.x = -player.speed;
    if (keys.ArrowRight) player.velocity.x = player.speed;
}

// 모바일 컨트롤
let joystickActive = false;
let joystickStartX = 0;
let joystickStartY = 0;

if (isMobile) {
    joystickContainer.addEventListener('touchstart', (e) => {
        e.preventDefault();
        joystickActive = true;
        const touch = e.touches[0];
        joystickStartX = touch.clientX;
        joystickStartY = touch.clientY;
    }, { passive: false });

    joystickContainer.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!joystickActive) return;
        
        const touch = e.touches[0];
        const deltaX = touch.clientX - joystickStartX;
        const deltaY = touch.clientY - joystickStartY;
        const distance = Math.hypot(deltaX, deltaY);
        const angle = Math.atan2(deltaY, deltaX);

        if (distance > 0) {
            player.velocity.x = Math.cos(angle) * player.speed;
            player.velocity.y = Math.sin(angle) * player.speed;
        }

        const stickMaxDist = joystickBase.clientWidth / 2;
        const stickX = Math.min(stickMaxDist, distance) * Math.cos(angle);
        const stickY = Math.min(stickMaxDist, distance) * Math.sin(angle);
        joystickStick.style.transform = `translate(${stickX}px, ${stickY}px)`;

    }, { passive: false });

    window.addEventListener('touchend', (e) => {
        e.preventDefault();
        
        // 조이스틱 터치 종료
        const joystickTouchEnded = Array.from(e.changedTouches).some(t => {
            const rect = joystickBase.getBoundingClientRect();
            return t.clientX >= rect.left && t.clientX <= rect.right &&
                   t.clientY >= rect.top && t.clientY <= rect.bottom;
        });

        if (joystickTouchEnded || e.touches.length === 0) {
             joystickActive = false;
             player.velocity.x = 0;
             player.velocity.y = 0;
             joystickStick.style.transform = `translate(0px, 0px)`;
        }
       
        // 공격 터치
        const isJoystickTouch = e.target === joystickBase || e.target === joystickStick;
        if (!isJoystickTouch) {
            if (isGameOver) {
                init();
            } else if (!player.autoAttack.active) {
                shootLaser(player.x, player.y, findClosestEnemy());
            }
        }
    });
} else { // PC 클릭 공격
     canvas.addEventListener('click', (e) => {
        if (!isGameOver && !player.autoAttack.active) {
            // PC 에서는 스페이스바로 공격하므로 이 부분은 선택사항
        }
    });
}


// --- 초기화 및 리사이즈 ---
function resizeCanvas() {
    const container = document.getElementById('game-container');
    const aspectRatio = 4 / 3;
    const newWidth = Math.min(window.innerWidth, 800);
    const newHeight = Math.min(window.innerHeight, 600);

    if (newWidth / newHeight > aspectRatio) {
        container.style.width = `${newHeight * aspectRatio}px`;
        container.style.height = `${newHeight}px`;
    } else {
        container.style.width = `${newWidth}px`;
        container.style.height = `${newWidth / aspectRatio}px`;
    }
    
    canvas.width = 800;
    canvas.height = 600;
    canvasWidth = canvas.width;
    canvasHeight = canvas.height;
}

window.addEventListener('resize', resizeCanvas);
startButton.addEventListener('click', init);

// 초기 실행
resizeCanvas();
