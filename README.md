<p align="center">
  <a href="https://cari.inspeksimobil.id" target="blank">
    <img src="./public/logo_car-dano.png" width="160" alt="CAR-dano Logo" />
  </a>
</p>

<h1 align="center">CAR-dano Backend</h1>

<p align="center">
  Backend system for CAR-dano, a Cardano blockchain-based car inspection records platform.
</p>

<p align="center">
  <a href="https://deepwiki.com/CAR-dano/cardano-backend" target="_blank">
    <img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki about CAR-dano Backend"/>
  </a>
  <a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
  </p>

## Description

CAR-dano is a blockchain-based platform designed to securely store and make used car inspection reports immutable. By leveraging the Cardano blockchain, CAR-dano ensures transparency, reliability, and security in the used car market. The platform aims to reduce fraud and misinformation by providing an unalterable record of vehicle inspections, allowing buyers, sellers, and other stakeholders to access trusted reports.

This repository contains the source code for the CAR-dano backend service, built with [NestJS](https://nestjs.com), a progressive Node.js framework for building efficient and scalable server-side applications. This backend is responsible for handling business logic, authentication, database interactions (Prisma with PostgreSQL), integration with the Cardano blockchain (via Blockfrost API and MeshJS SDK), and providing APIs for the frontend application and external developers.

## Key Backend Features

- Inspection Management: Create, read, update, and review inspection data.
- Blockchain Integration: Record report hashes and essential metadata onto the Cardano blockchain.
- Authentication & Authorization: Secure login system with user roles (Admin, Inspector, Reviewer, User).
- User Management: User account and role administration.
- Public API: Provides API endpoints for external developer access.
- File Storage: Manages uploads of inspection report PDF files and related photos.

## Technology Stack

- **Framework**: NestJS (Node.js)
- **Language**: TypeScript
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Blockchain Interaction**:
  - Blockfrost API
  - MeshJS SDK (for some off-chain operations or if direct backend wallet interactions are needed)
- **API Documentation**: Swagger (Scalar) - accessible at `/api/v1/docs` when running locally.
- **Authentication**: JWT, Google OAuth, Cardano Wallet (CIP-0008)
- **Containerization**: Docker

## Project Structure (Overview of Main Modules)

- `src/auth`: Module for authentication (login, registration, JWT, guards).
- `src/users`: Module for user management.
- `src/inspections`: Core module for inspection data management.
- `src/photos`: Module for managing photos related to inspections.
- `src/inspection-branches`: Module for inspection branch management.
- `src/blockchain`: Module for Cardano blockchain interactions.
- `src/prisma`: Prisma configuration and service.
- `src/dashboard`: Module for dashboard analytics and statistics.
- `src/public-api`: Module for public API endpoints.
- `libs`: Contains shared libraries like configuration, database, etc.

## Installation & Project Setup

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/CAR-dano/cardano-backend.git
    cd cardano-backend
    ```

2.  **Set up environment variables:**
    Copy the `.env.example` file to `.env` and fill in the required values based on the comments in `.env.example`.

    ```bash
    cp .env.example .env
    ```

    Key variables include:

    - `NODE_ENV`, `PORT`, `URL`
    - `IPFS_API_HOST`, `IPFS_API_PORT`
    - `DATABASE_URL` (or `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`)
    - `JWT_SECRET`, `JWT_EXPIRATION_TIME`
    - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
    - `CLIENT_BASE_URL`, `CLIENT_BASE_URL_PDF`
    - `PDF_PUBLIC_BASE_URL`
    - `BLOCKFROST_ENV`, `BLOCKFROST_API_KEY_PREVIEW`, `BLOCKFROST_API_KEY_PREPROD`, `BLOCKFROST_API_KEY_MAINNET`
    - `WALLET_SECRET_KEY_TESTNET`, `WALLET_ADDRESS_TESTNET`
    - `WALLET_SECRET_KEY_MAINNET`, `WALLET_ADDRESS_MAINNET`

## Running the Application

```bash
$ docker-compose up -d --build
```
