import * as cdk from '@aws-cdk/core'
import * as lambda from '@aws-cdk/aws-lambda'
import * as logs from '@aws-cdk/aws-logs'
import * as path from 'path'
import * as apigw from '@aws-cdk/aws-apigateway'

import { cfnOutput } from './utils'

function cap(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Assumes code build and packaged under 'lambda' directory
 */
export type CodeAssetFunc = (name: string) => lambda.AssetCode
export function codeAssetFunc(basePath: string): CodeAssetFunc {
  return (name: string): lambda.AssetCode => {
    const codeDist = path.resolve(__dirname, path.join(basePath, `/${name}/lambda`))
    return lambda.Code.fromAsset(codeDist)
  }
}

export type EnvMap = {
  [key: string]: string
}

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<T>

export type AddLambdaProps = {
  // Foo
  funcId: string
  // Relative to code asset root, e.g. 'foo'
  dir: string
  // Add CFN exported value as well? Useful for stand-alone lambda.
  export?: boolean
  // Add alias to current version
  alias?: string
  funcProps: Optional<lambda.FunctionProps, 'code' | 'runtime'>
}

export type AddMethodProps = {
  methodProps?: apigw.MethodOptions
}

export type AddMethodResponse = {
  func: lambda.Function
  method: apigw.Method
}

export type FuncOpts = {
  basePath: string
  runtime: lambda.Runtime
  opts?: lambda.FunctionOptions
}

/**
 * Helper to minimize clutter for creating lambdas and lambda integrations for API methods
 */
export class LambdaHelper {
  private readonly codeAsset: CodeAssetFunc
  private readonly funcDefaults: Omit<lambda.FunctionProps, 'code' | 'handler'>

  constructor(opts: FuncOpts) {
    this.codeAsset = codeAssetFunc(opts.basePath || '../../funcs')
    this.funcDefaults = {
      // tracing: lambda.Tracing.ACTIVE
      logRetention: logs.RetentionDays.FIVE_DAYS,
      runtime: opts.runtime,
      ...opts.opts,
    }
  }

  /**
   * Adds lambda to stack. Can be used stand-alone or for API integration.
   */
  addLambda(scope: cdk.Construct, props: AddLambdaProps): lambda.Function {
    const { funcId, dir, funcProps } = props

    let extraOpts: lambda.FunctionOptions | undefined
    if (props.alias) {
      extraOpts = {
        currentVersionOptions: {
          // So you only see $LATEST and current version (may not work well with multiple aliases)
          // CDK will only create a new version if code hash changes
          removalPolicy: cdk.RemovalPolicy.DESTROY,
          // provisionedConcurrentExecutions: 1
        },
      }
    }

    const func = new lambda.Function(scope, funcId, {
      ...this.funcDefaults,
      ...extraOpts,
      ...funcProps,
      code: this.codeAsset(dir),
    })
    if (props.alias) {
      // Could be git hash
      // const ver = new Date().toISOString()
      // const version = func.addVersion(ver)
      // new lambda.Alias(scope, `${funcId}Alias`, {
      //   aliasName: props.alias,
      //   version,
      // })

      const alias = func.currentVersion.addAlias(props.alias)
      // PrivateDemoPrivateApi:EchoFuncAliasLive
      cfnOutput(scope, `${funcId}Alias${cap(props.alias)}`, alias.functionName, props.export)
    }

    cfnOutput(scope, `${funcId}Name`, func.functionName, props.export)

    return func
  }

  addMethod(
    scope: cdk.Construct,
    res: apigw.Resource,
    verb: string,
    props: AddLambdaProps,
    addMethodProps?: AddMethodProps
  ): AddMethodResponse {
    const func = this.addLambda(scope, props)
    const method = res.addMethod(
      verb,
      new apigw.LambdaIntegration(func),
      addMethodProps?.methodProps
    )
    return { func, method }
  }
}
