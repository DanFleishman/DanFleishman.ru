const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const gameContainer = document.getElementById('gameContainer');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const pauseScreen = document.getElementById('pauseScreen');
const pauseButton = document.getElementById('pauseButton');

const GAME_CONFIG = {
    INITIAL_SPEED: 250,    // Увеличиваем начальную задержку (было 200)
    MIN_SPEED: 120,        // Увеличиваем минимальную задержку (было 100)
    SPEED_DECREASE: 1,     // Уменьшаем шаг ускорения (было 2)
    SPEED_RANGE: {
        MIN: 350,  // Теперь это самая МЕДЛЕННАЯ скорость
        MAX: 150   // Теперь это самая БЫСТРАЯ скорость
    },
    INITIAL_LENGTH: 3,
    SWIPE_THRESHOLD: 30,
    GRID_SIZE: 15,
    COUNTDOWN_TIME: 2,
    HARD_WALLS: false,  // Значение по умолчанию
    GRID_SCALE: {
        MIN: 40,    // Теперь это самый МАЛЕНЬКИЙ размер
        MAX: 12,    // Теперь это самый БОЛЬШОЙ размер
        DEFAULT: {
            MOBILE: 20,
            DESKTOP: 30
        }
    }
};

let tileCountX, tileCountY;
let gridSize;
let score = 0;
let gameSpeed = GAME_CONFIG.INITIAL_SPEED;
let gameLoop;
let snake = [{x: 10, y: 10}];
let food = {x: 0, y: 0};
let dx = 0;
let dy = 0;
let touchStartX = null;
let touchStartY = null;
let isPaused = false;
let hardWalls = localStorage.getItem('hardWalls') === 'true' || GAME_CONFIG.HARD_WALLS;

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// Объект тем
const themes = {
    dark: {
        background: '#1a1a1a',
        gameBackground: '#242424',  // Темный фон для темной темы
        gridColor: 'rgba(255, 255, 255, 0.03)',
        textColor: '#ffffff',
        menuTextColor: '#ffffff',
        snakeHead: '#66BB6A',
        snakeBody: '#4CAF50',
        food: '#FF5252',
        menuBackground: 'rgba(40, 40, 40, 0.95)',
        overlayBackground: 'rgba(0, 0, 0, 0.7)',
        buttonBackground: 'rgba(255, 255, 255, 0.1)',
        scoreBackground: 'rgba(255, 255, 255, 0.1)',
        toggleBackground: '#555',
        iconColor: '#ffffff'
    },
    light: {
        background: '#f5f5f5',
        gameBackground: '#f0f0f0',  // Светло-серый фон для светлой темы
        gridColor: 'rgba(0, 0, 0, 0.03)',
        textColor: '#000000',
        menuTextColor: '#000000',
        snakeHead: '#388E3C',
        snakeBody: '#4CAF50',
        food: '#D32F2F',
        menuBackground: 'rgba(255, 255, 255, 0.95)',
        overlayBackground: 'rgba(255, 255, 255, 0.7)',
        buttonBackground: 'rgba(0, 0, 0, 0.1)',
        scoreBackground: 'rgba(0, 0, 0, 0.1)',
        toggleBackground: '#cccccc',
        iconColor: '#000000'
    }
};

// Инициализация темы
const savedTheme = localStorage.getItem('theme');
let currentTheme = savedTheme || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

// Слушатель изменения системной темы
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
    currentTheme = e.matches ? 'light' : 'dark';
    applyTheme(currentTheme);
});

// Основные функции игры
function changeDirection(direction) {
    if (isPaused) return;
    
    switch(direction) {
        case 'up':
            if (dy !== 1) { dx = 0; dy = -1; }
            break;
        case 'down':
            if (dy !== -1) { dx = 0; dy = 1; }
            break;
        case 'left':
            if (dx !== 1) { dx = -1; dy = 0; }
            break;
        case 'right':
            if (dx !== -1) { dx = 1; dy = 0; }
            break;
    }
}

