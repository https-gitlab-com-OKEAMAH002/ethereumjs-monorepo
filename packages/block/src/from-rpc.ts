import { type TypedTransaction, createTxFromTxData } from '@ethereumjs/tx'
import {
  CLRequestFactory,
  TypeOutput,
  hexToBytes,
  setLengthLeft,
  toBytes,
  toType,
} from '@ethereumjs/util'

import { createBlockFromBlockData } from './constructors.js'
import { blockHeaderFromRpc } from './header-from-rpc.js'

import type { BlockOptions, JsonRpcBlock } from './index.js'
import type { PrefixedHexString } from '@ethereumjs/util'

function normalizeTxParams(_txParams: any) {
  const txParams = Object.assign({}, _txParams)

  txParams.gasLimit = toType(txParams.gasLimit ?? txParams.gas, TypeOutput.BigInt)
  txParams.data = txParams.data === undefined ? txParams.input : txParams.data

  // check and convert gasPrice and value params
  txParams.gasPrice = txParams.gasPrice !== undefined ? BigInt(txParams.gasPrice) : undefined
  txParams.value = txParams.value !== undefined ? BigInt(txParams.value) : undefined

  // strict byte length checking
  txParams.to =
    txParams.to !== null && txParams.to !== undefined
      ? setLengthLeft(toBytes(txParams.to), 20)
      : null

  txParams.v = toType(txParams.v, TypeOutput.BigInt)

  return txParams
}

/**
 * Creates a new block object from Ethereum JSON RPC.
 *
 * @param blockParams - Ethereum JSON RPC of block (eth_getBlockByNumber)
 * @param uncles - Optional list of Ethereum JSON RPC of uncles (eth_getUncleByBlockHashAndIndex)
 * @param options - An object describing the blockchain
 * @deprecated
 */
export function createBlockFromRpc(
  blockParams: JsonRpcBlock,
  uncles: any[] = [],
  options?: BlockOptions,
) {
  const header = blockHeaderFromRpc(blockParams, options)

  const transactions: TypedTransaction[] = []
  const opts = { common: header.common }
  for (const _txParams of blockParams.transactions ?? []) {
    const txParams = normalizeTxParams(_txParams)
    const tx = createTxFromTxData(txParams, opts)
    transactions.push(tx)
  }

  const uncleHeaders = uncles.map((uh) => blockHeaderFromRpc(uh, options))

  const requests = blockParams.requests?.map((req) => {
    const bytes = hexToBytes(req as PrefixedHexString)
    return CLRequestFactory.fromSerializedRequest(bytes)
  })
  return createBlockFromBlockData(
    { header, transactions, uncleHeaders, withdrawals: blockParams.withdrawals, requests },
    options,
  )
}
