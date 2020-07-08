import { logger } from './utils'

import { Response, makeResponse, getClientId } from './httpUtil'
import HttpStatus from 'http-status-codes'
import { APIGatewayEvent } from 'aws-lambda'

logger.info({ env: process.env }, 'Loading function')

export async function handler(event: APIGatewayEvent): Promise<Response> {
  const clientId = getClientId(event)

  try {
    const res = { code: 'itWorked', clientId, resource: event.resource, method: event.httpMethod }
    return makeResponse(res, HttpStatus.OK)
  } catch (err) {
    return makeResponse(undefined, HttpStatus.INTERNAL_SERVER_ERROR, err)
  }
}
