/*
 * --------------------------------------------------------------------------
 * File: redis.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Redis service for caching using ioredis with Upstash.
 * Provides get, set, delete operations with graceful error handling
 * and automatic fallback support when Redis is unavailable.
 * --------------------------------------------------------------------------
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
    private readonly logger = new Logger(RedisService.name);
    private readonly client: Redis;
    private isConnected = false;

    constructor(private readonly configService: ConfigService) {
        const redisUrl = this.configService.get<string>('REDIS_URL');

        if (!redisUrl) {
            this.logger.warn(
                'REDIS_URL not configured. Redis caching will be disabled.',
            );
            // Create a dummy client that won't connect
            this.client = new Redis({
                lazyConnect: true,
                enableOfflineQueue: false,
            });
            return;
        }

        try {
            this.client = new Redis(redisUrl, {
                maxRetriesPerRequest: 3,
                enableReadyCheck: true,
                enableOfflineQueue: false, // Don't queue commands when offline
                retryStrategy: (times: number) => {
                    if (times > 3) {
                        this.logger.error('Redis connection failed after 3 retries');
                        return null; // Stop retrying
                    }
                    const delay = Math.min(times * 200, 2000);
                    this.logger.warn(`Retrying Redis connection in ${delay}ms...`);
                    return delay;
                },
            });

            // Connection event handlers
            this.client.on('connect', () => {
                this.logger.log('Redis client connecting...');
            });

            this.client.on('ready', () => {
                this.isConnected = true;
                this.logger.log('Redis connected successfully');
            });

            this.client.on('error', (error: Error) => {
                this.isConnected = false;
                this.logger.error(`Redis connection error: ${error.message}`);
            });

            this.client.on('close', () => {
                this.isConnected = false;
                this.logger.warn('Redis connection closed');
            });

            this.client.on('reconnecting', () => {
                this.logger.log('Redis reconnecting...');
            });
        } catch (error) {
            this.logger.error(
                `Failed to initialize Redis client: ${(error as Error).message}`,
            );
            // Create a dummy client for graceful degradation
            this.client = new Redis({
                lazyConnect: true,
                enableOfflineQueue: false,
            });
        }
    }

    /**
     * Check if Redis is healthy and connected
     */
    async isHealthy(): Promise<boolean> {
        if (!this.isConnected) {
            return false;
        }

        try {
            await this.client.ping();
            return true;
        } catch (error) {
            this.logger.warn(`Redis health check failed: ${(error as Error).message}`);
            return false;
        }
    }

    /**
     * Get a value from Redis cache
     * Returns null if key doesn't exist or Redis is unavailable
     */
    async get(key: string): Promise<string | null> {
        try {
            if (!this.isConnected) {
                this.logger.verbose('Redis not connected, skipping get operation');
                return null;
            }

            const value = await this.client.get(key);
            return value;
        } catch (error) {
            this.logger.warn(
                `Redis GET failed for key "${key}": ${(error as Error).message}`,
            );
            return null; // Graceful degradation
        }
    }

    /**
     * Set a value in Redis cache with optional TTL
     * @param key Cache key
     * @param value Value to store
     * @param ttlSeconds Time to live in seconds (optional)
     */
    async set(
        key: string,
        value: string,
        ttlSeconds?: number,
    ): Promise<boolean> {
        try {
            if (!this.isConnected) {
                this.logger.verbose('Redis not connected, skipping set operation');
                return false;
            }

            if (ttlSeconds && ttlSeconds > 0) {
                await this.client.setex(key, ttlSeconds, value);
            } else {
                await this.client.set(key, value);
            }

            return true;
        } catch (error) {
            this.logger.warn(
                `Redis SET failed for key "${key}": ${(error as Error).message}`,
            );
            return false; // Graceful degradation
        }
    }

    /**
     * Delete a key from Redis cache
     */
    async delete(key: string): Promise<boolean> {
        try {
            if (!this.isConnected) {
                this.logger.verbose('Redis not connected, skipping delete operation');
                return false;
            }

            await this.client.del(key);
            return true;
        } catch (error) {
            this.logger.warn(
                `Redis DELETE failed for key "${key}": ${(error as Error).message}`,
            );
            return false; // Graceful degradation
        }
    }

    async onModuleDestroy() {
        try {
            await this.client.quit();
            this.logger.log('Redis connection closed gracefully');
        } catch (error) {
            this.logger.error(
                `Error closing Redis connection: ${(error as Error).message}`,
            );
        }
    }

    /**
     * Get a counter value from Redis
     * Returns null if key doesn't exist or Redis is unavailable
     */
    async getCounter(key: string): Promise<number | null> {
        try {
            if (!this.isConnected) {
                this.logger.verbose('Redis not connected, skipping getCounter operation');
                return null;
            }

            const value = await this.client.get(key);
            return value ? parseInt(value, 10) : null;
        } catch (error) {
            this.logger.warn(
                `Redis GET COUNTER failed for key "${key}": ${(error as Error).message}`,
            );
            return null; // Graceful degradation
        }
    }

    /**
     * Increment a counter in Redis (Atomic operation)
     * @param key Cache key
     * @param ttlSeconds Optional TTL to set if the key is created new
     * @returns The new value of the counter, or null if operation failed
     */
    async incr(key: string, ttlSeconds?: number): Promise<number | null> {
        try {
            if (!this.isConnected) {
                this.logger.verbose('Redis not connected, skipping incr operation');
                return null;
            }

            const newValue = await this.client.incr(key);

            // If TTL is specified and this might be a new key (or we just want to ensure TTL)
            // Note: INCR doesn't reset TTL, but if it was just created, it has -1 (persistent).
            // We only set TTL if provided.
            if (ttlSeconds && ttlSeconds > 0) {
                // Check if we need to set TTL (optimization: maybe only if newValue === 1?)
                // For now, let's just set expire if provided to be safe/consistent
                await this.client.expire(key, ttlSeconds);
            }

            return newValue;
        } catch (error) {
            this.logger.warn(
                `Redis INCR failed for key "${key}": ${(error as Error).message}`,
            );
            return null; // Graceful degradation
        }
    }
}
