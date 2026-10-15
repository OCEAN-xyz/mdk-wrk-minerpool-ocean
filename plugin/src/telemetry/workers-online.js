'use strict'

module.exports = async (ctx) => {
  return (ctx.device.data.workersData.workers || []).filter((w) => w.online).length
}
