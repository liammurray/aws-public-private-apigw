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
import { Pricing } from 'aws-sdk'

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

type StrStrMap = { [key: string]: string }

/**
 * Returns policy document that allows invoke if "Team" tag (on principal) matches
 */
function getStatementsAllowInvokeTagBased(tags: StrStrMap): iam.PolicyStatement[] {
  // See: https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-resource-policies-examples.html
  //  Using api.arnForExecuteApi() creates circular dependency error
  //  The resources is fixed
  const out = []

  const eqs: StrStrMap = {}
  for (const [tag, value] of Object.entries(tags)) {
    // ResourceTag does not work--not available for "invoke" action
    // eqs[`aws:ResourceTag/${tag}`] = '${' + `aws:PrincipalTag/${tag}` + '}'
    eqs[`aws:PrincipalTag/${tag}`] = value
  }

  out.push(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['execute-api:Invoke', 'execute-api:InvalidateCache'],
      // resources: [api.arnForExecuteApi()],
      resources: ['execute-api:/*'],
      conditions: {
        StringEquals: eqs,
      },
      principals: [new iam.AnyPrincipal()],
    })
  )
  // out.push(
  //   new iam.PolicyStatement({
  //     effect: iam.Effect.DENY,
  //     actions: ['execute-api:Invoke'],
  //     resources: ['execute-api:/*'],
  //     conditions: {
  //       Null: {
  //         'aws:RequestTag/Team': true,
  //       },
  //     },
  //     principals: [new iam.AnyPrincipal()],
  //   })
  // )
  return out
}

export interface PublicApiStackProps extends cdk.StackProps {
  // Required for route53 hosted zone lookup (can't use environment generic stack)
  readonly env: cdk.Environment
  readonly vpc: ec2.Vpc
  // Regional cert
  readonly certId: string
  // public.nod15c.com
  readonly dnsAlias: string
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
      policy: new iam.PolicyDocument({
        statements: getStatementsAllowInvokeTagBased({ Team: 'demo' }),
      }),
      domainName: {
        certificate,
        // public.nod15c.com
        domainName: props.dnsAlias,
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

    // Resource tags be used for controlling access for apigateway actions but not execute-api
    cdk.Tag.add(api, 'ServiceType', 'demo')
    cfnOutput(this, 'ApiId', api.restApiId)
    cfnOutput(this, 'ApiUrl', api.url)

    // https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-control-access-using-iam-policies-to-invoke-api.html
    // https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-iam-policy-examples-for-api-execution.html

    // Our customer managed policies (can be attached to multiple roles)
    const invokeDemoApisPolicy = this.createInvokeDemoApisPolicy()
    const invokeThisApiPolicy = this.createInvokeThisApiPolicy(api)

    this.createFullAccessGroup(api)
    this.createTeamRole(invokeDemoApisPolicy, 'PublicDemoRoleTeamDemo', 'demo')
    this.createTeamRole(invokeDemoApisPolicy, 'PublicDemoRoleTeamDevs', 'devs')
    this.createTeamRole(invokeDemoApisPolicy, 'PublicDemoRoleTeamDemoVanilla', 'demo', false)
    this.createTeamRole(invokeDemoApisPolicy, 'PublicDemoRoleTeamDevsVanilla', 'devs', false)
    this.createDemoRoleAllAccess(invokeThisApiPolicy, 'PublicDemoRoleGeneric')
    this.createDemoRole3()

    // v1/echo/lambda

    // v1 methods
    this.addMethodsV1(api, props.vpc, api.root.addResource('v1'))

    // Mostly for {proxy+} paths to external http integration
    this.addMethodsNonVersioned(api.root)

    const rec = this.addRoute53(props.dnsAlias, api)

    // Outputs (nice)

    cfnOutput(this, 'DomainName', rec.domainName)
  }

