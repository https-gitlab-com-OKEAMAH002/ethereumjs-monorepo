import { assert, describe, it } from 'vitest'

import {
  Chain,
  Common,
  ConsensusType,
  CustomChain,
  Hardfork,
  createCustomCommon,
} from '../src/index.js'

import * as testnet from './data/testnet.json'
import * as testnet2 from './data/testnet2.json'
import * as testnet3 from './data/testnet3.json'

import type { ChainConfig, HardforkTransitionConfig } from '../src/index.js'

describe('[Common]: Custom chains', () => {
  it('chain -> object: should provide correct access to private network chain parameters', () => {
    const c = new Common({ chain: testnet, hardfork: Hardfork.Byzantium })
    assert.equal(c.chainName(), 'testnet', 'should initialize with chain name')
    assert.equal(c.chainId(), BigInt(12345), 'should return correct chain Id')
    assert.equal(c.hardforks()[3]['block'], 3, 'should return correct hardfork data')
    assert.equal(c.bootstrapNodes()[1].ip, '10.0.0.2', 'should return a bootstrap node array')
  })

  it('chain -> object: should handle custom chain parameters with missing field', () => {
    const chainParams = Object.assign({}, testnet)
    delete (chainParams as any)['hardforks']
    assert.throws(
      function () {
        new Common({ chain: chainParams })
      },
      /Missing required/,
      undefined,
      'should throw an exception on missing parameter',
    )
  })

  it('custom() -> base functionality', () => {
    const mainnetCommon = new Common({ chain: Chain.Mainnet })

    const customChainParams = { name: 'custom', chainId: 123 }
    const customChainCommon = createCustomCommon(customChainParams, {
      hardfork: Hardfork.Byzantium,
    })

    // From custom chain params
    assert.equal(customChainCommon.chainName(), customChainParams.name)
    assert.equal(customChainCommon.chainId(), BigInt(customChainParams.chainId))

    // Fallback params from mainnet
    assert.equal(customChainCommon.genesis(), mainnetCommon.genesis())
    assert.equal(customChainCommon.bootstrapNodes(), mainnetCommon.bootstrapNodes())
    assert.equal(customChainCommon.hardforks(), mainnetCommon.hardforks())

    // Set only to this Common
    assert.equal(customChainCommon.hardfork(), 'byzantium')
  })

  it('custom() -> behavior', () => {
    let common = createCustomCommon({ chainId: 123 })
    assert.equal(common.consensusAlgorithm(), 'casper', 'should default to mainnet base chain')
    assert.equal(common.chainName(), 'custom-chain', 'should set default custom chain name')

    common = createCustomCommon(CustomChain.PolygonMumbai)
    assert.deepEqual(
      common.chainId(),
      BigInt(80001),
      'supported chain -> should initialize with correct chain ID',
    )
    for (const customChain of Object.values(CustomChain)) {
      common = createCustomCommon(customChain)
      assert.equal(
        common.chainName(),
        customChain,
        `supported chain -> should initialize with enum name (${customChain})`,
      )
    }

    common = createCustomCommon(CustomChain.PolygonMumbai)
    assert.equal(
      common.hardfork(),
      common.DEFAULT_HARDFORK,
      'uses default hardfork when no options are present',
    )

    common = createCustomCommon(CustomChain.OptimisticEthereum, { hardfork: Hardfork.Byzantium })
    assert.equal(
      common.hardfork(),
      Hardfork.Byzantium,
      'should correctly set an option (default options present)',
    )

    try {
      //@ts-ignore TypeScript complains, nevertheless do the test for JS behavior
      createCustomCommon('this-chain-is-not-supported')
      assert.fail('test should fail')
    } catch (e: any) {
      assert.ok(
        e.message.includes('not supported'),
        'supported chain -> should throw if chain name is not supported',
      )
    }
  })

  it('customChains parameter: initialization exception', () => {
    try {
      new Common({ chain: testnet, customChains: [testnet] as ChainConfig[] })
      assert.fail('should throw')
    } catch (e: any) {
      assert.ok(
        e.message.includes(
          'Chain must be a string, number, or bigint when initialized with customChains passed in',
        ),
        'should throw an exception on wrong initialization',
      )
    }
  })

  it('customChains parameter: initialization', () => {
    let c = new Common({
      chain: Chain.Mainnet,
      hardfork: Hardfork.Byzantium,
      customChains: [testnet] as ChainConfig[],
    })
    assert.equal(c.chainName(), 'mainnet', 'customChains, chain set to supported chain')
    assert.equal(c.hardforkBlock()!, BigInt(4370000), 'customChains, chain set to supported chain')

    c.setChain('testnet')
    assert.equal(c.chainName(), 'testnet', 'customChains, chain switched to custom chain')
    assert.equal(c.hardforkBlock()!, BigInt(4), 'customChains, chain switched to custom chain')

    c = new Common({
      chain: 'testnet',
      hardfork: Hardfork.Byzantium,
      customChains: [testnet] as ChainConfig[],
    })
    assert.equal(c.chainName(), 'testnet', 'customChains, chain initialized with custom chain')
    assert.equal(c.hardforkBlock()!, BigInt(4), 'customChains, chain initialized with custom chain')

    const customChains = [testnet, testnet2, testnet3] as ChainConfig[]
    c = new Common({
      chain: 'testnet2',
      hardfork: Hardfork.Istanbul,
      customChains,
    })
    assert.equal(c.chainName(), 'testnet2', 'customChains, chain initialized with custom chain')
    assert.equal(
      c.hardforkBlock()!,
      BigInt(10),
      'customChains, chain initialized with custom chain',
    )

    const customChainParams: Partial<ChainConfig> = {
      name: 'custom',
      chainId: 123,
      depositContractAddress: '0x4242424242424242424242424242424242424242',
    }
    const customChainCommon = createCustomCommon(customChainParams, {
      hardfork: Hardfork.Byzantium,
    })

    assert.equal(
      customChainCommon['_chainParams'].depositContractAddress,
      customChainParams.depositContractAddress,
    )
    c.setChain('testnet')
    assert.equal(c.chainName(), 'testnet', 'customChains, should allow to switch custom chain')
    assert.equal(
      c.consensusType(),
      ConsensusType.ProofOfWork,
      'customChains, should allow to switch custom chain',
    )
  })

  it('customHardforks parameter: initialization and transition tests', () => {
    const c = createCustomCommon({
      customHardforks: {
        // Hardfork to test EIP 2935
        testEIP2935Hardfork: {
          name: 'testEIP2935Hardfork',
          eips: [2935],
        },
      },
      hardforks: [
        {
          name: 'chainstart',
          block: 0,
        },
        {
          name: 'berlin',
          block: null,
          timestamp: 999,
        },
        {
          // Note: this custom hardfork name MUST be in customHardforks as field
          // If this is not the case, Common will throw with a random error
          // Should we throw early with a descriptive error? TODO
          name: 'testEIP2935Hardfork',
          block: null,
          timestamp: 1000,
        },
      ],
    })
    // Note: default HF of Common is currently Shanghai
    // Did not pass any "hardfork" param
    assert.equal(c.hardfork(), Hardfork.Shanghai)
    c.setHardforkBy({
      blockNumber: 0,
    })
    assert.equal(c.hardfork(), Hardfork.Chainstart)
    c.setHardforkBy({
      blockNumber: 1,
      timestamp: 999,
    })
    assert.equal(c.hardfork(), Hardfork.Berlin)
    assert.notOk(c.isActivatedEIP(2935))
    c.setHardforkBy({
      blockNumber: 1,
      timestamp: 1000,
    })
    assert.equal(c.hardfork(), 'testEIP2935Hardfork')
    assert.ok(c.isActivatedEIP(2935))
  })

  it('customHardforks: override params', () => {
    const c = createCustomCommon({
      customHardforks: {
        // Hardfork which changes the gas of STOP from 0 to 10
        stop10Gas: {
          eips: [2935],
          params: {
            stop: BigInt(10),
          },
        },
      },
      hardforks: [
        {
          name: 'chainstart',
          block: 0,
        },
        {
          name: 'stop10Gas',
          block: null,
          timestamp: 1000,
        },
      ],
    })
    c.setHardfork(Hardfork.Chainstart)
    assert.throws(() => {
      c.param('stop')
    })
    c.setHardforkBy({
      blockNumber: 1,
      timestamp: 1000,
    })
    assert.equal(c.hardfork(), 'stop10Gas')
    assert.equal(c.param('stop'), BigInt(10))
  })
})

describe('custom chain setup with hardforks with undefined/null block numbers', () => {
  it('Should work', () => {
    const undefinedHardforks = [
      {
        name: 'chainstart',
        block: 0,
      },
      { name: 'homestead' },
      { name: 'byzantium', block: null },
      { name: 'tangerineWhistle', block: 10 },
    ]

    assert.throws(
      () => createCustomCommon({ hardforks: undefinedHardforks as HardforkTransitionConfig[] }),
      undefined,
      undefined,
      'throws when a hardfork with an undefined block number is passed',
    )

    const nullHardforks = [
      {
        name: 'chainstart',
        block: 0,
      },
      { name: 'homestead', block: null },
      { name: 'tangerineWhistle', block: 10 },
    ]

    const common = createCustomCommon({ hardforks: nullHardforks })
    common.setHardforkBy({ blockNumber: 10n })
    assert.equal('tangerineWhistle', common.hardfork(), 'set correct hardfork')
    common.setHardforkBy({ blockNumber: 3n })
    assert.equal('chainstart', common.hardfork(), 'set correct hardfork')
  })
})
