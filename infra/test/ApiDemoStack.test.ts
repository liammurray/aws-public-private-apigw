import { expect as cdkExpect, haveResource, MatchStyle, matchTemplate } from '@aws-cdk/assert'
import { SynthUtils } from '@aws-cdk/assert'

import * as cdk from '@aws-cdk/core'
import PrivateApiStack from '../src/stacks/privateRestApiStack'
import VpcStack from '../src/stacks/VpcStack'

describe('Build pipeline stack', () => {
  let stack: PrivateApiStack

  beforeAll(() => {
    const env = {
      account: '12345',
      region: 'us-west-2',
    }
    const app = new cdk.App()

    const vpc = new VpcStack(app, 'PrivateDemoVpc', {
      env,
      cidr: '10.1.0.0/16',
    })

    stack = new PrivateApiStack(app, 'PrivateDemoPrivateApi', {
      env,
      vpc: vpc.vpc,
      endpoint: vpc.vpcEndpoint,
    })
  })
  xtest('Matches snapshot', () => {
    expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot()
  })
  test('Has resources', () => {
    cdkExpect(stack).to(
      haveResource('AWS::ApiGateway::Method', {
        HttpMethod: 'POST',
      })
    )
  })
})
