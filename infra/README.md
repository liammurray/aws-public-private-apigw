# infra

Deploys VPC, private API and public API in three stacks.

## See outputs and exports

You can see stack outputs and exports using the following commands

```bash
aws cloudformation describe-stacks --stack-name PrivateDemoVpc | jq '.Stacks[].Outputs'
```

The following shows the same but via a Python script. Slightly better output and it can be modified with greater ease as needed.

```bash
../stack.py info PrivateDemoVpc
```

Exports can be used by other stacks. It creates a dependency.

```typescript
// PrivateDemoPrivateApi-EchoFuncD4A7A728-7HYEJODK8BW2:live
Fn.importValue('PrivateDemoPrivateApi:EchoFuncAliasLive')
```

## Build lambdas

```bash
cd ../funcs
make clean lambda
```

## VPC

```bash
npm run cdk deploy PrivateDemoVpc
```

At this point you can try to connect to the bastion over SSM (see outputs for `BastionHostId`).

```bash
../stack.py info PrivateDemoVpc
```

## Private API

```bash
npm run cdk deploy PrivateDemoPrivateApi
```

### Test Private API

In outputs you will see the private API URL (named `ApiVpceUrl`). This is a special form of the API URL that routes via the VPC endpoint. (It Assumes private DNS is disabled.)

```bash
curl -kv https://zzbbsbcjae-vpce-05a4df99f02d32c02.execute-api.us-west-2.amazonaws.com/active/v1/echo

curl -X POST  https://zzbbsbcjae-vpce-05a4df99f02d32c02.execute-api.us-west-2.amazonaws.com/active/v1/partner/message
```

### Troubleshoot Private API

Resource policy should allow "execute-api:Invoke" from source VPC (attached to endpoint) for any principal

https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-authorization-flow.html

API GW should show `vpce-04f89e17e5d351d8e` (endpoint id) or similar in settings. Once associated you can use URL with api id in the name.
This means you don't need to pass API ID in host header.

https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-private-apis.html#associate-private-api-with-vpc-endpoint

## Public API

```bash
npm run cdk deploy PrivateDemoPublicApi
```
