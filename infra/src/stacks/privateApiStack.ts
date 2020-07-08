import * as cdk from '@aws-cdk/core'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as logs from '@aws-cdk/aws-logs'
import * as apigw from '@aws-cdk/aws-apigateway'
import * as lambda from '@aws-cdk/aws-lambda'
// import * as apigatewayv2 from '@aws-cdk/aws-apigatewayv2'
import { getAllowVpcInvokePolicy } from '../apiGatewayUtils'
import { cfnOutput } from '../utils'
import { LambdaHelper } from '../lambdaUtils'

const lambdaHelper = new LambdaHelper({
  basePath: '../../funcs',
  runtime: lambda.Runtime.PYTHON_3_8,
})

export interface PrivateApiStackProps extends cdk.StackProps {
  readonly vpc: ec2.Vpc
  readonly endpoint: ec2.VpcEndpoint
}

/**
 * Stack for demo Private API
 */
export default class PrivateApiStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: PrivateApiStackProps) {
    super(scope, id, props)

    /**
     * Private API Gateway
     *
     * https://docs.aws.amazon.com/apigateway/latest/developerguide/getting-started-with-private-integration.html
     *
     * Associating with vpc endpoint generates new route 53 alias for you
     * https://{rest-api-id}-{vpce-id}.execute-api.{region}.amazonaws.com/{stage}
     */
    const apiLogGroup = new logs.LogGroup(this, 'PrivateApiLogs')
    const api = new apigw.RestApi(this, 'PrivateApi', {
      restApiName: 'Private API Service',
      description: 'Private API',
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

    // Stand-alone lambda (not integrated with API but just added to stack)
    lambdaHelper.addLambda(this, {
      funcId: 'EchoFunc',
      dir: 'echo',
      export: true,
      alias: 'live',
      funcProps: {
        handler: 'app.info.handler',
      },
    })

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
    const { account, region } = cdk.Stack.of(this)

    //const allowedCaller = `arn:aws:lambda:${region}:${account}:function:${downstreamFunc}`

    // GET v1/echo
    lambdaHelper.addMethod(this, root.resourceForPath('echo'), 'GET', {
      funcId: 'ApiEchoFunc',
      dir: 'echo',
      // initialPolicy: [allowInvokePolicyStatement(downstreamFuncArn)],
      funcProps: {
        handler: 'app.info.handler',
      },
    })

    // function invokePolicyStatement(funcArn: string): iam.PolicyStatement {
    //   return new iam.PolicyStatement({
    //     resources: [funcArn],
    //     actions: ['lambda:InvokeFunction'],
    //   })
    // }

    // starts with arn:aws:lambda:us-west-2:958019638877:function:PrivateDemoPublicApi-

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
