/*
 * --------------------------------------------------------------------------
 * File: blockchain.service.spec.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Unit tests for the BlockchainService.
 * Tests the basic functionality and definition of the service.
 * --------------------------------------------------------------------------
 */

// Prevent the real MeshWallet from decoding secret keys during unit tests.
// Provide minimal mocked exports used by the service constructor.
jest.mock('@meshsdk/core', () => ({
  MeshWallet: jest.fn().mockImplementation(() => ({})),
  MeshTxBuilder: jest.fn().mockImplementation(() => ({})),
  BlockfrostProvider: jest.fn().mockImplementation(() => ({})),
  ForgeScript: { withOneSignature: jest.fn((addr: string) => ({ addr })) },
  resolveScriptHash: jest.fn(() => 'mockedpolicyid'),
  stringToHex: jest.fn((s: string) => Buffer.from(String(s)).toString('hex')),
  mConStr: jest.fn(() => ({})),
  // keep types placeholders for TS compatibility in runtime
  __esModule: true,
}));

import { BlockchainService } from './blockchain.service';

describe('BlockchainService - mintInspectionNft', () => {
  let service: BlockchainService;

  // Simple mock config that satisfies constructor requirements
  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'BLOCKFROST_ENV') return 'preview';
      if (key.startsWith('BLOCKFROST_API_KEY_PREVIEW')) return 'test-api-key';
      if (key.startsWith('WALLET_SECRET_KEY_PREVIEW')) return 'test-secret-key';
      return undefined;
    }),
    // Support optional get() reads used in the service (e.g. MIN_UTXO_ADA / MIN_UTXO_LOVELACE)
    get: jest.fn().mockReturnValue(undefined),
  };

  // Minimal metadata used for minting
  const metadata = { vehicleNumber: 'ABC123', pdfHash: 'hash' };

  beforeEach(() => {
    // Create real service instance with mocked config
    service = new BlockchainService(mockConfigService as any);
  });

  function makeUtxo(txHash: string, idx: number, lovelace: number) {
    return {
      input: { txHash, outputIndex: idx },
      output: {
        address: 'addr_test1',
        amount: [{ unit: 'lovelace', quantity: String(lovelace) }],
      },
    };
  }

  function makeMockWallet(utxoSets: any[]) {
    // utxoSets: array of arrays, each call to getUnspentOutputs will shift()
    let callCount = 0;
    return {
      getLovelace: jest.fn().mockResolvedValue('5000000'),
      getUsedAddresses: jest.fn().mockResolvedValue(['addr_test1']),
      getUnspentOutputs: jest.fn().mockImplementation(() => {
        const set = utxoSets[callCount] ?? utxoSets[utxoSets.length - 1];
        callCount += 1;
        // Return a shallow copy so subsequent mutations won't affect stored sets
        return Promise.resolve(JSON.parse(JSON.stringify(set)));
      }),
      signTx: jest.fn().mockImplementation(async (unsigned: any) => {
        return { signed: true, unsigned };
      }),
      submitTx: jest.fn().mockImplementation(async (_signed: any) => {
        return `txhash_${Math.random().toString(36).slice(2, 9)}`;
      }),
    };
  }

  function makeMockTxBuilder() {
    // Chainable builder with basic complete() implementation
    const builder: any = {};
    const chainable = () => builder;
    builder.mint = jest.fn(chainable);
    builder.mintingScript = jest.fn(chainable);
    builder.metadataValue = jest.fn(chainable);
    builder.changeAddress = jest.fn(chainable);
    builder.selectUtxosFrom = jest.fn(chainable);
    builder.complete = jest.fn().mockResolvedValue({ body: 'unsigned' });
    return builder;
  }

  it('mints a single NFT successfully', async () => {
    const mockWallet = makeMockWallet([[makeUtxo('tx1', 0, 3000000)]]);
    (service as any).wallet = mockWallet;

    const mockBuilder = makeMockTxBuilder();
    (service as any).getTxBuilder = jest.fn().mockReturnValue(mockBuilder);

    const res = await service.mintInspectionNft(metadata as any);

    expect(res).toHaveProperty('txHash');
    expect(res).toHaveProperty('assetId');
    expect(mockWallet.getUnspentOutputs).toHaveBeenCalledTimes(1);
    expect(mockWallet.signTx).toHaveBeenCalledTimes(1);
    expect(mockWallet.submitTx).toHaveBeenCalledTimes(1);
  });

  it('handles 10 near-concurrent mint requests with separate UTXO sets', async () => {
    // Prepare distinct UTXO for each call
    const utxoSets = [
      [makeUtxo('txA', 0, 3000000)],
      [makeUtxo('txB', 0, 3000000)],
      [makeUtxo('txC', 0, 3000000)],
      [makeUtxo('txD', 0, 3000000)],
      [makeUtxo('txE', 0, 3000000)],
      [makeUtxo('txF', 0, 3000000)],
      [makeUtxo('txG', 0, 3000000)],
      [makeUtxo('txH', 0, 3000000)],
      [makeUtxo('txI', 0, 3000000)],
      [makeUtxo('txJ', 0, 3000000)],
    ];
    const mockWallet = makeMockWallet(utxoSets);
    (service as any).wallet = mockWallet;

    const mockBuilder = makeMockTxBuilder();
    (service as any).getTxBuilder = jest.fn().mockReturnValue(mockBuilder);

    // Start 10 near-concurrent requests (started quickly one after another)
    const promises = [] as Promise<any>[];
    for (let i = 0; i < 10; i++) {
      promises.push(service.mintInspectionNft(metadata as any));
    }

    const results = await Promise.all(promises);

    expect(results).toHaveLength(10);
    expect(mockWallet.getUnspentOutputs).toHaveBeenCalledTimes(10);
    expect(mockWallet.submitTx).toHaveBeenCalledTimes(10);
    // txHashes should be distinct across all results
    const hashes = results.map((r) => r.txHash);
    expect(new Set(hashes).size).toBe(10);
  });

  it('handles 10 fully concurrent mint requests', async () => {
    const utxoSets = [
      [makeUtxo('t1', 0, 3000000)],
      [makeUtxo('t2', 0, 3000000)],
      [makeUtxo('t3', 0, 3000000)],
      [makeUtxo('t4', 0, 3000000)],
      [makeUtxo('t5', 0, 3000000)],
      [makeUtxo('t6', 0, 3000000)],
      [makeUtxo('t7', 0, 3000000)],
      [makeUtxo('t8', 0, 3000000)],
      [makeUtxo('t9', 0, 3000000)],
      [makeUtxo('t10', 0, 3000000)],
    ];
    const mockWallet = makeMockWallet(utxoSets);
    (service as any).wallet = mockWallet;

    const mockBuilder = makeMockTxBuilder();
    (service as any).getTxBuilder = jest.fn().mockReturnValue(mockBuilder);

    // Fire 10 fully concurrent requests
    const parallel = [] as Promise<any>[];
    for (let i = 0; i < 10; i++) {
      parallel.push(service.mintInspectionNft(metadata as any));
    }

    const res = await Promise.all(parallel);

    expect(res).toHaveLength(10);
    expect(mockWallet.getUnspentOutputs).toHaveBeenCalledTimes(10);
    expect(mockWallet.submitTx).toHaveBeenCalledTimes(10);
    // ensure all tx hashes are unique
    const hashes = res.map((r) => r.txHash);
    const unique = new Set(hashes);
    expect(unique.size).toBe(10);
  });

  it('rejects when wallet has insufficient funds', async () => {
    const mockWallet = makeMockWallet([[makeUtxo('low', 0, 3000000)]]);
    // override lovelace to be too small
    mockWallet.getLovelace = jest.fn().mockResolvedValue('1000000');
    (service as any).wallet = mockWallet;

    const mockBuilder = makeMockTxBuilder();
    (service as any).getTxBuilder = jest.fn().mockReturnValue(mockBuilder);

    await expect(service.mintInspectionNft(metadata as any)).rejects.toThrow(
      /not enough funds|balance is insufficient/i,
    );
  });

  it('throws when returned UTXOs are malformed or missing lovelace amounts', async () => {
    const malformed = [
      {
        input: { txHash: 'x', outputIndex: 0 },
        output: { address: 'addr_test1' },
      },
    ];
    const mockWallet = makeMockWallet([malformed]);
    (service as any).wallet = mockWallet;

    const mockBuilder = makeMockTxBuilder();
    (service as any).getTxBuilder = jest.fn().mockReturnValue(mockBuilder);

    // Reduce retries/delay so test fails fast instead of sleeping for backoff
    (service as any).MAX_RETRIES = 1;
    (service as any).INITIAL_RETRY_DELAY_MS = 1;

    await expect(service.mintInspectionNft(metadata as any)).rejects.toThrow(
      /No unspent outputs/i,
    );

    expect(mockWallet.getUnspentOutputs).toHaveBeenCalled();
  });

  it('retries when unspent outputs temporarily unavailable and succeeds after retry', async () => {
    // First call returns empty list, second call returns a usable utxo
    const utxoSets = [[], [makeUtxo('retryTx', 0, 3000000)]];
    const mockWallet = makeMockWallet(utxoSets);
    (service as any).wallet = mockWallet;

    const mockBuilder = makeMockTxBuilder();
    (service as any).getTxBuilder = jest.fn().mockReturnValue(mockBuilder);

    const res = await service.mintInspectionNft(metadata as any);
    expect(res).toHaveProperty('txHash');
    expect(mockWallet.getUnspentOutputs).toHaveBeenCalledTimes(2);
  });

  it('rebuilds and retries on submit-time Cardano validation error and succeeds', async () => {
    // Provide a single usable utxo for initial build
    const mockWallet = makeMockWallet([[makeUtxo('initial', 0, 3000000)]]);
    // Override submitTx to fail first with a Cardano validation style error
    let called = 0;
    mockWallet.submitTx = jest.fn().mockImplementation(async () => {
      called += 1;
      if (called === 1) {
        const err: any = new Error('BadInputsUTxO (TxIn ... )');
        throw err;
      }
      return `txhash_retry_success`;
    });

    (service as any).wallet = mockWallet;

    // Provide a tx builder; during retry the service will fetch fresh UTXOs via Blockfrost
    const mockBuilder = makeMockTxBuilder();
    (service as any).getTxBuilder = jest.fn().mockReturnValue(mockBuilder);

    // Mock blockfrostProvider.fetchAddressUTxOs to return a fresh UTXO on retry
    (service as any).blockfrostProvider = {
      fetchAddressUTxOs: jest
        .fn()
        .mockResolvedValue([makeUtxo('fresh', 0, 3000000)]),
    } as any;

    // Reduce retry counts/delays so test runs fast
    (service as any).SUBMIT_MAX_RETRIES = 2;
    (service as any).SUBMIT_INITIAL_DELAY_MS = 1;

    const res = await service.mintInspectionNft(metadata as any);
    expect(res).toHaveProperty('txHash');
    expect(res.txHash).toBe('txhash_retry_success');
    expect(mockWallet.submitTx).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// getTransactionMetadata
// ---------------------------------------------------------------------------
describe('BlockchainService - getTransactionMetadata', () => {
  let service: BlockchainService;

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'BLOCKFROST_ENV') return 'preview';
      if (key.startsWith('BLOCKFROST_API_KEY')) return 'test-api-key';
      if (key.startsWith('WALLET_SECRET_KEY')) return 'test-secret-key';
      return undefined;
    }),
    get: jest.fn().mockReturnValue(undefined),
  };

  beforeEach(() => {
    service = new BlockchainService(mockConfigService as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should throw BadRequestException when txHash is empty', async () => {
    await expect(service.getTransactionMetadata('')).rejects.toThrow(
      /Transaction hash is required/,
    );
  });

  it('should return metadata on successful fetch', async () => {
    const mockData = [{ label: '721', json_metadata: { name: 'test' } }];
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue(mockData),
    } as any);

    const result = await service.getTransactionMetadata('abc123');
    expect(result).toEqual(mockData);
  });

  it('should throw NotFoundException on 404 response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as any);

    await expect(
      service.getTransactionMetadata('badhash'),
    ).rejects.toThrow(/Transaction or metadata not found/i);
  });

  it('should throw InternalServerErrorException on non-404 bad response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as any);

    await expect(
      service.getTransactionMetadata('txhash'),
    ).rejects.toThrow(/Failed to retrieve transaction metadata/);
  });

  it('should throw InternalServerErrorException on fetch network error', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    await expect(
      service.getTransactionMetadata('txhash'),
    ).rejects.toThrow(/Failed to retrieve transaction metadata/);
  });

  it('should throw NotFoundException when error message contains "404"', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Response 404: not found'));

    await expect(
      service.getTransactionMetadata('txhash'),
    ).rejects.toThrow(/Transaction or metadata not found/);
  });
});

