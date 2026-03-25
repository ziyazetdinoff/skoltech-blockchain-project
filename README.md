# DCA MVP for Ethereum Sepolia

Учебный MVP для стратегии Dollar-Cost Averaging на Ethereum Sepolia. Проект состоит из смарт-контракта `DCAPlanManager`, off-chain executor-сервиса и Telegram-бота для одного демонстрационного пользователя.

Дополнительные документы:

- [README_ENG.md](/Users/ruslan/cur-anime-dir/skoltech-blockchain-project/README_ENG.md)
- [ENV_SETUP.md](/Users/ruslan/cur-anime-dir/skoltech-blockchain-project/ENV_SETUP.md)

<!-- DEPLOYMENT_INFO:START -->
## Deployment Info

- Сеть: Sepolia
- Контракт: `DCAPlanManager`
- Статус: контракт еще не задеплоен из этого репозитория
<!-- DEPLOYMENT_INFO:END -->

## Что реализовано

- смарт-контракт `DCAPlanManager` на Solidity
- исполнение swap через Uniswap V3 `exactInputSingle`
- защита по slippage через `minAmountOut`
- off-chain executor c котировкой через Quoter и логированием в SQLite
- Telegram-бот с командами управления планами
- unit tests для контракта и backend-утилит
- deploy и seed scripts

## Структура проекта

```text
contracts/
  DCAPlanManager.sol
  interfaces/ISwapRouter.sol
  mocks/

scripts/
  deploy.ts
  seed.ts

test/
  DCAPlanManager.test.ts
  backend.test.ts

bot/
  index.ts
  commands/registerCommands.ts
  services/

executor/
  index.ts
  services/

config/
  tokens.ts
  networks.ts

src/
  common/
  storage/

deployments/
  sepolia.json
Dockerfile
docker-compose.yml
Makefile
README.md
report.md
```

## Требования к окружению

- Node.js 22 LTS рекомендуется
- npm 10+
- Sepolia RPC URL
- тестовые токены USDC и WETH в Sepolia
- Uniswap router и quoter адреса для Sepolia
- Telegram bot token

Hardhat в этой среде успешно собрался и протестировался, но под Node.js 23 показывает предупреждение о неподдерживаемой версии. Для обычного запуска лучше использовать Node.js 22.

## Переменные окружения

Скопируйте `.env.example` в `.env` и заполните значения:

```bash
cp .env.example .env
```

Обязательные поля:

- `RPC_URL`
- `DEPLOYER_PRIVATE_KEY`
- `BACKEND_PRIVATE_KEY`
- `UNISWAP_ROUTER`
- `UNISWAP_QUOTER`
- `USDC_ADDRESS`
- `WETH_ADDRESS`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ALLOWED_USER_ID`

Для verify дополнительно потребуется:

- `ETHERSCAN_API_KEY`

Подробная пошаговая инструкция, откуда брать ключевые значения (`RPC_URL`, private key, Uniswap addresses, USDC/WETH addresses), вынесена в отдельный документ:

- [ENV_SETUP.md](/Users/ruslan/cur-anime-dir/skoltech-blockchain-project/ENV_SETUP.md)

После деплоя заполните один из адресов контракта:

- `DCA_MANAGER_ADDRESS`
- `CONTRACT_ADDRESS`

Опциональные поля с дефолтами:

- `UNISWAP_POOL_FEE=500`
- `MAX_SLIPPAGE_BPS=1000`
- `EXECUTOR_POLL_INTERVAL_MS=30000`
- `EXECUTOR_DEADLINE_SECONDS=300`
- `SQLITE_PATH=./data/dca.sqlite`
- `NETWORK_NAME=sepolia`

## Установка

```bash
npm install
```

## Docker и Makefile

Теперь рекомендуемый способ запуска проекта:

```bash
make build-image
make compile
make test
```

Основные цели:

- `make build-image`
- `make compile`
- `make test`
- `make deploy`
- `make verify`
- `make seed SEED_ARGS="10 100 604800 300 me now"`
- `make up`
- `make down`
- `make logs`

Эквивалентные прямые команды через Docker Compose:

```bash
docker compose build
docker compose run --rm hardhat npm run compile
docker compose run --rm hardhat npm test
docker compose run --rm hardhat npm run deploy:sepolia
docker compose run --rm hardhat npm run verify:sepolia
docker compose up -d bot executor
```

## Сборка и тесты

```bash
npm run build
npm run compile
npm test
```

Если среда ограничивает домашнюю директорию Hardhat, можно временно использовать локальный `HOME`:

```bash
mkdir -p .home
HOME=$PWD/.home npm run compile
HOME=$PWD/.home npm test
```

## Деплой в Sepolia

1. Заполните `.env`, включая `RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `UNISWAP_ROUTER`, `UNISWAP_QUOTER`, `USDC_ADDRESS`, `WETH_ADDRESS`.
2. Выполните:

