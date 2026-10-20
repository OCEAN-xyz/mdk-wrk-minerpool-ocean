'use strict'

const { getClient } = require('../client')

module.exports = async () => {
  const client = getClient()
  let status = 'OK'
  try {
    await client.ready
  } catch (err) {
    status = 'DEGRADED'
  }
  const ocean = client.alertStatus.ocean
  const datum = client.alertStatus.datum
  if (ocean === 'offline') status = 'OFFLINE'
  else if (datum === 'offline') status = 'DEGRADED'
  return {
    status,
    alerts: (client.alertsData.alerts || []).map((alert) => alert.name)
  }
}
