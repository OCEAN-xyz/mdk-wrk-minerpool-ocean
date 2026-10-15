'use strict'

module.exports = async (ctx) => {
  const stats = ctx.device.data.statsData.stats || []
  return stats.reduce((sum, s) => sum + (s.estimated_earn_next_block || 0), 0)
}
