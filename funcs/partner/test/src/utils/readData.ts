import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import SwaggerParser from '@apidevtools/swagger-parser'
import { OpenAPI } from 'openapi-types'
import AWS from 'aws-sdk'

const writeFile = promisify(fs.writeFile)
const readFile = promisify(fs.readFile)

function resolve(basename: string, ext = 'json'): string {
  return path.resolve(__dirname, '../../data', `${basename}.${ext}`)
}

export async function saveMockData(basename: string, resp: object): Promise<void> {
  return writeFile(resolve(basename), JSON.stringify(resp, null, 2), 'utf8')
}

export async function readMockData(basename: string): Promise<object> {
  return readFile(resolve(basename), 'utf8').then(JSON.parse)
}

export async function readSwagger(basename: string): Promise<OpenAPI.Document> {
  const parser = new SwaggerParser()
  return parser.dereference(resolve(basename, 'yml'))
}

export async function resolveSwagger(basename: string): Promise<SwaggerParser.$Refs> {
  const parser = new SwaggerParser()
  return parser.resolve(resolve(basename, 'yml'))
}

export function readMockDataSync(basename: string): object {
  return JSON.parse(fs.readFileSync(resolve(basename), 'utf-8'))
}

export function hookAwsRequests<T extends AWS.Service>(proto: T, prefix: string) {
  const makeRequest = proto.makeRequest

  // tslint:disable no-any no-unsafe-any no-invalid-this
  proto.makeRequest = function(
    operation: string,
    params?: { [key: string]: any },
    callback?: (err: AWS.AWSError, data: any) => void
  ) {
    // Call the original
    const request: AWS.Request<any, AWS.AWSError> = makeRequest.call(
      this,
      operation,
      params,
      callback
    )

    // Capture response
    request
      .promise()
      .then(async resp => {
        return saveMockData(`${prefix}-${operation}`, resp)
      })
      .catch(console.error)
    // Return request (expect our code to use .promise)
    return request
  }
  // tslit:enable no-any no-invalid-this
  return makeRequest
}
