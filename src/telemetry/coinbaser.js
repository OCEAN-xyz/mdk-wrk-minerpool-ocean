'use strict'

const { getClient } = require('../client')

module.exports = async () => {
  await getClient().ready
  return getClient().datumCall('getCoinbaser', 'ERR_COINBASER_FETCH')
}
