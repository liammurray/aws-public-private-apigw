import * as cdk from '@aws-cdk/core'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as apigw from '@aws-cdk/aws-apigateway'
import * as logs from '@aws-cdk/aws-logs'
import * as route53 from '@aws-cdk/aws-route53'
import * as lambda from '@aws-cdk/aws-lambda'
import * as certman from '@aws-cdk/aws-certificatemanager'
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2'

import { addCorsOptions, getAllowVpcInvokePolicy } from '../apiGatewayUtils'
import { LambdaHelper, cfnOutput } from '../utils'

const lambdaHelper = new LambdaHelper('../../funcs')

export interface PublicApiStackProps extends cdk.StackProps {
  // Required for route53 hosted zone lookup (can't use environment generic stack)
  readonly env: cdk.Environment
  readonly vpc: ec2.Vpc
  readonly nlb?: elbv2.NetworkLoadBalancer
  readonly echoFuncName: string
  // Regional cert
  readonly certId: string
  // nod15c.com
  readonly domain: string
  // public for public.nod15c.com
  readonly prefix: string
}

export default class PublicApiStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, private readonly props: PublicApiStackProps) {
    super(scope, id, props)

    const { account, region } = cdk.Stack.of(this)

    const regionCertArn = `arn:aws:acm:${region}:${account}:certificate/${props.certId}`
    const certificate = certman.Certificate.fromCertificateArn(this, 'cert', regionCertArn)

    const dnsName = `${props.prefix}.${props.domain}`

    // const integration = new apigw.Integration({
    //   type: apigw.IntegrationType.HTTP_PROXY,
    //   options: {
    //     connectionType: apigw.ConnectionType.VPC_LINK,
    //     vpcLink: link,
    //   },
    // })

    /**
     * Private API Gateway
     *
     * Associating with vpc endpoint generates new route 53 alias for you
     * https://{rest-api-id}-{vpce-id}.execute-api.{region}.amazonaws.com/{stage}
     */
    const apiLogGroup = new logs.LogGroup(this, 'PublicApiLogs')
    const api = new apigw.RestApi(this, 'PublicApi', {
      restApiName: 'Public Service',
      description: 'Public API with VpcLink',
      endpointConfiguration: {
        types: [apigw.EndpointType.REGIONAL],
      },
      domainName: {
        certificate,
        // public.nod15c.com
        domainName: dnsName,
        endpointType: apigw.EndpointType.REGIONAL,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS, // this is also the default
      },
      deployOptions: {
        loggingLevel: apigw.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        stageName: 'active',
        accessLogDestination: new apigw.LogGroupLogDestination(apiLogGroup),
        accessLogFormat: apigw.AccessLogFormat.jsonWithStandardFields(),
      },
    })

    // const link = new apigw.VpcLink(this, 'link', {
    //   targets: [this.props.nlb],
    // })

    // const integration = new apigw.Integration({
    //   type: apigw.IntegrationType.HTTP_PROXY,
    //   integrationHttpMethod: 'ANY',
    //   options: {
    //     connectionType: apigw.ConnectionType.VPC_LINK,
    //     vpcLink: link,
    //   },
    // })

    // v1 methods
    this.addMethods(api.root.addResource('v1'))

    const rec = this.addRoute53(dnsName, api)

    // Outputs (nice)
    cfnOutput(this, 'ApiId', api.restApiId)
    cfnOutput(this, 'ApiUrl', api.url)
    cfnOutput(this, 'DomainName', rec.domainName)
  }

  private addMethods(root: apigw.Resource) {
    // item.addMethod('DELETE', new apigateway.HttpIntegration('http://amazon.com'));

    //////
    // v1/echo
    //  fuction name is my-function:v1 (with/without version/alias) or ARN
    //  TODO
    //   1) one that calls API
    //   2) one that calls lambda service (other stack)
    //
    const echo = root.addResource('echo')
    lambdaHelper.addPyInt(this, echo, 'GET', 'ProxyFunc', 'proxy', 'app.proxy.handler', {
      DOWNSTREAM_FUNCTION_NAME: this.props.echoFuncName,
    })
  }

  private addRoute53(dnsName: string, api: apigw.RestApi) {
    const apex = `${dnsName.split('.').filter(Boolean).slice(-2).join('.')}.`
    const zone = route53.HostedZone.fromLookup(this, 'zone', {
      domainName: apex,
    })
    if (!api.domainName) {
      throw new Error('Whoops!')
    }
    return new route53.ARecord(this, 'aRecord', {
      zone,
      recordName: dnsName,
      target: route53.AddressRecordTarget.fromAlias({
        bind: (): route53.AliasRecordTargetConfig => ({
          dnsName: api.domainName!.domainNameAliasDomainName,
          hostedZoneId: api.domainName!.domainNameAliasHostedZoneId,
        }),
      }),
    })
  }
}

// TODO allow user to invoke any lambda with tag service=foo
//
// iamUser.attachInlinePolicy(new iam.Policy(this, 'AllowBooks', {
//   statements: [
//     new iam.PolicyStatement({
//       actions: [ 'execute-api:Invoke' ],
//       effect: iam.Effect.Allow,
//       resources: [ getBooks.methodArn() ]
//     })
//   ]
// })