```bash
npm run deploy:sepolia
```

3. Скрипт:
   - задеплоит `DCAPlanManager`
   - сохранит метаданные в `deployments/sepolia.json`
   - выведет адрес контракта в терминал
   - автоматически обновит deployment block в `README.md` и `README_ENG.md`
4. Скопируйте адрес в `.env` как `DCA_MANAGER_ADDRESS` или `CONTRACT_ADDRESS`.

Рекомендуемая команда:

```bash
make deploy
```

## Verify в Etherscan

Verify вынесен в отдельный шаг и использует:

- `ETHERSCAN_API_KEY` из `.env`
- адрес и constructor args из `deployments/sepolia.json`

Команда:

```bash
make verify
```

Или напрямую:

```bash
docker compose run --rm hardhat npm run verify:sepolia
```

После успешного verify:

- `deployments/sepolia.json` обновляется флагами `verified` и `verifiedAt`
- deployment block в `README.md` и `README_ENG.md` обновляется повторно

## Создание демо-плана

Скрипт `seed.ts` создает план для демо-пары `USDC -> WETH`.

Формат:

```bash
npm run seed:sepolia -- <amountPerInterval> <totalBudget> <intervalSeconds> <slippageBps> [recipient] [startTime]
```

Пример:

```bash
npm run seed:sepolia -- 10 100 604800 300 me now
```

Где:

- `amountPerInterval`: сумма одной покупки в USDC
- `totalBudget`: общий бюджет в USDC
- `intervalSeconds`: интервал в секундах
- `slippageBps`: допустимый slippage в bps
- `recipient`: адрес получателя или `me`
- `startTime`: `now`, unix timestamp или ISO datetime

## Запуск executor

```bash
npm run executor
```

Executor:

- проходит по всем `planId` от `0` до `nextPlanId - 1`
- обновляет локальные снапшоты в SQLite
- проверяет `canExecute`
- получает quote через Uniswap Quoter
- считает `minAmountOut`
- вызывает `executePlan`
- пишет историю попыток и служебные логи в SQLite

Для разового прогона:

```bash
node --import tsx executor/index.ts --once
```

## Запуск Telegram-бота

```bash
npm run bot
```

Поддерживаемые команды:

- `/start`
- `/help`
- `/plans`
- `/plan <id>`
- `/pause <id>`
- `/resume <id>`
- `/cancel <id>`
- `/topup <id> <amount>`
- `/withdraw <id> <amount>`
- `/create`
- `/update <id>`

Для `/plan <id>` бот теперь показывает inline buttons:

- `Pause`
- `Resume`
- `Cancel`
- `Refresh`

Slash-команды продолжают работать как раньше.

`/create` проводит пользователя через шаги:

1. `amountPerInterval`
2. `totalBudget`
3. `intervalSeconds`
4. `slippageBps`
5. `recipient`
6. `startTime`

`/update` проводит через:

1. `amountPerInterval`
2. `intervalSeconds`
3. `slippageBps`

Доступ к боту ограничен `TELEGRAM_ALLOWED_USER_ID`.

## Минимальный demo-flow

1. Установить зависимости и заполнить `.env`.
2. Задеплоить контракт: `npm run deploy:sepolia`.
3. Записать адрес контракта в `.env`.
4. Создать демо-план через `npm run seed:sepolia -- 10 100 604800 300 me now` или через `/create`.
5. Запустить executor: `npm run executor`.
6. Запустить бот: `npm run bot`.
7. Проверить список планов через `/plans` и детали через `/plan <id>`.

## Ограничения MVP

- single-user demo
- одна демо-пара `USDC -> WETH` на уровне конфигурации и UX
- только Uniswap V3 single-hop
- приватные ключи хранятся в `.env`
- `withdrawUnusedFunds` доступен только после `cancelPlan`
- адреса Sepolia и токенов нужно заполнить вручную из вашей среды