function resizeCanvas() {
    const maxHeight = window.innerHeight;
    const maxWidth = window.innerWidth;
    
    canvas.width = maxWidth;
    canvas.height = maxHeight;
    
    // Получаем сохраненный масштаб или используем значение по умолчанию
    const savedScale = Number(localStorage.getItem('gridScale')) || 
        (isMobile ? GAME_CONFIG.GRID_SCALE.DEFAULT.MOBILE : GAME_CONFIG.GRID_SCALE.DEFAULT.DESKTOP);
    
    gridSize = Math.min(maxWidth / savedScale, maxHeight / savedScale);
    
    tileCountX = Math.floor(maxWidth / gridSize);
    tileCountY = Math.floor(maxHeight / gridSize);
    
    if (snake) {
        drawGame();
    }
}

function drawGame() {
    if (isPaused) return;

    // Используем CSS переменные вместо colors из themes
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--game-background');
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Добавляем сетку
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid-color');
    ctx.lineWidth = 1;
    for(let i = 0; i <= tileCountX; i++) {
        ctx.beginPath();
        ctx.moveTo(i * gridSize, 0);
        ctx.lineTo(i * gridSize, canvas.height);
        ctx.stroke();
    }
    for(let i = 0; i <= tileCountY; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * gridSize);
        ctx.lineTo(canvas.width, i * gridSize);
        ctx.stroke();
    }
    
    const head = {
        x: snake[0].x + dx,
        y: snake[0].y + dy
    };
    
    // Проверка столкновения со стенами
    if (hardWalls) {
        if (head.x < 0 || head.x >= tileCountX || head.y < 0 || head.y >= tileCountY) {
            gameOver();
            return;
        }
    } else {
        if (head.x < 0) head.x = tileCountX - 1;
        if (head.x >= tileCountX) head.x = 0;
        if (head.y < 0) head.y = tileCountY - 1;
        if (head.y >= tileCountY) head.y = 0;
    }
    
    if (dx !== 0 || dy !== 0) {
        for (let i = 1; i < snake.length; i++) {
            if (head.x === snake[i].x && head.y === snake[i].y) {
                gameOver();
                return;
            }
        }
    }
    
    snake.unshift(head);
    
    if (head.x === food.x && head.y === food.y) {
        score += 10;
        
        // Плавное увеличение скорости
        if (gameSpeed > GAME_CONFIG.MIN_SPEED) {
            const newSpeed = Math.max(
                GAME_CONFIG.MIN_SPEED, 
                gameSpeed - GAME_CONFIG.SPEED_DECREASE
            );
            
            // Обновляем скорость только если она изменилась
            if (newSpeed !== gameSpeed) {
                gameSpeed = newSpeed;
                restartGameLoop();
            }
        }
        
        // Обновляем отображение скорости
        updateSpeedDisplay();
        
        // Генерируем новую еду
        generateNewFood();
    } else {
        snake.pop();
    }
    
    // Отрисовка змейки
    snake.forEach((segment, index) => {
        const size = gridSize - 2;
        const x = segment.x * gridSize + 1;
        const y = segment.y * gridSize + 1;
        
        ctx.fillStyle = index === 0 ? 
            getComputedStyle(document.documentElement).getPropertyValue('--snake-head') : 
            getComputedStyle(document.documentElement).getPropertyValue('--snake-body');
        ctx.beginPath();
        ctx.roundRect(x, y, size, size, 4);
        ctx.fill();
    });
    
    // Отрисовка еды
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--food-color');
    const foodSize = gridSize - 2;
    const foodX = food.x * gridSize + 1;
    const foodY = food.y * gridSize + 1;
    
    ctx.beginPath();
    ctx.roundRect(foodX, foodY, foodSize, foodSize, 4);
    ctx.fill();
}

function startGame() {
    startScreen.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    pauseButton.classList.remove('hidden');
    resizeCanvas();
    resetGame();
    
    // Используем сохраненную скорость при старте
    const savedSpeed = Number(localStorage.getItem('initialSpeed')) || GAME_CONFIG.INITIAL_SPEED;
    gameSpeed = savedSpeed;
    
    updateSpeedDisplay();
    dx = 1;
    dy = 0;
    gameLoop = setInterval(drawGame, gameSpeed);
    
    drawGame();
}

