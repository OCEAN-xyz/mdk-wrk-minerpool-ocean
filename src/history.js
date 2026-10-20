'use strict'

const { HOUR_MS, HOURS_24_MS, MINUTE_MS, BTC_SATS } = require('./lib/constants')
const { getTimeRanges } = require('./lib/utils')

const INTERVALS = {
  '5m': 5 * MINUTE_MS,
  '30m': 30 * MINUTE_MS,
  '3h': 3 * HOUR_MS,
  '1D': HOURS_24_MS
}

function requireRange (params = {}) {
  if (params.start == null) throw new Error('ERR_START_INVALID')
  if (params.end == null) throw new Error('ERR_END_INVALID')
  if (!Number.isFinite(Number(params.start)) || !Number.isFinite(Number(params.end))) {
    throw new Error('ERR_RANGE_INVALID')
  }
}

function inRange (rows, params) {
  requireRange(params)
  return rows
    .filter((row) => row.ts >= Number(params.start) && row.ts <= Number(params.end))
    .sort((a, b) => a.ts - b.ts)
}

function aggregateStats (rows, interval) {
  const intervalMs = INTERVALS[interval]
  if (!intervalMs) throw new Error('ERR_INTERVAL_INVALID')
  const buckets = new Map()
  for (const row of rows) {
    const ts = Math.ceil(row.ts / intervalMs) * intervalMs
    if (!buckets.has(ts)) buckets.set(ts, [])
    buckets.get(ts).push(row)
  }
  return [...buckets.entries()].map(([ts, items]) => {
    const stats = (items[0].stats || []).map((stat, index) => {
      const values = items.map((item) => Number(item.stats?.[index]?.hashrate) || 0)
      const hashrate = values.reduce((sum, value) => sum + value, 0) / values.length
      return { ...stat, hashrate }
    })
    return { ...items[items.length - 1], ts: Number(ts), stats }
  })
}

function aggregateTransactions (rows, params) {
  const total = rows.reduce((sum, row) => {
    for (const tx of row.transactions || []) sum += tx.satoshis_net_earned || 0
    return sum
  }, 0)
  const ranges = getTimeRanges(Number(params.start), Number(params.end))
  if (!ranges.length) return { ts: Date.now(), hourlyRevenues: [] }
  const revenue = (total / ranges.length) / BTC_SATS
  return {
    ts: Date.now(),
    hourlyRevenues: ranges.map(({ end }) => ({ ts: end, revenue }))
  }
}

function poolBlocks (blocks) {
  const totals = blocks.reduce((acc, block) => {
    acc.totalDifficulty += block.networkDifficulty || 0
    acc.totalShares += block.poolShares || 0
    acc.totalBlocksLuck += block.luck || 0
    return acc
  }, { totalDifficulty: 0, totalShares: 0, totalBlocksLuck: 0 })
  return {
    ts: Date.now(),
    blocksData: {
      blocks,
      allBlocksLuck: totals.totalShares > 0 ? (totals.totalDifficulty / totals.totalShares) * 100 : 0,
      adjustedLuck: blocks.length ? (totals.totalBlocksLuck / blocks.length) * 100 : 0
    }
  }
}

function monthlyBlocks (blocks) {
  const buckets = {}
  for (const block of blocks) {
    const ts = new Date(block.ts)
    const key = `${ts.getFullYear()}-${ts.getMonth() + 1}`
    if (!buckets[key]) buckets[key] = { size: 0, totalDifficulty: 0, totalShares: 0, totalBlocksLuck: 0 }
    buckets[key].totalDifficulty += block.networkDifficulty || 0
    buckets[key].totalShares += block.poolShares || 0
    buckets[key].totalBlocksLuck += block.luck || 0
    buckets[key].size++
  }
  const blocksData = {}
  for (const [key, block] of Object.entries(buckets)) {
    blocksData[key] = {
      poolLuck: block.totalShares > 0 ? (block.totalDifficulty / block.totalShares) * 100 : 0,
      siteLuck: block.size > 0 ? (block.totalBlocksLuck / block.size) * 100 : 0
    }
  }
  return { ts: Date.now(), blocksData }
}

module.exports = {
  inRange,
  aggregateStats,
  aggregateTransactions,
  poolBlocks,
  monthlyBlocks
}
