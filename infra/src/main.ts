#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from '@aws-cdk/core'
import PrivateApiStack from './stacks/privateApiStack'
import PublicApiStack from './stacks/publicApiStack'
import VpcStack from './stacks/vpcStack'

import { getStringParams, getCallerAccount } from './awsUtils'

const app = new cdk.App()

// https://docs.aws.amazon.com/cdk/latest/guide/get_context_var.html
// async function getContextOrSsm(app: cdk.App, name: string, path: string) {
//   let val = app.node.tryGetContext(name)
//   if (val === undefined) {
//     ;[val] = await getStringParams(path)
//   }
//   return val
// }

getCallerAccount().then(async account => {
  const env = {
    account,
    region: process.env.AWS_REGION || 'us-west-2',
  }

  // Get external env from SSM (also could use context or imports)
  const [certId, domain] = await getStringParams(
    '/cicd/common/certs/us-west-2',
    '/cicd/common/domain'
  )

  const vpc = new VpcStack(app, 'PrivateDemoVpc', {
    env,
    cidr: '10.1.0.0/16',
    includeNlb: true,
  })
  new PrivateApiStack(app, 'PrivateDemoPrivateApi', {
    env,
    vpc: vpc.vpc,
    endpoint: vpc.vpcEndpoint,
  })

  new PublicApiStack(app, 'PrivateDemoPublicApi', {
    env,
    vpc: vpc.vpc,
    nlb: vpc.nlb,
    certId,
    domain,
    prefix: 'public', // Used to form DNS name: public.nod15c.com
  })
})
