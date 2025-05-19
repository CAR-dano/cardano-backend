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
