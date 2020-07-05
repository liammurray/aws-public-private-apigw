import * as cdk from '@aws-cdk/core'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as logs from '@aws-cdk/aws-logs'
import * as apigw from '@aws-cdk/aws-apigateway'
// import * as apigatewayv2 from '@aws-cdk/aws-apigatewayv2'
import { getAllowVpcInvokePolicy } from '../apiGatewayUtils'
import { cfnOutput, LambdaHelper } from '../utils'

const lambdaHelper = new LambdaHelper('../../funcs')

export interface PrivateApiStackProps extends cdk.StackProps {
  readonly vpc: ec2.Vpc
  readonly endpoint: ec2.VpcEndpoint
}

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
    this.addMethods(api.root.addResource('v1'))

    // Outputs (nice)
    cfnOutput(this, 'ApiId', api.restApiId)
    cfnOutput(this, 'ApiUrl', api.url)
  }

  private addMethods(root: apigw.Resource) {
    //const funcVer = new Date().toISOString(
    const envVars = {}

    // GET v1/echo
    const v1Echo = root.addResource('echo')

    lambdaHelper.addPyInt(this, v1Echo, 'GET', 'EchoFunc', 'echo', 'app.info.handler', envVars)
  }
}