// ---------------------------------------------------------------------------
// getNftData
// ---------------------------------------------------------------------------
describe('BlockchainService - getNftData', () => {
  let service: BlockchainService;

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'BLOCKFROST_ENV') return 'preview';
      if (key.startsWith('BLOCKFROST_API_KEY')) return 'test-api-key';
      if (key.startsWith('WALLET_SECRET_KEY')) return 'test-secret-key';
      return undefined;
    }),
    get: jest.fn().mockReturnValue(undefined),
  };

  beforeEach(() => {
    service = new BlockchainService(mockConfigService as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should throw BadRequestException when assetId is empty', async () => {
    await expect(service.getNftData('')).rejects.toThrow(
      /Asset ID is required/,
    );
  });

  it('should return asset data on successful fetch', async () => {
    const mockAsset = { asset: 'assetid123', quantity: '1', onchain_metadata: {} };
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue(mockAsset),
    } as any);

    const result = await service.getNftData('assetid123');
    expect(result).toEqual(mockAsset);
  });

  it('should throw NotFoundException on 404 response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as any);

    await expect(service.getNftData('unknownasset')).rejects.toThrow(
      /Asset not found/,
    );
  });

  it('should throw InternalServerErrorException on non-404 bad response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 503,
    } as any);

    await expect(service.getNftData('asset123')).rejects.toThrow(
      /Failed to retrieve asset data/,
    );
  });

  it('should throw InternalServerErrorException on network error', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('timeout'));

    await expect(service.getNftData('asset123')).rejects.toThrow(
      /Failed to retrieve asset data/,
    );
  });

  it('should re-throw NotFoundException caught inside catch block', async () => {
    const { NotFoundException } = await import('@nestjs/common');
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(
      new NotFoundException('asset not found'),
    );

    await expect(service.getNftData('asset123')).rejects.toThrow(
      /asset not found/,
    );
  });
});

