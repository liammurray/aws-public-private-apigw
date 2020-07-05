import * as cdk from '@aws-cdk/core'
import * as lambda from '@aws-cdk/aws-lambda'
import * as logs from '@aws-cdk/aws-logs'
import * as path from 'path'
import * as apigw from '@aws-cdk/aws-apigateway'

export function cfnExport(scope: cdk.Construct, exportName: string, value: string): void {
  new cdk.CfnOutput(cdk.Stack.of(scope), exportName, {
    value,
    exportName,
  })
}
export function cfnOutput(scope: cdk.Construct, name: string, value: string): void {
  new cdk.CfnOutput(cdk.Stack.of(scope), name, {
    value,
  })
}

/**
 * Assumes code build and packaged under 'lambda' directory
 */
type CodeAssetFunc = (name: string) => lambda.AssetCode
export function codeAssetFunc(basePath: string): CodeAssetFunc {
  return (name: string): lambda.AssetCode => {
    const codeDist = path.resolve(__dirname, path.join(basePath, `/${name}/lambda`))
    return lambda.Code.fromAsset(codeDist)
  }
}

/**
 * VPC ID (vpc-xxxxxx) or name of ImportValue containing ID
 */
export function getVpcId(vpc: string): string {
  return vpc.startsWith('vpc-') ? vpc : cdk.Fn.importValue(vpc)
}

export type EnvMap = {
  [key: string]: string
}
export class LambdaHelper {
  private codeAsset: CodeAssetFunc
  constructor(funcBasePath = '../../funcs') {
    this.codeAsset = codeAssetFunc(funcBasePath)
  }

  pyProps(dir: string, handler: string, env?: EnvMap): lambda.FunctionProps {
    //const funcVer = new Date().toISOString()

    return {
      code: this.codeAsset(dir),
      handler,
      runtime: lambda.Runtime.PYTHON_3_8,
      // tracing: lambda.Tracing.ACTIVE
      // reservedConcurrentExecutions: 100
      logRetention: logs.RetentionDays.FIVE_DAYS,
      environment: {
        ...env,
      },
    }
  }
  addPyFunc(
    scope: cdk.Construct,
    id: string,
    dir: string,
    handler: string,
    env?: EnvMap
  ): lambda.Function {
    const func = new lambda.Function(scope, id, this.pyProps(dir, handler, env))
    cfnOutput(scope, `${id}Id`, func.functionName)
    return func
  }

  addPyInt(
    scope: cdk.Construct,
    res: apigw.Resource,
    method: string,
    id: string,
    dir: string,
    handler: string,
    env?: EnvMap
  ): void {
    const func = this.addPyFunc(scope, id, dir, handler, env)
    res.addMethod(method, new apigw.LambdaIntegration(func))
  }
}
