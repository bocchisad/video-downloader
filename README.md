# Video Downloader

Современный видео-загрузчик с Apple-style дизайном. Backend на Node.js/Express для Render, Frontend для GitHub Pages.

## Структура проекта

```
video_downloader/
├── backend/           # Node.js + Express API
│   ├── server.js      # Основной сервер
│   ├── package.json   # Зависимости
│   ├── Dockerfile     # Docker-конфигурация
│   └── render.yaml    # Render.com конфигурация
├── frontend/          # HTML/CSS/JS для GitHub Pages
│   ├── index.html     # Главная страница
│   ├── app.js         # Логика приложения
│   └── config.js      # Конфигурация API URL
└── README.md          # Этот файл
```

## Деплой Backend (Render)

### Способ 1: Через Dockerfile (рекомендуется)

1. Создайте аккаунт на [render.com](https://render.com)
2. Нажмите **New +** → **Web Service**
3. Подключите GitHub репозиторий
4. Укажите:
   - **Name**: `video-downloader-backend`
   - **Runtime**: `Docker`
   - **Branch**: `main`
   - **Root Directory**: `backend`
5. Нажмите **Create Web Service**

### Способ 2: Через render.yaml (Blueprint)

1. Загрузите проект на GitHub
2. На Render нажмите **New +** → **Blueprint**
3. Выберите репозиторий
4. Render автоматически создаст сервис из `render.yaml`

### Важно: Установка yt-dlp

Dockerfile уже настроен для автоматической установки `yt-dlp`. Если деплой не работает:

```bash
# Проверьте версию в логах Render
yt-dlp --version
```

## Деплой Frontend (GitHub Pages)

1. Создайте новый репозиторий на GitHub для фронтенда
2. Загрузите файлы из папки `frontend/`:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/video-downloader-frontend.git
   git push -u origin main
   ```
3. Перейдите в **Settings** → **Pages**
4. В разделе **Build and deployment**:
   - **Source**: Deploy from a branch
   - **Branch**: main → / (root)
5. Нажмите **Save**

## Настройка связи Frontend ↔ Backend

После деплоя backend на Render:

1. Скопируйте URL вашего бэкенда (например: `https://video-downloader-backend-xxx.onrender.com`)
2. Отредактируйте `frontend/config.js`:
   ```javascript
   const CONFIG = {
       API_URL: 'https://video-downloader-backend-xxx.onrender.com'
   };
   ```
3. Закоммитьте и запушьте изменения на GitHub Pages

## Локальная разработка

### Backend:

```bash
cd backend
npm install
npm run dev
```

Сервер запустится на `http://localhost:3000`

### Frontend:

Откройте `frontend/index.html` в браузере или используйте Live Server.

Для локальной разработки измените `config.js`:
```javascript
const CONFIG = {
    API_URL: 'http://localhost:3000'
};
```

## Функции

- **Автоматический анализ**: При вставке ссылки видео анализируется автоматически
- **Skeleton Loader**: Анимированная загрузка пока сервер "просыпается"
- **Выбор качества**: Красивые теги для выбора 720p, 1080p, Audio Only
- **Потоковая загрузка**: Видео скачивается напрямую через сервер

## Технологии

- **Backend**: Node.js, Express, yt-dlp, Docker
- **Frontend**: HTML5, Tailwind CSS, Lucide Icons
- **Хостинг**: Render (backend), GitHub Pages (frontend)

## Ограничения

- Файлы >500MB могут вызывать таймауты на бесплатном плане Render
- Для больших файлов рекомендуется использовать стриминг с внешнего хранилища

## Лицензия

MIT
