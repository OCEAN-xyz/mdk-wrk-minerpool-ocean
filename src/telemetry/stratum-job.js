'use strict'

const { getClient } = require('../client')

module.exports = async () => {
  await getClient().ready
  return getClient().datumCall('getCurrentStratumJob', 'ERR_STRATUM_JOB_FETCH')
}
