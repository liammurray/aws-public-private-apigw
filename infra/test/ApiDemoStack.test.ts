import { expect as cdkExpect, haveResource, MatchStyle, matchTemplate } from '@aws-cdk/assert'
import { SynthUtils } from '@aws-cdk/assert'

import * as cdk from '@aws-cdk/core'
import PrivateApiStack from '../src/stacks/privateApiStack'

describe('Build pipeline stack', () => {
  let stack: PrivateApiStack

  beforeAll(() => {
    const app = new cdk.App()

    stack = new PrivateApiStack(app, 'test-stack')
  })
  xtest('Matches snapshot', () => {
    expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot()
  })
  xtest('Has resources', () => {
    cdkExpect(stack).to(
      haveResource('AWS::CodePipeline::Pipeline', {
        Name: '',
      })
    )
  })
  test('Match resources', () => {
    cdkExpect(stack).to(
      matchTemplate(
        {
          Resources: {},
        },
        MatchStyle.EXACT
      )
    )
  })
})
