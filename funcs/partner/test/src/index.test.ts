
import { expect } from 'chai'
import sinon from 'sinon'
// import AWS from 'aws-sdk'
import _get from 'lodash.get'
import { APIGatewayEvent } from 'aws-lambda'
import { handler } from '~/index'
import { readMockData, readSwagger } from './utils/readData'
import { OpenAPIV3 } from 'openapi-types'


describe('handler', function() {

  it('should return response', async function() {
    const event = (await readMockData('eventGetOrder')) as APIGatewayEvent

    const response = await handler(event)
    expect(response.statusCode).to.equal(200)
    expect(response.body).to.be.a('string')
    // const body = JSON.parse(response.body!)

    console.log('handler', JSON.stringify(response, null, 2))
    // const schema = _get(swagger, 'components.schemas.GetOrderResponse')
    // console.log('SCHEMA', JSON.stringify(schema, null, 2))
    // expect(body).to.be.jsonSchema(schema)
  })

})
