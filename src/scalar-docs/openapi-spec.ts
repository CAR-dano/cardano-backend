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
  servers: [{ url: `http://localhost:3010` }], // Adjust port if needed
  paths: {
    '/api/v1/auth/register': {
      post: {
        operationId: 'AuthController_registerLocal',
        parameters: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RegisterUserDto',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'User successfully registered.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UserResponseDto',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input data.',
          },
          '409': {
            description: 'Email or Username already exists.',
          },
        },
        summary: 'Register a new user locally',
        tags: ['Auth (UI Users)'],
      },
    },
    '/api/v1/auth/login': {
      post: {
        operationId: 'AuthController_loginLocal',
        parameters: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/LoginUserDto',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful, JWT returned.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/LoginResponseDto',
                },
              },
            },
          },
          '401': {
            description: 'Invalid credentials.',
          },
        },
        summary: 'Login with local credentials (email/username + password)',
        tags: ['Auth (UI Users)'],
      },
    },
    '/api/v1/auth/google': {
      get: {
        operationId: 'AuthController_googleAuth',
        parameters: [],
        responses: {
          '302': {
            description: 'Redirecting to Google.',
          },
        },
        summary: 'Initiate Google OAuth login',
        tags: ['Auth (UI Users)'],
      },
    },
    '/api/v1/auth/logout': {
      post: {
        operationId: 'AuthController_logout',
        parameters: [],
        responses: {
          '200': {
            description: 'Logout successful (client should clear token).',
          },
          '401': {
            description: 'Unauthorized.',
          },
        },
        security: [
          {
            JwtAuthGuard: [],
          },
        ],
        summary: 'Logout user',
        tags: ['Auth (UI Users)'],
      },
    },
    '/api/v1/auth/profile': {
      get: {
        operationId: 'AuthController_getProfile',
        parameters: [],
        responses: {
          '200': {
            description: 'Returns authenticated user profile.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UserResponseDto',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized.',
          },
        },
        security: [
          {
            JwtAuthGuard: [],
          },
        ],
        summary: 'Get logged-in user profile',
        tags: ['Auth (UI Users)'],
      },
    },
    '/api/v1/auth/check-token': {
      get: {
        operationId: 'AuthController_checkTokenValidity',
        parameters: [],
        responses: {
          '200': {
            description: 'Token is valid.',
          },
          '401': {
            description: 'Unauthorized (token is invalid or expired).',
          },
        },
        security: [
          {
            JwtAuthGuard: [],
          },
        ],
        summary: 'Check if JWT token is valid',
        tags: ['Auth (UI Users)'],
      },
    },
    '/api/v1/admin/users': {
      get: {
        description:
          'Fetches a list of all user accounts in the system. This endpoint is restricted to users with the ADMIN role.',
        operationId: 'UsersController_findAll',
        parameters: [],
        responses: {
          '200': {
            description: 'List of users.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/UserResponseDto',
                  },
                },
              },
            },
          },
          '401': {
            description:
              'Unauthorized. Authentication token is missing or invalid.',
          },
          '403': {
            description:
              'Forbidden. User does not have the necessary ADMIN role.',
          },
        },
        security: [
          {
            JwtAuthGuard: [],
          },
        ],
        summary: 'Retrieve all users (Admin Only)',
        tags: ['User Management (Admin)'],
      },
    },
    '/api/v1/admin/users/inspectors': {
      get: {
        description:
          'Fetches a list of all user accounts specifically designated as inspectors.',
        operationId: 'UsersController_findAllInspectors',
        parameters: [],
        responses: {
          '200': {
            description: 'List of inspector users.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/UserResponseDto',
                  },
                },
              },
            },
          },
          '401': {
            description:
              'Unauthorized. Authentication token is missing or invalid.',
          },
        },
        security: [
          {
            JwtAuthGuard: [],
          },
        ],
        summary: 'Retrieve all inspector users',
        tags: ['User Management (Admin)'],
      },
    },
    '/api/v1/admin/users/{id}': {
      get: {
        description:
          'Fetches the details of a specific user account using their unique UUID. This endpoint is restricted to users with the ADMIN role.',
        operationId: 'UsersController_findOne',
        parameters: [
          {
            name: 'id',
            required: true,
            in: 'path',
            description: 'User UUID',
            schema: {
              format: 'uuid',
              example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'User details.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UserResponseDto',
                },
              },
            },
          },
          '401': {
            description:
              'Unauthorized. Authentication token is missing or invalid.',
          },
          '403': {
            description:
              'Forbidden. User does not have the necessary ADMIN role.',
          },
          '404': {
            description: 'User with the specified ID not found.',
          },
        },
        security: [
          {
            JwtAuthGuard: [],
          },
        ],
        summary: 'Retrieve user by ID (Admin Only)',
        tags: ['User Management (Admin)'],
      },
      put: {
        description:
          'Updates the details of an existing user account using their unique UUID. This endpoint is restricted to users with the ADMIN role.',
        operationId: 'UsersController_updateUser',
        parameters: [
          {
            name: 'id',
            required: true,
            in: 'path',
            description: 'User UUID',
            schema: {
              format: 'uuid',
              example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
              type: 'string',
            },
          },
        ],
        requestBody: {
          required: true,
          description: 'The updated user details.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateUserDto',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'User details updated.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UserResponseDto',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input data provided for the user update.',
          },
          '401': {
            description:
              'Unauthorized. Authentication token is missing or invalid.',
          },
          '403': {
            description:
              'Forbidden. User does not have the necessary ADMIN role.',
          },
          '404': {
            description: 'User with the specified ID not found.',
          },
          '409': {
            description:
              'A user with the provided email, username, or wallet address already exists.',
          },
        },
        security: [
          {
            JwtAuthGuard: [],
          },
        ],
        summary: 'Update user details (Admin Only)',
        tags: ['User Management (Admin)'],
      },
      delete: {
        description:
          'Deletes a user account using their unique UUID. This action is irreversible and restricted to users with the ADMIN role.',
        operationId: 'UsersController_deleteUser',
        parameters: [
          {
            name: 'id',
            required: true,
            in: 'path',
            description: 'User UUID',
            schema: {
              format: 'uuid',
              example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
              type: 'string',
            },
          },
        ],
        responses: {
          '204': {
            description: 'User deleted.',
          },
          '401': {
            description:
              'Unauthorized. Authentication token is missing or invalid.',
          },
          '403': {
            description:
              'Forbidden. User does not have the necessary ADMIN role.',
          },
          '404': {
            description: 'User with the specified ID not found.',
          },
        },
        security: [
          {
            JwtAuthGuard: [],
          },
        ],
        summary: 'Delete a user (Admin Only) - Use with caution!',
        tags: ['User Management (Admin)'],
      },
    },
    '/api/v1/admin/users/{id}/role': {
      put: {
        description:
          'Updates the role of a specific user account using their unique UUID. This endpoint is restricted to users with the ADMIN role.',
        operationId: 'UsersController_updateUserRole',
        parameters: [
          {
            name: 'id',
            required: true,
            in: 'path',
            description: 'User UUID',
            schema: {
              format: 'uuid',
              example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
              type: 'string',
            },
          },
        ],
        requestBody: {
          required: true,
          description: 'The new role to assign to the user.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateUserRoleDto',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'User role updated.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UserResponseDto',
                },
              },
            },
          },
          '400': {
            description: 'Invalid role provided in the request body.',
          },
          '401': {
            description:
              'Unauthorized. Authentication token is missing or invalid.',
          },
          '403': {
            description:
              'Forbidden. User does not have the necessary ADMIN role.',
          },
          '404': {
            description: 'User with the specified ID not found.',
          },
        },
        security: [
          {
            JwtAuthGuard: [],
          },
        ],
        summary: 'Update user role (Admin Only)',
        tags: ['User Management (Admin)'],
      },
    },
    '/api/v1/admin/users/{id}/disable': {
      put: {
        description:
          'Disables a user account, preventing the user from logging in. This endpoint is restricted to users with the ADMIN role.',
        operationId: 'UsersController_disableUser',
        parameters: [
          {
            name: 'id',
            required: true,
            in: 'path',
            description: 'User UUID',
            schema: {
              format: 'uuid',
              example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'User disabled.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UserResponseDto',
                },
              },
            },
          },
          '401': {
            description:
              'Unauthorized. Authentication token is missing or invalid.',
          },
          '403': {
            description:
              'Forbidden. User does not have the necessary ADMIN role.',
          },
          '404': {
            description: 'User with the specified ID not found.',
          },
        },
        security: [
          {
            JwtAuthGuard: [],
          },
        ],
        summary: 'Disable user account (Admin Only)',
        tags: ['User Management (Admin)'],
      },
    },
    '/api/v1/admin/users/{id}/enable': {
      put: {
        description:
          'Enables a disabled user account, allowing the user to log in again. This endpoint is restricted to users with the ADMIN role.',
        operationId: 'UsersController_enableUser',
        parameters: [
          {
            name: 'id',
            required: true,
            in: 'path',
            description: 'User UUID',
            schema: {
              format: 'uuid',
              example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'User enabled.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UserResponseDto',
                },
              },
            },
          },
          '401': {
            description:
              'Unauthorized. Authentication token is missing or invalid.',
          },
          '403': {
            description:
              'Forbidden. User does not have the necessary ADMIN role.',
          },
          '404': {
            description: 'User with the specified ID not found.',
          },
        },
        security: [
          {
            JwtAuthGuard: [],
          },
        ],
        summary: 'Enable user account (Admin Only)',
        tags: ['User Management (Admin)'],
      },
    },
    '/api/v1/admin/users/inspector': {
      post: {
        description:
          'Creates a new user account with the INSPECTOR role. This endpoint is restricted to users with the ADMIN role.',
        operationId: 'UsersController_createInspector',
        parameters: [],
        requestBody: {
          required: true,
          description: 'Details for the new inspector user.',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateInspectorDto',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'The inspector user has been successfully created.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UserResponseDto',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input data provided for the new inspector.',
          },
          '401': {
            description:
              'Unauthorized. Authentication token is missing or invalid.',
          },
          '403': {
            description:
              'Forbidden. User does not have the necessary ADMIN role.',
          },
          '409': {
            description:
              'A user with the provided email, username, or wallet address already exists.',
          },
        },
        security: [
          {
            JwtAuthGuard: [],
          },
        ],
        summary: 'Create a new inspector user (Admin Only)',
        tags: ['User Management (Admin)'],
      },
    },
    '/api/v1/blockchain/metadata/tx/{txHash}': {
      get: {
        description:
          'Retrieves metadata associated with a specific Cardano transaction hash from Blockfrost.',
        operationId: 'BlockchainController_getTransactionMetadata',
        parameters: [
          {
            name: 'txHash',
            required: true,
            in: 'path',
            description: 'Cardano transaction hash',
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Metadata retrieved successfully.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/TransactionMetadataResponseDto',
                  },
                },
              },
            },
          },
          '400': {
            description: 'Bad Request (Missing txHash).',
          },
          '404': {
            description: 'Transaction or metadata not found.',
          },
          '500': {
            description: 'Failed to fetch metadata from Blockfrost.',
          },
        },
        summary: 'Get Transaction Metadata by Hash',
        tags: ['Blockchain Operations'],
      },
    },
    '/api/v1/blockchain/nft/{assetId}': {
      get: {
        description:
          'Retrieves details and on-chain metadata for a specific Cardano asset (NFT) from Blockfrost.',
        operationId: 'BlockchainController_getNftData',
        parameters: [
          {
            name: 'assetId',
            required: true,
            in: 'path',
            description: 'Full Cardano Asset ID (PolicyID + HexAssetName)',
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Asset data retrieved successfully.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/NftDataResponseDto',
                },
              },
            },
          },
          '400': {
            description: 'Bad Request (Missing assetId).',
          },
          '404': {
            description: 'Asset not found.',
          },
          '500': {
            description: 'Failed to fetch asset data from Blockfrost.',
          },
        },
        summary: 'Get NFT Data by Asset ID',
        tags: ['Blockchain Operations'],
      },
    },
    '/api/v1/inspections': {
      post: {
        description:
          'Creates the initial inspection record containing text and JSON data. This is the first step before uploading photos or archiving.',
        operationId: 'InspectionsController_create',
        parameters: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateInspectionDto',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'The newly created inspection record summary.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/InspectionResponseDto',
                },
              },
            },
          },
          '400': {
            description: 'Bad Request (e.g., invalid input data).',
          },
        },
        summary: 'Create a new inspection record',
        tags: ['Inspection Data'],
      },
      get: {
        description:
          'Retrieves all inspection records with pagination and metadata, potentially filtered by role (passed via query parameter).',
        operationId: 'InspectionsController_findAll',
        parameters: [
          {
            name: 'role',
            required: false,
            in: 'query',
            description: 'Filter inspections by user role.',
            schema: {
              enum: ['ADMIN', 'REVIEWER', 'INSPECTOR', 'CUSTOMER', 'DEVELOPER'],
              type: 'string',
            },
          },
          {
            name: 'pageSize',
            required: false,
            in: 'query',
            description: 'Number of items per page. Defaults to 10.',
            schema: {
              type: 'number',
            },
          },
          {
            name: 'page',
            required: false,
            in: 'query',
            description: 'Page number (1-based). Defaults to 1.',
            schema: {
              type: 'number',
            },
          },
          {
            name: 'status',
            required: false,
            in: 'query',
            description:
              'Filter inspections by inspection status (can be multiple).',
            schema: {
              type: 'array',
              items: {},
            },
          },
        ],
        responses: {
          '200': {
            description:
              'Paginated list of inspection record summaries with metadata.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/InspectionResponseDto',
                      },
                    },
                    meta: {
                      type: 'object',
                      properties: {
                        total: {
                          type: 'number',
                        },
                        page: {
                          type: 'number',
                        },
                        pageSize: {
                          type: 'number',
                        },
                        totalPages: {
                          type: 'number',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'User is not authenticated.',
          },
          '403': {
            description: 'User does not have the required permissions.',
          },
        },
        security: [
          {
            bearer: [],
          },
        ],
        summary: 'Retrieve all inspection records with pagination',
        tags: ['Inspection Data'],
      },
    },
    '/api/v1/inspections/{id}': {
      put: {
        description:
          'Partially updates the text/JSON data fields of an existing inspection. Does not handle photo updates.',
        operationId: 'InspectionsController_update',
        parameters: [
          {
            name: 'id',
            required: true,
            in: 'path',
            description: 'The UUID of the inspection to update.',
            schema: {
              format: 'uuid',
              type: 'string',
            },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateInspectionDto',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Message indicating changes have been logged.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Bad Request (e.g., invalid input data).',
          },
          '401': {
            description: 'User is not authenticated.',
          },
          '403': {
            description: 'User does not have the required permissions.',
          },
          '404': {
            description: 'Inspection not found.',
          },
        },
        security: [
          {
            bearer: [],
          },
        ],
        summary: 'Update an existing inspection record',
        tags: ['Inspection Data'],
      },
      get: {
        description:
          'Retrieves a specific inspection by ID, applying role-based visibility rules.',
        operationId: 'InspectionsController_findOne',
        parameters: [
          {
            name: 'id',
            required: true,
            in: 'path',
            description: 'The UUID of the inspection to retrieve.',
            schema: {
              format: 'uuid',
              type: 'string',
            },
          },
          {
            name: 'role',
            required: false,
            in: 'query',
            description: 'Filter inspection visibility by user role.',
            schema: {
              enum: ['ADMIN', 'REVIEWER', 'INSPECTOR', 'CUSTOMER', 'DEVELOPER'],
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'The inspection record summary.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/InspectionResponseDto',
                },
              },
            },
          },
          '401': {
            description: 'User is not authenticated.',
          },
          '403': {
            description: 'User does not have the required permissions.',
          },
          '404': {
            description: 'Inspection not found.',
          },
        },
        security: [
          {
            bearer: [],
          },
        ],
        summary: 'Retrieve a specific inspection by ID',
        tags: ['Inspection Data'],
      },
    },
    '/api/v1/inspections/{id}/photos/multiple': {
      post: {
        description:
          'Uploads a batch of photos for an inspection. Expects multipart/form-data with "metadata" (JSON string array) and "photos" (files).',
        operationId: 'InspectionsController_addMultiplePhotos',
        parameters: [
          {
            name: 'id',
            required: true,
            in: 'path',
            description: 'Inspection ID',
            schema: {
              format: 'uuid',
              type: 'string',
            },
          },
        ],
        requestBody: {
          required: true,
          description: 'Metadata and photo files for the batch upload.',
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  metadata: {
                    type: 'string',
                    description:
                      'JSON string array of metadata for each photo (e.g., [{"label": "damage", "needAttention": true}]). Must match the order of uploaded files.',
                  },
                  photos: {
                    type: 'array',
                    items: {
                      type: 'string',
                      format: 'binary',
                    },
                    description:
                      'Array of image files (jpg, jpeg, png, gif). Max 10 files per request.',
                  },
                },
                required: ['metadata', 'photos'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Array of created photo record summaries.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/PhotoResponseDto',
                  },
                },
              },
            },
          },
          '400': {
            description:
              'Bad Request (e.g., invalid input, no files provided, invalid file type).',
          },
          '404': {
            description: 'Inspection not found.',
          },
        },
        summary: 'Upload a batch of photos for an inspection',
        tags: ['Inspection Data'],
      },
    },
    '/api/v1/inspections/{id}/photos/single': {
      post: {
        description:
          'Uploads a single photo for an inspection. Expects multipart/form-data with "label" (string) and optionally "needAttention" (string "true" or "false") and "photo" (file).',
        operationId: 'InspectionsController_addSinglePhoto',
        parameters: [
          {
            name: 'id',
            required: true,
            in: 'path',
            description: 'Inspection ID',
            schema: {
              format: 'uuid',
              type: 'string',
            },
          },
        ],
        requestBody: {
          required: true,
          description:
            'Metadata (label, needAttention) and photo file for the upload.',
          content: {
            'multipart/form-data': {
              schema: {
                $ref: '#/components/schemas/AddSinglePhotoDto',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'The created photo record summary.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/PhotoResponseDto',
                },
              },
            },
          },
          '400': {
            description:
              'Bad Request (e.g., invalid input, no file provided, invalid file type).',
          },
          '404': {
            description: 'Inspection not found.',
          },
        },
        summary: 'Upload a single photo for an inspection',
        tags: ['Inspection Data'],
      },
    },
    '/api/v1/inspections/{id}/photos': {
      get: {
        description:
          'Retrieves all photo records associated with a specific inspection.',
        operationId: 'InspectionsController_getPhotosForInspection',
        parameters: [
          {
            name: 'id',
            required: true,
            in: 'path',
            description: 'Inspection ID',
            schema: {
              format: 'uuid',
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Array of photo record summaries.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/PhotoResponseDto',
                  },
                },
              },
            },
          },
          '401': {
            description: 'User is not authenticated.',
          },
          '403': {
            description: 'User does not have the required permissions.',
          },
          '404': {
            description: 'Inspection not found.',
          },
        },
        security: [
          {
            bearer: [],
          },
        ],
        summary: 'Retrieve all photos for an inspection',
        tags: ['Inspection Data'],
      },
    },
    '/api/v1/inspections/{id}/photos/{photoId}': {
      put: {
        description:
          "Updates a specific photo's metadata (label, needAttention) and/or replaces its file. Expects multipart/form-data. File and metadata fields are optional.",
        operationId: 'InspectionsController_updatePhoto',
        parameters: [
          {
            name: 'id',
            required: true,
            in: 'path',
            description: 'Inspection ID',
            schema: {
              format: 'uuid',
              type: 'string',
            },
          },
          {
            name: 'photoId',
            required: true,
            in: 'path',
            description: 'Photo ID',
            schema: {
              format: 'uuid',
              type: 'string',
            },
          },
        ],
        requestBody: {
          required: true,
          description:
            'Optional metadata updates (label, needAttention) and/or a new photo file.',
          content: {
            'multipart/form-data': {
              schema: {
                $ref: '#/components/schemas/UpdatePhotoDto',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'The updated photo record summary.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/PhotoResponseDto',
                },
              },
            },
          },
          '400': {
            description:
              'Bad Request (e.g., invalid input, invalid file type).',
          },
          '401': {
            description: 'User is not authenticated.',
          },
          '403': {
            description: 'User does not have the required permissions.',
          },
          '404': {
            description: 'Inspection or Photo not found.',
          },
        },
        security: [
          {
            bearer: [],
          },
        ],
        summary: 'Update a specific photo',
        tags: ['Inspection Data'],
      },
      delete: {
        description:
          'Deletes a specific photo record and its associated file (if stored locally).',
        operationId: 'InspectionsController_deletePhoto',
        parameters: [
          {
            name: 'id',
            required: true,
            in: 'path',
            description: 'Inspection ID (for path consistency)',
            schema: {
              format: 'uuid',
              type: 'string',
            },
          },
          {
            name: 'photoId',
            required: true,
            in: 'path',
            description: 'Photo ID',
            schema: {
              format: 'uuid',
              type: 'string',
            },
          },
        ],
        responses: {
          '204': {
            description: 'Photo deleted successfully (No Content).',
          },
          '401': {
            description: 'User is not authenticated.',
          },
          '403': {
            description: 'User does not have the required permissions.',
          },
          '404': {
            description: 'Photo not found.',
          },
        },
        security: [
          {
            bearer: [],
          },
        ],
        summary: 'Delete a specific photo',
        tags: ['Inspection Data'],
      },
    },
    '/api/v1/inspections/search': {
      get: {
        description:
          'Retrieves a single inspection by vehicle plate number (case-insensitive, space-agnostic).',
        operationId: 'InspectionsController_searchByVehicleNumber',
        parameters: [
          {
            name: 'vehicleNumber',
            required: true,
            in: 'query',
            description:
              'The vehicle plate number to search for (e.g., "AB 1234 CD").',
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'The found inspection record summary.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/InspectionResponseDto',
                },
              },
            },
          },
          '404': {
            description: 'Inspection not found.',
          },
        },
        summary: 'Search for an inspection by vehicle plate number',
        tags: ['Inspection Data'],
      },
    },
    '/api/v1/inspections/{id}/approve': {
      patch: {
        description:
          'Approves a submitted inspection. Requires Reviewer/Admin role (to be enforced later).',
        operationId: 'InspectionsController_approveInspection',
        parameters: [
          {
            name: 'id',
            required: true,
            in: 'path',
            description: 'Inspection ID',
            schema: {
              format: 'uuid',
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'The approved inspection record summary.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/InspectionResponseDto',
                },
              },
            },
          },
          '400': {
            description:
              'Bad Request (e.g., inspection not in a state to be approved).',
          },
          '401': {
            description: 'User is not authenticated.',
          },
          '403': {
            description: 'User does not have the required permissions.',
          },
          '404': {
            description: 'Inspection not found.',
          },
        },
        security: [
          {
            bearer: [],
          },
        ],
        summary: 'Approve a submitted inspection',
        tags: ['Inspection Data'],
      },
    },
    '/api/v1/inspections/{id}/archive': {
      put: {
        description:
          'Fetches the content from the provided URL, converts it to PDF, and proceeds with the archiving process (saving, hashing, minting).',
        operationId: 'InspectionsController_processToArchive',
        parameters: [
          {
            name: 'id',
            required: true,
            in: 'path',
            description: 'Inspection ID',
            schema: {
              format: 'uuid',
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Inspection archived successfully.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/InspectionResponseDto',
                },
              },
            },
          },
          '400': {
            description:
              'Bad Request (e.g., invalid URL, inspection not approved).',
          },
          '401': {
            description: 'User is not authenticated.',
          },
          '403': {
            description: 'User does not have the required permissions.',
          },
          '404': {
            description: 'Inspection not found.',
          },
        },
        security: [
          {
            bearer: [],
          },
        ],
        summary:
          'Archive an approved inspection by providing a URL to convert to PDF',
        tags: ['Inspection Data'],
      },
    },
    '/api/v1/inspections/{id}/deactivate': {
      patch: {
        description: 'Deactivates an archived inspection. Requires Admin role.',
        operationId: 'InspectionsController_deactivateArchive',
        parameters: [
          {
            name: 'id',
            required: true,
            in: 'path',
            description: 'Inspection ID',
            schema: {
              format: 'uuid',
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'The deactivated inspection record summary.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/InspectionResponseDto',
                },
              },
            },
          },
          '400': {
            description:
              'Bad Request (e.g., inspection not in a state to be deactivated).',
          },
          '401': {
            description: 'User is not authenticated.',
          },
          '403': {
            description: 'User does not have the required permissions.',
          },
          '404': {
            description: 'Inspection not found.',
          },
        },
        security: [
          {
            bearer: [],
          },
        ],
        summary: 'Deactivate an archived inspection',
        tags: ['Inspection Data'],
      },
    },
    '/api/v1/inspections/{id}/activate': {
      patch: {
        description:
          'Reactivates a deactivated inspection. Requires Admin role.',
        operationId: 'InspectionsController_activateArchive',
        parameters: [
          {
            name: 'id',
            required: true,
            in: 'path',
            description: 'Inspection ID',
            schema: {
              format: 'uuid',
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'The activated inspection record summary.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/InspectionResponseDto',
                },
              },
            },
          },
          '400': {
            description:
              'Bad Request (e.g., inspection not in a state to be activated).',
          },
          '401': {
            description: 'User is not authenticated.',
          },
          '403': {
            description: 'User does not have the required permissions.',
          },
          '404': {
            description: 'Inspection not found.',
          },
        },
        security: [
          {
            bearer: [],
          },
        ],
        summary: 'Activate a deactivated inspection',
        tags: ['Inspection Data'],
      },
    },
    '/api/v1/inspections/export/csv': {
      get: {
        description:
          'Retrieves all inspection data and exports it as a CSV file, excluding photo data.',
        operationId: 'InspectionsController_exportCsv',
        parameters: [],
        responses: {
          '200': {
            description:
              'A CSV file containing all inspection data is downloaded.',
            content: {
              'text/csv': {
                schema: {
                  type: 'string',
                  example:
                    'id,pretty_id,vehiclePlateNumber,inspectionDate,overallRating,status,...\n...',
                },
              },
            },
          },
          '401': {
            description: 'User is not authenticated.',
          },
          '403': {
            description: 'User does not have the required permissions.',
          },
          '500': {
            description:
              'Internal Server Error (e.g., failed to generate CSV).',
          },
        },
        security: [
          {
            bearer: [],
          },
        ],
        summary: 'Export all inspection data to CSV',
        tags: ['Inspection Data'],
      },
    },
    '/api/v1/inspections/{inspectionId}/changelog': {
      get: {
        description:
          'Retrieves the change log entries for a specific inspection.',
        operationId: 'InspectionChangeLogController_findByInspectionId',
        parameters: [
          {
            name: 'inspectionId',
            required: true,
            in: 'path',
            description: 'The ID of the inspection',
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Successfully retrieved inspection change log.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/InspectionChangeLogResponseDto',
                  },
                },
              },
            },
          },
          '401': {
            description: 'User is not authenticated.',
          },
          '403': {
            description: 'User does not have the required permissions.',
          },
          '404': {
            description: 'Inspection not found.',
          },
        },
        security: [
          {
            bearer: [],
          },
        ],
        summary: 'Get inspection change log',
        tags: ['Inspection Change Log'],
      },
    },
    '/api/v1/public/users/inspectors': {
      get: {
        description:
          'Fetches a list of all user accounts specifically designated as inspectors. This endpoint is publicly accessible.',
        operationId: 'PublicUsersController_findAllInspectors',
        parameters: [],
        responses: {
          '200': {
            description: 'List of inspector users.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/UserResponseDto',
                  },
                },
              },
            },
          },
        },
        summary: 'Retrieve all inspector users (Public)',
        tags: ['Public Users'],
      },
    },
    '/api/v1/openapi.json': {
      get: {
        operationId: 'ScalarDocsController_getOpenApiSpec',
        parameters: [],
        responses: {
          '200': {
            description: '',
          },
        },
        tags: ['ScalarDocs'],
      },
    },
    '/api/v1/docs': {
      get: {
        operationId: 'ScalarDocsController_getScalarDocs',
        parameters: [],
        responses: {
          '200': {
            description: '',
          },
        },
        tags: ['ScalarDocs'],
      },
    },
    '/api/v1/inspection-branches': {
      post: {
        operationId: 'InspectionBranchesController_create',
        parameters: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateInspectionBranchCityDto',
              },
            },
          },
        },
        responses: {
          '201': {
            description:
              'The inspection branch city has been successfully created.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/InspectionBranchCityResponseDto',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input data.',
          },
          '401': {
            description: 'User is not authenticated.',
          },
          '403': {
            description: 'User does not have the required permissions.',
          },
        },
        security: [
          {
            bearer: [],
          },
        ],
        summary: 'Create a new inspection branch city',
        tags: ['Inspection Branches'],
      },
      get: {
        operationId: 'InspectionBranchesController_findAll',
        parameters: [],
        responses: {
          '200': {
            description: 'List of all inspection branch cities.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/InspectionBranchCityResponseDto',
                  },
                },
              },
            },
          },
        },
        summary: 'Get all inspection branch cities',
        tags: ['Inspection Branches'],
      },
    },
    '/api/v1/inspection-branches/{id}': {
      get: {
        operationId: 'InspectionBranchesController_findOne',
        parameters: [
          {
            name: 'id',
            required: true,
            in: 'path',
            description: 'Inspection branch city ID',
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'The inspection branch city details.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/InspectionBranchCityResponseDto',
                },
              },
            },
          },
          '404': {
            description: 'Inspection branch city not found.',
          },
        },
        summary: 'Get an inspection branch city by ID',
        tags: ['Inspection Branches'],
      },
      put: {
        operationId: 'InspectionBranchesController_update',
        parameters: [
          {
            name: 'id',
            required: true,
            in: 'path',
            description: 'Inspection branch city ID',
            schema: {
              type: 'string',
            },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateInspectionBranchCityDto',
              },
            },
          },
        },
        responses: {
          '200': {
            description:
              'The inspection branch city has been successfully updated.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/InspectionBranchCityResponseDto',
                },
              },
            },
          },
          '400': {
            description: 'Invalid input data.',
          },
          '401': {
            description: 'User is not authenticated.',
          },
          '403': {
            description: 'User does not have the required permissions.',
          },
          '404': {
            description: 'Inspection branch city not found.',
          },
        },
        security: [
          {
            bearer: [],
          },
        ],
        summary: 'Update an inspection branch city by ID',
        tags: ['Inspection Branches'],
      },
      delete: {
        operationId: 'InspectionBranchesController_remove',
        parameters: [
          {
            name: 'id',
            required: true,
            in: 'path',
            description: 'Inspection branch city ID',
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description:
              'The inspection branch city has been successfully deleted.',
          },
          '401': {
            description: 'User is not authenticated.',
          },
          '403': {
            description: 'User does not have the required permissions.',
          },
          '404': {
            description: 'Inspection branch city not found.',
          },
        },
        security: [
          {
            bearer: [],
          },
        ],
        summary: 'Delete an inspection branch city by ID',
        tags: ['Inspection Branches'],
      },
    },
    '/api/v1/dashboard/target': {
      post: {
        operationId: 'DashboardController_setInspectionTarget',
        parameters: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SetInspectionTargetDto',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Inspection target successfully set.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/InspectionTargetDto',
                },
              },
            },
          },
        },
        security: [
          {
            bearer: [],
          },
        ],
        summary: 'Set inspection target for a period',
        tags: ['Dashboard Admin'],
      },
    },
    '/api/v1/dashboard/target-stats': {
      get: {
        operationId: 'DashboardController_getInspectionTargetStats',
        parameters: [],
        responses: {
          '200': {
            description: 'Inspection target statistics successfully retrieved.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/InspectionTargetStatsResponseDto',
                },
              },
            },
          },
        },
        security: [
          {
            bearer: [],
          },
        ],
        summary: 'Get inspection target statistics',
        tags: ['Dashboard Admin'],
      },
    },
    '/api/v1/dashboard/main-stats': {
      get: {
        operationId: 'DashboardController_getMainStats',
        parameters: [
          {
            name: 'period',
            required: false,
            in: 'query',
            description: 'Time period for the statistics',
            schema: {
              example: 'month',
              type: 'string',
              enum: ['year', 'month', 'week', 'day', 'all_time'],
            },
          },
          {
            name: 'startDate',
            required: false,
            in: 'query',
            description: 'Start date for the statistics (YYYY-MM-DD)',
            schema: {
              example: '2023-01-01',
              type: 'string',
            },
          },
          {
            name: 'endDate',
            required: false,
            in: 'query',
            description: 'End date for the statistics (YYYY-MM-DD)',
            schema: {
              example: '2023-01-31',
              type: 'string',
            },
          },
          {
            name: 'branch',
            required: false,
            in: 'query',
            description: 'For filtering by specific branch',
            schema: {
              example: 'Main Branch',
              type: 'string',
            },
          },
          {
            name: 'year',
            required: false,
            in: 'query',
            description: 'Year for the statistics (e.g., 2023)',
            schema: {
              example: 2023,
              type: 'number',
            },
          },
          {
            name: 'month',
            required: false,
            in: 'query',
            description: 'Month for the statistics (1-12, e.g., 1 for January)',
            schema: {
              example: 1,
              type: 'number',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Main order statistics successfully retrieved.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MainStatsResponseDto',
                },
              },
            },
          },
        },
        security: [
          {
            bearer: [],
          },
        ],
        summary: 'Get main order statistics',
        tags: ['Dashboard Admin'],
      },
    },
    '/api/v1/dashboard/order-trend': {
      get: {
        operationId: 'DashboardController_getOrderTrend',
        parameters: [
          {
            name: 'range_type',
            required: true,
            in: 'query',
            description: 'Type of date range for order trend data.',
            schema: {
              example: 'last_7_days',
              type: 'string',
              enum: [
                'today',
                'last_7_days',
                'last_30_days',
                'month_to_date',
                'last_12_months',
                'year_to_date',
                'last_3_years',
                'custom',
              ],
            },
          },
          {
            name: 'start_date',
            required: false,
            in: 'query',
            description:
              'Start date for custom range (YYYY-MM-DD). Required if range_type is custom.',
            schema: {
              example: '2024-01-01',
              type: 'string',
            },
          },
          {
            name: 'end_date',
            required: false,
            in: 'query',
            description:
              'End date for custom range (YYYY-MM-DD). Required if range_type is custom.',
            schema: {
              example: '2024-01-31',
              type: 'string',
            },
          },
          {
            name: 'timezone',
            required: false,
            in: 'query',
            description:
              'Timezone for date calculations (e.g., "Asia/Jakarta"). Defaults to "Asia/Jakarta".',
            schema: {
              example: 'Asia/Jakarta',
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Order trend data successfully retrieved.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/OrderTrendResponseDto',
                },
              },
            },
          },
        },
        security: [
          {
            bearer: [],
          },
        ],
        summary: 'Get order trend data',
        tags: ['Dashboard Admin'],
      },
    },
    '/api/v1/dashboard/branch-distribution': {
      get: {
        operationId: 'DashboardController_getBranchDistribution',
        parameters: [
          {
            name: 'period',
            required: false,
            in: 'query',
            description: 'Time period for the statistics',
            schema: {
              example: 'month',
              type: 'string',
              enum: ['year', 'month', 'week', 'day', 'all_time'],
            },
          },
          {
            name: 'startDate',
            required: false,
            in: 'query',
            description: 'Start date for the statistics (YYYY-MM-DD)',
            schema: {
              example: '2023-01-01',
              type: 'string',
            },
          },
          {
            name: 'endDate',
            required: false,
            in: 'query',
            description: 'End date for the statistics (YYYY-MM-DD)',
            schema: {
              example: '2023-01-31',
              type: 'string',
            },
          },
          {
            name: 'branch',
            required: false,
            in: 'query',
            description: 'For filtering by specific branch',
            schema: {
              example: 'Main Branch',
              type: 'string',
            },
          },
          {
            name: 'year',
            required: false,
            in: 'query',
            description: 'Year for the statistics (e.g., 2023)',
            schema: {
              example: 2023,
              type: 'number',
            },
          },
          {
            name: 'month',
            required: false,
            in: 'query',
            description: 'Month for the statistics (1-12, e.g., 1 for January)',
            schema: {
              example: 1,
              type: 'number',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Order distribution by branch successfully retrieved.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/BranchDistributionResponseDto',
                },
              },
            },
          },
        },
        security: [
          {
            bearer: [],
          },
        ],
        summary: 'Get order distribution by branch',
        tags: ['Dashboard Admin'],
      },
    },
    '/api/v1/dashboard/inspector-performance': {
      get: {
        operationId: 'DashboardController_getInspectorPerformance',
        parameters: [],
        responses: {
          '200': {
            description: 'Inspector performance successfully retrieved.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/InspectorPerformanceResponseDto',
                },
              },
            },
          },
        },
        security: [
          {
            bearer: [],
          },
        ],
        summary: 'Get inspector performance',
        tags: ['Dashboard Admin'],
      },
    },
    '/api/v1/dashboard/inspection-review-stats': {
      get: {
        operationId: 'DashboardController_getInspectionStats',
        parameters: [],
        responses: {
          '200': {
            description: 'Inspection statistics successfully retrieved.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/InspectionStatsResponseDto',
                },
              },
            },
          },
        },
        security: [
          {
            bearer: [],
          },
        ],
        summary: 'Get inspection statistics by status and time period',
        tags: ['Dashboard Admin'],
      },
    },
  },
  tags: [
    {
      name: 'Auth (UI Users)',
      description: 'Authentication for Internal Users',
    },
    {
      name: 'User Management (Admin)',
      description: 'User management operations for Admins',
    },
    {
      name: 'Inspection Data',
      description: 'Core inspection data operations',
    },
    {
      name: 'Photos',
      description: 'Inspection photo management',
    },
    {
      name: 'Blockchain Operations',
      description: 'Cardano NFT minting and data retrieval',
    },
    {
      name: 'Inspection Branches',
      description: 'Operations related to inspection branches',
    },
    {
      name: 'Inspection Change Log',
      description: 'Tracking changes to inspections',
    },
    {
      name: 'Public API',
      description: 'Endpoints for public access',
    },
    {
      name: 'Scalar Docs',
      description: 'Endpoints for Scalar documentation',
    },
    {
      name: 'Users',
      description: 'User management operations',
    },
    {
      name: 'Admin Dasboard',
      description: 'Admin dashboard operations and information',
    },
  ],
  components: {
    securitySchemes: {
      JwtAuthGuard: {
        scheme: 'bearer',
        bearerFormat: 'JWT',
        type: 'http',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
    },
    schemas: {
      RegisterUserDto: {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            description: "User's unique email address",
            example: 'newuser@example.com',
          },
          username: {
            type: 'string',
            description:
              "User's unique username (e.g., alphanumeric, 3-20 characters)",
            example: 'newuser123',
            minLength: 3,
            maxLength: 20,
            pattern: '^[a-zA-Z0-9_]+$',
          },
          password: {
            type: 'string',
            description:
              "User's password (will be hashed). Minimum 8 characters.",
            example: 'P@sswOrd123!',
            minLength: 8,
            format: 'password',
          },
          name: {
            type: 'string',
            description: "User's display name (optional)",
            example: 'John Doe',
          },
          walletAddress: {
            type: 'string',
            description: "User's primary Cardano wallet address (optional)",
            example: 'addr1qx2k8q9p5z4z...',
          },
        },
        required: ['email', 'username', 'password'],
      },
      UserResponseDto: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'User unique identifier (UUID)',
          },
          email: {
            type: 'object',
            example: 'admin@example.com',
            description: 'User email address',
            nullable: true,
          },
          username: {
            type: 'object',
            description: 'User username',
            nullable: true,
          },
          name: {
            type: 'object',
            description: 'User display name',
            nullable: true,
          },
          walletAddress: {
            type: 'object',
            description: 'User Cardano wallet address',
            nullable: true,
          },
          role: {
            type: 'string',
            enum: ['ADMIN', 'REVIEWER', 'INSPECTOR', 'CUSTOMER', 'DEVELOPER'],
            description: 'User role',
          },
          createdAt: {
            format: 'date-time',
            type: 'string',
            description: 'Timestamp of user creation',
          },
          updatedAt: {
            format: 'date-time',
            type: 'string',
            description: 'Timestamp of last user update',
          },
        },
        required: [
          'id',
          'email',
          'username',
          'name',
          'walletAddress',
          'role',
          'createdAt',
          'updatedAt',
        ],
      },
      LoginUserDto: {
        type: 'object',
        properties: {
          loginIdentifier: {
            type: 'string',
            description: "User's email address OR username",
            example: 'user@example.com',
          },
          password: {
            type: 'string',
            description: "User's password",
            example: 'P@sswOrd123!',
            format: 'password',
          },
        },
        required: ['loginIdentifier', 'password'],
      },
      LoginResponseDto: {
        type: 'object',
        properties: {
          accessToken: {
            type: 'string',
            description:
              'JWT access token for subsequent authenticated requests',
            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          },
          user: {
            description: 'Authenticated user details',
            allOf: [
              {
                $ref: '#/components/schemas/UserResponseDto',
              },
            ],
          },
        },
        required: ['accessToken', 'user'],
      },
      UpdateUserRoleDto: {
        type: 'object',
        properties: {
          role: {
            type: 'string',
            enum: ['ADMIN', 'REVIEWER', 'INSPECTOR', 'CUSTOMER', 'DEVELOPER'],
            description: 'The new role to assign to the user',
            example: 'ADMIN',
          },
        },
        required: ['role'],
      },
      CreateInspectorDto: {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            description: 'Email address of the inspector (must be unique)',
            example: 'inspector.john.doe@example.com',
          },
          username: {
            type: 'string',
            description: 'Username for the inspector (must be unique)',
            example: 'inspector_johndoe',
          },
          name: {
            type: 'string',
            description: 'Full name of the inspector',
            example: 'John Doe',
          },
          walletAddress: {
            type: 'string',
            description:
              'Optional Cardano wallet address for the inspector (must be unique)',
            example: 'addr1q...xyz',
          },
        },
        required: ['email', 'username', 'name'],
      },
      UpdateUserDto: {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            description:
              'Optional updated email address for the user (must be unique)',
            example: 'updated.john.doe@example.com',
          },
          username: {
            type: 'string',
            description:
              'Optional updated username for the user (must be unique)',
            example: 'updated_johndoe',
          },
          name: {
            type: 'string',
            description: 'Optional updated full name of the user',
            example: 'John Doe Updated',
          },
          walletAddress: {
            type: 'string',
            description:
              'Optional updated Cardano wallet address for the user (must be unique)',
            example: 'addr1q...xyz_updated',
          },
        },
      },
      TransactionMetadataResponseDto: {
        type: 'object',
        properties: {
          label: {
            type: 'string',
            description: 'Metadata label (key) as a string (e.g., "721")',
            example: '721',
          },
          json_metadata: {
            type: 'object',
            description:
              'The JSON metadata content associated with the label. Structure varies.',
            example: {
              'a1b2c3d4...': {
                TokenNameHex: {
                  name: 'CarInspection-B123RI',
                  inspectionId: 'uuid...',
                  inspectionDate: 'YYYY-MM-DD',
                  vehicleNumber: 'XYZ123',
                  vehicleBrand: 'Toyota',
                  vehicleModel: 'Camry',
                  overallRating: 'Excellent',
                  pdfUrl: 'https://example.com/report.pdf',
                  pdfHash: 'sha256...',
                  inspectorId: 'inspector-uuid...',
                },
              },
            },
            additionalProperties: true,
            nullable: true,
          },
        },
        required: ['label', 'json_metadata'],
      },
      NftOnchainMetadataDto: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Required display name for the NFT (CIP-25).',
          },
          image: {
            type: 'object',
            description:
              "URL (often IPFS) or array of URLs pointing to the NFT's primary media.",
          },
          mediaType: {
            type: 'string',
            description: 'MIME type of the asset specified in "image".',
          },
          description: {
            type: 'object',
            description: 'Description of the NFT.',
          },
          inspectionId: {
            type: 'string',
            description: 'Original Inspection Record ID',
            format: 'uuid',
          },
          vehicleNumber: {
            type: 'string',
            description: 'Vehicle Plate Number',
          },
          inspectionDate: {
            type: 'string',
            description: 'Date of Inspection (ISO String)',
          },
          vehicleBrand: {
            type: 'string',
            description: 'Brand of the Vehicle',
          },
          vehicleModel: {
            type: 'string',
            description: 'Model of the Vehicle',
          },
          overallRating: {
            type: 'string',
            description: 'Overall Rating given',
          },
          pdfUrl: {
            type: 'string',
            description: 'URL to the off-chain PDF report',
          },
          pdfHash: {
            type: 'string',
            description: 'SHA-256 Hash of the PDF report',
          },
          inspectorId: {
            type: 'string',
            description: 'ID of the inspector user',
            format: 'uuid',
          },
        },
      },
      NftDataResponseDto: {
        type: 'object',
        properties: {
          asset: {
            type: 'string',
            description: 'Concatenated Policy ID and Hex-encoded Asset Name',
            example: 'f0f0f0...4d7941737365744e616d65',
          },
          policy_id: {
            type: 'string',
            description: 'Policy ID of the minting policy',
          },
          asset_name: {
            type: 'object',
            description: 'Hex-encoded Asset Name',
          },
          fingerprint: {
            type: 'string',
            description: 'CIP-14 asset fingerprint',
          },
          quantity: {
            type: 'string',
            description: 'Current circulating quantity (usually "1" for NFTs)',
          },
          initial_mint_tx_hash: {
            type: 'string',
            description: 'Transaction hash of the initial mint',
          },
          mint_or_burn_count: {
            type: 'number',
            description: 'Total number of mint and burn transactions',
          },
          onchain_metadata: {
            description: 'Standard on-chain metadata (CIP-25/CIP-68)',
            nullable: true,
            allOf: [
              {
                $ref: '#/components/schemas/NftOnchainMetadataDto',
              },
            ],
          },
          metadata: {
            type: 'object',
            description: 'Legacy or non-standard on-chain metadata',
            nullable: true,
            additionalProperties: true,
          },
        },
        required: [
          'asset',
          'policy_id',
          'asset_name',
          'fingerprint',
          'quantity',
          'initial_mint_tx_hash',
          'mint_or_burn_count',
        ],
      },
      IdentityDetailsDto: {
        type: 'object',
        properties: {
          namaInspektor: {
            type: 'string',
            example: 'ac5ae369-a422-426f-b01e-fad5476edda5',
            description: 'The UUID of the inspector.',
          },
          namaCustomer: {
            type: 'string',
            example: 'Maul',
            description: 'The name of the customer.',
          },
          cabangInspeksi: {
            type: 'string',
            example: 'ac5ae369-a422-426f-b01e-fad5476edda5',
            description: 'The UUID of the inspection branch city.',
          },
        },
        required: ['namaInspektor', 'namaCustomer', 'cabangInspeksi'],
      },
      CreateInspectionDto: {
        type: 'object',
        properties: {
          vehiclePlateNumber: {
            type: 'string',
            example: 'AB 1 DQ',
            description: 'The license plate number of the inspected vehicle.',
          },
          inspectionDate: {
            type: 'string',
            example: '2025-07-05T14:30:00Z',
            description:
              'The date and time when the inspection was performed. Expected as an ISO 8601 format string.',
          },
          overallRating: {
            type: 'string',
            example: '8',
            description:
              'The overall rating assigned to the vehicle based on the inspection.',
          },
          identityDetails: {
            example: {
              namaInspektor: 'ac5ae369-a422-426f-b01e-fad5476edda5',
              namaCustomer: 'Maul',
              cabangInspeksi: 'ac5ae369-a422-426f-b01e-fad5476edda5',
            },
            description:
              'Object containing details from the "Identitas" section of the inspection form, with UUIDs for inspector and branch city.',
            allOf: [
              {
                $ref: '#/components/schemas/IdentityDetailsDto',
              },
            ],
          },
          vehicleData: {
            type: 'object',
            example: {
              merekKendaraan: 'Hyundai',
              tipeKendaraan: 'Ioniq 5',
              tahun: 2023,
              transmisi: 'Automatic',
              warnaKendaraan: 'Silver',
              odometer: 15000,
              kepemilikan: 'Tangan Pertama',
              platNomor: 'AB 4332 KJ',
              pajak1Tahun: '2025-05-18T00:00:00.000',
              pajak5Tahun: '2025-05-18T00:00:00.000',
              biayaPajak: 3500000,
            },
            description:
              'Object containing details from the "Data Kendaraan" section of the inspection form.',
          },
          equipmentChecklist: {
            type: 'object',
            example: {
              bukuService: true,
              kunciSerep: false,
              bukuManual: true,
              banSerep: true,
              bpkb: true,
              dongkrak: true,
              toolkit: true,
              noRangka: true,
              noMesin: true,
            },
            description:
              'Object containing details from the "Kelengkapan" section(s) of the inspection form.',
          },
          inspectionSummary: {
            type: 'object',
            example: {
              interiorScore: 9,
              interiorNotes: 'Bersih terawat',
              eksteriorScore: 8,
              eksteriorNotes: 'Baret halus pintu kanan',
              kakiKakiScore: 10,
              kakiKakiNotes: 'Aman',
              mesinScore: 9,
              mesinNotes: 'Suara halus',
              penilaianKeseluruhanScore: 9,
              deskripsiKeseluruhan: ['Kondisi sangat baik', 'Ada baret halus'],
              indikasiTabrakan: false,
              indikasiBanjir: false,
              indikasiOdometerReset: false,
              posisiBan: 'Bridgestone',
              merkban: 'Bridgestone',
              tipeVelg: 'Original',
              ketebalanBan: '80%',
              estimasiPerbaikan: [
                {
                  namaPart: 'Tie Rod Kanan Kiri',
                  harga: 700000,
                },
                {
                  namaPart: 'Spooring',
                  harga: 300000,
                },
              ],
            },
            description:
              'Object containing details from the "Hasil Inspeksi" summary section of the form.',
          },
          detailedAssessment: {
            type: 'object',
            example: {
              testDrive: {
                bunyiGetaran: 10,
                performaStir: 9,
                perpindahanTransmisi: 10,
                stirBalance: 10,
                performaSuspensi: 9,
                performaKopling: 10,
                rpm: 10,
                catatan: 'OK',
              },
              banDanKakiKaki: {
                banDepan: 9,
                velgDepan: 10,
                discBrake: 10,
                masterRem: 10,
                tieRod: 10,
                gardan: 10,
                banBelakang: 9,
                velgBelakang: 10,
                brakePad: 9,
                crossmember: 10,
                knalpot: 10,
                balljoint: 10,
                rocksteer: 10,
                karetBoot: 10,
                upperLowerArm: 10,
                shockBreaker: 9,
                linkStabilizer: 10,
                catatan: 'OK',
              },
              hasilInspeksiEksterior: {
                bumperDepan: 8,
                kapMesin: 10,
                lampuUtama: 10,
                panelAtap: 10,
                grill: 10,
                lampuFoglamp: 10,
                kacaBening: 10,
                wiperBelakang: 10,
                bumperBelakang: 9,
                lampuBelakang: 10,
                trunklid: 10,
                kacaDepan: 10,
                fenderKanan: 10,
                quarterPanelKanan: 10,
                pintuBelakangKanan: 10,
                spionKanan: 10,
                lisplangKanan: 10,
                sideSkirtKanan: 10,
                daunWiper: 10,
                pintuBelakang: 10,
                fenderKiri: 10,
                quarterPanelKiri: 10,
                pintuDepan: 10,
                kacaJendelaKanan: 10,
                pintuBelakangKiri: 10,
                spionKiri: 10,
                pintuDepanKiri: 10,
                kacaJendelaKiri: 10,
                lisplangKiri: 10,
                sideSkirtKiri: 10,
                catatan: 'Baret halus pintu kanan',
              },
              toolsTest: {
                tebalCatBodyDepan: 8,
                tebalCatBodyKiri: 8,
                temperatureAC: 4,
                tebalCatBodyKanan: 5,
                tebalCatBodyBelakang: 1,
                obdScanner: 10,
                tebalCatBodyAtap: 110,
                testAccu: 10,
                catatan: 'OK',
              },
              fitur: {
                airbag: 10,
                sistemAudio: 9,
                powerWindow: 10,
                sistemAC: 10,
                interior1: 10,
                interior2: 10,
                interior3: 10,
                catatan: 'OK',
              },
              hasilInspeksiMesin: {
                getaranMesin: 10,
                suaraMesin: 10,
                transmisi: 10,
                pompaPowerSteering: 10,
                coverTimingChain: 10,
                oliPowerSteering: 10,
                accu: 9,
                kompressorAC: 10,
                fan: 10,
                selang: 10,
                karterOli: 10,
                oliRem: 10,
                kabel: 10,
                kondensor: 10,
                radiator: 10,
                cylinderHead: 10,
                oliMesin: 9,
                airRadiator: 10,
                coverKlep: 10,
                alternator: 10,
                waterPump: 10,
                belt: 9,
                oliTransmisi: 10,
                cylinderBlock: 10,
                bushingBesar: 10,
                bushingKecil: 10,
                tutupRadiator: 10,
                catatan: 'OK',
              },
              hasilInspeksiInterior: {
                stir: 10,
                remTangan: 10,
                pedal: 10,
                switchWiper: 10,
                lampuHazard: 10,
                switchLampu: 10,
                panelDashboard: 9,
                pembukaKapMesin: 10,
                pembukaBagasi: 10,
                jokDepan: 9,
                aromaInterior: 10,
                handlePintu: 10,
                consoleBox: 10,
                spionTengah: 10,
                tuasPersneling: 10,
                jokBelakang: 9,
                panelIndikator: 10,
                switchLampuInterior: 10,
                karpetDasar: 8,
                klakson: 10,
                sunVisor: 10,
                tuasTangkiBensin: 10,
                sabukPengaman: 10,
                trimInterior: 9,
                plafon: 10,
                catatan: 'OK',
              },
            },
            description:
              'Object containing details from the "Penilaian" section(s) of the inspection form.',
          },
          bodyPaintThickness: {
            type: 'object',
            example: {
              front: '10',
              rear: {
                trunk: 10,
                bumper: 10,
              },
              right: {
                frontFender: 10,
                frontDoor: 10,
                rearDoor: 10,
                rearFender: 10,
              },
              left: {
                frontFender: 10,
                frontDoor: 10,
                rearDoor: 10,
                rearFender: 10,
              },
            },
            description:
              'Object containing details from the "Body Paint Thickness" test section of the form.',
          },
          notesFontSizes: {
            type: 'object',
            example: {
              'inspectionSummary.interiorNotes': 12,
              'inspectionSummary.eksteriorNotes': 12,
              'inspectionSummary.kakiKakiNotes': 12,
              'inspectionSummary.mesinNotes': 12,
              'inspectionSummary.deskripsiKeseluruhan': 12,
              'detailedAssessment.testDrive.catatan': 12,
              'detailedAssessment.banDanKakiKaki.catatan': 12,
              'detailedAssessment.hasilInspeksiEksterior.catatan': 12,
              'detailedAssessment.toolsTest.catatan': 12,
              'detailedAssessment.fitur.catatan': 12,
              'detailedAssessment.hasilInspeksiMesin.catatan': 12,
              'detailedAssessment.hasilInspeksiInterior.catatan': 12,
            },
            description:
              'Map of note field paths to their desired font sizes in the report.',
          },
        },
        required: [
          'vehiclePlateNumber',
          'inspectionDate',
          'overallRating',
          'identityDetails',
          'vehicleData',
          'equipmentChecklist',
          'inspectionSummary',
          'detailedAssessment',
          'bodyPaintThickness',
          'notesFontSizes',
        ],
      },
      InspectionResponseDto: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
            description:
              'The unique identifier (UUID) for the inspection record.',
          },
          submittedByUserId: {
            type: 'object',
            example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
            description:
              'The UUID of the user (Inspector) who submitted this inspection.',
            nullable: true,
          },
          reviewerId: {
            type: 'object',
            example: null,
            description:
              'The UUID of the user (Reviewer) who last reviewed (approved/rejected) this inspection.',
            nullable: true,
          },
          vehiclePlateNumber: {
            type: 'object',
            example: 'AB 4332 KJ',
            description: 'The license plate number of the inspected vehicle.',
            nullable: true,
          },
          inspectionDate: {
            type: 'object',
            example: '2025-07-05T14:30:00.000Z',
            description: 'The date and time the inspection occurred.',
            nullable: true,
          },
          overallRating: {
            type: 'object',
            example: '8',
            description: 'The overall rating assigned during the inspection.',
            nullable: true,
          },
          status: {
            type: 'string',
            example: 'ARCHIVED',
            description:
              'The current status of the inspection in its lifecycle.',
          },
          identityDetails: {
            type: 'object',
            example: {
              namaCustomer: 'Steve Roger',
              namaInspektor: 'Tony Stark',
              cabangInspeksi: 'Semarang',
            },
            description:
              'Object containing identity details from the inspection form.',
            nullable: true,
          },
          vehicleData: {
            type: 'object',
            example: {
              tahun: 2023,
              odometer: 15000,
              platNomor: 'AB 4332 KJ',
              transmisi: 'Automatic',
              biayaPajak: 3500000,
              kepemilikan: 'Tangan Pertama',
              pajak1Tahun: '2025-10-15',
              pajak5Tahun: '2028-10-15',
              tipeKendaraan: 'Ioniq 5',
              merekKendaraan: 'Hyundai',
              warnaKendaraan: 'Silver',
            },
            description:
              'Object containing vehicle details from the inspection form.',
            nullable: true,
          },
          equipmentChecklist: {
            type: 'object',
            example: {
              bpkb: false,
              noMesin: true,
              toolkit: true,
              banSerep: true,
              dongkrak: true,
              noRangka: true,
              bukuManual: true,
              kunciSerep: false,
              bukuService: true,
            },
            description:
              'Object containing checklist results for equipment from the inspection form.',
            nullable: true,
          },
          inspectionSummary: {
            type: 'object',
            example: {
              merkban: 'Bridgestone',
              tipeVelg: 'Original',
              posisiBan: 'Bridgestone',
              mesinNotes: 'Suara halus',
              mesinScore: 9,
              ketebalanBan: '80%',
              interiorNotes: 'Bersih terawat',
              interiorScore: 9,
              kakiKakiNotes: 'Aman',
              kakiKakiScore: 10,
              eksteriorNotes: 'Baret halus pintu kanan',
              eksteriorScore: 8,
              indikasiBanjir: false,
              indikasiTabrakan: false,
              estimasiPerbaikan: [
                {
                  harga: 700000,
                  namaPart: 'Tie Rod Kanan Kiri',
                },
                {
                  harga: 300000,
                  namaPart: 'Spooring',
                },
              ],
              deskripsiKeseluruhan: ['Kondisi sangat baik', 'Ada baret halus'],
              indikasiOdometerReset: false,
              penilaianKeseluruhanScore: 9,
            },
            description:
              'Object containing summary results from the inspection form.',
            nullable: true,
          },
          detailedAssessment: {
            type: 'object',
            example: {
              fitur: {
                airbag: 7,
                catatan: 'OK',
                sistemAC: 6,
                interior1: 5,
                interior2: 4,
                interior3: 3,
                powerWindow: 2,
                sistemAudio: 1,
              },
              testDrive: {
                rpm: 10,
                catatan: 'OK',
                stirBalance: 10,
                bunyiGetaran: 10,
                performaStir: 9,
                performaKopling: 10,
                performaSuspensi: 9,
                perpindahanTransmisi: 10,
              },
              toolsTest: {
                catatan: 'OK',
                testAccu: 10,
                obdScanner: 10,
                temperatureAC: 4,
                tebalCatBodyAtap: 110,
                tebalCatBodyKiri: 8,
                tebalCatBodyDepan: 8,
                tebalCatBodyKanan: 5,
                tebalCatBodyBelakang: 1,
              },
              banDanKakiKaki: {
                gardan: 10,
                tieRod: 10,
                catatan: 'OK',
                knalpot: 10,
                banDepan: 9,
                brakePad: 9,
                balljoint: 10,
                discBrake: 10,
                karetBoot: 10,
                masterRem: 10,
                rocksteer: 10,
                velgDepan: 10,
                banBelakang: 9,
                crossmember: 10,
                shockBreaker: 9,
                velgBelakang: 10,
                upperLowerArm: 10,
                linkStabilizer: 10,
              },
              hasilInspeksiMesin: {
                fan: 10,
                accu: 9,
                belt: 9,
                kabel: 10,
                oliRem: 10,
                selang: 10,
                catatan: 'OK',
                oliMesin: 9,
                radiator: 10,
                coverKlep: 10,
                karterOli: 10,
                kondensor: 10,
                transmisi: 10,
                waterPump: 10,
                alternator: 10,
                suaraMesin: 10,
                airRadiator: 10,
                bushingBesar: 10,
                bushingKecil: 10,
                cylinderHead: 10,
                getaranMesin: 10,
                kompressorAC: 10,
                oliTransmisi: 10,
                cylinderBlock: 10,
                tutupRadiator: 10,
                coverTimingChain: 10,
                oliPowerSteering: 10,
                pompaPowerSteering: 10,
              },
              hasilInspeksiInterior: {
                stir: 10,
                pedal: 10,
                plafon: 10,
                catatan: 'OK',
                klakson: 10,
                jokDepan: 9,
                sunVisor: 10,
                remTangan: 10,
                consoleBox: 10,
                handlePintu: 10,
                jokBelakang: 9,
                karpetDasar: 8,
                lampuHazard: 10,
                spionTengah: 10,
                switchLampu: 10,
                switchWiper: 10,
                trimInterior: 9,
                aromaInterior: 10,
                pembukaBagasi: 10,
                sabukPengaman: 10,
                panelDashboard: 9,
                panelIndikator: 10,
                tuasPersneling: 10,
                pembukaKapMesin: 10,
                tuasTangkiBensin: 10,
                switchLampuInterior: 10,
              },
              hasilInspeksiEksterior: {
                grill: 10,
                catatan: 'Baret halus pintu kanan',
                kapMesin: 10,
                trunklid: 10,
                daunWiper: 10,
                kacaDepan: 10,
                panelAtap: 10,
                spionKiri: 10,
                fenderKiri: 10,
                kacaBening: 10,
                lampuUtama: 10,
                pintuDepan: 10,
                spionKanan: 10,
                bumperDepan: 8,
                fenderKanan: 10,
                lampuFoglamp: 10,
                lisplangKiri: 10,
                lampuBelakang: 10,
                lisplangKanan: 10,
                pintuBelakang: 10,
                sideSkirtKiri: 10,
                wiperBelakang: 10,
                bumperBelakang: 9,
                pintuDepanKiri: 10,
                sideSkirtKanan: 10,
                kacaJendelaKiri: 10,
                kacaJendelaKanan: 10,
                quarterPanelKiri: 10,
                pintuBelakangKiri: 10,
                quarterPanelKanan: 10,
                pintuBelakangKanan: 10,
              },
            },
            description:
              'Object containing detailed assessment scores from the inspection form.',
            nullable: true,
          },
          bodyPaintThickness: {
            type: 'object',
            example: {
              left: {
                rearDoor: 10,
                frontDoor: 10,
                rearFender: 10,
                frontFender: 10,
              },
              rear: {
                trunk: 10,
                bumper: 10,
              },
              front: '10',
              right: {
                rearDoor: 10,
                frontDoor: 10,
                rearFender: 10,
                frontFender: 10,
              },
            },
            description:
              'Object containing body paint thickness measurements from the inspection form.',
            nullable: true,
          },
          photos: {
            type: 'array',
            example: [
              {
                path: '/uploads/photo1.jpg',
                label: 'front',
              },
            ],
            description:
              'An array containing metadata for photos associated with this inspection.',
            items: {
              type: 'object',
            },
          },
          urlPdf: {
            type: 'object',
            example: '/pdfarchived/SOL-05072025-002-1747546170449.pdf',
            description:
              'The URL pointing to the generated PDF report file (stored off-chain).',
            nullable: true,
          },
          nftAssetId: {
            type: 'object',
            example:
              '030307ee382b62d1c2541b3fc1a706384efce7f405f5c0cbbba2a9b2496e7370656374696f6e5f414220313720554c',
            description:
              'The unique Cardano NFT Asset ID representing this inspection on the blockchain.',
            nullable: true,
          },
          blockchainTxHash: {
            type: 'object',
            example:
              'b7ad6576cdfb2a386973f7193b7cd24b32806b31beb5d5bac2d4d77cfd2e5f9f',
            description:
              'The Cardano transaction hash for the NFT minting process.',
            nullable: true,
          },
          pdfFileHash: {
            type: 'object',
            example:
              'ad16c1c1f7a3b9eb41512022ce7b92042795d6aa7a34dce0a44c839fa43b4b5f',
            description:
              'The cryptographic hash (e.g., SHA-256) of the generated PDF report file.',
            nullable: true,
          },
          archivedAt: {
            type: 'object',
            example: '2025-05-18T06:01:32.593Z',
            description:
              'The timestamp indicating when the inspection was successfully archived.',
            nullable: true,
          },
          deactivatedAt: {
            type: 'object',
            example: null,
            description:
              'The timestamp indicating when the inspection was deactivated (soft delete).',
            nullable: true,
          },
          notesFontSizes: {
            type: 'object',
            example: {},
            description:
              'Map of note field paths to their desired font sizes in the report.',
            nullable: true,
          },
          createdAt: {
            format: 'date-time',
            type: 'string',
            example: '2025-05-17T17:55:34.539Z',
            description:
              'The timestamp when this inspection record was first created in the database.',
          },
          updatedAt: {
            format: 'date-time',
            type: 'string',
            example: '2025-05-18T06:01:32.595Z',
            description:
              'The timestamp when this inspection record was last updated in the database.',
          },
          pretty_id: {
            type: 'string',
            example: 'SOL-05072025-002',
            description:
              'The unique human-readable identifier for the inspection.',
          },
          inspectorId: {
            type: 'object',
            example: null,
            description:
              'The UUID of the user (Inspector) who performed this inspection.',
            nullable: true,
          },
        },
        required: [
          'id',
          'submittedByUserId',
          'reviewerId',
          'vehiclePlateNumber',
          'inspectionDate',
          'overallRating',
          'status',
          'identityDetails',
          'vehicleData',
          'equipmentChecklist',
          'inspectionSummary',
          'detailedAssessment',
          'bodyPaintThickness',
          'photos',
          'urlPdf',
          'nftAssetId',
          'blockchainTxHash',
          'pdfFileHash',
          'archivedAt',
          'deactivatedAt',
          'notesFontSizes',
          'createdAt',
          'updatedAt',
          'pretty_id',
          'inspectorId',
        ],
      },
      UpdateInspectionDto: {
        type: 'object',
        properties: {},
      },
      PhotoResponseDto: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Photo unique identifier (UUID)',
          },
          path: {
            type: 'string',
            description: 'Relative path or filename in storage',
          },
          label: {
            type: 'object',
            description: 'Label associated with the photo',
            nullable: true,
          },
          originalLabel: {
            type: 'object',
            description: 'Original predefined label (for FIXED type)',
            nullable: true,
          },
          needAttention: {
            type: 'boolean',
            description: 'Flag indicating if the photo needs attention',
          },
          createdAt: {
            format: 'date-time',
            type: 'string',
            description: 'Timestamp when the photo record was created',
          },
        },
        required: ['id', 'path', 'needAttention', 'createdAt'],
      },
      AddSinglePhotoDto: {
        type: 'object',
        properties: {
          metadata: {
            type: 'string',
            format: 'json',
            description:
              'REQUIRED: JSON string representing the metadata object ({label: string, needAttention?: boolean}) for the uploaded photo.',
            example: '{"label":"Rear Left Fender","needAttention":true}',
          },
        },
        required: ['metadata'],
      },
      UpdatePhotoDto: {
        type: 'object',
        properties: {
          label: {
            type: 'string',
            description:
              'New custom label for the photo (ignored for FIXED type)',
            example: 'Baret Pintu Kanan (Close Up)',
          },
          needAttention: {
            type: 'string',
            description:
              'New attention flag (send "true" or "false" string, DYNAMIC type only)',
            example: 'false',
          },
        },
      },
      InspectionChangeLogResponseDto: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The unique identifier of the change log entry',
          },
          inspectionId: {
            type: 'string',
            description: 'The ID of the inspection the change log belongs to',
          },
          fieldName: {
            type: 'string',
            description: 'The name of the field that was changed',
          },
          oldValue: {
            type: 'string',
            description: 'The old value of the field',
          },
          newValue: {
            type: 'string',
            description: 'The new value of the field',
          },
          changedAt: {
            format: 'date-time',
            type: 'string',
            description: 'The timestamp when the change occurred',
          },
        },
        required: [
          'id',
          'inspectionId',
          'fieldName',
          'oldValue',
          'newValue',
          'changedAt',
        ],
      },
      CreateInspectionBranchCityDto: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            example: 'Jakarta',
            description: 'Name of the city',
          },
        },
        required: ['city'],
      },
      InspectionBranchCityResponseDto: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: 'cuid',
            description: 'Unique identifier of the inspection branch city',
          },
          city: {
            type: 'string',
            example: 'Jakarta',
            description: 'Name of the city',
          },
          code: {
            type: 'string',
            example: 'Main Branch',
            description: 'Name of the inspection branch',
          },
          createdAt: {
            format: 'date-time',
            type: 'string',
            example: '2023-10-27T10:00:00.000Z',
            description: 'Creation timestamp',
          },
          updatedAt: {
            format: 'date-time',
            type: 'string',
            example: '2023-10-27T10:00:00.000Z',
            description: 'Last update timestamp',
          },
        },
        required: ['id', 'city', 'code', 'createdAt', 'updatedAt'],
      },
      UpdateInspectionBranchCityDto: {
        type: 'object',
        properties: {},
      },
      SetInspectionTargetDto: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            description:
              'The period for which the target is set (month, week, or day)',
            enum: ['YEAR', 'MONTH', 'WEEK', 'DAY'],
            example: 'MONTH',
          },
          targetValue: {
            type: 'number',
            description:
              'The target number of inspections for the specified period',
            example: 100,
            minimum: 0,
          },
        },
        required: ['period', 'targetValue'],
      },
      InspectionTargetDto: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique identifier of the inspection target',
            example: 'clx0x0x0x0x0x0x0x0x0x0x0',
          },
          targetValue: {
            type: 'number',
            description: 'The target number of inspections',
            example: 100,
          },
          period: {
            type: 'string',
            description:
              'The period for which the target is set (month, week, or day)',
            enum: ['YEAR', 'MONTH', 'WEEK', 'DAY'],
            example: 'MONTH',
          },
          targetDate: {
            format: 'date-time',
            type: 'string',
            description: 'The date for which the target is set (YYYY-MM-DD)',
            example: '2025-05-01T00:00:00.000Z',
          },
          createdAt: {
            format: 'date-time',
            type: 'string',
            description: 'Timestamp when the target was created',
            example: '2025-05-28T10:00:00.000Z',
          },
          updatedAt: {
            format: 'date-time',
            type: 'string',
            description: 'Timestamp when the target was last updated',
            example: '2025-05-28T10:00:00.000Z',
          },
        },
        required: [
          'id',
          'targetValue',
          'period',
          'targetDate',
          'createdAt',
          'updatedAt',
        ],
      },
      InspectionTargetStatsItemDto: {
        type: 'object',
        properties: {
          totalInspections: {
            type: 'number',
            description: 'Total inspections for the period',
            example: 85,
          },
          targetInspections: {
            type: 'number',
            description: 'Target inspections for the period',
            example: 100,
          },
          percentageMet: {
            type: 'string',
            description: 'Percentage of target met',
            example: '85.00%',
          },
        },
        required: ['totalInspections', 'targetInspections', 'percentageMet'],
      },
      InspectionTargetStatsResponseDto: {
        type: 'object',
        properties: {
          allTime: {
            description: 'Inspection target statistics for all time',
            allOf: [
              {
                $ref: '#/components/schemas/InspectionTargetStatsItemDto',
              },
            ],
          },
          thisMonth: {
            description: 'Inspection target statistics for this month',
            allOf: [
              {
                $ref: '#/components/schemas/InspectionTargetStatsItemDto',
              },
            ],
          },
          thisWeek: {
            description: 'Inspection target statistics for this week',
            allOf: [
              {
                $ref: '#/components/schemas/InspectionTargetStatsItemDto',
              },
            ],
          },
          today: {
            description: 'Inspection target statistics for today',
            allOf: [
              {
                $ref: '#/components/schemas/InspectionTargetStatsItemDto',
              },
            ],
          },
          thisYear: {
            description: 'Inspection target statistics for this year',
            allOf: [
              {
                $ref: '#/components/schemas/InspectionTargetStatsItemDto',
              },
            ],
          },
        },
      },
      MainStatsResponseDto: {
        type: 'object',
        properties: {
          totalOrders: {
            type: 'number',
            description: 'Total number of orders/records',
            example: 1000,
          },
          needReview: {
            type: 'number',
            description: 'Number of orders with status Need Review',
            example: 50,
          },
          approved: {
            type: 'number',
            description: 'Number of orders with status Approved',
            example: 800,
          },
          archived: {
            type: 'number',
            description: 'Number of orders with status Minted',
            example: 100,
          },
          failArchive: {
            type: 'number',
            description: 'Number of orders with status Failed to Mint',
            example: 10,
          },
          deactivated: {
            type: 'number',
            description: 'Number of orders with status Deactivated',
            example: 40,
          },
        },
        required: [
          'totalOrders',
          'needReview',
          'approved',
          'archived',
          'failArchive',
          'deactivated',
        ],
      },
      OrderTrendItemDto: {
        type: 'object',
        properties: {
          period_label: {
            type: 'string',
            description:
              'Label for the period (e.g., "00:00-02:00", "DD-MM-YYYY", "Jan")',
            example: '00:00-02:00',
          },
          period_start: {
            format: 'date-time',
            type: 'string',
            description: 'Start of the period in ISO8601 UTC format',
            example: '2024-01-01T00:00:00Z',
          },
          period_end: {
            format: 'date-time',
            type: 'string',
            description: 'End of the period in ISO8601 UTC format',
            example: '2024-01-01T01:59:59Z',
          },
          count: {
            type: 'number',
            description: 'Total count of orders for the period',
            example: 150,
          },
        },
        required: ['period_label', 'period_start', 'period_end', 'count'],
      },
      OrderTrendSummaryDto: {
        type: 'object',
        properties: {
          total_orders: {
            type: 'number',
            description: 'Total number of orders in the selected range',
            example: 1234,
          },
          actual_start_date_used: {
            type: 'string',
            description:
              'Actual start date used for the query in ISO8601 UTC format',
            example: '2024-01-01T00:00:00Z',
          },
          actual_end_date_used: {
            type: 'string',
            description:
              'Actual end date used for the query in ISO8601 UTC format',
            example: '2024-01-31T23:59:59Z',
          },
        },
        required: [
          'total_orders',
          'actual_start_date_used',
          'actual_end_date_used',
        ],
      },
      OrderTrendResponseDto: {
        type: 'object',
        properties: {
          data: {
            description: 'Array of order trend data points',
            type: 'array',
            items: {
              $ref: '#/components/schemas/OrderTrendItemDto',
            },
          },
          summary: {
            description: 'Summary statistics for the order trend data',
            allOf: [
              {
                $ref: '#/components/schemas/OrderTrendSummaryDto',
              },
            ],
          },
        },
        required: ['data', 'summary'],
      },
      BranchDistributionItemDto: {
        type: 'object',
        properties: {
          branch: {
            type: 'string',
            description: 'Branch name',
            example: 'Main Branch',
          },
          count: {
            type: 'number',
            description: 'Number of orders in the branch',
            example: 250,
          },
          percentage: {
            type: 'string',
            description: 'Percentage of total orders',
            example: '50%',
          },
          change: {
            type: 'string',
            description: 'Percentage change (e.g., +5%)',
            example: '+5%',
          },
        },
        required: ['branch', 'count', 'percentage', 'change'],
      },
      BranchDistributionResponseDto: {
        type: 'object',
        properties: {
          data: {
            description: 'Distribution of orders by branch',
            example: [
              {
                branch: 'Main Branch',
                count: 250,
                percentage: '50%',
                change: '+5%',
              },
              {
                branch: 'Branch B',
                count: 150,
                percentage: '30%',
                change: '-2%',
              },
            ],
            type: 'array',
            items: {
              $ref: '#/components/schemas/BranchDistributionItemDto',
            },
          },
        },
        required: ['data'],
      },
      InspectorPerformanceItemDto: {
        type: 'object',
        properties: {
          inspector: {
            type: 'string',
            description: 'Inspector name',
            example: 'John Doe',
          },
          totalInspections: {
            type: 'number',
            description:
              'Total number of inspections performed by the inspector',
            example: 150,
          },
          monthlyInspections: {
            type: 'number',
            description:
              'Number of inspections performed by the inspector this month',
            example: 50,
          },
          weeklyInspections: {
            type: 'number',
            description:
              'Number of inspections performed by the inspector this week',
            example: 15,
          },
          dailyInspections: {
            type: 'number',
            description:
              'Number of inspections performed by the inspector today',
            example: 5,
          },
        },
        required: [
          'inspector',
          'totalInspections',
          'monthlyInspections',
          'weeklyInspections',
          'dailyInspections',
        ],
      },
      InspectorPerformanceResponseDto: {
        type: 'object',
        properties: {
          data: {
            description: 'Inspector performance statistics',
            example: [
              {
                inspector: 'John Doe',
                totalInspections: 150,
                monthlyInspections: 50,
                weeklyInspections: 15,
                dailyInspections: 5,
              },
              {
                inspector: 'Jane Smith',
                totalInspections: 120,
                monthlyInspections: 40,
                weeklyInspections: 10,
                dailyInspections: 3,
              },
            ],
            type: 'array',
            items: {
              $ref: '#/components/schemas/InspectorPerformanceItemDto',
            },
          },
        },
        required: ['data'],
      },
      InspectionStatsPeriodData: {
        type: 'object',
        properties: {
          total: {
            type: 'number',
            description: 'Total number of inspections',
          },
          approved: {
            type: 'number',
            description: 'Number of approved inspections',
          },
          needReview: {
            type: 'number',
            description: 'Number of inspections needing review',
          },
          percentageReviewed: {
            type: 'string',
            description:
              'Percentage of inspections reviewed (approved out of total)',
          },
        },
        required: ['total', 'approved', 'needReview', 'percentageReviewed'],
      },
      InspectionStatsResponseDto: {
        type: 'object',
        properties: {
          allTime: {
            description: 'Statistics for all time',
            allOf: [
              {
                $ref: '#/components/schemas/InspectionStatsPeriodData',
              },
            ],
          },
          thisMonth: {
            description: 'Statistics for the current month',
            allOf: [
              {
                $ref: '#/components/schemas/InspectionStatsPeriodData',
              },
            ],
          },
          thisWeek: {
            description: 'Statistics for the current week',
            allOf: [
              {
                $ref: '#/components/schemas/InspectionStatsPeriodData',
              },
            ],
          },
          today: {
            description: 'Statistics for today',
            allOf: [
              {
                $ref: '#/components/schemas/InspectionStatsPeriodData',
              },
            ],
          },
        },
        required: ['allTime', 'thisMonth', 'thisWeek', 'today'],
      },
    },
  },
};
