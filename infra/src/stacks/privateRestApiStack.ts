import * as cdk from '@aws-cdk/core'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as logs from '@aws-cdk/aws-logs'
import * as apigw from '@aws-cdk/aws-apigateway'
import * as lambda from '@aws-cdk/aws-lambda'

import { getAllowVpcInvokePolicy } from '../apiGatewayUtils'
import { cfnOutput } from '../utils'
import { LambdaHelper } from '../lambdaUtils'

const lambdaHelper = new LambdaHelper({
  basePath: '../../funcs',
  runtime: lambda.Runtime.PYTHON_3_8,
})

export interface PrivateRestApiStackProps extends cdk.StackProps {
  readonly vpc: ec2.Vpc
  readonly endpoint: ec2.VpcEndpoint
}

/**
 * Stack for demo Private API
 */
export default class PrivateApiStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: PrivateRestApiStackProps) {
    super(scope, id, props)

    /**
     * Private REST API
     */
    const apiLogGroup = new logs.LogGroup(this, 'PrivateRestApiLogs')
    const api = new apigw.RestApi(this, 'PrivateRestApi', {
      restApiName: 'Private REST API',
      description: 'Private REST API Demo',
      // Generates Route53: https://{rest-api-id}-{vpce-id}.execute-api.{region}.amazonaws.com/{stage}
      endpointConfiguration: {
        types: [apigw.EndpointType.PRIVATE],
        vpcEndpoints: [props.endpoint],
      },
      policy: getAllowVpcInvokePolicy(props.vpc.vpcId),
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
      },
      deployOptions: {
        loggingLevel: apigw.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        stageName: 'active',
        accessLogDestination: new apigw.LogGroupLogDestination(apiLogGroup),
        accessLogFormat: apigw.AccessLogFormat.jsonWithStandardFields(),
      },
    })

    // v1 methods
    this.addMethodsV1(api.root.addResource('v1'))

    // Stand-alone lambda (not integrated with API but just added to stack for convenience)
    lambdaHelper.addLambda(this, {
      funcId: 'EchoFuncStandAlone',
      dir: 'echo',
      export: true,
      alias: 'live',
      funcProps: {
        handler: 'app.info.handler',
      },
    })

    // Adds invoke f2 permission to f1
    // f2.grantInvoke(f1)

    // const { account, region } = cdk.Stack.of(this)

    // Lambdas part of public API have stack prefix (would include env for env-specific API)
    // const allowdPrefix = 'PublicPrivateApiDemo'
    // const allowedCaller = `arn:aws:lambda:${region}:${account}:function:${allowdPrefix}-`
    // const policyOpts = {
    //   conditions: {
    //     'arn:like': {
    //       'aws:SourceArn': allowedCaller,
    //     },
    //   },
    // }

    // const allowCallerPolicy = new iam.PolicyStatement({
    //   actions: ['lambda:InvokeFunction'],
    // })

    // Form usable API endpoint that goes through VPC endpoint
    const prefix = `${api.restApiId}-${props.endpoint.vpcEndpointId}`
    const apiVpceUrl = api.url.replace(api.restApiId, prefix)

    cfnOutput(this, 'ApiId', api.restApiId)
    cfnOutput(this, 'ApiUrl', api.url, false, {
      description: 'The default API URL. Since it is private it is not accessible.',
    })
    cfnOutput(this, 'ApiVpceUrl', apiVpceUrl, true, {
      description: 'The usable API URL that provides access via the VPC endpoint.',
    })
  }

  private addMethodsV1(root: apigw.Resource) {
    // GET v1/echo
    lambdaHelper.addMethod(this, root.resourceForPath('echo'), 'GET', {
      funcId: 'ApiEchoFunc',
      dir: 'echo',
      // initialPolicy: [allowInvokePolicyStatement(downstreamFuncArn)],
      funcProps: {
        handler: 'app.info.handler',
      },
    })

    // POST v1/partner/message
    lambdaHelper.addMethod(this, root.resourceForPath('partner/message'), 'POST', {
      funcId: 'ApiPartnerMessageFunc',
      dir: 'partner',
      funcProps: {
        runtime: lambda.Runtime.NODEJS_12_X,
        handler: 'index.handler',
        environment: {
          // For logger
          SERVICE_NAME: 'PrivateApi',
        },
      },
    })
  }
}
