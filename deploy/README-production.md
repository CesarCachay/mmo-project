# Cesar MMO Edition — Production Deployment

## Architecture

```text
Internet
   |
   v
CloudFront (HTTPS)
   |
   v
EC2 + Elastic IP
   |
   v
Nginx :80
   |------------------------------|
   |                              |
   v                              v
Vite / Phaser SPA             NestJS :3000
                                 |
                                 v
                          PostgreSQL RDS

## EC2 paths

Application:

```text
/opt/cesar-mmo
```

Backend environment:

```text
/etc/cesar-mmo/server.env
```

Systemd service:

```text
/etc/systemd/system/cesar-mmo-server.service
```

Nginx configuration:

```text
/etc/nginx/conf.d/cesar-mmo.conf
```

Production deploy command:

```text
/usr/local/bin/cesar-mmo-deploy
```

## Required environment variables

See:

```text
deploy/env/server.env.example
```

Required variables:

- `NODE_ENV`
- `PORT`
- `DATABASE_URL`
- `GOOGLE_CLIENT_ID`
- `CLIENT_ORIGIN`

Never commit the real production environment file.

## Services

Backend:

```bash
sudo systemctl status cesar-mmo-server
```

Nginx:

```bash
sudo systemctl status nginx
```

Restart:

```bash
sudo systemctl restart cesar-mmo-server
sudo systemctl restart nginx
```

## Health check

```bash
curl -i http://127.0.0.1/health
```

Expected:

```json
{"status":"ok"}
```

## Prisma

```bash
sudo -iu cesarmmo
cd /opt/cesar-mmo

set -a
source /etc/cesar-mmo/server.env
set +a

pnpm prisma:migrate:status
pnpm prisma:migrate:deploy
```

Do not use `prisma migrate dev` in production.

## Production deployment

Normal workflow:

```text
Local development
       |
       v
Tests / build
       |
       v
Git commit
       |
       v
Git push origin main
       |
       v
Production EC2
       |
       v
cesar-mmo-deploy
```

On EC2:

```bash
sudo /usr/local/bin/cesar-mmo-deploy
```

The deploy script:

1. Validates the production repository.
2. Pulls `origin/main`.
3. Installs dependencies with the lockfile.
4. Builds the shared package.
5. Builds NestJS.
6. Generates Prisma Client.
7. Applies production migrations.
8. Builds the Vite/Phaser frontend.
9. Validates Nginx.
10. Restarts services and runs smoke tests.

## Nginx routes

Frontend:

```text
/*
```

Backend:

```text
/health
/auth/*
/trainers*
/socket.io/*
```

Socket.IO supports WebSocket upgrades through Nginx.

## Security

Never commit:

- Database passwords
- Real DATABASE_URL values
- Private keys
- AWS credentials
- OAuth secrets
- server.env

## CloudFront

CloudFront sits in front of the EC2 origin.

Production backend expects:

```text
CLIENT_ORIGIN=https://<cloudfront-domain>
```

Production session cookies:

```text
HttpOnly=true
Secure=true
SameSite=Lax
```

## Current production baseline

Validated with:

- Amazon Linux 2023
- Node.js 24
- pnpm
- NestJS
- Nginx
- PostgreSQL on Amazon RDS
- Amazon CloudFront
- AWS Systems Manager Session Manager
