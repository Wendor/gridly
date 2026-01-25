# Миграция на Tauri

- [ ] **Инициализация проекта**
    - [ ] Установить Tauri CLI и зависимости
    - [ ] Инициализировать Tauri (`cargo tauri init`)
    - [ ] Настроить `tauri.conf.json`
    - [ ] Настроить `vite.config.ts` для Tauri
    - [ ] Настроить `Cargo.toml` (добавить зависимости: sqlx, tokio, serde, ssh2, tauri-plugin-store)

- [ ] **Frontend Адаптация**
    - [ ] Создать API-адаптер для Tauri (`src/renderer/api/tauri.ts`)
    - [ ] Реализовать интерфейс `IElectronAPI` через Tauri Invoke
    - [ ] Заменить вызовы `window.dbApi` на новый адаптер
    - [ ] Убрать Electron-зависимости из renderer (ipcRenderer)

- [ ] **Backend Реализация (Rust)**
    - [ ] **Базовые структуры**
        - [ ] Перенести типы из `shared/types.ts` в Rust structs
        - [ ] Настроить сериализацию/десериализацию (serde)
    - [ ] **Storage Service**
        - [ ] Реализовать сохранение/загрузку настроек и соединений (fs или tauri-plugin-store)
    - [ ] **Database Core**
        - [ ] Определить трейт `DbService` (аналог IDbService)
        - [ ] Создать `DatabaseManager` (управление пулом соединений)
    - [ ] **PostgreSQL Implementation**
        - [ ] Подключение (`sqlx::PgPool`)
        - [ ] Выполнение запросов
        - [ ] Просмотр метаданных (таблицы, схемы)
    - [ ] **MySQL Implementation**
        - [ ] Подключение (`sqlx::MySqlPool`)
        - [ ] Выполнение запросов
        - [ ] Просмотр метаданных
    - [ ] **SSH Tunneling**
        - [ ] Реализовать SSH туннель через `ssh2` crate
        - [ ] Интеграция туннеля с БД соединениями
    - [ ] **Command Handlers**
        - [ ] Реализовать Tauri команды для всех методов API

- [ ] **Сборка и Тестирование**
    - [ ] Запустить dev-режим (`tauri dev`)
    - [ ] Исправить возможные ошибки сборки
    - [ ] Проверить подключение к реальным БД
    - [ ] Проверить SSH туннелирование
