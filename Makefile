COMPOSE := docker compose

.PHONY: build-image compile test deploy verify seed bot executor up down logs

build-image:
	$(COMPOSE) build

compile:
	$(COMPOSE) run --rm hardhat npm run compile

test:
	$(COMPOSE) run --rm hardhat npm test

deploy:
	$(COMPOSE) run --rm hardhat npm run deploy:sepolia

verify:
	$(COMPOSE) run --rm hardhat npm run verify:sepolia

seed:
	$(COMPOSE) run --rm hardhat npm run seed:sepolia -- $(SEED_ARGS)

bot:
	$(COMPOSE) up bot

executor:
	$(COMPOSE) up executor

up:
	$(COMPOSE) up -d bot executor

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f bot executor
