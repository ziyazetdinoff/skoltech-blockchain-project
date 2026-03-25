# Как заполнить `.env` для DCA MVP

Этот документ объясняет, откуда взять основные переменные окружения для запуска проекта в `Ethereum Sepolia`.

## Что понадобится заранее

- отдельный тестовый кошелек в MetaMask
- немного `Sepolia ETH` для оплаты газа
- `USDC` в Sepolia для создания DCA-плана
- RPC endpoint для сети Sepolia

## Важное правило безопасности

- не используйте основной кошелек
- создайте отдельный аккаунт только для тестов
- не публикуйте приватный ключ в GitHub, Telegram или отчетах
- файл `.env` должен оставаться только локально

## 1. `RPC_URL`

`RPC_URL` это HTTPS-адрес Ethereum-ноды, через которую проект будет работать с сетью Sepolia.

### Самый простой способ получить

1. Зарегистрируйтесь в [Alchemy](https://www.alchemy.com/chain-connect/endpoints/alchemy-sepolia).
2. Создайте приложение:
   - Chain: `Ethereum`
   - Network: `Sepolia`
3. Скопируйте выданный HTTPS endpoint.

### Как это выглядит

```env
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
```

### Где взять тестовый ETH

Для газа можно использовать:

- [Alchemy Sepolia Faucet](https://www.alchemy.com/faucets/ethereum-sepolia)

## 2. `DEPLOYER_PRIVATE_KEY`

Это приватный ключ кошелька, с которого будет выполняться деплой контракта.

### Как получить

1. Создайте отдельный аккаунт в MetaMask для тестов.
2. Откройте инструкцию MetaMask:
   - [How to export an account private key](https://support.metamask.io/configure/accounts/how-to-export-an-accounts-private-key/)
3. Экспортируйте private key этого тестового аккаунта.
4. Вставьте его в `.env`.

### Пример

```env
DEPLOYER_PRIVATE_KEY=0xYOUR_TEST_WALLET_PRIVATE_KEY
```

## 3. `BACKEND_PRIVATE_KEY`

Хотя вы спрашивали не про него, для проекта он тоже обязателен. Это ключ кошелька, от имени которого работают:

- executor
- Telegram-бот
- seed script

### Что выбрать

Есть два варианта:

- использовать тот же тестовый кошелек, что и для деплоя
- завести второй тестовый кошелек специально под backend

Для простоты MVP можно временно использовать тот же ключ:

```env
BACKEND_PRIVATE_KEY=0xYOUR_TEST_WALLET_PRIVATE_KEY
```

Но тогда именно на этом кошельке должны быть:

- `Sepolia ETH` для газа
- `USDC` для создания плана

## 4. `UNISWAP_ROUTER`

Это публичный адрес роутера Uniswap в Sepolia. Для текущего проекта нужен роутер, поддерживающий `exactInputSingle`.

### Адрес

Используйте `SwapRouter02`:

- [Sepolia Etherscan: SwapRouter02](https://sepolia.etherscan.io/address/0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E)

```env
UNISWAP_ROUTER=0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E
```

## 5. `UNISWAP_QUOTER`

Это публичный адрес контракта Uniswap, который используется для получения котировки swap до реального исполнения.

### Адрес

Используйте `QuoterV2`:

- [Sepolia Etherscan: QuoterV2](https://sepolia.etherscan.io/address/0x7A0be50E2AEE679618CD61045F19E1A414De94E5)

```env
UNISWAP_QUOTER=0x7A0be50E2AEE679618CD61045F19E1A414De94E5
```

## 6. `USDC_ADDRESS`

Это адрес токена `USDC` в сети Sepolia.

### Адрес

Для проекта используйте Sepolia USDC от Circle:

- [Circle docs: monitored tokens](https://developers.circle.com/wallets/monitored-tokens)
- [Circle faucet](https://faucet.circle.com/)

```env
USDC_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
```

### Как получить тестовый USDC

1. Откройте [Circle Faucet](https://faucet.circle.com/).
2. Выберите сеть `Ethereum Sepolia`.
3. Укажите адрес вашего тестового кошелька.
4. Запросите `USDC`.

## 7. `WETH_ADDRESS`

Это адрес обернутого ETH (`WETH9`) в сети Sepolia.

### Адрес

- [Sepolia Etherscan: WETH9](https://sepolia.etherscan.io/address/0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14)

```env
WETH_ADDRESS=0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14
```

## 8. `ETHERSCAN_API_KEY`

Эта переменная нужна для отдельного шага verify после деплоя контракта.

### Как получить

1. Зарегистрируйтесь на [Etherscan](https://etherscan.io/register).
2. Создайте API key по официальной инструкции:
   - [Getting an API Key](https://docs.etherscan.io/getting-an-api-key)
3. Скопируйте ключ в `.env`.

### Пример

```env
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
```

### Для чего используется в проекте

- `make verify`
- `npm run verify:sepolia`

## Готовый минимальный `.env`

Ниже минимальный набор значений, которые нужно заполнить перед деплоем и запуском:

```env
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY

DEPLOYER_PRIVATE_KEY=0xYOUR_TEST_WALLET_PRIVATE_KEY
BACKEND_PRIVATE_KEY=0xYOUR_TEST_WALLET_PRIVATE_KEY

UNISWAP_ROUTER=0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E
UNISWAP_QUOTER=0x7A0be50E2AEE679618CD61045F19E1A414De94E5

USDC_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
WETH_ADDRESS=0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14

ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
```

После деплоя контракта понадобится дописать еще:

```env
DCA_MANAGER_ADDRESS=0xYOUR_DEPLOYED_CONTRACT_ADDRESS
```

или

```env
CONTRACT_ADDRESS=0xYOUR_DEPLOYED_CONTRACT_ADDRESS
```

## Что должно быть на кошельке перед запуском

На кошельке, который указан в `BACKEND_PRIVATE_KEY`, должны быть:

- `Sepolia ETH` для газа
- `USDC` для создания DCA-плана

На кошельке, указанном в `DEPLOYER_PRIVATE_KEY`, должен быть:

- `Sepolia ETH` для деплоя

Если это один и тот же тестовый кошелек, то на нем нужны:

- `Sepolia ETH`
- `USDC`

## Частые проблемы

### 1. `insufficient funds for intrinsic transaction cost`

Причина: на кошельке нет `Sepolia ETH`.

Что делать:

- получить тестовый ETH через faucet

### 2. Quote или swap не проходит

Причина обычно одна из этих:

- не хватает ликвидности в выбранном пуле
- неверный `UNISWAP_POOL_FEE`
- на кошельке нет `USDC`

Для этого проекта по умолчанию стоит:

```env
UNISWAP_POOL_FEE=500
```

Если swap не проходит, имеет смысл проверить и вариант `3000`.

### 3. Контракт задеплоился, но бот и executor не видят его

Причина: в `.env` не записан адрес задеплоенного контракта.

Что делать:

- взять адрес из вывода `make deploy` или `npm run deploy:sepolia`
- записать его в `DCA_MANAGER_ADDRESS` или `CONTRACT_ADDRESS`

## Практический порядок действий

1. Создать отдельный тестовый кошелек в MetaMask.
2. Получить `Sepolia ETH` через faucet.
3. Получить `USDC` через Circle Faucet.
4. Создать Sepolia endpoint в Alchemy и скопировать `RPC_URL`.
5. Экспортировать private key тестового кошелька.
6. Заполнить `.env`.
7. Выполнить деплой:

```bash
make deploy
```

8. Скопировать адрес контракта в `.env`.
9. Выполнить verify:

```bash
make verify
```

10. Запустить executor и bot.

## Источники

- [Alchemy Sepolia endpoints](https://www.alchemy.com/chain-connect/endpoints/alchemy-sepolia)
- [Alchemy Sepolia faucet](https://www.alchemy.com/faucets/ethereum-sepolia)
- [MetaMask: export private key](https://support.metamask.io/configure/accounts/how-to-export-an-accounts-private-key/)
- [Sepolia Etherscan: SwapRouter02](https://sepolia.etherscan.io/address/0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E)
- [Sepolia Etherscan: QuoterV2](https://sepolia.etherscan.io/address/0x7A0be50E2AEE679618CD61045F19E1A414De94E5)
- [Sepolia Etherscan: WETH9](https://sepolia.etherscan.io/address/0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14)
- [Circle docs: monitored tokens](https://developers.circle.com/wallets/monitored-tokens)
- [Circle faucet](https://faucet.circle.com/)
- [Etherscan: Getting an API Key](https://docs.etherscan.io/getting-an-api-key)
