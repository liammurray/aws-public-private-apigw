import HttpStatus from 'http-status-codes'
import { APIGatewayEvent } from 'aws-lambda'
import _get from 'lodash.get'
import { logger } from './utils'

export type Headers = { [key: string]: string }
export type Body = { [key: string]: any }
export type Response = { [key: string]: any }

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET, OPTIONS, POST',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age = 0',
}

export function getHeaders(hasBody: boolean, _contentType = 'application/json'): Headers {
  let headers: Headers = { ...CORS_HEADERS }
  if (hasBody) {
    headers = { ...headers, 'Content-Type': 'application/json' }
  }
  return headers
}

/**
 * https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-output-format
 */
export function makeResponse(
  body: Body | undefined,
  statusCode: number = HttpStatus.OK,
  err?: any
): Response {
  const bod = body ? { body: JSON.stringify(body) } : undefined
  const response = {
    statusCode,
    headers: getHeaders(!!body),
    ...bod,
  }
  logger.info({ response, err: err instanceof Error ? err.toString() : undefined }, 'Response')
  return response
}

export function makeRedirectResponse(url: string): Response {
  const response = {
    statusCode: 302,
    headers: {
      Location: url,
    },
  }
  logger.info({ response }, 'Redirect')
  return response
}

export function getClientId(event: APIGatewayEvent): string {
  // sub (subject) contains client_id
  return _get(event, 'requestContext.authorizer.claims.sub') || ''
}
