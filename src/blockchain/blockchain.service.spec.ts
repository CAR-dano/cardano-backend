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