  /**
   * Attach to role (or user or group).
   */
  private createInvokeDemoApisPolicy(): iam.Policy {
    const { account, region } = cdk.Stack.of(this)

    return new iam.Policy(this, 'InvokeDemoApis', {
      policyName: 'InvokeDemoApisPolicy',
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['execute-api:Invoke', 'execute-api:InvalidateCache'],
          resources: [`arn:aws:execute-api:${region}:${account}:*`],
          conditions: {
            StringEquals: {
              // Can't use ResourceTag for Invoke action
              // 'aws:ResourceTag/Team': 'demo',
              'aws:PrincipalTag/Team': 'demo',
            },
          },
        }),
      ],
    })
  }

  private createInvokeThisApiPolicy(api: apigw.RestApi): iam.Policy {
    //const { account, region } = cdk.Stack.of(this)
    return new iam.Policy(this, 'InvokePublicDemoApis', {
      policyName: 'InvokePublicDemoApiPolicy',
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['execute-api:Invoke', 'execute-api:InvalidateCache'],
          resources: [api.arnForExecuteApi()],
        }),
      ],
    })
  }

  private createTeamRole(
    invokeDemoApisPolicy: iam.Policy,
    roleName: string,
    teamName: string,
    attachPolicy = true
  ): iam.Role {
    const role = new iam.Role(this, roleName, {
      roleName,
      assumedBy: new iam.AccountRootPrincipal(),
      description: `Role tagged Team ${teamName} for PublicApiDemo access`,
    })
    if (attachPolicy) {
      invokeDemoApisPolicy.attachToRole(role)
    }
    cdk.Tag.add(role, 'Team', teamName)
    cfnOutput(this, `${roleName}Name`, role.roleName)
    return role
  }

  private createDemoRoleAllAccess(invokeThisApiPolicy: iam.Policy, roleName: string): iam.Role {
    const role = new iam.Role(this, roleName, {
      roleName,
      assumedBy: new iam.AccountRootPrincipal(),
      description: 'Role that can access Public Demo API',
    })
    invokeThisApiPolicy.attachToRole(role)
    cfnOutput(this, `${roleName}Name`, role.roleName)
    return role
  }

  private createDemoRole3() {
    const { account, region } = cdk.Stack.of(this)

    const roleName = 'PublicDemoRole3'
    const role = new iam.Role(this, roleName, {
      roleName,
      assumedBy: new iam.AccountRootPrincipal(),
      description: 'Role that invoke any API and use GET with Team demo',
    })
    role.addToPolicy(
      // execute-api:Invoke doesn't appear to support aws:ResourceTag condition
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['execute-api:Invoke'],
        resources: [`arn:aws:execute-api:${region}:${account}:*`],
      })
    )
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['apigateway:GET'],
        resources: [`arn:aws:apigateway:${region}:${account}:/*`],
        conditions: {
          StringEquals: {
            'aws:ResourceTag/Team': 'demo',
          },
        },
      })
    )
  }

  /**
   * Group that can invoke anything on the public API
   */
  private createFullAccessGroup(api: apigw.RestApi): iam.Group {
    const group = new iam.Group(this, 'PublicApiFullAccessGroup')
    // Could add ALLOW sts:AssumeRole for role that has this policy
    new iam.Policy(this, 'PublicApiFullAccessPolicy', {
      groups: [group],
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['execute-api:Invoke'],
          resources: [api.arnForExecuteApi()],
        }),
      ],
    })
    cfnOutput(this, 'ApiFullAccessGroup', group.groupName)
    return group
  }

  private addMethodsNonVersioned(root: apigw.IResource) {
    const { account, region } = cdk.Stack.of(this)

    //
    // Pass through methods (outside v1)
    //
    // Explicit path override:
    //
    //   /cats/echo -> calls lambda (bypass greedy proxy path under /cats/{proxy+} below
    //
    const downstreamFunc = Fn.importValue('PrivateDemoPrivateApi:EchoFuncAliasLive')
    const downstreamFuncArn = `arn:aws:lambda:${region}:${account}:function:${downstreamFunc}`
    lambdaHelper.addMethod(this, root.resourceForPath('cats/echo'), 'GET', {
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
    // /cats/{proxy +}
    //
    // Examples:
    //
    //  /cats/facts
    //  /cats/users
    //
    const catFacts = 'https://cat-fact.herokuapp.com'
    root.resourceForPath('cats').addProxy({
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
  }

  private addMethodsV1(api: apigw.RestApi, vpc: ec2.Vpc, root: apigw.Resource) {
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
    // https://stackoverflow.com/questions/39352648/access-aws-api-gateway-with-iam-roles-from-python
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

    // GET v1/echo/iam
    //
    //  Invokes echo lambda directly. Protected with identity-based IAM policy allowing invoke.
    //
    // To test:
    //
    // brew install awscurl
    // awscurl --region us-west-2 --profile <profile> --service execute-api https://public.nod15c.com/v1/echo/iam
    //
    // Profile should have full access to invoke
    //
    lambdaHelper.addMethod(
      this,
      root.resourceForPath('echo/iam'),
      'GET',
      {
        funcId: 'ApiEchoFuncIam',
        dir: 'echo',
        // initialPolicy: [allowInvokePolicyStatement(downstreamFuncArn)],
        funcProps: {
          handler: 'app.info.handler',
        },
      },
      {
        methodProps: { authorizationType: apigw.AuthorizationType.IAM },
      }
    )
    // Add identity-based IAM policy allowing invoke
    // iamUser.attachInlinePolicy(new iam.Policy(this, 'AllowBooks', {
    //     statements: [
    //       new iam.PolicyStatement({
    //         actions: [ 'execute-api:Invoke' ],
    //         effect: iam.Effect.Allow,
    //         resources: [ getBooks.methodArn() ]
    //       })
    //     ]
    //   }))
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