function resetGame() {
    const startX = Math.floor(tileCountX / 2);
    const startY = Math.floor(tileCountY / 2);
    
    snake = [
        {x: startX, y: startY},
        {x: startX - 1, y: startY},
        {x: startX - 2, y: startY}
    ];
    
    dx = 0;
    dy = 0;
    score = 0;
    
    // Используем сохраненную скорость
    const savedSpeed = Number(localStorage.getItem('initialSpeed')) || GAME_CONFIG.INITIAL_SPEED;
    gameSpeed = savedSpeed;
    
    updateSpeedDisplay();
    generateNewFood();
}

function gameOver() {
    clearInterval(gameLoop);
    pauseButton.classList.add('hidden');
    document.getElementById('finalScore').textContent = `Счёт: ${score}`;
    document.getElementById('finalSpeed').textContent = `Скорость: ${Math.floor(1000/gameSpeed)} ход/сек`;
    document.getElementById('finalLength').textContent = `Длина змейки: ${snake.length}`;
    gameOverScreen.classList.remove('hidden');
}

function restartGame() {
    // Останавливаем текущую игру и очищаем все состояния
    clearInterval(gameLoop);
    gameLoop = null;
    snake = null;
    
    // Скрываем все окна, используем classList везде
    gameOverScreen.classList.add('hidden');  // Заменяем style.display на classList
    pauseScreen.classList.add('hidden');
    
    // Сбрасываем состояние паузы
    isPaused = false;
    
    // Запускаем новую игру
    requestAnimationFrame(() => {
        startGame();
    });
}

function pauseGame() {
    if (!isPaused) {
        isPaused = true;
        clearInterval(gameLoop);
        pauseScreen.classList.remove('hidden');
    }
}

function resumeGame() {
    if (isPaused) {
        isPaused = false;
        pauseScreen.classList.add('hidden');
        // Запускаем с текущей скоростью
        gameLoop = setInterval(drawGame, gameSpeed);
    }
}

function openSettings() {
    const savedSpeed = localStorage.getItem('initialSpeed') || GAME_CONFIG.INITIAL_SPEED;
    const isHardWalls = localStorage.getItem('hardWalls') === 'true';
    const savedScale = localStorage.getItem('gridScale') || 
        (isMobile ? GAME_CONFIG.GRID_SCALE.DEFAULT.MOBILE : GAME_CONFIG.GRID_SCALE.DEFAULT.DESKTOP);
    
    const settingsHtml = `
        <div class="menu-box">
            <h2>Настройки</h2>
            <div class="theme-toggle-container">
                <div class="dark-theme">
                    <span>🌙</span>
                    <span class="theme-text">Темная</span>
                </div>
                <label class="theme-toggle">
                    <input type="checkbox" ${currentTheme === 'light' ? 'checked' : ''} 
                           onchange="toggleTheme(this.checked)">
                    <span class="toggle-slider"></span>
                </label>
                <div class="light-theme">
                    <span class="theme-text">Светлая</span>
                    <span>☀️</span>
                </div>
            </div>
            <div class="scale-settings">
                <p class="settings-label">Размер змейки:</p>
                <div class="scale-control">
                    <input type="range" 
                           id="scaleSlider" 
                           min="${GAME_CONFIG.GRID_SCALE.MIN}" 
                           max="${GAME_CONFIG.GRID_SCALE.MAX}" 
                           value="${savedScale}"
                           step="1"
                           oninput="updateGridScale(this.value)">
                    <span id="scaleLabel">${Math.round((1/savedScale) * 100)}%</span>
                </div>
            </div>
            <div class="speed-settings">
                <p class="settings-label">Начальная скорость:</p>
                <div class="speed-control">
                    <input type="range" 
                           id="speedSlider" 
                           min="${GAME_CONFIG.SPEED_RANGE.MIN}" 
                           max="${GAME_CONFIG.SPEED_RANGE.MAX}" 
                           value="${savedSpeed}"
                           step="10"
                           oninput="updateSpeedLabel(this.value)">
                    <span id="speedLabel">${Math.round(1000/savedSpeed * 10) / 10} ход/сек</span>
                </div>
            </div>
            <div class="walls-settings">
                <p class="settings-label">Твердые стенки:</p>
                <label class="toggle-container">
                    <input type="checkbox" 
                           id="wallsToggle" 
                           ${isHardWalls ? 'checked' : ''}
                           onchange="toggleWalls(this.checked)">
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <button class="menu-button" onclick="closeSettings()">Закрыть</button>
        </div>
    `;
    
    const settingsScreen = document.createElement('div');
    settingsScreen.id = 'settingsScreen';
    settingsScreen.className = 'overlay';
    settingsScreen.innerHTML = settingsHtml;
    document.body.appendChild(settingsScreen);
}