// ---------------------------------------------------------------------------
// buildAikenMintTransaction
// ---------------------------------------------------------------------------
describe('BlockchainService - buildAikenMintTransaction', () => {
  let service: BlockchainService;

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'BLOCKFROST_ENV') return 'preview';
      if (key.startsWith('BLOCKFROST_API_KEY')) return 'test-api-key';
      if (key.startsWith('WALLET_SECRET_KEY')) return 'test-secret-key';
      return undefined;
    }),
    get: jest.fn().mockReturnValue(undefined),
  };

  function makeUtxo(txHash: string, idx: number) {
    return {
      input: { txHash, outputIndex: idx },
      output: {
        address: 'addr_test1',
        amount: [{ unit: 'lovelace', quantity: '3000000' }],
      },
    };
  }

  function makeChainableBuilder() {
    const builder: any = {};
    const chainable = () => builder;
    builder.txIn = jest.fn(chainable);
    builder.mintPlutusScriptV3 = jest.fn(chainable);
    builder.mint = jest.fn(chainable);
    builder.mintingScript = jest.fn(chainable);
    builder.mintRedeemerValue = jest.fn(chainable);
    builder.metadataValue = jest.fn(chainable);
    builder.txOut = jest.fn(chainable);
    builder.txInCollateral = jest.fn(chainable);
    builder.changeAddress = jest.fn(chainable);
    builder.selectUtxosFrom = jest.fn(chainable);
    builder.complete = jest.fn().mockResolvedValue('unsigned_cbor_hex');
    return builder;
  }

  const buildDto = {
    adminAddress: 'addr_admin',
    inspectionData: {
      nftDisplayName: 'VehicleInspection2025',
      vehicleNumber: 'B1234ABC',
      pdfHash: 'deadbeef',
    },
  };

  beforeEach(() => {
    service = new BlockchainService(mockConfigService as any);
  });

  it('should throw NotFoundException when no UTXOs available', async () => {
    (service as any).blockfrostProvider = {
      fetchAddressUTxOs: jest.fn().mockResolvedValue([]),
    };

    await expect(service.buildAikenMintTransaction(buildDto as any)).rejects.toThrow(
      /No UTXOs available/,
    );
  });

  it('should throw BadRequestException when only one UTXO (cannot use as both input and collateral)', async () => {
    (service as any).blockfrostProvider = {
      fetchAddressUTxOs: jest.fn().mockResolvedValue([makeUtxo('tx1', 0)]),
    };
    (service as any).getTxBuilder = jest.fn().mockReturnValue(makeChainableBuilder());
    (service as any).getParameterizedPolicy = jest.fn().mockReturnValue({
      policy: { code: 'mockcode', version: 'V3' },
      policyId: 'mockpolicyid',
    });
    (service as any).constructMintRedeemer = jest.fn().mockReturnValue({});

    await expect(service.buildAikenMintTransaction(buildDto as any)).rejects.toThrow(
      /Requires at least 2 UTXOs/,
    );
  });

  it('should return unsignedTx and nftAssetId on success', async () => {
    (service as any).blockfrostProvider = {
      fetchAddressUTxOs: jest
        .fn()
        .mockResolvedValue([makeUtxo('tx1', 0), makeUtxo('tx2', 1)]),
    };
    const builder = makeChainableBuilder();
    (service as any).getTxBuilder = jest.fn().mockReturnValue(builder);
    (service as any).getParameterizedPolicy = jest.fn().mockReturnValue({
      policy: { code: 'mockcode', version: 'V3' },
      policyId: 'mockpolicyid',
    });
    (service as any).constructMintRedeemer = jest.fn().mockReturnValue({});

    const result = await service.buildAikenMintTransaction(buildDto as any);

    expect(result).toHaveProperty('unsignedTx');
    expect(result).toHaveProperty('nftAssetId');
    expect(builder.complete).toHaveBeenCalledTimes(1);
  });

  it('should throw InternalServerErrorException on unexpected builder error', async () => {
    (service as any).blockfrostProvider = {
      fetchAddressUTxOs: jest
        .fn()
        .mockResolvedValue([makeUtxo('tx1', 0), makeUtxo('tx2', 1)]),
    };
    const builder = makeChainableBuilder();
    builder.complete = jest.fn().mockRejectedValue(new Error('builder crashed'));
    (service as any).getTxBuilder = jest.fn().mockReturnValue(builder);
    (service as any).getParameterizedPolicy = jest.fn().mockReturnValue({
      policy: { code: 'mockcode', version: 'V3' },
      policyId: 'mockpolicyid',
    });
    (service as any).constructMintRedeemer = jest.fn().mockReturnValue({});

    await expect(
      service.buildAikenMintTransaction(buildDto as any),
    ).rejects.toThrow(/Failed to process minting request with Aiken/);
  });
});

