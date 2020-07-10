import * as cdk from '@aws-cdk/core'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as apigw from '@aws-cdk/aws-apigateway'
import * as iam from '@aws-cdk/aws-iam'
import * as logs from '@aws-cdk/aws-logs'
import * as route53 from '@aws-cdk/aws-route53'
import * as certman from '@aws-cdk/aws-certificatemanager'
import * as lambda from '@aws-cdk/aws-lambda'
import { Fn } from '@aws-cdk/core'
import { cfnOutput } from '../utils'
import { LambdaHelper } from '../lambdaUtils'

function invokePolicyStatement(funcArn: string): iam.PolicyStatement {
  return new iam.PolicyStatement({
    resources: [funcArn],
    actions: ['lambda:InvokeFunction'],
  })
}

const lambdaHelper = new LambdaHelper({
  basePath: '../../funcs',
  runtime: lambda.Runtime.PYTHON_3_8,
})
export interface PublicApiStackProps extends cdk.StackProps {
  // Required for route53 hosted zone lookup (can't use environment generic stack)
  readonly env: cdk.Environment
  readonly vpc: ec2.Vpc
  // Regional cert
  readonly certId: string
  // nod15c.com
  readonly domain: string
  // public for public.nod15c.com
  readonly prefix: string
}

/**
 * Stack for demo Private API
 */
export default class PublicRestApiStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, private readonly props: PublicApiStackProps) {
    super(scope, id, props)

    const { account, region } = cdk.Stack.of(this)

    const regionCertArn = `arn:aws:acm:${region}:${account}:certificate/${props.certId}`
    const certificate = certman.Certificate.fromCertificateArn(this, 'cert', regionCertArn)

    const dnsName = `${props.prefix}.${props.domain}`

    /**
     * Public REST API
     *
     * The domain name creates a domain with a root (/) base path mapping to https:<api>/{stage}
     */
    const apiLogGroup = new logs.LogGroup(this, 'PublicRestApiLogs')
    const api = new apigw.RestApi(this, 'PublicRestApi', {
      restApiName: 'Public REST API',
      description: 'Public REST API Demo',
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

    // v1 methods
    this.addMethodsV1(props.vpc, api.root.addResource('v1'))

    // Explicit /xealth/staging/echo calls lambda (bypass greedy proxy path)
    const downstreamFunc = Fn.importValue('PrivateDemoPrivateApi:EchoFuncAliasLive')
    const downstreamFuncArn = `arn:aws:lambda:${region}:${account}:function:${downstreamFunc}`
    lambdaHelper.addMethod(this, api.root.resourceForPath('xealth/staging/echo'), 'GET', {
      funcId: 'CallEchoLambaFuncUnderX',
      dir: 'proxy',
      funcProps: {
        handler: 'app.proxy.callLambda',
        initialPolicy: [invokePolicyStatement(downstreamFuncArn)],
        environment: {
          // my-function:v1 (with/without version/alias) or ARN
          DOWNSTREAM_FUNCTION_NAME: downstreamFunc,
        },
      },
    })

    ////
    //
    // /cats/<*>
    //
    //  /facts
    //  /users
    //
    const catFacts = 'https://cat-fact.herokuapp.com'
    api.root.resourceForPath('cats').addProxy({
      defaultMethodOptions: {
        requestParameters: {
          // Don't cache responses
          'method.request.path.proxy': false,
        },
      },
      defaultIntegration: new apigw.HttpIntegration(`${catFacts}/{proxy}`, {
        httpMethod: 'ANY',
        proxy: true,
        options: {
          requestParameters: {
            'integration.request.path.proxy': 'method.request.path.proxy',
          },
        },
      }),
    })

    const rec = this.addRoute53(dnsName, api)

    // Outputs (nice)
    cfnOutput(this, 'ApiId', api.restApiId)
    cfnOutput(this, 'ApiUrl', api.url)
    cfnOutput(this, 'DomainName', rec.domainName)
  }

  private addMethodsV1(vpc: ec2.Vpc, root: apigw.Resource) {
    const { account, region } = cdk.Stack.of(this)

    // GET v1/echo/lambda
    //   Invokes downstream lambda function
    //
    const downstreamFunc = Fn.importValue('PrivateDemoPrivateApi:EchoFuncAliasLive')
    const downstreamFuncArn = `arn:aws:lambda:${region}:${account}:function:${downstreamFunc}`
    lambdaHelper.addMethod(this, root.resourceForPath('echo/lambda'), 'GET', {
      funcId: 'CallEchoLambaFunc',
      dir: 'proxy',
      funcProps: {
        handler: 'app.proxy.callLambda',
        initialPolicy: [invokePolicyStatement(downstreamFuncArn)],
        environment: {
          // my-function:v1 (with/without version/alias) or ARN
          DOWNSTREAM_FUNCTION_NAME: downstreamFunc,
        },
      },
    })

    const downstreamApi = Fn.importValue('PrivateDemoPrivateApi:ApiVpceUrl')
    // Creates something like: ${Token[TOKEN.505]}v1/echo
    // That then transforms to Fn::Join with Fn:Import in template
    const downstreamEndpoint = `${downstreamApi}v1/echo`

    const sg = new ec2.SecurityGroup(this, 'Outbound443SecurityGroup   ', {
      vpc,
      description: 'Allow outbound TCP 443',
    })
    sg.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS anywhere')

    // GET v1/echo/api
    //   Attached to VPC isolated subnet
    //   Call private API endpoint
    //
    lambdaHelper.addMethod(this, root.resourceForPath('echo/api'), 'GET', {
      funcId: 'CallEchoApiFunc',
      dir: 'proxy',
      funcProps: {
        handler: 'app.proxy.callEndpoint',
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.ISOLATED },
        securityGroup: sg,
        environment: {
          DOWNSTREAM_ENDPOINT: downstreamEndpoint,
        },
      },
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