function handleKeyPress(e) {
    switch(e.key) {
        case ' ':  // Пробел
        case 'Escape':
            if (isPaused) {
                resumeGame();
            } else {
                pauseGame();
            }
            break;
        case 'ArrowUp':
            changeDirection('up');
            break;
        case 'ArrowDown':
            changeDirection('down');
            break;
        case 'ArrowLeft':
            changeDirection('left');
            break;
        case 'ArrowRight':
            changeDirection('right');
            break;
    }
}

function handleResize() {
    if (!gameContainer.classList.contains('hidden')) {
        resizeCanvas();
        drawGame();
    }
}

function handleTouchStart(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}

function handleTouchMove(e) {
    e.preventDefault();
}

function handleTouchEnd(e) {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    // Если это был короткий тап (начальные и конечные координаты близки)
    if (Math.abs(touchEndX - touchStartX) < 10 && Math.abs(touchEndY - touchStartY) < 10) {
        handleTapControl(touchEndX, touchEndY);
    } 
    // Иначе обрабатываем как свайп
    else if (Math.abs(touchEndX - touchStartX) > GAME_CONFIG.SWIPE_THRESHOLD || 
             Math.abs(touchEndY - touchStartY) > GAME_CONFIG.SWIPE_THRESHOLD) {
        handleSwipeControl(touchEndX - touchStartX, touchEndY - touchStartY);
    }

    touchStartX = null;
    touchStartY = null;
}

// Добавим новую функцию для обработки тапов
function handleTapControl(x, y) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Определяем зоны экрана
    const leftZone = width * 0.33;
    const rightZone = width * 0.66;
    const topZone = height * 0.33;
    const bottomZone = height * 0.66;
    
    // Определяем, в какую зону попал тап
    if (x < leftZone && y > topZone && y < bottomZone) {
        changeDirection('left');
    } else if (x > rightZone && y > topZone && y < bottomZone) {
        changeDirection('right');
    } else if (y < topZone && x > leftZone && x < rightZone) {
        changeDirection('up');
    } else if (y > bottomZone && x > leftZone && x < rightZone) {
        changeDirection('down');
    }
}

// Выделим обработку свайпов в отдельную функцию
function handleSwipeControl(deltaX, deltaY) {
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0 && dx !== -1) {
            changeDirection('right');
        } else if (deltaX < 0 && dx !== 1) {
            changeDirection('left');
        }
    } else {
        if (deltaY > 0 && dy !== -1) {
            changeDirection('down');
        } else if (deltaY < 0 && dy !== 1) {
            changeDirection('up');
        }
    }
}

// Инициализация
window.Telegram.WebApp.ready();
window.Telegram.WebApp.expand();
pauseButton.addEventListener('click', pauseGame);
applyTheme(currentTheme);

// Обработчики событий
if (!isMobile) {
    document.addEventListener('keydown', handleKeyPress);
} else {
    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
}

window.addEventListener('resize', handleResize);

