'use strict'

const DigestClient = require('digest-fetch').default

class DatumApi {
  constructor (http, creds = {}) {
    this._http = http
    if (creds.user && creds.password) {
      this.client = new DigestClient(creds.user, creds.password, { algorithm: 'SHA-256' })
    }
  }

  async _request (apiPath, auth = false) {
    try {
      if (auth) {
        if (!this.client) throw new Error('ERR_DATUM_CREDENTIALS_MISSING')
        const url = apiPath.includes('://') ? apiPath : `${this._http.baseUrl}/${apiPath.replace(/^\//, '')}`
        const response = await this.client.fetch(url, { signal: AbortSignal.timeout(30 * 1000) })
        if (!response.ok) throw new Error(`ERR_DATUM_REQUEST_FAILED: HTTP ${response.status}`)
        return await response.json()
      }
      const { body } = await this._http.get(apiPath, { encoding: 'json' })
      return body
    } catch (e) {
      if (String(e.message).startsWith('ERR_DATUM_')) throw e
      const err = new Error('ERR_DATUM_REQUEST_FAILED')
      err.cause = e
      throw err
    }
  }

  async getDecentralizedClientStats () {
    return await this._request('/v1/decentralized_client_stats')
  }

  async getStratumServerInfo () {
    return await this._request('/v1/stratum_server_info')
  }

  async getCurrentStratumJob () {
    return await this._request('/v1/current_stratum_job')
  }

  async getCoinbaser () {
    return await this._request('/v1/coinbaser')
  }

  async getThreadStats () {
    return await this._request('/v1/thread_stats')
  }

  async getStratumList () {
    return await this._request('/v1/stratum_client_list', true)
  }

  async getConfiguration () {
    return await this._request('/v1/configuration', true)
  }
}

module.exports = DatumApi
