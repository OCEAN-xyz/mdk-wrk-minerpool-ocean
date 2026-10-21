'use strict'

const { getClient } = require('../client')

module.exports = async () => {
  const { workers } = await getClient().ready
  return workers.filter((worker) => worker.online).length
}