function applyTheme(theme) {
    const colors = themes[theme];
    
    // Устанавливаем CSS переменные
    document.documentElement.style.setProperty('--background-color', colors.background);
    document.documentElement.style.setProperty('--game-background', colors.gameBackground);
    document.documentElement.style.setProperty('--grid-color', colors.gridColor);
    document.documentElement.style.setProperty('--text-color', colors.textColor);
    document.documentElement.style.setProperty('--menu-text-color', colors.menuTextColor);
    document.documentElement.style.setProperty('--snake-head', colors.snakeHead);
    document.documentElement.style.setProperty('--snake-body', colors.snakeBody);
    document.documentElement.style.setProperty('--food-color', colors.food);
    document.documentElement.style.setProperty('--menu-background', colors.menuBackground);
    document.documentElement.style.setProperty('--overlay-background', colors.overlayBackground);
    document.documentElement.style.setProperty('--button-background', colors.buttonBackground);
    document.documentElement.style.setProperty('--score-background', colors.scoreBackground);
    document.documentElement.style.setProperty('--toggle-background', colors.toggleBackground);
    document.documentElement.style.setProperty('--icon-color', colors.iconColor);

    // Перерисовываем игру с новыми цветами
    if (snake) {
        const wasPaused = isPaused;
        
        if (!wasPaused) {
            // Сохраняем текущую скорость
            const currentSpeed = gameSpeed;
            clearInterval(gameLoop);
            drawGame();
            // Восстанавливаем с той же скоростью
            gameLoop = setInterval(drawGame, currentSpeed);
        } else {
            drawGame();
        }
    }
}

function toggleTheme(isLight) {
    const newTheme = isLight ? 'light' : 'dark';
    currentTheme = newTheme;
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
}

function closeSettings() {
    const settingsScreen = document.getElementById('settingsScreen');
    if (settingsScreen) {
        settingsScreen.remove();
    }
    
    // Применяем текущую тему заново при закрытии настроек
    applyTheme(currentTheme);
    
    if (isPaused) {
        pauseScreen.classList.remove('hidden');
    }
}

// Добавляем вспомогательные функции
function updateSpeedDisplay() {
    const speedInMoves = Math.round(1000 / gameSpeed * 10) / 10;
    scoreElement.textContent = `Счёт: ${score} | Скорость: ${speedInMoves} ход/сек`;
}

function generateNewFood() {
    do {
        food = {
            x: Math.floor(Math.random() * tileCountX),
            y: Math.floor(Math.random() * tileCountY)
        };
    } while (snake.some(segment => segment.x === food.x && segment.y === food.y));
}

function restartGameLoop() {
    clearInterval(gameLoop);
    gameLoop = setInterval(drawGame, gameSpeed);
}

// Изменим функцию updateSpeedLabel для обратного расчета
function updateSpeedLabel(value) {
    const speedValue = Number(value);
    
    // Обновляем отображение в настройках
    const speedInMoves = Math.round(1000/speedValue * 10) / 10;
    document.getElementById('speedLabel').textContent = `${speedInMoves} ход/сек`;
    
    // Обновляем все значения скорости
    gameSpeed = speedValue;
    GAME_CONFIG.INITIAL_SPEED = speedValue;
    localStorage.setItem('initialSpeed', speedValue);
    
    // Обновляем отображение в игре
    updateSpeedDisplay();
    
    // Перезапускаем игровой цикл
    if (snake) {
        clearInterval(gameLoop);
        if (!isPaused) {
            gameLoop = setInterval(drawGame, speedValue);
        }
    }
}

// Добавляем функцию переключения стенок
function toggleWalls(enabled) {
    hardWalls = enabled;
    localStorage.setItem('hardWalls', enabled);
}

// Изменим функцию updateGridScale для обратного расчета
function updateGridScale(value) {
    const scaleValue = Number(value);
    localStorage.setItem('gridScale', scaleValue);
    
    // Перерисовываем канвас с новым масштабом
    resizeCanvas();
    
    // Обновляем label в настройках (теперь больший делитель = меньший процент)
    const scaleLabel = document.getElementById('scaleLabel');
    if (scaleLabel) {
        scaleLabel.textContent = `${Math.round((1/value) * 100)}%`;
    }
} 