// ---------------------------------------------------------------------------
// sanitizeMetadatumString (private — tested via sanitizeMetadataObject)
// ---------------------------------------------------------------------------
describe('BlockchainService - sanitizeMetadatumString / sanitizeMetadataObject', () => {
  let service: BlockchainService;

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'BLOCKFROST_ENV') return 'preview';
      if (key.startsWith('BLOCKFROST_API_KEY')) return 'test-api-key';
      if (key.startsWith('WALLET_SECRET_KEY')) return 'test-secret-key';
      return undefined;
    }),
    get: jest.fn().mockReturnValue(undefined),
  };

  beforeEach(() => {
    service = new BlockchainService(mockConfigService as any);
  });

  it('should return string unchanged when <= 64 bytes', () => {
    const short = 'hello';
    const result = (service as any).sanitizeMetadatumString(short, 'field');
    expect(result).toBe(short);
  });

  it('should convert https://ipfs.io/ipfs/ URL to ipfs:// if it fits in 64 bytes', () => {
    const cid = 'QmY65h6y6zUoJjN3ripc4J2PzEvzL2VkiVXz3sCZboqPJw';
    const gatewayUrl = `https://ipfs.io/ipfs/${cid}`;
    const expected = `ipfs://${cid}`;
    expect(Buffer.byteLength(expected, 'utf8')).toBeLessThanOrEqual(64);

    const result = (service as any).sanitizeMetadatumString(gatewayUrl, 'image');
    expect(result).toBe(expected);
  });

  it('should truncate strings longer than 64 bytes that cannot be shortened', () => {
    const longString = 'a'.repeat(100);
    const result = (service as any).sanitizeMetadatumString(longString, 'desc');
    expect(Buffer.byteLength(result, 'utf8')).toBeLessThanOrEqual(64);
    expect(result.length).toBe(64);
  });

  it('should pass through non-string values unchanged', () => {
    const result = (service as any).sanitizeMetadatumString(42 as any, 'num');
    expect(result).toBe(42);
  });

  it('should recursively sanitize object values', () => {
    const obj = {
      name: 'short',
      desc: 'a'.repeat(100),
      nested: { key: 'b'.repeat(100) },
    };
    const result = (service as any).sanitizeMetadataObject(obj) as any;
    expect(result.name).toBe('short');
    expect(Buffer.byteLength(result.desc, 'utf8')).toBeLessThanOrEqual(64);
    expect(Buffer.byteLength(result.nested.key, 'utf8')).toBeLessThanOrEqual(64);
  });

  it('should recursively sanitize array values', () => {
    const arr = ['short', 'a'.repeat(100)];
    const result = (service as any).sanitizeMetadataObject(arr) as string[];
    expect(result[0]).toBe('short');
    expect(Buffer.byteLength(result[1], 'utf8')).toBeLessThanOrEqual(64);
  });

  it('should return null/undefined unchanged', () => {
    expect((service as any).sanitizeMetadataObject(null)).toBeNull();
    expect((service as any).sanitizeMetadataObject(undefined)).toBeUndefined();
  });

  it('should return numbers and booleans unchanged', () => {
    expect((service as any).sanitizeMetadataObject(42)).toBe(42);
    expect((service as any).sanitizeMetadataObject(true)).toBe(true);
  });
});
