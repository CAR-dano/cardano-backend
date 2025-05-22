/*
 * --------------------------------------------------------------------------
 * File: openapi-spec.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Defines the OpenAPI specification document for the CAR-dano API Gateway.
 * This document describes the available API endpoints, their parameters,
 * responses, and security schemes.
 * --------------------------------------------------------------------------
 */

export const openApiDocument = {
  openapi: '3.0.0',
  info: {
    title: 'CAR-dano API Gateway',
    version: '1.0.0',
    description: 'Public and Developer API for CAR-dano Inspection Data',
  },
  servers: [{ url: `http://localhost:3000` }], // Adjust port if needed
  paths: {
    '/api/public/reports/{assetId}': {
      // Note the path parameter
      get: {
        summary: 'Retrieve Public Report Data by Asset ID',
        tags: ['Public Access'],
        parameters: [
          // <-- Define the path parameter
          {
            name: 'assetId', // Matches the {assetId} in the path
            in: 'path', // Specifies it's part of the path
            required: true, // Path parameters are always required
            description: 'The Asset ID of the report NFT',
            schema: {
              // Defines the data type
              type: 'string',
            },
          },
        ],
        responses: {
          // <-- Define at least one response
          '200': {
            // HTTP Status Code (as a string)
            description: 'Successful retrieval of report data', // Required description
            // You can optionally add 'content' here later to describe the response body schema
            // "content": {
            //   "application/json": {
            //     "schema": { "$ref": "#/components/schemas/ReportData" } // Example reference
            //   }
            // }
          },
          '404': {
            description: 'Report not found for the given Asset ID',
          },
        },
      },
    },
    '/api/developer/reports': {
      get: {
        summary: 'Retrieve Reports (Developer API)',
        tags: ['Developer API'],
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          // Add query parameters if needed for filtering/pagination
          // Example Query Parameter:
          // {
          //   name: 'limit',
          //   in: 'query',
          //   required: false,
          //   description: 'Maximum number of reports to return',
          //   schema: { type: 'integer', default: 10 }
          // }
        ],
        responses: {
          // <-- Define at least one response
          '200': {
            description: 'Successful retrieval of reports list',
            // Optionally add content schema for the list
          },
          '401': {
            description: 'Unauthorized - Invalid or missing API Key',
          },
        },
      },
    },
    '/dashboard/main-stats': {
      get: {
        summary: 'Get Main Order Statistics',
        tags: ['Dashboard Admin'],
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          {
            name: 'period',
            in: 'query',
            required: false,
            description:
              'Time period for statistics (e.g., DAY, WEEK, MONTH, YEAR)',
            schema: { type: 'string', enum: ['DAY', 'WEEK', 'MONTH', 'YEAR'] },
          },
          {
            name: 'startDate',
            in: 'query',
            required: false,
            description: 'Start date for custom period (YYYY-MM-DD)',
            schema: { type: 'string', format: 'date' },
          },
          {
            name: 'endDate',
            in: 'query',
            required: false,
            description: 'End date for custom period (YYYY-MM-DD)',
            schema: { type: 'string', format: 'date' },
          },
          {
            name: 'branch',
            in: 'query',
            required: false,
            description: 'Filter by branch name',
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Main order statistics successfully retrieved.',
            content: {
              'application/json': {
                example: {
                  totalOrders: 1500,
                  needReview: 50,
                  approved: 1200,
                  cancelled: 100,
                  archived: 800,
                  failArchive: 20,
                  deactivated: 30,
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized - Invalid or missing API Key',
          },
        },
      },
    },
    '/dashboard/order-trend': {
      get: {
        summary: 'Get Order Trend Data',
        tags: ['Dashboard Admin'],
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          {
            name: 'period',
            in: 'query',
            required: false,
            description:
              'Time period for trend data (e.g., DAY, WEEK, MONTH, YEAR)',
            schema: { type: 'string', enum: ['DAY', 'WEEK', 'MONTH', 'YEAR'] },
          },
          {
            name: 'startDate',
            in: 'query',
            required: false,
            description: 'Start date for custom period (YYYY-MM-DD)',
            schema: { type: 'string', format: 'date' },
          },
          {
            name: 'endDate',
            in: 'query',
            required: false,
            description: 'End date for custom period (YYYY-MM-DD)',
            schema: { type: 'string', format: 'date' },
          },
          {
            name: 'branch',
            in: 'query',
            required: false,
            description: 'Filter by branch name',
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Order trend data successfully retrieved.',
            content: {
              'application/json': {
                example: [
                  { date: '2023-01', count: 120 },
                  { date: '2023-02', count: 150 },
                  { date: '2023-03', count: 130 },
                ],
              },
            },
          },
          '401': {
            description: 'Unauthorized - Invalid or missing API Key',
          },
        },
      },
    },
    '/dashboard/branch-distribution': {
      get: {
        summary: 'Get Order Distribution by Branch',
        tags: ['Dashboard Admin'],
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          {
            name: 'period',
            in: 'query',
            required: false,
            description:
              'Time period for distribution data (e.g., DAY, WEEK, MONTH, YEAR)',
            schema: { type: 'string', enum: ['DAY', 'WEEK', 'MONTH', 'YEAR'] },
          },
          {
            name: 'startDate',
            in: 'query',
            required: false,
            description: 'Start date for custom period (YYYY-MM-DD)',
            schema: { type: 'string', format: 'date' },
          },
          {
            name: 'endDate',
            in: 'query',
            required: false,
            description: 'End date for custom period (YYYY-MM-DD)',
            schema: { type: 'string', format: 'date' },
          },
        ],
        responses: {
          '200': {
            description: 'Order distribution by branch successfully retrieved.',
            content: {
              'application/json': {
                example: [
                  {
                    branch: 'Yogyakarta',
                    count: 500,
                    percentage: '33.3%',
                    change: '+5%',
                  },
                  {
                    branch: 'Semarang',
                    count: 400,
                    percentage: '26.7%',
                    change: '-2%',
                  },
                  {
                    branch: 'Solo',
                    count: 300,
                    percentage: '20.0%',
                    change: '+10%',
                  },
                  {
                    branch: 'Others',
                    count: 300,
                    percentage: '20.0%',
                    change: '0%',
                  },
                ],
              },
            },
          },
          '401': {
            description: 'Unauthorized - Invalid or missing API Key',
          },
        },
      },
    },
    '/dashboard/inspector-performance': {
      get: {
        summary: 'Get Inspector Performance',
        tags: ['Dashboard Admin'],
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          {
            name: 'period',
            in: 'query',
            required: false,
            description:
              'Time period for performance data (e.g., DAY, WEEK, MONTH, YEAR)',
            schema: { type: 'string', enum: ['DAY', 'WEEK', 'MONTH', 'YEAR'] },
          },
          {
            name: 'startDate',
            in: 'query',
            required: false,
            description: 'Start date for custom period (YYYY-MM-DD)',
            schema: { type: 'string', format: 'date' },
          },
          {
            name: 'endDate',
            in: 'query',
            required: false,
            description: 'End date for custom period (YYYY-MM-DD)',
            schema: { type: 'string', format: 'date' },
          },
        ],
        responses: {
          '200': {
            description: 'Inspector performance successfully retrieved.',
            content: {
              'application/json': {
                example: [
                  { inspector: 'Budi Santoso', inspections: 80 },
                  { inspector: 'Ani Rahayu', inspections: 75 },
                  { inspector: 'Candra Wijaya', inspections: 60 },
                ],
              },
            },
          },
          '401': {
            description: 'Unauthorized - Invalid or missing API Key',
          },
        },
      },
    },
    '/dashboard/overall-value-distribution': {
      get: {
        summary: 'Get Order Distribution by Overall Value',
        tags: ['Dashboard Admin'],
        security: [{ ApiKeyAuth: [] }],
        responses: {
          '200': {
            description:
              'Order distribution by overall value successfully retrieved.',
            content: {
              'application/json': {
                example: [
                  { range: '< 50 Juta', count: 200 },
                  { range: '50 - 100 Juta', count: 500 },
                  { range: '> 100 Juta', count: 300 },
                ],
              },
            },
          },
          '401': {
            description: 'Unauthorized - Invalid or missing API Key',
          },
        },
      },
    },
    '/dashboard/car-brand-distribution': {
      get: {
        summary: 'Get Order Distribution by Car Brand',
        tags: ['Dashboard Admin'],
        security: [{ ApiKeyAuth: [] }],
        responses: {
          '200': {
            description:
              'Order distribution by car brand successfully retrieved.',
            content: {
              'application/json': {
                example: [
                  { brand: 'Toyota', count: 400 },
                  { brand: 'Honda', count: 350 },
                  { brand: 'Mitsubishi', count: 200 },
                  { brand: 'Suzuki', count: 150 },
                ],
              },
            },
          },
          '401': {
            description: 'Unauthorized - Invalid or missing API Key',
          },
        },
      },
    },
    '/dashboard/production-year-distribution': {
      get: {
        summary: 'Get Order Distribution by Car Production Year',
        tags: ['Dashboard Admin'],
        security: [{ ApiKeyAuth: [] }],
        responses: {
          '200': {
            description:
              'Order distribution by car production year successfully retrieved.',
            content: {
              'application/json': {
                example: [
                  { year: 2020, count: 250 },
                  { year: 2021, count: 300 },
                  { year: 2022, count: 400 },
                  { year: 2023, count: 350 },
                ],
              },
            },
          },
          '401': {
            description: 'Unauthorized - Invalid or missing API Key',
          },
        },
      },
    },
    '/dashboard/transmission-type-distribution': {
      get: {
        summary: 'Get Order Distribution by Car Transmission Type',
        tags: ['Dashboard Admin'],
        security: [{ ApiKeyAuth: [] }],
        responses: {
          '200': {
            description:
              'Order distribution by car transmission type successfully retrieved.',
            content: {
              'application/json': {
                example: [
                  { type: 'Manual', count: 600 },
                  { type: 'Otomatis', count: 900 },
                ],
              },
            },
          },
          '401': {
            description: 'Unauthorized - Invalid or missing API Key',
          },
        },
      },
    },
    '/dashboard/blockchain-status': {
      get: {
        summary: 'Get Order Count by Blockchain Status',
        tags: ['Dashboard Admin'],
        security: [{ ApiKeyAuth: [] }],
        responses: {
          '200': {
            description:
              'Order count by blockchain status successfully retrieved.',
            content: {
              'application/json': {
                example: {
                  mintedToBlockchain: 800,
                  pendingMint: 50,
                  failedMint: 10,
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized - Invalid or missing API Key',
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-KEY',
      },
    },
    // You might add schemas here later for response bodies:
    // schemas: {
    //   ReportData: { /* ... define your report data structure ... */ }
    // }
  },
};
