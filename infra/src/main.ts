#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from '@aws-cdk/core'
import PrivateApiStack from './stacks/privateApiStack'
import PublicApiStack from './stacks/publicApiStack'
import VpcStack from './stacks/vpcStack'

import { getStringParams, getCallerAccount } from './awsUtils'

const app = new cdk.App()

getCallerAccount().then(async account => {
  const env = {
    account,
    region: process.env.AWS_REGION || 'us-west-2',
  }
  const [certId, domain] = await getStringParams(
    '/cicd/common/certs/us-west-2',
    '/cicd/common/domain'
  )

  const vpc = new VpcStack(app, 'PrivateDemoVpc', {
    includeNlb: false,
  })
  new PrivateApiStack(app, 'PrivateDemoPrivateApi', {
    vpc: vpc.vpc,
    endpoint: vpc.vpcEndpoint,
  })

  // test
  //   1) vpc link to private api
  //   2) lambda connected to vpc to private api
  //   3) lambda invoke lambda
  //
  // partner.nod15c.com -> base path map to live/partner
  // public.nod15c.com -> base path map to live/
  //
  new PublicApiStack(app, 'PrivateDemoPublicApi', {
    env,
    vpc: vpc.vpc,
    //nlb: vpc.nlb,
    echoFuncName: 'TODO',
    certId,
    domain,
    prefix: 'public', // Used to form DNS name: public.nod15c.com
  })
})
